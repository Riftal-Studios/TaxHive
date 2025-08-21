import { describe, test, expect, beforeEach, vi } from 'vitest';

/**
 * TDD Test Suite for RCM Phase 3: Payment Tracking
 * 
 * These tests are written FIRST (RED phase) to define requirements
 * for RCM payment tracking including:
 * - Payment liability calculation
 * - Due date determination
 * - Payment status tracking
 * - Interest calculation for late payments
 * - Payment reconciliation
 */

// Import types and implementations
import type { 
  RCMPaymentLiability,
  RCMPaymentStatus,
  PaymentDueDate,
  InterestCalculation,
  PaymentReconciliation
} from '@/lib/rcm/rcm-payment-tracker';

import {
  calculateRCMPaymentLiability,
  determinePaymentDueDate,
  trackPaymentStatus,
  calculateInterest,
  reconcilePayments,
  getOverduePayments,
  generatePaymentReminder,
  calculatePenalty
} from '@/lib/rcm/rcm-payment-tracker';

describe('RCM Payment Tracking', () => {
  
  // Mock current date for testing
  const MOCK_CURRENT_DATE = new Date('2024-06-15');
  
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_CURRENT_DATE);
  });

  describe('Payment Liability Calculation', () => {
    test('should calculate RCM liability for CGST/SGST', () => {
      const liability = calculateRCMPaymentLiability({
        transactionId: 'trans-001',
        taxableAmount: 100000,
        gstRate: 18,
        taxType: 'CGST_SGST',
        transactionDate: new Date('2024-06-01'),
      });

      expect(liability.totalGST).toBe(18000);
      expect(liability.cgst).toBe(9000);
      expect(liability.sgst).toBe(9000);
      expect(liability.igst).toBe(0);
      expect(liability.dueDate).toBeInstanceOf(Date);
      expect(liability.status).toBe('PENDING');
    });

    test('should calculate RCM liability for IGST', () => {
      const liability = calculateRCMPaymentLiability({
        transactionId: 'trans-002',
        taxableAmount: 50000,
        gstRate: 5,
        taxType: 'IGST',
        transactionDate: new Date('2024-06-05'),
      });

      expect(liability.totalGST).toBe(2500);
      expect(liability.cgst).toBe(0);
      expect(liability.sgst).toBe(0);
      expect(liability.igst).toBe(2500);
      expect(liability.status).toBe('PENDING');
    });

    test('should include vendor details in liability', () => {
      const liability = calculateRCMPaymentLiability({
        transactionId: 'trans-003',
        taxableAmount: 75000,
        gstRate: 12,
        taxType: 'IGST',
        transactionDate: new Date('2024-06-10'),
        vendorName: 'ABC Transport Agency',
        vendorGSTIN: null,
        serviceDescription: 'Goods Transport (GTA)',
        hsnSacCode: '996711',
      });

      expect(liability.vendorName).toBe('ABC Transport Agency');
      expect(liability.serviceDescription).toBe('Goods Transport (GTA)');
      expect(liability.hsnSacCode).toBe('996711');
      expect(liability.totalGST).toBe(9000);
    });
  });

  describe('Payment Due Date Determination', () => {
    test('should calculate due date as 20th of next month', () => {
      const dueDate = determinePaymentDueDate(new Date('2024-06-15'));
      
      expect(dueDate.month).toBe(7);
      expect(dueDate.year).toBe(2024);
      expect(dueDate.day).toBe(20);
      expect(dueDate.fullDate).toEqual(new Date('2024-07-20'));
    });

    test('should handle month-end transactions correctly', () => {
      const dueDate = determinePaymentDueDate(new Date('2024-06-30'));
      
      expect(dueDate.month).toBe(7);
      expect(dueDate.year).toBe(2024);
      expect(dueDate.day).toBe(20);
    });

    test('should handle year-end transactions', () => {
      const dueDate = determinePaymentDueDate(new Date('2024-12-15'));
      
      expect(dueDate.month).toBe(1);
      expect(dueDate.year).toBe(2025);
      expect(dueDate.day).toBe(20);
    });

    test('should identify quarterly return due dates', () => {
      // Q1 ends March 31, due April 24
      const q1DueDate = determinePaymentDueDate(new Date('2024-03-15'), 'QUARTERLY');
      expect(q1DueDate.fullDate).toEqual(new Date('2024-04-24'));

      // Q2 ends June 30, due July 24
      const q2DueDate = determinePaymentDueDate(new Date('2024-06-15'), 'QUARTERLY');
      expect(q2DueDate.fullDate).toEqual(new Date('2024-07-24'));

      // Q3 ends September 30, due October 24
      const q3DueDate = determinePaymentDueDate(new Date('2024-09-15'), 'QUARTERLY');
      expect(q3DueDate.fullDate).toEqual(new Date('2024-10-24'));

      // Q4 ends December 31, due January 24
      const q4DueDate = determinePaymentDueDate(new Date('2024-12-15'), 'QUARTERLY');
      expect(q4DueDate.fullDate).toEqual(new Date('2025-01-24'));
    });
  });

  describe('Payment Status Tracking', () => {
    test('should track payment as PENDING initially', () => {
      const status = trackPaymentStatus({
        liabilityId: 'liability-001',
        dueDate: new Date('2024-07-20'),
        paidDate: null,
        paidAmount: 0,
        totalAmount: 18000,
      });

      expect(status.status).toBe('PENDING');
      expect(status.isPaid).toBe(false);
      expect(status.isOverdue).toBe(false);
      expect(status.daysUntilDue).toBeGreaterThan(0);
    });

    test('should mark payment as OVERDUE after due date', () => {
      const status = trackPaymentStatus({
        liabilityId: 'liability-002',
        dueDate: new Date('2024-05-20'), // Past date
        paidDate: null,
        paidAmount: 0,
        totalAmount: 9000,
      });

      expect(status.status).toBe('OVERDUE');
      expect(status.isPaid).toBe(false);
      expect(status.isOverdue).toBe(true);
      expect(status.daysOverdue).toBeGreaterThan(0);
    });

    test('should track payment as PAID when completed', () => {
      const status = trackPaymentStatus({
        liabilityId: 'liability-003',
        dueDate: new Date('2024-07-20'),
        paidDate: new Date('2024-06-10'),
        paidAmount: 5000,
        totalAmount: 5000,
      });

      expect(status.status).toBe('PAID');
      expect(status.isPaid).toBe(true);
      expect(status.isOverdue).toBe(false);
      expect(status.paidBeforeDue).toBe(true);
    });

    test('should track PARTIALLY_PAID status', () => {
      const status = trackPaymentStatus({
        liabilityId: 'liability-004',
        dueDate: new Date('2024-07-20'),
        paidDate: new Date('2024-06-10'),
        paidAmount: 3000,
        totalAmount: 9000,
      });

      expect(status.status).toBe('PARTIALLY_PAID');
      expect(status.isPaid).toBe(false);
      expect(status.remainingAmount).toBe(6000);
      expect(status.paidPercentage).toBe(33.33);
    });
  });

  describe('Interest Calculation for Late Payments', () => {
    test('should calculate simple interest at 18% per annum', () => {
      const interest = calculateInterest({
        principalAmount: 10000,
        dueDate: new Date('2024-05-20'),
        paidDate: new Date('2024-06-15'), // 26 days late
        interestRate: 18, // 18% per annum
      });

      // Interest = P * R * T / 365
      // 10000 * 0.18 * 26 / 365 = 128.22
      expect(interest.interestAmount).toBeCloseTo(128.22, 2);
      expect(interest.totalAmount).toBeCloseTo(10128.22, 2);
      expect(interest.daysLate).toBe(26);
      expect(interest.interestRate).toBe(18);
    });

    test('should handle zero interest for on-time payment', () => {
      const interest = calculateInterest({
        principalAmount: 10000,
        dueDate: new Date('2024-07-20'),
        paidDate: new Date('2024-06-15'), // Paid before due date
        interestRate: 18,
      });

      expect(interest.interestAmount).toBe(0);
      expect(interest.totalAmount).toBe(10000);
      expect(interest.daysLate).toBe(0);
    });

    test('should calculate compound interest for very late payments', () => {
      const interest = calculateInterest({
        principalAmount: 10000,
        dueDate: new Date('2024-01-20'),
        paidDate: new Date('2024-06-15'), // 147 days late (including leap year)
        interestRate: 18,
        compoundMonthly: true,
      });

      // Compound interest calculation
      expect(interest.interestAmount).toBeGreaterThan(720); // Simple would be ~720
      expect(interest.daysLate).toBe(147);
      expect(interest.monthsLate).toBe(4);
    });

    test('should apply different rates for different delay periods', () => {
      // 0-30 days: 18%
      const interest30Days = calculateInterest({
        principalAmount: 10000,
        dueDate: new Date('2024-05-20'),
        paidDate: new Date('2024-06-10'), // 21 days late
      });
      expect(interest30Days.effectiveRate).toBe(18);

      // 31-60 days: 24%
      const interest60Days = calculateInterest({
        principalAmount: 10000,
        dueDate: new Date('2024-04-20'),
        paidDate: new Date('2024-06-10'), // 51 days late
      });
      expect(interest60Days.effectiveRate).toBe(24);

      // >60 days: 30%
      const interest90Days = calculateInterest({
        principalAmount: 10000,
        dueDate: new Date('2024-03-20'),
        paidDate: new Date('2024-06-10'), // 82 days late
      });
      expect(interest90Days.effectiveRate).toBe(30);
    });
  });

  describe('Penalty Calculation', () => {
    test('should calculate penalty for late filing', () => {
      const penalty = calculatePenalty({
        returnType: 'GSTR3B',
        dueDate: new Date('2024-05-20'),
        filedDate: new Date('2024-06-10'),
        isNilReturn: false,
      });

      // Rs. 50 per day (CGST 25 + SGST 25) for normal return
      expect(penalty.penaltyAmount).toBe(1050); // 21 days * 50
      expect(penalty.cgstPenalty).toBe(525);
      expect(penalty.sgstPenalty).toBe(525);
      expect(penalty.daysLate).toBe(21);
    });

    test('should apply reduced penalty for nil returns', () => {
      const penalty = calculatePenalty({
        returnType: 'GSTR3B',
        dueDate: new Date('2024-05-20'),
        filedDate: new Date('2024-06-10'),
        isNilReturn: true,
      });

      // Rs. 20 per day (CGST 10 + SGST 10) for nil return
      expect(penalty.penaltyAmount).toBe(420); // 21 days * 20
      expect(penalty.cgstPenalty).toBe(210);
      expect(penalty.sgstPenalty).toBe(210);
    });

    test('should cap penalty at maximum limits', () => {
      const penalty = calculatePenalty({
        returnType: 'GSTR3B',
        dueDate: new Date('2024-01-20'),
        filedDate: new Date('2024-06-15'), // Very late
        isNilReturn: false,
      });

      // Maximum penalty is Rs. 10,000 (5000 + 5000)
      expect(penalty.penaltyAmount).toBeLessThanOrEqual(10000);
      expect(penalty.cgstPenalty).toBeLessThanOrEqual(5000);
      expect(penalty.sgstPenalty).toBeLessThanOrEqual(5000);
    });
  });

  describe('Payment Reconciliation', () => {
    test('should reconcile multiple payments for a liability', () => {
      const reconciliation = reconcilePayments({
        liabilityId: 'liability-005',
        totalLiability: 18000,
        payments: [
          { amount: 5000, date: new Date('2024-06-01'), reference: 'PAY001' },
          { amount: 8000, date: new Date('2024-06-10'), reference: 'PAY002' },
          { amount: 5000, date: new Date('2024-06-15'), reference: 'PAY003' },
        ],
      });

      expect(reconciliation.totalPaid).toBe(18000);
      expect(reconciliation.remainingBalance).toBe(0);
      expect(reconciliation.isFullyPaid).toBe(true);
      expect(reconciliation.paymentCount).toBe(3);
      expect(reconciliation.lastPaymentDate).toEqual(new Date('2024-06-15'));
    });

    test('should identify partial payments', () => {
      const reconciliation = reconcilePayments({
        liabilityId: 'liability-006',
        totalLiability: 10000,
        payments: [
          { amount: 3000, date: new Date('2024-06-01'), reference: 'PAY001' },
          { amount: 2000, date: new Date('2024-06-10'), reference: 'PAY002' },
        ],
      });

      expect(reconciliation.totalPaid).toBe(5000);
      expect(reconciliation.remainingBalance).toBe(5000);
      expect(reconciliation.isFullyPaid).toBe(false);
      expect(reconciliation.paymentPercentage).toBe(50);
    });

    test('should handle overpayments', () => {
      const reconciliation = reconcilePayments({
        liabilityId: 'liability-007',
        totalLiability: 5000,
        payments: [
          { amount: 6000, date: new Date('2024-06-01'), reference: 'PAY001' },
        ],
      });

      expect(reconciliation.totalPaid).toBe(6000);
      expect(reconciliation.remainingBalance).toBe(-1000);
      expect(reconciliation.isFullyPaid).toBe(true);
      expect(reconciliation.hasOverpayment).toBe(true);
      expect(reconciliation.overpaymentAmount).toBe(1000);
    });
  });

  describe('Overdue Payment Management', () => {
    test('should identify all overdue payments', () => {
      const liabilities = [
        {
          id: 'L001',
          dueDate: new Date('2024-05-20'),
          totalAmount: 10000,
          paidAmount: 0,
          status: 'PENDING' as RCMPaymentStatus,
        },
        {
          id: 'L002',
          dueDate: new Date('2024-07-20'),
          totalAmount: 5000,
          paidAmount: 0,
          status: 'PENDING' as RCMPaymentStatus,
        },
        {
          id: 'L003',
          dueDate: new Date('2024-04-20'),
          totalAmount: 8000,
          paidAmount: 3000,
          status: 'PARTIALLY_PAID' as RCMPaymentStatus,
        },
      ];

      const overduePayments = getOverduePayments(liabilities);

      expect(overduePayments.length).toBe(2); // L001 and L003
      expect(overduePayments[0].id).toBe('L003'); // Older overdue first
      expect(overduePayments[1].id).toBe('L001');
      expect(overduePayments[0].daysOverdue).toBeGreaterThan(overduePayments[1].daysOverdue);
    });

    test('should calculate total overdue amount', () => {
      const liabilities = [
        {
          id: 'L001',
          dueDate: new Date('2024-05-20'),
          totalAmount: 10000,
          paidAmount: 0,
          status: 'PENDING' as RCMPaymentStatus,
        },
        {
          id: 'L002',
          dueDate: new Date('2024-04-20'),
          totalAmount: 8000,
          paidAmount: 3000,
          status: 'PARTIALLY_PAID' as RCMPaymentStatus,
        },
      ];

      const overduePayments = getOverduePayments(liabilities);
      const totalOverdue = overduePayments.reduce((sum, p) => sum + (p.totalAmount - p.paidAmount), 0);

      expect(totalOverdue).toBe(15000); // 10000 + 5000
    });
  });

  describe('Payment Reminders', () => {
    test('should generate payment reminder for upcoming due date', () => {
      const reminder = generatePaymentReminder({
        liabilityId: 'L001',
        vendorName: 'ABC Services',
        amount: 10000,
        dueDate: new Date('2024-06-20'), // 5 days from now
        reminderType: 'UPCOMING',
      });

      expect(reminder.subject).toContain('RCM Payment Due');
      expect(reminder.body).toContain('ABC Services');
      expect(reminder.body).toContain('10000');
      expect(reminder.body).toContain('20/06/2024');
      expect(reminder.urgency).toBe('NORMAL');
      expect(reminder.daysUntilDue).toBe(5);
    });

    test('should generate urgent reminder for overdue payment', () => {
      const reminder = generatePaymentReminder({
        liabilityId: 'L002',
        vendorName: 'XYZ Transport',
        amount: 5000,
        dueDate: new Date('2024-05-20'), // Overdue
        reminderType: 'OVERDUE',
      });

      expect(reminder.subject).toContain('OVERDUE');
      expect(reminder.urgency).toBe('HIGH');
      expect(reminder.daysOverdue).toBeGreaterThan(0);
      expect(reminder.includesInterest).toBe(true);
    });

    test('should generate final notice for severely overdue', () => {
      const reminder = generatePaymentReminder({
        liabilityId: 'L003',
        vendorName: 'Legal Services Ltd',
        amount: 20000,
        dueDate: new Date('2024-03-20'), // Very overdue
        reminderType: 'FINAL_NOTICE',
      });

      expect(reminder.subject).toContain('FINAL NOTICE');
      expect(reminder.urgency).toBe('CRITICAL');
      expect(reminder.includesPenalty).toBe(true);
      expect(reminder.includesInterest).toBe(true);
    });
  });
});