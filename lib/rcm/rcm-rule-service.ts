/**
 * RCM Phase 2: Database Service for RCM Rules
 * 
 * Handles CRUD operations for RCM rules in the database
 * and provides integration with the seeded notified rules.
 * 
 * This implementation is part of TDD GREEN phase - making tests pass.
 */

import { PrismaClient } from '@prisma/client';
import { NOTIFIED_RCM_RULES } from '../../prisma/seeds/rcm-notified-rules';

const prisma = new PrismaClient();

export interface RCMRuleCreateInput {
  id: string;
  ruleType: 'SERVICE' | 'GOODS' | 'VENDOR_TYPE';
  category: 'NOTIFIED' | 'IMPORT' | 'UNREGISTERED';
  hsnSacCodes: string[];
  description: string;
  gstRate: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  notificationNo?: string;
  isActive?: boolean;
  priority?: number;
}

/**
 * Seeds the notified RCM rules into the database
 */
export async function seedNotifiedRules(): Promise<void> {
  try {
    // Clear existing notified rules
    await prisma.rCMRule.deleteMany({
      where: {
        category: 'NOTIFIED'
      }
    });

    // Insert new rules from the seed data
    for (const rule of NOTIFIED_RCM_RULES) {
      await prisma.rCMRule.create({
        data: {
          id: rule.id,
          ruleType: rule.ruleType,
          category: rule.category,
          hsnSacCodes: rule.hsnSacCodes,
          description: rule.description,
          gstRate: rule.gstRate,
          effectiveFrom: rule.effectiveFrom,
          effectiveTo: rule.effectiveTo,
          notificationNo: rule.notificationNo,
          isActive: rule.isActive,
          priority: rule.priority,
        }
      });
    }

    console.log(`✅ Successfully seeded ${NOTIFIED_RCM_RULES.length} RCM notified rules`);
  } catch (error) {
    console.error('❌ Error seeding RCM notified rules:', error);
    throw error;
  }
}

/**
 * Get all RCM rules from database
 */
export async function getRCMRules(category?: string) {
  const where = category ? { category } : {};
  
  return await prisma.rCMRule.findMany({
    where,
    orderBy: [
      { priority: 'desc' },
      { effectiveFrom: 'desc' }
    ]
  });
}

/**
 * Get RCM rule by HSN/SAC code
 */
export async function getRuleByHSNSAC(hsnSacCode: string, category?: string) {
  const where: any = {
    hsnSacCodes: {
      has: hsnSacCode
    },
    isActive: true
  };
  
  if (category) {
    where.category = category;
  }
  
  return await prisma.rCMRule.findFirst({
    where,
    orderBy: [
      { priority: 'desc' },
      { effectiveFrom: 'desc' }
    ]
  });
}

/**
 * Get active RCM rules with date filtering
 */
export async function getActiveRules(category?: string, referenceDate?: Date) {
  const checkDate = referenceDate || new Date();
  
  const where: any = {
    isActive: true,
    effectiveFrom: {
      lte: checkDate
    },
    OR: [
      { effectiveTo: null },
      { effectiveTo: { gte: checkDate } }
    ]
  };
  
  if (category) {
    where.category = category;
  }
  
  return await prisma.rCMRule.findMany({
    where,
    orderBy: [
      { priority: 'desc' },
      { effectiveFrom: 'desc' }
    ]
  });
}

/**
 * Clear all test rules (for testing purposes)
 */
export async function clearTestRules(): Promise<void> {
  try {
    await prisma.rCMRule.deleteMany({
      where: {
        id: {
          startsWith: 'test-'
        }
      }
    });
    console.log('🧹 Cleared test RCM rules');
  } catch (error) {
    console.error('❌ Error clearing test rules:', error);
    throw error;
  }
}

/**
 * Clear all RCM rules (for testing purposes)
 */
export async function clearRCMRules(): Promise<void> {
  try {
    await prisma.rCMRule.deleteMany({});
    console.log('🧹 Cleared all RCM rules');
  } catch (error) {
    console.error('❌ Error clearing RCM rules:', error);
    throw error;
  }
}

/**
 * Alias for seedNotifiedRules to match test expectations
 */
export async function seedNotifiedRulesToDB(): Promise<void> {
  return await seedNotifiedRules();
}

/**
 * Create a new RCM rule
 */
export async function createRCMRule(input: RCMRuleCreateInput) {
  return await prisma.rCMRule.create({
    data: {
      id: input.id,
      ruleType: input.ruleType,
      category: input.category,
      hsnSacCodes: input.hsnSacCodes,
      description: input.description,
      gstRate: input.gstRate,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      notificationNo: input.notificationNo,
      isActive: input.isActive ?? true,
      priority: input.priority ?? 0,
    }
  });
}

/**
 * Update an existing RCM rule
 */
export async function updateRCMRule(id: string, input: Partial<RCMRuleCreateInput>) {
  return await prisma.rCMRule.update({
    where: { id },
    data: input
  });
}

/**
 * Delete an RCM rule
 */
export async function deleteRCMRule(id: string) {
  return await prisma.rCMRule.delete({
    where: { id }
  });
}

/**
 * Find rules matching a pattern in HSN/SAC codes
 */
export async function findRulesByCodePattern(codePattern: string, category?: string) {
  const where: any = {
    isActive: true,
    hsnSacCodes: {
      some: {
        contains: codePattern
      }
    }
  };
  
  if (category) {
    where.category = category;
  }
  
  return await prisma.rCMRule.findMany({
    where,
    orderBy: [
      { priority: 'desc' },
      { effectiveFrom: 'desc' }
    ]
  });
}

/**
 * Check if a rule exists by ID
 */
export async function ruleExists(id: string): Promise<boolean> {
  const rule = await prisma.rCMRule.findUnique({
    where: { id }
  });
  
  return !!rule;
}

/**
 * Get rules by date range
 */
export async function getRulesByDateRange(startDate: Date, endDate: Date, category?: string) {
  const where: any = {
    OR: [
      {
        effectiveFrom: {
          gte: startDate,
          lte: endDate
        }
      },
      {
        effectiveTo: {
          gte: startDate,
          lte: endDate
        }
      },
      {
        AND: [
          { effectiveFrom: { lte: startDate } },
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: endDate } }
            ]
          }
        ]
      }
    ]
  };
  
  if (category) {
    where.category = category;
  }
  
  return await prisma.rCMRule.findMany({
    where,
    orderBy: [
      { priority: 'desc' },
      { effectiveFrom: 'desc' }
    ]
  });
}

/**
 * Get rule statistics
 */
export async function getRuleStatistics() {
  const [
    totalRules,
    activeRules,
    serviceRules,
    goodsRules,
    notifiedRules
  ] = await Promise.all([
    prisma.rCMRule.count(),
    prisma.rCMRule.count({ where: { isActive: true } }),
    prisma.rCMRule.count({ where: { ruleType: 'SERVICE', isActive: true } }),
    prisma.rCMRule.count({ where: { ruleType: 'GOODS', isActive: true } }),
    prisma.rCMRule.count({ where: { category: 'NOTIFIED', isActive: true } })
  ]);
  
  return {
    totalRules,
    activeRules,
    serviceRules,
    goodsRules,
    notifiedRules
  };
}