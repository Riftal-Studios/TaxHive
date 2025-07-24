/*
  Warnings:

  - You are about to drop the column `bankCharges` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `platformFees` on the `Payment` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "amountReceivedBeforeFees" DECIMAL,
    "platformFeesInCurrency" DECIMAL,
    "creditedAmount" DECIMAL,
    "actualExchangeRate" DECIMAL,
    "bankChargesInr" DECIMAL,
    "fircNumber" TEXT,
    "fircDate" DATETIME,
    "fircDocumentUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("actualExchangeRate", "amount", "createdAt", "creditedAmount", "currency", "fircDate", "fircDocumentUrl", "fircNumber", "id", "invoiceId", "notes", "paymentDate", "paymentMethod", "reference") SELECT "actualExchangeRate", "amount", "createdAt", "creditedAmount", "currency", "fircDate", "fircDocumentUrl", "fircNumber", "id", "invoiceId", "notes", "paymentDate", "paymentMethod", "reference" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_fircNumber_idx" ON "Payment"("fircNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
