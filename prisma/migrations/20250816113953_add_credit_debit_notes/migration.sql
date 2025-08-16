-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteNumber" TEXT NOT NULL,
    "noteDate" TIMESTAMP(3) NOT NULL,
    "originalInvoiceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonDescription" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "taxableAmountDiff" DECIMAL(65,30) NOT NULL,
    "cgstDiff" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstDiff" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstDiff" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalGSTDiff" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalDiff" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteLineItem" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "gstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "CreditNoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebitNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteNumber" TEXT NOT NULL,
    "noteDate" TIMESTAMP(3) NOT NULL,
    "originalInvoiceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonDescription" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "taxableAmountDiff" DECIMAL(65,30) NOT NULL,
    "cgstDiff" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstDiff" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstDiff" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalGSTDiff" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalDiff" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebitNoteLineItem" (
    "id" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "gstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "DebitNoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_noteNumber_key" ON "CreditNote"("noteNumber");

-- CreateIndex
CREATE INDEX "CreditNote_userId_idx" ON "CreditNote"("userId");

-- CreateIndex
CREATE INDEX "CreditNote_originalInvoiceId_idx" ON "CreditNote"("originalInvoiceId");

-- CreateIndex
CREATE INDEX "CreditNote_status_idx" ON "CreditNote"("status");

-- CreateIndex
CREATE INDEX "CreditNote_noteDate_idx" ON "CreditNote"("noteDate");

-- CreateIndex
CREATE INDEX "CreditNoteLineItem_creditNoteId_idx" ON "CreditNoteLineItem"("creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "DebitNote_noteNumber_key" ON "DebitNote"("noteNumber");

-- CreateIndex
CREATE INDEX "DebitNote_userId_idx" ON "DebitNote"("userId");

-- CreateIndex
CREATE INDEX "DebitNote_originalInvoiceId_idx" ON "DebitNote"("originalInvoiceId");

-- CreateIndex
CREATE INDEX "DebitNote_status_idx" ON "DebitNote"("status");

-- CreateIndex
CREATE INDEX "DebitNote_noteDate_idx" ON "DebitNote"("noteDate");

-- CreateIndex
CREATE INDEX "DebitNoteLineItem_debitNoteId_idx" ON "DebitNoteLineItem"("debitNoteId");

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLineItem" ADD CONSTRAINT "CreditNoteLineItem_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNoteLineItem" ADD CONSTRAINT "DebitNoteLineItem_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "DebitNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
