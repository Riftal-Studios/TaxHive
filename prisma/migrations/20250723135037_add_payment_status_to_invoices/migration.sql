-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "Invoice" ADD COLUMN "amountPaid" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "balanceDue" DECIMAL NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");