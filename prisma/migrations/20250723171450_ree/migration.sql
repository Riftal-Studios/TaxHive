/*
  Warnings:

  - You are about to drop the column `bankCharges` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `platformFees` on the `Payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "bankCharges";
ALTER TABLE "Payment" DROP COLUMN "platformFees";
ALTER TABLE "Payment" ADD COLUMN "amountReceivedBeforeFees" DECIMAL;
ALTER TABLE "Payment" ADD COLUMN "platformFeesInCurrency" DECIMAL;
ALTER TABLE "Payment" ADD COLUMN "bankChargesInr" DECIMAL;