-- CreateTable
CREATE TABLE "ITCRegister" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "eligibleITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "claimedITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reversedITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "blockedITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "inputsITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "capitalGoodsITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "inputServicesITC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ITCRegister_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ITCRegister_userId_idx" ON "ITCRegister"("userId");

-- CreateIndex
CREATE INDEX "ITCRegister_period_idx" ON "ITCRegister"("period");

-- CreateIndex
CREATE INDEX "ITCRegister_financialYear_idx" ON "ITCRegister"("financialYear");

-- CreateIndex
CREATE UNIQUE INDEX "ITCRegister_userId_period_key" ON "ITCRegister"("userId", "period");

-- AddForeignKey
ALTER TABLE "ITCRegister" ADD CONSTRAINT "ITCRegister_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
