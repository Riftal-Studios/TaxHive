-- CreateTable
CREATE TABLE "EmailHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "type" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT,
    "bcc" TEXT,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailHistory_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailHistory_userId_idx" ON "EmailHistory"("userId");

-- CreateIndex
CREATE INDEX "EmailHistory_invoiceId_idx" ON "EmailHistory"("invoiceId");

-- CreateIndex
CREATE INDEX "EmailHistory_type_idx" ON "EmailHistory"("type");

-- CreateIndex
CREATE INDEX "EmailHistory_status_idx" ON "EmailHistory"("status");

-- CreateIndex
CREATE INDEX "EmailHistory_sentAt_idx" ON "EmailHistory"("sentAt");