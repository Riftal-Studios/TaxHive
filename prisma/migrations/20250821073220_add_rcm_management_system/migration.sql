-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "rcmApplicable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RCMTransaction" (
    "id" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT,
    "vendorId" TEXT,
    "vendorName" TEXT NOT NULL,
    "vendorGSTIN" TEXT,
    "vendorCountry" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "hsnSacCode" TEXT NOT NULL,
    "taxableAmount" DECIMAL(65,30) NOT NULL,
    "cgstAmount" DECIMAL(65,30),
    "sgstAmount" DECIMAL(65,30),
    "igstAmount" DECIMAL(65,30),
    "cessAmount" DECIMAL(65,30),
    "totalTaxAmount" DECIMAL(65,30) NOT NULL,
    "foreignCurrency" TEXT,
    "exchangeRate" DECIMAL(65,30),
    "foreignAmount" DECIMAL(65,30),
    "taxPaymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentDueDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "challanNumber" TEXT,
    "itcEligible" BOOLEAN NOT NULL DEFAULT true,
    "itcClaimed" BOOLEAN NOT NULL DEFAULT false,
    "itcClaimDate" TIMESTAMP(3),
    "itcAmount" DECIMAL(65,30),
    "returnPeriod" TEXT NOT NULL,
    "includedInReturn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RCMTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForeignSupplier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "isKnownSupplier" BOOLEAN NOT NULL DEFAULT false,
    "supplierCode" TEXT,
    "defaultHSN" TEXT,
    "defaultGSTRate" DECIMAL(65,30) NOT NULL DEFAULT 18,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "supportedCurrencies" TEXT[] DEFAULT ARRAY['USD']::TEXT[],
    "serviceCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "billingCountry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForeignSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RCMTransaction_userId_idx" ON "RCMTransaction"("userId");

-- CreateIndex
CREATE INDEX "RCMTransaction_taxPaymentStatus_idx" ON "RCMTransaction"("taxPaymentStatus");

-- CreateIndex
CREATE INDEX "RCMTransaction_paymentDueDate_idx" ON "RCMTransaction"("paymentDueDate");

-- CreateIndex
CREATE INDEX "RCMTransaction_returnPeriod_idx" ON "RCMTransaction"("returnPeriod");

-- CreateIndex
CREATE INDEX "RCMTransaction_transactionType_idx" ON "RCMTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "ForeignSupplier_supplierCode_idx" ON "ForeignSupplier"("supplierCode");

-- CreateIndex
CREATE INDEX "ForeignSupplier_isKnownSupplier_idx" ON "ForeignSupplier"("isKnownSupplier");

-- CreateIndex
CREATE INDEX "ForeignSupplier_serviceType_idx" ON "ForeignSupplier"("serviceType");

-- CreateIndex
CREATE INDEX "ForeignSupplier_country_idx" ON "ForeignSupplier"("country");

-- CreateIndex
CREATE UNIQUE INDEX "ForeignSupplier_userId_name_country_key" ON "ForeignSupplier"("userId", "name", "country");

-- AddForeignKey
ALTER TABLE "RCMTransaction" ADD CONSTRAINT "RCMTransaction_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCMTransaction" ADD CONSTRAINT "RCMTransaction_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCMTransaction" ADD CONSTRAINT "RCMTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignSupplier" ADD CONSTRAINT "ForeignSupplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
