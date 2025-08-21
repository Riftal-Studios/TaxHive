import { describe, test, expect, beforeEach, vi } from 'vitest';

/**
 * TDD Test Suite for RCM Rule Effective Date Management
 * 
 * These tests are written FIRST (RED phase) to define requirements
 * for date-based RCM rule management including:
 * - Effective from date validation
 * - Effective to date (expiry) handling
 * - Government notification date tracking
 * - Rule priority based on dates
 */

// Import actual implementations
import { 
  isRuleEffective,
  getRulesEffectiveOn,
  getActiveRules,
  getRulesByDateRange,
  getLatestNotificationDate,
  sortRulesByPriority,
  validateRuleEffectiveDates
} from '@/lib/rcm/rcm-rule-engine';

import type { NotifiedRule } from '@/lib/rcm/notified-list-registry';

// Use NotifiedRule as the concrete type
type RCMRule = NotifiedRule;

describe('RCM Rule Effective Date Management', () => {
  
  // Mock current date for testing
  const MOCK_CURRENT_DATE = new Date('2024-06-15');
  
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_CURRENT_DATE);
  });

  describe('Rule Effective Date Validation', () => {
    test('should validate rule effective from today', () => {
      const rule: RCMRule = {
        id: 'test-1',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['998211'],
        description: 'Legal services',
        gstRate: 18,
        effectiveFrom: new Date('2024-06-15'), // Today
        isActive: true,
        priority: 1
      };

      expect(isRuleEffective(rule)).toBe(true);
    });

    test('should validate rule effective from past date', () => {
      const rule: RCMRule = {
        id: 'test-2',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['996711'],
        description: 'GTA services',
        gstRate: 5,
        effectiveFrom: new Date('2024-01-01'), // Past date
        isActive: true,
        priority: 1
      };

      expect(isRuleEffective(rule)).toBe(true);
    });

    test('should reject rule with future effective date', () => {
      const rule: RCMRule = {
        id: 'test-3',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['995411'],
        description: 'Director services',
        gstRate: 18,
        effectiveFrom: new Date('2024-12-01'), // Future date
        isActive: true,
        priority: 1
      };

      expect(isRuleEffective(rule)).toBe(false);
    });

    test('should validate rule with custom reference date', () => {
      const rule: RCMRule = {
        id: 'test-4',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['997111'],
        description: 'Insurance agent services',
        gstRate: 18,
        effectiveFrom: new Date('2024-03-01'),
        isActive: true,
        priority: 1
      };

      const referenceDate = new Date('2024-05-01');
      expect(isRuleEffective(rule, referenceDate)).toBe(true);

      const earlierDate = new Date('2024-02-01');
      expect(isRuleEffective(rule, earlierDate)).toBe(false);
    });
  });

  describe('Rule Expiry Date Handling', () => {
    test('should handle rule with no expiry date (permanent)', () => {
      const rule: RCMRule = {
        id: 'test-5',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['998311'],
        description: 'Recovery agent services',
        gstRate: 18,
        effectiveFrom: new Date('2024-01-01'),
        // No effectiveTo - permanent rule
        isActive: true,
        priority: 1
      };

      expect(isRuleEffective(rule)).toBe(true);
    });

    test('should handle rule with future expiry date (still active)', () => {
      const rule: RCMRule = {
        id: 'test-6',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['996411'],
        description: 'Rent-a-cab services',
        gstRate: 5,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-12-31'), // Expires end of year
        isActive: true,
        priority: 1
      };

      expect(isRuleEffective(rule)).toBe(true);
    });

    test('should reject expired rule', () => {
      const rule: RCMRule = {
        id: 'test-7',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['999911'],
        description: 'Expired service',
        gstRate: 18,
        effectiveFrom: new Date('2023-01-01'),
        effectiveTo: new Date('2023-12-31'), // Expired
        isActive: false,
        priority: 1
      };

      expect(isRuleEffective(rule)).toBe(false);
    });

    test('should handle rule expiring today', () => {
      const rule: RCMRule = {
        id: 'test-8',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['999912'],
        description: 'Service expiring today',
        gstRate: 18,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-06-15'), // Expires today
        isActive: true,
        priority: 1
      };

      expect(isRuleEffective(rule)).toBe(true); // Should be effective until end of day
    });
  });

  describe('Rules by Date Queries', () => {
    test('should get rules effective on specific date', () => {
      const specificDate = new Date('2024-06-01');
      const rules = getRulesEffectiveOn(specificDate);

      expect(Array.isArray(rules)).toBe(true);
      
      // All returned rules should be effective on that date
      rules.forEach(rule => {
        expect(isRuleEffective(rule, specificDate)).toBe(true);
      });
    });

    test('should filter rules by category', () => {
      const notifiedRules = getRulesEffectiveOn(MOCK_CURRENT_DATE, 'NOTIFIED');
      const importRules = getRulesEffectiveOn(MOCK_CURRENT_DATE, 'IMPORT');

      expect(Array.isArray(notifiedRules)).toBe(true);
      expect(Array.isArray(importRules)).toBe(true);

      notifiedRules.forEach(rule => {
        expect(rule.category).toBe('NOTIFIED');
      });

      importRules.forEach(rule => {
        expect(rule.category).toBe('IMPORT');
      });
    });

    test('should get active rules (no expiry or future expiry)', () => {
      const activeRules = getActiveRules();

      expect(Array.isArray(activeRules)).toBe(true);
      
      activeRules.forEach(rule => {
        expect(rule.isActive).toBe(true);
        expect(isRuleEffective(rule)).toBe(true);
      });
    });

    test('should get rules by date range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const rules = getRulesByDateRange(startDate, endDate);

      expect(Array.isArray(rules)).toBe(true);
      
      rules.forEach(rule => {
        // Rule should be effective sometime within the date range
        const ruleEnd = rule.effectiveTo || new Date('2030-12-31');
        expect(rule.effectiveFrom <= endDate).toBe(true);
        expect(ruleEnd >= startDate).toBe(true);
      });
    });
  });

  describe('Rule Date Validation', () => {
    test('should validate valid rule dates', () => {
      const validRule: RCMRule = {
        id: 'test-valid',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['998211'],
        description: 'Valid rule',
        gstRate: 18,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-12-31'),
        isActive: true,
        priority: 1
      };

      expect(validateRuleEffectiveDates(validRule)).toBe(true);
    });

    test('should reject rule with effectiveTo before effectiveFrom', () => {
      const invalidRule: RCMRule = {
        id: 'test-invalid',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['998211'],
        description: 'Invalid rule',
        gstRate: 18,
        effectiveFrom: new Date('2024-06-01'),
        effectiveTo: new Date('2024-01-01'), // Before effective from!
        isActive: true,
        priority: 1
      };

      expect(validateRuleEffectiveDates(invalidRule)).toBe(false);
    });

    test('should validate rule with no expiry date', () => {
      const ruleNoExpiry: RCMRule = {
        id: 'test-no-expiry',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['998211'],
        description: 'Rule with no expiry',
        gstRate: 18,
        effectiveFrom: new Date('2024-01-01'),
        // No effectiveTo
        isActive: true,
        priority: 1
      };

      expect(validateRuleEffectiveDates(ruleNoExpiry)).toBe(true);
    });

    test('should reject rule with invalid effective date', () => {
      const invalidDateRule: RCMRule = {
        id: 'test-invalid-date',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['998211'],
        description: 'Rule with invalid date',
        gstRate: 18,
        effectiveFrom: new Date('invalid'), // Invalid date
        isActive: true,
        priority: 1
      };

      expect(validateRuleEffectiveDates(invalidDateRule)).toBe(false);
    });
  });

  describe('Rule Priority and Sorting', () => {
    test('should sort rules by priority (higher first)', () => {
      const rules: RCMRule[] = [
        {
          id: 'low-priority',
          ruleType: 'SERVICE',
          category: 'NOTIFIED',
          hsnSacCodes: ['998211'],
          description: 'Low priority',
          gstRate: 18,
          effectiveFrom: new Date('2024-01-01'),
          isActive: true,
          priority: 1
        },
        {
          id: 'high-priority',
          ruleType: 'SERVICE',
          category: 'NOTIFIED',
          hsnSacCodes: ['998211'],
          description: 'High priority',
          gstRate: 18,
          effectiveFrom: new Date('2024-01-01'),
          isActive: true,
          priority: 5
        },
        {
          id: 'medium-priority',
          ruleType: 'SERVICE',
          category: 'NOTIFIED',
          hsnSacCodes: ['998211'],
          description: 'Medium priority',
          gstRate: 18,
          effectiveFrom: new Date('2024-01-01'),
          isActive: true,
          priority: 3
        }
      ];

      const sortedRules = sortRulesByPriority(rules);

      expect(sortedRules[0].priority).toBe(5); // Highest first
      expect(sortedRules[1].priority).toBe(3);
      expect(sortedRules[2].priority).toBe(1); // Lowest last
    });

    test('should sort rules by effective date when priorities are equal', () => {
      const rules: RCMRule[] = [
        {
          id: 'older-rule',
          ruleType: 'SERVICE',
          category: 'NOTIFIED',
          hsnSacCodes: ['998211'],
          description: 'Older rule',
          gstRate: 18,
          effectiveFrom: new Date('2024-01-01'),
          isActive: true,
          priority: 1
        },
        {
          id: 'newer-rule',
          ruleType: 'SERVICE',
          category: 'NOTIFIED',
          hsnSacCodes: ['998211'],
          description: 'Newer rule',
          gstRate: 18,
          effectiveFrom: new Date('2024-06-01'),
          isActive: true,
          priority: 1
        }
      ];

      const sortedRules = sortRulesByPriority(rules);

      expect(sortedRules[0].effectiveFrom).toEqual(new Date('2024-06-01')); // Newer first
      expect(sortedRules[1].effectiveFrom).toEqual(new Date('2024-01-01'));
    });
  });

  describe('Notification Date Tracking', () => {
    test('should get latest notification date for HSN/SAC code', () => {
      const latestDate = getLatestNotificationDate('998211');
      
      if (latestDate) {
        expect(latestDate).toBeInstanceOf(Date);
      }
    });

    test('should return null for non-notified HSN/SAC code', () => {
      const latestDate = getLatestNotificationDate('999999'); // Non-existent code
      
      expect(latestDate).toBeNull();
    });

    test('should track multiple notification dates and return latest', () => {
      // This would test rules that have been updated multiple times
      const latestDate = getLatestNotificationDate('996711'); // GTA services (might have updates)
      
      if (latestDate) {
        expect(latestDate).toBeInstanceOf(Date);
        
        // Should be the most recent notification date for this code
        const allRules = getActiveRules('NOTIFIED');
        const gtaRules = allRules.filter(rule => 
          rule.hsnSacCodes.some(code => code.startsWith('9967'))
        );
        
        if (gtaRules.length > 0) {
          const maxDate = Math.max(...gtaRules.map(rule => rule.effectiveFrom.getTime()));
          expect(latestDate.getTime()).toBe(maxDate);
        }
      }
    });
  });

  describe('Historical Rule Changes', () => {
    test('should handle rule amendments with new effective dates', () => {
      // Simulate rule amendment scenario
      const originalRule: RCMRule = {
        id: 'original',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['998211'],
        description: 'Legal services - original',
        gstRate: 18,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-05-31'), // Ended
        isActive: false,
        priority: 1
      };

      const amendedRule: RCMRule = {
        id: 'amended',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['998211'],
        description: 'Legal services - amended',
        gstRate: 20, // Rate change
        effectiveFrom: new Date('2024-06-01'), // New effective date
        isActive: true,
        priority: 1
      };

      // On May 15, original rule should NOT be effective because it's inactive
      expect(isRuleEffective(originalRule, new Date('2024-05-15'))).toBe(false);
      expect(isRuleEffective(amendedRule, new Date('2024-05-15'))).toBe(false);

      // On June 15, amended rule should be effective
      expect(isRuleEffective(originalRule, new Date('2024-06-15'))).toBe(false);
      expect(isRuleEffective(amendedRule, new Date('2024-06-15'))).toBe(true);
    });

    test('should handle overlapping rule periods (priority-based)', () => {
      const generalRule: RCMRule = {
        id: 'general',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['9982'],
        description: 'General legal services',
        gstRate: 18,
        effectiveFrom: new Date('2024-01-01'),
        isActive: true,
        priority: 1 // Lower priority
      };

      const specificRule: RCMRule = {
        id: 'specific',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['998211'],
        description: 'Specific legal services',
        gstRate: 20,
        effectiveFrom: new Date('2024-03-01'),
        isActive: true,
        priority: 5 // Higher priority
      };

      const sortedRules = sortRulesByPriority([generalRule, specificRule]);
      expect(sortedRules[0].id).toBe('specific'); // Higher priority first
    });
  });
});