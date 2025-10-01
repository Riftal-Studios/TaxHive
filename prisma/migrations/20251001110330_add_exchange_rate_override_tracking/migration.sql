-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "exchangeRateOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exchangeRateOverriddenAt" TIMESTAMP(3);
