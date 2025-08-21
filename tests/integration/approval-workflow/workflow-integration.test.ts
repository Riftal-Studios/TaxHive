/**
 * @file Integration tests for Approval Workflow
 * @description TDD Integration Tests with real database
 * Following RED-GREEN-REFACTOR cycle
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/prisma'
import { ApprovalWorkflowService } from '@/lib/approval-workflow/workflow-service'
import { ApprovalRuleEngine } from '@/lib/approval-workflow/rule-engine'
import { NotificationService } from '@/lib/approval-workflow/notification-service'
import type { User, Client, Invoice, ApprovalRole, ApprovalRule, ApprovalWorkflow } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

describe('Approval Workflow Integration Tests', () => {
  let testUser: User
  let testClient: Client
  let testInvoice: Invoice
  let managerRole: ApprovalRole
  let financeRole: ApprovalRole
  let approvalRule: ApprovalRule
  let workflowService: ApprovalWorkflowService
  let ruleEngine: ApprovalRuleEngine
  let notificationService: NotificationService

  beforeEach(async () => {
    // These tests should fail initially as services don't exist
    workflowService = new ApprovalWorkflowService()
    ruleEngine = new ApprovalRuleEngine()
    notificationService = new NotificationService()

    // Create test user
    testUser = await db.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        gstin: 'TEST123456789',
        onboardingCompleted: true,
      },
    })

    // Create test client
    testClient = await db.client.create({
      data: {
        userId: testUser.id,
        name: 'Test Client',
        email: 'client@example.com',
        address: 'Test Address',
        country: 'India',
      },
    })

    // Create test invoice
    testInvoice = await db.invoice.create({
      data: {
        userId: testUser.id,
        clientId: testClient.id,
        invoiceNumber: 'FY24-25/001',
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: 'USD',
        exchangeRate: new Decimal(83.5),
        subtotal: new Decimal(1000),
        totalAmount: new Decimal(1000),
        totalInINR: new Decimal(83500),
        status: 'DRAFT',
      },
    })

    // Create approval roles
    managerRole = await db.approvalRole.create({
      data: {
        userId: testUser.id,
        name: 'MANAGER',
        level: 1,
        maxApprovalAmount: new Decimal(100000),
      },
    })

    financeRole = await db.approvalRole.create({
      data: {
        userId: testUser.id,
        name: 'FINANCE_HEAD',
        level: 2,
        maxApprovalAmount: new Decimal(500000),
      },
    })

    // Create approval rule
    approvalRule = await db.approvalRule.create({
      data: {
        userId: testUser.id,
        name: 'Standard Approval Rule',
        minAmount: new Decimal(50000),
        maxAmount: new Decimal(200000),
        currency: 'INR',
        requiredApprovals: 2,
        approverRoles: ['MANAGER', 'FINANCE_HEAD'],
        approvalTimeout: 24,
        escalateToRole: 'DIRECTOR',
        isActive: true,
        priority: 1,
      },
    })
  })

  afterEach(async () => {
    // Cleanup test data
    await db.approvalAuditLog.deleteMany({ where: { actorId: testUser.id } })
    await db.approvalNotification.deleteMany({})
    await db.approvalAction.deleteMany({})
    await db.approvalWorkflow.deleteMany({ where: { userId: testUser.id } })
    await db.approvalDelegation.deleteMany({})
    await db.approvalRule.deleteMany({ where: { userId: testUser.id } })
    await db.approvalRole.deleteMany({ where: { userId: testUser.id } })
    await db.invoice.deleteMany({ where: { userId: testUser.id } })
    await db.client.deleteMany({ where: { userId: testUser.id } })
    await db.user.delete({ where: { id: testUser.id } })
  })

  describe('Complete Workflow Lifecycle', () => {
    test('should create workflow when invoice requires approval', async () => {
      // RED: This test should fail initially
      const applicableRules = await ruleEngine.evaluateRules(testInvoice)
      expect(applicableRules).toHaveLength(1)

      const workflow = await ruleEngine.createWorkflow(testInvoice, applicableRules, testUser.id)

      expect(workflow).toBeDefined()
      expect(workflow.invoiceId).toBe(testInvoice.id)
      expect(workflow.status).toBe('PENDING')
      expect(workflow.currentLevel).toBe(1)
      expect(workflow.requiredLevel).toBe(2)

      // Verify workflow is persisted
      const dbWorkflow = await db.approvalWorkflow.findUnique({
        where: { id: workflow.id },
        include: { rule: true },
      })
      expect(dbWorkflow).toBeDefined()
      expect(dbWorkflow!.rule.name).toBe('Standard Approval Rule')
    })

    test('should send approval notifications to appropriate roles', async () => {
      // RED: This test should fail initially
      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      await notificationService.sendApprovalRequest(workflow, [testUser])

      const notifications = await db.approvalNotification.findMany({
        where: { workflowId: workflow.id },
      })

      expect(notifications).toHaveLength(1)
      expect(notifications[0].type).toBe('APPROVAL_REQUIRED')
      expect(notifications[0].recipientId).toBe(testUser.id)
    })

    test('should process manager approval and advance workflow', async () => {
      // RED: This test should fail initially
      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      const approvalAction = await workflowService.takeAction({
        workflowId: workflow.id,
        action: 'APPROVE',
        decidedBy: testUser.id,
        roleId: managerRole.id,
        comments: 'Approved by manager',
      })

      expect(approvalAction.action).toBe('APPROVE')
      expect(approvalAction.level).toBe(1)

      // Verify workflow advanced to next level
      const updatedWorkflow = await db.approvalWorkflow.findUnique({
        where: { id: workflow.id },
      })
      expect(updatedWorkflow!.currentLevel).toBe(2)
      expect(updatedWorkflow!.status).toBe('PENDING') // Still pending finance approval
    })

    test('should complete workflow when final approval is given', async () => {
      // RED: This test should fail initially
      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      // Manager approval
      await workflowService.takeAction({
        workflowId: workflow.id,
        action: 'APPROVE',
        decidedBy: testUser.id,
        roleId: managerRole.id,
        comments: 'Approved by manager',
      })

      // Finance approval (final)
      await workflowService.takeAction({
        workflowId: workflow.id,
        action: 'APPROVE',
        decidedBy: testUser.id,
        roleId: financeRole.id,
        comments: 'Approved by finance',
      })

      // Verify workflow is completed
      const completedWorkflow = await db.approvalWorkflow.findUnique({
        where: { id: workflow.id },
        include: { actions: true },
      })

      expect(completedWorkflow!.status).toBe('APPROVED')
      expect(completedWorkflow!.finalDecision).toBe('APPROVED')
      expect(completedWorkflow!.completedAt).toBeDefined()
      expect(completedWorkflow!.actions).toHaveLength(2)
    })

    test('should reject workflow and complete immediately', async () => {
      // RED: This test should fail initially
      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      await workflowService.takeAction({
        workflowId: workflow.id,
        action: 'REJECT',
        decidedBy: testUser.id,
        roleId: managerRole.id,
        comments: 'Rejected due to compliance issues',
      })

      const rejectedWorkflow = await db.approvalWorkflow.findUnique({
        where: { id: workflow.id },
      })

      expect(rejectedWorkflow!.status).toBe('REJECTED')
      expect(rejectedWorkflow!.finalDecision).toBe('REJECTED')
      expect(rejectedWorkflow!.completedAt).toBeDefined()
    })

    test('should create complete audit trail', async () => {
      // RED: This test should fail initially
      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      await workflowService.takeAction({
        workflowId: workflow.id,
        action: 'APPROVE',
        decidedBy: testUser.id,
        roleId: managerRole.id,
        comments: 'Manager approval',
      })

      await workflowService.takeAction({
        workflowId: workflow.id,
        action: 'APPROVE',
        decidedBy: testUser.id,
        roleId: financeRole.id,
        comments: 'Finance approval',
      })

      const auditLogs = await db.approvalAuditLog.findMany({
        where: { workflowId: workflow.id },
        orderBy: { timestamp: 'asc' },
      })

      expect(auditLogs.length).toBeGreaterThanOrEqual(3) // Creation + 2 actions
      expect(auditLogs[0].event).toBe('WORKFLOW_CREATED')
      expect(auditLogs.some(log => log.event === 'ACTION_TAKEN')).toBe(true)
    })
  })

  describe('Delegation Workflow', () => {
    test('should create and use delegation', async () => {
      // RED: This test should fail initially
      const delegateUser = await db.user.create({
        data: {
          email: 'delegate@example.com',
          name: 'Delegate User',
          onboardingCompleted: true,
        },
      })

      const delegation = await db.approvalDelegation.create({
        data: {
          fromRoleId: managerRole.id,
          toUserId: delegateUser.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          delegationType: 'TEMPORARY',
          reason: 'Vacation coverage',
          maxAmount: new Decimal(50000),
        },
      })

      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      // Delegate should be able to approve
      const canApprove = await workflowService.canUserTakeAction(
        delegateUser.id,
        workflow.id,
        'APPROVE'
      )

      expect(canApprove).toBe(true)

      // Clean up
      await db.user.delete({ where: { id: delegateUser.id } })
    })

    test('should respect delegation amount limits', async () => {
      // RED: This test should fail initially
      const delegateUser = await db.user.create({
        data: {
          email: 'delegate@example.com',
          name: 'Delegate User',
          onboardingCompleted: true,
        },
      })

      const limitedDelegation = await db.approvalDelegation.create({
        data: {
          fromRoleId: managerRole.id,
          toUserId: delegateUser.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          delegationType: 'TEMPORARY',
          reason: 'Limited delegation',
          maxAmount: new Decimal(25000), // Less than invoice amount
        },
      })

      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      // Delegate should NOT be able to approve due to amount limit
      const canApprove = await workflowService.canUserTakeAction(
        delegateUser.id,
        workflow.id,
        'APPROVE'
      )

      expect(canApprove).toBe(false)

      // Clean up
      await db.user.delete({ where: { id: delegateUser.id } })
    })
  })

  describe('Timeout and Escalation', () => {
    test('should escalate expired workflow', async () => {
      // RED: This test should fail initially
      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      // Manually set due date to past
      await db.approvalWorkflow.update({
        where: { id: workflow.id },
        data: { dueDate: new Date(Date.now() - 60 * 60 * 1000) }, // 1 hour ago
      })

      const expiredWorkflows = await workflowService.findExpiredWorkflows()
      expect(expiredWorkflows).toHaveLength(1)

      await workflowService.escalateWorkflow(expiredWorkflows[0])

      const escalatedWorkflow = await db.approvalWorkflow.findUnique({
        where: { id: workflow.id },
      })

      expect(escalatedWorkflow!.escalatedAt).toBeDefined()
      expect(escalatedWorkflow!.escalatedTo).toBe('DIRECTOR')
    })
  })

  describe('Rule Evaluation', () => {
    test('should handle multiple matching rules with priority', async () => {
      // RED: This test should fail initially
      const higherPriorityRule = await db.approvalRule.create({
        data: {
          userId: testUser.id,
          name: 'High Priority Rule',
          minAmount: new Decimal(50000),
          maxAmount: new Decimal(200000),
          currency: 'INR',
          requiredApprovals: 1,
          approverRoles: ['MANAGER'],
          priority: 10, // Higher priority
          isActive: true,
        },
      })

      const applicableRules = await ruleEngine.evaluateRules(testInvoice)

      expect(applicableRules).toHaveLength(1)
      expect(applicableRules[0].id).toBe(higherPriorityRule.id)
      expect(applicableRules[0].priority).toBe(10)
    })

    test('should handle no matching rules', async () => {
      // RED: This test should fail initially
      const veryHighAmountInvoice = await db.invoice.create({
        data: {
          userId: testUser.id,
          clientId: testClient.id,
          invoiceNumber: 'FY24-25/002',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          currency: 'USD',
          exchangeRate: new Decimal(83.5),
          subtotal: new Decimal(10000), // Very high amount
          totalAmount: new Decimal(10000),
          totalInINR: new Decimal(835000), // Above rule max amount
          status: 'DRAFT',
        },
      })

      const applicableRules = await ruleEngine.evaluateRules(veryHighAmountInvoice)

      expect(applicableRules).toHaveLength(0)
    })
  })

  describe('Notification Delivery', () => {
    test('should create notification records', async () => {
      // RED: This test should fail initially
      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      await notificationService.sendApprovalRequest(workflow, [testUser])

      const notifications = await db.approvalNotification.findMany({
        where: { workflowId: workflow.id },
      })

      expect(notifications).toHaveLength(1)
      expect(notifications[0].title).toContain('Approval Required')
      expect(notifications[0].channels).toContain('EMAIL')
    })

    test('should mark notifications as read', async () => {
      // RED: This test should fail initially
      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      await notificationService.sendApprovalRequest(workflow, [testUser])

      const notification = await db.approvalNotification.findFirst({
        where: { workflowId: workflow.id },
      })

      await notificationService.markAsRead(notification!.id)

      const updatedNotification = await db.approvalNotification.findUnique({
        where: { id: notification!.id },
      })

      expect(updatedNotification!.inAppRead).toBe(true)
      expect(updatedNotification!.inAppReadAt).toBeDefined()
    })
  })

  describe('Workflow Validation', () => {
    test('should prevent duplicate workflows for same invoice', async () => {
      // RED: This test should fail initially
      const workflow1 = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      await expect(ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id))
        .rejects.toThrow('Invoice already has an approval workflow')
    })

    test('should validate user permissions', async () => {
      // RED: This test should fail initially
      const unauthorizedUser = await db.user.create({
        data: {
          email: 'unauthorized@example.com',
          name: 'Unauthorized User',
          onboardingCompleted: true,
        },
      })

      const workflow = await ruleEngine.createWorkflow(testInvoice, [approvalRule], testUser.id)

      await expect(workflowService.takeAction({
        workflowId: workflow.id,
        action: 'APPROVE',
        decidedBy: unauthorizedUser.id,
        roleId: managerRole.id,
      })).rejects.toThrow('User does not have permission')

      // Clean up
      await db.user.delete({ where: { id: unauthorizedUser.id } })
    })
  })
})