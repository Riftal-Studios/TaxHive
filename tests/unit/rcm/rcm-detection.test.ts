import { describe, test, expect } from 'vitest';
import { detectRCM, type RCMDetectionInput, type RCMDetectionResult } from '@/lib/rcm/rcm-detector';

/**
 * Test suite for RCM (Reverse Charge Mechanism) detection logic
 * 
 * Tests the auto-detection of RCM applicability based on:
 * - Vendor registration status
 * - Import of services
 * - Place of supply
 * - Notified goods/services
 * 
 * All tests are written FIRST (RED phase) before implementation
 */
describe('RCM Detection', () => {
  describe('Unregistered Vendor Detection', () => {
    test('should detect RCM for unregistered domestic vendor with no GSTIN', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 50000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('UNREGISTERED');
      expect(result.taxType).toBe('CGST_SGST'); // Intra-state
      expect(result.gstRate).toBe(18);
      expect(result.reason).toContain('unregistered vendor');
    });

    test('should detect RCM for unregistered domestic vendor with empty GSTIN', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: '',
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 25000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('UNREGISTERED');
      expect(result.taxType).toBe('IGST'); // Inter-state
      expect(result.gstRate).toBe(18);
      expect(result.reason).toContain('unregistered vendor');
    });

    test('should NOT detect RCM for registered domestic vendor with valid GSTIN', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: '29AABCU9603R1ZX',
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 75000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(false);
      expect(result.rcmType).toBe(null);
      expect(result.reason).toContain('registered vendor');
    });

    test('should validate GSTIN format before considering vendor as registered', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: 'INVALID_GSTIN',
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 30000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('UNREGISTERED');
      expect(result.reason).toContain('invalid GSTIN');
    });
  });

  describe('Import of Services Detection', () => {
    test('should detect RCM for import of services from USA', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'USA',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE',
        taxableAmount: 100000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('IMPORT_SERVICE');
      expect(result.taxType).toBe('IGST'); // Always IGST for imports
      expect(result.gstRate).toBe(18);
      expect(result.reason).toContain('import of services');
    });

    test('should detect RCM for Adobe services from USA', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'USA',
        vendorName: 'Adobe Inc.',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE',
        taxableAmount: 50000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('IMPORT_SERVICE');
      expect(result.taxType).toBe('IGST');
      expect(result.gstRate).toBe(18);
      expect(result.knownSupplier).toBe(true);
      expect(result.supplierCode).toBe('ADOBE');
    });

    test('should detect RCM for Microsoft services from Ireland', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'IRELAND',
        vendorName: 'Microsoft Ireland Operations Limited',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CLOUD',
        taxableAmount: 75000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('IMPORT_SERVICE');
      expect(result.knownSupplier).toBe(true);
      expect(result.supplierCode).toBe('MICROSOFT');
    });

    test('should detect RCM for AWS services from Singapore', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'SINGAPORE',
        vendorName: 'Amazon Web Services Singapore Private Limited',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CLOUD',
        taxableAmount: 200000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('IMPORT_SERVICE');
      expect(result.knownSupplier).toBe(true);
      expect(result.supplierCode).toBe('AWS');
    });

    test('should NOT detect RCM for domestic services with place of supply in India', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: '29AABCU9603R1ZX',
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE',
        taxableAmount: 100000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(false);
      expect(result.rcmType).toBe(null);
    });
  });

  describe('Place of Supply Detection', () => {
    test('should correctly identify intra-state supply for same state', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 40000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.taxType).toBe('CGST_SGST');
    });

    test('should correctly identify inter-state supply for different states', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'INDIA',
        placeOfSupply: 'GUJARAT',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 40000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.taxType).toBe('IGST');
    });

    test('should handle OUTSIDE_INDIA place of supply', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'UK',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 80000,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('IMPORT_SERVICE');
      expect(result.taxType).toBe('IGST');
    });
  });

  describe('Service Type and Rate Detection', () => {
    test('should apply 18% rate for software services', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'USA',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE',
        taxableAmount: 50000,
      };

      const result = detectRCM(input);
      
      expect(result.gstRate).toBe(18);
    });

    test('should apply 18% rate for consulting services', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'INDIA',
        placeOfSupply: 'KARNATAKA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 30000,
      };

      const result = detectRCM(input);
      
      expect(result.gstRate).toBe(18);
    });

    test('should apply 18% rate for cloud services', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'USA',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CLOUD',
        taxableAmount: 100000,
      };

      const result = detectRCM(input);
      
      expect(result.gstRate).toBe(18);
    });
  });

  describe('Edge Cases and Validation', () => {
    test('should handle missing recipient GSTIN', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: null,
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 25000,
      };

      expect(() => detectRCM(input)).toThrow('Recipient GSTIN is required');
    });

    test('should handle invalid taxable amount', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 0,
      };

      expect(() => detectRCM(input)).toThrow('Taxable amount must be greater than 0');
    });

    test('should handle missing place of supply', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'INDIA',
        placeOfSupply: null,
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 30000,
      };

      expect(() => detectRCM(input)).toThrow('Place of supply is required');
    });

    test('should provide comprehensive result with all required fields', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'USA',
        vendorName: 'Adobe Inc.',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE',
        taxableAmount: 50000,
      };

      const result = detectRCM(input);
      
      // Verify all required fields are present
      expect(result).toHaveProperty('isRCMApplicable');
      expect(result).toHaveProperty('rcmType');
      expect(result).toHaveProperty('taxType');
      expect(result).toHaveProperty('gstRate');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('knownSupplier');
      expect(result).toHaveProperty('supplierCode');
      expect(result).toHaveProperty('defaultHSN');
    });

    test('should detect composition scheme vendor (not eligible for RCM)', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: '27AABCU9603R1ZV', // Valid GSTIN but composition
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 20000,
        isCompositionVendor: true,
      };

      const result = detectRCM(input);
      
      expect(result.isRCMApplicable).toBe(true);
      expect(result.rcmType).toBe('UNREGISTERED');
      expect(result.reason).toContain('composition scheme vendor');
    });
  });

  describe('Known Supplier Detection', () => {
    test('should detect Google services', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'USA',
        vendorName: 'Google LLC',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE',
        taxableAmount: 60000,
      };

      const result = detectRCM(input);
      
      expect(result.knownSupplier).toBe(true);
      expect(result.supplierCode).toBe('GOOGLE');
      expect(result.defaultHSN).toBe('998314'); // Software services
    });

    test('should detect Zoom services', () => {
      const input: RCMDetectionInput = {
        vendorGSTIN: null,
        vendorCountry: 'USA',
        vendorName: 'Zoom Video Communications',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'SOFTWARE',
        taxableAmount: 40000,
      };

      const result = detectRCM(input);
      
      expect(result.knownSupplier).toBe(true);
      expect(result.supplierCode).toBe('ZOOM');
    });
  });
});