-- CreateTable
CREATE TABLE "TemplateAnalytics" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "period" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateAnalytics_templateId_idx" ON "TemplateAnalytics"("templateId");

-- CreateIndex
CREATE INDEX "TemplateAnalytics_metric_idx" ON "TemplateAnalytics"("metric");

-- CreateIndex
CREATE INDEX "TemplateAnalytics_period_idx" ON "TemplateAnalytics"("period");

-- CreateIndex
CREATE INDEX "TemplateAnalytics_timestamp_idx" ON "TemplateAnalytics"("timestamp");

-- AddForeignKey
ALTER TABLE "TemplateAnalytics" ADD CONSTRAINT "TemplateAnalytics_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecurringInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
