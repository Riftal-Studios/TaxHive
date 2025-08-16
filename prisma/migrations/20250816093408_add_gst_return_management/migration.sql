-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "stateCode" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "portCode" TEXT,
ADD COLUMN     "shippingBillDate" TIMESTAMP(3),
ADD COLUMN     "shippingBillNo" TEXT;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "uqc" TEXT;

-- CreateTable
CREATE TABLE "GSTReturn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "returnType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "filingStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "filingDate" TIMESTAMP(3),
    "arn" TEXT,
    "b2bInvoices" JSONB,
    "b2cInvoices" JSONB,
    "b2csInvoices" JSONB,
    "exportInvoices" JSONB,
    "creditNotes" JSONB,
    "debitNotes" JSONB,
    "hsnSummary" JSONB,
    "outputTax" DECIMAL(65,30),
    "inputTaxClaim" DECIMAL(65,30),
    "netTaxPayable" DECIMAL(65,30),
    "lateFee" DECIMAL(65,30),
    "interest" DECIMAL(65,30),
    "jsonOutput" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GSTReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "address" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "isRegistered" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "placeOfSupply" TEXT NOT NULL,
    "taxableAmount" DECIMAL(65,30) NOT NULL,
    "cgstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cessAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalGSTAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "itcEligible" BOOLEAN NOT NULL DEFAULT true,
    "itcCategory" TEXT NOT NULL DEFAULT 'INPUTS',
    "itcClaimed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "itcReversed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reversalReason" TEXT,
    "gstr2aMatched" BOOLEAN NOT NULL DEFAULT false,
    "matchStatus" TEXT NOT NULL DEFAULT 'NOT_AVAILABLE',
    "gstr2bReference" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLineItem" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsnSacCode" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "gstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GSTReturn_userId_idx" ON "GSTReturn"("userId");

-- CreateIndex
CREATE INDEX "GSTReturn_returnType_idx" ON "GSTReturn"("returnType");

-- CreateIndex
CREATE INDEX "GSTReturn_period_idx" ON "GSTReturn"("period");

-- CreateIndex
CREATE INDEX "GSTReturn_filingStatus_idx" ON "GSTReturn"("filingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "GSTReturn_userId_returnType_period_key" ON "GSTReturn"("userId", "returnType", "period");

-- CreateIndex
CREATE INDEX "Vendor_userId_idx" ON "Vendor"("userId");

-- CreateIndex
CREATE INDEX "Vendor_gstin_idx" ON "Vendor"("gstin");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_userId_idx" ON "PurchaseInvoice"("userId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_vendorId_idx" ON "PurchaseInvoice"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_invoiceDate_idx" ON "PurchaseInvoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_matchStatus_idx" ON "PurchaseInvoice"("matchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_userId_vendorId_invoiceNumber_key" ON "PurchaseInvoice"("userId", "vendorId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "PurchaseLineItem_purchaseInvoiceId_idx" ON "PurchaseLineItem"("purchaseInvoiceId");

-- AddForeignKey
ALTER TABLE "GSTReturn" ADD CONSTRAINT "GSTReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLineItem" ADD CONSTRAINT "PurchaseLineItem_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
