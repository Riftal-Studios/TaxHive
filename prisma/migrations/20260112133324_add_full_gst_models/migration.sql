-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('INDIAN_UNREGISTERED', 'FOREIGN_SERVICE');

-- CreateEnum
CREATE TYPE "RcmType" AS ENUM ('INDIAN_UNREGISTERED', 'IMPORT_OF_SERVICES');

-- CreateEnum
CREATE TYPE "DocumentSourceType" AS ENUM ('UPWORK', 'TOPTAL', 'CLIENT_INVOICE', 'VENDOR_BILL', 'BANK_STATEMENT', 'SCREENSHOT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentClassification" AS ENUM ('EXPORT_WITH_LUT', 'EXPORT_WITHOUT_LUT', 'DOMESTIC_B2B', 'DOMESTIC_B2C', 'PURCHASE_ITC', 'PURCHASE_RCM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'AUTO_APPROVED', 'REVIEW_RECOMMENDED', 'MANUAL_REQUIRED', 'APPROVED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "FilingType" AS ENUM ('GSTR1', 'GSTR3B');

-- CreateEnum
CREATE TYPE "FilingStatus" AS ENUM ('DRAFT', 'GENERATED', 'IN_REVIEW', 'APPROVED', 'FILED', 'AMENDED');

-- CreateEnum
CREATE TYPE "ITCMatchStatus" AS ENUM ('PENDING', 'MATCHED', 'AMOUNT_MISMATCH', 'NOT_IN_2B', 'IN_2B_ONLY', 'REJECTED', 'MANUALLY_RESOLVED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "foreignAmount" DECIMAL(65,30),
ADD COLUMN     "foreignCurrency" TEXT,
ADD COLUMN     "rcmType" "RcmType";

-- AlterTable
ALTER TABLE "LUT" ADD COLUMN     "previousLutId" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "renewalReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UnregisteredSupplier" ADD COLUMN     "country" TEXT,
ADD COLUMN     "countryName" TEXT,
ADD COLUMN     "supplierType" "SupplierType" NOT NULL DEFAULT 'INDIAN_UNREGISTERED',
ALTER COLUMN "state" DROP NOT NULL,
ALTER COLUMN "stateCode" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DocumentUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "sourceType" "DocumentSourceType" NOT NULL,
    "sourcePlatform" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "processingJobId" TEXT,
    "classification" "DocumentClassification",
    "confidenceScore" DECIMAL(65,30),
    "rawExtractionData" JSONB,
    "extractedData" JSONB,
    "extractedAmount" DECIMAL(65,30),
    "extractedCurrency" TEXT,
    "extractedDate" TIMESTAMP(3),
    "extractedVendorName" TEXT,
    "extractedVendorGstin" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "linkedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GSTFilingPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filingType" "FilingType" NOT NULL,
    "period" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "status" "FilingStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalTaxableValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalIgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalSgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTaxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalItcIgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalItcCgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalItcSgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netTaxPayable" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GSTFilingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilingPlanItem" (
    "id" TEXT NOT NULL,
    "filingPeriodId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3),
    "gstrTable" TEXT NOT NULL,
    "recipientGstin" TEXT,
    "recipientName" TEXT,
    "taxableValue" DECIMAL(65,30) NOT NULL,
    "igstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "confidenceScore" INTEGER NOT NULL DEFAULT 100,
    "flags" JSONB,
    "validationErrors" JSONB,
    "isManuallyAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "adjustmentNotes" TEXT,
    "isIncluded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilingPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GSTR2BUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "returnPeriod" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT,
    "rawJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "errorMessage" TEXT,
    "entriesCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "mismatchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GSTR2BUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GSTR2BEntry" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "vendorGstin" TEXT NOT NULL,
    "vendorName" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "invoiceValue" DECIMAL(65,30) NOT NULL,
    "taxableValue" DECIMAL(65,30) NOT NULL,
    "igst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "supplyType" TEXT,
    "itcAvailability" TEXT,
    "reason" TEXT,
    "matchStatus" "ITCMatchStatus" NOT NULL DEFAULT 'PENDING',
    "matchedInvoiceId" TEXT,
    "matchConfidence" DOUBLE PRECISION,
    "mismatchDetails" JSONB,
    "manuallyResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GSTR2BEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITCLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "returnPeriod" TEXT NOT NULL,
    "rcmIgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rcmCgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rcmSgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "b2bIgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "b2bCgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "b2bSgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "atRiskIgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "atRiskCgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "atRiskSgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netIgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netCgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netSgst" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "accumulatedItc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ITCLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentUpload_linkedInvoiceId_key" ON "DocumentUpload"("linkedInvoiceId");

-- CreateIndex
CREATE INDEX "DocumentUpload_userId_status_reviewStatus_idx" ON "DocumentUpload"("userId", "status", "reviewStatus");

-- CreateIndex
CREATE INDEX "DocumentUpload_sourceType_idx" ON "DocumentUpload"("sourceType");

-- CreateIndex
CREATE INDEX "DocumentUpload_classification_idx" ON "DocumentUpload"("classification");

-- CreateIndex
CREATE INDEX "DocumentUpload_createdAt_idx" ON "DocumentUpload"("createdAt");

-- CreateIndex
CREATE INDEX "GSTFilingPeriod_userId_status_dueDate_idx" ON "GSTFilingPeriod"("userId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "GSTFilingPeriod_fiscalYear_idx" ON "GSTFilingPeriod"("fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "GSTFilingPeriod_userId_filingType_period_key" ON "GSTFilingPeriod"("userId", "filingType", "period");

-- CreateIndex
CREATE INDEX "FilingPlanItem_filingPeriodId_gstrTable_idx" ON "FilingPlanItem"("filingPeriodId", "gstrTable");

-- CreateIndex
CREATE INDEX "FilingPlanItem_invoiceId_idx" ON "FilingPlanItem"("invoiceId");

-- CreateIndex
CREATE INDEX "GSTR2BUpload_userId_idx" ON "GSTR2BUpload"("userId");

-- CreateIndex
CREATE INDEX "GSTR2BUpload_returnPeriod_idx" ON "GSTR2BUpload"("returnPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "GSTR2BUpload_userId_returnPeriod_key" ON "GSTR2BUpload"("userId", "returnPeriod");

-- CreateIndex
CREATE INDEX "GSTR2BEntry_uploadId_matchStatus_idx" ON "GSTR2BEntry"("uploadId", "matchStatus");

-- CreateIndex
CREATE INDEX "GSTR2BEntry_vendorGstin_invoiceNumber_idx" ON "GSTR2BEntry"("vendorGstin", "invoiceNumber");

-- CreateIndex
CREATE INDEX "GSTR2BEntry_matchedInvoiceId_idx" ON "GSTR2BEntry"("matchedInvoiceId");

-- CreateIndex
CREATE INDEX "ITCLedger_userId_idx" ON "ITCLedger"("userId");

-- CreateIndex
CREATE INDEX "ITCLedger_returnPeriod_idx" ON "ITCLedger"("returnPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "ITCLedger_userId_returnPeriod_key" ON "ITCLedger"("userId", "returnPeriod");

-- CreateIndex
CREATE INDEX "Invoice_rcmType_idx" ON "Invoice"("rcmType");

-- CreateIndex
CREATE INDEX "LUT_validTill_idx" ON "LUT"("validTill");

-- CreateIndex
CREATE INDEX "UnregisteredSupplier_supplierType_idx" ON "UnregisteredSupplier"("supplierType");

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_linkedInvoiceId_fkey" FOREIGN KEY ("linkedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GSTFilingPeriod" ADD CONSTRAINT "GSTFilingPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingPlanItem" ADD CONSTRAINT "FilingPlanItem_filingPeriodId_fkey" FOREIGN KEY ("filingPeriodId") REFERENCES "GSTFilingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingPlanItem" ADD CONSTRAINT "FilingPlanItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GSTR2BUpload" ADD CONSTRAINT "GSTR2BUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GSTR2BEntry" ADD CONSTRAINT "GSTR2BEntry_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "GSTR2BUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GSTR2BEntry" ADD CONSTRAINT "GSTR2BEntry_matchedInvoiceId_fkey" FOREIGN KEY ("matchedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITCLedger" ADD CONSTRAINT "ITCLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
