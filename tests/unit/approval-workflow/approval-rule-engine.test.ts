/**
 * @file Unit tests for Approval Rule Engine
 * @description TDD Tests for approval rule configuration and evaluation
 * Following RED-GREEN-REFACTOR cycle
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ApprovalRuleEngine } from '@/lib/approval-workflow/rule-engine'
import { db } from '@/lib/prisma'
import type { ApprovalRule, Invoice, User } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  db: {
    approvalRule: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    approvalWorkflow: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    approvalRole: {
      findMany: vi.fn(),
    },
  },
}))

describe('ApprovalRuleEngine', () => {
  let ruleEngine: ApprovalRuleEngine
  let mockUser: User
  let mockInvoice: Invoice
  let mockRules: ApprovalRule[]

  beforeEach(() => {
    vi.clearAllMocks()
    ruleEngine = new ApprovalRuleEngine()
    
    mockUser = {
      id: 'user1',
      email: 'user@example.com',
      name: 'Test User',
      gstin: 'TEST123456789',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User

    mockInvoice = {
      id: 'invoice1',
      userId: 'user1',
      clientId: 'client1',
      invoiceNumber: 'FY24-25/001',
      invoiceDate: new Date(),
      dueDate: new Date(),
      status: 'DRAFT',
      invoiceType: 'EXPORT',
      currency: 'USD',
      exchangeRate: new Decimal(83.5),
      subtotal: new Decimal(1000),
      totalAmount: new Decimal(1000),
      totalInINR: new Decimal(83500),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Invoice

    mockRules = [
      {
        id: 'rule1',
        userId: 'user1',
        name: 'Low Amount Rule',
        description: 'For invoices under ₹50,000',
        minAmount: new Decimal(0),
        maxAmount: new Decimal(50000),
        currency: 'INR',
        invoiceType: null,
        clientCategory: null,
        requiredApprovals: 1,
        parallelApproval: false,
        approverRoles: ['MANAGER'],
        isActive: true,
        priority: 1,
        approvalTimeout: 24,
        escalateToRole: 'FINANCE_HEAD',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule2',
        userId: 'user1',
        name: 'High Amount Rule',
        description: 'For invoices above ₹50,000',
        minAmount: new Decimal(50000),
        maxAmount: null,
        currency: 'INR',
        invoiceType: null,
        clientCategory: null,
        requiredApprovals: 2,
        parallelApproval: false,
        approverRoles: ['MANAGER', 'FINANCE_HEAD'],
        isActive: true,
        priority: 2,
        approvalTimeout: 48,
        escalateToRole: 'DIRECTOR',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as ApprovalRule[]
  })

  describe('Rule Evaluation', () => {
    test('should create ApprovalRuleEngine instance', async () => {
      // GREEN: This test should pass now that implementation exists
      expect(() => new ApprovalRuleEngine()).not.toThrow()
      const engine = new ApprovalRuleEngine()
      expect(engine).toBeInstanceOf(ApprovalRuleEngine)
    })

    test('should evaluate rules for low amount invoice', async () => {
      // RED: This test should fail initially
      const lowAmountInvoice = {
        ...mockInvoice,
        totalInINR: new Decimal(30000), // ₹30,000
      }

      vi.mocked(db.approvalRule.findMany).mockResolvedValue([mockRules[0]])

      const matchingRules = await ruleEngine.evaluateRules(lowAmountInvoice)

      expect(matchingRules).toHaveLength(1)
      expect(matchingRules[0].name).toBe('Low Amount Rule')
      expect(matchingRules[0].requiredApprovals).toBe(1)
      expect(matchingRules[0].approverRoles).toEqual(['MANAGER'])
    })

    test('should evaluate rules for high amount invoice', async () => {
      // RED: This test should fail initially
      const highAmountInvoice = {
        ...mockInvoice,
        totalInINR: new Decimal(100000), // ₹1,00,000
      }

      vi.mocked(db.approvalRule.findMany).mockResolvedValue([mockRules[1]])

      const matchingRules = await ruleEngine.evaluateRules(highAmountInvoice)

      expect(matchingRules).toHaveLength(1)
      expect(matchingRules[0].name).toBe('High Amount Rule')
      expect(matchingRules[0].requiredApprovals).toBe(2)
      expect(matchingRules[0].approverRoles).toEqual(['MANAGER', 'FINANCE_HEAD'])
    })

    test('should prioritize rules by priority order', async () => {
      // RED: This test should fail initially
      const invoice = {
        ...mockInvoice,
        totalInINR: new Decimal(60000), // Matches both rules
      }

      vi.mocked(db.approvalRule.findMany).mockResolvedValue(mockRules)

      const matchingRules = await ruleEngine.evaluateRules(invoice)

      expect(matchingRules[0].priority).toBeGreaterThanOrEqual(matchingRules[1]?.priority || 0)
    })

    test('should filter rules by invoice type', async () => {
      // RED: This test should fail initially
      const exportRule = {
        ...mockRules[0],
        invoiceType: 'EXPORT',
        name: 'Export Rule',
      }

      const domesticInvoice = {
        ...mockInvoice,
        invoiceType: 'DOMESTIC_B2B',
        totalInINR: new Decimal(30000),
      }

      vi.mocked(db.approvalRule.findMany).mockResolvedValue([exportRule])

      const matchingRules = await ruleEngine.evaluateRules(domesticInvoice)

      expect(matchingRules).toHaveLength(0)
    })

    test('should filter rules by currency', async () => {
      // RED: This test should fail initially
      const usdRule = {
        ...mockRules[0],
        currency: 'USD',
        minAmount: new Decimal(500),
        maxAmount: new Decimal(1000),
      }

      const usdInvoice = {
        ...mockInvoice,
        currency: 'USD',
        totalAmount: new Decimal(750),
      }

      vi.mocked(db.approvalRule.findMany).mockResolvedValue([usdRule])

      const matchingRules = await ruleEngine.evaluateRules(usdInvoice)

      expect(matchingRules).toHaveLength(1)
    })

    test('should return empty array when no rules match', async () => {
      // RED: This test should fail initially
      const veryLowAmountInvoice = {
        ...mockInvoice,
        totalInINR: new Decimal(100), // Very low amount
      }

      vi.mocked(db.approvalRule.findMany).mockResolvedValue([])

      const matchingRules = await ruleEngine.evaluateRules(veryLowAmountInvoice)

      expect(matchingRules).toHaveLength(0)
    })

    test('should handle inactive rules', async () => {
      // RED: This test should fail initially
      const inactiveRule = {
        ...mockRules[0],
        isActive: false,
      }

      vi.mocked(db.approvalRule.findMany).mockResolvedValue([inactiveRule])

      const matchingRules = await ruleEngine.evaluateRules(mockInvoice)

      expect(matchingRules).toHaveLength(0)
    })
  })

  describe('Workflow Creation', () => {
    test('should create workflow with single rule', async () => {
      // RED: This test should fail initially
      const mockWorkflow = {
        id: 'workflow1',
        userId: mockInvoice.userId,
        invoiceId: mockInvoice.id,
        ruleId: mockRules[0].id,
        status: 'PENDING',
        currentLevel: 1,
        requiredLevel: 1,
        initiatedBy: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(db.approvalWorkflow.create).mockResolvedValue(mockWorkflow)

      const workflow = await ruleEngine.createWorkflow(mockInvoice, [mockRules[0]], mockUser.id)

      expect(workflow).toBeDefined()
      expect(workflow.status).toBe('PENDING')
      expect(workflow.currentLevel).toBe(1)
      expect(workflow.requiredLevel).toBe(1)
      expect(workflow.invoiceId).toBe(mockInvoice.id)
    })

    test('should create workflow with multiple approval levels', async () => {
      // RED: This test should fail initially
      const multiLevelRule = {
        ...mockRules[1],
        requiredApprovals: 3,
        approverRoles: ['MANAGER', 'FINANCE_HEAD', 'DIRECTOR'],
      }

      const mockWorkflow = {
        id: 'workflow2',
        userId: mockInvoice.userId,
        invoiceId: mockInvoice.id,
        ruleId: multiLevelRule.id,
        status: 'PENDING',
        currentLevel: 1,
        requiredLevel: 3,
        initiatedBy: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(db.approvalWorkflow.create).mockResolvedValue(mockWorkflow)

      const workflow = await ruleEngine.createWorkflow(mockInvoice, [multiLevelRule], mockUser.id)

      expect(workflow.requiredLevel).toBe(3)
    })

    test('should set due date based on approval timeout', async () => {
      // RED: This test should fail initially
      const ruleWithTimeout = {
        ...mockRules[0],
        approvalTimeout: 24, // 24 hours
      }

      const expectedDueDate = new Date()
      expectedDueDate.setHours(expectedDueDate.getHours() + 24)

      const mockWorkflow = {
        id: 'workflow3',
        userId: mockInvoice.userId,
        invoiceId: mockInvoice.id,
        ruleId: ruleWithTimeout.id,
        status: 'PENDING',
        currentLevel: 1,
        requiredLevel: 1,
        initiatedBy: mockUser.id,
        dueDate: expectedDueDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(db.approvalWorkflow.create).mockResolvedValue(mockWorkflow)

      const workflow = await ruleEngine.createWorkflow(mockInvoice, [ruleWithTimeout], mockUser.id)

      expect(workflow.dueDate).toBeDefined()
      const dueDateDiff = Math.abs(workflow.dueDate!.getTime() - expectedDueDate.getTime())
      expect(dueDateDiff).toBeLessThan(60000) // Within 1 minute
    })

    test('should throw error when creating workflow for invoice that already has one', async () => {
      // RED: This test should fail initially
      vi.mocked(db.approvalWorkflow.findUnique).mockResolvedValue({
        id: 'existing-workflow',
        invoiceId: mockInvoice.id,
      } as any)

      await expect(
        ruleEngine.createWorkflow(mockInvoice, [mockRules[0]], mockUser.id)
      ).rejects.toThrow('Invoice already has an approval workflow')
    })
  })

  describe('Approval Requirements Calculation', () => {
    test('should calculate simple approval requirement', async () => {
      // RED: This test should fail initially
      const amount = new Decimal(25000)
      const currency = 'INR'

      vi.mocked(db.approvalRule.findMany).mockResolvedValue([mockRules[0]])

      const requirement = await ruleEngine.calculateRequiredApprovals(amount, currency)

      expect(requirement.levels).toEqual([1])
      expect(requirement.roles).toEqual(['MANAGER'])
      expect(requirement.parallelApproval).toBe(false)
      expect(requirement.timeoutHours).toBe(24)
    })

    test('should calculate multi-level approval requirement', async () => {
      // RED: This test should fail initially
      const amount = new Decimal(100000)
      const currency = 'INR'

      vi.mocked(db.approvalRule.findMany).mockResolvedValue([mockRules[1]])

      const requirement = await ruleEngine.calculateRequiredApprovals(amount, currency)

      expect(requirement.levels).toEqual([1, 2])
      expect(requirement.roles).toEqual(['MANAGER', 'FINANCE_HEAD'])
      expect(requirement.parallelApproval).toBe(false)
      expect(requirement.timeoutHours).toBe(48)
    })

    test('should handle parallel approval requirement', async () => {
      // RED: This test should fail initially
      const parallelRule = {
        ...mockRules[1],
        parallelApproval: true,
      }

      const amount = new Decimal(100000)
      const currency = 'INR'

      vi.mocked(db.approvalRule.findMany).mockResolvedValue([parallelRule])

      const requirement = await ruleEngine.calculateRequiredApprovals(amount, currency)

      expect(requirement.parallelApproval).toBe(true)
    })

    test('should return default requirement when no rules match', async () => {
      // RED: This test should fail initially
      const amount = new Decimal(10)
      const currency = 'INR'

      vi.mocked(db.approvalRule.findMany).mockResolvedValue([])

      const requirement = await ruleEngine.calculateRequiredApprovals(amount, currency)

      expect(requirement.levels).toEqual([])
      expect(requirement.roles).toEqual([])
      expect(requirement.parallelApproval).toBe(false)
      expect(requirement.timeoutHours).toBe(24) // Default timeout
    })
  })

  describe('Rule Validation', () => {
    test('should validate rule configuration', async () => {
      // RED: This test should fail initially
      const invalidRule = {
        ...mockRules[0],
        minAmount: new Decimal(100000),
        maxAmount: new Decimal(50000), // Invalid: min > max
      }

      const validation = await ruleEngine.validateRule(invalidRule)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Minimum amount cannot be greater than maximum amount')
    })

    test('should validate approver roles exist', async () => {
      // RED: This test should fail initially
      const invalidRule = {
        ...mockRules[0],
        approverRoles: ['NON_EXISTENT_ROLE'],
      }

      vi.mocked(db.approvalRole.findMany).mockResolvedValue([])

      const validation = await ruleEngine.validateRule(invalidRule)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Invalid approver role: NON_EXISTENT_ROLE')
    })

    test('should validate required approvals count', async () => {
      // RED: This test should fail initially
      const invalidRule = {
        ...mockRules[0],
        requiredApprovals: 5,
        approverRoles: ['MANAGER'], // Only 1 role but needs 5 approvals
      }

      const validation = await ruleEngine.validateRule(invalidRule)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Required approvals cannot exceed number of approver roles')
    })

    test('should pass validation for valid rule', async () => {
      // RED: This test should fail initially
      vi.mocked(db.approvalRole.findMany).mockResolvedValue([
        { name: 'MANAGER' },
        { name: 'FINANCE_HEAD' },
      ] as any)

      const validation = await ruleEngine.validateRule(mockRules[0])

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
  })
})