/**
 * @file Unit tests for Audit Service
 * @description TDD Tests for approval workflow audit trail and compliance
 * Following RED-GREEN-REFACTOR cycle
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { AuditService } from '@/lib/approval-workflow/audit-service'
import { db } from '@/lib/prisma'
import type { ApprovalAuditLog, ApprovalWorkflow, ApprovalAction } from '@prisma/client'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  db: {
    approvalAuditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    approvalWorkflow: {
      findMany: vi.fn(),
    },
    approvalAction: {
      findMany: vi.fn(),
    },
  },
}))

// Mock request context for IP tracking
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((header: string) => {
      if (header === 'x-forwarded-for') return '192.168.1.1'
      if (header === 'user-agent') return 'Mozilla/5.0 Test Browser'
      return null
    }),
  })),
}))

describe('AuditService', () => {
  let auditService: AuditService
  let mockAuditLog: ApprovalAuditLog
  let mockWorkflow: ApprovalWorkflow
  let mockAction: ApprovalAction

  beforeEach(() => {
    vi.clearAllMocks()
    auditService = new AuditService()

    mockWorkflow = {
      id: 'workflow1',
      userId: 'user1',
      invoiceId: 'invoice1',
      ruleId: 'rule1',
      status: 'PENDING',
      currentLevel: 1,
      requiredLevel: 2,
      initiatedBy: 'user1',
      initiatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ApprovalWorkflow

    mockAction = {
      id: 'action1',
      workflowId: 'workflow1',
      roleId: 'role1',
      action: 'APPROVE',
      level: 1,
      decidedBy: 'approver1',
      decidedAt: new Date(),
      comments: 'Looks good',
    } as ApprovalAction

    mockAuditLog = {
      id: 'audit1',
      workflowId: 'workflow1',
      event: 'ACTION_TAKEN',
      entityType: 'WORKFLOW',
      entityId: 'workflow1',
      actorId: 'approver1',
      actorRole: 'MANAGER',
      oldValues: { status: 'PENDING', currentLevel: 1 },
      newValues: { status: 'PENDING', currentLevel: 2 },
      changeReason: 'Approval granted',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Test Browser',
      timestamp: new Date(),
    } as ApprovalAuditLog
  })

  describe('Service Initialization', () => {
    test('should throw error when AuditService is not implemented', () => {
      // RED: This test should fail initially
      expect(() => new AuditService()).toThrow('AuditService not implemented')
    })
  })

  describe('Audit Log Creation', () => {
    test('should log workflow creation event', async () => {
      // RED: This test should fail initially
      const workflowCreatedLog = {
        ...mockAuditLog,
        event: 'WORKFLOW_CREATED',
        oldValues: null,
        newValues: mockWorkflow,
        changeReason: 'Invoice submitted for approval',
      }

      vi.mocked(db.approvalAuditLog.create).mockResolvedValue(workflowCreatedLog)

      const result = await auditService.logWorkflowCreated(mockWorkflow, 'user1')

      expect(db.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event: 'WORKFLOW_CREATED',
          entityType: 'WORKFLOW',
          entityId: 'workflow1',
          actorId: 'user1',
          newValues: expect.objectContaining({
            id: 'workflow1',
            status: 'PENDING',
          }),
          oldValues: null,
        }),
      })
      expect(result.event).toBe('WORKFLOW_CREATED')
    })

    test('should log approval action with complete context', async () => {
      // RED: This test should fail initially
      const actionLog = {
        ...mockAuditLog,
        event: 'ACTION_TAKEN',
        newValues: mockAction,
        changeReason: 'Approval action taken',
      }

      vi.mocked(db.approvalAuditLog.create).mockResolvedValue(actionLog)

      const result = await auditService.logApprovalAction(
        mockAction,
        mockWorkflow,
        { currentLevel: 1 },
        { currentLevel: 2 }
      )

      expect(db.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event: 'ACTION_TAKEN',
          entityType: 'WORKFLOW',
          entityId: 'workflow1',
          actorId: 'approver1',
          oldValues: { currentLevel: 1 },
          newValues: { currentLevel: 2 },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser',
        }),
      })
      expect(result.event).toBe('ACTION_TAKEN')
    })

    test('should log rule configuration changes', async () => {
      // RED: This test should fail initially
      const ruleChangeLog = {
        ...mockAuditLog,
        event: 'RULE_CHANGED',
        entityType: 'RULE',
        entityId: 'rule1',
        oldValues: { maxAmount: 50000 },
        newValues: { maxAmount: 100000 },
        changeReason: 'Increased approval limit',
      }

      vi.mocked(db.approvalAuditLog.create).mockResolvedValue(ruleChangeLog)

      const result = await auditService.logRuleChange(
        'rule1',
        'admin1',
        { maxAmount: 50000 },
        { maxAmount: 100000 },
        'Increased approval limit'
      )

      expect(db.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event: 'RULE_CHANGED',
          entityType: 'RULE',
          entityId: 'rule1',
          actorId: 'admin1',
          changeReason: 'Increased approval limit',
        }),
      })
      expect(result.event).toBe('RULE_CHANGED')
    })

    test('should log delegation creation', async () => {
      // RED: This test should fail initially
      const delegationLog = {
        ...mockAuditLog,
        event: 'DELEGATION_CREATED',
        entityType: 'DELEGATION',
        entityId: 'delegation1',
        newValues: {
          fromRoleId: 'role1',
          toUserId: 'delegate1',
          reason: 'Vacation coverage',
        },
      }

      vi.mocked(db.approvalAuditLog.create).mockResolvedValue(delegationLog)

      const result = await auditService.logDelegationCreated(
        'delegation1',
        'user1',
        'MANAGER',
        {
          fromRoleId: 'role1',
          toUserId: 'delegate1',
          reason: 'Vacation coverage',
        }
      )

      expect(db.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event: 'DELEGATION_CREATED',
          entityType: 'DELEGATION',
          entityId: 'delegation1',
          actorId: 'user1',
          actorRole: 'MANAGER',
        }),
      })
      expect(result.event).toBe('DELEGATION_CREATED')
    })

    test('should log workflow bypass with justification', async () => {
      // RED: This test should fail initially
      const bypassLog = {
        ...mockAuditLog,
        event: 'WORKFLOW_BYPASSED',
        changeReason: 'Emergency approval required',
        newValues: {
          bypassedBy: 'admin1',
          bypassReason: 'Emergency approval required',
          finalDecision: 'APPROVED',
        },
      }

      vi.mocked(db.approvalAuditLog.create).mockResolvedValue(bypassLog)

      const result = await auditService.logWorkflowBypass(
        mockWorkflow,
        'admin1',
        'ADMIN',
        'Emergency approval required'
      )

      expect(db.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event: 'WORKFLOW_BYPASSED',
          actorId: 'admin1',
          actorRole: 'ADMIN',
          changeReason: 'Emergency approval required',
        }),
      })
      expect(result.event).toBe('WORKFLOW_BYPASSED')
    })

    test('should capture session context for audit trail', async () => {
      // RED: This test should fail initially
      const sessionContext = {
        ipAddress: '10.0.0.1',
        userAgent: 'Custom App',
        sessionId: 'session123',
      }

      vi.mocked(db.approvalAuditLog.create).mockResolvedValue(mockAuditLog)

      await auditService.logWithContext(
        'ACTION_TAKEN',
        'WORKFLOW',
        'workflow1',
        'user1',
        null,
        mockAction,
        sessionContext
      )

      expect(db.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '10.0.0.1',
          userAgent: 'Custom App',
          sessionId: 'session123',
        }),
      })
    })
  })

  describe('Audit Trail Queries', () => {
    test('should get complete audit trail for workflow', async () => {
      // RED: This test should fail initially
      const workflowAuditLogs = [
        {
          ...mockAuditLog,
          event: 'WORKFLOW_CREATED',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
        {
          ...mockAuditLog,
          event: 'ACTION_TAKEN',
          timestamp: new Date('2024-01-01T11:00:00Z'),
        },
        {
          ...mockAuditLog,
          event: 'WORKFLOW_COMPLETED',
          timestamp: new Date('2024-01-01T12:00:00Z'),
        },
      ]

      vi.mocked(db.approvalAuditLog.findMany).mockResolvedValue(workflowAuditLogs)

      const result = await auditService.getWorkflowAuditTrail('workflow1')

      expect(result).toHaveLength(3)
      expect(result[0].event).toBe('WORKFLOW_CREATED')
      expect(result[2].event).toBe('WORKFLOW_COMPLETED')
      expect(db.approvalAuditLog.findMany).toHaveBeenCalledWith({
        where: { workflowId: 'workflow1' },
        orderBy: { timestamp: 'asc' },
        include: expect.any(Object),
      })
    })

    test('should get audit logs by actor', async () => {
      // RED: This test should fail initially
      const actorLogs = [
        {
          ...mockAuditLog,
          actorId: 'user1',
          event: 'ACTION_TAKEN',
        },
        {
          ...mockAuditLog,
          actorId: 'user1',
          event: 'RULE_CHANGED',
        },
      ]

      vi.mocked(db.approvalAuditLog.findMany).mockResolvedValue(actorLogs)

      const result = await auditService.getAuditLogsByActor('user1')

      expect(result).toHaveLength(2)
      expect(db.approvalAuditLog.findMany).toHaveBeenCalledWith({
        where: { actorId: 'user1' },
        orderBy: { timestamp: 'desc' },
        include: expect.any(Object),
      })
    })

    test('should get audit logs by time range', async () => {
      // RED: This test should fail initially
      const startDate = new Date('2024-01-01T00:00:00Z')
      const endDate = new Date('2024-01-31T23:59:59Z')

      const timeRangeLogs = [mockAuditLog]

      vi.mocked(db.approvalAuditLog.findMany).mockResolvedValue(timeRangeLogs)

      const result = await auditService.getAuditLogsByTimeRange(startDate, endDate)

      expect(result).toHaveLength(1)
      expect(db.approvalAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
        include: expect.any(Object),
      })
    })

    test('should get audit logs by event type', async () => {
      // RED: This test should fail initially
      const actionLogs = [
        {
          ...mockAuditLog,
          event: 'ACTION_TAKEN',
        },
      ]

      vi.mocked(db.approvalAuditLog.findMany).mockResolvedValue(actionLogs)

      const result = await auditService.getAuditLogsByEvent('ACTION_TAKEN')

      expect(result).toHaveLength(1)
      expect(result[0].event).toBe('ACTION_TAKEN')
      expect(db.approvalAuditLog.findMany).toHaveBeenCalledWith({
        where: { event: 'ACTION_TAKEN' },
        orderBy: { timestamp: 'desc' },
        include: expect.any(Object),
      })
    })

    test('should search audit logs with filters', async () => {
      // RED: This test should fail initially
      const filters = {
        actorId: 'user1',
        event: 'ACTION_TAKEN',
        entityType: 'WORKFLOW',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      }

      const filteredLogs = [mockAuditLog]

      vi.mocked(db.approvalAuditLog.findMany).mockResolvedValue(filteredLogs)

      const result = await auditService.searchAuditLogs(filters)

      expect(result).toHaveLength(1)
      expect(db.approvalAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          actorId: 'user1',
          event: 'ACTION_TAKEN',
          entityType: 'WORKFLOW',
          timestamp: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
        include: expect.any(Object),
      })
    })
  })

  describe('Compliance Reporting', () => {
    test('should generate approval summary report', async () => {
      // RED: This test should fail initially
      const approvalActions = [
        { action: 'APPROVE', count: 45 },
        { action: 'REJECT', count: 5 },
        { action: 'REQUEST_CHANGES', count: 10 },
      ]

      vi.mocked(db.approvalAction.findMany).mockResolvedValue([
        { action: 'APPROVE' },
        { action: 'APPROVE' },
        { action: 'REJECT' },
      ] as any)

      const result = await auditService.generateApprovalSummary(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )

      expect(result).toHaveProperty('totalApprovals')
      expect(result).toHaveProperty('totalRejections')
      expect(result).toHaveProperty('averageProcessingTime')
      expect(result).toHaveProperty('complianceScore')
    })

    test('should calculate approval velocity metrics', async () => {
      // RED: This test should fail initially
      const workflows = [
        {
          initiatedAt: new Date('2024-01-01T10:00:00Z'),
          completedAt: new Date('2024-01-01T12:00:00Z'),
        },
        {
          initiatedAt: new Date('2024-01-02T09:00:00Z'),
          completedAt: new Date('2024-01-02T15:00:00Z'),
        },
      ]

      vi.mocked(db.approvalWorkflow.findMany).mockResolvedValue(workflows as any)

      const result = await auditService.calculateApprovalVelocity(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )

      expect(result).toHaveProperty('averageProcessingHours')
      expect(result).toHaveProperty('fastestApproval')
      expect(result).toHaveProperty('slowestApproval')
      expect(result).toHaveProperty('withinSLAPercentage')
    })

    test('should generate compliance report', async () => {
      // RED: This test should fail initially
      const auditLogs = [
        {
          ...mockAuditLog,
          event: 'ACTION_TAKEN',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
        {
          ...mockAuditLog,
          event: 'WORKFLOW_BYPASSED',
          timestamp: new Date('2024-01-02T11:00:00Z'),
        },
      ]

      vi.mocked(db.approvalAuditLog.findMany).mockResolvedValue(auditLogs)
      vi.mocked(db.approvalAuditLog.count).mockResolvedValue(2)

      const result = await auditService.generateComplianceReport(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )

      expect(result).toHaveProperty('totalActivities')
      expect(result).toHaveProperty('bypassCount')
      expect(result).toHaveProperty('auditTrailCompleteness')
      expect(result).toHaveProperty('segregationOfDuties')
      expect(result).toHaveProperty('complianceScore')
      expect(result.complianceScore).toBeGreaterThanOrEqual(0)
      expect(result.complianceScore).toBeLessThanOrEqual(100)
    })

    test('should identify suspicious activities', async () => {
      // RED: This test should fail initially
      const suspiciousLogs = [
        {
          ...mockAuditLog,
          event: 'WORKFLOW_BYPASSED',
          actorId: 'user1',
          timestamp: new Date(),
        },
        {
          ...mockAuditLog,
          event: 'WORKFLOW_BYPASSED',
          actorId: 'user1',
          timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        },
      ]

      vi.mocked(db.approvalAuditLog.findMany).mockResolvedValue(suspiciousLogs)

      const result = await auditService.identifySuspiciousActivities(
        new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        new Date()
      )

      expect(result).toHaveProperty('frequentBypasses')
      expect(result).toHaveProperty('offHoursActivity')
      expect(result).toHaveProperty('unusualPatterns')
      expect(result.frequentBypasses).toHaveLength(1) // user1 with 2 bypasses
    })
  })

  describe('Data Integrity and Security', () => {
    test('should ensure audit log immutability', async () => {
      // RED: This test should fail initially
      const logId = 'audit1'

      await expect(auditService.updateAuditLog(logId, { event: 'MODIFIED' }))
        .rejects.toThrow('Audit logs are immutable')
    })

    test('should validate audit log data integrity', async () => {
      // RED: This test should fail initially
      const invalidLog = {
        event: 'ACTION_TAKEN',
        entityType: 'WORKFLOW',
        entityId: 'workflow1',
        actorId: '', // Invalid: empty actor ID
        timestamp: new Date(),
      }

      await expect(auditService.validateAuditLog(invalidLog))
        .rejects.toThrow('Invalid audit log: actorId is required')
    })

    test('should encrypt sensitive audit data', async () => {
      // RED: This test should fail initially
      const sensitiveData = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        sessionId: 'session123',
      }

      vi.mocked(db.approvalAuditLog.create).mockResolvedValue(mockAuditLog)

      await auditService.logWithSensitiveData(
        'ACTION_TAKEN',
        'WORKFLOW',
        'workflow1',
        'user1',
        null,
        mockAction,
        sensitiveData
      )

      expect(db.approvalAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: expect.not.stringMatching('192.168.1.1'), // Should be encrypted
          userAgent: expect.any(String),
          sessionId: expect.any(String),
        }),
      })
    })

    test('should maintain audit log retention policy', async () => {
      // RED: This test should fail initially
      const retentionDate = new Date()
      retentionDate.setFullYear(retentionDate.getFullYear() - 7) // 7 years ago

      await auditService.applyRetentionPolicy(retentionDate)

      expect(db.approvalAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            lt: retentionDate,
          },
        },
        select: { id: true },
      })
    })

    test('should export audit logs for compliance', async () => {
      // RED: This test should fail initially
      const exportParams = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        format: 'CSV',
        includePersonalData: false,
      }

      const result = await auditService.exportAuditLogs(exportParams)

      expect(result).toHaveProperty('filename')
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('recordCount')
      expect(result.filename).toContain('.csv')
    })
  })
})