/*
  Warnings:

  - You are about to drop the column `b2cInvoices` on the `GSTReturn` table. All the data in the column will be lost.
  - You are about to drop the column `b2csInvoices` on the `GSTReturn` table. All the data in the column will be lost.
  - You are about to drop the column `inputTaxClaim` on the `GSTReturn` table. All the data in the column will be lost.
  - You are about to drop the column `netTaxPayable` on the `GSTReturn` table. All the data in the column will be lost.
  - You are about to drop the column `outputTax` on the `GSTReturn` table. All the data in the column will be lost.
  - Added the required column `financialYear` to the `GSTReturn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GSTReturn" DROP COLUMN "b2cInvoices",
DROP COLUMN "b2csInvoices",
DROP COLUMN "inputTaxClaim",
DROP COLUMN "netTaxPayable",
DROP COLUMN "outputTax",
ADD COLUMN     "adjustments" JSONB,
ADD COLUMN     "advances" JSONB,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "b2cLargeInvoices" JSONB,
ADD COLUMN     "b2cSmallInvoices" JSONB,
ADD COLUMN     "cessLiability" DECIMAL(65,30),
ADD COLUMN     "cessPaid" DECIMAL(65,30),
ADD COLUMN     "cgstLiability" DECIMAL(65,30),
ADD COLUMN     "cgstPaid" DECIMAL(65,30),
ADD COLUMN     "docSummary" JSONB,
ADD COLUMN     "filingMode" TEXT,
ADD COLUMN     "financialYear" TEXT NOT NULL,
ADD COLUMN     "igstLiability" DECIMAL(65,30),
ADD COLUMN     "igstPaid" DECIMAL(65,30),
ADD COLUMN     "inwardReverseCharge" DECIMAL(65,30),
ADD COLUMN     "itcImportGoods" DECIMAL(65,30),
ADD COLUMN     "itcImportServices" DECIMAL(65,30),
ADD COLUMN     "itcIneligible" DECIMAL(65,30),
ADD COLUMN     "itcInwardISD" DECIMAL(65,30),
ADD COLUMN     "itcInwardSupplies" DECIMAL(65,30),
ADD COLUMN     "itcNet" DECIMAL(65,30),
ADD COLUMN     "itcOther" DECIMAL(65,30),
ADD COLUMN     "itcReversed" DECIMAL(65,30),
ADD COLUMN     "matchedInvoices" INTEGER,
ADD COLUMN     "mismatchedInvoices" INTEGER,
ADD COLUMN     "month" INTEGER,
ADD COLUMN     "nilRated" JSONB,
ADD COLUMN     "outwardExempted" DECIMAL(65,30),
ADD COLUMN     "outwardNonGst" DECIMAL(65,30),
ADD COLUMN     "outwardTaxable" DECIMAL(65,30),
ADD COLUMN     "outwardZeroRated" DECIMAL(65,30),
ADD COLUMN     "penalty" DECIMAL(65,30),
ADD COLUMN     "pendingInvoices" INTEGER,
ADD COLUMN     "preparedAt" TIMESTAMP(3),
ADD COLUMN     "preparedBy" TEXT,
ADD COLUMN     "quarter" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "sgstLiability" DECIMAL(65,30),
ADD COLUMN     "sgstPaid" DECIMAL(65,30),
ADD COLUMN     "totalTaxLiability" DECIMAL(65,30),
ADD COLUMN     "totalTaxPaid" DECIMAL(65,30),
ADD COLUMN     "validationErrors" JSONB,
ALTER COLUMN "jsonOutput" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GSTReconciliation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "reconciliationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "matchedRecords" INTEGER NOT NULL DEFAULT 0,
    "mismatchedRecords" INTEGER NOT NULL DEFAULT 0,
    "missingInPortal" INTEGER NOT NULL DEFAULT 0,
    "missingInSystem" INTEGER NOT NULL DEFAULT 0,
    "mismatchDetails" JSONB,
    "actionsRequired" JSONB,
    "actionsTaken" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GSTReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GSTReconciliation_userId_idx" ON "GSTReconciliation"("userId");

-- CreateIndex
CREATE INDEX "GSTReconciliation_period_idx" ON "GSTReconciliation"("period");

-- CreateIndex
CREATE INDEX "GSTReconciliation_status_idx" ON "GSTReconciliation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GSTReconciliation_userId_period_reconciliationType_key" ON "GSTReconciliation"("userId", "period", "reconciliationType");

-- CreateIndex
CREATE INDEX "GSTReturn_financialYear_idx" ON "GSTReturn"("financialYear");

-- AddForeignKey
ALTER TABLE "GSTReconciliation" ADD CONSTRAINT "GSTReconciliation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
