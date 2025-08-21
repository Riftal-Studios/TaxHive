/**
 * TDD Tests for Approval Action Service
 * UOL-215: Invoice Approval Workflow System
 * 
 * RED PHASE: These tests should FAIL initially
 * Tests the approval actions: APPROVE, REJECT, DELEGATE, REQUEST_CHANGES
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalActionService, ApprovalAction } from '@/lib/approval-workflow/approval-action-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalAction: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    approvalWorkflow: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    approvalRole: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    approvalAuditLog: {
      create: vi.fn(),
    },
  },
}));

describe('ApprovalActionService - TDD Tests', () => {
  let actionService: ApprovalActionService;
  const mockUserId = 'user-123';
  const mockWorkflowId = 'workflow-123';
  const mockRoleId = 'role-manager';

  const mockWorkflow = {
    id: mockWorkflowId,
    userId: mockUserId,
    status: 'PENDING',
    currentLevel: 1,
    requiredLevel: 2,
    rule: {
      requiredApprovals: 2,
      approverRoles: ['MANAGER', 'FINANCE_HEAD'],
      parallelApproval: false,
    },
    actions: [],
  };

  const mockRole = {
    id: mockRoleId,
    userId: mockUserId,
    name: 'MANAGER',
    level: 1,
    canApprove: true,
    canReject: true,
    canDelegate: true,
    canModify: false,
    maxApprovalAmount: 100000,
    isActive: true,
  };

  const mockUser = {
    id: mockUserId,
    name: 'John Doe',
    email: 'john@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    actionService = new ApprovalActionService();
    
    // Default mocks
    (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(mockWorkflow);
    (prisma.approvalRole.findUnique as any).mockResolvedValue(mockRole);
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
  });

  describe('Action Creation and Validation - RED PHASE', () => {
    it('should create approval action with valid data', async () => {
      // ARRANGE
      const actionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
        comments: 'Approved - invoice looks good',
      };

      const expectedAction = { id: 'action-123', ...actionData, decidedAt: new Date() };
      (prisma.approvalAction.create as any).mockResolvedValue(expectedAction);

      // ACT
      const result = await actionService.createAction(actionData);

      // ASSERT
      expect(result).toEqual(expectedAction);
      expect(prisma.approvalAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...actionData,
          decidedAt: expect.any(Date),
        }),
      });
    });

    it('should validate user has permission to take action', async () => {
      // ARRANGE - User without approval permission
      const unauthorizedRole = { ...mockRole, canApprove: false };
      (prisma.approvalRole.findUnique as any).mockResolvedValue(unauthorizedRole);

      const actionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
      };

      // ACT & ASSERT
      await expect(
        actionService.createAction(actionData)
      ).rejects.toThrow('User does not have permission to approve');
    });

    it('should validate workflow is in correct state for action', async () => {
      // ARRANGE - Completed workflow
      const completedWorkflow = { ...mockWorkflow, status: 'APPROVED' };
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(completedWorkflow);

      const actionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
      };

      // ACT & ASSERT
      await expect(
        actionService.createAction(actionData)
      ).rejects.toThrow('Cannot take action on completed workflow');
    });

    it('should validate action level matches current workflow level', async () => {
      // ARRANGE - Wrong level
      const actionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 3, // Workflow is at level 1
      };

      // ACT & ASSERT
      await expect(
        actionService.createAction(actionData)
      ).rejects.toThrow('Action level does not match current workflow level');
    });

    it('should prevent duplicate actions from same role at same level', async () => {
      // ARRANGE - Existing action
      const existingAction = {
        id: 'existing-action',
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        level: 1,
        action: ApprovalAction.APPROVE,
      };

      const workflowWithAction = {
        ...mockWorkflow,
        actions: [existingAction],
      };

      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(workflowWithAction);

      const actionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
      };

      // ACT & ASSERT
      await expect(
        actionService.createAction(actionData)
      ).rejects.toThrow('Role has already taken action at this level');
    });
  });

  describe('Approval Action - RED PHASE', () => {
    it('should process approval action successfully', async () => {
      // ARRANGE
      const approvalData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
        comments: 'Invoice approved - amount is within budget',
      };

      const approvalAction = { id: 'action-123', ...approvalData };
      (prisma.approvalAction.create as any).mockResolvedValue(approvalAction);

      // ACT
      const result = await actionService.processApproval(approvalData);

      // ASSERT
      expect(result.action).toBe(ApprovalAction.APPROVE);
      expect(result.comments).toBe('Invoice approved - amount is within budget');
    });

    it('should advance workflow to next level on sequential approval', async () => {
      // ARRANGE
      const approvalData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
      };

      // ACT
      await actionService.processApproval(approvalData);

      // ASSERT
      expect(prisma.approvalWorkflow.update).toHaveBeenCalledWith({
        where: { id: mockWorkflowId },
        data: { currentLevel: 2 }, // Advanced to next level
      });
    });

    it('should complete workflow when final approval received', async () => {
      // ARRANGE - Final approval level
      const finalLevelWorkflow = { ...mockWorkflow, currentLevel: 2, requiredLevel: 2 };
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(finalLevelWorkflow);

      const finalApprovalData = {
        workflowId: mockWorkflowId,
        roleId: 'role-finance-head',
        action: ApprovalAction.APPROVE,
        decidedBy: 'finance-head-123',
        level: 2,
      };

      // ACT
      await actionService.processApproval(finalApprovalData);

      // ASSERT
      expect(prisma.approvalWorkflow.update).toHaveBeenCalledWith({
        where: { id: mockWorkflowId },
        data: expect.objectContaining({
          status: 'APPROVED',
          finalDecision: 'APPROVED',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should handle parallel approval workflow', async () => {
      // ARRANGE - Parallel approval workflow
      const parallelWorkflow = {
        ...mockWorkflow,
        rule: { ...mockWorkflow.rule, parallelApproval: true },
        actions: [
          {
            id: 'action-1',
            roleId: 'role-manager',
            action: ApprovalAction.APPROVE,
            level: 1,
          },
        ],
      };

      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(parallelWorkflow);

      const secondApprovalData = {
        workflowId: mockWorkflowId,
        roleId: 'role-finance-head',
        action: ApprovalAction.APPROVE,
        decidedBy: 'finance-head-123',
        level: 1, // Same level in parallel
      };

      // ACT
      await actionService.processApproval(secondApprovalData);

      // ASSERT - Should complete workflow as all required approvals received
      expect(prisma.approvalWorkflow.update).toHaveBeenCalledWith({
        where: { id: mockWorkflowId },
        data: expect.objectContaining({
          status: 'APPROVED',
        }),
      });
    });
  });

  describe('Rejection Action - RED PHASE', () => {
    it('should process rejection action and complete workflow', async () => {
      // ARRANGE
      const rejectionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.REJECT,
        decidedBy: mockUserId,
        level: 1,
        comments: 'Invoice amount exceeds approved budget limits',
      };

      const rejectionAction = { id: 'action-reject', ...rejectionData };
      (prisma.approvalAction.create as any).mockResolvedValue(rejectionAction);

      // ACT
      const result = await actionService.processRejection(rejectionData);

      // ASSERT
      expect(result.action).toBe(ApprovalAction.REJECT);
      expect(result.comments).toBe('Invoice amount exceeds approved budget limits');

      // Should immediately complete workflow as REJECTED
      expect(prisma.approvalWorkflow.update).toHaveBeenCalledWith({
        where: { id: mockWorkflowId },
        data: expect.objectContaining({
          status: 'REJECTED',
          finalDecision: 'REJECTED',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should require rejection reason in comments', async () => {
      // ARRANGE - No comments provided
      const rejectionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.REJECT,
        decidedBy: mockUserId,
        level: 1,
        // No comments
      };

      // ACT & ASSERT
      await expect(
        actionService.processRejection(rejectionData)
      ).rejects.toThrow('Rejection reason must be provided in comments');
    });

    it('should validate user has rejection permission', async () => {
      // ARRANGE - User without rejection permission
      const noRejectRole = { ...mockRole, canReject: false };
      (prisma.approvalRole.findUnique as any).mockResolvedValue(noRejectRole);

      const rejectionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.REJECT,
        decidedBy: mockUserId,
        level: 1,
        comments: 'Rejecting invoice',
      };

      // ACT & ASSERT
      await expect(
        actionService.processRejection(rejectionData)
      ).rejects.toThrow('User does not have permission to reject');
    });
  });

  describe('Delegation Action - RED PHASE', () => {
    it('should process delegation action successfully', async () => {
      // ARRANGE
      const delegationData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.DELEGATE,
        decidedBy: mockUserId,
        level: 1,
        delegatedTo: 'user-delegate-123',
        delegatedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        delegationReason: 'On vacation for one week',
      };

      const delegationAction = { id: 'action-delegate', ...delegationData };
      (prisma.approvalAction.create as any).mockResolvedValue(delegationAction);

      // Mock delegation target validation
      vi.spyOn(actionService, 'validateDelegationTarget').mockResolvedValue(true);

      // ACT
      const result = await actionService.processDelegation(delegationData);

      // ASSERT
      expect(result.action).toBe(ApprovalAction.DELEGATE);
      expect(result.delegatedTo).toBe('user-delegate-123');
      expect(result.delegationReason).toBe('On vacation for one week');
    });

    it('should validate delegation target has appropriate permissions', async () => {
      // ARRANGE
      const delegationData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.DELEGATE,
        decidedBy: mockUserId,
        level: 1,
        delegatedTo: 'invalid-user-123',
      };

      // Mock invalid delegation target
      vi.spyOn(actionService, 'validateDelegationTarget').mockResolvedValue(false);

      // ACT & ASSERT
      await expect(
        actionService.processDelegation(delegationData)
      ).rejects.toThrow('Delegation target does not have required permissions');
    });

    it('should validate user has delegation permission', async () => {
      // ARRANGE - User without delegation permission
      const noDelegateRole = { ...mockRole, canDelegate: false };
      (prisma.approvalRole.findUnique as any).mockResolvedValue(noDelegateRole);

      const delegationData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.DELEGATE,
        decidedBy: mockUserId,
        level: 1,
        delegatedTo: 'user-delegate-123',
      };

      // ACT & ASSERT
      await expect(
        actionService.processDelegation(delegationData)
      ).rejects.toThrow('User does not have permission to delegate');
    });

    it('should validate delegation expiry date is in future', async () => {
      // ARRANGE - Past expiry date
      const delegationData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.DELEGATE,
        decidedBy: mockUserId,
        level: 1,
        delegatedTo: 'user-delegate-123',
        delegatedUntil: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      // ACT & ASSERT
      await expect(
        actionService.processDelegation(delegationData)
      ).rejects.toThrow('Delegation expiry must be in the future');
    });

    it('should not allow self-delegation', async () => {
      // ARRANGE - Delegate to self
      const delegationData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.DELEGATE,
        decidedBy: mockUserId,
        level: 1,
        delegatedTo: mockUserId, // Same as decidedBy
      };

      // ACT & ASSERT
      await expect(
        actionService.processDelegation(delegationData)
      ).rejects.toThrow('Cannot delegate to yourself');
    });
  });

  describe('Request Changes Action - RED PHASE', () => {
    it('should process request changes action successfully', async () => {
      // ARRANGE
      const requestChangesData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.REQUEST_CHANGES,
        decidedBy: mockUserId,
        level: 1,
        requestedChanges: 'Please update line item descriptions to be more specific',
        changePriority: 'HIGH',
      };

      const requestChangesAction = { id: 'action-changes', ...requestChangesData };
      (prisma.approvalAction.create as any).mockResolvedValue(requestChangesAction);

      // ACT
      const result = await actionService.processRequestChanges(requestChangesData);

      // ASSERT
      expect(result.action).toBe(ApprovalAction.REQUEST_CHANGES);
      expect(result.requestedChanges).toBe('Please update line item descriptions to be more specific');
      expect(result.changePriority).toBe('HIGH');
    });

    it('should require specific changes to be requested', async () => {
      // ARRANGE - No requested changes specified
      const requestChangesData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.REQUEST_CHANGES,
        decidedBy: mockUserId,
        level: 1,
        // No requestedChanges field
      };

      // ACT & ASSERT
      await expect(
        actionService.processRequestChanges(requestChangesData)
      ).rejects.toThrow('Specific changes must be requested');
    });

    it('should validate change priority values', async () => {
      // ARRANGE - Invalid priority
      const requestChangesData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.REQUEST_CHANGES,
        decidedBy: mockUserId,
        level: 1,
        requestedChanges: 'Fix issues',
        changePriority: 'INVALID_PRIORITY',
      };

      // ACT & ASSERT
      await expect(
        actionService.processRequestChanges(requestChangesData)
      ).rejects.toThrow('Invalid change priority');
    });

    it('should pause workflow for changes implementation', async () => {
      // ARRANGE
      const requestChangesData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.REQUEST_CHANGES,
        decidedBy: mockUserId,
        level: 1,
        requestedChanges: 'Update invoice details',
        changePriority: 'MEDIUM',
      };

      // ACT
      await actionService.processRequestChanges(requestChangesData);

      // ASSERT - Workflow should remain PENDING but be marked for changes
      expect(prisma.approvalWorkflow.update).toHaveBeenCalledWith({
        where: { id: mockWorkflowId },
        data: expect.objectContaining({
          status: 'PENDING',
          // Should add metadata about pending changes
        }),
      });
    });
  });

  describe('Action History and Queries - RED PHASE', () => {
    it('should get action history for workflow', async () => {
      // ARRANGE
      const actionHistory = [
        {
          id: 'action-1',
          workflowId: mockWorkflowId,
          action: ApprovalAction.APPROVE,
          decidedBy: 'manager-123',
          decidedAt: new Date('2024-01-01'),
          level: 1,
        },
        {
          id: 'action-2',
          workflowId: mockWorkflowId,
          action: ApprovalAction.APPROVE,
          decidedBy: 'finance-123',
          decidedAt: new Date('2024-01-02'),
          level: 2,
        },
      ];

      (prisma.approvalAction.findMany as any).mockResolvedValue(actionHistory);

      // ACT
      const result = await actionService.getActionHistory(mockWorkflowId);

      // ASSERT
      expect(result).toHaveLength(2);
      expect(result[0].decidedAt).toEqual(new Date('2024-01-01'));
      expect(prisma.approvalAction.findMany).toHaveBeenCalledWith({
        where: { workflowId: mockWorkflowId },
        orderBy: { decidedAt: 'asc' },
        include: expect.objectContaining({
          role: true,
        }),
      });
    });

    it('should get pending actions for user', async () => {
      // ARRANGE
      const pendingActions = [
        {
          id: 'pending-1',
          workflowId: 'workflow-pending-1',
          roleId: mockRoleId,
        },
      ];

      (prisma.approvalAction.findMany as any).mockResolvedValue(pendingActions);

      // ACT
      const result = await actionService.getPendingActionsForUser(mockUserId);

      // ASSERT
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pending-1');
    });

    it('should get actions by user across all workflows', async () => {
      // ARRANGE
      const userActions = [
        { id: 'action-1', decidedBy: mockUserId, action: ApprovalAction.APPROVE },
        { id: 'action-2', decidedBy: mockUserId, action: ApprovalAction.REJECT },
      ];

      (prisma.approvalAction.findMany as any).mockResolvedValue(userActions);

      // ACT
      const result = await actionService.getActionsByUser(mockUserId);

      // ASSERT
      expect(result).toHaveLength(2);
      expect(prisma.approvalAction.findMany).toHaveBeenCalledWith({
        where: { decidedBy: mockUserId },
        orderBy: { decidedAt: 'desc' },
      });
    });
  });

  describe('Action Attachments - RED PHASE', () => {
    it('should support file attachments with actions', async () => {
      // ARRANGE
      const actionWithAttachments = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
        comments: 'Approved with supporting documents',
        attachments: [
          'https://bucket.s3.amazonaws.com/doc1.pdf',
          'https://bucket.s3.amazonaws.com/doc2.pdf',
        ],
      };

      const actionWithFiles = { id: 'action-files', ...actionWithAttachments };
      (prisma.approvalAction.create as any).mockResolvedValue(actionWithFiles);

      // ACT
      const result = await actionService.createAction(actionWithAttachments);

      // ASSERT
      expect(result.attachments).toHaveLength(2);
      expect(result.attachments[0]).toBe('https://bucket.s3.amazonaws.com/doc1.pdf');
    });

    it('should validate attachment URLs', async () => {
      // ARRANGE - Invalid URL
      const actionWithInvalidAttachment = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
        attachments: ['invalid-url'], // Invalid URL format
      };

      // ACT & ASSERT
      await expect(
        actionService.createAction(actionWithInvalidAttachment)
      ).rejects.toThrow('Invalid attachment URL format');
    });

    it('should limit number of attachments', async () => {
      // ARRANGE - Too many attachments
      const tooManyAttachments = Array(11).fill('https://example.com/doc.pdf'); // 11 attachments

      const actionWithTooManyAttachments = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
        attachments: tooManyAttachments,
      };

      // ACT & ASSERT
      await expect(
        actionService.createAction(actionWithTooManyAttachments)
      ).rejects.toThrow('Maximum 10 attachments allowed per action');
    });
  });

  describe('Security and Audit - RED PHASE', () => {
    it('should record action metadata for audit trail', async () => {
      // ARRANGE
      const actionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
      };

      // ACT
      await actionService.createAction(actionData);

      // ASSERT
      expect(prisma.approvalAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
        }),
      });
    });

    it('should create audit log entry for each action', async () => {
      // ARRANGE
      const actionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
      };

      // ACT
      await actionService.createAction(actionData);

      // ASSERT
      expect(prisma.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event: 'ACTION_TAKEN',
          entityType: 'ACTION',
          actorId: mockUserId,
        }),
      });
    });

    it('should validate action timestamp is within reasonable bounds', async () => {
      // ARRANGE - Future timestamp (potential clock manipulation)
      const futureTimestamp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in future
      
      const actionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
        decidedAt: futureTimestamp,
      };

      // ACT & ASSERT
      await expect(
        actionService.createAction(actionData)
      ).rejects.toThrow('Action timestamp cannot be in the future');
    });
  });

  describe('Error Handling - RED PHASE', () => {
    it('should handle database connection errors', async () => {
      // ARRANGE
      (prisma.approvalAction.create as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      const actionData = {
        workflowId: mockWorkflowId,
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
      };

      // ACT & ASSERT
      await expect(
        actionService.createAction(actionData)
      ).rejects.toThrow('Failed to create approval action');
    });

    it('should handle missing workflow gracefully', async () => {
      // ARRANGE
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(null);

      const actionData = {
        workflowId: 'non-existent-workflow',
        roleId: mockRoleId,
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
      };

      // ACT & ASSERT
      await expect(
        actionService.createAction(actionData)
      ).rejects.toThrow('Workflow not found');
    });

    it('should handle missing role gracefully', async () => {
      // ARRANGE
      (prisma.approvalRole.findUnique as any).mockResolvedValue(null);

      const actionData = {
        workflowId: mockWorkflowId,
        roleId: 'non-existent-role',
        action: ApprovalAction.APPROVE,
        decidedBy: mockUserId,
        level: 1,
      };

      // ACT & ASSERT
      await expect(
        actionService.createAction(actionData)
      ).rejects.toThrow('Approval role not found');
    });
  });
});