-- AlterTable - Add PDF status tracking columns (all optional with defaults)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdfStatus" TEXT DEFAULT 'pending';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdfError" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdfGeneratedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdfJobId" TEXT;

-- AlterTable - Add public access token columns (optional)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "publicAccessToken" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3);

-- CreateIndex - Add unique constraint on publicAccessToken
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Invoice_publicAccessToken_key') THEN
        CREATE UNIQUE INDEX "Invoice_publicAccessToken_key" ON "Invoice"("publicAccessToken");
    END IF;
END $$;