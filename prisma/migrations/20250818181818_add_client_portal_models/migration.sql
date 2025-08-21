-- CreateTable
CREATE TABLE "ClientPortalAccess" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT NOT NULL,
    "canViewInvoices" BOOLEAN NOT NULL DEFAULT true,
    "canRecordPayments" BOOLEAN NOT NULL DEFAULT true,
    "canDownloadDocuments" BOOLEAN NOT NULL DEFAULT true,
    "canViewPaymentHistory" BOOLEAN NOT NULL DEFAULT true,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 30,
    "requireMFA" BOOLEAN NOT NULL DEFAULT false,
    "allowedIPs" TEXT[],
    "lastLoginAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalSession" (
    "id" TEXT NOT NULL,
    "portalAccessId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "csrfToken" TEXT,
    "fingerprintHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalLoginToken" (
    "id" TEXT NOT NULL,
    "portalAccessId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPortalLoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalActivity" (
    "id" TEXT NOT NULL,
    "portalAccessId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestPath" TEXT,
    "httpMethod" TEXT,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "duration" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPortalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPaymentSubmission" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "transactionRef" TEXT,
    "bankName" TEXT,
    "accountLastFour" TEXT,
    "receiptUrls" TEXT[],
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verifierNotes" TEXT,
    "autoMatched" BOOLEAN NOT NULL DEFAULT false,
    "matchConfidence" DECIMAL(65,30),
    "linkedPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPaymentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalNotification" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "invoiceId" TEXT,
    "channels" TEXT[],
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPortalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalAccess_clientId_key" ON "ClientPortalAccess"("clientId");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_clientId_idx" ON "ClientPortalAccess"("clientId");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_userId_idx" ON "ClientPortalAccess"("userId");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_email_idx" ON "ClientPortalAccess"("email");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_isActive_idx" ON "ClientPortalAccess"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalSession_sessionToken_key" ON "ClientPortalSession"("sessionToken");

-- CreateIndex
CREATE INDEX "ClientPortalSession_portalAccessId_idx" ON "ClientPortalSession"("portalAccessId");

-- CreateIndex
CREATE INDEX "ClientPortalSession_sessionToken_idx" ON "ClientPortalSession"("sessionToken");

-- CreateIndex
CREATE INDEX "ClientPortalSession_expiresAt_idx" ON "ClientPortalSession"("expiresAt");

-- CreateIndex
CREATE INDEX "ClientPortalSession_isActive_idx" ON "ClientPortalSession"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalLoginToken_token_key" ON "ClientPortalLoginToken"("token");

-- CreateIndex
CREATE INDEX "ClientPortalLoginToken_portalAccessId_idx" ON "ClientPortalLoginToken"("portalAccessId");

-- CreateIndex
CREATE INDEX "ClientPortalLoginToken_token_idx" ON "ClientPortalLoginToken"("token");

-- CreateIndex
CREATE INDEX "ClientPortalLoginToken_email_idx" ON "ClientPortalLoginToken"("email");

-- CreateIndex
CREATE INDEX "ClientPortalLoginToken_expiresAt_idx" ON "ClientPortalLoginToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ClientPortalLoginToken_isUsed_idx" ON "ClientPortalLoginToken"("isUsed");

-- CreateIndex
CREATE INDEX "ClientPortalActivity_portalAccessId_idx" ON "ClientPortalActivity"("portalAccessId");

-- CreateIndex
CREATE INDEX "ClientPortalActivity_action_idx" ON "ClientPortalActivity"("action");

-- CreateIndex
CREATE INDEX "ClientPortalActivity_entityType_idx" ON "ClientPortalActivity"("entityType");

-- CreateIndex
CREATE INDEX "ClientPortalActivity_timestamp_idx" ON "ClientPortalActivity"("timestamp");

-- CreateIndex
CREATE INDEX "ClientPortalActivity_ipAddress_idx" ON "ClientPortalActivity"("ipAddress");

-- CreateIndex
CREATE INDEX "ClientPaymentSubmission_clientId_idx" ON "ClientPaymentSubmission"("clientId");

-- CreateIndex
CREATE INDEX "ClientPaymentSubmission_invoiceId_idx" ON "ClientPaymentSubmission"("invoiceId");

-- CreateIndex
CREATE INDEX "ClientPaymentSubmission_status_idx" ON "ClientPaymentSubmission"("status");

-- CreateIndex
CREATE INDEX "ClientPaymentSubmission_paymentDate_idx" ON "ClientPaymentSubmission"("paymentDate");

-- CreateIndex
CREATE INDEX "ClientPaymentSubmission_linkedPaymentId_idx" ON "ClientPaymentSubmission"("linkedPaymentId");

-- CreateIndex
CREATE INDEX "ClientPortalNotification_clientId_idx" ON "ClientPortalNotification"("clientId");

-- CreateIndex
CREATE INDEX "ClientPortalNotification_type_idx" ON "ClientPortalNotification"("type");

-- CreateIndex
CREATE INDEX "ClientPortalNotification_isRead_idx" ON "ClientPortalNotification"("isRead");

-- CreateIndex
CREATE INDEX "ClientPortalNotification_priority_idx" ON "ClientPortalNotification"("priority");

-- CreateIndex
CREATE INDEX "ClientPortalNotification_createdAt_idx" ON "ClientPortalNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalSession" ADD CONSTRAINT "ClientPortalSession_portalAccessId_fkey" FOREIGN KEY ("portalAccessId") REFERENCES "ClientPortalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalLoginToken" ADD CONSTRAINT "ClientPortalLoginToken_portalAccessId_fkey" FOREIGN KEY ("portalAccessId") REFERENCES "ClientPortalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalActivity" ADD CONSTRAINT "ClientPortalActivity_portalAccessId_fkey" FOREIGN KEY ("portalAccessId") REFERENCES "ClientPortalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPaymentSubmission" ADD CONSTRAINT "ClientPaymentSubmission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPaymentSubmission" ADD CONSTRAINT "ClientPaymentSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPaymentSubmission" ADD CONSTRAINT "ClientPaymentSubmission_linkedPaymentId_fkey" FOREIGN KEY ("linkedPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalNotification" ADD CONSTRAINT "ClientPortalNotification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalNotification" ADD CONSTRAINT "ClientPortalNotification_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
