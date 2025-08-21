import { describe, test, expect, beforeEach, vi } from 'vitest';

/**
 * TDD Test Suite for RCM Phase 3: GSTR-3B Integration
 * 
 * These tests are written FIRST (RED phase) to define requirements
 * for GSTR-3B return preparation with RCM compliance including:
 * - Table 3.1(d) - Inward supplies liable to reverse charge
 * - Table 4 - Eligible ITC with RCM amounts
 * - JSON generation for GSTR-3B filing
 * - Validation and reconciliation
 */

// Import types and implementations
import type {
  GSTR3BReturn,
  RCMInwardSupplies,
  RCMITCEligible,
  GSTR3BValidation,
  ReturnPeriod
} from '@/lib/rcm/gstr3b-integration';

import {
  prepareGSTR3BWithRCM,
  calculateRCMInwardSupplies,
  calculateRCMITC,
  validateGSTR3B,
  generateGSTR3BJSON,
  reconcileWithBooks,
  getReturnPeriod,
  calculateTable31d,
  calculateTable4B
} from '@/lib/rcm/gstr3b-integration';

describe('GSTR-3B Integration with RCM', () => {
  
  // Mock current date for testing
  const MOCK_CURRENT_DATE = new Date('2024-06-15');
  
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_CURRENT_DATE);
  });

  describe('Return Period Management', () => {
    test('should identify correct return period for monthly filing', () => {
      const period = getReturnPeriod(new Date('2024-06-15'), 'MONTHLY');
      
      expect(period.month).toBe(6);
      expect(period.year).toBe(2024);
      expect(period.returnPeriod).toBe('062024');
      expect(period.startDate).toEqual(new Date('2024-06-01'));
      expect(period.endDate).toEqual(new Date('2024-06-30'));
      expect(period.dueDate).toEqual(new Date('2024-07-20'));
    });

    test('should identify correct return period for quarterly filing', () => {
      const periodQ1 = getReturnPeriod(new Date('2024-03-15'), 'QUARTERLY');
      expect(periodQ1.quarter).toBe('Q1');
      expect(periodQ1.returnPeriod).toBe('Q12024');
      expect(periodQ1.startDate).toEqual(new Date('2024-01-01'));
      expect(periodQ1.endDate).toEqual(new Date('2024-03-31'));
      expect(periodQ1.dueDate).toEqual(new Date('2024-04-24'));

      const periodQ2 = getReturnPeriod(new Date('2024-06-15'), 'QUARTERLY');
      expect(periodQ2.quarter).toBe('Q2');
      expect(periodQ2.returnPeriod).toBe('Q22024');
      expect(periodQ2.dueDate).toEqual(new Date('2024-07-24'));
    });
  });

  describe('Table 3.1(d) - Inward Supplies Liable to Reverse Charge', () => {
    test('should calculate RCM inward supplies for unregistered vendors', () => {
      const rcmTransactions = [
        {
          vendorType: 'UNREGISTERED',
          taxableAmount: 50000,
          cgst: 4500,
          sgst: 4500,
          igst: 0,
          cess: 0,
        },
        {
          vendorType: 'UNREGISTERED',
          taxableAmount: 30000,
          cgst: 0,
          sgst: 0,
          igst: 5400,
          cess: 0,
        },
      ];

      const table31d = calculateTable31d(rcmTransactions);
      
      expect(table31d.totalTaxableValue).toBe(80000);
      expect(table31d.integratedTax).toBe(5400);
      expect(table31d.centralTax).toBe(4500);
      expect(table31d.stateTax).toBe(4500);
      expect(table31d.cess).toBe(0);
      expect(table31d.description).toBe('Inward supplies from unregistered persons liable to reverse charge');
    });

    test('should calculate RCM for notified services', () => {
      const rcmTransactions = [
        {
          vendorType: 'REGISTERED',
          serviceType: 'NOTIFIED_SERVICE',
          description: 'Legal services',
          hsnSacCode: '998211',
          taxableAmount: 100000,
          cgst: 9000,
          sgst: 9000,
          igst: 0,
          cess: 0,
        },
        {
          vendorType: 'REGISTERED',
          serviceType: 'NOTIFIED_SERVICE',
          description: 'GTA services',
          hsnSacCode: '996711',
          taxableAmount: 50000,
          cgst: 0,
          sgst: 0,
          igst: 2500,
          cess: 0,
        },
      ];

      const table31d = calculateTable31d(rcmTransactions);
      
      expect(table31d.totalTaxableValue).toBe(150000);
      expect(table31d.integratedTax).toBe(2500);
      expect(table31d.centralTax).toBe(9000);
      expect(table31d.stateTax).toBe(9000);
    });

    test('should calculate RCM for import of services', () => {
      const rcmTransactions = [
        {
          vendorType: 'FOREIGN',
          serviceType: 'IMPORT_SERVICE',
          vendorCountry: 'USA',
          taxableAmount: 200000,
          cgst: 0,
          sgst: 0,
          igst: 36000,
          cess: 0,
        },
      ];

      const table31d = calculateTable31d(rcmTransactions);
      
      expect(table31d.totalTaxableValue).toBe(200000);
      expect(table31d.integratedTax).toBe(36000);
      expect(table31d.centralTax).toBe(0);
      expect(table31d.stateTax).toBe(0);
      expect(table31d.includesImportOfServices).toBe(true);
    });

    test('should aggregate all RCM categories correctly', () => {
      const rcmTransactions = [
        // Unregistered vendor
        {
          vendorType: 'UNREGISTERED',
          taxableAmount: 30000,
          cgst: 2700,
          sgst: 2700,
          igst: 0,
          cess: 0,
        },
        // Notified service
        {
          vendorType: 'REGISTERED',
          serviceType: 'NOTIFIED_SERVICE',
          taxableAmount: 100000,
          cgst: 0,
          sgst: 0,
          igst: 18000,
          cess: 0,
        },
        // Import of service
        {
          vendorType: 'FOREIGN',
          serviceType: 'IMPORT_SERVICE',
          taxableAmount: 50000,
          cgst: 0,
          sgst: 0,
          igst: 9000,
          cess: 0,
        },
      ];

      const table31d = calculateTable31d(rcmTransactions);
      
      expect(table31d.totalTaxableValue).toBe(180000);
      expect(table31d.integratedTax).toBe(27000);
      expect(table31d.centralTax).toBe(2700);
      expect(table31d.stateTax).toBe(2700);
      expect(table31d.totalTax).toBe(32400);
    });
  });

  describe('Table 4(B) - ITC Available (RCM)', () => {
    test('should calculate eligible ITC on RCM for inputs', () => {
      const rcmITC = [
        {
          category: 'INPUTS',
          taxableAmount: 50000,
          cgst: 4500,
          sgst: 4500,
          igst: 0,
          cess: 0,
          itcEligible: true,
        },
      ];

      const table4B = calculateTable4B(rcmITC);
      
      expect(table4B.inputs.integratedTax).toBe(0);
      expect(table4B.inputs.centralTax).toBe(4500);
      expect(table4B.inputs.stateTax).toBe(4500);
      expect(table4B.inputs.cess).toBe(0);
      expect(table4B.totalITC).toBe(9000);
    });

    test('should calculate eligible ITC on RCM for input services', () => {
      const rcmITC = [
        {
          category: 'INPUT_SERVICES',
          serviceType: 'Legal services',
          taxableAmount: 100000,
          cgst: 0,
          sgst: 0,
          igst: 18000,
          cess: 0,
          itcEligible: true,
        },
      ];

      const table4B = calculateTable4B(rcmITC);
      
      expect(table4B.inputServices.integratedTax).toBe(18000);
      expect(table4B.inputServices.centralTax).toBe(0);
      expect(table4B.inputServices.stateTax).toBe(0);
      expect(table4B.totalITC).toBe(18000);
    });

    test('should handle mixed ITC categories', () => {
      const rcmITC = [
        {
          category: 'INPUTS',
          taxableAmount: 30000,
          cgst: 2700,
          sgst: 2700,
          igst: 0,
          cess: 0,
          itcEligible: true,
        },
        {
          category: 'INPUT_SERVICES',
          taxableAmount: 50000,
          cgst: 0,
          sgst: 0,
          igst: 9000,
          cess: 0,
          itcEligible: true,
        },
        {
          category: 'CAPITAL_GOODS',
          taxableAmount: 100000,
          cgst: 9000,
          sgst: 9000,
          igst: 0,
          cess: 0,
          itcEligible: true,
        },
      ];

      const table4B = calculateTable4B(rcmITC);
      
      expect(table4B.inputs.centralTax).toBe(2700);
      expect(table4B.inputs.stateTax).toBe(2700);
      expect(table4B.inputServices.integratedTax).toBe(9000);
      expect(table4B.capitalGoods.centralTax).toBe(9000);
      expect(table4B.capitalGoods.stateTax).toBe(9000);
      expect(table4B.totalITC).toBe(32400);
    });

    test('should exclude ineligible ITC', () => {
      const rcmITC = [
        {
          category: 'INPUT_SERVICES',
          serviceType: 'Rent-a-cab',
          taxableAmount: 10000,
          cgst: 250,
          sgst: 250,
          igst: 0,
          cess: 0,
          itcEligible: false, // Not eligible as per Section 17(5)
          ineligibleReason: 'Section 17(5) - Motor vehicles',
        },
        {
          category: 'INPUT_SERVICES',
          serviceType: 'Legal services',
          taxableAmount: 50000,
          cgst: 4500,
          sgst: 4500,
          igst: 0,
          cess: 0,
          itcEligible: true,
        },
      ];

      const table4B = calculateTable4B(rcmITC);
      
      // Only eligible ITC should be included
      expect(table4B.inputServices.centralTax).toBe(4500);
      expect(table4B.inputServices.stateTax).toBe(4500);
      expect(table4B.totalITC).toBe(9000);
      expect(table4B.ineligibleITC).toBe(500);
    });
  });

  describe('Complete GSTR-3B Preparation', () => {
    test('should prepare complete GSTR-3B with RCM sections', () => {
      const rcmData = {
        returnPeriod: '062024',
        gstin: '27AABCU9603R1ZV',
        legalName: 'ABC Company Ltd',
        rcmTransactions: [
          {
            vendorType: 'UNREGISTERED',
            taxableAmount: 50000,
            cgst: 4500,
            sgst: 4500,
            igst: 0,
            cess: 0,
          },
          {
            vendorType: 'FOREIGN',
            serviceType: 'IMPORT_SERVICE',
            taxableAmount: 100000,
            cgst: 0,
            sgst: 0,
            igst: 18000,
            cess: 0,
          },
        ],
        rcmITC: [
          {
            category: 'INPUT_SERVICES',
            taxableAmount: 150000,
            cgst: 4500,
            sgst: 4500,
            igst: 18000,
            cess: 0,
            itcEligible: true,
          },
        ],
      };

      const gstr3b = prepareGSTR3BWithRCM(rcmData);
      
      expect(gstr3b.gstin).toBe('27AABCU9603R1ZV');
      expect(gstr3b.returnPeriod).toBe('062024');
      
      // Table 3.1(d) verification
      expect(gstr3b.table31d.totalTaxableValue).toBe(150000);
      expect(gstr3b.table31d.integratedTax).toBe(18000);
      expect(gstr3b.table31d.centralTax).toBe(4500);
      expect(gstr3b.table31d.stateTax).toBe(4500);
      
      // Table 4(B) verification
      expect(gstr3b.table4B.totalITC).toBe(27000);
    });

    test('should calculate tax payable including RCM', () => {
      const gstr3b = {
        table31: {
          totalOutputTax: 100000, // Regular output tax
        },
        table31d: {
          totalTax: 27000, // RCM tax
        },
        table4: {
          totalITC: 80000, // Regular ITC
        },
        table4B: {
          totalITC: 27000, // RCM ITC
        },
      };

      const taxPayable = {
        igst: Math.max(0, (gstr3b.table31.totalOutputTax + gstr3b.table31d.totalTax) - (gstr3b.table4.totalITC + gstr3b.table4B.totalITC)),
      };

      expect(taxPayable.igst).toBe(20000); // (100000 + 27000) - (80000 + 27000)
    });
  });

  describe('GSTR-3B JSON Generation', () => {
    test('should generate valid JSON for GSTR-3B filing', () => {
      const gstr3bData = {
        gstin: '27AABCU9603R1ZV',
        returnPeriod: '062024',
        table31d: {
          totalTaxableValue: 150000,
          integratedTax: 18000,
          centralTax: 4500,
          stateTax: 4500,
          cess: 0,
        },
        table4B: {
          inputs: {
            integratedTax: 0,
            centralTax: 0,
            stateTax: 0,
            cess: 0,
          },
          inputServices: {
            integratedTax: 18000,
            centralTax: 4500,
            stateTax: 4500,
            cess: 0,
          },
          capitalGoods: {
            integratedTax: 0,
            centralTax: 0,
            stateTax: 0,
            cess: 0,
          },
          totalITC: 27000,
        },
      };

      const json = generateGSTR3BJSON(gstr3bData);
      
      expect(json).toBeDefined();
      expect(json.gstin).toBe('27AABCU9603R1ZV');
      expect(json.ret_period).toBe('062024');
      
      // Verify RCM sections in JSON
      expect(json.sup_details.isup_rev.txval).toBe(150000);
      expect(json.sup_details.isup_rev.iamt).toBe(18000);
      expect(json.sup_details.isup_rev.camt).toBe(4500);
      expect(json.sup_details.isup_rev.samt).toBe(4500);
      expect(json.sup_details.isup_rev.csamt).toBe(0);
      
      // Verify ITC sections
      expect(json.itc_elg.itc_rev).toBeDefined();
      expect(json.itc_elg.itc_rev.length).toBeGreaterThan(0);
    });

    test('should format numbers correctly in JSON', () => {
      const gstr3bData = {
        table31d: {
          totalTaxableValue: 123456.78,
          integratedTax: 22222.22,
          centralTax: 11111.11,
          stateTax: 11111.11,
          cess: 0,
        },
      };

      const json = generateGSTR3BJSON(gstr3bData);
      
      // Numbers should be rounded to 2 decimal places
      expect(json.sup_details.isup_rev.txval).toBe(123456.78);
      expect(json.sup_details.isup_rev.iamt).toBe(22222.22);
      expect(json.sup_details.isup_rev.camt).toBe(11111.11);
      expect(json.sup_details.isup_rev.samt).toBe(11111.11);
    });
  });

  describe('GSTR-3B Validation', () => {
    test('should validate RCM amounts match payment records', () => {
      const gstr3b = {
        table31d: {
          totalTax: 27000,
        },
        paymentRecords: [
          { amount: 27000, type: 'RCM', status: 'PAID' },
        ],
      };

      const validation = validateGSTR3B(gstr3b);
      
      expect(validation.isValid).toBe(true);
      expect(validation.rcmPaymentMatches).toBe(true);
    });

    test('should identify mismatches in RCM reporting', () => {
      const gstr3b = {
        table31d: {
          totalTax: 27000,
        },
        paymentRecords: [
          { amount: 25000, type: 'RCM', status: 'PAID' },
        ],
      };

      const validation = validateGSTR3B(gstr3b);
      
      expect(validation.isValid).toBe(false);
      expect(validation.rcmPaymentMatches).toBe(false);
      expect(validation.rcmMismatchAmount).toBe(2000);
      expect(validation.errors).toContain('RCM payment mismatch');
    });

    test('should validate ITC claims match RCM payments', () => {
      const gstr3b = {
        table31d: {
          totalTax: 18000,
        },
        table4B: {
          totalITC: 18000,
        },
      };

      const validation = validateGSTR3B(gstr3b);
      
      expect(validation.isValid).toBe(true);
      expect(validation.itcRcmBalanced).toBe(true);
    });

    test('should flag excessive ITC claims on RCM', () => {
      const gstr3b = {
        table31d: {
          totalTax: 18000,
        },
        table4B: {
          totalITC: 20000, // More than RCM paid
        },
      };

      const validation = validateGSTR3B(gstr3b);
      
      expect(validation.isValid).toBe(false);
      expect(validation.itcRcmBalanced).toBe(false);
      expect(validation.errors).toContain('ITC claimed exceeds RCM paid');
    });
  });

  describe('Books Reconciliation', () => {
    test('should reconcile GSTR-3B with accounting books', () => {
      const gstr3bData = {
        table31d: {
          totalTaxableValue: 150000,
          totalTax: 27000,
        },
      };

      const booksData = {
        rcmPurchases: 150000,
        rcmTaxPaid: 27000,
      };

      const reconciliation = reconcileWithBooks(gstr3bData, booksData);
      
      expect(reconciliation.matches).toBe(true);
      expect(reconciliation.taxableValueDifference).toBe(0);
      expect(reconciliation.taxDifference).toBe(0);
    });

    test('should identify differences between GSTR-3B and books', () => {
      const gstr3bData = {
        table31d: {
          totalTaxableValue: 150000,
          totalTax: 27000,
        },
      };

      const booksData = {
        rcmPurchases: 145000,
        rcmTaxPaid: 26100,
      };

      const reconciliation = reconcileWithBooks(gstr3bData, booksData);
      
      expect(reconciliation.matches).toBe(false);
      expect(reconciliation.taxableValueDifference).toBe(5000);
      expect(reconciliation.taxDifference).toBe(900);
      expect(reconciliation.requiresAdjustment).toBe(true);
    });

    test('should suggest adjustments for reconciliation', () => {
      const gstr3bData = {
        table31d: {
          totalTaxableValue: 150000,
          totalTax: 27000,
        },
      };

      const booksData = {
        rcmPurchases: 160000,
        rcmTaxPaid: 28800,
      };

      const reconciliation = reconcileWithBooks(gstr3bData, booksData);
      
      expect(reconciliation.suggestedAdjustments).toBeDefined();
      expect(reconciliation.suggestedAdjustments.length).toBeGreaterThan(0);
      expect(reconciliation.suggestedAdjustments[0].description).toContain('missing transaction');
    });
  });
});