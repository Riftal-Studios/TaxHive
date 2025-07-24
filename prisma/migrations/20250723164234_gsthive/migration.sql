-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "actualExchangeRate" DECIMAL;
ALTER TABLE "Payment" ADD COLUMN "bankCharges" DECIMAL;
ALTER TABLE "Payment" ADD COLUMN "creditedAmount" DECIMAL;
ALTER TABLE "Payment" ADD COLUMN "fircDate" TIMESTAMP;
ALTER TABLE "Payment" ADD COLUMN "fircDocumentUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN "fircNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN "platformFees" DECIMAL;

-- CreateIndex
CREATE INDEX "Payment_fircNumber_idx" ON "Payment"("fircNumber");
