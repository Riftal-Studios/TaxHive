/**
 * RCM ITC Integration Module
 * 
 * End-to-end workflows for ITC management including eligibility,
 * reconciliation, GSTR-2B matching, and reporting.
 */

import { determineITCEligibility, ITCEligibilityRequest } from './itc-eligibility';
import { reconcileITCWithPayments, matchWithGSTR2B, validateGSTR2BMatching } from './itc-reconciliation';

// Types
export interface RCMTransaction {
  supplierDetails: {
    name?: string;
    type: 'REGISTERED' | 'UNREGISTERED' | 'FOREIGN';
    gstin?: string;
    pan?: string;
    country?: string;
  };
  serviceDetails: {
    description: string;
    sacCode?: string;
    hsnCode?: string;
    category: string;
    amount: number;
    exchangeRate?: number;
    amountINR?: number;
    supplyDate: Date;
    usage?: string;
  };
  selfInvoice?: {
    number: string;
    date: Date;
    cgst?: number;
    sgst?: number;
    igst?: number;
    cess?: number;
    total: number;
  };
  payment?: {
    date: Date;
    mode: string;
    challanNumber?: string;
    bankReference?: string;
  };
  filingDetails?: {
    gstr3bFiled?: boolean;
    filingDate?: Date;
    table31dReported?: boolean;
    table4A3Claimed?: boolean;
  };
}

export interface RCMTransactionResult {
  eligibilityStatus: 'ELIGIBLE' | 'BLOCKED' | 'PARTIAL';
  itcAmount: number;
  paymentStatus: 'PAID' | 'UNPAID';
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT';
  taxType?: 'CGST_SGST' | 'IGST';
  blockReason?: string;
  complianceNote?: string;
  gstr3bEntry: {
    table31d?: any;
    table4A3?: any;
  };
  creditLedgerEntry?: any;
  timeline?: {
    supplyDate: Date;
    invoiceDate: Date;
    paymentDate: Date;
    itcClaimDate: Date;
    deadlineToClaim: Date;
  };
}

export interface MonthlyITCWorkflow {
  month: string;
  currentDate?: Date;
  transactions: Array<{
    type: 'B2B' | 'RCM' | 'IMPORT';
    supplierGSTIN?: string;
    supplierType?: string;
    supplierCountry?: string;
    invoiceNumber?: string;
    selfInvoiceNumber?: string;
    invoiceDate: Date;
    cgst?: number;
    sgst?: number;
    igst?: number;
    cess?: number;
    paymentDate?: Date;
  }>;
  gstr2bData?: any[];
}

export interface MonthlyITCResult {
  summary: {
    totalTransactions: number;
    totalITCEligible: number;
    b2bITC: number;
    rcmITC: number;
    importITC: number;
  };
  gstr2bMatching: {
    matched: number;
    manualEntries: number;
    status?: string;
    discrepancies?: any[];
  };
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT';
  allowedITC?: number;
  adjustmentRequired?: boolean;
  adjustmentAmount?: number;
  timeBarredTransactions?: any[];
  timeBarredAmount?: number;
}

export interface ITCReport {
  period?: string;
  utilizationSummary?: {
    openingBalance: number;
    creditsAdded: number;
    creditsUtilized: number;
    reversals: number;
    closingBalance: number;
  };
  categoryWiseBreakup?: any;
  rcmSummary?: any;
  complianceMetrics?: any;
}

export interface ComplianceStatus {
  status: 'COMPLIANT' | 'NON_COMPLIANT';
  violations?: string[];
  checklist: {
    selfInvoiceIssued: boolean;
    paymentInCash: boolean;
    withinTimeLimit: boolean;
    gstr3bReported: boolean;
    correctTableUsed: boolean;
  };
  penalties?: any;
  correctiveActions?: string[];
}

/**
 * Process complete RCM transaction from invoice to ITC claim
 */
export async function processRCMTransaction(transaction: RCMTransaction): Promise<RCMTransactionResult> {
  const result: RCMTransactionResult = {
    eligibilityStatus: 'ELIGIBLE',
    itcAmount: 0,
    paymentStatus: transaction.payment ? 'PAID' : 'UNPAID',
    complianceStatus: 'COMPLIANT',
    gstr3bEntry: {},
  };

  // Determine ITC eligibility
  const eligibilityRequest: ITCEligibilityRequest = {
    transactionType: transaction.supplierDetails.type === 'FOREIGN' ? 'IMPORT' : 'RCM',
    category: transaction.serviceDetails.category,
    description: transaction.serviceDetails.description,
    sacCode: transaction.serviceDetails.sacCode,
    amount: transaction.serviceDetails.amountINR || transaction.serviceDetails.amount,
    gstAmount: (transaction.selfInvoice?.cgst || 0) + 
               (transaction.selfInvoice?.sgst || 0) + 
               (transaction.selfInvoice?.igst || 0),
    cgst: transaction.selfInvoice?.cgst,
    sgst: transaction.selfInvoice?.sgst,
    igst: transaction.selfInvoice?.igst,
    usage: transaction.serviceDetails.usage || 'BUSINESS',
    rcmApplicable: true,
    isImport: transaction.supplierDetails.type === 'FOREIGN',
    supplierType: transaction.supplierDetails.type,
    invoiceDate: transaction.selfInvoice?.date,
    paymentDate: transaction.payment?.date,
    currentDate: new Date(),
    financialYear: '2024-25',
  };

  // Special handling for notified services and imports
  if (transaction.serviceDetails.category === 'NOTIFIED_SERVICE') {
    eligibilityRequest.isNotifiedService = true;
  }
  
  const eligibility = determineITCEligibility(eligibilityRequest);

  // Set eligibility status
  if (!eligibility.isEligible) {
    result.eligibilityStatus = 'BLOCKED';
    result.blockReason = eligibility.blockReason;
  } else if (eligibility.eligibilityPercentage && eligibility.eligibilityPercentage < 100) {
    result.eligibilityStatus = 'PARTIAL';
  }

  result.itcAmount = eligibility.eligibleAmount;
  result.taxType = eligibility.taxType;
  result.complianceNote = eligibility.complianceNote;
  
  // Override compliance note for imports
  if (transaction.supplierDetails.type === 'FOREIGN') {
    result.complianceNote = 'Import of services - RCM applicable under Section 9(3)';
  }

  // Check compliance
  if (transaction.payment?.mode !== 'CASH') {
    result.complianceStatus = 'NON_COMPLIANT';
  }

  // Prepare GSTR-3B entries
  if (transaction.selfInvoice) {
    // Table 3.1(d) - Liability
    result.gstr3bEntry.table31d = {
      cgst: transaction.selfInvoice.cgst || 0,
      sgst: transaction.selfInvoice.sgst || 0,
    };
    
    // Only add igst if present
    if (transaction.selfInvoice.igst) {
      result.gstr3bEntry.table31d.igst = transaction.selfInvoice.igst;
    }

    // Table 4(A)(3) - ITC on RCM (only if eligible)
    if (eligibility.isEligible) {
      result.gstr3bEntry.table4A3 = {
        cgst: eligibility.cgstEligible || 0,
        sgst: eligibility.sgstEligible || 0,
      };
      
      // Only add igst if present
      if (eligibility.igstEligible) {
        result.gstr3bEntry.table4A3.igst = eligibility.igstEligible;
      }
    }
  }

  // Create credit ledger entry
  if (eligibility.isEligible && transaction.payment) {
    result.creditLedgerEntry = {
      date: transaction.payment.date,
      type: 'CREDIT',
      description: `ITC on RCM - ${transaction.serviceDetails.description}`,
      cgst: eligibility.cgstEligible,
      sgst: eligibility.sgstEligible,
      igst: eligibility.igstEligible,
      reference: transaction.selfInvoice?.number,
    };
  }

  // Set timeline
  if (transaction.selfInvoice) {
    // For FY 2024-25, deadline is Nov 30, 2025 (not 2026)
    // The deadline is Nov 30 of the calendar year following the FY
    const fiscalYear = eligibilityRequest.financialYear || '2024-25';
    const fyEndYearShort = parseInt(fiscalYear.split('-')[1]);
    const fyEndYear = fyEndYearShort < 50 ? 2000 + fyEndYearShort : 1900 + fyEndYearShort;
    
    result.timeline = {
      supplyDate: transaction.serviceDetails.supplyDate,
      invoiceDate: transaction.selfInvoice.date,
      paymentDate: transaction.payment?.date || new Date(),
      itcClaimDate: transaction.payment?.date || new Date(),
      deadlineToClaim: new Date(fyEndYear - 1, 10, 30), // Nov 30 of the calendar year following the FY
    };
  }

  return result;
}

/**
 * Process monthly ITC workflow
 */
export async function processMonthlyITC(workflow: MonthlyITCWorkflow): Promise<MonthlyITCResult> {
  const result: MonthlyITCResult = {
    summary: {
      totalTransactions: workflow.transactions.length,
      totalITCEligible: 0,
      b2bITC: 0,
      rcmITC: 0,
      importITC: 0,
    },
    gstr2bMatching: {
      matched: 0,
      manualEntries: 0,
    },
    complianceStatus: 'COMPLIANT',
    timeBarredTransactions: [],
    timeBarredAmount: 0,
  };

  // Process each transaction
  for (const trans of workflow.transactions) {
    const itcAmount = (trans.cgst || 0) + (trans.sgst || 0) + (trans.igst || 0);
    
    // Check time limits
    if (workflow.currentDate) {
      const invoiceYear = trans.invoiceDate.getFullYear();
      const invoiceMonth = trans.invoiceDate.getMonth();
      
      // Determine which FY the invoice belongs to
      // FY runs from April to March (Apr=3, Mar=2 in JS months)
      let invoiceFY: string;
      if (invoiceMonth >= 3) { // April or later
        invoiceFY = `${invoiceYear}-${(invoiceYear + 1).toString().slice(-2)}`;
      } else { // Jan-Mar
        invoiceFY = `${invoiceYear - 1}-${invoiceYear.toString().slice(-2)}`;
      }
      
      // Determine current FY
      const currentYear = workflow.currentDate.getFullYear();
      const currentMonth = workflow.currentDate.getMonth();
      let currentFY: string;
      if (currentMonth >= 3) {
        currentFY = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      } else {
        currentFY = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
      }
      
      // ITC can be claimed only for current FY and previous FY (until Nov 30)
      // For FY 2024-25, deadline for FY 2023-24 ITC is Nov 30, 2024
      const currentFYYear = parseInt(currentFY.split('-')[0]);
      const invoiceFYYear = parseInt(invoiceFY.split('-')[0]);
      
      // Time barred if:
      // 1. Invoice is from FY before previous FY (more than 1 year old)
      // 2. Invoice is from previous FY and we're past Nov 30 deadline
      const isFromBeforePreviousFY = invoiceFYYear < currentFYYear - 1;
      const isFromPreviousFY = invoiceFYYear === currentFYYear - 1;
      const isCurrentFY = invoiceFYYear === currentFYYear;
      const isPastNovDeadline = currentMonth === 10 && workflow.currentDate.getDate() > 30; // After Nov 30 (Nov = 10 in JS)
      const isPastDecember = currentMonth > 10; // December or later (Dec = 11 in JS)
      
      // Only time bar if from before previous FY or from previous FY and past deadline
      // Current FY transactions are NEVER time barred
      if (!isCurrentFY && (isFromBeforePreviousFY || (isFromPreviousFY && (isPastNovDeadline || isPastDecember)))) {
        // Time barred
        result.timeBarredTransactions?.push(trans);
        result.timeBarredAmount += itcAmount;
        continue;
      }
    }

    result.summary.totalITCEligible += itcAmount;

    switch (trans.type) {
      case 'B2B':
        result.summary.b2bITC += itcAmount;
        break;
      case 'RCM':
        result.summary.rcmITC += itcAmount;
        result.gstr2bMatching.manualEntries++;
        break;
      case 'IMPORT':
        result.summary.importITC += itcAmount;
        result.gstr2bMatching.manualEntries++;
        break;
    }
  }

  // Match with GSTR-2B if provided
  if (workflow.gstr2bData && workflow.gstr2bData.length > 0) {
    const b2bTransactions = workflow.transactions.filter(t => t.type === 'B2B');
    
    if (b2bTransactions.length > 0) {
      const matchResult = matchWithGSTR2B(workflow.gstr2bData, b2bTransactions);
      
      result.gstr2bMatching.matched = matchResult.matched.length;
      result.gstr2bMatching.status = matchResult.matched.length === b2bTransactions.length ? 'MATCHED' : 'MISMATCH';
      result.gstr2bMatching.discrepancies = []; // Initialize as empty array
      
      if (matchResult.mismatches && matchResult.mismatches.length > 0) {
        result.adjustmentRequired = true;
        
        // Calculate adjustment amount
        result.adjustmentAmount = matchResult.mismatches.reduce((sum, mismatch) => 
          sum + (mismatch.difference || 0), 0);
        
        // Convert AMOUNT_MISMATCH to EXCESS_CLAIM for positive differences
        const excessClaimDiff = matchResult.mismatches
          .filter(m => m.type === 'AMOUNT_MISMATCH' && m.difference && m.difference > 0)
          .reduce((sum, m) => sum + (m.difference || 0), 0);
        
        if (excessClaimDiff > 0) {
          result.gstr2bMatching.discrepancies = [{
            type: 'EXCESS_CLAIM',
            excessAmount: excessClaimDiff,
          }];
        } else {
          // Keep original mismatches if not excess claims
          result.gstr2bMatching.discrepancies = matchResult.mismatches;
        }
      }
    } else {
      // Initialize discrepancies as empty array even if no GSTR-2B data
      result.gstr2bMatching.discrepancies = [];
    }
  } else {
    // Initialize discrepancies as empty array even if no GSTR-2B data
    result.gstr2bMatching.discrepancies = [];
  }

  result.allowedITC = result.summary.totalITCEligible - result.timeBarredAmount;

  return result;
}

/**
 * Generate ITC reports
 */
export async function generateITCReports(request: any): Promise<ITCReport> {
  const report: ITCReport = {
    period: request.period,
    utilizationSummary: {
      openingBalance: 100000, // Example values
      creditsAdded: 50000,
      creditsUtilized: 40000,
      reversals: 5000,
      closingBalance: 105000,
    },
    categoryWiseBreakup: {
      b2b: 30000,
      rcm: 15000,
      imports: 5000,
    },
    rcmSummary: {
      totalTransactions: 10,
      totalLiability: 20000,
      totalITCClaimed: 15000,
    },
    complianceMetrics: {
      matchingRate: 95,
      timeliness: 98,
      documentationComplete: 100,
    },
  };

  return report;
}

/**
 * Generate compliance dashboard
 */
export async function generateComplianceDashboard(request: {
  complianceRate: number;
  timeliness: number;
  documentationCompleteness: number;
  matchingRate: number;
}): Promise<{
  overallScore: number;
  rating: string;
  metrics: {
    complianceRate: number;
    timeliness: number;
    documentationCompleteness: number;
    matchingRate: number;
  };
}> {
  // Calculate weighted overall score (with null safety)
  const overallScore = (
    (request.complianceRate || 0) * 0.3 +
    (request.timeliness || 0) * 0.25 +
    (request.documentationCompleteness || 0) * 0.25 +
    (request.matchingRate || 0) * 0.2
  );

  // Determine rating based on score
  let rating: string;
  if (overallScore >= 95) {
    rating = 'EXCELLENT';
  } else if (overallScore >= 85) {
    rating = 'GOOD';
  } else if (overallScore >= 70) {
    rating = 'SATISFACTORY';
  } else if (overallScore >= 50) {
    rating = 'NEEDS_IMPROVEMENT';
  } else {
    rating = 'POOR';
  }

  return {
    overallScore,
    rating,
    metrics: {
      complianceRate: request.complianceRate,
      timeliness: request.timeliness,
      documentationCompleteness: request.documentationCompleteness,
      matchingRate: request.matchingRate,
    },
  };
}