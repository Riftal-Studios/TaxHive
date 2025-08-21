/**
 * RCM Payment Tracker Module
 * 
 * Implements payment tracking, due date management, interest calculation,
 * and payment reconciliation for RCM liabilities.
 */

import { Decimal } from '@prisma/client/runtime/library';

// Types
export interface RCMPaymentLiability {
  id?: string;
  transactionId: string;
  vendorName?: string;
  vendorGSTIN?: string | null;
  serviceDescription?: string;
  hsnSacCode?: string;
  taxableAmount: number;
  totalGST: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  dueDate: Date;
  status: RCMPaymentStatus;
  createdAt?: Date;
}

export type RCMPaymentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface PaymentDueDate {
  month: number;
  year: number;
  day: number;
  fullDate: Date;
  quarter?: string;
}

export interface InterestCalculation {
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  daysLate: number;
  monthsLate?: number;
  interestRate: number;
  effectiveRate?: number;
}

export interface PaymentReconciliation {
  liabilityId: string;
  totalLiability: number;
  totalPaid: number;
  remainingBalance: number;
  isFullyPaid: boolean;
  paymentCount: number;
  lastPaymentDate?: Date;
  paymentPercentage: number;
  hasOverpayment?: boolean;
  overpaymentAmount?: number;
}

export interface PaymentStatus {
  status: RCMPaymentStatus;
  isPaid: boolean;
  isOverdue: boolean;
  daysUntilDue?: number;
  daysOverdue?: number;
  paidBeforeDue?: boolean;
  remainingAmount?: number;
  paidPercentage?: number;
}

export interface PaymentReminder {
  subject: string;
  body: string;
  urgency: 'NORMAL' | 'HIGH' | 'CRITICAL';
  daysUntilDue?: number;
  daysOverdue?: number;
  includesInterest?: boolean;
  includesPenalty?: boolean;
}

export interface PenaltyCalculation {
  penaltyAmount: number;
  cgstPenalty: number;
  sgstPenalty: number;
  daysLate: number;
}

/**
 * Calculate RCM payment liability
 */
export function calculateRCMPaymentLiability(input: {
  transactionId: string;
  taxableAmount: number;
  gstRate: number;
  taxType: 'CGST_SGST' | 'IGST';
  transactionDate: Date;
  vendorName?: string;
  vendorGSTIN?: string | null;
  serviceDescription?: string;
  hsnSacCode?: string;
}): RCMPaymentLiability {
  const totalGST = (input.taxableAmount * input.gstRate) / 100;
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  
  if (input.taxType === 'CGST_SGST') {
    cgst = totalGST / 2;
    sgst = totalGST / 2;
  } else {
    igst = totalGST;
  }
  
  const dueDate = determinePaymentDueDate(input.transactionDate).fullDate;
  
  return {
    transactionId: input.transactionId,
    vendorName: input.vendorName,
    vendorGSTIN: input.vendorGSTIN,
    serviceDescription: input.serviceDescription,
    hsnSacCode: input.hsnSacCode,
    taxableAmount: input.taxableAmount,
    totalGST,
    cgst,
    sgst,
    igst,
    cess: 0,
    dueDate,
    status: 'PENDING',
    createdAt: new Date(),
  };
}

/**
 * Determine payment due date (20th of next month for monthly, 24th for quarterly)
 */
export function determinePaymentDueDate(
  transactionDate: Date,
  filingType: 'MONTHLY' | 'QUARTERLY' = 'MONTHLY'
): PaymentDueDate {
  const date = new Date(transactionDate);
  
  if (filingType === 'MONTHLY') {
    // Due on 20th of next month
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 20);
    
    return {
      month: nextMonth.getMonth() + 1,
      year: nextMonth.getFullYear(),
      day: 20,
      fullDate: nextMonth,
    };
  } else {
    // Quarterly filing - due on 24th of month following quarter end
    const quarter = Math.floor(date.getMonth() / 3);
    const quarterEnd = new Date(date.getFullYear(), (quarter + 1) * 3, 0);
    const dueDate = new Date(quarterEnd.getFullYear(), quarterEnd.getMonth() + 1, 24);
    
    return {
      month: dueDate.getMonth() + 1,
      year: dueDate.getFullYear(),
      day: 24,
      fullDate: dueDate,
      quarter: `Q${quarter + 1}`,
    };
  }
}

/**
 * Track payment status
 */
export function trackPaymentStatus(input: {
  liabilityId: string;
  dueDate: Date;
  paidDate: Date | null;
  paidAmount: number;
  totalAmount: number;
}): PaymentStatus {
  const now = new Date();
  const isFullyPaid = input.paidAmount >= input.totalAmount;
  const isPartiallyPaid = input.paidAmount > 0 && input.paidAmount < input.totalAmount;
  const isOverdue = !isFullyPaid && now > input.dueDate;
  
  let status: RCMPaymentStatus;
  if (isFullyPaid) {
    status = 'PAID';
  } else if (isPartiallyPaid) {
    status = 'PARTIALLY_PAID';
  } else if (isOverdue) {
    status = 'OVERDUE';
  } else {
    status = 'PENDING';
  }
  
  const daysUntilDue = !isFullyPaid && !isOverdue 
    ? Math.ceil((input.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : undefined;
    
  const daysOverdue = isOverdue
    ? Math.ceil((now.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
    
  const paidBeforeDue = input.paidDate && input.paidDate < input.dueDate;
  
  return {
    status,
    isPaid: isFullyPaid,
    isOverdue,
    daysUntilDue,
    daysOverdue,
    paidBeforeDue,
    remainingAmount: input.totalAmount - input.paidAmount,
    paidPercentage: Number(((input.paidAmount / input.totalAmount) * 100).toFixed(2)),
  };
}

/**
 * Calculate interest on late payments
 */
export function calculateInterest(input: {
  principalAmount: number;
  dueDate: Date;
  paidDate: Date;
  interestRate?: number;
  compoundMonthly?: boolean;
}): InterestCalculation {
  const daysLate = Math.max(
    0,
    Math.ceil((input.paidDate.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  
  if (daysLate === 0) {
    return {
      principalAmount: input.principalAmount,
      interestAmount: 0,
      totalAmount: input.principalAmount,
      daysLate: 0,
      interestRate: input.interestRate || 18,
    };
  }
  
  // Determine effective rate based on delay period
  let effectiveRate: number;
  if (daysLate <= 30) {
    effectiveRate = 18;
  } else if (daysLate <= 60) {
    effectiveRate = 24;
  } else {
    effectiveRate = 30;
  }
  
  const rate = input.interestRate || effectiveRate;
  let interestAmount: number;
  
  if (input.compoundMonthly && daysLate > 30) {
    // Compound interest calculation
    const monthsLate = Math.floor(daysLate / 30);
    const remainingDays = daysLate % 30;
    const monthlyRate = rate / 12 / 100;
    
    const compoundAmount = input.principalAmount * Math.pow(1 + monthlyRate, monthsLate);
    const simpleInterest = compoundAmount * (rate / 100) * (remainingDays / 365);
    interestAmount = compoundAmount - input.principalAmount + simpleInterest;
    
    return {
      principalAmount: input.principalAmount,
      interestAmount,
      totalAmount: input.principalAmount + interestAmount,
      daysLate,
      monthsLate,
      interestRate: rate,
      effectiveRate,
    };
  } else {
    // Simple interest calculation
    interestAmount = (input.principalAmount * rate * daysLate) / (365 * 100);
    
    return {
      principalAmount: input.principalAmount,
      interestAmount,
      totalAmount: input.principalAmount + interestAmount,
      daysLate,
      interestRate: rate,
      effectiveRate,
    };
  }
}

/**
 * Calculate penalty for late filing
 */
export function calculatePenalty(input: {
  returnType: string;
  dueDate: Date;
  filedDate: Date;
  isNilReturn: boolean;
}): PenaltyCalculation {
  const daysLate = Math.max(
    0,
    Math.ceil((input.filedDate.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  
  if (daysLate === 0) {
    return {
      penaltyAmount: 0,
      cgstPenalty: 0,
      sgstPenalty: 0,
      daysLate: 0,
    };
  }
  
  // Penalty rates
  const dailyPenalty = input.isNilReturn ? 20 : 50; // Rs. 20 for nil, Rs. 50 for normal
  const maxPenalty = input.isNilReturn ? 5000 : 10000; // Maximum cap
  
  let penaltyAmount = Math.min(daysLate * dailyPenalty, maxPenalty);
  const cgstPenalty = penaltyAmount / 2;
  const sgstPenalty = penaltyAmount / 2;
  
  return {
    penaltyAmount,
    cgstPenalty,
    sgstPenalty,
    daysLate,
  };
}

/**
 * Reconcile multiple payments for a liability
 */
export function reconcilePayments(input: {
  liabilityId: string;
  totalLiability: number;
  payments: Array<{
    amount: number;
    date: Date;
    reference: string;
  }>;
}): PaymentReconciliation {
  const totalPaid = input.payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = input.totalLiability - totalPaid;
  const isFullyPaid = totalPaid >= input.totalLiability;
  const hasOverpayment = totalPaid > input.totalLiability;
  
  const lastPaymentDate = input.payments.length > 0
    ? input.payments.reduce((latest, p) => 
        p.date > latest ? p.date : latest, input.payments[0].date)
    : undefined;
  
  return {
    liabilityId: input.liabilityId,
    totalLiability: input.totalLiability,
    totalPaid,
    remainingBalance,
    isFullyPaid,
    paymentCount: input.payments.length,
    lastPaymentDate,
    paymentPercentage: (totalPaid / input.totalLiability) * 100,
    hasOverpayment,
    overpaymentAmount: hasOverpayment ? totalPaid - input.totalLiability : undefined,
  };
}

/**
 * Get overdue payments
 */
export function getOverduePayments(
  liabilities: Array<{
    id: string;
    dueDate: Date;
    totalAmount: number;
    paidAmount: number;
    status: RCMPaymentStatus;
  }>
): Array<{
  id: string;
  dueDate: Date;
  totalAmount: number;
  paidAmount: number;
  status: RCMPaymentStatus;
  daysOverdue: number;
}> {
  const now = new Date();
  
  return liabilities
    .filter(l => {
      const isPaid = l.paidAmount >= l.totalAmount;
      const isOverdue = now > l.dueDate;
      return !isPaid && isOverdue;
    })
    .map(l => ({
      ...l,
      daysOverdue: Math.ceil((now.getTime() - l.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue); // Most overdue first
}

/**
 * Generate payment reminder
 */
export function generatePaymentReminder(input: {
  liabilityId: string;
  vendorName: string;
  amount: number;
  dueDate: Date;
  reminderType: 'UPCOMING' | 'OVERDUE' | 'FINAL_NOTICE';
}): PaymentReminder {
  const now = new Date();
  const daysUntilDue = Math.ceil((input.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysOverdue = Math.max(0, Math.ceil((now.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  let subject: string;
  let body: string;
  let urgency: 'NORMAL' | 'HIGH' | 'CRITICAL';
  let includesInterest = false;
  let includesPenalty = false;
  
  const formattedDate = input.dueDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  
  switch (input.reminderType) {
    case 'UPCOMING':
      subject = `RCM Payment Due - ${input.vendorName}`;
      body = `RCM payment of Rs. ${input.amount} for ${input.vendorName} is due on ${formattedDate}.`;
      urgency = 'NORMAL';
      break;
      
    case 'OVERDUE':
      subject = `OVERDUE: RCM Payment - ${input.vendorName}`;
      body = `RCM payment of Rs. ${input.amount.toLocaleString('en-IN')} for ${input.vendorName} is overdue by ${daysOverdue} days. Interest charges may apply.`;
      urgency = 'HIGH';
      includesInterest = true;
      break;
      
    case 'FINAL_NOTICE':
      subject = `FINAL NOTICE: RCM Payment Severely Overdue - ${input.vendorName}`;
      body = `URGENT: RCM payment of Rs. ${input.amount.toLocaleString('en-IN')} for ${input.vendorName} is overdue by ${daysOverdue} days. Interest and penalties are accruing. Immediate action required.`;
      urgency = 'CRITICAL';
      includesInterest = true;
      includesPenalty = true;
      break;
  }
  
  return {
    subject,
    body,
    urgency,
    daysUntilDue: daysUntilDue > 0 ? daysUntilDue : undefined,
    daysOverdue: daysOverdue > 0 ? daysOverdue : undefined,
    includesInterest,
    includesPenalty,
  };
}