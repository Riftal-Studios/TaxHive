-- CreateTable
CREATE TABLE "RCMITCClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rcmTransactionId" TEXT NOT NULL,
    "selfInvoiceId" TEXT,
    "claimNumber" TEXT NOT NULL,
    "claimDate" TIMESTAMP(3) NOT NULL,
    "financialYear" TEXT NOT NULL,
    "taxPeriod" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cgstAmount" DECIMAL(15,2) NOT NULL,
    "sgstAmount" DECIMAL(15,2) NOT NULL,
    "igstAmount" DECIMAL(15,2) NOT NULL,
    "cessAmount" DECIMAL(15,2) NOT NULL,
    "totalITCAmount" DECIMAL(15,2) NOT NULL,
    "utilizedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balanceAmount" DECIMAL(15,2) NOT NULL,
    "eligibilityStatus" TEXT NOT NULL,
    "ineligibilityReason" TEXT,
    "blockedCreditSection" TEXT,
    "selfInvoiceDate" TIMESTAMP(3) NOT NULL,
    "deadlineDate" TIMESTAMP(3) NOT NULL,
    "daysRemaining" INTEGER,
    "warningLevel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "claimedInReturn" TEXT,
    "reversalDate" TIMESTAMP(3),
    "reversalReason" TEXT,
    "businessPurpose" TEXT NOT NULL,
    "supportingDocs" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RCMITCClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITCBlockedCategory" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "keywords" TEXT[],
    "hsnCodes" TEXT[],
    "sacCodes" TEXT[],
    "exceptions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notificationRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITCBlockedCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RCMITCClaim_claimNumber_key" ON "RCMITCClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "RCMITCClaim_userId_idx" ON "RCMITCClaim"("userId");

-- CreateIndex
CREATE INDEX "RCMITCClaim_rcmTransactionId_idx" ON "RCMITCClaim"("rcmTransactionId");

-- CreateIndex
CREATE INDEX "RCMITCClaim_selfInvoiceId_idx" ON "RCMITCClaim"("selfInvoiceId");

-- CreateIndex
CREATE INDEX "RCMITCClaim_status_idx" ON "RCMITCClaim"("status");

-- CreateIndex
CREATE INDEX "RCMITCClaim_financialYear_taxPeriod_idx" ON "RCMITCClaim"("financialYear", "taxPeriod");

-- CreateIndex
CREATE INDEX "RCMITCClaim_deadlineDate_idx" ON "RCMITCClaim"("deadlineDate");

-- CreateIndex
CREATE INDEX "ITCBlockedCategory_isActive_idx" ON "ITCBlockedCategory"("isActive");

-- CreateIndex
CREATE INDEX "ITCBlockedCategory_section_idx" ON "ITCBlockedCategory"("section");

-- AddForeignKey
ALTER TABLE "RCMITCClaim" ADD CONSTRAINT "RCMITCClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCMITCClaim" ADD CONSTRAINT "RCMITCClaim_rcmTransactionId_fkey" FOREIGN KEY ("rcmTransactionId") REFERENCES "RCMTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCMITCClaim" ADD CONSTRAINT "RCMITCClaim_selfInvoiceId_fkey" FOREIGN KEY ("selfInvoiceId") REFERENCES "RCMSelfInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
