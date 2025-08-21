/**
 * TDD Tests for Approval Rule Engine
 * UOL-215: Invoice Approval Workflow System
 * 
 * RED PHASE: These tests should FAIL initially
 * Tests the rule evaluation logic for conditional approvals
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalRuleEngine } from '@/lib/approval-workflow/approval-rule-engine';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalRule: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
    },
  },
}));

describe('ApprovalRuleEngine - TDD Tests', () => {
  let ruleEngine: ApprovalRuleEngine;
  const mockUserId = 'user-123';
  
  const mockInvoice = {
    id: 'invoice-123',
    userId: mockUserId,
    totalAmount: new Decimal(75000),
    currency: 'INR',
    invoiceType: 'DOMESTIC_B2B',
    clientId: 'client-123',
    client: {
      id: 'client-123',
      name: 'ACME Corp',
      category: 'STANDARD', // Risk category
    },
  };

  const mockRules = [
    {
      id: 'rule-1',
      userId: mockUserId,
      name: 'Small Amount Rule',
      minAmount: new Decimal(0),
      maxAmount: new Decimal(50000),
      currency: 'INR',
      invoiceType: null, // Applies to all types
      clientCategory: null,
      requiredApprovals: 1,
      parallelApproval: false,
      approverRoles: ['MANAGER'],
      priority: 1,
      approvalTimeout: 24,
      escalateToRole: 'FINANCE_HEAD',
      isActive: true,
    },
    {
      id: 'rule-2',
      userId: mockUserId,
      name: 'Large Amount Rule',
      minAmount: new Decimal(50001),
      maxAmount: new Decimal(200000),
      currency: 'INR',
      invoiceType: null,
      clientCategory: null,
      requiredApprovals: 2,
      parallelApproval: false,
      approverRoles: ['MANAGER', 'FINANCE_HEAD'],
      priority: 2,
      approvalTimeout: 48,
      escalateToRole: 'DIRECTOR',
      isActive: true,
    },
    {
      id: 'rule-3',
      userId: mockUserId,
      name: 'High Risk Client Rule',
      minAmount: new Decimal(10000),
      maxAmount: null, // No upper limit
      currency: 'INR',
      invoiceType: null,
      clientCategory: 'HIGH_RISK',
      requiredApprovals: 3,
      parallelApproval: true, // All roles must approve
      approverRoles: ['MANAGER', 'FINANCE_HEAD', 'DIRECTOR'],
      priority: 10, // Highest priority
      approvalTimeout: 72,
      escalateToRole: 'CEO',
      isActive: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    ruleEngine = new ApprovalRuleEngine();
  });

  describe('Rule Creation - RED PHASE', () => {
    it('should create approval rule with valid conditions', async () => {
      // ARRANGE
      const ruleData = {
        userId: mockUserId,
        name: 'Test Rule',
        minAmount: new Decimal(10000),
        maxAmount: new Decimal(100000),
        currency: 'INR',
        requiredApprovals: 2,
        approverRoles: ['MANAGER', 'FINANCE_HEAD'],
        priority: 5,
      };
      const expectedRule = { id: 'rule-new', ...ruleData };
      (prisma.approvalRule.create as any).mockResolvedValue(expectedRule);

      // ACT
      const result = await ruleEngine.createRule(ruleData);

      // ASSERT
      expect(result).toEqual(expectedRule);
      expect(prisma.approvalRule.create).toHaveBeenCalledWith({
        data: ruleData,
      });
    });

    it('should validate amount ranges (min <= max)', async () => {
      // ARRANGE - Invalid range
      const invalidRuleData = {
        userId: mockUserId,
        name: 'Invalid Rule',
        minAmount: new Decimal(100000),
        maxAmount: new Decimal(50000), // max < min
        currency: 'INR',
        requiredApprovals: 1,
        approverRoles: ['MANAGER'],
      };

      // ACT & ASSERT
      await expect(
        ruleEngine.createRule(invalidRuleData)
      ).rejects.toThrow('Minimum amount cannot be greater than maximum amount');
    });

    it('should validate required approvals count', async () => {
      // ARRANGE - Zero approvals
      const invalidRuleData = {
        userId: mockUserId,
        name: 'Invalid Rule',
        requiredApprovals: 0, // Invalid
        approverRoles: ['MANAGER'],
      };

      // ACT & ASSERT
      await expect(
        ruleEngine.createRule(invalidRuleData)
      ).rejects.toThrow('Required approvals must be at least 1');
    });

    it('should validate approver roles array is not empty', async () => {
      // ARRANGE - Empty roles
      const invalidRuleData = {
        userId: mockUserId,
        name: 'Invalid Rule',
        requiredApprovals: 1,
        approverRoles: [], // Empty array
      };

      // ACT & ASSERT
      await expect(
        ruleEngine.createRule(invalidRuleData)
      ).rejects.toThrow('At least one approver role must be specified');
    });

    it('should validate priority values (0-100)', async () => {
      // ARRANGE - Invalid priority
      const invalidRuleData = {
        userId: mockUserId,
        name: 'Invalid Rule',
        priority: 150, // Out of range
        requiredApprovals: 1,
        approverRoles: ['MANAGER'],
      };

      // ACT & ASSERT
      await expect(
        ruleEngine.createRule(invalidRuleData)
      ).rejects.toThrow('Priority must be between 0 and 100');
    });
  });

  describe('Rule Evaluation - RED PHASE', () => {
    beforeEach(() => {
      (prisma.approvalRule.findMany as any).mockResolvedValue(mockRules);
    });

    it('should find matching rules for invoice amount', async () => {
      // ARRANGE - Invoice amount 75000 matches rule-2
      const invoice = { ...mockInvoice, totalAmount: new Decimal(75000) };

      // ACT
      const matchingRules = await ruleEngine.evaluateRules(invoice);

      // ASSERT
      expect(matchingRules).toHaveLength(1);
      expect(matchingRules[0].id).toBe('rule-2');
      expect(matchingRules[0].name).toBe('Large Amount Rule');
    });

    it('should apply highest priority rule when multiple match', async () => {
      // ARRANGE - High risk client with amount that matches multiple rules
      const highRiskInvoice = {
        ...mockInvoice,
        totalAmount: new Decimal(75000),
        client: { ...mockInvoice.client, category: 'HIGH_RISK' },
      };

      // ACT
      const matchingRules = await ruleEngine.evaluateRules(highRiskInvoice);

      // ASSERT
      expect(matchingRules).toHaveLength(1);
      expect(matchingRules[0].id).toBe('rule-3'); // Highest priority (10)
      expect(matchingRules[0].name).toBe('High Risk Client Rule');
    });

    it('should filter by invoice type when specified', async () => {
      // ARRANGE - Add export-specific rule
      const exportRule = {
        ...mockRules[0],
        id: 'rule-export',
        invoiceType: 'EXPORT',
        priority: 15, // Higher than others
      };
      const rulesWithExport = [...mockRules, exportRule];
      (prisma.approvalRule.findMany as any).mockResolvedValue(rulesWithExport);

      const exportInvoice = { ...mockInvoice, invoiceType: 'EXPORT' };

      // ACT
      const matchingRules = await ruleEngine.evaluateRules(exportInvoice);

      // ASSERT
      expect(matchingRules).toHaveLength(1);
      expect(matchingRules[0].id).toBe('rule-export');
    });

    it('should filter by client category when specified', async () => {
      // ARRANGE - High risk client
      const highRiskInvoice = {
        ...mockInvoice,
        client: { ...mockInvoice.client, category: 'HIGH_RISK' },
      };

      // ACT
      const matchingRules = await ruleEngine.evaluateRules(highRiskInvoice);

      // ASSERT
      expect(matchingRules).toHaveLength(1);
      expect(matchingRules[0].clientCategory).toBe('HIGH_RISK');
    });

    it('should handle currency conversion for amount matching', async () => {
      // ARRANGE - USD invoice with INR rules
      const usdInvoice = {
        ...mockInvoice,
        totalAmount: new Decimal(1000), // $1000
        currency: 'USD',
      };

      // Mock currency conversion (1 USD = 82.5 INR)
      vi.spyOn(ruleEngine, 'convertToBaseCurrency').mockResolvedValue(
        new Decimal(82500) // 1000 * 82.5
      );

      // ACT
      const matchingRules = await ruleEngine.evaluateRules(usdInvoice);

      // ASSERT
      expect(ruleEngine.convertToBaseCurrency).toHaveBeenCalledWith(
        new Decimal(1000),
        'USD',
        'INR'
      );
      expect(matchingRules).toHaveLength(1);
      expect(matchingRules[0].id).toBe('rule-2'); // 82500 falls in large amount range
    });

    it('should handle unlimited amount rules (null maxAmount)', async () => {
      // ARRANGE - Very large invoice amount
      const largeInvoice = {
        ...mockInvoice,
        totalAmount: new Decimal(5000000), // 50 lakh
      };

      // Add unlimited rule
      const unlimitedRule = {
        ...mockRules[1],
        id: 'rule-unlimited',
        minAmount: new Decimal(1000000),
        maxAmount: null, // No upper limit
        priority: 20,
      };
      const rulesWithUnlimited = [...mockRules, unlimitedRule];
      (prisma.approvalRule.findMany as any).mockResolvedValue(rulesWithUnlimited);

      // ACT
      const matchingRules = await ruleEngine.evaluateRules(largeInvoice);

      // ASSERT
      expect(matchingRules).toHaveLength(1);
      expect(matchingRules[0].id).toBe('rule-unlimited');
      expect(matchingRules[0].maxAmount).toBeNull();
    });
  });

  describe('Rule Configuration Validation - RED PHASE', () => {
    it('should validate parallel approval configuration', async () => {
      // ARRANGE
      const parallelRule = {
        userId: mockUserId,
        name: 'Parallel Rule',
        requiredApprovals: 3,
        parallelApproval: true,
        approverRoles: ['MANAGER', 'FINANCE_HEAD'], // Only 2 roles but needs 3 approvals
      };

      // ACT & ASSERT
      await expect(
        ruleEngine.createRule(parallelRule)
      ).rejects.toThrow('Parallel approval requires equal number of roles and approvals');
    });

    it('should validate escalation role exists in system', async () => {
      // ARRANGE
      const ruleWithInvalidEscalation = {
        userId: mockUserId,
        name: 'Invalid Escalation Rule',
        requiredApprovals: 1,
        approverRoles: ['MANAGER'],
        escalateToRole: 'INVALID_ROLE', // Role doesn't exist
      };

      // Mock role validation
      vi.spyOn(ruleEngine, 'validateRoleExists').mockResolvedValue(false);

      // ACT & ASSERT
      await expect(
        ruleEngine.createRule(ruleWithInvalidEscalation)
      ).rejects.toThrow('Escalation role does not exist');
    });

    it('should validate timeout values are reasonable', async () => {
      // ARRANGE
      const ruleWithInvalidTimeout = {
        userId: mockUserId,
        name: 'Invalid Timeout Rule',
        requiredApprovals: 1,
        approverRoles: ['MANAGER'],
        approvalTimeout: 8760, // 1 year in hours - unreasonable
      };

      // ACT & ASSERT
      await expect(
        ruleEngine.createRule(ruleWithInvalidTimeout)
      ).rejects.toThrow('Approval timeout must be between 1 and 720 hours');
    });
  });

  describe('Rule Priority and Ordering - RED PHASE', () => {
    it('should order rules by priority (highest first)', async () => {
      // ARRANGE
      const unsortedRules = [
        { ...mockRules[0], priority: 5 },
        { ...mockRules[1], priority: 10 },
        { ...mockRules[2], priority: 1 },
      ];
      (prisma.approvalRule.findMany as any).mockResolvedValue(unsortedRules);

      // ACT
      const rules = await ruleEngine.getRulesByPriority(mockUserId);

      // ASSERT
      expect(rules).toHaveLength(3);
      expect(rules[0].priority).toBe(10); // Highest first
      expect(rules[1].priority).toBe(5);
      expect(rules[2].priority).toBe(1);
    });

    it('should handle rules with same priority by creation date', async () => {
      // ARRANGE
      const samePriorityRules = [
        { ...mockRules[0], priority: 5, createdAt: new Date('2024-01-01') },
        { ...mockRules[1], priority: 5, createdAt: new Date('2024-01-02') },
      ];
      (prisma.approvalRule.findMany as any).mockResolvedValue(samePriorityRules);

      // ACT
      const rules = await ruleEngine.getRulesByPriority(mockUserId);

      // ASSERT
      expect(rules[0].createdAt).toEqual(new Date('2024-01-02')); // Newer first
    });
  });

  describe('Rule Activation and Deactivation - RED PHASE', () => {
    it('should only evaluate active rules', async () => {
      // ARRANGE
      const rulesWithInactive = [
        { ...mockRules[0], isActive: false }, // Inactive
        { ...mockRules[1], isActive: true },  // Active
      ];
      (prisma.approvalRule.findMany as any).mockResolvedValue(rulesWithInactive);

      // ACT
      const matchingRules = await ruleEngine.evaluateRules(mockInvoice);

      // ASSERT
      expect(matchingRules).toHaveLength(1);
      expect(matchingRules[0].isActive).toBe(true);
    });

    it('should deactivate rule and preserve audit trail', async () => {
      // ARRANGE
      const ruleId = 'rule-123';
      const deactivatedRule = { ...mockRules[0], isActive: false };
      (prisma.approvalRule.update as any).mockResolvedValue(deactivatedRule);

      // ACT
      const result = await ruleEngine.deactivateRule(ruleId, 'No longer needed');

      // ASSERT
      expect(result.isActive).toBe(false);
      expect(prisma.approvalRule.update).toHaveBeenCalledWith({
        where: { id: ruleId },
        data: { isActive: false },
      });
    });
  });

  describe('Error Handling - RED PHASE', () => {
    it('should handle no matching rules gracefully', async () => {
      // ARRANGE - No rules match
      (prisma.approvalRule.findMany as any).mockResolvedValue([]);

      // ACT
      const matchingRules = await ruleEngine.evaluateRules(mockInvoice);

      // ASSERT
      expect(matchingRules).toEqual([]);
    });

    it('should handle database errors during rule evaluation', async () => {
      // ARRANGE
      (prisma.approvalRule.findMany as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      // ACT & ASSERT
      await expect(
        ruleEngine.evaluateRules(mockInvoice)
      ).rejects.toThrow('Failed to evaluate approval rules');
    });

    it('should handle currency conversion failures', async () => {
      // ARRANGE
      const usdInvoice = { ...mockInvoice, currency: 'USD' };
      vi.spyOn(ruleEngine, 'convertToBaseCurrency').mockRejectedValue(
        new Error('Exchange rate service unavailable')
      );

      // ACT & ASSERT
      await expect(
        ruleEngine.evaluateRules(usdInvoice)
      ).rejects.toThrow('Failed to convert currency for rule evaluation');
    });
  });

  describe('Business Logic Validation - RED PHASE', () => {
    it('should require higher approval for larger amounts', async () => {
      // ARRANGE
      const smallInvoice = { ...mockInvoice, totalAmount: new Decimal(25000) };
      const largeInvoice = { ...mockInvoice, totalAmount: new Decimal(150000) };

      // ACT
      const smallRules = await ruleEngine.evaluateRules(smallInvoice);
      const largeRules = await ruleEngine.evaluateRules(largeInvoice);

      // ASSERT
      expect(smallRules[0].requiredApprovals).toBeLessThan(largeRules[0].requiredApprovals);
    });

    it('should enforce stricter rules for high-risk clients', async () => {
      // ARRANGE
      const standardInvoice = {
        ...mockInvoice,
        client: { ...mockInvoice.client, category: 'STANDARD' },
      };
      const highRiskInvoice = {
        ...mockInvoice,
        client: { ...mockInvoice.client, category: 'HIGH_RISK' },
      };

      // ACT
      const standardRules = await ruleEngine.evaluateRules(standardInvoice);
      const highRiskRules = await ruleEngine.evaluateRules(highRiskInvoice);

      // ASSERT
      expect(highRiskRules[0].requiredApprovals).toBeGreaterThan(standardRules[0].requiredApprovals);
    });
  });
});