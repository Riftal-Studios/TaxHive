/**
 * RCM ITC Reconciliation Module
 * 
 * Handles ITC reconciliation with payments, GSTR-2B matching,
 * credit ledger management, and utilization tracking.
 */

// Types and Interfaces
export interface ITCReconciliationRequest {
  period: string;
  rcmPayments: RCMPaymentEntry[];
  itcClaimed: ITCClaimEntry[];
  currentDate?: Date;
}

export interface RCMPaymentEntry {
  transactionId: string;
  paymentDate: Date;
  amount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  paymentMode: string;
  challanNumber?: string;
  bankReference?: string;
}

export interface ITCClaimEntry {
  transactionId: string;
  claimMonth: string;
  claimDate?: Date;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  table?: string;
}

export interface ITCReconciliationResult {
  isReconciled: boolean;
  totalPayments: number;
  totalITCClaimed: number;
  unreconciled: UnreconciledEntry[];
  issues?: string[];
  corrections?: CorrectionEntry[];
  complianceViolation?: boolean;
}

export interface UnreconciledEntry {
  transactionId: string;
  reason: string;
  amount?: number;
}

export interface CorrectionEntry {
  transactionId: string;
  action: string;
  amount?: number;
  description?: string;
}

export interface GSTR2BEntry {
  gstin: string;
  tradeName?: string;
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceValue: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  eligibleITC?: {
    cgst?: number;
    sgst?: number;
    igst?: number;
    cess?: number;
  };
  blockedITC?: {
    cgst?: number;
    sgst?: number;
    igst?: number;
    cess?: number;
  };
  type?: string;
  isAmendment?: boolean;
  originalInvoiceNumber?: string;
  originalInvoiceDate?: Date;
}

export interface GSTR2BMatchResult {
  matched: any[];
  unmatched: any[];
  mismatches?: MismatchEntry[];
  matchPercentage: number;
  violations?: ViolationEntry[];
  amendments?: AmendmentEntry[];
  rcmTransactions?: any[];
  requiresManualEntry?: boolean;
  note?: string;
}

export interface MismatchEntry {
  type: string;
  invoiceNumber?: string;
  gstr2bAmount?: number;
  claimedAmount?: number;
  difference?: number;
}

export interface ViolationEntry {
  type: string;
  invoiceNumber?: string;
  excessClaim?: number;
}

export interface AmendmentEntry {
  invoiceNumber: string;
  requiresAdjustment: boolean;
  adjustmentMonth: string;
}

export interface CreditLedgerEntry {
  date: Date;
  type: 'CREDIT' | 'DEBIT' | 'REVERSAL' | 'ADJUSTMENT';
  description?: string;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  reference?: string;
  reversalReason?: string;
  status?: 'PROVISIONAL' | 'FINAL';
  note?: string;
}

export interface ITCBalance {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
}

export interface ITCUtilization {
  igstUsed: number;
  cgstUsed: number;
  sgstUsed: number;
  cessUsed?: number;
  cashRequired: number;
  remainingITC: {
    igst: number;
    cgst: number;
    sgst: number;
    cess?: number;
  };
}

export interface ReconciliationMismatch {
  type: string;
  count: number;
  amount: number;
}

/**
 * Reconcile ITC claims with RCM payments
 */
export function reconcileITCWithPayments(request: ITCReconciliationRequest): ITCReconciliationResult {
  const result: ITCReconciliationResult = {
    isReconciled: true,
    totalPayments: 0,
    totalITCClaimed: 0,
    unreconciled: [],
    issues: [],
    corrections: [],
  };

  // Calculate totals
  result.totalPayments = request.rcmPayments.reduce((sum, payment) => 
    sum + payment.amount, 0);
  
  result.totalITCClaimed = request.itcClaimed.reduce((sum, claim) => {
    const claimAmount = (claim.cgst || 0) + (claim.sgst || 0) + (claim.igst || 0) + (claim.cess || 0);
    return sum + claimAmount;
  }, 0);

  // Check each ITC claim
  for (const claim of request.itcClaimed) {
    const payment = request.rcmPayments.find(p => p.transactionId === claim.transactionId);
    
    if (!payment) {
      result.unreconciled.push({
        transactionId: claim.transactionId,
        reason: 'NO_PAYMENT_FOUND',
        amount: (claim.cgst || 0) + (claim.sgst || 0) + (claim.igst || 0),
      });
      result.isReconciled = false;
      continue;
    }

    // Check if ITC claimed before payment
    if (claim.claimDate && payment.paymentDate && claim.claimDate < payment.paymentDate) {
      result.issues?.push('ITC_CLAIMED_BEFORE_PAYMENT');
      result.corrections?.push({
        transactionId: claim.transactionId,
        action: 'REVERSE_AND_RECLAIM',
        description: 'ITC claimed before payment - reverse and reclaim after payment',
      });
      result.isReconciled = false;
    }

    // Check payment mode for RCM
    if (payment.paymentMode !== 'CASH') {
      result.issues?.push('RCM_NOT_PAID_IN_CASH');
      result.complianceViolation = true;
      result.isReconciled = false;
    }
  }

  return result;
}

/**
 * Match ITC claims with GSTR-2B entries
 */
export function matchWithGSTR2B(gstr2bData: GSTR2BEntry[], claimedITC: any[]): GSTR2BMatchResult {
  const result: GSTR2BMatchResult = {
    matched: [],
    unmatched: [],
    mismatches: [],
    matchPercentage: 0,
    violations: [],
  };

  for (const claim of claimedITC) {
    // Handle both supplierGSTIN and gstin field names
    const supplierGSTIN = claim.supplierGSTIN || claim.gstin;
    
    const gstr2bEntry = gstr2bData.find(entry => {
      // Check if dates are valid before comparing
      const entryDate = entry.invoiceDate ? new Date(entry.invoiceDate) : null;
      const claimDate = claim.invoiceDate ? new Date(claim.invoiceDate) : null;
      
      // Date matching with 1-day tolerance
      let dateMatch = true;
      if (entryDate && claimDate) {
        dateMatch = Math.abs(entryDate.getTime() - claimDate.getTime()) < 86400000;
      }
      
      return entry.gstin === supplierGSTIN &&
             entry.invoiceNumber === claim.invoiceNumber &&
             dateMatch;
    });

    if (!gstr2bEntry) {
      result.unmatched.push(claim);
      continue;
    }

    // Check amounts
    const gstr2bTotal = (gstr2bEntry.cgst || 0) + (gstr2bEntry.sgst || 0) + (gstr2bEntry.igst || 0);
    const claimTotal = (claim.cgst || 0) + (claim.sgst || 0) + (claim.igst || 0);

    if (Math.abs(gstr2bTotal - claimTotal) > 0.01) {
      result.mismatches?.push({
        type: 'AMOUNT_MISMATCH',
        invoiceNumber: claim.invoiceNumber,
        gstr2bAmount: gstr2bTotal,
        claimedAmount: claimTotal,
        difference: claimTotal - gstr2bTotal,
      });
    } else {
      result.matched.push(claim);
    }

    // Check if claiming blocked ITC
    if (gstr2bEntry.blockedITC) {
      const blockedTotal = (gstr2bEntry.blockedITC.cgst || 0) + 
                          (gstr2bEntry.blockedITC.sgst || 0) + 
                          (gstr2bEntry.blockedITC.igst || 0);
      
      const eligibleTotal = (gstr2bEntry.eligibleITC?.cgst || 0) + 
                           (gstr2bEntry.eligibleITC?.sgst || 0) + 
                           (gstr2bEntry.eligibleITC?.igst || 0);
      
      if (claimTotal > eligibleTotal) {
        result.violations?.push({
          type: 'CLAIMED_BLOCKED_ITC',
          invoiceNumber: claim.invoiceNumber,
          excessClaim: claimTotal - eligibleTotal,
        });
      }
    }
  }

  result.matchPercentage = (result.matched.length / claimedITC.length) * 100;
  
  return result;
}

/**
 * Validate GSTR-2B matching for RCM transactions
 */
export function validateGSTR2BMatching(gstr2bData: GSTR2BEntry[], rcmTransactions: any[]): GSTR2BMatchResult {
  const result: GSTR2BMatchResult = {
    matched: [],
    unmatched: [],
    matchPercentage: 0,
    rcmTransactions: [],
    requiresManualEntry: false,
    note: '',
  };

  // RCM transactions won't appear in GSTR-2B
  for (const rcm of rcmTransactions) {
    if (rcm.type === 'RCM' && rcm.selfInvoiced) {
      result.rcmTransactions?.push(rcm);
      result.requiresManualEntry = true;
    }
  }

  if (result.requiresManualEntry) {
    result.note = 'RCM transactions require manual entry in GSTR-3B';
  }

  return result;
}

/**
 * Identify mismatches in GSTR-2B
 */
export function identifyMismatches(gstr2bData: GSTR2BEntry[]): {
  amendments: AmendmentEntry[];
} {
  const amendments: AmendmentEntry[] = [];

  for (const entry of gstr2bData) {
    if (entry.isAmendment) {
      amendments.push({
        invoiceNumber: entry.invoiceNumber,
        requiresAdjustment: true,
        adjustmentMonth: 'Current',
      });
    }
  }

  return { amendments };
}

/**
 * Manage credit ledger entries
 */
export function manageCreditLedger(
  ledger: CreditLedgerEntry[], 
  entry: CreditLedgerEntry
): CreditLedgerEntry[] {
  // Calculate current balance before new entry
  const currentBalance = calculateITCBalance(ledger);
  
  // For debit entries, check if sufficient balance
  if (entry.type === 'DEBIT') {
    const requiredCgst = entry.cgst || 0;
    const requiredSgst = entry.sgst || 0;
    const requiredIgst = entry.igst || 0;
    
    if (requiredCgst > currentBalance.cgst || 
        requiredSgst > currentBalance.sgst || 
        requiredIgst > currentBalance.igst) {
      throw new Error('Insufficient ITC balance');
    }
  }
  
  // Add the new entry
  return [...ledger, entry];
}

/**
 * Calculate ITC balance from ledger entries
 */
export function calculateITCBalance(ledger: CreditLedgerEntry[]): ITCBalance {
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;

  for (const entry of ledger) {
    switch (entry.type) {
      case 'CREDIT':
        cgst += entry.cgst || 0;
        sgst += entry.sgst || 0;
        igst += entry.igst || 0;
        cess += entry.cess || 0;
        break;
      
      case 'DEBIT':
      case 'REVERSAL':
        cgst -= entry.cgst || 0;
        sgst -= entry.sgst || 0;
        igst -= entry.igst || 0;
        cess -= entry.cess || 0;
        break;
      
      case 'ADJUSTMENT':
        // Adjustments can be positive or negative
        cgst += entry.cgst || 0;
        sgst += entry.sgst || 0;
        igst += entry.igst || 0;
        cess += entry.cess || 0;
        break;
    }
  }

  return {
    cgst: Math.max(0, cgst),
    sgst: Math.max(0, sgst),
    igst: Math.max(0, igst),
    cess: Math.max(0, cess),
    total: Math.max(0, cgst + sgst + igst + cess),
  };
}

/**
 * Track ITC utilization against tax liability
 */
export function trackITCUtilization(
  availableITC: { igst: number; cgst: number; sgst: number },
  taxLiability: { igst: number; cgst: number; sgst: number }
): ITCUtilization {
  const result: ITCUtilization = {
    igstUsed: 0,
    cgstUsed: 0,
    sgstUsed: 0,
    cashRequired: 0,
    remainingITC: { ...availableITC },
  };

  // Step 1: Use IGST for IGST liability
  const igstForIgst = Math.min(availableITC.igst, taxLiability.igst);
  result.igstUsed = igstForIgst;
  let igstBalance = availableITC.igst - igstForIgst;
  
  // Step 2: Use CGST for CGST liability
  result.cgstUsed = Math.min(availableITC.cgst, taxLiability.cgst);
  let cgstShortfall = taxLiability.cgst - result.cgstUsed;
  
  // Step 3: Use SGST for SGST liability
  result.sgstUsed = Math.min(availableITC.sgst, taxLiability.sgst);
  let sgstShortfall = taxLiability.sgst - result.sgstUsed;
  
  // Step 4: Use remaining IGST for CGST shortfall if any
  if (cgstShortfall > 0 && igstBalance > 0) {
    const igstForCgst = Math.min(igstBalance, cgstShortfall);
    result.igstUsed += igstForCgst;
    igstBalance -= igstForCgst;
    cgstShortfall -= igstForCgst;
  }
  
  // Step 5: Use remaining IGST for SGST shortfall if any
  if (sgstShortfall > 0 && igstBalance > 0) {
    const igstForSgst = Math.min(igstBalance, sgstShortfall);
    result.igstUsed += igstForSgst;
    igstBalance -= igstForSgst;
    sgstShortfall -= igstForSgst;
  }
  
  // Calculate cash required for any remaining shortfall
  const igstShortfall = taxLiability.igst - igstForIgst;
  result.cashRequired = Math.max(0, igstShortfall + cgstShortfall + sgstShortfall);
  
  // Calculate remaining ITC
  result.remainingITC = {
    igst: igstBalance,
    cgst: availableITC.cgst - result.cgstUsed,
    sgst: availableITC.sgst - result.sgstUsed,
  };
  
  return result;
}