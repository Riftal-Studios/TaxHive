-- ITC Management System Migration
-- Phase 4: ITC Eligibility, Reconciliation, and Credit Ledger

-- Create ITCEligibilityRecord table
CREATE TABLE "ITCEligibilityRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "gstAmount" DECIMAL(65,30) NOT NULL,
    "cgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usage" TEXT NOT NULL,
    "businessUsePercentage" INTEGER,
    "isEligible" BOOLEAN NOT NULL,
    "eligibleAmount" DECIMAL(65,30) NOT NULL,
    "blockedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "blockReason" TEXT,
    "section" TEXT,
    "exception" TEXT,
    "isRCM" BOOLEAN NOT NULL DEFAULT false,
    "selfInvoiceNumber" TEXT,
    "selfInvoiceDate" TIMESTAMP(3),
    "isWithinTimeLimit" BOOLEAN NOT NULL DEFAULT true,
    "deadlineToClaim" TIMESTAMP(3),
    "reversalRequired" BOOLEAN NOT NULL DEFAULT false,
    "reversalReason" TEXT,
    "reversalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reversalDate" TIMESTAMP(3),
    "reclaimEligible" BOOLEAN NOT NULL DEFAULT false,
    "reclaimAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reclaimMonth" TEXT,
    "complianceNote" TEXT,
    "gstr3bTable" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITCEligibilityRecord_pkey" PRIMARY KEY ("id")
);

-- Create GSTR2BEntry table
CREATE TABLE "GSTR2BEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "tradeName" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "invoiceValue" DECIMAL(65,30) NOT NULL,
    "placeOfSupply" TEXT,
    "cgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "eligibleCGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "eligibleSGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "eligibleIGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "eligibleCESS" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "blockedCGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "blockedSGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "blockedIGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "blockedCESS" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "isAmendment" BOOLEAN NOT NULL DEFAULT false,
    "originalInvoiceNumber" TEXT,
    "originalInvoiceDate" TIMESTAMP(3),
    "returnPeriod" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "isMatched" BOOLEAN NOT NULL DEFAULT false,
    "matchedWith" TEXT,
    "matchingDate" TIMESTAMP(3),
    "itcClaimed" BOOLEAN NOT NULL DEFAULT false,
    "claimMonth" TEXT,
    "claimAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GSTR2BEntry_pkey" PRIMARY KEY ("id")
);

-- Create ITCCreditLedger table
CREATE TABLE "ITCCreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "entryType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "transactionId" TEXT,
    "reversalReason" TEXT,
    "originalEntryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'FINAL',
    "cgstBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cessBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "returnPeriod" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITCCreditLedger_pkey" PRIMARY KEY ("id")
);

-- Create ITCReconciliation table
CREATE TABLE "ITCReconciliation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "asPerBooks" DECIMAL(65,30) NOT NULL,
    "asPerGSTR2B" DECIMAL(65,30) NOT NULL,
    "difference" DECIMAL(65,30) NOT NULL,
    "b2bMatched" INTEGER NOT NULL DEFAULT 0,
    "b2bUnmatched" INTEGER NOT NULL DEFAULT 0,
    "rcmTransactions" INTEGER NOT NULL DEFAULT 0,
    "importTransactions" INTEGER NOT NULL DEFAULT 0,
    "excessClaimed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "shortClaimed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "blockedCredits" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reversals" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledDate" TIMESTAMP(3),
    "remarks" TEXT,
    "pendingActions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITCReconciliation_pkey" PRIMARY KEY ("id")
);

-- Create ITCUtilization table
CREATE TABLE "ITCUtilization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "utilizationDate" TIMESTAMP(3) NOT NULL,
    "returnPeriod" TEXT NOT NULL,
    "availableCGST" DECIMAL(65,30) NOT NULL,
    "availableSGST" DECIMAL(65,30) NOT NULL,
    "availableIGST" DECIMAL(65,30) NOT NULL,
    "availableCESS" DECIMAL(65,30) NOT NULL,
    "liabilityCGST" DECIMAL(65,30) NOT NULL,
    "liabilitySGST" DECIMAL(65,30) NOT NULL,
    "liabilityIGST" DECIMAL(65,30) NOT NULL,
    "liabilityCESS" DECIMAL(65,30) NOT NULL,
    "cgstUsed" DECIMAL(65,30) NOT NULL,
    "sgstUsed" DECIMAL(65,30) NOT NULL,
    "igstUsed" DECIMAL(65,30) NOT NULL,
    "cessUsed" DECIMAL(65,30) NOT NULL,
    "igstForCGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstForSGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cashRequired" DECIMAL(65,30) NOT NULL,
    "cashPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cgstBalance" DECIMAL(65,30) NOT NULL,
    "sgstBalance" DECIMAL(65,30) NOT NULL,
    "igstBalance" DECIMAL(65,30) NOT NULL,
    "cessBalance" DECIMAL(65,30) NOT NULL,
    "gstr3bReference" TEXT,
    "challanNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITCUtilization_pkey" PRIMARY KEY ("id")
);

-- Create ITCClaimSummary table
CREATE TABLE "ITCClaimSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimMonth" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "b2bITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "b2baITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rcmITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "importITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isdITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalSGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalIGST" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCESS" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "blockedITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reversedITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reclaimedITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netITCClaimed" DECIMAL(65,30) NOT NULL,
    "gstr3bFiled" BOOLEAN NOT NULL DEFAULT false,
    "filingDate" TIMESTAMP(3),
    "filingReference" TEXT,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "matchPercentage" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITCClaimSummary_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "ITCEligibilityRecord_userId_idx" ON "ITCEligibilityRecord"("userId");
CREATE INDEX "ITCEligibilityRecord_transactionId_idx" ON "ITCEligibilityRecord"("transactionId");
CREATE INDEX "ITCEligibilityRecord_isEligible_idx" ON "ITCEligibilityRecord"("isEligible");
CREATE INDEX "ITCEligibilityRecord_category_idx" ON "ITCEligibilityRecord"("category");

CREATE UNIQUE INDEX "GSTR2BEntry_userId_gstin_invoiceNumber_invoiceDate_key" ON "GSTR2BEntry"("userId", "gstin", "invoiceNumber", "invoiceDate");
CREATE INDEX "GSTR2BEntry_userId_idx" ON "GSTR2BEntry"("userId");
CREATE INDEX "GSTR2BEntry_returnPeriod_idx" ON "GSTR2BEntry"("returnPeriod");
CREATE INDEX "GSTR2BEntry_gstin_idx" ON "GSTR2BEntry"("gstin");
CREATE INDEX "GSTR2BEntry_isMatched_idx" ON "GSTR2BEntry"("isMatched");

CREATE INDEX "ITCCreditLedger_userId_idx" ON "ITCCreditLedger"("userId");
CREATE INDEX "ITCCreditLedger_returnPeriod_idx" ON "ITCCreditLedger"("returnPeriod");
CREATE INDEX "ITCCreditLedger_entryType_idx" ON "ITCCreditLedger"("entryType");
CREATE INDEX "ITCCreditLedger_entryDate_idx" ON "ITCCreditLedger"("entryDate");

CREATE UNIQUE INDEX "ITCReconciliation_userId_period_key" ON "ITCReconciliation"("userId", "period");
CREATE INDEX "ITCReconciliation_userId_idx" ON "ITCReconciliation"("userId");
CREATE INDEX "ITCReconciliation_period_idx" ON "ITCReconciliation"("period");
CREATE INDEX "ITCReconciliation_isReconciled_idx" ON "ITCReconciliation"("isReconciled");

CREATE INDEX "ITCUtilization_userId_idx" ON "ITCUtilization"("userId");
CREATE INDEX "ITCUtilization_returnPeriod_idx" ON "ITCUtilization"("returnPeriod");
CREATE INDEX "ITCUtilization_utilizationDate_idx" ON "ITCUtilization"("utilizationDate");

CREATE UNIQUE INDEX "ITCClaimSummary_userId_claimMonth_key" ON "ITCClaimSummary"("userId", "claimMonth");
CREATE INDEX "ITCClaimSummary_userId_idx" ON "ITCClaimSummary"("userId");
CREATE INDEX "ITCClaimSummary_claimMonth_idx" ON "ITCClaimSummary"("claimMonth");
CREATE INDEX "ITCClaimSummary_financialYear_idx" ON "ITCClaimSummary"("financialYear");

-- Add foreign keys
ALTER TABLE "ITCEligibilityRecord" ADD CONSTRAINT "ITCEligibilityRecord_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GSTR2BEntry" ADD CONSTRAINT "GSTR2BEntry_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ITCCreditLedger" ADD CONSTRAINT "ITCCreditLedger_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ITCReconciliation" ADD CONSTRAINT "ITCReconciliation_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ITCUtilization" ADD CONSTRAINT "ITCUtilization_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ITCClaimSummary" ADD CONSTRAINT "ITCClaimSummary_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;