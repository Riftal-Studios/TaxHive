-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('EXPORT', 'SELF_INVOICE');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'OTHER');

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_clientId_fkey";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "cgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "cgstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "dateOfReceiptOfSupply" TIMESTAMP(3),
ADD COLUMN     "invoiceType" "InvoiceType" NOT NULL DEFAULT 'EXPORT',
ADD COLUMN     "isRCM" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itcClaimable" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "rcmLiability" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "sgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "sgstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "unregisteredSupplierId" TEXT,
ALTER COLUMN "clientId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "UnregisteredSupplier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "pan" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnregisteredSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentVoucher" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "voucherDate" TIMESTAMP(3) NOT NULL,
    "selfInvoiceId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierAddress" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "paymentReference" TEXT,
    "notes" TEXT,
    "pdfUrl" TEXT,
    "pdfStatus" TEXT NOT NULL DEFAULT 'pending',
    "pdfError" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnregisteredSupplier_userId_idx" ON "UnregisteredSupplier"("userId");

-- CreateIndex
CREATE INDEX "UnregisteredSupplier_isActive_idx" ON "UnregisteredSupplier"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentVoucher_voucherNumber_key" ON "PaymentVoucher"("voucherNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentVoucher_selfInvoiceId_key" ON "PaymentVoucher"("selfInvoiceId");

-- CreateIndex
CREATE INDEX "PaymentVoucher_userId_idx" ON "PaymentVoucher"("userId");

-- CreateIndex
CREATE INDEX "PaymentVoucher_voucherDate_idx" ON "PaymentVoucher"("voucherDate");

-- CreateIndex
CREATE INDEX "Invoice_invoiceType_idx" ON "Invoice"("invoiceType");

-- CreateIndex
CREATE INDEX "Invoice_unregisteredSupplierId_idx" ON "Invoice"("unregisteredSupplierId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_unregisteredSupplierId_fkey" FOREIGN KEY ("unregisteredSupplierId") REFERENCES "UnregisteredSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnregisteredSupplier" ADD CONSTRAINT "UnregisteredSupplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVoucher" ADD CONSTRAINT "PaymentVoucher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVoucher" ADD CONSTRAINT "PaymentVoucher_selfInvoiceId_fkey" FOREIGN KEY ("selfInvoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
