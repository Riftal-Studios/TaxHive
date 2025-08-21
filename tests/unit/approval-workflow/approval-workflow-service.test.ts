/**
 * @file Unit tests for Approval Workflow Service
 * @description TDD Tests for approval chain logic and routing
 * Following RED-GREEN-REFACTOR cycle
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ApprovalWorkflowService } from '@/lib/approval-workflow/workflow-service'
import { db } from '@/lib/prisma'
import type { ApprovalWorkflow, ApprovalAction, ApprovalRole, User } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  db: {
    approvalWorkflow: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    approvalAction: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    approvalRole: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    approvalDelegation: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    approvalAuditLog: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock notification service
vi.mock('@/lib/approval-workflow/notification-service', () => ({
  NotificationService: {
    sendApprovalRequest: vi.fn(),
    sendDecisionNotification: vi.fn(),
    sendEscalationNotification: vi.fn(),
  },
}))

describe('ApprovalWorkflowService', () => {
  let workflowService: ApprovalWorkflowService
  let mockWorkflow: ApprovalWorkflow
  let mockUser: User
  let mockManagerRole: ApprovalRole

  beforeEach(() => {
    vi.clearAllMocks()
    workflowService = new ApprovalWorkflowService()

    mockUser = {
      id: 'user1',
      email: 'manager@example.com',
      name: 'Manager User',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User

    mockManagerRole = {
      id: 'role1',
      userId: 'user1',
      name: 'MANAGER',
      level: 1,
      isActive: true,
      canApprove: true,
      canReject: true,
      canDelegate: true,
      canModify: false,
      maxApprovalAmount: new Decimal(100000),
      currency: 'INR',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ApprovalRole

    mockWorkflow = {
      id: 'workflow1',
      userId: 'invoiceUser1',
      invoiceId: 'invoice1',
      ruleId: 'rule1',
      status: 'PENDING',
      currentLevel: 1,
      requiredLevel: 2,
      initiatedBy: 'invoiceUser1',
      initiatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ApprovalWorkflow
  })

  describe('Service Initialization', () => {
    test('should throw error when ApprovalWorkflowService is not implemented', () => {
      // RED: This test should fail initially
      expect(() => new ApprovalWorkflowService()).toThrow('ApprovalWorkflowService not implemented')
    })
  })

  describe('Approval Actions', () => {
    test('should approve workflow at current level', async () => {
      // RED: This test should fail initially
      const actionData = {
        workflowId: 'workflow1',
        action: 'APPROVE' as const,
        decidedBy: 'user1',
        comments: 'Approved',
        roleId: 'role1',
      }

      const mockAction = {
        id: 'action1',
        workflowId: 'workflow1',
        roleId: 'role1',
        action: 'APPROVE',
        level: 1,
        decidedBy: 'user1',
        decidedAt: new Date(),
        comments: 'Approved',
      } as ApprovalAction

      const updatedWorkflow = {
        ...mockWorkflow,
        currentLevel: 2,
        status: 'PENDING',
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow)
      vi.mocked(db.approvalRole.findFirst).mockResolvedValue(mockManagerRole)
      vi.mocked(db.approvalAction.create).mockResolvedValue(mockAction)
      vi.mocked(db.approvalWorkflow.update).mockResolvedValue(updatedWorkflow)
      vi.mocked(db.$transaction).mockImplementation(async (fn) => fn(db))

      const result = await workflowService.takeAction(actionData)

      expect(result.action).toBe('APPROVE')
      expect(result.level).toBe(1)
      expect(result.decidedBy).toBe('user1')
      expect(db.approvalWorkflow.update).toHaveBeenCalledWith({
        where: { id: 'workflow1' },
        data: expect.objectContaining({
          currentLevel: 2,
        }),
      })
    })

    test('should complete workflow when final approval is given', async () => {
      // RED: This test should fail initially
      const finalLevelWorkflow = {
        ...mockWorkflow,
        currentLevel: 2,
        requiredLevel: 2,
      }

      const actionData = {
        workflowId: 'workflow1',
        action: 'APPROVE' as const,
        decidedBy: 'user1',
        comments: 'Final approval',
        roleId: 'role1',
      }

      const mockAction = {
        id: 'action2',
        workflowId: 'workflow1',
        roleId: 'role1',
        action: 'APPROVE',
        level: 2,
        decidedBy: 'user1',
        decidedAt: new Date(),
        comments: 'Final approval',
      } as ApprovalAction

      const completedWorkflow = {
        ...finalLevelWorkflow,
        status: 'APPROVED',
        finalDecision: 'APPROVED',
        finalDecisionBy: 'user1',
        finalDecisionAt: new Date(),
        completedAt: new Date(),
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(finalLevelWorkflow)
      vi.mocked(db.approvalRole.findFirst).mockResolvedValue(mockManagerRole)
      vi.mocked(db.approvalAction.create).mockResolvedValue(mockAction)
      vi.mocked(db.approvalWorkflow.update).mockResolvedValue(completedWorkflow)
      vi.mocked(db.$transaction).mockImplementation(async (fn) => fn(db))

      const result = await workflowService.takeAction(actionData)

      expect(db.approvalWorkflow.update).toHaveBeenCalledWith({
        where: { id: 'workflow1' },
        data: expect.objectContaining({
          status: 'APPROVED',
          finalDecision: 'APPROVED',
          finalDecisionBy: 'user1',
          completedAt: expect.any(Date),
        }),
      })
    })

    test('should reject workflow and mark as completed', async () => {
      // RED: This test should fail initially
      const actionData = {
        workflowId: 'workflow1',
        action: 'REJECT' as const,
        decidedBy: 'user1',
        comments: 'Rejected due to compliance issues',
        roleId: 'role1',
      }

      const mockAction = {
        id: 'action3',
        workflowId: 'workflow1',
        roleId: 'role1',
        action: 'REJECT',
        level: 1,
        decidedBy: 'user1',
        decidedAt: new Date(),
        comments: 'Rejected due to compliance issues',
      } as ApprovalAction

      const rejectedWorkflow = {
        ...mockWorkflow,
        status: 'REJECTED',
        finalDecision: 'REJECTED',
        finalDecisionBy: 'user1',
        finalDecisionAt: new Date(),
        completedAt: new Date(),
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow)
      vi.mocked(db.approvalRole.findFirst).mockResolvedValue(mockManagerRole)
      vi.mocked(db.approvalAction.create).mockResolvedValue(mockAction)
      vi.mocked(db.approvalWorkflow.update).mockResolvedValue(rejectedWorkflow)
      vi.mocked(db.$transaction).mockImplementation(async (fn) => fn(db))

      const result = await workflowService.takeAction(actionData)

      expect(result.action).toBe('REJECT')
      expect(db.approvalWorkflow.update).toHaveBeenCalledWith({
        where: { id: 'workflow1' },
        data: expect.objectContaining({
          status: 'REJECTED',
          finalDecision: 'REJECTED',
          finalDecisionBy: 'user1',
          completedAt: expect.any(Date),
        }),
      })
    })

    test('should request changes and keep workflow pending', async () => {
      // RED: This test should fail initially
      const actionData = {
        workflowId: 'workflow1',
        action: 'REQUEST_CHANGES' as const,
        decidedBy: 'user1',
        comments: 'Please update client details',
        roleId: 'role1',
        requestedChanges: 'Client GSTIN needs verification',
        changePriority: 'HIGH' as const,
      }

      const mockAction = {
        id: 'action4',
        workflowId: 'workflow1',
        roleId: 'role1',
        action: 'REQUEST_CHANGES',
        level: 1,
        decidedBy: 'user1',
        decidedAt: new Date(),
        comments: 'Please update client details',
        requestedChanges: 'Client GSTIN needs verification',
        changePriority: 'HIGH',
      } as ApprovalAction

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow)
      vi.mocked(db.approvalRole.findFirst).mockResolvedValue(mockManagerRole)
      vi.mocked(db.approvalAction.create).mockResolvedValue(mockAction)
      vi.mocked(db.$transaction).mockImplementation(async (fn) => fn(db))

      const result = await workflowService.takeAction(actionData)

      expect(result.action).toBe('REQUEST_CHANGES')
      expect(result.requestedChanges).toBe('Client GSTIN needs verification')
      expect(result.changePriority).toBe('HIGH')
      // Workflow should remain pending for changes
      expect(db.approvalWorkflow.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: expect.not.stringMatching('PENDING') })
        })
      )
    })

    test('should delegate approval to another user', async () => {
      // RED: This test should fail initially
      const delegateUser = {
        id: 'delegate1',
        email: 'delegate@example.com',
        name: 'Delegate User',
      } as User

      const actionData = {
        workflowId: 'workflow1',
        action: 'DELEGATE' as const,
        decidedBy: 'user1',
        comments: 'Delegating due to travel',
        roleId: 'role1',
        delegatedTo: 'delegate1',
        delegationReason: 'Out of office',
        delegatedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }

      const mockAction = {
        id: 'action5',
        workflowId: 'workflow1',
        roleId: 'role1',
        action: 'DELEGATE',
        level: 1,
        decidedBy: 'user1',
        decidedAt: new Date(),
        comments: 'Delegating due to travel',
        delegatedTo: 'delegate1',
        delegationReason: 'Out of office',
        delegatedUntil: actionData.delegatedUntil,
      } as ApprovalAction

      const mockDelegation = {
        id: 'delegation1',
        fromRoleId: 'role1',
        toUserId: 'delegate1',
        startDate: new Date(),
        endDate: actionData.delegatedUntil!,
        isActive: true,
        delegationType: 'TEMPORARY',
        reason: 'Out of office',
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow)
      vi.mocked(db.approvalRole.findFirst).mockResolvedValue(mockManagerRole)
      vi.mocked(db.user.findUnique).mockResolvedValue(delegateUser)
      vi.mocked(db.approvalAction.create).mockResolvedValue(mockAction)
      vi.mocked(db.approvalDelegation.create).mockResolvedValue(mockDelegation)
      vi.mocked(db.$transaction).mockImplementation(async (fn) => fn(db))

      const result = await workflowService.takeAction(actionData)

      expect(result.action).toBe('DELEGATE')
      expect(result.delegatedTo).toBe('delegate1')
      expect(db.approvalDelegation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromRoleId: 'role1',
          toUserId: 'delegate1',
          delegationType: 'TEMPORARY',
          reason: 'Out of office',
        }),
      })
    })

    test('should validate user permissions before taking action', async () => {
      // RED: This test should fail initially
      const restrictedRole = {
        ...mockManagerRole,
        canApprove: false,
      }

      const actionData = {
        workflowId: 'workflow1',
        action: 'APPROVE' as const,
        decidedBy: 'user1',
        roleId: 'role1',
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow)
      vi.mocked(db.approvalRole.findFirst).mockResolvedValue(restrictedRole)

      await expect(workflowService.takeAction(actionData)).rejects.toThrow(
        'User does not have permission to approve'
      )
    })

    test('should validate approval amount limits', async () => {
      // RED: This test should fail initially
      const limitedRole = {
        ...mockManagerRole,
        maxApprovalAmount: new Decimal(50000),
      }

      const highValueWorkflow = {
        ...mockWorkflow,
        invoice: {
          totalInINR: new Decimal(100000), // Above role limit
        },
      }

      const actionData = {
        workflowId: 'workflow1',
        action: 'APPROVE' as const,
        decidedBy: 'user1',
        roleId: 'role1',
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue({
        ...highValueWorkflow,
        invoice: { totalInINR: new Decimal(100000) },
      } as any)
      vi.mocked(db.approvalRole.findFirst).mockResolvedValue(limitedRole)

      await expect(workflowService.takeAction(actionData)).rejects.toThrow(
        'Invoice amount exceeds user approval limit'
      )
    })

    test('should prevent action on completed workflow', async () => {
      // RED: This test should fail initially
      const completedWorkflow = {
        ...mockWorkflow,
        status: 'APPROVED',
        completedAt: new Date(),
      }

      const actionData = {
        workflowId: 'workflow1',
        action: 'APPROVE' as const,
        decidedBy: 'user1',
        roleId: 'role1',
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(completedWorkflow)

      await expect(workflowService.takeAction(actionData)).rejects.toThrow(
        'Cannot take action on completed workflow'
      )
    })
  })

  describe('Workflow Query Operations', () => {
    test('should get pending approvals for user', async () => {
      // RED: This test should fail initially
      const pendingWorkflows = [
        {
          ...mockWorkflow,
          id: 'workflow1',
          currentLevel: 1,
        },
        {
          ...mockWorkflow,
          id: 'workflow2',
          currentLevel: 1,
        },
      ]

      vi.mocked(db.approvalRole.findMany).mockResolvedValue([mockManagerRole])
      vi.mocked(db.approvalWorkflow.findMany).mockResolvedValue(pendingWorkflows)

      const result = await workflowService.getPendingApprovals('user1')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('workflow1')
      expect(result[1].id).toBe('workflow2')
    })

    test('should get approval history for user', async () => {
      // RED: This test should fail initially
      const completedActions = [
        {
          id: 'action1',
          workflowId: 'workflow1',
          action: 'APPROVE',
          decidedBy: 'user1',
          decidedAt: new Date(),
        },
        {
          id: 'action2',
          workflowId: 'workflow2',
          action: 'REJECT',
          decidedBy: 'user1',
          decidedAt: new Date(),
        },
      ]

      vi.mocked(db.approvalAction.findMany).mockResolvedValue(completedActions as any)

      const result = await workflowService.getApprovalHistory('user1')

      expect(result).toHaveLength(2)
      expect(result[0].action).toBe('APPROVE')
      expect(result[1].action).toBe('REJECT')
    })

    test('should get workflow status', async () => {
      // RED: This test should fail initially
      const workflowWithActions = {
        ...mockWorkflow,
        actions: [
          {
            id: 'action1',
            action: 'APPROVE',
            level: 1,
            decidedBy: 'user1',
            decidedAt: new Date(),
          },
        ],
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(workflowWithActions as any)

      const result = await workflowService.getWorkflowStatus('workflow1')

      expect(result).toBeDefined()
      expect(result.id).toBe('workflow1')
      expect(result.status).toBe('PENDING')
      expect(result.actions).toHaveLength(1)
    })

    test('should check if user can take action on workflow', async () => {
      // RED: This test should fail initially
      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow)
      vi.mocked(db.approvalRole.findFirst).mockResolvedValue(mockManagerRole)
      vi.mocked(db.approvalDelegation.findFirst).mockResolvedValue(null)

      const canApprove = await workflowService.canUserTakeAction('user1', 'workflow1', 'APPROVE')

      expect(canApprove).toBe(true)
    })

    test('should check delegation permissions', async () => {
      // RED: This test should fail initially
      const delegation = {
        id: 'delegation1',
        fromRoleId: 'role1',
        toUserId: 'delegate1',
        isActive: true,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        maxAmount: new Decimal(100000),
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow)
      vi.mocked(db.approvalRole.findFirst).mockResolvedValue(null) // User doesn't have direct role
      vi.mocked(db.approvalDelegation.findFirst).mockResolvedValue(delegation as any)

      const canApprove = await workflowService.canUserTakeAction('delegate1', 'workflow1', 'APPROVE')

      expect(canApprove).toBe(true)
    })
  })

  describe('Workflow Management', () => {
    test('should cancel workflow', async () => {
      // RED: This test should fail initially
      const cancelledWorkflow = {
        ...mockWorkflow,
        status: 'CANCELLED',
        completedAt: new Date(),
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow)
      vi.mocked(db.approvalWorkflow.update).mockResolvedValue(cancelledWorkflow)

      const result = await workflowService.cancelWorkflow('workflow1', 'user1', 'Invoice cancelled')

      expect(result.status).toBe('CANCELLED')
      expect(db.approvalWorkflow.update).toHaveBeenCalledWith({
        where: { id: 'workflow1' },
        data: expect.objectContaining({
          status: 'CANCELLED',
          completedAt: expect.any(Date),
        }),
      })
    })

    test('should bypass workflow with admin privileges', async () => {
      // RED: This test should fail initially
      const bypassedWorkflow = {
        ...mockWorkflow,
        status: 'APPROVED',
        finalDecision: 'APPROVED',
        finalDecisionBy: 'admin1',
        finalDecisionAt: new Date(),
        completedAt: new Date(),
        bypassReason: 'Emergency approval',
        bypassedBy: 'admin1',
        bypassedAt: new Date(),
      }

      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue(mockWorkflow)
      vi.mocked(db.approvalWorkflow.update).mockResolvedValue(bypassedWorkflow)

      const result = await workflowService.bypassWorkflow(
        'workflow1',
        'admin1',
        'Emergency approval'
      )

      expect(result.status).toBe('APPROVED')
      expect(result.bypassReason).toBe('Emergency approval')
      expect(result.bypassedBy).toBe('admin1')
    })
  })
})