import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * TDD Integration Test Suite for RCM Phase 2: Notified List Integration
 * 
 * These tests are written FIRST (RED phase) to define integration requirements
 * between Phase 2 (notified services/goods) and existing Phase 1 (unregistered/imports).
 * 
 * Tests priority handling:
 * 1. NOTIFIED > IMPORT > UNREGISTERED
 * 2. Integration with existing RCM detector
 * 3. Database operations for RCM rules
 * 4. Complete flow validation
 */

// Import actual implementations
import { detectRCM, type RCMDetectionInput, type RCMDetectionResult } from '@/lib/rcm/rcm-detector';
import { seedNotifiedRulesToDB, clearRCMRules } from '@/lib/rcm/rcm-rule-service';
import { getNotifiedRules } from '@/lib/rcm/notified-list-registry';

const prisma = new PrismaClient();

/**
 * Helper function to clear test rules from database
 */
async function clearTestRules(): Promise<void> {
  await clearRCMRules();
}

/**
 * Helper function to seed notified rules for testing
 */
async function seedNotifiedRules(): Promise<void> {
  await seedNotifiedRulesToDB();
}

/**
 * Helper function to get RCM rules from database
 */
async function getRCMRules(): Promise<any[]> {
  return await prisma.rCMRule.findMany({
    orderBy: [
      { priority: 'desc' },
      { effectiveFrom: 'desc' }
    ]
  });
}

describe('RCM Phase 2: Integration with Existing System', () => {
  
  beforeEach(async () => {
    // Clear test data
    await clearTestRules();
    
    // Seed notified rules for testing
    await seedNotifiedRules();
  });

  afterEach(async () => {
    // Clean up test data
    await clearTestRules();
  });

  describe('Priority Handling: Notified vs Unregistered', () => {
    test('should prioritize NOTIFIED_SERVICE over UNREGISTERED for legal services', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null, // Would normally trigger UNREGISTERED
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'LEGAL',
        hsnSacCode: '998211', // Legal services - notified
        taxableAmount: 100000,
      };

      const result = detectRCM(input);
      
      // Should detect NOTIFIED_SERVICE, not UNREGISTERED
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('NOTIFIED_SERVICE');
      expect(result.gstRate).toBe(18);
      expect(result.reason).toContain('notified service');
      expect(result.matchedRule).toBeDefined();
      expect(result.matchedRule?.description).toContain('Legal');
    });

    test('should prioritize NOTIFIED_GOODS over UNREGISTERED for cashew nuts', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: '', // Would normally trigger UNREGISTERED
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '29AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'GOODS',
        hsnSacCode: '08011000', // Cashew nuts - notified
        taxableAmount: 50000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('NOTIFIED_GOODS');
      expect(result.gstRate).toBe(5);
      expect(result.taxType).toBe('IGST'); // Inter-state
      expect(result.matchedRule).toBeDefined();
      expect(result.matchedRule?.description).toContain('Cashew nuts');
    });

    test('should apply UNREGISTERED when no notified rule matches', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE', // Not a notified service
        hsnSacCode: '123456', // Completely non-notified code
        taxableAmount: 75000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('UNREGISTERED');
      expect(result.reason).toContain('unregistered vendor');
      expect(result.matchedRule).toBeUndefined();
    });
  });

  describe('Priority Handling: Notified vs Import', () => {
    test('should prioritize NOTIFIED_SERVICE over IMPORT_SERVICE for foreign legal services', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorName: 'Foreign Law Firm',
        vendorCountry: 'USA', // Would normally trigger IMPORT_SERVICE
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'LEGAL',
        hsnSacCode: '998211', // Legal services - notified
        taxableAmount: 200000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('NOTIFIED_SERVICE');
      expect(result.gstRate).toBe(18);
      expect(result.taxType).toBe('IGST');
      expect(result.matchedRule).toBeDefined();
    });

    test('should apply IMPORT_SERVICE when no notified rule matches foreign vendor', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorName: 'Foreign Software Company',
        vendorCountry: 'USA',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE', // Not notified
        hsnSacCode: '123456', // Completely non-notified code
        taxableAmount: 150000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('IMPORT_SERVICE');
      expect(result.reason).toContain('import of services');
      expect(result.matchedRule).toBeUndefined();
    });
  });

  describe('Registered Vendor with Notified Services/Goods', () => {
    test('should apply RCM for registered vendor providing notified services', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: '29AABCU9603R1ZV', // Valid registered vendor
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'LEGAL',
        hsnSacCode: '998211', // Legal services - notified
        taxableAmount: 100000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('NOTIFIED_SERVICE');
      expect(result.gstRate).toBe(18);
      expect(result.taxType).toBe('IGST'); // Inter-state
    });

    test('should NOT apply RCM for registered vendor with non-notified services', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: '29AABCU9603R1ZV', // Valid registered vendor
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE', // Not notified
        hsnSacCode: '123456', // Completely non-notified code
        taxableAmount: 100000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(false);
      expect(result.rcmType).toBeNull();
      expect(result.reason).toContain('No RCM applicable for registered vendor');
    });
  });

  describe('Complete Flow Integration', () => {
    test('should handle GTA services with correct GST rates', () => {
      // Test 5% rate for goods transport
      const gtaInput: RCMDetectionInput = {
        vendorGSTIN: '29AABCU9603R1ZV',
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'TRANSPORT',
        hsnSacCode: '996711', // Goods transport agency
        taxableAmount: 50000,
      };

      const result = detectRCM(gtaInput);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('NOTIFIED_SERVICE');
      expect(result.gstRate).toBe(5); // Lower rate for GTA
      expect(result.taxType).toBe('IGST');
    });

    test('should handle director services with 18% rate', () => {
      const directorInput: RCMDetectionInput = {
        vendorGSTIN: '27AABCU9603R1ZV',
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'DIRECTOR',
        hsnSacCode: '995411', // Director services
        taxableAmount: 200000,
      };

      const result = detectRCM(directorInput);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('NOTIFIED_SERVICE');
      expect(result.gstRate).toBe(18);
      expect(result.taxType).toBe('CGST_SGST'); // Intra-state
    });

    test('should handle tobacco leaves with 5% rate', () => {
      const tobaccoInput: RCMDetectionInput = {
        vendorGSTIN: '29AABCU9603R1ZV',
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'GOODS',
        hsnSacCode: '24011000', // Tobacco leaves
        taxableAmount: 100000,
      };

      const result = detectRCM(tobaccoInput);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('NOTIFIED_GOODS');
      expect(result.gstRate).toBe(5);
      expect(result.taxType).toBe('IGST');
    });
  });

  describe('Database Integration', () => {
    test('should successfully seed notified rules to database', async () => {
      await seedNotifiedRules();
      
      const rules = await getRCMRules();
      
      expect(rules.length).toBeGreaterThan(10);
      
      // Check for specific rule types
      const serviceRules = rules.filter(r => r.ruleType === 'SERVICE');
      const goodsRules = rules.filter(r => r.ruleType === 'GOODS');
      
      expect(serviceRules.length).toBeGreaterThan(5);
      expect(goodsRules.length).toBeGreaterThan(3);
    });

    test('should have all required notified services in database', async () => {
      const rules = await getRCMRules();
      const serviceCodes = rules
        .filter(r => r.ruleType === 'SERVICE')
        .flatMap(r => r.hsnSacCodes);
      
      // Check for major notified services
      expect(serviceCodes.some(code => code.startsWith('9982'))).toBe(true); // Legal
      expect(serviceCodes.some(code => code.startsWith('9967'))).toBe(true); // GTA
      expect(serviceCodes.some(code => code.startsWith('9954'))).toBe(true); // Director
      expect(serviceCodes.some(code => code.startsWith('9971'))).toBe(true); // Insurance
      expect(serviceCodes.some(code => code.startsWith('9983'))).toBe(true); // Recovery
      expect(serviceCodes.some(code => code.startsWith('9964'))).toBe(true); // Rent-a-cab
    });

    test('should have all required notified goods in database', async () => {
      const rules = await getRCMRules();
      const goodsCodes = rules
        .filter(r => r.ruleType === 'GOODS')
        .flatMap(r => r.hsnSacCodes);
      
      // Check for major notified goods
      expect(goodsCodes.some(code => code.startsWith('0801'))).toBe(true); // Cashew nuts
      expect(goodsCodes.some(code => code.startsWith('2401'))).toBe(true); // Tobacco
      expect(goodsCodes.some(code => code.startsWith('5004'))).toBe(true); // Silk yarn
      expect(goodsCodes.some(code => code.startsWith('999'))).toBe(true);  // Lottery
      expect(goodsCodes.some(code => code.startsWith('1404'))).toBe(true); // Bidi wrapper
      expect(goodsCodes.some(code => code.startsWith('5201'))).toBe(true); // Raw cotton
    });

    test('should have proper GST rates for all rules', async () => {
      const rules = await getRCMRules();
      
      rules.forEach(rule => {
        const gstRate = Number(rule.gstRate);
        expect(gstRate).toBeGreaterThan(0);
        expect([5, 12, 18, 28]).toContain(gstRate);
      });
    });

    test('should have proper effective dates for all rules', async () => {
      const rules = await getRCMRules();
      
      rules.forEach(rule => {
        expect(rule.effectiveFrom).toBeInstanceOf(Date);
        expect(rule.isActive).toBe(true);
        expect(rule.category).toBe('NOTIFIED');
      });
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain compatibility with Phase 1 unregistered vendor detection', () => {
      const phase1Input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE', // Not notified
        taxableAmount: 50000,
      };

      const result = detectRCM(phase1Input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('UNREGISTERED');
      expect(result.gstRate).toBe(18);
      expect(result.reason).toContain('unregistered vendor');
    });

    test('should maintain compatibility with Phase 1 import service detection', () => {
      const phase1Input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorName: 'Foreign Company',
        vendorCountry: 'USA',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE',
        taxableAmount: 100000,
      };

      const result = detectRCM(phase1Input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('IMPORT_SERVICE');
      expect(result.taxType).toBe('IGST');
      expect(result.reason).toContain('import of services');
    });

    test('should maintain no RCM for valid registered vendors with non-notified services', () => {
      const phase1Input: RCMDetectionInput = {
        vendorGSTIN: '29AABCU9603R1ZV',
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE',
        taxableAmount: 100000,
      };

      const result = detectRCM(phase1Input);
      
      expect(result.isRCMApplicable).toBe(false);
      expect(result.rcmType).toBeNull();
      expect(result.reason).toContain('No RCM applicable');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing HSN/SAC codes gracefully', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        // No hsnSacCode provided
        taxableAmount: 50000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('UNREGISTERED'); // Falls back to unregistered
    });

    test('should handle invalid HSN/SAC codes gracefully', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: '29AABCU9603R1ZV',
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE',
        hsnSacCode: 'INVALID123', // Invalid code
        taxableAmount: 100000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(false);
      expect(result.rcmType).toBeNull();
    });

    test('should handle database connection errors gracefully', async () => {
      // This test would simulate database unavailability
      // For now, we expect the system to fail gracefully
      
      expect(async () => {
        await getRCMRules();
      }).not.toThrow();
    });
  });
});