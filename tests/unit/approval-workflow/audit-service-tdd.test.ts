/**
 * TDD Tests for Approval Audit Service
 * UOL-215: Invoice Approval Workflow System
 * 
 * RED PHASE: These tests should FAIL initially
 * Tests immutable audit logging and compliance tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalAuditService, AuditEvent } from '@/lib/approval-workflow/audit-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalAuditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('ApprovalAuditService - TDD Tests', () => {
  let auditService: ApprovalAuditService;
  const mockWorkflowId = 'workflow-123';
  const mockActorId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = new ApprovalAuditService();
  });

  describe('Audit Log Creation - RED PHASE', () => {
    it('should create audit log entry with complete data', async () => {
      // ARRANGE
      const auditData = {
        workflowId: mockWorkflowId,
        event: AuditEvent.WORKFLOW_CREATED,
        entityType: 'WORKFLOW',
        entityId: mockWorkflowId,
        actorId: mockActorId,
        actorRole: 'MANAGER',
        newValues: { status: 'PENDING', currentLevel: 1 },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        sessionId: 'session-123',
      };

      const expectedAuditLog = { id: 'audit-123', ...auditData, timestamp: new Date() };
      (prisma.approvalAuditLog.create as any).mockResolvedValue(expectedAuditLog);

      // ACT
      const result = await auditService.createAuditEntry(auditData);

      // ASSERT
      expect(result).toEqual(expectedAuditLog);
      expect(prisma.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...auditData,
          timestamp: expect.any(Date),
        }),
      });
    });

    it('should validate audit event types', async () => {
      // ARRANGE - Invalid event
      const invalidAuditData = {
        event: 'INVALID_EVENT',
        entityType: 'WORKFLOW',
        entityId: mockWorkflowId,
        actorId: mockActorId,
      };

      // ACT & ASSERT
      await expect(
        auditService.createAuditEntry(invalidAuditData)
      ).rejects.toThrow('Invalid audit event type');
    });

    it('should require actor information for audit trail', async () => {
      // ARRANGE - Missing actor
      const auditDataWithoutActor = {
        event: AuditEvent.WORKFLOW_CREATED,
        entityType: 'WORKFLOW',
        entityId: mockWorkflowId,
        // Missing actorId
      };

      // ACT & ASSERT
      await expect(
        auditService.createAuditEntry(auditDataWithoutActor)
      ).rejects.toThrow('Actor ID is required for audit trail');
    });
  });

  describe('Immutable Audit Trail - RED PHASE', () => {
    it('should prevent modification of audit entries', async () => {
      // ARRANGE
      const auditId = 'audit-123';

      // ACT & ASSERT
      await expect(
        auditService.updateAuditEntry(auditId, { event: 'MODIFIED_EVENT' })
      ).rejects.toThrow('Audit entries are immutable and cannot be modified');
    });

    it('should prevent deletion of audit entries', async () => {
      // ARRANGE
      const auditId = 'audit-123';

      // ACT & ASSERT
      await expect(
        auditService.deleteAuditEntry(auditId)
      ).rejects.toThrow('Audit entries cannot be deleted');
    });

    it('should create tamper-proof hash for audit entries', async () => {
      // ARRANGE
      const auditData = {
        event: AuditEvent.ACTION_TAKEN,
        entityType: 'ACTION',
        entityId: 'action-123',
        actorId: mockActorId,
        newValues: { action: 'APPROVE', level: 1 },
      };

      const expectedAuditLog = { 
        id: 'audit-123', 
        ...auditData, 
        timestamp: new Date(),
        integrityHash: 'a'.repeat(64) // Mock SHA-256 hash
      };
      (prisma.approvalAuditLog.create as any).mockResolvedValue(expectedAuditLog);

      // ACT
      const result = await auditService.createAuditEntry(auditData);

      // ASSERT
      expect(result.integrityHash).toBeDefined();
      expect(result.integrityHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });

    it('should validate audit entry integrity', async () => {
      // ARRANGE
      const auditEntry = {
        id: 'audit-123',
        event: AuditEvent.ACTION_TAKEN,
        entityId: 'action-123',
        actorId: mockActorId,
        integrityHash: 'valid-hash',
        newValues: { action: 'APPROVE' },
      };

      vi.spyOn(auditService, 'calculateHash').mockReturnValue('valid-hash');

      // ACT
      const isValid = await auditService.validateIntegrity(auditEntry);

      // ASSERT
      expect(isValid).toBe(true);
    });
  });

  describe('Audit Trail Queries - RED PHASE', () => {
    it('should get complete audit trail for workflow', async () => {
      // ARRANGE
      const auditTrail = [
        {
          id: 'audit-1',
          event: AuditEvent.WORKFLOW_CREATED,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          actorId: 'user-creator',
        },
        {
          id: 'audit-2',
          event: AuditEvent.ACTION_TAKEN,
          timestamp: new Date('2024-01-01T11:00:00Z'),
          actorId: 'user-approver',
        },
      ];

      (prisma.approvalAuditLog.findMany as any).mockResolvedValue(auditTrail);

      // ACT
      const result = await auditService.getWorkflowAuditTrail(mockWorkflowId);

      // ASSERT
      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(prisma.approvalAuditLog.findMany).toHaveBeenCalledWith({
        where: { workflowId: mockWorkflowId },
        orderBy: { timestamp: 'asc' },
      });
    });

    it('should filter audit events by type', async () => {
      // ARRANGE
      const actionEvents = [
        { id: 'audit-1', event: AuditEvent.ACTION_TAKEN },
        { id: 'audit-2', event: AuditEvent.ACTION_TAKEN },
      ];

      (prisma.approvalAuditLog.findMany as any).mockResolvedValue(actionEvents);

      // ACT
      const result = await auditService.getAuditEventsByType(
        mockWorkflowId,
        AuditEvent.ACTION_TAKEN
      );

      // ASSERT
      expect(result).toHaveLength(2);
      expect(prisma.approvalAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          workflowId: mockWorkflowId,
          event: AuditEvent.ACTION_TAKEN,
        },
        orderBy: { timestamp: 'asc' },
      });
    });

    it('should get audit trail for specific actor', async () => {
      // ARRANGE
      const actorAudits = [
        { id: 'audit-1', actorId: mockActorId, event: AuditEvent.ACTION_TAKEN },
      ];

      (prisma.approvalAuditLog.findMany as any).mockResolvedValue(actorAudits);

      // ACT
      const result = await auditService.getActorAuditTrail(mockActorId);

      // ASSERT
      expect(result).toHaveLength(1);
      expect(prisma.approvalAuditLog.findMany).toHaveBeenCalledWith({
        where: { actorId: mockActorId },
        orderBy: { timestamp: 'desc' },
      });
    });
  });

  describe('Compliance Reporting - RED PHASE', () => {
    it('should generate compliance report for date range', async () => {
      // ARRANGE
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const auditStats = {
        totalEvents: 150,
        byEventType: {
          [AuditEvent.WORKFLOW_CREATED]: 25,
          [AuditEvent.ACTION_TAKEN]: 100,
          [AuditEvent.DELEGATION_CREATED]: 15,
          [AuditEvent.EMERGENCY_BYPASS]: 2,
        },
        byActor: {
          'manager-123': 50,
          'finance-123': 75,
          'director-123': 25,
        },
      };

      vi.spyOn(auditService, 'generateAuditStats').mockResolvedValue(auditStats);

      // ACT
      const report = await auditService.generateComplianceReport(startDate, endDate);

      // ASSERT
      expect(report.period.start).toEqual(startDate);
      expect(report.period.end).toEqual(endDate);
      expect(report.totalEvents).toBe(150);
      expect(report.emergencyBypassCount).toBe(2);
    });

    it('should detect suspicious audit patterns', async () => {
      // ARRANGE
      const suspiciousAudits = [
        {
          id: 'audit-suspicious-1',
          event: AuditEvent.EMERGENCY_BYPASS,
          actorId: 'user-suspicious',
          timestamp: new Date(),
        },
        {
          id: 'audit-suspicious-2',
          event: AuditEvent.EMERGENCY_BYPASS,
          actorId: 'user-suspicious',
          timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        },
      ];

      (prisma.approvalAuditLog.findMany as any).mockResolvedValue(suspiciousAudits);

      // ACT
      const suspiciousActivities = await auditService.detectSuspiciousPatterns();

      // ASSERT
      expect(suspiciousActivities).toHaveLength(1);
      expect(suspiciousActivities[0].pattern).toBe('MULTIPLE_EMERGENCY_BYPASSES');
      expect(suspiciousActivities[0].actorId).toBe('user-suspicious');
    });

    it('should track approval velocity metrics', async () => {
      // ARRANGE
      const velocityData = [
        {
          workflowId: 'workflow-1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          completedAt: new Date('2024-01-01T11:30:00Z'), // 1.5 hours
        },
        {
          workflowId: 'workflow-2',
          createdAt: new Date('2024-01-02T09:00:00Z'),
          completedAt: new Date('2024-01-02T10:00:00Z'), // 1 hour
        },
      ];

      vi.spyOn(auditService, 'getWorkflowCompletionData').mockResolvedValue(velocityData);

      // ACT
      const metrics = await auditService.calculateApprovalVelocity();

      // ASSERT
      expect(metrics.averageCompletionTime).toBe(1.25); // hours
      expect(metrics.medianCompletionTime).toBe(1.25);
      expect(metrics.totalWorkflows).toBe(2);
    });
  });

  describe('Data Retention and Archival - RED PHASE', () => {
    it('should archive old audit entries', async () => {
      // ARRANGE
      const retentionDate = new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000); // 7 years ago
      const oldAudits = [
        { id: 'audit-old-1', timestamp: new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000) },
        { id: 'audit-old-2', timestamp: new Date(Date.now() - 9 * 365 * 24 * 60 * 60 * 1000) },
      ];

      (prisma.approvalAuditLog.findMany as any).mockResolvedValue(oldAudits);

      // ACT
      const archivedCount = await auditService.archiveOldAuditEntries(retentionDate);

      // ASSERT
      expect(archivedCount).toBe(2);
    });

    it('should maintain audit data integrity during archival', async () => {
      // ARRANGE
      const auditEntry = {
        id: 'audit-archive',
        integrityHash: 'original-hash',
      };

      // ACT
      const archivedEntry = await auditService.archiveAuditEntry(auditEntry);

      // ASSERT
      expect(archivedEntry.integrityHash).toBe('original-hash');
      expect(archivedEntry.archivedAt).toBeDefined();
      expect(archivedEntry.isArchived).toBe(true);
    });

    it('should support audit data export for compliance', async () => {
      // ARRANGE
      const exportCriteria = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        format: 'JSON',
        includeMetadata: true,
      };

      const auditData = [
        { id: 'audit-1', event: AuditEvent.WORKFLOW_CREATED },
        { id: 'audit-2', event: AuditEvent.ACTION_TAKEN },
      ];

      (prisma.approvalAuditLog.findMany as any).mockResolvedValue(auditData);

      // ACT
      const exportData = await auditService.exportAuditData(exportCriteria);

      // ASSERT
      expect(exportData.format).toBe('JSON');
      expect(exportData.entries).toHaveLength(2);
      expect(exportData.metadata.exportedAt).toBeDefined();
      expect(exportData.metadata.integrityChecksum).toBeDefined();
    });
  });

  describe('Performance and Optimization - RED PHASE', () => {
    it('should implement efficient querying for large audit datasets', async () => {
      // ARRANGE
      const largeDatasetQuery = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        pageSize: 1000,
        offset: 0,
      };

      (prisma.approvalAuditLog.count as any).mockResolvedValue(50000);
      (prisma.approvalAuditLog.findMany as any).mockResolvedValue([]);

      // ACT
      const result = await auditService.queryAuditTrailPaginated(largeDatasetQuery);

      // ASSERT
      expect(result.totalCount).toBe(50000);
      expect(result.pageSize).toBe(1000);
      expect(prisma.approvalAuditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          timestamp: {
            gte: largeDatasetQuery.startDate,
            lte: largeDatasetQuery.endDate,
          },
        }),
        take: 1000,
        skip: 0,
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should implement audit log compression for storage efficiency', async () => {
      // ARRANGE
      const auditEntry = {
        id: 'audit-compress',
        newValues: {
          largeObject: 'x'.repeat(10000), // Large data
          metadata: { field1: 'value1', field2: 'value2' },
        },
      };

      // ACT
      const compressedEntry = await auditService.compressAuditEntry(auditEntry);

      // ASSERT
      expect(compressedEntry.isCompressed).toBe(true);
      expect(compressedEntry.compressionRatio).toBeGreaterThan(0.5);
      expect(compressedEntry.originalSize).toBeGreaterThan(compressedEntry.compressedSize);
    });

    it('should provide real-time audit streaming for monitoring', async () => {
      // ARRANGE
      const mockEventEmitter = vi.fn();
      const mockEmitter = {
        emit: mockEventEmitter,
        on: vi.fn(),
      };
      
      // Mock the eventEmitter property directly
      auditService['eventEmitter'] = mockEmitter;

      const auditData = {
        event: AuditEvent.EMERGENCY_BYPASS,
        entityType: 'WORKFLOW',
        entityId: mockWorkflowId,
        actorId: mockActorId,
      };

      const expectedAuditLog = { 
        id: 'audit-emergency', 
        ...auditData, 
        timestamp: new Date(),
        integrityHash: 'b'.repeat(64) 
      };
      (prisma.approvalAuditLog.create as any).mockResolvedValue(expectedAuditLog);

      // ACT
      await auditService.createAuditEntry(auditData);

      // ASSERT
      expect(mockEventEmitter).toHaveBeenCalledWith('audit:emergency_bypass', {
        auditEntry: expect.objectContaining(auditData),
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Error Handling and Resilience - RED PHASE', () => {
    it('should handle database failures gracefully', async () => {
      // ARRANGE
      (prisma.approvalAuditLog.create as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      const auditData = {
        event: AuditEvent.WORKFLOW_CREATED,
        entityType: 'WORKFLOW',
        entityId: mockWorkflowId,
        actorId: mockActorId,
      };

      // ACT & ASSERT
      await expect(
        auditService.createAuditEntry(auditData)
      ).rejects.toThrow('Failed to create audit entry');
    });

    it('should implement audit entry retry mechanism', async () => {
      // ARRANGE
      (prisma.approvalAuditLog.create as any)
        .mockRejectedValueOnce(new Error('Temporary database error'))
        .mockRejectedValueOnce(new Error('Temporary database error'))
        .mockResolvedValueOnce({ id: 'audit-retry-success' });

      const auditData = {
        event: AuditEvent.ACTION_TAKEN,
        entityType: 'ACTION',
        entityId: 'action-123',
        actorId: mockActorId,
      };

      // ACT
      const result = await auditService.createAuditEntryWithRetry(auditData, 3);

      // ASSERT
      expect(result.id).toBe('audit-retry-success');
      expect(prisma.approvalAuditLog.create).toHaveBeenCalledTimes(3);
    });

    it('should maintain audit consistency during system failures', async () => {
      // ARRANGE
      const criticalAuditData = {
        event: AuditEvent.EMERGENCY_BYPASS,
        entityType: 'WORKFLOW',
        entityId: mockWorkflowId,
        actorId: mockActorId,
      };

      // Mock system failure scenario
      vi.spyOn(auditService, 'isSystemHealthy').mockReturnValue(false);

      // ACT
      const result = await auditService.createCriticalAuditEntry(criticalAuditData);

      // ASSERT
      expect(result.failsafeMode).toBe(true);
      expect(result.queued).toBe(true); // Should queue for later processing
    });
  });
});