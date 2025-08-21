/**
 * RCM Self-Invoice Generation Tests
 * 
 * Testing self-invoice generation system as per GST Rule 47A
 * Requirements:
 * - Self-invoice must be issued within 30 days of receipt
 * - Separate invoice for each supplier/transaction
 * - Proper numbering format (SI-FY24-25/001)
 * - Compliance tracking and alerts
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  generateSelfInvoiceNumber,
  createSelfInvoice,
  validateSelfInvoiceGeneration,
  calculateDaysFromReceipt,
  checkSelfInvoiceDueDate,
  generateSelfInvoiceFromRCMTransaction,
  bulkGenerateSelfInvoices,
  getSelfInvoiceComplianceStatus,
  prepareSelfInvoiceForGSTR1,
  calculateSelfInvoicePenalty,
  SelfInvoice,
  SelfInvoiceGenerationRules,
  ComplianceStatus,
  ValidationResult,
} from '@/lib/rcm/rcm-self-invoice';

describe('RCM Self-Invoice Generation', () => {
  
  beforeEach(() => {
    vi.setSystemTime(new Date('2024-12-15'));
  });

  describe('Self-Invoice Number Generation', () => {
    test('should generate self-invoice number in correct format', () => {
      const number = generateSelfInvoiceNumber('2024-25', 1);
      expect(number).toBe('SI-FY24-25/001');
    });

    test('should pad invoice number with zeros', () => {
      const number = generateSelfInvoiceNumber('2024-25', 42);
      expect(number).toBe('SI-FY24-25/042');
    });

    test('should handle large invoice numbers', () => {
      const number = generateSelfInvoiceNumber('2024-25', 1234);
      expect(number).toBe('SI-FY24-25/1234');
    });

    test('should extract fiscal year correctly', () => {
      const number = generateSelfInvoiceNumber('2025-26', 1);
      expect(number).toBe('SI-FY25-26/001');
    });
  });

  describe('30-Day Time Limit Calculation', () => {
    test('should calculate days from goods receipt date', () => {
      const receiptDate = new Date('2024-11-15');
      const days = calculateDaysFromReceipt(receiptDate);
      expect(days).toBe(30); // From Nov 15 to Dec 15
    });

    test('should identify self-invoice is due within time', () => {
      const receiptDate = new Date('2024-12-01'); // 14 days ago
      const status = checkSelfInvoiceDueDate(receiptDate);
      
      expect(status.isWithinTime).toBe(true);
      expect(status.daysElapsed).toBe(14);
      expect(status.daysRemaining).toBe(16);
      expect(status.isOverdue).toBe(false);
    });

    test('should identify self-invoice is overdue', () => {
      const receiptDate = new Date('2024-11-01'); // 44 days ago
      const status = checkSelfInvoiceDueDate(receiptDate);
      
      expect(status.isWithinTime).toBe(false);
      expect(status.daysElapsed).toBe(44);
      expect(status.daysRemaining).toBe(-14);
      expect(status.isOverdue).toBe(true);
      expect(status.daysDelayed).toBe(14);
    });

    test('should warn when approaching deadline', () => {
      const receiptDate = new Date('2024-11-20'); // 25 days ago
      const status = checkSelfInvoiceDueDate(receiptDate);
      
      expect(status.isWithinTime).toBe(true);
      expect(status.daysRemaining).toBe(5);
      expect(status.warningLevel).toBe('HIGH');
    });

    test('should set critical warning at 28 days', () => {
      const receiptDate = new Date('2024-11-17'); // 28 days ago
      const status = checkSelfInvoiceDueDate(receiptDate);
      
      expect(status.isWithinTime).toBe(true);
      expect(status.daysRemaining).toBe(2);
      expect(status.warningLevel).toBe('CRITICAL');
    });
  });

  describe('Self-Invoice Validation', () => {
    test('should validate required fields for self-invoice', () => {
      const transaction = {
        id: 'trans-001',
        supplierName: 'ABC Suppliers',
        supplierAddress: '123 Street, Mumbai',
        supplierState: 'Maharashtra',
        supplierGSTIN: null, // Unregistered
        goodsReceiptDate: new Date('2024-12-01'),
        originalInvoiceNo: 'INV-001',
        placeOfSupply: 'Maharashtra',
        hsnSacCode: '998311',
        taxableAmount: 100000,
        gstRate: 18,
      };

      const validation = validateSelfInvoiceGeneration(transaction);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });

    test('should fail validation for missing supplier name', () => {
      const transaction = {
        id: 'trans-001',
        supplierName: '',
        goodsReceiptDate: new Date('2024-12-01'),
        placeOfSupply: 'Maharashtra',
        hsnSacCode: '998311',
      };

      const validation = validateSelfInvoiceGeneration(transaction);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Supplier name is required');
    });

    test('should fail validation for overdue self-invoice', () => {
      const transaction = {
        id: 'trans-001',
        supplierName: 'ABC Suppliers',
        goodsReceiptDate: new Date('2024-11-01'), // 44 days ago
        placeOfSupply: 'Maharashtra',
        hsnSacCode: '998311',
      };

      const validation = validateSelfInvoiceGeneration(transaction);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('30-day time limit exceeded');
    });

    test('should warn when approaching deadline', () => {
      const transaction = {
        id: 'trans-001',
        supplierName: 'ABC Suppliers',
        goodsReceiptDate: new Date('2024-11-20'), // 25 days ago
        placeOfSupply: 'Maharashtra',
        hsnSacCode: '998311',
      };

      const validation = validateSelfInvoiceGeneration(transaction);
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings[0]).toContain('5 days remaining');
    });

    test('should validate HSN/SAC code minimum length', () => {
      const transaction = {
        id: 'trans-001',
        supplierName: 'ABC Suppliers',
        goodsReceiptDate: new Date('2024-12-01'),
        placeOfSupply: 'Maharashtra',
        hsnSacCode: '99', // Too short
      };

      const validation = validateSelfInvoiceGeneration(transaction);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Valid HSN/SAC code required (minimum 4 digits)');
    });
  });

  describe('Self-Invoice Creation', () => {
    test('should create self-invoice from RCM transaction', () => {
      const rcmTransaction = {
        id: 'rcm-001',
        transactionType: 'UNREGISTERED',
        vendorName: 'ABC Suppliers',
        vendorAddress: '123 Street',
        vendorState: 'Maharashtra',
        vendorStateCode: '27',
        vendorGSTIN: null,
        invoiceNumber: 'VENDOR-INV-001',
        invoiceDate: new Date('2024-11-30'),
        goodsReceiptDate: new Date('2024-12-01'),
        description: 'Professional Services',
        hsnSacCode: '998311',
        taxableAmount: 100000,
        placeOfSupply: 'Maharashtra',
        gstRate: 18,
      };

      const userDetails = {
        gstin: '27AAAAA0000A1Z5',
        legalName: 'XYZ Company Pvt Ltd',
        address: '456 Avenue, Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
      };

      const selfInvoice = generateSelfInvoiceFromRCMTransaction(
        rcmTransaction,
        userDetails,
        'SI-FY24-25/001'
      );

      expect(selfInvoice.invoiceNumber).toBe('SI-FY24-25/001');
      expect(selfInvoice.rcmTransactionId).toBe('rcm-001');
      expect(selfInvoice.supplierName).toBe('ABC Suppliers');
      expect(selfInvoice.recipientGSTIN).toBe('27AAAAA0000A1Z5');
      expect(selfInvoice.recipientName).toBe('XYZ Company Pvt Ltd');
      expect(selfInvoice.rcmType).toBe('UNREGISTERED');
      expect(selfInvoice.taxableAmount).toBe(100000);
      expect(selfInvoice.issuedWithinTime).toBe(true);
    });

    test('should calculate CGST/SGST for intra-state supply', () => {
      const rcmTransaction = {
        vendorState: 'Maharashtra',
        vendorStateCode: '27',
        placeOfSupply: 'Maharashtra',
        taxableAmount: 100000,
        gstRate: 18,
      };

      const userDetails = {
        state: 'Maharashtra',
        stateCode: '27',
      };

      const selfInvoice = generateSelfInvoiceFromRCMTransaction(
        rcmTransaction,
        userDetails,
        'SI-FY24-25/001'
      );

      expect(selfInvoice.cgstRate).toBe(9);
      expect(selfInvoice.cgstAmount).toBe(9000);
      expect(selfInvoice.sgstRate).toBe(9);
      expect(selfInvoice.sgstAmount).toBe(9000);
      expect(selfInvoice.igstRate).toBeNull();
      expect(selfInvoice.igstAmount).toBeNull();
      expect(selfInvoice.totalTaxAmount).toBe(18000);
      expect(selfInvoice.totalAmount).toBe(118000);
    });

    test('should calculate IGST for inter-state supply', () => {
      const rcmTransaction = {
        vendorState: 'Karnataka',
        vendorStateCode: '29',
        placeOfSupply: 'Maharashtra',
        taxableAmount: 100000,
        gstRate: 18,
      };

      const userDetails = {
        state: 'Maharashtra',
        stateCode: '27',
      };

      const selfInvoice = generateSelfInvoiceFromRCMTransaction(
        rcmTransaction,
        userDetails,
        'SI-FY24-25/001'
      );

      expect(selfInvoice.cgstRate).toBeNull();
      expect(selfInvoice.cgstAmount).toBeNull();
      expect(selfInvoice.sgstRate).toBeNull();
      expect(selfInvoice.sgstAmount).toBeNull();
      expect(selfInvoice.igstRate).toBe(18);
      expect(selfInvoice.igstAmount).toBe(18000);
      expect(selfInvoice.totalTaxAmount).toBe(18000);
      expect(selfInvoice.totalAmount).toBe(118000);
    });

    test('should handle import of services', () => {
      const rcmTransaction = {
        transactionType: 'IMPORT_SERVICE',
        vendorName: 'Google Inc',
        vendorCountry: 'USA',
        vendorState: 'Foreign',
        vendorStateCode: '99',
        placeOfSupply: 'Maharashtra',
        taxableAmount: 5000, // USD
        foreignCurrency: 'USD',
        exchangeRate: 83.5,
        gstRate: 18,
      };

      const selfInvoice = generateSelfInvoiceFromRCMTransaction(
        rcmTransaction,
        {},
        'SI-FY24-25/001'
      );

      expect(selfInvoice.rcmType).toBe('IMPORT_SERVICE');
      expect(selfInvoice.supplierName).toBe('Google Inc');
      expect(selfInvoice.taxableAmount).toBe(417500); // 5000 * 83.5
      expect(selfInvoice.igstRate).toBe(18);
      expect(selfInvoice.igstAmount).toBe(75150); // 417500 * 0.18
    });

    test('should add cess amount if applicable', () => {
      const rcmTransaction = {
        taxableAmount: 100000,
        gstRate: 18,
        cessRate: 1,
        cessAmount: 1000,
      };

      const selfInvoice = generateSelfInvoiceFromRCMTransaction(
        rcmTransaction,
        {},
        'SI-FY24-25/001'
      );

      expect(selfInvoice.cessRate).toBe(1);
      expect(selfInvoice.cessAmount).toBe(1000);
      expect(selfInvoice.totalTaxAmount).toBe(19000); // 18000 + 1000
      expect(selfInvoice.totalAmount).toBe(119000);
    });
  });

  describe('Bulk Self-Invoice Generation', () => {
    test('should generate multiple self-invoices in bulk', () => {
      const rcmTransactions = [
        {
          id: 'rcm-001',
          vendorName: 'Vendor A',
          goodsReceiptDate: new Date('2024-12-01'),
          taxableAmount: 50000,
          gstRate: 18,
        },
        {
          id: 'rcm-002',
          vendorName: 'Vendor B',
          goodsReceiptDate: new Date('2024-12-05'),
          taxableAmount: 75000,
          gstRate: 12,
        },
        {
          id: 'rcm-003',
          vendorName: 'Vendor C',
          goodsReceiptDate: new Date('2024-12-10'),
          taxableAmount: 100000,
          gstRate: 28,
        },
      ];

      const result = bulkGenerateSelfInvoices(rcmTransactions, {}, 'FY24-25', 100);

      expect(result.generated).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.generated[0].invoiceNumber).toBe('SI-FY24-25/100');
      expect(result.generated[1].invoiceNumber).toBe('SI-FY24-25/101');
      expect(result.generated[2].invoiceNumber).toBe('SI-FY24-25/102');
    });

    test('should skip overdue transactions in bulk generation', () => {
      const rcmTransactions = [
        {
          id: 'rcm-001',
          vendorName: 'Vendor A',
          goodsReceiptDate: new Date('2024-12-01'),
          taxableAmount: 50000,
        },
        {
          id: 'rcm-002',
          vendorName: 'Vendor B',
          goodsReceiptDate: new Date('2024-10-01'), // Overdue
          taxableAmount: 75000,
        },
      ];

      const result = bulkGenerateSelfInvoices(rcmTransactions, {}, 'FY24-25', 1);

      expect(result.generated).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].transactionId).toBe('rcm-002');
      expect(result.failed[0].reason).toContain('30-day time limit exceeded');
    });
  });

  describe('Compliance Status', () => {
    test('should calculate compliance status for self-invoices', () => {
      const selfInvoices = [
        { issuedWithinTime: true, daysDelayed: 0 },
        { issuedWithinTime: true, daysDelayed: 0 },
        { issuedWithinTime: false, daysDelayed: 5 },
        { issuedWithinTime: true, daysDelayed: 0 },
      ];

      const pendingCount = 2;

      const status = getSelfInvoiceComplianceStatus(selfInvoices, pendingCount);

      expect(status.totalSelfInvoices).toBe(4);
      expect(status.issuedOnTime).toBe(3);
      expect(status.issuedLate).toBe(1);
      expect(status.pending).toBe(2);
      expect(status.complianceRate).toBe(75); // 3 out of 4 on time
      expect(status.rating).toBe('GOOD');
    });

    test('should identify poor compliance', () => {
      const selfInvoices = [
        { issuedWithinTime: false, daysDelayed: 10 },
        { issuedWithinTime: false, daysDelayed: 15 },
        { issuedWithinTime: false, daysDelayed: 5 },
        { issuedWithinTime: true, daysDelayed: 0 },
      ];

      const status = getSelfInvoiceComplianceStatus(selfInvoices, 0);

      expect(status.complianceRate).toBe(25); // 1 out of 4 on time
      expect(status.rating).toBe('POOR');
      expect(status.requiresAction).toBe(true);
    });
  });

  describe('GSTR-1 Integration', () => {
    test('should prepare self-invoice data for GSTR-1 Table 4B', () => {
      const selfInvoices = [
        {
          invoiceNumber: 'SI-FY24-25/001',
          invoiceDate: new Date('2024-12-10'),
          supplierGSTIN: null,
          taxableAmount: 100000,
          cgstAmount: 9000,
          sgstAmount: 9000,
          igstAmount: 0,
          cessAmount: 0,
        },
        {
          invoiceNumber: 'SI-FY24-25/002',
          invoiceDate: new Date('2024-12-12'),
          supplierGSTIN: '29AAAAA0000A1Z5',
          taxableAmount: 50000,
          igstAmount: 9000,
        },
      ];

      const gstrData = prepareSelfInvoiceForGSTR1(selfInvoices, '12-2024');

      expect(gstrData.table4B).toBeDefined();
      expect(gstrData.table4B.supplyType).toBe('RCHRG');
      expect(gstrData.table4B.invoices).toHaveLength(2);
      expect(gstrData.table4B.totalTaxableValue).toBe(150000);
      expect(gstrData.table4B.totalCGST).toBe(9000);
      expect(gstrData.table4B.totalSGST).toBe(9000);
      expect(gstrData.table4B.totalIGST).toBe(9000);
    });
  });

  describe('Penalty Calculation', () => {
    test('should calculate penalty for delayed self-invoice', () => {
      const selfInvoice = {
        goodsReceiptDate: new Date('2024-10-01'),
        invoiceDate: new Date('2024-11-15'), // 45 days later
        totalTaxAmount: 18000,
      };

      const penalty = calculateSelfInvoicePenalty(selfInvoice);

      expect(penalty.daysDelayed).toBe(15); // 45 - 30
      expect(penalty.interestRate).toBe(18); // Annual rate
      expect(penalty.interestAmount).toBeCloseTo(133.15); // (18000 * 18% * 15) / 365
      expect(penalty.penaltyAmount).toBe(10000); // Minimum penalty
      expect(penalty.totalPenalty).toBeCloseTo(10133.15);
    });

    test('should not calculate penalty for on-time self-invoice', () => {
      const selfInvoice = {
        goodsReceiptDate: new Date('2024-11-20'),
        invoiceDate: new Date('2024-12-10'), // 20 days later
        totalTaxAmount: 18000,
      };

      const penalty = calculateSelfInvoicePenalty(selfInvoice);

      expect(penalty.daysDelayed).toBe(0);
      expect(penalty.interestAmount).toBe(0);
      expect(penalty.penaltyAmount).toBe(0);
      expect(penalty.totalPenalty).toBe(0);
    });
  });

  describe('Self-Invoice Rules', () => {
    test('should enforce mandatory self-invoice for unregistered vendors', () => {
      const rules: SelfInvoiceGenerationRules = {
        mandatoryFor: {
          unregisteredVendors: true,
          importOfServices: true,
          notifiedServices: true,
          notifiedGoods: true,
        },
        timeLimits: {
          maxDays: 30,
          warningDays: 25,
          criticalDays: 28,
        },
        numberFormat: 'SI-{FY}/{NUMBER}',
      };

      expect(rules.mandatoryFor.unregisteredVendors).toBe(true);
      expect(rules.timeLimits.maxDays).toBe(30);
    });
  });
});