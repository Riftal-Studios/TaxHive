import { describe, test, expect, beforeEach } from 'vitest';

/**
 * TDD Test Suite for RCM Phase 2: Notified Services and Goods
 * 
 * These tests are written FIRST (RED phase) to define requirements
 * for notified services and goods under RCM as per Section 9(3) and 9(4) of CGST Act.
 * 
 * Tests cover:
 * - Legal services (SAC 9982) - 18% GST
 * - GTA services (SAC 9967) - 5% or 12% GST
 * - Director services (SAC 9954) - 18% GST
 * - Insurance agent services (SAC 9971) - 18% GST
 * - Cashew nuts (HSN 0801) - 5% GST
 * - Tobacco leaves (HSN 2401) - 5% GST
 * - And other notified services/goods
 */

// Import types from implementations
import type { RCMRuleMatch } from '@/lib/rcm/rcm-rule-engine';

// Import the implemented functions
import {
  matchNotifiedService,
  matchNotifiedGoods,
} from '@/lib/rcm/rcm-rule-engine';
import {
  getNotifiedRules,
  validateRCMRule,
  type NotifiedRule,
} from '@/lib/rcm/notified-list-registry';

describe('RCM Phase 2: Notified Services and Goods Detection', () => {
  
  describe('Legal Services (SAC 9982)', () => {
    test('should detect RCM for legal services with SAC 9982 - registered vendor', () => {
      const result = matchNotifiedService('998211', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(18);
      expect(result?.rule.description).toContain('Legal');
      expect(result?.isApplicable).toBe(true);
      expect(result?.matchedCode).toBe('998211');
      expect(result?.reason).toContain('notified service');
    });

    test('should detect RCM for legal services with partial SAC match 9982', () => {
      const result = matchNotifiedService('9982', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(18);
      expect(result?.isApplicable).toBe(true);
    });

    test('should not detect RCM for legal services if vendor is unregistered (other rules apply)', () => {
      // Unregistered vendor rules take precedence, but notified service still matches
      const result = matchNotifiedService('998211', null);
      
      expect(result).not.toBeNull();
      expect(result?.rule.description).toContain('Legal');
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('GTA/Goods Transport Agency Services (SAC 9967)', () => {
    test('should detect RCM for GTA services with 5% GST rate', () => {
      const result = matchNotifiedService('996711', '29AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(5); // Lower rate for GTA
      expect(result?.rule.description).toContain('Transport');
      expect(result?.isApplicable).toBe(true);
    });

    test('should detect RCM for GTA services with 12% GST rate (air transport)', () => {
      const result = matchNotifiedService('996712', '29AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(12); // Higher rate for air transport
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Director Services (SAC 9954)', () => {
    test('should detect RCM for director services', () => {
      const result = matchNotifiedService('995411', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(18);
      expect(result?.rule.description).toContain('Director');
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Insurance Agent Services (SAC 9971)', () => {
    test('should detect RCM for insurance agent services', () => {
      const result = matchNotifiedService('997111', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(18);
      expect(result?.rule.description).toContain('Insurance');
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Recovery Agent Services (SAC 9983)', () => {
    test('should detect RCM for recovery agent services', () => {
      const result = matchNotifiedService('998311', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(18);
      expect(result?.rule.description).toContain('Recovery');
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Rent-a-Cab Services (SAC 9964)', () => {
    test('should detect RCM for rent-a-cab services with 5% rate', () => {
      const result = matchNotifiedService('996411', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(5);
      expect(result?.rule.description).toContain('Cab');
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Works Contract Services (SAC 9954)', () => {
    test('should detect RCM for works contract services - 12% rate', () => {
      const result = matchNotifiedService('995421', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(12);
      expect(result?.rule.description).toContain('Works Contract');
      expect(result?.isApplicable).toBe(true);
    });

    test('should detect RCM for works contract services - 18% rate', () => {
      const result = matchNotifiedService('995423', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(18);
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Sponsorship Services (SAC 9983)', () => {
    test('should detect RCM for sponsorship services', () => {
      const result = matchNotifiedService('998321', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(18);
      expect(result?.rule.description).toContain('Sponsorship');
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Notified Goods - Cashew Nuts (HSN 0801)', () => {
    test('should detect RCM for cashew nuts not shelled or peeled', () => {
      const result = matchNotifiedGoods('0801', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(5);
      expect(result?.rule.description).toContain('Cashew nuts');
      expect(result?.isApplicable).toBe(true);
      expect(result?.matchedCode).toBe('0801');
    });

    test('should detect RCM for cashew nuts with detailed HSN code', () => {
      const result = matchNotifiedGoods('08011100', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(5);
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Notified Goods - Tobacco Leaves (HSN 2401)', () => {
    test('should detect RCM for tobacco leaves', () => {
      const result = matchNotifiedGoods('2401', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(5);
      expect(result?.rule.description).toContain('Tobacco leaves');
      expect(result?.isApplicable).toBe(true);
    });

    test('should detect RCM for tobacco leaves with 8-digit HSN', () => {
      const result = matchNotifiedGoods('24011000', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(5);
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Notified Goods - Silk Yarn (HSN 5004-5006)', () => {
    test('should detect RCM for silk yarn HSN 5004', () => {
      const result = matchNotifiedGoods('5004', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(5);
      expect(result?.rule.description).toContain('Silk yarn');
      expect(result?.isApplicable).toBe(true);
    });

    test('should detect RCM for silk yarn HSN 5005', () => {
      const result = matchNotifiedGoods('5005', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(5);
      expect(result?.isApplicable).toBe(true);
    });

    test('should detect RCM for silk yarn HSN 5006', () => {
      const result = matchNotifiedGoods('5006', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(5);
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Notified Goods - Supply of Lottery (HSN 9990)', () => {
    test('should detect RCM for lottery supply with 12% rate', () => {
      const result = matchNotifiedGoods('999011', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(12);
      expect(result?.rule.description).toContain('Lottery');
      expect(result?.isApplicable).toBe(true);
    });

    test('should detect RCM for lottery supply with 28% rate (state lottery)', () => {
      const result = matchNotifiedGoods('999012', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(28);
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Notified Goods - Bidi Wrapper Leaves (HSN 1404)', () => {
    test('should detect RCM for bidi wrapper leaves', () => {
      const result = matchNotifiedGoods('1404', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(18);
      expect(result?.rule.description).toContain('Bidi wrapper');
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Notified Goods - Raw Cotton (HSN 5201)', () => {
    test('should detect RCM for raw cotton', () => {
      const result = matchNotifiedGoods('5201', '27AABCU9603R1ZV');
      
      expect(result).not.toBeNull();
      expect(result?.rule.gstRate).toBe(5);
      expect(result?.rule.description).toContain('Raw cotton');
      expect(result?.isApplicable).toBe(true);
    });
  });

  describe('Negative Tests - Non-Notified Items', () => {
    test('should return null for non-notified service SAC code', () => {
      const result = matchNotifiedService('999999', '27AABCU9603R1ZV');
      expect(result).toBeNull();
    });

    test('should return null for non-notified goods HSN code', () => {
      const result = matchNotifiedGoods('9999', '27AABCU9603R1ZV');
      expect(result).toBeNull();
    });

    test('should return null for invalid SAC code format', () => {
      const result = matchNotifiedService('INVALID', '27AABCU9603R1ZV');
      expect(result).toBeNull();
    });

    test('should return null for invalid HSN code format', () => {
      const result = matchNotifiedGoods('INVALID', '27AABCU9603R1ZV');
      expect(result).toBeNull();
    });
  });

  describe('Rule Registry Tests', () => {
    test('should load all notified rules from registry', () => {
      const rules = getNotifiedRules();
      
      expect(rules).toBeDefined();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(10); // At least 10+ notified rules
    });

    test('should have rules for all major notified services', () => {
      const rules = getNotifiedRules();
      const serviceCodes = rules
        .filter(r => r.ruleType === 'SERVICE')
        .flatMap(r => r.hsnSacCodes);
      
      expect(serviceCodes.some(code => code.startsWith('9982'))).toBe(true); // Legal
      expect(serviceCodes.some(code => code.startsWith('9967'))).toBe(true); // GTA
      expect(serviceCodes.some(code => code.startsWith('9954'))).toBe(true); // Director/Works
      expect(serviceCodes.some(code => code.startsWith('9971'))).toBe(true); // Insurance
      expect(serviceCodes.some(code => code.startsWith('9983'))).toBe(true); // Recovery/Sponsorship
      expect(serviceCodes.some(code => code.startsWith('9964'))).toBe(true); // Rent-a-cab
    });

    test('should have rules for all major notified goods', () => {
      const rules = getNotifiedRules();
      const goodsCodes = rules
        .filter(r => r.ruleType === 'GOODS')
        .flatMap(r => r.hsnSacCodes);
      
      expect(goodsCodes.some(code => code.startsWith('0801'))).toBe(true); // Cashew nuts
      expect(goodsCodes.some(code => code.startsWith('2401'))).toBe(true); // Tobacco
      expect(goodsCodes.some(code => code.startsWith('5004'))).toBe(true); // Silk yarn
      expect(goodsCodes.some(code => code.startsWith('999'))).toBe(true);  // Lottery
      expect(goodsCodes.some(code => code.startsWith('1404'))).toBe(true); // Bidi wrapper
      expect(goodsCodes.some(code => code.startsWith('5201'))).toBe(true); // Raw cotton
    });

    test('should validate rule structure for all rules', () => {
      const rules = getNotifiedRules();
      
      rules.forEach(rule => {
        expect(validateRCMRule(rule)).toBe(true);
        expect(rule.id).toBeDefined();
        expect(rule.category).toBe('NOTIFIED');
        expect(['SERVICE', 'GOODS']).toContain(rule.ruleType);
        expect(rule.hsnSacCodes.length).toBeGreaterThan(0);
        expect(rule.gstRate).toBeGreaterThan(0);
        expect(rule.effectiveFrom).toBeInstanceOf(Date);
        expect(rule.priority).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Priority and Effective Date Tests', () => {
    test('should respect effective date for rule applicability', () => {
      // Future effective date - should not be applicable
      const futureRule: NotifiedRule = {
        id: 'test-future',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['9999'],
        description: 'Future rule',
        gstRate: 18,
        effectiveFrom: new Date('2030-01-01'),
        isActive: true,
        priority: 1
      };
      
      expect(validateRCMRule(futureRule)).toBe(false);
    });

    test('should handle expired rules with effectiveTo date', () => {
      const expiredRule: NotifiedRule = {
        id: 'test-expired',
        ruleType: 'SERVICE',
        category: 'NOTIFIED',
        hsnSacCodes: ['9998'],
        description: 'Expired rule',
        gstRate: 18,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: new Date('2020-12-31'),
        isActive: false,
        priority: 1
      };
      
      expect(validateRCMRule(expiredRule)).toBe(false);
    });

    test('should prioritize higher priority rules', () => {
      const rules = getNotifiedRules();
      const legalRules = rules.filter(r => 
        r.hsnSacCodes.some(code => code.startsWith('9982'))
      );
      
      expect(legalRules.length).toBeGreaterThan(0);
      
      // Should be sorted by priority (highest first)
      for (let i = 1; i < legalRules.length; i++) {
        expect(legalRules[i-1].priority).toBeGreaterThanOrEqual(legalRules[i].priority);
      }
    });
  });
});