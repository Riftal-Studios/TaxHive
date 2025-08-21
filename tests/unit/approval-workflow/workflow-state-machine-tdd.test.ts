/**
 * TDD Tests for Approval Workflow State Machine
 * UOL-215: Invoice Approval Workflow System
 * 
 * RED PHASE: These tests should FAIL initially
 * Tests the workflow state transitions: PENDING → APPROVED/REJECTED/EXPIRED/CANCELLED
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowStateMachine, WorkflowStatus, ApprovalAction } from '@/lib/approval-workflow/workflow-state-machine';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalWorkflow: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    approvalAction: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    approvalNotification: {
      create: vi.fn(),
    },
    approvalAuditLog: {
      create: vi.fn(),
    },
  },
}));

describe('WorkflowStateMachine - TDD Tests', () => {
  let stateMachine: WorkflowStateMachine;
  const mockUserId = 'user-123';
  const mockInvoiceId = 'invoice-123';
  const mockRuleId = 'rule-123';

  const mockWorkflow = {
    id: 'workflow-123',
    userId: mockUserId,
    invoiceId: mockInvoiceId,
    ruleId: mockRuleId,
    status: WorkflowStatus.PENDING,
    currentLevel: 1,
    requiredLevel: 2,
    initiatedBy: mockUserId,
    initiatedAt: new Date(),
    dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
    rule: {
      id: mockRuleId,
      requiredApprovals: 2,
      approverRoles: ['MANAGER', 'FINANCE_HEAD'],
      parallelApproval: false,
      approvalTimeout: 48,
    },
    actions: [],
  };

  const mockInvoice = {
    id: mockInvoiceId,
    totalAmount: new Decimal(75000),
    currency: 'INR',
    invoiceType: 'DOMESTIC_B2B',
    status: 'DRAFT',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stateMachine = new WorkflowStateMachine();
  });

  describe('Workflow Creation - RED PHASE', () => {
    it('should create new workflow with PENDING status', async () => {
      // ARRANGE
      const workflowData = {
        userId: mockUserId,
        invoiceId: mockInvoiceId,
        ruleId: mockRuleId,
        initiatedBy: mockUserId,
        currentLevel: 1,
        requiredLevel: 2,
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
      };
      const expectedWorkflow = { id: 'workflow-new', ...workflowData, status: WorkflowStatus.PENDING };
      (prisma.approvalWorkflow.create as any).mockResolvedValue(expectedWorkflow);

      // ACT
      const result = await stateMachine.createWorkflow(workflowData);

      // ASSERT
      expect(result).toEqual(expectedWorkflow);
      expect(result.status).toBe(WorkflowStatus.PENDING);
      expect(prisma.approvalWorkflow.create).toHaveBeenCalledWith({
        data: { ...workflowData, status: WorkflowStatus.PENDING },
      });
    });

    it('should calculate due date based on approval timeout', async () => {
      // ARRANGE
      const rule = { approvalTimeout: 72 }; // 72 hours
      const startTime = new Date('2024-01-01T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(startTime);

      // ACT
      const dueDate = await stateMachine.calculateDueDate(rule.approvalTimeout);

      // ASSERT
      const expectedDueDate = new Date('2024-01-04T10:00:00Z'); // 3 days later
      expect(dueDate).toEqual(expectedDueDate);

      vi.useRealTimers();
    });

    it('should validate workflow cannot be created for already approved invoice', async () => {
      // ARRANGE
      const approvedInvoice = { ...mockInvoice, status: 'APPROVED' };
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue({
        status: WorkflowStatus.APPROVED,
      });

      // ACT & ASSERT
      await expect(
        stateMachine.createWorkflow({
          userId: mockUserId,
          invoiceId: approvedInvoice.id,
          ruleId: mockRuleId,
          initiatedBy: mockUserId,
        })
      ).rejects.toThrow('Cannot create workflow for already processed invoice');
    });

    it('should prevent duplicate workflows for same invoice', async () => {
      // ARRANGE
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(mockWorkflow);

      // ACT & ASSERT
      await expect(
        stateMachine.createWorkflow({
          userId: mockUserId,
          invoiceId: mockInvoiceId,
          ruleId: mockRuleId,
          initiatedBy: mockUserId,
        })
      ).rejects.toThrow('Workflow already exists for this invoice');
    });
  });

  describe('State Transitions - RED PHASE', () => {
    beforeEach(() => {
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(mockWorkflow);
    });

    it('should transition from PENDING to APPROVED when all approvals received', async () => {
      // ARRANGE
      const workflowId = 'workflow-123';
      const approvalAction = {
        workflowId,
        roleId: 'role-manager',
        action: ApprovalAction.APPROVE,
        decidedBy: 'approver-123',
        level: 2, // Final level
      };

      const approvedWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.APPROVED,
        currentLevel: 2,
        finalDecision: 'APPROVED',
        finalDecisionBy: 'approver-123',
        finalDecisionAt: new Date(),
        completedAt: new Date(),
      };

      (prisma.approvalWorkflow.update as any).mockResolvedValue(approvedWorkflow);

      // ACT
      const result = await stateMachine.processApprovalAction(approvalAction);

      // ASSERT
      expect(result.status).toBe(WorkflowStatus.APPROVED);
      expect(result.finalDecision).toBe('APPROVED');
      expect(result.completedAt).toBeDefined();
    });

    it('should transition from PENDING to REJECTED on any rejection', async () => {
      // ARRANGE
      const rejectionAction = {
        workflowId: 'workflow-123',
        roleId: 'role-manager',
        action: ApprovalAction.REJECT,
        decidedBy: 'approver-123',
        comments: 'Invoice amount exceeds budget limits',
        level: 1,
      };

      const rejectedWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.REJECTED,
        finalDecision: 'REJECTED',
        finalDecisionBy: 'approver-123',
        finalDecisionAt: new Date(),
        completedAt: new Date(),
      };

      (prisma.approvalWorkflow.update as any).mockResolvedValue(rejectedWorkflow);

      // ACT
      const result = await stateMachine.processApprovalAction(rejectionAction);

      // ASSERT
      expect(result.status).toBe(WorkflowStatus.REJECTED);
      expect(result.finalDecision).toBe('REJECTED');
      expect(result.completedAt).toBeDefined();
    });

    it('should advance current level on sequential approval', async () => {
      // ARRANGE
      const firstApprovalAction = {
        workflowId: 'workflow-123',
        roleId: 'role-manager',
        action: ApprovalAction.APPROVE,
        decidedBy: 'manager-123',
        level: 1,
      };

      const updatedWorkflow = {
        ...mockWorkflow,
        currentLevel: 2, // Advanced to next level
        status: WorkflowStatus.PENDING, // Still pending (needs finance head)
      };

      (prisma.approvalWorkflow.update as any).mockResolvedValue(updatedWorkflow);

      // ACT
      const result = await stateMachine.processApprovalAction(firstApprovalAction);

      // ASSERT
      expect(result.currentLevel).toBe(2);
      expect(result.status).toBe(WorkflowStatus.PENDING);
    });

    it('should handle parallel approval workflow', async () => {
      // ARRANGE
      const parallelWorkflow = {
        ...mockWorkflow,
        rule: {
          ...mockWorkflow.rule,
          parallelApproval: true,
          requiredApprovals: 2,
          approverRoles: ['MANAGER', 'FINANCE_HEAD'],
        },
        actions: [
          {
            id: 'action-1',
            action: ApprovalAction.APPROVE,
            roleId: 'role-manager',
            decidedBy: 'manager-123',
            level: 1,
          },
        ],
      };

      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(parallelWorkflow);

      const secondApprovalAction = {
        workflowId: 'workflow-123',
        roleId: 'role-finance-head',
        action: ApprovalAction.APPROVE,
        decidedBy: 'finance-123',
        level: 1, // Same level in parallel
      };

      const completedWorkflow = {
        ...parallelWorkflow,
        status: WorkflowStatus.APPROVED,
        finalDecision: 'APPROVED',
        completedAt: new Date(),
      };

      (prisma.approvalWorkflow.update as any).mockResolvedValue(completedWorkflow);

      // ACT
      const result = await stateMachine.processApprovalAction(secondApprovalAction);

      // ASSERT
      expect(result.status).toBe(WorkflowStatus.APPROVED);
    });

    it('should transition to EXPIRED when timeout reached', async () => {
      // ARRANGE
      const expiredWorkflow = {
        ...mockWorkflow,
        dueDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        status: WorkflowStatus.PENDING,
      };

      (prisma.approvalWorkflow.findMany as any).mockResolvedValue([expiredWorkflow]);
      (prisma.approvalWorkflow.update as any).mockResolvedValue({
        ...expiredWorkflow,
        status: WorkflowStatus.EXPIRED,
      });

      // ACT
      const result = await stateMachine.processExpiredWorkflows();

      // ASSERT
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(WorkflowStatus.EXPIRED);
    });

    it('should transition to CANCELLED when manually cancelled', async () => {
      // ARRANGE
      const workflowId = 'workflow-123';
      const cancelReason = 'Invoice amount changed, requires new approval';
      
      const cancelledWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.CANCELLED,
        bypassReason: cancelReason,
        bypassedBy: 'admin-123',
        bypassedAt: new Date(),
      };

      (prisma.approvalWorkflow.update as any).mockResolvedValue(cancelledWorkflow);

      // ACT
      const result = await stateMachine.cancelWorkflow(workflowId, cancelReason, 'admin-123');

      // ASSERT
      expect(result.status).toBe(WorkflowStatus.CANCELLED);
      expect(result.bypassReason).toBe(cancelReason);
    });
  });

  describe('Delegation Handling - RED PHASE', () => {
    it('should process delegation action without changing workflow status', async () => {
      // ARRANGE
      const delegationAction = {
        workflowId: 'workflow-123',
        roleId: 'role-manager',
        action: ApprovalAction.DELEGATE,
        decidedBy: 'manager-123',
        delegatedTo: 'manager-456',
        delegatedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        delegationReason: 'On vacation',
        level: 1,
      };

      const workflowWithDelegation = {
        ...mockWorkflow,
        status: WorkflowStatus.PENDING, // Status unchanged
      };

      (prisma.approvalWorkflow.update as any).mockResolvedValue(workflowWithDelegation);

      // ACT
      const result = await stateMachine.processApprovalAction(delegationAction);

      // ASSERT
      expect(result.status).toBe(WorkflowStatus.PENDING);
      // Delegation should be recorded but workflow continues
    });

    it('should validate delegation target has appropriate permissions', async () => {
      // ARRANGE
      const invalidDelegationAction = {
        workflowId: 'workflow-123',
        roleId: 'role-manager',
        action: ApprovalAction.DELEGATE,
        decidedBy: 'manager-123',
        delegatedTo: 'user-without-permissions',
        level: 1,
      };

      vi.spyOn(stateMachine, 'validateDelegationTarget').mockResolvedValue(false);

      // ACT & ASSERT
      await expect(
        stateMachine.processApprovalAction(invalidDelegationAction)
      ).rejects.toThrow('Delegation target does not have required permissions');
    });
  });

  describe('Request Changes Handling - RED PHASE', () => {
    it('should handle request changes action', async () => {
      // ARRANGE
      const requestChangesAction = {
        workflowId: 'workflow-123',
        roleId: 'role-manager',
        action: ApprovalAction.REQUEST_CHANGES,
        decidedBy: 'manager-123',
        requestedChanges: 'Please update line item descriptions',
        changePriority: 'HIGH',
        level: 1,
      };

      const workflowWithChanges = {
        ...mockWorkflow,
        status: WorkflowStatus.PENDING, // Workflow paused for changes
      };

      (prisma.approvalWorkflow.update as any).mockResolvedValue(workflowWithChanges);

      // ACT
      const result = await stateMachine.processApprovalAction(requestChangesAction);

      // ASSERT
      expect(result.status).toBe(WorkflowStatus.PENDING);
      // Should create notification to invoice creator
    });

    it('should reset workflow when changes are implemented', async () => {
      // ARRANGE
      const workflowId = 'workflow-123';
      const changesImplemented = true;

      const resetWorkflow = {
        ...mockWorkflow,
        currentLevel: 1, // Reset to beginning
        actions: [], // Clear previous actions
      };

      (prisma.approvalWorkflow.update as any).mockResolvedValue(resetWorkflow);

      // ACT
      const result = await stateMachine.handleChangesImplemented(workflowId, changesImplemented);

      // ASSERT
      expect(result.currentLevel).toBe(1);
    });
  });

  describe('Escalation Handling - RED PHASE', () => {
    it('should escalate workflow when timeout reached', async () => {
      // ARRANGE
      const overdueWorkflow = {
        ...mockWorkflow,
        dueDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour overdue
        rule: {
          ...mockWorkflow.rule,
          escalateToRole: 'DIRECTOR',
        },
      };

      (prisma.approvalWorkflow.findMany as any).mockResolvedValue([overdueWorkflow]);

      const escalatedWorkflow = {
        ...overdueWorkflow,
        escalatedAt: new Date(),
        escalatedTo: 'DIRECTOR',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Extended deadline
      };

      (prisma.approvalWorkflow.update as any).mockResolvedValue(escalatedWorkflow);

      // ACT
      const result = await stateMachine.processEscalations();

      // ASSERT
      expect(result).toHaveLength(1);
      expect(result[0].escalatedTo).toBe('DIRECTOR');
      expect(result[0].escalatedAt).toBeDefined();
    });

    it('should not escalate if escalation role not defined', async () => {
      // ARRANGE
      const overdueWorkflow = {
        ...mockWorkflow,
        dueDate: new Date(Date.now() - 60 * 60 * 1000),
        rule: {
          ...mockWorkflow.rule,
          escalateToRole: null, // No escalation defined
        },
      };

      (prisma.approvalWorkflow.findMany as any).mockResolvedValue([overdueWorkflow]);

      // ACT
      const result = await stateMachine.processEscalations();

      // ASSERT
      expect(result).toHaveLength(0);
    });
  });

  describe('Emergency Bypass - RED PHASE', () => {
    it('should allow emergency bypass with proper authorization', async () => {
      // ARRANGE
      const workflowId = 'workflow-123';
      const bypassReason = 'Critical business deadline';
      const bypassedBy = 'ceo-123'; // High-level user

      vi.spyOn(stateMachine, 'validateBypassAuthorization').mockResolvedValue(true);

      const bypassedWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.APPROVED,
        bypassReason,
        bypassedBy,
        bypassedAt: new Date(),
        finalDecision: 'APPROVED',
        finalDecisionBy: bypassedBy,
        finalDecisionAt: new Date(),
        completedAt: new Date(),
      };

      (prisma.approvalWorkflow.update as any).mockResolvedValue(bypassedWorkflow);

      // ACT
      const result = await stateMachine.emergencyBypass(workflowId, bypassReason, bypassedBy);

      // ASSERT
      expect(result.status).toBe(WorkflowStatus.APPROVED);
      expect(result.bypassReason).toBe(bypassReason);
      expect(result.bypassedBy).toBe(bypassedBy);
    });

    it('should reject bypass without proper authorization', async () => {
      // ARRANGE
      const workflowId = 'workflow-123';
      const unauthorizedUser = 'regular-user-123';

      vi.spyOn(stateMachine, 'validateBypassAuthorization').mockResolvedValue(false);

      // ACT & ASSERT
      await expect(
        stateMachine.emergencyBypass(workflowId, 'Reason', unauthorizedUser)
      ).rejects.toThrow('Insufficient authorization for emergency bypass');
    });

    it('should log emergency bypass for audit trail', async () => {
      // ARRANGE
      const workflowId = 'workflow-123';
      const bypassReason = 'Critical business deadline';
      const bypassedBy = 'ceo-123';

      vi.spyOn(stateMachine, 'validateBypassAuthorization').mockResolvedValue(true);
      (prisma.approvalWorkflow.update as any).mockResolvedValue({
        ...mockWorkflow,
        status: WorkflowStatus.APPROVED,
      });

      // ACT
      await stateMachine.emergencyBypass(workflowId, bypassReason, bypassedBy);

      // ASSERT
      expect(prisma.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event: 'EMERGENCY_BYPASS',
          entityType: 'WORKFLOW',
          entityId: workflowId,
          actorId: bypassedBy,
        }),
      });
    });
  });

  describe('Workflow Queries - RED PHASE', () => {
    it('should get pending workflows for user', async () => {
      // ARRANGE
      const pendingWorkflows = [
        { ...mockWorkflow, status: WorkflowStatus.PENDING },
      ];
      (prisma.approvalWorkflow.findMany as any).mockResolvedValue(pendingWorkflows);

      // ACT
      const result = await stateMachine.getPendingWorkflowsForUser('approver-123');

      // ASSERT
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(WorkflowStatus.PENDING);
      expect(prisma.approvalWorkflow.findMany).toHaveBeenCalledWith({
        where: {
          status: WorkflowStatus.PENDING,
          // Additional filters for user's approval roles
        },
        include: expect.objectContaining({
          invoice: true,
          rule: true,
          actions: true,
        }),
      });
    });

    it('should get workflow history for invoice', async () => {
      // ARRANGE
      const workflowHistory = [
        { ...mockWorkflow, status: WorkflowStatus.APPROVED },
      ];
      (prisma.approvalWorkflow.findMany as any).mockResolvedValue(workflowHistory);

      // ACT
      const result = await stateMachine.getWorkflowHistoryForInvoice(mockInvoiceId);

      // ASSERT
      expect(result).toHaveLength(1);
      expect(prisma.approvalWorkflow.findMany).toHaveBeenCalledWith({
        where: { invoiceId: mockInvoiceId },
        orderBy: { createdAt: 'desc' },
        include: expect.objectContaining({
          actions: true,
          notifications: true,
        }),
      });
    });
  });

  describe('State Validation - RED PHASE', () => {
    it('should validate state transitions are legal', async () => {
      // ARRANGE - Try to approve an already rejected workflow
      const rejectedWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.REJECTED,
      };

      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(rejectedWorkflow);

      const approvalAction = {
        workflowId: 'workflow-123',
        action: ApprovalAction.APPROVE,
        decidedBy: 'approver-123',
        level: 1,
      };

      // ACT & ASSERT
      await expect(
        stateMachine.processApprovalAction(approvalAction)
      ).rejects.toThrow('Cannot approve workflow in REJECTED status');
    });

    it('should prevent actions on completed workflows', async () => {
      // ARRANGE
      const completedWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.APPROVED,
        completedAt: new Date(),
      };

      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(completedWorkflow);

      // ACT & ASSERT
      await expect(
        stateMachine.processApprovalAction({
          workflowId: 'workflow-123',
          action: ApprovalAction.APPROVE,
          decidedBy: 'approver-123',
          level: 1,
        })
      ).rejects.toThrow('Cannot process actions on completed workflow');
    });
  });

  describe('Concurrent Access - RED PHASE', () => {
    it('should handle concurrent approval attempts', async () => {
      // ARRANGE
      const workflowId = 'workflow-123';
      const action1 = {
        workflowId,
        action: ApprovalAction.APPROVE,
        decidedBy: 'approver-1',
        level: 2,
      };
      const action2 = {
        workflowId,
        action: ApprovalAction.REJECT,
        decidedBy: 'approver-2',
        level: 2,
      };

      // Mock optimistic locking or version check
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(mockWorkflow);

      // ACT & ASSERT
      const promise1 = stateMachine.processApprovalAction(action1);
      const promise2 = stateMachine.processApprovalAction(action2);

      // Only one should succeed, other should fail
      const results = await Promise.allSettled([promise1, promise2]);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });
  });
});