-- CreateTable
CREATE TABLE "ApprovalRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canApprove" BOOLEAN NOT NULL DEFAULT true,
    "canReject" BOOLEAN NOT NULL DEFAULT true,
    "canDelegate" BOOLEAN NOT NULL DEFAULT true,
    "canModify" BOOLEAN NOT NULL DEFAULT false,
    "maxApprovalAmount" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minAmount" DECIMAL(65,30),
    "maxAmount" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "invoiceType" TEXT,
    "clientCategory" TEXT,
    "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
    "parallelApproval" BOOLEAN NOT NULL DEFAULT false,
    "approverRoles" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "approvalTimeout" INTEGER,
    "escalateToRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "roleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "requiredLevel" INTEGER NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalatedTo" TEXT,
    "finalDecision" TEXT,
    "finalDecisionBy" TEXT,
    "finalDecisionAt" TIMESTAMP(3),
    "bypassReason" TEXT,
    "bypassedBy" TEXT,
    "bypassedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comments" TEXT,
    "attachments" TEXT[],
    "delegatedTo" TEXT,
    "delegatedUntil" TIMESTAMP(3),
    "delegationReason" TEXT,
    "requestedChanges" TEXT,
    "changePriority" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDelegation" (
    "id" TEXT NOT NULL,
    "fromRoleId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "delegationType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "maxAmount" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalNotification" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientRole" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "channels" TEXT[],
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "inAppRead" BOOLEAN NOT NULL DEFAULT false,
    "inAppReadAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAuditLog" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT,
    "event" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changeReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRole_userId_idx" ON "ApprovalRole"("userId");

-- CreateIndex
CREATE INDEX "ApprovalRole_level_idx" ON "ApprovalRole"("level");

-- CreateIndex
CREATE INDEX "ApprovalRole_isActive_idx" ON "ApprovalRole"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRole_userId_name_key" ON "ApprovalRole"("userId", "name");

-- CreateIndex
CREATE INDEX "ApprovalRule_userId_idx" ON "ApprovalRule"("userId");

-- CreateIndex
CREATE INDEX "ApprovalRule_priority_idx" ON "ApprovalRule"("priority");

-- CreateIndex
CREATE INDEX "ApprovalRule_isActive_idx" ON "ApprovalRule"("isActive");

-- CreateIndex
CREATE INDEX "ApprovalRule_minAmount_idx" ON "ApprovalRule"("minAmount");

-- CreateIndex
CREATE INDEX "ApprovalRule_maxAmount_idx" ON "ApprovalRule"("maxAmount");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflow_invoiceId_key" ON "ApprovalWorkflow"("invoiceId");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_userId_idx" ON "ApprovalWorkflow"("userId");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_invoiceId_idx" ON "ApprovalWorkflow"("invoiceId");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_status_idx" ON "ApprovalWorkflow"("status");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_currentLevel_idx" ON "ApprovalWorkflow"("currentLevel");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_dueDate_idx" ON "ApprovalWorkflow"("dueDate");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_initiatedBy_idx" ON "ApprovalWorkflow"("initiatedBy");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_finalDecision_idx" ON "ApprovalWorkflow"("finalDecision");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_roleId_idx" ON "ApprovalWorkflow"("roleId");

-- CreateIndex
CREATE INDEX "ApprovalAction_workflowId_idx" ON "ApprovalAction"("workflowId");

-- CreateIndex
CREATE INDEX "ApprovalAction_roleId_idx" ON "ApprovalAction"("roleId");

-- CreateIndex
CREATE INDEX "ApprovalAction_decidedBy_idx" ON "ApprovalAction"("decidedBy");

-- CreateIndex
CREATE INDEX "ApprovalAction_decidedAt_idx" ON "ApprovalAction"("decidedAt");

-- CreateIndex
CREATE INDEX "ApprovalAction_action_idx" ON "ApprovalAction"("action");

-- CreateIndex
CREATE INDEX "ApprovalAction_level_idx" ON "ApprovalAction"("level");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_fromRoleId_idx" ON "ApprovalDelegation"("fromRoleId");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_toUserId_idx" ON "ApprovalDelegation"("toUserId");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_isActive_idx" ON "ApprovalDelegation"("isActive");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_startDate_endDate_idx" ON "ApprovalDelegation"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ApprovalDelegation_delegationType_idx" ON "ApprovalDelegation"("delegationType");

-- CreateIndex
CREATE INDEX "ApprovalNotification_workflowId_idx" ON "ApprovalNotification"("workflowId");

-- CreateIndex
CREATE INDEX "ApprovalNotification_recipientId_idx" ON "ApprovalNotification"("recipientId");

-- CreateIndex
CREATE INDEX "ApprovalNotification_type_idx" ON "ApprovalNotification"("type");

-- CreateIndex
CREATE INDEX "ApprovalNotification_emailSent_idx" ON "ApprovalNotification"("emailSent");

-- CreateIndex
CREATE INDEX "ApprovalNotification_scheduledFor_idx" ON "ApprovalNotification"("scheduledFor");

-- CreateIndex
CREATE INDEX "ApprovalNotification_urgency_idx" ON "ApprovalNotification"("urgency");

-- CreateIndex
CREATE INDEX "ApprovalAuditLog_workflowId_idx" ON "ApprovalAuditLog"("workflowId");

-- CreateIndex
CREATE INDEX "ApprovalAuditLog_event_idx" ON "ApprovalAuditLog"("event");

-- CreateIndex
CREATE INDEX "ApprovalAuditLog_entityType_idx" ON "ApprovalAuditLog"("entityType");

-- CreateIndex
CREATE INDEX "ApprovalAuditLog_actorId_idx" ON "ApprovalAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "ApprovalAuditLog_timestamp_idx" ON "ApprovalAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "ApprovalAuditLog_entityId_idx" ON "ApprovalAuditLog"("entityId");

-- AddForeignKey
ALTER TABLE "ApprovalRole" ADD CONSTRAINT "ApprovalRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ApprovalRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ApprovalRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ApprovalRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_fromRoleId_fkey" FOREIGN KEY ("fromRoleId") REFERENCES "ApprovalRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalNotification" ADD CONSTRAINT "ApprovalNotification_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAuditLog" ADD CONSTRAINT "ApprovalAuditLog_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
