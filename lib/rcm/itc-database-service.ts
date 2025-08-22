/**
 * ITC Database Service Layer
 * 
 * Service layer for managing ITC-related database operations
 * including eligibility records, GSTR-2B entries, credit ledger,
 * reconciliation, and utilization tracking.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { toSafeNumber } from '../utils/decimal';
import { 
  ITCEligibilityResult, 
  ITCEligibilityRequest 
} from './itc-eligibility';
import { 
  ITCReconciliationResult,
  ITCUtilization,
  CreditLedgerEntry 
} from './itc-reconciliation';
import { 
  RCMTransaction,
  RCMTransactionResult,
  MonthlyITCResult 
} from './itc-integration';

const prisma = new PrismaClient();

// ============= ITC Eligibility Records =============

/**
 * Save ITC eligibility determination to database
 */
export async function saveITCEligibility(
  userId: string,
  request: ITCEligibilityRequest,
  result: ITCEligibilityResult,
  transactionId?: string
) {
  return await (prisma as any).itcEligibilityRecord.create({
    data: {
      userId,
      transactionId,
      category: request.category || 'GENERAL',
      description: request.description,
      amount: new Prisma.Decimal(toSafeNumber(request.amount)),
      gstAmount: new Prisma.Decimal(toSafeNumber(request.gstAmount)),
      cgst: new Prisma.Decimal(toSafeNumber(request.cgst || 0)),
      sgst: new Prisma.Decimal(toSafeNumber(request.sgst || 0)),
      igst: new Prisma.Decimal(toSafeNumber(request.igst || 0)),
      cess: new Prisma.Decimal(toSafeNumber(request.cess || 0)),
      usage: request.usage || 'BUSINESS',
      businessUsePercentage: request.businessUsePercentage,
      isEligible: result.isEligible,
      eligibleAmount: new Prisma.Decimal(toSafeNumber(result.eligibleAmount)),
      blockedAmount: new Prisma.Decimal(toSafeNumber(result.blockedAmount || 0)),
      blockReason: result.blockReason,
      section: (result as any).section || null,
      exception: (result as any).exception || null,
      isRCM: request.rcmApplicable || false,
      // selfInvoiceNumber: Not available in interface
      selfInvoiceDate: request.invoiceDate,
      isWithinTimeLimit: true, // Default value since property doesn't exist in result
      deadlineToClaim: null, // Default value since property doesn't exist in result
      reversalRequired: result.reversalRequired || false,
      reversalReason: result.reversalReason,
      reversalAmount: new Prisma.Decimal(toSafeNumber(result.reversalAmount || 0)),
      complianceNote: result.complianceNote,
      gstr3bTable: result.gstr3bTable,
    },
  });
}

/**
 * Retrieve ITC eligibility records
 */
export async function getITCEligibilityRecords(
  userId: string,
  filters?: {
    isEligible?: boolean;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    isRCM?: boolean;
  }
) {
  return await (prisma as any).itcEligibilityRecord.findMany({
    where: {
      userId,
      ...(filters?.isEligible !== undefined && { isEligible: filters.isEligible }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.isRCM !== undefined && { isRCM: filters.isRCM }),
      ...(filters?.startDate && {
        createdAt: {
          gte: filters.startDate,
          ...(filters?.endDate && { lte: filters.endDate }),
        },
      }),
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ============= GSTR-2B Entries =============

/**
 * Save GSTR-2B entry
 */
export async function saveGSTR2BEntry(
  userId: string,
  entry: {
    gstin: string;
    tradeName?: string;
    invoiceNumber: string;
    invoiceDate: Date;
    invoiceValue: number;
    placeOfSupply?: string;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    type: string;
    returnPeriod: string;
    financialYear: string;
  }
) {
  return await (prisma as any).gstr2bEntry.create({
    data: {
      userId,
      gstin: entry.gstin,
      tradeName: entry.tradeName,
      invoiceNumber: entry.invoiceNumber,
      invoiceDate: entry.invoiceDate,
      invoiceValue: new Prisma.Decimal(toSafeNumber(entry.invoiceValue)),
      placeOfSupply: entry.placeOfSupply,
      cgst: new Prisma.Decimal(toSafeNumber(entry.cgst)),
      sgst: new Prisma.Decimal(toSafeNumber(entry.sgst)),
      igst: new Prisma.Decimal(toSafeNumber(entry.igst)),
      cess: new Prisma.Decimal(toSafeNumber(entry.cess)),
      eligibleCGST: new Prisma.Decimal(toSafeNumber(entry.cgst)),
      eligibleSGST: new Prisma.Decimal(toSafeNumber(entry.sgst)),
      eligibleIGST: new Prisma.Decimal(toSafeNumber(entry.igst)),
      eligibleCESS: new Prisma.Decimal(toSafeNumber(entry.cess)),
      type: entry.type,
      returnPeriod: entry.returnPeriod,
      financialYear: entry.financialYear,
    },
  });
}

/**
 * Bulk import GSTR-2B entries
 */
export async function bulkImportGSTR2BEntries(
  userId: string,
  entries: Array<any>,
  returnPeriod: string,
  financialYear: string
) {
  const data = entries.map(entry => ({
    userId,
    gstin: entry.gstin,
    tradeName: entry.tradeName,
    invoiceNumber: entry.invoiceNumber,
    invoiceDate: new Date(entry.invoiceDate),
    invoiceValue: new Prisma.Decimal(toSafeNumber(entry.invoiceValue)),
    placeOfSupply: entry.placeOfSupply,
    cgst: new Prisma.Decimal(toSafeNumber(entry.cgst || 0)),
    sgst: new Prisma.Decimal(toSafeNumber(entry.sgst || 0)),
    igst: new Prisma.Decimal(toSafeNumber(entry.igst || 0)),
    cess: new Prisma.Decimal(toSafeNumber(entry.cess || 0)),
    eligibleCGST: new Prisma.Decimal(toSafeNumber(entry.cgst || 0)),
    eligibleSGST: new Prisma.Decimal(toSafeNumber(entry.sgst || 0)),
    eligibleIGST: new Prisma.Decimal(toSafeNumber(entry.igst || 0)),
    eligibleCESS: new Prisma.Decimal(toSafeNumber(entry.cess || 0)),
    type: entry.type || 'B2B',
    returnPeriod,
    financialYear,
  }));

  return await (prisma as any).gstr2bEntry.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * Match internal invoices with GSTR-2B entries
 */
export async function matchWithGSTR2B(
  userId: string,
  returnPeriod: string,
  invoices: Array<{
    gstin: string;
    invoiceNumber: string;
    invoiceDate: Date;
    amount: number;
  }>
) {
  const gstr2bEntries = await (prisma as any).gstr2bEntry.findMany({
    where: {
      userId,
      returnPeriod,
      isMatched: false,
    },
  });

  const matches = [];
  const mismatches = [];

  for (const invoice of invoices) {
    const gstr2bEntry = gstr2bEntries.find(
      (entry: any) =>
        entry.gstin === invoice.gstin &&
        entry.invoiceNumber === invoice.invoiceNumber &&
        Math.abs(entry.invoiceDate.getTime() - invoice.invoiceDate.getTime()) < 86400000 // 1 day tolerance
    );

    if (gstr2bEntry) {
      // Mark as matched
      await (prisma as any).gstr2bEntry.update({
        where: { id: gstr2bEntry.id },
        data: {
          isMatched: true,
          matchedWith: invoice.invoiceNumber,
          matchingDate: new Date(),
        },
      });
      matches.push({ invoice, gstr2bEntry });
    } else {
      mismatches.push(invoice);
    }
  }

  return { matches, mismatches };
}

// ============= Credit Ledger Management =============

/**
 * Add credit ledger entry
 */
export async function addCreditLedgerEntry(
  userId: string,
  entry: CreditLedgerEntry & {
    transactionId?: string;
    returnPeriod: string;
    financialYear: string;
  }
) {
  // Get current balance
  const lastEntry = await (prisma as any).itcCreditLedger.findFirst({
    where: { userId },
    orderBy: { entryDate: 'desc' },
  });

  const currentBalance = {
    cgst: lastEntry?.cgstBalance || new Prisma.Decimal(0),
    sgst: lastEntry?.sgstBalance || new Prisma.Decimal(0),
    igst: lastEntry?.igstBalance || new Prisma.Decimal(0),
    cess: lastEntry?.cessBalance || new Prisma.Decimal(0),
  };

  // Calculate new balance
  const newBalance = {
    cgst: currentBalance.cgst.add(entry.cgst || 0),
    sgst: currentBalance.sgst.add(entry.sgst || 0),
    igst: currentBalance.igst.add(entry.igst || 0),
    cess: currentBalance.cess.add(entry.cess || 0),
  };

  return await (prisma as any).itcCreditLedger.create({
    data: {
      userId,
      entryDate: entry.date,
      entryType: entry.type,
      description: entry.description,
      cgst: new Prisma.Decimal(entry.cgst || 0),
      sgst: new Prisma.Decimal(entry.sgst || 0),
      igst: new Prisma.Decimal(entry.igst || 0),
      cess: new Prisma.Decimal(entry.cess || 0),
      reference: entry.reference,
      transactionId: entry.transactionId,
      reversalReason: entry.reversalReason,
      // originalEntryId: not available in CreditLedgerEntry interface
      status: entry.status || 'FINAL',
      cgstBalance: newBalance.cgst,
      sgstBalance: newBalance.sgst,
      igstBalance: newBalance.igst,
      cessBalance: newBalance.cess,
      returnPeriod: entry.returnPeriod,
      financialYear: entry.financialYear,
    },
  });
}

/**
 * Get credit ledger balance
 */
export async function getCreditLedgerBalance(userId: string) {
  const lastEntry = await (prisma as any).itcCreditLedger.findFirst({
    where: { userId },
    orderBy: { entryDate: 'desc' },
  });

  if (!lastEntry) {
    return {
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
    };
  }

  return {
    cgst: lastEntry.cgstBalance.toNumber(),
    sgst: lastEntry.sgstBalance.toNumber(),
    igst: lastEntry.igstBalance.toNumber(),
    cess: lastEntry.cessBalance.toNumber(),
  };
}

// ============= ITC Reconciliation =============

/**
 * Save ITC reconciliation record
 */
export async function saveITCReconciliation(
  userId: string,
  period: string,
  reconciliation: ITCReconciliationResult & {
    financialYear: string;
  }
) {
  return await (prisma as any).itcReconciliation.upsert({
    where: {
      userId_period: {
        userId,
        period,
      },
    },
    update: {
      asPerBooks: new Prisma.Decimal(reconciliation.totalITCClaimed || 0),
      asPerGSTR2B: new Prisma.Decimal(0), // Not available in interface
      difference: new Prisma.Decimal(0), // Calculate if needed
      b2bMatched: 0, // Calculate from unreconciled
      b2bUnmatched: reconciliation.unreconciled?.length || 0,
      rcmTransactions: 0, // Not available in interface
      excessClaimed: new Prisma.Decimal(0), // Not available in interface
      shortClaimed: new Prisma.Decimal(0), // Not available in interface
      blockedCredits: new Prisma.Decimal(0), // Not available in interface
      reversals: new Prisma.Decimal(0), // Not available in interface
      isReconciled: reconciliation.isReconciled,
      reconciledDate: reconciliation.isReconciled ? new Date() : null,
      remarks: reconciliation.issues?.join(', ') || null,
      pendingActions: reconciliation.issues || [],
    },
    create: {
      userId,
      period,
      financialYear: reconciliation.financialYear,
      asPerBooks: new Prisma.Decimal(reconciliation.totalITCClaimed || 0),
      asPerGSTR2B: new Prisma.Decimal(0), // Not available in interface
      difference: new Prisma.Decimal(0), // Calculate if needed
      b2bMatched: 0, // Calculate from unreconciled
      b2bUnmatched: reconciliation.unreconciled?.length || 0,
      rcmTransactions: 0, // Not available in interface
      excessClaimed: new Prisma.Decimal(0), // Not available in interface
      shortClaimed: new Prisma.Decimal(0), // Not available in interface
      blockedCredits: new Prisma.Decimal(0), // Not available in interface
      reversals: new Prisma.Decimal(0), // Not available in interface
      isReconciled: reconciliation.isReconciled,
      reconciledDate: reconciliation.isReconciled ? new Date() : null,
      remarks: reconciliation.issues?.join(', ') || null,
      pendingActions: reconciliation.issues || [],
    },
  });
}

// ============= ITC Utilization =============

/**
 * Save ITC utilization record
 */
export async function saveITCUtilization(
  userId: string,
  utilization: ITCUtilization & {
    returnPeriod: string;
    gstr3bReference?: string;
    challanNumber?: string;
  }
) {
  return await (prisma as any).itcUtilization.create({
    data: {
      userId,
      utilizationDate: new Date(),
      returnPeriod: utilization.returnPeriod,
      availableCGST: new Prisma.Decimal(0), // Not available in interface
      availableSGST: new Prisma.Decimal(0), // Not available in interface
      availableIGST: new Prisma.Decimal(0), // Not available in interface
      availableCESS: new Prisma.Decimal(0), // Not available in interface
      liabilityCGST: new Prisma.Decimal(0), // Not available in interface
      liabilitySGST: new Prisma.Decimal(0), // Not available in interface
      liabilityIGST: new Prisma.Decimal(0), // Not available in interface
      liabilityCESS: new Prisma.Decimal(0), // Not available in interface,
      cgstUsed: new Prisma.Decimal(utilization.cgstUsed),
      sgstUsed: new Prisma.Decimal(utilization.sgstUsed),
      igstUsed: new Prisma.Decimal(utilization.igstUsed),
      cessUsed: new Prisma.Decimal(utilization.cessUsed || 0),
      igstForCGST: new Prisma.Decimal(0), // Not available in interface
      igstForSGST: new Prisma.Decimal(0), // Not available in interface,
      cashRequired: new Prisma.Decimal(utilization.cashRequired),
      cashPaid: new Prisma.Decimal(0), // Not available in interface,
      cgstBalance: new Prisma.Decimal(utilization.remainingITC.cgst),
      sgstBalance: new Prisma.Decimal(utilization.remainingITC.sgst),
      igstBalance: new Prisma.Decimal(utilization.remainingITC.igst),
      cessBalance: new Prisma.Decimal(utilization.remainingITC.cess || 0),
      gstr3bReference: utilization.gstr3bReference,
      challanNumber: utilization.challanNumber,
    },
  });
}

// ============= ITC Claim Summary =============

/**
 * Save monthly ITC claim summary
 */
export async function saveITCClaimSummary(
  userId: string,
  claimMonth: string,
  summary: MonthlyITCResult & {
    financialYear: string;
    filingReference?: string;
  }
) {
  const totalCGST = 0; // Calculate from transactions
  const totalSGST = 0; // Calculate from transactions
  const totalIGST = summary.summary.totalITCEligible;
  const totalCESS = 0;

  return await (prisma as any).itcClaimSummary.upsert({
    where: {
      userId_claimMonth: {
        userId,
        claimMonth,
      },
    },
    update: {
      b2bITC: new Prisma.Decimal(summary.summary.b2bITC),
      rcmITC: new Prisma.Decimal(summary.summary.rcmITC),
      importITC: new Prisma.Decimal(summary.summary.importITC),
      totalCGST: new Prisma.Decimal(totalCGST),
      totalSGST: new Prisma.Decimal(totalSGST),
      totalIGST: new Prisma.Decimal(totalIGST),
      totalCESS: new Prisma.Decimal(totalCESS),
      blockedITC: new Prisma.Decimal(summary.timeBarredAmount || 0),
      reversedITC: new Prisma.Decimal(0), // Calculate from ledger
      reclaimedITC: new Prisma.Decimal(0), // Calculate from ledger
      netITCClaimed: new Prisma.Decimal(summary.allowedITC || 0),
      isReconciled: summary.gstr2bMatching.status === 'MATCHED',
      matchPercentage: new Prisma.Decimal(
        (summary.gstr2bMatching.matched / summary.summary.totalTransactions) * 100
      ),
      filingReference: summary.filingReference,
    },
    create: {
      userId,
      claimMonth,
      financialYear: summary.financialYear,
      b2bITC: new Prisma.Decimal(summary.summary.b2bITC),
      rcmITC: new Prisma.Decimal(summary.summary.rcmITC),
      importITC: new Prisma.Decimal(summary.summary.importITC),
      totalCGST: new Prisma.Decimal(totalCGST),
      totalSGST: new Prisma.Decimal(totalSGST),
      totalIGST: new Prisma.Decimal(totalIGST),
      totalCESS: new Prisma.Decimal(totalCESS),
      blockedITC: new Prisma.Decimal(summary.timeBarredAmount || 0),
      reversedITC: new Prisma.Decimal(0),
      reclaimedITC: new Prisma.Decimal(0),
      netITCClaimed: new Prisma.Decimal(summary.allowedITC || 0),
      isReconciled: summary.gstr2bMatching.status === 'MATCHED',
      matchPercentage: new Prisma.Decimal(
        summary.summary.totalTransactions > 0
          ? (summary.gstr2bMatching.matched / summary.summary.totalTransactions) * 100
          : 0
      ),
      filingReference: summary.filingReference,
    },
  });
}

/**
 * Get ITC claim summary for a period
 */
export async function getITCClaimSummary(
  userId: string,
  claimMonth: string
) {
  return await (prisma as any).itcClaimSummary.findUnique({
    where: {
      userId_claimMonth: {
        userId,
        claimMonth,
      },
    },
  });
}

// ============= Transaction Processing =============

/**
 * Process and save complete RCM transaction with ITC
 */
export async function processAndSaveRCMTransaction(
  userId: string,
  transaction: RCMTransaction,
  result: RCMTransactionResult
) {
  // Start a transaction
  return await prisma.$transaction(async (tx) => {
    // Save eligibility record
    const eligibilityRecord = await (tx as any).itcEligibilityRecord.create({
      data: {
        userId,
        category: transaction.serviceDetails.category,
        description: transaction.serviceDetails.description,
        amount: new Prisma.Decimal(transaction.serviceDetails.amount),
        gstAmount: new Prisma.Decimal(
          (transaction.selfInvoice?.cgst || 0) +
          (transaction.selfInvoice?.sgst || 0) +
          (transaction.selfInvoice?.igst || 0)
        ),
        cgst: new Prisma.Decimal(transaction.selfInvoice?.cgst || 0),
        sgst: new Prisma.Decimal(transaction.selfInvoice?.sgst || 0),
        igst: new Prisma.Decimal(transaction.selfInvoice?.igst || 0),
        usage: transaction.serviceDetails.usage || 'BUSINESS',
        isEligible: result.eligibilityStatus !== 'BLOCKED',
        eligibleAmount: new Prisma.Decimal(result.itcAmount),
        blockedAmount: new Prisma.Decimal(
          result.eligibilityStatus === 'BLOCKED' ? result.itcAmount : 0
        ),
        blockReason: result.blockReason,
        isRCM: true,
        selfInvoiceNumber: transaction.selfInvoice?.number,
        selfInvoiceDate: transaction.selfInvoice?.date,
        complianceNote: result.complianceNote,
      },
    });

    // Add credit ledger entry if eligible and paid
    if (result.creditLedgerEntry && transaction.payment) {
      await (tx as any).itcCreditLedger.create({
        data: {
          userId,
          entryDate: transaction.payment.date,
          entryType: 'CREDIT',
          description: result.creditLedgerEntry.description,
          cgst: new Prisma.Decimal(result.creditLedgerEntry.cgst || 0),
          sgst: new Prisma.Decimal(result.creditLedgerEntry.sgst || 0),
          igst: new Prisma.Decimal(result.creditLedgerEntry.igst || 0),
          reference: result.creditLedgerEntry.reference,
          transactionId: eligibilityRecord.id,
          status: 'FINAL',
          cgstBalance: new Prisma.Decimal(0), // Will be calculated
          sgstBalance: new Prisma.Decimal(0),
          igstBalance: new Prisma.Decimal(0),
          cessBalance: new Prisma.Decimal(0),
          returnPeriod: new Date().toISOString().slice(0, 7).replace('-', '/'),
          financialYear: '2024-25',
        },
      });
    }

    return eligibilityRecord;
  });
}

// ============= Reporting Functions =============

/**
 * Get ITC summary for a period
 */
export async function getITCSummaryForPeriod(
  userId: string,
  period: string
) {
  const [eligibilityRecords, creditLedger, reconciliation, utilization, claimSummary] = 
    await Promise.all([
      (prisma as any).itcEligibilityRecord.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(`${period}-01`),
            lt: new Date(`${period}-31`),
          },
        },
      }),
      (prisma as any).itcCreditLedger.findMany({
        where: {
          userId,
          returnPeriod: period,
        },
      }),
      (prisma as any).itcReconciliation.findUnique({
        where: {
          userId_period: {
            userId,
            period,
          },
        },
      }),
      (prisma as any).itcUtilization.findMany({
        where: {
          userId,
          returnPeriod: period,
        },
      }),
      (prisma as any).itcClaimSummary.findUnique({
        where: {
          userId_claimMonth: {
            userId,
            claimMonth: period,
          },
        },
      }),
    ]);

  return {
    eligibilityRecords,
    creditLedger,
    reconciliation,
    utilization,
    claimSummary,
  };
}

/**
 * Export functions for testing
 */
export const testHelpers = {
  prisma,
};