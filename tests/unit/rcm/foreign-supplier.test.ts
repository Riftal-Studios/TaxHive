import { describe, test, expect } from 'vitest';
import { 
  detectKnownSupplier, 
  getForeignSupplierDefaults,
  registerForeignSupplier,
  searchForeignSuppliers,
  updateSupplierRegistry,
  type ForeignSupplierInput,
  type KnownSupplierResult,
  type ForeignSupplierDefaults 
} from '@/lib/rcm/foreign-supplier-registry';

/**
 * Test suite for Foreign Supplier Management in RCM system
 * 
 * Tests the management of foreign suppliers including:
 * - Known supplier detection (Adobe, Microsoft, AWS, Google, etc.)
 * - Default HSN/SAC codes assignment
 * - Currency handling
 * - Supplier registry management
 * 
 * All tests are written FIRST (RED phase) before implementation
 */
describe('Foreign Supplier Management', () => {
  describe('Known Supplier Detection', () => {
    test('should detect Adobe as known supplier', () => {
      const input: ForeignSupplierInput = {
        name: 'Adobe Inc.',
        country: 'USA',
        serviceType: 'SOFTWARE',
      };

      const result = detectKnownSupplier(input);
      
      expect(result.isKnownSupplier).toBe(true);
      expect(result.supplierCode).toBe('ADOBE');
      expect(result.matchConfidence).toBeGreaterThan(0.9);
      expect(result.matchedFields).toContain('name');
    });

    test('should detect Adobe with variations in name', () => {
      const variations = [
        'Adobe Systems Incorporated',
        'Adobe Systems Inc.',
        'ADOBE INC',
        'adobe inc.',
        'Adobe Corporation'
      ];

      variations.forEach(name => {
        const input: ForeignSupplierInput = {
          name,
          country: 'USA',
          serviceType: 'SOFTWARE',
        };

        const result = detectKnownSupplier(input);
        
        expect(result.isKnownSupplier).toBe(true);
        expect(result.supplierCode).toBe('ADOBE');
      });
    });

    test('should detect Microsoft as known supplier', () => {
      const input: ForeignSupplierInput = {
        name: 'Microsoft Corporation',
        country: 'USA',
        serviceType: 'SOFTWARE',
      };

      const result = detectKnownSupplier(input);
      
      expect(result.isKnownSupplier).toBe(true);
      expect(result.supplierCode).toBe('MICROSOFT');
      expect(result.matchConfidence).toBeGreaterThan(0.9);
    });

    test('should detect Microsoft Ireland Operations', () => {
      const input: ForeignSupplierInput = {
        name: 'Microsoft Ireland Operations Limited',
        country: 'IRELAND',
        serviceType: 'CLOUD',
      };

      const result = detectKnownSupplier(input);
      
      expect(result.isKnownSupplier).toBe(true);
      expect(result.supplierCode).toBe('MICROSOFT');
      expect(result.entityType).toBe('SUBSIDIARY');
    });

    test('should detect Amazon Web Services (AWS)', () => {
      const awsVariations = [
        { name: 'Amazon Web Services, Inc.', country: 'USA' },
        { name: 'Amazon Web Services Singapore Private Limited', country: 'SINGAPORE' },
        { name: 'AWS EMEA SARL', country: 'LUXEMBOURG' },
        { name: 'Amazon Web Services Ireland Limited', country: 'IRELAND' }
      ];

      awsVariations.forEach(({ name, country }) => {
        const input: ForeignSupplierInput = {
          name,
          country,
          serviceType: 'CLOUD',
        };

        const result = detectKnownSupplier(input);
        
        expect(result.isKnownSupplier).toBe(true);
        expect(result.supplierCode).toBe('AWS');
      });
    });

    test('should detect Google and its subsidiaries', () => {
      const googleVariations = [
        { name: 'Google LLC', country: 'USA' },
        { name: 'Google Ireland Limited', country: 'IRELAND' },
        { name: 'Google Cloud India Private Limited', country: 'INDIA' },
        { name: 'Google Asia Pacific Pte. Ltd.', country: 'SINGAPORE' }
      ];

      googleVariations.forEach(({ name, country }) => {
        const input: ForeignSupplierInput = {
          name,
          country,
          serviceType: 'SOFTWARE',
        };

        const result = detectKnownSupplier(input);
        
        expect(result.isKnownSupplier).toBe(true);
        expect(result.supplierCode).toBe('GOOGLE');
      });
    });

    test('should detect Zoom Video Communications', () => {
      const input: ForeignSupplierInput = {
        name: 'Zoom Video Communications, Inc.',
        country: 'USA',
        serviceType: 'SOFTWARE',
      };

      const result = detectKnownSupplier(input);
      
      expect(result.isKnownSupplier).toBe(true);
      expect(result.supplierCode).toBe('ZOOM');
    });

    test('should detect Salesforce', () => {
      const input: ForeignSupplierInput = {
        name: 'salesforce.com, inc.',
        country: 'USA',
        serviceType: 'SOFTWARE',
      };

      const result = detectKnownSupplier(input);
      
      expect(result.isKnownSupplier).toBe(true);
      expect(result.supplierCode).toBe('SALESFORCE');
    });

    test('should detect Slack Technologies', () => {
      const input: ForeignSupplierInput = {
        name: 'Slack Technologies, Inc.',
        country: 'USA',
        serviceType: 'SOFTWARE',
      };

      const result = detectKnownSupplier(input);
      
      expect(result.isKnownSupplier).toBe(true);
      expect(result.supplierCode).toBe('SLACK');
    });

    test('should NOT detect unknown supplier', () => {
      const input: ForeignSupplierInput = {
        name: 'Unknown Software Company Ltd',
        country: 'CANADA',
        serviceType: 'SOFTWARE',
      };

      const result = detectKnownSupplier(input);
      
      expect(result.isKnownSupplier).toBe(false);
      expect(result.supplierCode).toBe(null);
      expect(result.matchConfidence).toBe(0);
    });

    test('should handle partial matches with lower confidence', () => {
      const input: ForeignSupplierInput = {
        name: 'Adobe-like Software Solutions',
        country: 'USA',
        serviceType: 'SOFTWARE',
      };

      const result = detectKnownSupplier(input);
      
      if (result.isKnownSupplier) {
        expect(result.matchConfidence).toBeLessThan(0.8); // Lower confidence for partial match
        expect(result.requiresManualReview).toBe(true);
      }
    });

    test('should detect suppliers by domain name', () => {
      const input: ForeignSupplierInput = {
        name: 'Some Company Name',
        country: 'USA',
        serviceType: 'SOFTWARE',
        domain: 'adobe.com',
      };

      const result = detectKnownSupplier(input);
      
      expect(result.isKnownSupplier).toBe(true);
      expect(result.supplierCode).toBe('ADOBE');
      expect(result.matchedFields).toContain('domain');
    });
  });

  describe('Default HSN/SAC Codes', () => {
    test('should return correct defaults for Adobe software services', () => {
      const defaults = getForeignSupplierDefaults('ADOBE');
      
      expect(defaults.defaultHSN).toBe('998314'); // Software services
      expect(defaults.defaultGSTRate).toBe(18);
      expect(defaults.serviceCategory).toBe('SOFTWARE');
      expect(defaults.description).toContain('software');
    });

    test('should return correct defaults for AWS cloud services', () => {
      const defaults = getForeignSupplierDefaults('AWS');
      
      expect(defaults.defaultHSN).toBe('998313'); // Cloud computing services
      expect(defaults.defaultGSTRate).toBe(18);
      expect(defaults.serviceCategory).toBe('CLOUD');
      expect(defaults.description).toContain('cloud');
    });

    test('should return correct defaults for Microsoft services', () => {
      const defaults = getForeignSupplierDefaults('MICROSOFT');
      
      expect(defaults.defaultHSN).toBe('998314'); // Software services
      expect(defaults.defaultGSTRate).toBe(18);
      expect(defaults.serviceCategory).toBe('SOFTWARE');
      expect(defaults.supportedServices).toContain('Office 365');
      expect(defaults.supportedServices).toContain('Azure');
    });

    test('should return correct defaults for Google services', () => {
      const defaults = getForeignSupplierDefaults('GOOGLE');
      
      expect(defaults.defaultHSN).toBe('998314'); // Software services
      expect(defaults.defaultGSTRate).toBe(18);
      expect(defaults.serviceCategory).toBe('SOFTWARE');
      expect(defaults.supportedServices).toContain('Google Workspace');
      expect(defaults.supportedServices).toContain('Google Cloud');
    });

    test('should return correct defaults for Zoom services', () => {
      const defaults = getForeignSupplierDefaults('ZOOM');
      
      expect(defaults.defaultHSN).toBe('998314'); // Software services
      expect(defaults.defaultGSTRate).toBe(18);
      expect(defaults.serviceCategory).toBe('SOFTWARE');
      expect(defaults.description).toContain('video conferencing');
    });

    test('should handle unknown supplier code', () => {
      const defaults = getForeignSupplierDefaults('UNKNOWN_SUPPLIER');
      
      expect(defaults.defaultHSN).toBe('998319'); // Other professional services
      expect(defaults.defaultGSTRate).toBe(18);
      expect(defaults.serviceCategory).toBe('OTHER');
      expect(defaults.requiresManualReview).toBe(true);
    });

    test('should provide comprehensive defaults for Salesforce', () => {
      const defaults = getForeignSupplierDefaults('SALESFORCE');
      
      expect(defaults.defaultHSN).toBe('998314');
      expect(defaults.defaultGSTRate).toBe(18);
      expect(defaults.serviceCategory).toBe('SOFTWARE');
      expect(defaults.description).toContain('CRM');
      expect(defaults.supportedServices).toContain('Sales Cloud');
    });
  });

  describe('Currency Handling', () => {
    test('should provide default currency for US suppliers', () => {
      const defaults = getForeignSupplierDefaults('ADOBE');
      
      expect(defaults.defaultCurrency).toBe('USD');
      expect(defaults.billingCountry).toBe('USA');
    });

    test('should provide default currency for European subsidiaries', () => {
      const input: ForeignSupplierInput = {
        name: 'Microsoft Ireland Operations Limited',
        country: 'IRELAND',
        serviceType: 'CLOUD',
      };

      const result = detectKnownSupplier(input);
      const defaults = getForeignSupplierDefaults(result.supplierCode!, input.country);
      
      expect(defaults.defaultCurrency).toBe('EUR');
      expect(defaults.billingCountry).toBe('IRELAND');
    });

    test('should provide default currency for Singapore subsidiaries', () => {
      const input: ForeignSupplierInput = {
        name: 'Amazon Web Services Singapore Private Limited',
        country: 'SINGAPORE',
        serviceType: 'CLOUD',
      };

      const result = detectKnownSupplier(input);
      const defaults = getForeignSupplierDefaults(result.supplierCode!, input.country);
      
      expect(defaults.defaultCurrency).toBe('USD'); // AWS typically bills in USD
      expect(defaults.billingCountry).toBe('SINGAPORE');
    });

    test('should handle multiple currency support', () => {
      const defaults = getForeignSupplierDefaults('MICROSOFT');
      
      expect(defaults.supportedCurrencies).toContain('USD');
      expect(defaults.supportedCurrencies).toContain('EUR');
      expect(defaults.supportedCurrencies).toContain('GBP');
    });
  });

  describe('Supplier Registry Management', () => {
    test('should register new foreign supplier successfully', () => {
      const supplierData: ForeignSupplierInput = {
        name: 'New Software Company Ltd',
        country: 'CANADA',
        serviceType: 'SOFTWARE',
        defaultHSN: '998314',
        defaultGSTRate: 18,
      };

      const result = registerForeignSupplier(supplierData);
      
      expect(result.success).toBe(true);
      expect(result.supplierId).toBeDefined();
      expect(result.supplier.name).toBe('New Software Company Ltd');
      expect(result.supplier.country).toBe('CANADA');
      expect(result.supplier.isKnownSupplier).toBe(false); // Newly registered
    });

    test('should prevent duplicate supplier registration', () => {
      const supplierData: ForeignSupplierInput = {
        name: 'Adobe Inc.',
        country: 'USA',
        serviceType: 'SOFTWARE',
      };

      const result = registerForeignSupplier(supplierData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(result.existingSupplier).toBeDefined();
      expect(result.existingSupplier?.supplierCode).toBe('ADOBE');
    });

    test('should update existing supplier in registry', () => {
      const updateData = {
        supplierId: 'supplier_123',
        name: 'Adobe Inc.',
        defaultHSN: '998315', // Updated HSN code
        supportedCurrencies: ['USD', 'EUR', 'CAD'],
      };

      const result = updateSupplierRegistry(updateData);
      
      expect(result.success).toBe(true);
      expect(result.updatedSupplier.defaultHSN).toBe('998315');
      expect(result.updatedSupplier.supportedCurrencies).toContain('CAD');
    });

    test('should search suppliers by various criteria', () => {
      const searchResults = searchForeignSuppliers({
        query: 'Adobe',
        country: 'USA',
        serviceType: 'SOFTWARE',
        limit: 10,
      });
      
      expect(searchResults.results).toHaveLength(1);
      expect(searchResults.results[0].supplierCode).toBe('ADOBE');
      expect(searchResults.total).toBe(1);
    });

    test('should search suppliers by service type', () => {
      const searchResults = searchForeignSuppliers({
        serviceType: 'CLOUD',
        limit: 5,
      });
      
      expect(searchResults.results.length).toBeGreaterThan(0);
      expect(searchResults.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ supplierCode: 'AWS' }),
          expect.objectContaining({ supplierCode: 'MICROSOFT' }),
        ])
      );
    });

    test('should handle fuzzy search for supplier names', () => {
      const searchResults = searchForeignSuppliers({
        query: 'Adoby', // Typo in name
        fuzzySearch: true,
        limit: 5,
      });
      
      expect(searchResults.results.length).toBeGreaterThan(0);
      expect(searchResults.results[0].supplierCode).toBe('ADOBE');
      expect(searchResults.results[0].matchScore).toBeLessThan(1.0);
    });
  });

  describe('Service Category Detection', () => {
    test('should detect software services correctly', () => {
      const serviceTypes = [
        'Microsoft Office 365',
        'Adobe Creative Cloud',
        'Salesforce CRM',
        'Slack Workspace',
        'Zoom Pro'
      ];

      serviceTypes.forEach(serviceDescription => {
        const input: ForeignSupplierInput = {
          name: 'Test Company',
          country: 'USA',
          serviceType: 'SOFTWARE',
          serviceDescription,
        };

        const result = detectKnownSupplier(input);
        const defaults = getForeignSupplierDefaults(result.supplierCode || 'UNKNOWN', undefined, input.serviceType);
        
        expect(defaults.serviceCategory).toBe('SOFTWARE');
      });
    });

    test('should detect cloud services correctly', () => {
      const serviceTypes = [
        'AWS EC2',
        'Microsoft Azure',
        'Google Cloud Platform',
        'Oracle Cloud Infrastructure'
      ];

      serviceTypes.forEach(serviceDescription => {
        const input: ForeignSupplierInput = {
          name: 'Test Company',
          country: 'USA',
          serviceType: 'CLOUD',
          serviceDescription,
        };

        const result = detectKnownSupplier(input);
        const defaults = getForeignSupplierDefaults(result.supplierCode || 'UNKNOWN', undefined, input.serviceType);
        
        expect(defaults.serviceCategory).toBe('CLOUD');
      });
    });

    test('should detect consulting services correctly', () => {
      const input: ForeignSupplierInput = {
        name: 'McKinsey & Company',
        country: 'USA',
        serviceType: 'CONSULTING',
        serviceDescription: 'Management consulting',
      };

      const result = detectKnownSupplier(input);
      const defaults = getForeignSupplierDefaults(result.supplierCode || 'UNKNOWN', undefined, input.serviceType);
      
      expect(defaults.serviceCategory).toBe('CONSULTING');
      expect(defaults.defaultHSN).toBe('998311'); // Professional services
    });
  });

  describe('Edge Cases and Validation', () => {
    test('should handle empty supplier name', () => {
      const input: ForeignSupplierInput = {
        name: '',
        country: 'USA',
        serviceType: 'SOFTWARE',
      };

      expect(() => detectKnownSupplier(input)).toThrow('Supplier name is required');
    });

    test('should handle invalid country code', () => {
      const input: ForeignSupplierInput = {
        name: 'Test Company',
        country: 'INVALID_COUNTRY',
        serviceType: 'SOFTWARE',
      };

      expect(() => detectKnownSupplier(input)).toThrow('Invalid country code');
    });

    test('should normalize supplier names for comparison', () => {
      const variations = [
        'ADOBE INC.',
        'Adobe Inc',
        'adobe inc.',
        'Adobe  Inc.', // Extra space
        'Adobe Inc.!!', // Special characters
      ];

      variations.forEach(name => {
        const input: ForeignSupplierInput = {
          name,
          country: 'USA',
          serviceType: 'SOFTWARE',
        };

        const result = detectKnownSupplier(input);
        expect(result.isKnownSupplier).toBe(true);
        expect(result.supplierCode).toBe('ADOBE');
      });
    });

    test('should provide confidence scores for matches', () => {
      const testCases = [
        { name: 'Adobe Inc.', expectedConfidence: 1.0 },
        { name: 'Adobe Systems', expectedConfidence: 1.0 },
        { name: 'Adobe-like Company', expectedConfidence: 0.3 },
      ];

      testCases.forEach(({ name, expectedConfidence }) => {
        const input: ForeignSupplierInput = {
          name,
          country: 'USA',
          serviceType: 'SOFTWARE',
        };

        const result = detectKnownSupplier(input);
        
        if (result.isKnownSupplier) {
          expect(result.matchConfidence).toBeCloseTo(expectedConfidence, 1);
        }
      });
    });

    test('should handle comprehensive supplier information', () => {
      const input: ForeignSupplierInput = {
        name: 'Adobe Inc.',
        country: 'USA',
        serviceType: 'SOFTWARE',
        domain: 'adobe.com',
        serviceDescription: 'Creative Cloud Subscription',
        billingAddress: '345 Park Avenue, San Jose, CA',
      };

      const result = detectKnownSupplier(input);
      
      expect(result.isKnownSupplier).toBe(true);
      expect(result.supplierCode).toBe('ADOBE');
      expect(result.matchedFields).toContain('name');
      expect(result.matchedFields).toContain('domain');
      expect(result.additionalInfo).toBeDefined();
    });
  });
});