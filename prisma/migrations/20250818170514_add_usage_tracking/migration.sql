-- CreateTable
CREATE TABLE "UsageTracking" (
    "id" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageTracking_lineItemId_idx" ON "UsageTracking"("lineItemId");

-- CreateIndex
CREATE INDEX "UsageTracking_period_idx" ON "UsageTracking"("period");

-- AddForeignKey
ALTER TABLE "UsageTracking" ADD CONSTRAINT "UsageTracking_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "RecurringLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
