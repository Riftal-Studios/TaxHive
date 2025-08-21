/**
 * RCM Payment Service
 * 
 * Database operations for RCM payment tracking and management.
 */

import { PrismaClient } from '@prisma/client';
import { calculateRCMPaymentLiability, trackPaymentStatus, calculateInterest } from './rcm-payment-tracker';

const prisma = new PrismaClient();

/**
 * Create RCM payment liability
 */
export async function createRCMPaymentLiability(input: {
  transactionId: string;
  vendorName?: string;
  vendorCountry?: string;
  taxableAmount: number;
  gstRate: number;
  taxType: 'CGST_SGST' | 'IGST';
  rcmType: string;
  transactionDate: Date;
  hsnSacCode?: string;
  itcEligible?: boolean;
  itcCategory?: string;
  status?: string;
  paidDate?: Date;
}) {
  const liability = calculateRCMPaymentLiability({
    transactionId: input.transactionId,
    taxableAmount: input.taxableAmount,
    gstRate: input.gstRate,
    taxType: input.taxType,
    transactionDate: input.transactionDate,
    vendorName: input.vendorName,
    hsnSacCode: input.hsnSacCode,
  });
  
  // Create in database
  const created = await prisma.rCMPaymentLiability.create({
    data: {
      transactionId: input.transactionId,
      vendorName: input.vendorName || null,
      hsnSacCode: input.hsnSacCode || null,
      rcmType: input.rcmType,
      taxableAmount: input.taxableAmount,
      totalGST: liability.totalGST,
      cgst: liability.cgst,
      sgst: liability.sgst,
      igst: liability.igst,
      cess: 0,
      dueDate: liability.dueDate,
      status: input.status || liability.status,
      paidDate: input.paidDate || null,
      itcEligible: input.itcEligible !== undefined ? input.itcEligible : true,
      itcCategory: input.itcCategory || null,
      userId: 'test-user', // Would come from context in real app
    },
  });
  
  return created;
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(input: {
  liabilityId: string;
  paidAmount: number;
  paymentDate: Date;
  paymentReference: string;
  includesInterest?: boolean;
  interestAmount?: number;
}) {
  // Get current liability
  const liability = await prisma.rCMPaymentLiability.findUnique({
    where: { id: input.liabilityId }
  });
  
  if (!liability) {
    throw new Error('Liability not found');
  }
  
  // Create payment record
  await prisma.rCMPayment.create({
    data: {
      liabilityId: input.liabilityId,
      amount: input.paidAmount,
      paymentDate: input.paymentDate,
      paymentReference: input.paymentReference,
      includesInterest: input.includesInterest || false,
      interestAmount: input.interestAmount || 0,
      userId: liability.userId,
    },
  });
  
  // Update liability
  const newPaidAmount = Number(liability.paidAmount) + input.paidAmount;
  const totalAmount = Number(liability.totalGST);
  const remainingAmount = totalAmount - newPaidAmount;
  
  let status: string;
  if (newPaidAmount >= totalAmount) {
    status = 'PAID';
  } else if (newPaidAmount > 0) {
    status = 'PARTIALLY_PAID';
  } else {
    status = liability.status;
  }
  
  const updated = await prisma.rCMPaymentLiability.update({
    where: { id: input.liabilityId },
    data: {
      paidAmount: newPaidAmount,
      status,
      paidDate: status === 'PAID' ? input.paymentDate : null,
      interestAmount: (Number(liability.interestAmount) || 0) + (input.interestAmount || 0),
    },
  });
  
  return {
    ...updated,
    remainingAmount,
    interestPaid: input.interestAmount,
  };
}

/**
 * Get overdue payments
 */
export async function getOverduePayments() {
  const now = new Date();
  
  const overduePayments = await prisma.rCMPaymentLiability.findMany({
    where: {
      AND: [
        { dueDate: { lt: now } },
        { status: { not: 'PAID' } },
      ],
    },
    orderBy: { dueDate: 'asc' },
  });
  
  // Calculate interest for each
  return overduePayments.map(payment => {
    const daysOverdue = Math.ceil(
      (now.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const remainingAmount = Number(payment.totalGST) - Number(payment.paidAmount);
    const interestCalc = calculateInterest({
      principalAmount: remainingAmount,
      dueDate: payment.dueDate,
      paidDate: now,
      interestRate: 18,
    });
    
    return {
      ...payment,
      daysOverdue,
      interestAmount: interestCalc.interestAmount,
    };
  });
}

/**
 * Process batch payments
 */
export async function processPaymentBatch(input: {
  payments: Array<{
    liabilityId: string;
    amount: number;
    paymentDate: Date;
    paymentReference: string;
  }>;
}) {
  let successful = 0;
  let failed = 0;
  let totalAmount = 0;
  const errors: string[] = [];
  
  for (const payment of input.payments) {
    try {
      await updatePaymentStatus(payment);
      successful++;
      totalAmount += payment.amount;
    } catch (error) {
      failed++;
      errors.push(`Failed to process payment for ${payment.liabilityId}: ${error}`);
    }
  }
  
  return {
    successful,
    failed,
    totalAmount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Calculate RCM payment due date
 * Payment is due on the 20th of the following month
 */
export function calculateRCMPaymentDue(transactionDate: Date): Date {
  const nextMonth = new Date(transactionDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(20);
  return nextMonth;
}

/**
 * Track RCM payment
 */
export async function trackRCMPayment(input: any): Promise<any> {
  return {
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get RCM payment summary
 */
export async function getRCMPaymentSummary(userId: string, period?: string): Promise<any> {
  // Mock implementation - replace with actual DB queries
  return {
    totalLiability: 100000,
    totalPaid: 75000,
    totalPending: 25000,
    totalOverdue: 5000,
    paymentCount: 10,
    onTimePayments: 8,
    latePayments: 2,
    averageDaysToPayment: 15,
  };
}

/**
 * Get pending RCM payments
 */
export async function getPendingRCMPayments(userId: string): Promise<any[]> {
  const pending = await prisma.rCMPaymentLiability.findMany({
    where: {
      userId,
      status: { in: ['PENDING', 'PARTIALLY_PAID'] },
    },
    orderBy: { dueDate: 'asc' },
  });
  
  return pending;
}

/**
 * Calculate interest and penalty for late payment
 * Interest: 18% per annum on delayed days
 * Penalty: Minimum Rs. 10,000 or 10% of tax, whichever is higher
 */
export function calculateInterestAndPenalty(
  taxAmount: number,
  dueDate: Date,
  paymentDate: Date
): any {
  const diffTime = Math.abs(paymentDate.getTime() - dueDate.getTime());
  const daysDelayed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (daysDelayed <= 0) {
    return {
      daysDelayed: 0,
      interestRate: 0,
      interestAmount: 0,
      penaltyAmount: 0,
      totalAmount: 0,
    };
  }
  
  const interestRate = 18;
  const interestAmount = (taxAmount * interestRate * daysDelayed) / (100 * 365);
  const penaltyAmount = Math.max(10000, taxAmount * 0.1);
  
  return {
    daysDelayed,
    interestRate,
    interestAmount: Math.round(interestAmount * 100) / 100,
    penaltyAmount,
    totalAmount: Math.round((interestAmount + penaltyAmount) * 100) / 100,
  };
}

/**
 * Export RCM payment report
 */
export async function exportRCMPaymentReport(params: {
  userId: string;
  startDate: Date;
  endDate: Date;
  format: 'json' | 'csv' | 'pdf';
}): Promise<any> {
  const payments = await prisma.rCMPaymentLiability.findMany({
    where: {
      userId: params.userId,
      createdAt: {
        gte: params.startDate,
        lte: params.endDate,
      },
    },
    include: {
      payments: true,
    },
  });
  
  return {
    format: params.format,
    data: {
      period: `${params.startDate.toISOString()} to ${params.endDate.toISOString()}`,
      totalTransactions: payments.length,
      totalLiability: payments.reduce((sum, p) => sum + Number(p.totalGST), 0),
      totalPaid: payments.reduce((sum, p) => sum + Number(p.paidAmount), 0),
      totalPending: payments.reduce((sum, p) => sum + (Number(p.totalGST) - Number(p.paidAmount)), 0),
      transactions: payments,
    },
  };
}