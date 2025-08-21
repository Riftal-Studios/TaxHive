-- AlterTable
ALTER TABLE "RCMTransaction" ADD COLUMN     "selfInvoiceDueDate" TIMESTAMP(3),
ADD COLUMN     "selfInvoiceStatus" TEXT DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "RCMPaymentLiability" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "rcmTransactionId" TEXT,
    "vendorName" TEXT,
    "vendorGSTIN" TEXT,
    "serviceDescription" TEXT,
    "hsnSacCode" TEXT,
    "rcmType" TEXT NOT NULL,
    "taxableAmount" DECIMAL(65,30) NOT NULL,
    "totalGST" DECIMAL(65,30) NOT NULL,
    "cgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paidDate" TIMESTAMP(3),
    "interestAmount" DECIMAL(65,30) DEFAULT 0,
    "penaltyAmount" DECIMAL(65,30) DEFAULT 0,
    "itcEligible" BOOLEAN NOT NULL DEFAULT true,
    "itcCategory" TEXT,
    "itcIneligibleReason" TEXT,
    "itcClaimed" BOOLEAN NOT NULL DEFAULT false,
    "itcClaimDate" TIMESTAMP(3),
    "returnPeriod" TEXT,
    "includedInGSTR3B" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RCMPaymentLiability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RCMPayment" (
    "id" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "includesInterest" BOOLEAN NOT NULL DEFAULT false,
    "interestAmount" DECIMAL(65,30) DEFAULT 0,
    "includesPenalty" BOOLEAN NOT NULL DEFAULT false,
    "penaltyAmount" DECIMAL(65,30) DEFAULT 0,
    "challanNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RCMPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GSTR3BFiling" (
    "id" TEXT NOT NULL,
    "returnPeriod" TEXT NOT NULL,
    "filingType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" TEXT,
    "gstin" TEXT NOT NULL,
    "filingStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "filedDate" TIMESTAMP(3),
    "arn" TEXT,
    "table31d_taxableValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table31d_igst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table31d_cgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table31d_sgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table31d_cess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_inputs_igst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_inputs_cgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_inputs_sgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_inputs_cess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_inputServices_igst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_inputServices_cgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_inputServices_sgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_inputServices_cess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_capitalGoods_igst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_capitalGoods_cgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_capitalGoods_sgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "table4B_capitalGoods_cess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalRCMTax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalRCMITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "jsonData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GSTR3BFiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceScore" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "overallScore" DECIMAL(65,30) NOT NULL,
    "paymentScore" DECIMAL(65,30) NOT NULL,
    "filingScore" DECIMAL(65,30) NOT NULL,
    "documentationScore" DECIMAL(65,30) NOT NULL,
    "rating" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "paidOnTime" INTEGER NOT NULL DEFAULT 0,
    "paidLate" INTEGER NOT NULL DEFAULT 0,
    "unpaid" INTEGER NOT NULL DEFAULT 0,
    "returnsFiledOnTime" INTEGER NOT NULL DEFAULT 0,
    "returnsFiledLate" INTEGER NOT NULL DEFAULT 0,
    "documentationComplete" INTEGER NOT NULL DEFAULT 0,
    "documentationPending" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ComplianceScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "relatedEntityId" TEXT,
    "relatedEntityType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ComplianceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RCMSelfInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "rcmTransactionId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierAddress" TEXT NOT NULL,
    "supplierState" TEXT NOT NULL,
    "supplierStateCode" TEXT NOT NULL,
    "supplierGSTIN" TEXT,
    "supplierPAN" TEXT,
    "recipientGSTIN" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientAddress" TEXT NOT NULL,
    "recipientState" TEXT NOT NULL,
    "recipientStateCode" TEXT NOT NULL,
    "placeOfSupply" TEXT NOT NULL,
    "supplyType" TEXT NOT NULL,
    "rcmType" TEXT NOT NULL,
    "originalInvoiceNo" TEXT,
    "originalInvoiceDate" TIMESTAMP(3),
    "goodsReceiptDate" TIMESTAMP(3) NOT NULL,
    "serviceReceiptDate" TIMESTAMP(3),
    "taxableAmount" DECIMAL(15,2) NOT NULL,
    "cgstRate" DECIMAL(5,2),
    "cgstAmount" DECIMAL(15,2),
    "sgstRate" DECIMAL(5,2),
    "sgstAmount" DECIMAL(15,2),
    "igstRate" DECIMAL(5,2),
    "igstAmount" DECIMAL(15,2),
    "cessRate" DECIMAL(5,2),
    "cessAmount" DECIMAL(15,2),
    "totalTaxAmount" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "issuedWithinTime" BOOLEAN NOT NULL,
    "daysDelayed" INTEGER,
    "gstr1Period" TEXT,
    "includedInGSTR1" BOOLEAN NOT NULL DEFAULT false,
    "gstr3bPeriod" TEXT,
    "includedInGSTR3B" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RCMSelfInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RCMSelfInvoiceItem" (
    "id" TEXT NOT NULL,
    "selfInvoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsnSacCode" TEXT NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "RCMSelfInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RCMPaymentLiability_transactionId_key" ON "RCMPaymentLiability"("transactionId");

-- CreateIndex
CREATE INDEX "RCMPaymentLiability_userId_idx" ON "RCMPaymentLiability"("userId");

-- CreateIndex
CREATE INDEX "RCMPaymentLiability_status_idx" ON "RCMPaymentLiability"("status");

-- CreateIndex
CREATE INDEX "RCMPaymentLiability_dueDate_idx" ON "RCMPaymentLiability"("dueDate");

-- CreateIndex
CREATE INDEX "RCMPaymentLiability_returnPeriod_idx" ON "RCMPaymentLiability"("returnPeriod");

-- CreateIndex
CREATE INDEX "RCMPaymentLiability_rcmType_idx" ON "RCMPaymentLiability"("rcmType");

-- CreateIndex
CREATE INDEX "RCMPayment_liabilityId_idx" ON "RCMPayment"("liabilityId");

-- CreateIndex
CREATE INDEX "RCMPayment_userId_idx" ON "RCMPayment"("userId");

-- CreateIndex
CREATE INDEX "RCMPayment_paymentDate_idx" ON "RCMPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "GSTR3BFiling_userId_idx" ON "GSTR3BFiling"("userId");

-- CreateIndex
CREATE INDEX "GSTR3BFiling_returnPeriod_idx" ON "GSTR3BFiling"("returnPeriod");

-- CreateIndex
CREATE INDEX "GSTR3BFiling_filingStatus_idx" ON "GSTR3BFiling"("filingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "GSTR3BFiling_userId_returnPeriod_key" ON "GSTR3BFiling"("userId", "returnPeriod");

-- CreateIndex
CREATE INDEX "ComplianceScore_userId_idx" ON "ComplianceScore"("userId");

-- CreateIndex
CREATE INDEX "ComplianceScore_period_idx" ON "ComplianceScore"("period");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceScore_userId_period_key" ON "ComplianceScore"("userId", "period");

-- CreateIndex
CREATE INDEX "ComplianceAlert_userId_idx" ON "ComplianceAlert"("userId");

-- CreateIndex
CREATE INDEX "ComplianceAlert_type_idx" ON "ComplianceAlert"("type");

-- CreateIndex
CREATE INDEX "ComplianceAlert_priority_idx" ON "ComplianceAlert"("priority");

-- CreateIndex
CREATE INDEX "ComplianceAlert_isResolved_idx" ON "ComplianceAlert"("isResolved");

-- CreateIndex
CREATE UNIQUE INDEX "RCMSelfInvoice_invoiceNumber_key" ON "RCMSelfInvoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RCMSelfInvoice_rcmTransactionId_key" ON "RCMSelfInvoice"("rcmTransactionId");

-- CreateIndex
CREATE INDEX "RCMSelfInvoice_userId_idx" ON "RCMSelfInvoice"("userId");

-- CreateIndex
CREATE INDEX "RCMSelfInvoice_invoiceDate_idx" ON "RCMSelfInvoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "RCMSelfInvoice_goodsReceiptDate_idx" ON "RCMSelfInvoice"("goodsReceiptDate");

-- CreateIndex
CREATE INDEX "RCMSelfInvoice_status_idx" ON "RCMSelfInvoice"("status");

-- CreateIndex
CREATE INDEX "RCMSelfInvoice_gstr1Period_idx" ON "RCMSelfInvoice"("gstr1Period");

-- CreateIndex
CREATE INDEX "RCMSelfInvoice_issuedWithinTime_idx" ON "RCMSelfInvoice"("issuedWithinTime");

-- CreateIndex
CREATE INDEX "RCMSelfInvoiceItem_selfInvoiceId_idx" ON "RCMSelfInvoiceItem"("selfInvoiceId");

-- CreateIndex
CREATE INDEX "RCMTransaction_selfInvoiceStatus_idx" ON "RCMTransaction"("selfInvoiceStatus");

-- AddForeignKey
ALTER TABLE "RCMPaymentLiability" ADD CONSTRAINT "RCMPaymentLiability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCMPaymentLiability" ADD CONSTRAINT "RCMPaymentLiability_rcmTransactionId_fkey" FOREIGN KEY ("rcmTransactionId") REFERENCES "RCMTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCMPayment" ADD CONSTRAINT "RCMPayment_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "RCMPaymentLiability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCMPayment" ADD CONSTRAINT "RCMPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GSTR3BFiling" ADD CONSTRAINT "GSTR3BFiling_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceScore" ADD CONSTRAINT "ComplianceScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAlert" ADD CONSTRAINT "ComplianceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCMSelfInvoice" ADD CONSTRAINT "RCMSelfInvoice_rcmTransactionId_fkey" FOREIGN KEY ("rcmTransactionId") REFERENCES "RCMTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCMSelfInvoice" ADD CONSTRAINT "RCMSelfInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCMSelfInvoiceItem" ADD CONSTRAINT "RCMSelfInvoiceItem_selfInvoiceId_fkey" FOREIGN KEY ("selfInvoiceId") REFERENCES "RCMSelfInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
