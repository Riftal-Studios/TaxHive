-- CreateTable
CREATE TABLE "RCMRule" (
    "id" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hsnSacCodes" TEXT[],
    "description" TEXT NOT NULL,
    "gstRate" DECIMAL(65,30) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notificationNo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RCMRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RCMRule_isActive_priority_idx" ON "RCMRule"("isActive", "priority");

-- CreateIndex
CREATE INDEX "RCMRule_ruleType_category_idx" ON "RCMRule"("ruleType", "category");
