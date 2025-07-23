-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "placeOfSupply" TEXT NOT NULL DEFAULT 'Outside India (Section 2-6)',
    "serviceCode" TEXT NOT NULL,
    "lutId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL NOT NULL,
    "exchangeSource" TEXT NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "igstRate" DECIMAL NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL NOT NULL,
    "totalInINR" DECIMAL NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "amountPaid" DECIMAL NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "paymentTerms" TEXT,
    "bankDetails" TEXT,
    "notes" TEXT,
    "pdfUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_lutId_fkey" FOREIGN KEY ("lutId") REFERENCES "LUT" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("bankDetails", "clientId", "createdAt", "currency", "description", "dueDate", "exchangeRate", "exchangeSource", "id", "igstAmount", "igstRate", "invoiceDate", "invoiceNumber", "lutId", "notes", "paymentTerms", "pdfUrl", "placeOfSupply", "serviceCode", "status", "subtotal", "totalAmount", "totalInINR", "updatedAt", "userId") SELECT "bankDetails", "clientId", "createdAt", "currency", "description", "dueDate", "exchangeRate", "exchangeSource", "id", "igstAmount", "igstRate", "invoiceDate", "invoiceNumber", "lutId", "notes", "paymentTerms", "pdfUrl", "placeOfSupply", "serviceCode", "status", "subtotal", "totalAmount", "totalInINR", "updatedAt", "userId" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
