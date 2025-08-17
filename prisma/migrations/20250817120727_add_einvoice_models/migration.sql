-- CreateTable
CREATE TABLE "EInvoiceConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gspProvider" TEXT NOT NULL,
    "gspUrl" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "clientId" TEXT,
    "clientSecret" TEXT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "autoGenerate" BOOLEAN NOT NULL DEFAULT false,
    "autoCancel" BOOLEAN NOT NULL DEFAULT false,
    "cancelWithin" INTEGER NOT NULL DEFAULT 24,
    "includeQRCode" BOOLEAN NOT NULL DEFAULT true,
    "bulkGeneration" BOOLEAN NOT NULL DEFAULT false,
    "ewayBillEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ewayBillThreshold" DECIMAL(65,30) NOT NULL DEFAULT 50000,
    "transportMode" TEXT,
    "transporterId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoiceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoiceAuthToken" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "sessionKey" TEXT,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'IRP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoiceAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "irn" TEXT,
    "ackNo" TEXT,
    "ackDate" TIMESTAMP(3),
    "signedQRCode" TEXT,
    "qrCodeUrl" TEXT,
    "docType" TEXT NOT NULL,
    "docNo" TEXT NOT NULL,
    "docDate" TIMESTAMP(3) NOT NULL,
    "supplyType" TEXT NOT NULL,
    "sellerGstin" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "buyerGstin" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "buyerStateCode" TEXT NOT NULL,
    "totalValue" DECIMAL(65,30) NOT NULL,
    "totalGstValue" DECIMAL(65,30) NOT NULL,
    "totalInvoiceValue" DECIMAL(65,30) NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancelRemarks" TEXT,
    "cancelIRN" TEXT,
    "ewayBillNo" TEXT,
    "ewayBillDate" TIMESTAMP(3),
    "ewayBillValidTill" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EWayBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eInvoiceId" TEXT,
    "ewayBillNo" TEXT NOT NULL,
    "ewayBillDate" TIMESTAMP(3) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "docType" TEXT NOT NULL,
    "docNo" TEXT NOT NULL,
    "docDate" TIMESTAMP(3) NOT NULL,
    "supplyType" TEXT NOT NULL,
    "subSupplyType" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "transportMode" TEXT NOT NULL,
    "transporterId" TEXT,
    "transporterName" TEXT,
    "transportDocNo" TEXT,
    "transportDocDate" TIMESTAMP(3),
    "vehicleNo" TEXT,
    "vehicleType" TEXT,
    "fromGstin" TEXT,
    "fromTradeName" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromPlace" TEXT NOT NULL,
    "fromPincode" TEXT NOT NULL,
    "fromStateCode" TEXT NOT NULL,
    "toGstin" TEXT,
    "toTradeName" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "toPlace" TEXT NOT NULL,
    "toPincode" TEXT NOT NULL,
    "toStateCode" TEXT NOT NULL,
    "distance" INTEGER NOT NULL,
    "totalValue" DECIMAL(65,30) NOT NULL,
    "totalGstValue" DECIMAL(65,30) NOT NULL,
    "cessValue" DECIMAL(65,30),
    "cessNonAdvolValue" DECIMAL(65,30),
    "otherValue" DECIMAL(65,30),
    "totalInvoiceValue" DECIMAL(65,30) NOT NULL,
    "mainHsnCode" TEXT NOT NULL,
    "itemList" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancelRemarks" TEXT,
    "partBUpdates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EWayBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EInvoiceConfig_userId_key" ON "EInvoiceConfig"("userId");

-- CreateIndex
CREATE INDEX "EInvoiceConfig_userId_idx" ON "EInvoiceConfig"("userId");

-- CreateIndex
CREATE INDEX "EInvoiceConfig_gstin_idx" ON "EInvoiceConfig"("gstin");

-- CreateIndex
CREATE INDEX "EInvoiceAuthToken_configId_idx" ON "EInvoiceAuthToken"("configId");

-- CreateIndex
CREATE INDEX "EInvoiceAuthToken_tokenExpiry_idx" ON "EInvoiceAuthToken"("tokenExpiry");

-- CreateIndex
CREATE INDEX "EInvoiceAuthToken_isActive_idx" ON "EInvoiceAuthToken"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoice_invoiceId_key" ON "EInvoice"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoice_irn_key" ON "EInvoice"("irn");

-- CreateIndex
CREATE INDEX "EInvoice_userId_idx" ON "EInvoice"("userId");

-- CreateIndex
CREATE INDEX "EInvoice_invoiceId_idx" ON "EInvoice"("invoiceId");

-- CreateIndex
CREATE INDEX "EInvoice_irn_idx" ON "EInvoice"("irn");

-- CreateIndex
CREATE INDEX "EInvoice_status_idx" ON "EInvoice"("status");

-- CreateIndex
CREATE INDEX "EInvoice_docDate_idx" ON "EInvoice"("docDate");

-- CreateIndex
CREATE INDEX "EInvoice_ackDate_idx" ON "EInvoice"("ackDate");

-- CreateIndex
CREATE UNIQUE INDEX "EWayBill_ewayBillNo_key" ON "EWayBill"("ewayBillNo");

-- CreateIndex
CREATE INDEX "EWayBill_userId_idx" ON "EWayBill"("userId");

-- CreateIndex
CREATE INDEX "EWayBill_ewayBillNo_idx" ON "EWayBill"("ewayBillNo");

-- CreateIndex
CREATE INDEX "EWayBill_status_idx" ON "EWayBill"("status");

-- CreateIndex
CREATE INDEX "EWayBill_validUntil_idx" ON "EWayBill"("validUntil");

-- CreateIndex
CREATE INDEX "EWayBill_docNo_idx" ON "EWayBill"("docNo");

-- AddForeignKey
ALTER TABLE "EInvoiceConfig" ADD CONSTRAINT "EInvoiceConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoiceAuthToken" ADD CONSTRAINT "EInvoiceAuthToken_configId_fkey" FOREIGN KEY ("configId") REFERENCES "EInvoiceConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWayBill" ADD CONSTRAINT "EWayBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
