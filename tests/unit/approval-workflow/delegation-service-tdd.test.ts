/**
 * TDD Tests for Approval Delegation Service
 * UOL-215: Invoice Approval Workflow System
 * 
 * RED PHASE: These tests should FAIL initially
 * Tests temporary, permanent, and emergency delegation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalDelegationService, DelegationType } from '@/lib/approval-workflow/delegation-service';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalDelegation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    approvalRole: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    approvalAuditLog: {
      create: vi.fn(),
    },
  },
}));

describe('ApprovalDelegationService - TDD Tests', () => {
  let delegationService: ApprovalDelegationService;
  const mockFromRoleId = 'role-manager-123';
  const mockToUserId = 'user-delegate-123';
  
  const mockFromRole = {
    id: mockFromRoleId,
    userId: 'user-original-123',
    name: 'MANAGER',
    level: 1,
    maxApprovalAmount: new Decimal(100000),
    canDelegate: true,
    isActive: true,
  };

  const mockToUser = {
    id: mockToUserId,
    name: 'Delegate User',
    email: 'delegate@company.com',
    approvalRoles: [
      {
        id: 'role-delegate-123',
        name: 'SENIOR_MANAGER',
        level: 1,
        maxApprovalAmount: new Decimal(150000),
        canApprove: true,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delegationService = new ApprovalDelegationService();
    
    // Default mocks
    (prisma.approvalRole.findUnique as any).mockResolvedValue(mockFromRole);
    (prisma.user.findUnique as any).mockResolvedValue(mockToUser);
  });

  describe('Delegation Creation - RED PHASE', () => {
    it('should create temporary delegation with valid data', async () => {
      // ARRANGE
      const delegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        delegationType: DelegationType.TEMPORARY,
        reason: 'Going on vacation for one week',
        maxAmount: new Decimal(50000), // Lower than original role
        currency: 'INR',
      };

      const expectedDelegation = { id: 'delegation-123', ...delegationData, isActive: true };
      (prisma.approvalDelegation.create as any).mockResolvedValue(expectedDelegation);

      // ACT
      const result = await delegationService.createDelegation(delegationData);

      // ASSERT
      expect(result).toEqual(expectedDelegation);
      expect(prisma.approvalDelegation.create).toHaveBeenCalledWith({
        data: { ...delegationData, isActive: true },
      });
    });

    it('should validate delegator has delegation permission', async () => {
      // ARRANGE - Role without delegation permission
      const noDelegateRole = { ...mockFromRole, canDelegate: false };
      (prisma.approvalRole.findUnique as any).mockResolvedValue(noDelegateRole);

      const delegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'Test delegation',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(delegationData)
      ).rejects.toThrow('Role does not have delegation permission');
    });

    it('should validate delegation target has appropriate permissions', async () => {
      // ARRANGE - User without approval roles
      const userWithoutRoles = { ...mockToUser, approvalRoles: [] };
      (prisma.user.findUnique as any).mockResolvedValue(userWithoutRoles);

      const delegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'Test delegation',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(delegationData)
      ).rejects.toThrow('Delegation target does not have any approval roles');
    });

    it('should validate date ranges are logical', async () => {
      // ARRANGE - End date before start date
      const invalidDelegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Future
        endDate: new Date(), // Past relative to start
        delegationType: DelegationType.TEMPORARY,
        reason: 'Invalid dates',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(invalidDelegationData)
      ).rejects.toThrow('End date must be after start date');
    });

    it('should prevent self-delegation', async () => {
      // ARRANGE - Delegate to same user
      const selfDelegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: 'user-original-123', // Same as fromRole.userId
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'Self delegation',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(selfDelegationData)
      ).rejects.toThrow('Cannot delegate to yourself');
    });

    it('should validate delegation amount limits', async () => {
      // ARRANGE - Amount higher than original role limit
      const excessiveAmountData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'Test delegation',
        maxAmount: new Decimal(200000), // Higher than fromRole.maxApprovalAmount (100000)
        currency: 'INR',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(excessiveAmountData)
      ).rejects.toThrow('Delegation amount cannot exceed original role limit');
    });
  });

  describe('Delegation Types - RED PHASE', () => {
    it('should create permanent delegation with no end date', async () => {
      // ARRANGE
      const permanentDelegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: null, // No end date for permanent
        delegationType: DelegationType.PERMANENT,
        reason: 'Role restructuring - permanent delegation',
      };

      const expectedDelegation = { id: 'delegation-perm', ...permanentDelegationData };
      (prisma.approvalDelegation.create as any).mockResolvedValue(expectedDelegation);

      // ACT
      const result = await delegationService.createDelegation(permanentDelegationData);

      // ASSERT
      expect(result.delegationType).toBe(DelegationType.PERMANENT);
      expect(result.endDate).toBeNull();
    });

    it('should create emergency delegation with higher privileges', async () => {
      // ARRANGE
      const emergencyDelegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        delegationType: DelegationType.EMERGENCY,
        reason: 'Critical business situation requiring immediate approval',
        maxAmount: new Decimal(500000), // Emergency override
        currency: 'INR',
      };

      // Mock emergency authorization
      vi.spyOn(delegationService, 'validateEmergencyAuthorization').mockResolvedValue(true);

      const expectedDelegation = { id: 'delegation-emergency', ...emergencyDelegationData };
      (prisma.approvalDelegation.create as any).mockResolvedValue(expectedDelegation);

      // ACT
      const result = await delegationService.createDelegation(emergencyDelegationData);

      // ASSERT
      expect(result.delegationType).toBe(DelegationType.EMERGENCY);
      expect(result.maxAmount).toEqual(new Decimal(500000));
    });

    it('should require special authorization for emergency delegations', async () => {
      // ARRANGE
      const emergencyDelegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        delegationType: DelegationType.EMERGENCY,
        reason: 'Emergency',
      };

      // Mock failed authorization
      vi.spyOn(delegationService, 'validateEmergencyAuthorization').mockResolvedValue(false);

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(emergencyDelegationData)
      ).rejects.toThrow('Emergency delegation requires special authorization');
    });

    it('should limit temporary delegation duration', async () => {
      // ARRANGE - Delegation longer than 90 days
      const longDelegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000), // 100 days
        delegationType: DelegationType.TEMPORARY,
        reason: 'Long vacation',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(longDelegationData)
      ).rejects.toThrow('Temporary delegation cannot exceed 90 days');
    });
  });

  describe('Active Delegation Management - RED PHASE', () => {
    it('should get active delegations for user', async () => {
      // ARRANGE
      const activeDelegations = [
        {
          id: 'delegation-1',
          fromRoleId: mockFromRoleId,
          toUserId: mockToUserId,
          isActive: true,
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'delegation-2',
          fromRoleId: 'role-other',
          toUserId: mockToUserId,
          isActive: true,
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      ];

      (prisma.approvalDelegation.findMany as any).mockResolvedValue(activeDelegations);

      // ACT
      const result = await delegationService.getActiveDelegationsForUser(mockToUserId);

      // ASSERT
      expect(result).toHaveLength(2);
      expect(prisma.approvalDelegation.findMany).toHaveBeenCalledWith({
        where: {
          toUserId: mockToUserId,
          isActive: true,
          OR: [
            { endDate: null }, // Permanent delegations
            { endDate: { gte: new Date() } }, // Not expired
          ],
        },
        include: { fromRole: true },
      });
    });

    it('should check if user can approve on behalf of role', async () => {
      // ARRANGE
      const activeDelegation = {
        id: 'delegation-active',
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        isActive: true,
        maxAmount: new Decimal(75000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      (prisma.approvalDelegation.findMany as any).mockResolvedValue([activeDelegation]);

      const invoiceAmount = new Decimal(50000); // Within delegation limit

      // ACT
      const canApprove = await delegationService.canUserApproveForRole(
        mockToUserId,
        mockFromRoleId,
        invoiceAmount,
        'INR'
      );

      // ASSERT
      expect(canApprove).toBe(true);
    });

    it('should deny approval if amount exceeds delegation limit', async () => {
      // ARRANGE
      const limitedDelegation = {
        id: 'delegation-limited',
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        isActive: true,
        maxAmount: new Decimal(50000), // Lower limit
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      (prisma.approvalDelegation.findMany as any).mockResolvedValue([limitedDelegation]);

      const invoiceAmount = new Decimal(75000); // Exceeds delegation limit

      // ACT
      const canApprove = await delegationService.canUserApproveForRole(
        mockToUserId,
        mockFromRoleId,
        invoiceAmount,
        'INR'
      );

      // ASSERT
      expect(canApprove).toBe(false);
    });

    it('should automatically expire delegations', async () => {
      // ARRANGE
      const expiredDelegations = [
        {
          id: 'delegation-expired',
          endDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          isActive: true,
        },
      ];

      (prisma.approvalDelegation.findMany as any).mockResolvedValue(expiredDelegations);

      // ACT
      const expiredCount = await delegationService.processExpiredDelegations();

      // ASSERT
      expect(expiredCount).toBe(1);
      expect(prisma.approvalDelegation.update).toHaveBeenCalledWith({
        where: { id: 'delegation-expired' },
        data: { isActive: false },
      });
    });
  });

  describe('Delegation Modifications - RED PHASE', () => {
    it('should extend delegation end date', async () => {
      // ARRANGE
      const delegationId = 'delegation-123';
      const originalDelegation = {
        id: delegationId,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
      };

      (prisma.approvalDelegation.findUnique as any).mockResolvedValue(originalDelegation);

      const newEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // Extend by 7 days
      const extendedDelegation = { ...originalDelegation, endDate: newEndDate };
      (prisma.approvalDelegation.update as any).mockResolvedValue(extendedDelegation);

      // ACT
      const result = await delegationService.extendDelegation(delegationId, newEndDate, 'Extended due to delayed return');

      // ASSERT
      expect(result.endDate).toEqual(newEndDate);
      expect(prisma.approvalDelegation.update).toHaveBeenCalledWith({
        where: { id: delegationId },
        data: { endDate: newEndDate },
      });
    });

    it('should not allow extending permanent delegations', async () => {
      // ARRANGE
      const permanentDelegation = {
        id: 'delegation-permanent',
        delegationType: DelegationType.PERMANENT,
        endDate: null,
      };

      (prisma.approvalDelegation.findUnique as any).mockResolvedValue(permanentDelegation);

      // ACT & ASSERT
      await expect(
        delegationService.extendDelegation('delegation-permanent', new Date(), 'Cannot extend')
      ).rejects.toThrow('Cannot extend permanent delegation');
    });

    it('should update delegation amount limits', async () => {
      // ARRANGE
      const delegationId = 'delegation-123';
      const originalDelegation = {
        id: delegationId,
        maxAmount: new Decimal(50000),
        fromRole: mockFromRole,
      };

      (prisma.approvalDelegation.findUnique as any).mockResolvedValue(originalDelegation);

      const newAmount = new Decimal(75000); // Still within original role limit
      const updatedDelegation = { ...originalDelegation, maxAmount: newAmount };
      (prisma.approvalDelegation.update as any).mockResolvedValue(updatedDelegation);

      // ACT
      const result = await delegationService.updateDelegationAmount(delegationId, newAmount);

      // ASSERT
      expect(result.maxAmount).toEqual(newAmount);
    });

    it('should revoke delegation before expiry', async () => {
      // ARRANGE
      const delegationId = 'delegation-revoke';
      const activeDelegation = {
        id: delegationId,
        isActive: true,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      (prisma.approvalDelegation.findUnique as any).mockResolvedValue(activeDelegation);

      const revokedDelegation = { ...activeDelegation, isActive: false };
      (prisma.approvalDelegation.update as any).mockResolvedValue(revokedDelegation);

      // ACT
      const result = await delegationService.revokeDelegation(delegationId, 'Plans changed - no longer needed');

      // ASSERT
      expect(result.isActive).toBe(false);
      expect(prisma.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event: 'DELEGATION_REVOKED',
          entityType: 'DELEGATION',
          entityId: delegationId,
        }),
      });
    });
  });

  describe('Delegation Usage Tracking - RED PHASE', () => {
    it('should track delegation usage', async () => {
      // ARRANGE
      const delegationId = 'delegation-track';
      const delegation = {
        id: delegationId,
        usageCount: 0,
        lastUsedAt: null,
      };

      (prisma.approvalDelegation.findUnique as any).mockResolvedValue(delegation);

      const updatedDelegation = {
        ...delegation,
        usageCount: 1,
        lastUsedAt: new Date(),
      };
      (prisma.approvalDelegation.update as any).mockResolvedValue(updatedDelegation);

      // ACT
      const result = await delegationService.recordDelegationUsage(delegationId, 'workflow-123');

      // ASSERT
      expect(result.usageCount).toBe(1);
      expect(result.lastUsedAt).toBeDefined();
    });

    it('should get delegation usage statistics', async () => {
      // ARRANGE
      const delegations = [
        { id: 'del-1', usageCount: 5, delegationType: DelegationType.TEMPORARY },
        { id: 'del-2', usageCount: 12, delegationType: DelegationType.PERMANENT },
        { id: 'del-3', usageCount: 0, delegationType: DelegationType.EMERGENCY },
      ];

      (prisma.approvalDelegation.findMany as any).mockResolvedValue(delegations);

      // ACT
      const stats = await delegationService.getDelegationStatistics(mockToUserId);

      // ASSERT
      expect(stats.totalDelegations).toBe(3);
      expect(stats.totalUsage).toBe(17);
      expect(stats.byType.TEMPORARY.count).toBe(1);
      expect(stats.byType.TEMPORARY.usage).toBe(5);
    });

    it('should identify unused delegations for cleanup', async () => {
      // ARRANGE
      const oldUnusedDelegations = [
        {
          id: 'del-unused',
          usageCount: 0,
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days old
          delegationType: DelegationType.TEMPORARY,
        },
      ];

      (prisma.approvalDelegation.findMany as any).mockResolvedValue(oldUnusedDelegations);

      // ACT
      const unusedDelegations = await delegationService.findUnusedDelegations(30); // Older than 30 days

      // ASSERT
      expect(unusedDelegations).toHaveLength(1);
      expect(unusedDelegations[0].id).toBe('del-unused');
    });
  });

  describe('Delegation Hierarchy and Conflicts - RED PHASE', () => {
    it('should prevent circular delegation chains', async () => {
      // ARRANGE - User A delegates to User B, User B tries to delegate back to User A
      const existingDelegation = {
        id: 'del-existing',
        fromRoleId: 'role-user-b',
        toUserId: 'user-a', // B -> A
        isActive: true,
      };

      (prisma.approvalDelegation.findMany as any).mockResolvedValue([existingDelegation]);

      const circularDelegationData = {
        fromRoleId: 'role-user-a',
        toUserId: 'user-b', // A -> B (would create circle)
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'Circular delegation',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(circularDelegationData)
      ).rejects.toThrow('Circular delegation detected');
    });

    it('should handle overlapping delegations for same role', async () => {
      // ARRANGE - Existing delegation for same role
      const existingDelegation = {
        id: 'del-existing',
        fromRoleId: mockFromRoleId,
        toUserId: 'other-user-123',
        isActive: true,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      (prisma.approvalDelegation.findMany as any).mockResolvedValue([existingDelegation]);

      const overlappingDelegationData = {
        fromRoleId: mockFromRoleId, // Same role
        toUserId: mockToUserId, // Different user
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'Overlapping delegation',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(overlappingDelegationData)
      ).rejects.toThrow('Role already has an active delegation');
    });

    it('should resolve delegation priority conflicts', async () => {
      // ARRANGE - Multiple delegations to same user
      const delegations = [
        {
          id: 'del-1',
          fromRoleId: 'role-manager',
          level: 1,
          maxAmount: new Decimal(50000),
          delegationType: DelegationType.TEMPORARY,
        },
        {
          id: 'del-2',
          fromRoleId: 'role-director',
          level: 3,
          maxAmount: new Decimal(200000),
          delegationType: DelegationType.EMERGENCY,
        },
      ];

      (prisma.approvalDelegation.findMany as any).mockResolvedValue(delegations);

      // ACT
      const effectiveDelegation = await delegationService.getEffectiveDelegationForAmount(
        mockToUserId,
        new Decimal(100000),
        'INR'
      );

      // ASSERT
      expect(effectiveDelegation.id).toBe('del-2'); // Higher level role takes priority
      expect(effectiveDelegation.maxAmount).toEqual(new Decimal(200000));
    });
  });

  describe('Delegation Security and Compliance - RED PHASE', () => {
    it('should create audit trail for delegation creation', async () => {
      // ARRANGE
      const delegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'Vacation delegation',
      };

      // ACT
      await delegationService.createDelegation(delegationData);

      // ASSERT
      expect(prisma.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event: 'DELEGATION_CREATED',
          entityType: 'DELEGATION',
          actorId: mockFromRole.userId,
          newValues: expect.any(Object),
        }),
      });
    });

    it('should validate delegation permissions in real-time', async () => {
      // ARRANGE
      const delegationId = 'delegation-validate';
      const currentTime = new Date();
      
      const delegation = {
        id: delegationId,
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        isActive: true,
        startDate: new Date(currentTime.getTime() - 60 * 60 * 1000), // 1 hour ago
        endDate: new Date(currentTime.getTime() + 60 * 60 * 1000), // 1 hour from now
        maxAmount: new Decimal(75000),
      };

      (prisma.approvalDelegation.findUnique as any).mockResolvedValue(delegation);

      // ACT
      const isValid = await delegationService.validateDelegationAtTime(delegationId, currentTime);

      // ASSERT
      expect(isValid).toBe(true);
    });

    it('should enforce segregation of duties', async () => {
      // ARRANGE - User tries to delegate to someone in same reporting line
      const sameDepartmentUser = {
        ...mockToUser,
        department: 'FINANCE',
        reportingManager: 'manager-finance-123',
      };

      const delegatingRole = {
        ...mockFromRole,
        userId: 'manager-finance-123', // Same reporting manager
      };

      (prisma.user.findUnique as any).mockResolvedValue(sameDepartmentUser);
      (prisma.approvalRole.findUnique as any).mockResolvedValue(delegatingRole);

      const sodViolationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'SoD violation test',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(sodViolationData)
      ).rejects.toThrow('Delegation violates segregation of duties policy');
    });
  });

  describe('Error Handling - RED PHASE', () => {
    it('should handle database connection errors', async () => {
      // ARRANGE
      (prisma.approvalDelegation.create as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      const delegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'Test delegation',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(delegationData)
      ).rejects.toThrow('Failed to create delegation');
    });

    it('should handle missing role gracefully', async () => {
      // ARRANGE
      (prisma.approvalRole.findUnique as any).mockResolvedValue(null);

      const delegationData = {
        fromRoleId: 'non-existent-role',
        toUserId: mockToUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'Test delegation',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(delegationData)
      ).rejects.toThrow('Source role not found');
    });

    it('should handle missing user gracefully', async () => {
      // ARRANGE
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const delegationData = {
        fromRoleId: mockFromRoleId,
        toUserId: 'non-existent-user',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        delegationType: DelegationType.TEMPORARY,
        reason: 'Test delegation',
      };

      // ACT & ASSERT
      await expect(
        delegationService.createDelegation(delegationData)
      ).rejects.toThrow('Target user not found');
    });
  });
});