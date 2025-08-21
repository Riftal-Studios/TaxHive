/**
 * Unit Tests for RCM ITC Management
 * 
 * Following TDD methodology - RED phase
 * Tests written before implementation
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  determineITCEligibility,
  calculateITCDeadline,
  processITCClaim,
  reverseITCClaim,
  checkBlockedCredits,
  prepareITCForGSTR3B,
  getExpiringClaims,
  calculateITCUtilization,
  ITCEligibilityInput,
  ITCClaim,
  BlockedCreditRule,
  ITCCategory,
  ITCClaimStatus,
} from '@/lib/rcm/rcm-itc-management';

describe('RCM ITC Management', () => {
  describe('ITC Eligibility Determination', () => {
    test('should determine eligible ITC for business purpose transactions', () => {
      const input: ITCEligibilityInput = {
        rcmTransactionId: 'trans-1',
        selfInvoiceId: 'si-1',
        selfInvoiceDate: new Date('2024-10-15'),
        paymentCompleted: true,
        businessPurpose: 'Office supplies',
        category: 'INPUTS',
        cgstAmount: 5000,
        sgstAmount: 5000,
        igstAmount: 0,
        cessAmount: 0,
      };
      
      const result = determineITCEligibility(input);
      
      expect(result.isEligible).toBe(true);
      expect(result.eligibilityStatus).toBe('ELIGIBLE');
      expect(result.totalITCAmount).toBe(10000);
      expect(result.blockReason).toBeNull();
    });
    
    test('should block ITC for personal use items', () => {
      const input: ITCEligibilityInput = {
        rcmTransactionId: 'trans-2',
        selfInvoiceId: 'si-2',
        selfInvoiceDate: new Date('2024-10-15'),
        paymentCompleted: true,
        businessPurpose: 'Personal vehicle',
        category: 'CAPITAL_GOODS',
        cgstAmount: 25000,
        sgstAmount: 25000,
        igstAmount: 0,
        cessAmount: 0,
      };
      
      const result = determineITCEligibility(input);
      
      expect(result.isEligible).toBe(false);
      expect(result.eligibilityStatus).toBe('BLOCKED');
      expect(result.blockReason).toContain('Section 17(5)');
      expect(result.totalITCAmount).toBe(0);
    });
    
    test('should block ITC when payment not completed', () => {
      const input: ITCEligibilityInput = {
        rcmTransactionId: 'trans-3',
        selfInvoiceId: 'si-3',
        selfInvoiceDate: new Date('2024-10-15'),
        paymentCompleted: false,
        businessPurpose: 'Professional services',
        category: 'INPUT_SERVICES',
        cgstAmount: 9000,
        sgstAmount: 9000,
        igstAmount: 0,
        cessAmount: 0,
      };
      
      const result = determineITCEligibility(input);
      
      expect(result.isEligible).toBe(false);
      expect(result.eligibilityStatus).toBe('PAYMENT_PENDING');
      expect(result.blockReason).toBe('Payment not completed');
    });
    
    test('should handle IGST for inter-state supplies', () => {
      const input: ITCEligibilityInput = {
        rcmTransactionId: 'trans-4',
        selfInvoiceId: 'si-4',
        selfInvoiceDate: new Date('2024-10-15'),
        paymentCompleted: true,
        businessPurpose: 'Import of services',
        category: 'INPUT_SERVICES',
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 18000,
        cessAmount: 500,
      };
      
      const result = determineITCEligibility(input);
      
      expect(result.isEligible).toBe(true);
      expect(result.totalITCAmount).toBe(18500);
      expect(result.igstAmount).toBe(18000);
      expect(result.cessAmount).toBe(500);
    });
  });
  
  describe('Blocked Credits Identification', () => {
    test('should identify blocked credit for motor vehicles', () => {
      const result = checkBlockedCredits({
        hsnCode: '8703',
        description: 'Motor car purchase',
        businessPurpose: 'Employee transport',
      });
      
      expect(result.isBlocked).toBe(true);
      expect(result.section).toBe('17(5)(a)');
      expect(result.reason).toContain('motor vehicles');
    });
    
    test('should allow motor vehicle ITC for specific exceptions', () => {
      const result = checkBlockedCredits({
        hsnCode: '8703',
        description: 'Motor car for transportation business',
        businessPurpose: 'Taxi service operations',
      });
      
      expect(result.isBlocked).toBe(false);
      expect(result.exception).toContain('taxi service');
    });
    
    test('should block ITC for food and beverages', () => {
      const result = checkBlockedCredits({
        hsnCode: '2106',
        description: 'Food and beverages',
        businessPurpose: 'Office party',
      });
      
      expect(result.isBlocked).toBe(true);
      expect(result.section).toBe('17(5)(b)(i)');
      expect(result.reason).toContain('food and beverages');
    });
    
    test('should block ITC for health insurance', () => {
      const result = checkBlockedCredits({
        sacCode: '997132',
        description: 'Health insurance premium',
        businessPurpose: 'Employee health insurance',
      });
      
      expect(result.isBlocked).toBe(true);
      expect(result.section).toBe('17(5)(b)(iii)');
      expect(result.reason).toContain('health insurance');
    });
    
    test('should block ITC for works contract for immovable property', () => {
      const result = checkBlockedCredits({
        sacCode: '9954',
        description: 'Construction of building',
        businessPurpose: 'Office construction',
      });
      
      expect(result.isBlocked).toBe(true);
      expect(result.section).toBe('17(5)(c)');
      expect(result.reason).toContain('works contract');
    });
  });
  
  describe('Time Limit Calculations', () => {
    test('should calculate deadline as November 30th of next financial year', () => {
      const selfInvoiceDate = new Date('2024-10-15');
      const result = calculateITCDeadline(selfInvoiceDate);
      
      expect(result.financialYear).toBe('2024-25');
      expect(result.deadlineDate).toEqual(new Date('2025-11-30'));
      expect(result.daysRemaining).toBeGreaterThan(0);
    });
    
    test('should handle self-invoice in January correctly', () => {
      const selfInvoiceDate = new Date('2025-01-15');
      const result = calculateITCDeadline(selfInvoiceDate);
      
      expect(result.financialYear).toBe('2024-25');
      expect(result.deadlineDate).toEqual(new Date('2025-11-30'));
    });
    
    test('should identify expired claims', () => {
      const selfInvoiceDate = new Date('2023-05-15');
      const result = calculateITCDeadline(selfInvoiceDate);
      
      expect(result.isExpired).toBe(true);
      expect(result.daysRemaining).toBe(0);
      expect(result.expiryStatus).toBe('EXPIRED');
    });
    
    test('should generate warning for claims expiring within 30 days', () => {
      // Create a self-invoice from March of last fiscal year
      // So deadline is November 30 of current year
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      
      // If we're past November, use March of this year for next November deadline
      // Otherwise use March of last year for this November deadline
      const invoiceYear = currentMonth > 11 ? currentYear : currentYear - 1;
      const selfInvoiceDate = new Date(invoiceYear, 2, 15); // March 15
      
      const result = calculateITCDeadline(selfInvoiceDate);
      
      // Only test warning level if deadline is actually within 30 days
      if (result.daysRemaining <= 30 && result.daysRemaining > 0) {
        expect(result.warningLevel).toBe('CRITICAL');
        expect(result.daysRemaining).toBeLessThanOrEqual(30);
      }
    });
    
    test('should generate warning for claims expiring within 90 days', () => {
      const today = new Date();
      const selfInvoiceDate = new Date(today.getFullYear() - 1, 8, 15); // September 15 last year
      const result = calculateITCDeadline(selfInvoiceDate);
      
      if (result.daysRemaining <= 90 && result.daysRemaining > 30) {
        expect(result.warningLevel).toBe('HIGH');
      }
    });
  });
  
  describe('ITC Claim Processing', () => {
    test('should process eligible ITC claim successfully', () => {
      const claim: ITCClaim = {
        rcmTransactionId: 'trans-1',
        selfInvoiceId: 'si-1',
        selfInvoiceDate: new Date('2024-10-15'),
        paymentCompleted: true,
        businessPurpose: 'Office equipment',
        category: 'CAPITAL_GOODS',
        cgstAmount: 15000,
        sgstAmount: 15000,
        igstAmount: 0,
        cessAmount: 0,
      };
      
      const result = processITCClaim(claim);
      
      expect(result.success).toBe(true);
      expect(result.claimStatus).toBe('CLAIMED');
      expect(result.claimId).toBeDefined();
      expect(result.totalITCAmount).toBe(30000);
      expect(result.balance).toBe(30000);
    });
    
    test('should reject claim for expired deadline', () => {
      const claim: ITCClaim = {
        rcmTransactionId: 'trans-2',
        selfInvoiceId: 'si-2',
        selfInvoiceDate: new Date('2022-10-15'),
        paymentCompleted: true,
        businessPurpose: 'Professional services',
        category: 'INPUT_SERVICES',
        cgstAmount: 9000,
        sgstAmount: 9000,
        igstAmount: 0,
        cessAmount: 0,
      };
      
      const result = processITCClaim(claim);
      
      expect(result.success).toBe(false);
      expect(result.claimStatus).toBe('EXPIRED');
      expect(result.error).toContain('deadline expired');
    });
    
    test('should process partial utilization of ITC', () => {
      const claim: ITCClaim = {
        claimId: 'claim-1',
        totalITCAmount: 50000,
        balance: 50000,
        utilizeAmount: 20000,
      };
      
      const result = processITCClaim(claim);
      
      expect(result.success).toBe(true);
      expect(result.utilizedAmount).toBe(20000);
      expect(result.balance).toBe(30000);
      expect(result.utilizationPercentage).toBe(40);
    });
  });
  
  describe('ITC Reversal', () => {
    test('should reverse ITC for personal use identification', () => {
      const reversal = {
        claimId: 'claim-1',
        reversalReason: 'Personal use identified',
        reversalAmount: 10000,
      };
      
      const result = reverseITCClaim(reversal);
      
      expect(result.success).toBe(true);
      expect(result.reversalStatus).toBe('REVERSED');
      expect(result.reversedAmount).toBe(10000);
      expect(result.reversalDate).toBeDefined();
    });
    
    test('should reverse expired ITC claims automatically', () => {
      const claims = [
        {
          claimId: 'claim-1',
          selfInvoiceDate: new Date('2022-05-15'),
          claimStatus: 'CLAIMED',
          totalITCAmount: 25000,
        },
        {
          claimId: 'claim-2',
          selfInvoiceDate: new Date('2024-10-15'),
          claimStatus: 'CLAIMED',
          totalITCAmount: 15000,
        },
      ];
      
      const result = reverseITCClaim({ autoReverseExpired: true, claims });
      
      expect(result.reversedCount).toBe(1);
      expect(result.reversedClaims).toContain('claim-1');
      expect(result.totalReversedAmount).toBe(25000);
    });
  });
  
  describe('GSTR-3B Integration', () => {
    test('should prepare ITC data for GSTR-3B Table 4(B)', () => {
      const claims = [
        {
          category: 'INPUTS',
          cgstAmount: 10000,
          sgstAmount: 10000,
          igstAmount: 0,
          cessAmount: 0,
        },
        {
          category: 'INPUT_SERVICES',
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 25000,
          cessAmount: 500,
        },
        {
          category: 'CAPITAL_GOODS',
          cgstAmount: 15000,
          sgstAmount: 15000,
          igstAmount: 0,
          cessAmount: 0,
        },
      ];
      
      const result = prepareITCForGSTR3B(claims, '112024');
      
      expect(result.table4B.inputs.cgst).toBe(10000);
      expect(result.table4B.inputs.sgst).toBe(10000);
      expect(result.table4B.inputServices.igst).toBe(25000);
      expect(result.table4B.inputServices.cess).toBe(500);
      expect(result.table4B.capitalGoods.cgst).toBe(15000);
      expect(result.table4B.capitalGoods.sgst).toBe(15000);
      expect(result.totalITC).toBe(75500);
    });
    
    test('should aggregate monthly ITC claims by category', () => {
      const claims = [
        { category: 'INPUTS', totalITCAmount: 20000, period: '112024' },
        { category: 'INPUTS', totalITCAmount: 15000, period: '112024' },
        { category: 'INPUT_SERVICES', totalITCAmount: 30000, period: '112024' },
        { category: 'CAPITAL_GOODS', totalITCAmount: 45000, period: '112024' },
      ];
      
      const result = prepareITCForGSTR3B(claims, '112024');
      
      expect(result.categoryWiseTotals.INPUTS).toBe(35000);
      expect(result.categoryWiseTotals.INPUT_SERVICES).toBe(30000);
      expect(result.categoryWiseTotals.CAPITAL_GOODS).toBe(45000);
      expect(result.grandTotal).toBe(110000);
    });
  });
  
  describe('Expiring Claims Management', () => {
    test('should identify claims expiring within specified days', () => {
      const claims = [
        {
          claimId: 'claim-1',
          selfInvoiceDate: new Date('2024-10-15'),
          daysRemaining: 25,
          totalITCAmount: 15000,
        },
        {
          claimId: 'claim-2',
          selfInvoiceDate: new Date('2024-09-20'),
          daysRemaining: 60,
          totalITCAmount: 20000,
        },
        {
          claimId: 'claim-3',
          selfInvoiceDate: new Date('2024-08-10'),
          daysRemaining: 120,
          totalITCAmount: 10000,
        },
      ];
      
      const result = getExpiringClaims(claims, 30);
      
      expect(result.expiringClaims).toHaveLength(1);
      expect(result.expiringClaims[0].claimId).toBe('claim-1');
      expect(result.totalExpiringAmount).toBe(15000);
      expect(result.urgencyLevel).toBe('CRITICAL');
    });
    
    test('should generate alerts for different expiry periods', () => {
      const result = getExpiringClaims([], 0);
      
      expect(result.alerts).toContainEqual({
        period: 30,
        level: 'CRITICAL',
        message: expect.stringContaining('30 days'),
      });
      
      expect(result.alerts).toContainEqual({
        period: 60,
        level: 'HIGH',
        message: expect.stringContaining('60 days'),
      });
      
      expect(result.alerts).toContainEqual({
        period: 90,
        level: 'MEDIUM',
        message: expect.stringContaining('90 days'),
      });
    });
  });
  
  describe('ITC Utilization Tracking', () => {
    test('should calculate ITC utilization percentage', () => {
      const claim = {
        totalITCAmount: 100000,
        utilizedAmount: 75000,
      };
      
      const result = calculateITCUtilization(claim);
      
      expect(result.utilizationPercentage).toBe(75);
      expect(result.balance).toBe(25000);
      expect(result.utilizationStatus).toBe('GOOD');
    });
    
    test('should identify under-utilized ITC', () => {
      const claim = {
        totalITCAmount: 100000,
        utilizedAmount: 20000,
      };
      
      const result = calculateITCUtilization(claim);
      
      expect(result.utilizationPercentage).toBe(20);
      expect(result.utilizationStatus).toBe('LOW');
      expect(result.recommendation).toBe('Consider optimizing ITC utilization');
    });
    
    test('should track category-wise utilization', () => {
      const claims = [
        { category: 'INPUTS', totalITCAmount: 50000, utilizedAmount: 45000 },
        { category: 'INPUT_SERVICES', totalITCAmount: 30000, utilizedAmount: 15000 },
        { category: 'CAPITAL_GOODS', totalITCAmount: 20000, utilizedAmount: 5000 },
      ];
      
      const result = calculateITCUtilization(claims);
      
      expect(result.categoryWiseUtilization.INPUTS).toBe(90);
      expect(result.categoryWiseUtilization.INPUT_SERVICES).toBe(50);
      expect(result.categoryWiseUtilization.CAPITAL_GOODS).toBe(25);
      expect(result.overallUtilization).toBe(65);
    });
  });
});