-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "advanceAdjusted" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AdvanceReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "exchangeRate" DECIMAL(65,30) NOT NULL,
    "amountINR" DECIMAL(65,30) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "bankReference" TEXT,
    "bankName" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" TIMESTAMP(3),
    "isGSTApplicable" BOOLEAN NOT NULL DEFAULT false,
    "gstRate" DECIMAL(65,30),
    "cgstAmount" DECIMAL(65,30),
    "sgstAmount" DECIMAL(65,30),
    "igstAmount" DECIMAL(65,30),
    "adjustedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unadjustedAmount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL,
    "receiptPDF" TEXT,
    "acknowledgment" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvanceReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceAdjustment" (
    "id" TEXT NOT NULL,
    "advanceReceiptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "adjustmentDate" TIMESTAMP(3) NOT NULL,
    "adjustedAmount" DECIMAL(65,30) NOT NULL,
    "gstAdjusted" DECIMAL(65,30),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvanceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceRefund" (
    "id" TEXT NOT NULL,
    "advanceReceiptId" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL,
    "refundAmount" DECIMAL(65,30) NOT NULL,
    "refundMode" TEXT NOT NULL,
    "bankReference" TEXT,
    "gstRefunded" DECIMAL(65,30),
    "reason" TEXT NOT NULL,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvanceRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvanceReceipt_clientId_idx" ON "AdvanceReceipt"("clientId");

-- CreateIndex
CREATE INDEX "AdvanceReceipt_status_idx" ON "AdvanceReceipt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceReceipt_userId_receiptNumber_key" ON "AdvanceReceipt"("userId", "receiptNumber");

-- CreateIndex
CREATE INDEX "AdvanceAdjustment_advanceReceiptId_idx" ON "AdvanceAdjustment"("advanceReceiptId");

-- CreateIndex
CREATE INDEX "AdvanceAdjustment_invoiceId_idx" ON "AdvanceAdjustment"("invoiceId");

-- CreateIndex
CREATE INDEX "AdvanceRefund_advanceReceiptId_idx" ON "AdvanceRefund"("advanceReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceRefund_refundNumber_key" ON "AdvanceRefund"("refundNumber");

-- AddForeignKey
ALTER TABLE "AdvanceReceipt" ADD CONSTRAINT "AdvanceReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceReceipt" ADD CONSTRAINT "AdvanceReceipt_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceAdjustment" ADD CONSTRAINT "AdvanceAdjustment_advanceReceiptId_fkey" FOREIGN KEY ("advanceReceiptId") REFERENCES "AdvanceReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceAdjustment" ADD CONSTRAINT "AdvanceAdjustment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceRefund" ADD CONSTRAINT "AdvanceRefund_advanceReceiptId_fkey" FOREIGN KEY ("advanceReceiptId") REFERENCES "AdvanceReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
