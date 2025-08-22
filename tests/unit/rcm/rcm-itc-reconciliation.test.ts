/**
 * RCM ITC Reconciliation Tests
 * 
 * Tests for ITC reconciliation with payments, GSTR-2B matching,
 * credit ledger management, and utilization tracking.
 * 
 * Based on:
 * - CGST Rule 36(4) - Mandatory GSTR-2B matching since Jan 2022
 * - Section 16(2)(aa) - No provisional ITC allowed
 * - RCM payment must be in cash only (no ITC setoff)
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  reconcileITCWithPayments,
  matchWithGSTR2B,
  manageCreditLedger,
  trackITCUtilization,
  ITCReconciliationRequest,
  ITCReconciliationResult,
  GSTR2BEntry,
  CreditLedgerEntry,
  ITCUtilization,
  ReconciliationMismatch,
  validateGSTR2BMatching,
  calculateITCBalance,
  identifyMismatches,
} from '@/lib/rcm/itc-reconciliation';

describe('RCM ITC Reconciliation', () => {
  describe('ITC Payment Reconciliation', () => {
    test('should reconcile ITC claimed with RCM payments made', () => {
      const request: any = {
        period: '07-2024',
        rcmPayments: [
          {
            transactionId: 'RCM-001',
            paymentDate: new Date('2024-07-20'),
            amount: 18000,
            cgst: 9000,
            sgst: 9000,
            paymentMode: 'CASH',
            challanNumber: 'CH-001',
          },
          {
            transactionId: 'RCM-002',
            paymentDate: new Date('2024-07-20'),
            amount: 5000,
            igst: 5000,
            paymentMode: 'CASH',
            challanNumber: 'CH-002',
          },
        ],
        itcClaimed: [
          {
            transactionId: 'RCM-001',
            claimMonth: '07-2024',
            cgst: 9000,
            sgst: 9000,
            table: '4(A)(3)',
          },
          {
            transactionId: 'RCM-002',
            claimMonth: '07-2024',
            igst: 5000,
            table: '4(A)(3)',
          },
        ],
      };

      const result = reconcileITCWithPayments(request);
      
      expect(result.isReconciled).toBe(true);
      expect(result.totalPayments).toBe(23000);
      expect(result.totalITCClaimed).toBe(23000);
      expect(result.unreconciled).toEqual([]);
    });

    test('should identify unreconciled ITC claims', () => {
      const request: any = {
        period: '07-2024',
        rcmPayments: [
          {
            transactionId: 'RCM-001',
            paymentDate: new Date('2024-07-20'),
            amount: 18000,
            cgst: 9000,
            sgst: 9000,
            paymentMode: 'CASH',
          },
        ],
        itcClaimed: [
          {
            transactionId: 'RCM-001',
            claimMonth: '07-2024',
            cgst: 9000,
            sgst: 9000,
          },
          {
            transactionId: 'RCM-002',
            claimMonth: '07-2024',
            igst: 5000,
          },
        ],
      };

      const result = reconcileITCWithPayments(request);
      
      expect(result.isReconciled).toBe(false);
      expect(result.unreconciled).toHaveLength(1);
      expect(result.unreconciled[0].transactionId).toBe('RCM-002');
      expect(result.unreconciled[0].reason).toBe('NO_PAYMENT_FOUND');
    });

    test('should flag ITC claimed before payment', () => {
      const request: any = {
        period: '07-2024',
        rcmPayments: [
          {
            transactionId: 'RCM-001',
            paymentDate: new Date('2024-08-05'), // Paid in August
            amount: 18000,
            cgst: 9000,
            sgst: 9000,
            paymentMode: 'CASH',
          },
        ],
        itcClaimed: [
          {
            transactionId: 'RCM-001',
            claimMonth: '07-2024', // Claimed in July
            claimDate: new Date('2024-07-20'),
            cgst: 9000,
            sgst: 9000,
          },
        ],
      };

      const result = reconcileITCWithPayments(request);
      
      expect(result.isReconciled).toBe(false);
      expect(result.issues).toContain('ITC_CLAIMED_BEFORE_PAYMENT');
      expect(result.corrections?.[0]?.action).toBe('REVERSE_AND_RECLAIM');
    });

    test('should validate cash payment requirement for RCM', () => {
      const request: any = {
        period: '07-2024',
        rcmPayments: [
          {
            transactionId: 'RCM-001',
            paymentDate: new Date('2024-07-20'),
            amount: 18000,
            cgst: 9000,
            sgst: 9000,
            paymentMode: 'ITC_SETOFF', // Invalid for RCM
          },
        ],
        itcClaimed: [
          {
            transactionId: 'RCM-001',
            claimMonth: '07-2024',
            cgst: 9000,
            sgst: 9000,
          },
        ],
      };

      const result = reconcileITCWithPayments(request);
      
      expect(result.isReconciled).toBe(false);
      expect(result.issues).toContain('RCM_NOT_PAID_IN_CASH');
      expect(result.complianceViolation).toBe(true);
    });
  });

  describe('GSTR-2B Matching', () => {
    test('should match ITC claims with GSTR-2B entries', () => {
      const gstr2bData: any[] = [
        {
          gstin: '29ABCDE1234F1Z5',
          tradeName: 'ABC Suppliers',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-07-01'),
          invoiceValue: 100000,
          igst: 18000,
          cgst: 0,
          sgst: 0,
          cess: 0,
          eligibleITC: {
            igst: 18000,
            cgst: 0,
            sgst: 0,
            cess: 0,
          },
          type: 'B2B',
        },
      ];

      const claimedITC = [
        {
          supplierGSTIN: '29ABCDE1234F1Z5',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-07-01'),
          igst: 18000,
        },
      ];

      const result = matchWithGSTR2B(gstr2bData, claimedITC);
      
      expect(result.matched).toHaveLength(1);
      expect(result.unmatched).toHaveLength(0);
      expect(result.matchPercentage).toBe(100);
    });

    test('should identify GSTR-2B mismatches', () => {
      const gstr2bData: any[] = [
        {
          gstin: '29ABCDE1234F1Z5',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-07-01'),
          invoiceValue: 100000,
          cgst: 9000,
          sgst: 9000,
          eligibleITC: {
            cgst: 9000,
            sgst: 9000,
          },
        },
      ];

      const claimedITC = [
        {
          supplierGSTIN: '29ABCDE1234F1Z5',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-07-01'),
          cgst: 10000, // Mismatch amount
          sgst: 10000,
        },
      ];

      const result = matchWithGSTR2B(gstr2bData, claimedITC);
      
      expect(result.mismatches).toHaveLength(1);
      expect(result.mismatches?.[0]?.type).toBe('AMOUNT_MISMATCH');
      expect(result.mismatches?.[0]?.gstr2bAmount).toBe(18000);
      expect(result.mismatches?.[0]?.claimedAmount).toBe(20000);
      expect(result.mismatches?.[0]?.difference).toBe(2000);
    });

    test('should handle RCM transactions not in GSTR-2B', () => {
      const gstr2bData: any[] = [];

      const rcmTransactions = [
        {
          type: 'RCM',
          supplierType: 'UNREGISTERED',
          invoiceNumber: 'SELF-INV-001',
          invoiceDate: new Date('2024-07-15'),
          cgst: 9000,
          sgst: 9000,
          selfInvoiced: true,
        },
      ];

      const result = validateGSTR2BMatching(gstr2bData, rcmTransactions);
      
      expect(result.rcmTransactions).toHaveLength(1);
      expect(result.requiresManualEntry).toBe(true);
      expect(result.note).toContain('RCM transactions require manual entry');
    });

    test('should validate against GSTR-2B ITC limits', () => {
      const gstr2bData: any[] = [
        {
          gstin: '29ABCDE1234F1Z5',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-07-15'),
          invoiceValue: 100000,
          eligibleITC: {
            cgst: 9000,
            sgst: 9000,
          },
          blockedITC: {
            cgst: 1000,
            sgst: 1000,
          },
        },
      ];

      const claimedITC = [
        {
          supplierGSTIN: '29ABCDE1234F1Z5',
          invoiceNumber: 'INV-001',
          cgst: 10000, // Claiming blocked portion
          sgst: 10000,
        },
      ];

      const result = matchWithGSTR2B(gstr2bData, claimedITC);
      
      expect(result.violations).toHaveLength(1);
      expect(result.violations?.[0]?.type).toBe('CLAIMED_BLOCKED_ITC');
      expect(result.violations?.[0]?.excessClaim).toBe(2000);
    });

    test('should handle amendments in GSTR-2B', () => {
      const gstr2bData: any[] = [
        {
          gstin: '29ABCDE1234F1Z5',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-06-01'),
          invoiceValue: 100000,
          isAmendment: true,
          originalInvoiceNumber: 'INV-001',
          originalInvoiceDate: new Date('2024-05-01'),
          cgst: 9000,
          sgst: 9000,
          eligibleITC: {
            cgst: 9000,
            sgst: 9000,
          },
        },
      ];

      const result = identifyMismatches(gstr2bData);
      
      expect(result.amendments).toHaveLength(1);
      expect(result.amendments[0].requiresAdjustment).toBe(true);
      expect(result.amendments[0].adjustmentMonth).toBe('Current');
    });
  });

  describe('Credit Ledger Management', () => {
    let creditLedger: any[];

    beforeEach(() => {
      creditLedger = [];
    });

    test('should track ITC credit in ledger', () => {
      const entry: any = {
        date: new Date('2024-07-20'),
        type: 'CREDIT',
        description: 'ITC on RCM payment',
        cgst: 9000,
        sgst: 9000,
        igst: 0,
        cess: 0,
        reference: 'RCM-001',
      };

      creditLedger = manageCreditLedger(creditLedger, entry);
      const balance = calculateITCBalance(creditLedger);
      
      expect(balance.cgst).toBe(9000);
      expect(balance.sgst).toBe(9000);
      expect(balance.total).toBe(18000);
    });

    test('should track ITC utilization', () => {
      creditLedger = [
        {
          date: new Date('2024-07-20'),
          type: 'CREDIT',
          cgst: 10000,
          sgst: 10000,
        },
      ];

      const utilization: any = {
        date: new Date('2024-07-25'),
        type: 'DEBIT',
        description: 'Used for output tax payment',
        cgst: 5000,
        sgst: 5000,
        reference: 'GSTR3B-072024',
      };

      creditLedger = manageCreditLedger(creditLedger, utilization);
      const balance = calculateITCBalance(creditLedger);
      
      expect(balance.cgst).toBe(5000);
      expect(balance.sgst).toBe(5000);
    });

    test('should prevent negative balance in credit ledger', () => {
      creditLedger = [
        {
          date: new Date('2024-07-20'),
          type: 'CREDIT',
          cgst: 5000,
          sgst: 5000,
        },
      ];

      const utilization: any = {
        date: new Date('2024-07-25'),
        type: 'DEBIT',
        cgst: 6000, // More than available
        sgst: 6000,
      };

      expect(() => {
        manageCreditLedger(creditLedger, utilization);
      }).toThrow('Insufficient ITC balance');
    });

    test('should handle ITC reversal entries', () => {
      creditLedger = [
        {
          date: new Date('2024-07-20'),
          type: 'CREDIT',
          cgst: 10000,
          sgst: 10000,
        },
      ];

      const reversal: any = {
        date: new Date('2024-08-15'),
        type: 'REVERSAL',
        description: 'Rule 42 reversal for exempt supplies',
        cgst: 2000,
        sgst: 2000,
        reversalReason: 'EXEMPT_SUPPLIES',
      };

      creditLedger = manageCreditLedger(creditLedger, reversal);
      const balance = calculateITCBalance(creditLedger);
      
      expect(balance.cgst).toBe(8000);
      expect(balance.sgst).toBe(8000);
    });

    test('should track provisional vs final ITC', () => {
      const entry: any = {
        date: new Date('2024-01-15'),
        type: 'CREDIT',
        cgst: 9000,
        sgst: 9000,
        status: 'PROVISIONAL',
        note: 'Pre-2022 entry - provisional ITC',
      };

      creditLedger = manageCreditLedger(creditLedger, entry);
      
      const finalEntry: any = {
        date: new Date('2024-02-15'),
        type: 'ADJUSTMENT',
        cgst: -1000, // Reduction after GSTR-2B matching
        sgst: -1000,
        status: 'FINAL',
        reference: entry.reference,
      };

      creditLedger = manageCreditLedger(creditLedger, finalEntry);
      const balance = calculateITCBalance(creditLedger);
      
      expect(balance.cgst).toBe(8000);
      expect(balance.sgst).toBe(8000);
    });
  });

  describe('ITC Utilization Tracking', () => {
    test('should track optimal ITC utilization order', () => {
      const availableITC = {
        igst: 20000,
        cgst: 10000,
        sgst: 10000,
      };

      const taxLiability = {
        igst: 15000,
        cgst: 8000,
        sgst: 8000,
      };

      const utilization = trackITCUtilization(availableITC, taxLiability);
      
      // IGST should be used first
      expect(utilization.igstUsed).toBe(15000);
      expect(utilization.cgstUsed).toBe(8000);
      expect(utilization.sgstUsed).toBe(8000);
      expect(utilization.cashRequired).toBe(0);
      expect(utilization.remainingITC.igst).toBe(5000);
      expect(utilization.remainingITC.cgst).toBe(2000);
      expect(utilization.remainingITC.sgst).toBe(2000);
    });

    test('should calculate cash requirement when ITC insufficient', () => {
      const availableITC = {
        igst: 5000,
        cgst: 3000,
        sgst: 3000,
      };

      const taxLiability = {
        igst: 10000,
        cgst: 8000,
        sgst: 8000,
      };

      const utilization = trackITCUtilization(availableITC, taxLiability);
      
      expect(utilization.igstUsed).toBe(5000);
      expect(utilization.cgstUsed).toBe(3000);
      expect(utilization.sgstUsed).toBe(3000);
      expect(utilization.cashRequired).toBe(15000); // Shortfall
      expect(utilization.remainingITC.igst).toBe(0);
      expect(utilization.remainingITC.cgst).toBe(0);
      expect(utilization.remainingITC.sgst).toBe(0);
    });

    test('should handle cross-utilization of IGST', () => {
      const availableITC = {
        igst: 30000,
        cgst: 0,
        sgst: 0,
      };

      const taxLiability = {
        igst: 10000,
        cgst: 8000,
        sgst: 8000,
      };

      const utilization = trackITCUtilization(availableITC, taxLiability);
      
      // IGST can be used for all taxes
      expect(utilization.igstUsed).toBe(26000); // 10000 + 8000 + 8000
      expect(utilization.cgstUsed).toBe(0);
      expect(utilization.sgstUsed).toBe(0);
      expect(utilization.cashRequired).toBe(0);
      expect(utilization.remainingITC.igst).toBe(4000);
    });

    test('should generate utilization report', () => {
      const transactions = [
        {
          date: new Date('2024-07-01'),
          type: 'OUTPUT_TAX_PAYMENT',
          igstUsed: 5000,
          cgstUsed: 3000,
          sgstUsed: 3000,
        },
        {
          date: new Date('2024-07-15'),
          type: 'OUTPUT_TAX_PAYMENT',
          igstUsed: 2000,
          cgstUsed: 1000,
          sgstUsed: 1000,
        },
      ];

      const report = generateUtilizationReport(transactions, '07-2024');
      
      expect(report.totalUtilized).toBe(15000);
      expect(report.igstUtilized).toBe(7000);
      expect(report.cgstUtilized).toBe(4000);
      expect(report.sgstUtilized).toBe(4000);
      expect(report.utilizationRate).toBeGreaterThan(0);
    });
  });

  describe('Reconciliation Reports', () => {
    test('should generate comprehensive reconciliation report', () => {
      const data = {
        period: '07-2024',
        gstr2bMatches: 45,
        gstr2bMismatches: 5,
        rcmTransactions: 10,
        itcClaimed: 600000,
        itcEligible: 580000,
        itcBlocked: 20000,
        itcReversed: 5000,
        itcUtilized: 400000,
        closingBalance: 175000,
      };

      const report = generateReconciliationReport(data);
      
      expect(report.summary.matchRate).toBe(90); // 45/50
      expect(report.summary.eligibilityRate).toBeCloseTo(96.67); // 580000/600000
      expect(report.summary.utilizationRate).toBeCloseTo(68.97); // 400000/580000
      expect(report.alerts).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    test('should identify reconciliation issues and provide recommendations', () => {
      const issues: any[] = [
        {
          type: 'GSTR2B_MISMATCH',
          count: 10,
          amount: 50000,
        },
        {
          type: 'TIME_LIMIT_EXPIRED',
          count: 3,
          amount: 15000,
        },
        {
          type: 'BLOCKED_CATEGORY',
          count: 5,
          amount: 25000,
        },
      ];

      const recommendations = generateRecommendations(issues);
      
      expect(recommendations).toContain('Reconcile with suppliers');
      expect(recommendations).toContain('Review time limits');
      expect(recommendations).toContain('Verify blocked categories');
    });
  });
});

// Helper function for test
function generateUtilizationReport(transactions: any[], period: any) {
  const total = transactions.reduce((sum, t) => 
    sum + t.igstUsed + t.cgstUsed + t.sgstUsed, 0);
  
  const igst = transactions.reduce((sum, t) => sum + t.igstUsed, 0);
  const cgst = transactions.reduce((sum, t) => sum + t.cgstUsed, 0);
  const sgst = transactions.reduce((sum, t) => sum + t.sgstUsed, 0);
  
  return {
    period,
    totalUtilized: any,
    igstUtilized: any,
    cgstUtilized: any,
    sgstUtilized: any,
    utilizationRate: any > 0 ? 100 : 0,
  };
}

function generateReconciliationReport(data: any) {
  return {
    summary: {
      matchRate: (data.gstr2bMatches / (data.gstr2bMatches + data.gstr2bMismatches)) * 100,
      eligibilityRate: (data.itcEligible / data.itcClaimed) * 100,
      utilizationRate: (data.itcUtilized / data.itcEligible) * 100,
    },
    alerts: [],
    recommendations: [],
  };
}

function generateRecommendations(issues: any[]) {
  const recommendations = [];
  
  if (issues.find(i => i.type === 'GSTR2B_MISMATCH')) {
    recommendations.push('Reconcile with suppliers');
  }
  if (issues.find(i => i.type === 'TIME_LIMIT_EXPIRED')) {
    recommendations.push('Review time limits');
  }
  if (issues.find(i => i.type === 'BLOCKED_CATEGORY')) {
    recommendations.push('Verify blocked categories');
  }
  
  return recommendations;
}