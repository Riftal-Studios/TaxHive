import { describe, test, expect } from 'vitest';
import { calculateRCMTax, type RCMTaxInput, type RCMTaxResult } from '@/lib/rcm/rcm-calculator';

/**
 * Test suite for RCM (Reverse Charge Mechanism) tax calculation logic
 * 
 * Tests the calculation of:
 * - CGST/SGST for intra-state RCM
 * - IGST for inter-state/import RCM
 * - Currency conversion for imports
 * - Tax amount calculations
 * - Various GST rates and scenarios
 * 
 * All tests are written FIRST (RED phase) before implementation
 */
describe('RCM Tax Calculation', () => {
  describe('Intra-State RCM (CGST + SGST)', () => {
    test('should calculate CGST and SGST for intra-state unregistered vendor at 18%', () => {
      const input: RCMTaxInput = {
        taxableAmount: 100000,
        gstRate: 18,
        taxType: 'CGST_SGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'MAHARASHTRA',
        recipientState: 'MAHARASHTRA',
      };

      const result = calculateRCMTax(input);
      
      expect(result.taxableAmount).toBe(100000);
      expect(result.cgstRate).toBe(9); // 18% / 2
      expect(result.sgstRate).toBe(9); // 18% / 2
      expect(result.cgstAmount).toBe(9000); // 100000 * 9%
      expect(result.sgstAmount).toBe(9000); // 100000 * 9%
      expect(result.igstRate).toBe(0);
      expect(result.igstAmount).toBe(0);
      expect(result.totalTaxAmount).toBe(18000); // 9000 + 9000
      expect(result.totalAmount).toBe(118000); // 100000 + 18000
    });

    test('should calculate CGST and SGST for smaller amount with proper rounding', () => {
      const input: RCMTaxInput = {
        taxableAmount: 33333,
        gstRate: 18,
        taxType: 'CGST_SGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'KARNATAKA',
        recipientState: 'KARNATAKA',
      };

      const result = calculateRCMTax(input);
      
      expect(result.cgstAmount).toBe(3000); // 33333 * 9% = 2999.97 rounded to 3000
      expect(result.sgstAmount).toBe(3000); // 33333 * 9% = 2999.97 rounded to 3000
      expect(result.totalTaxAmount).toBe(6000);
      expect(result.totalAmount).toBe(39333);
    });

    test('should calculate CGST and SGST at 12% rate', () => {
      const input: RCMTaxInput = {
        taxableAmount: 50000,
        gstRate: 12,
        taxType: 'CGST_SGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'GUJARAT',
        recipientState: 'GUJARAT',
      };

      const result = calculateRCMTax(input);
      
      expect(result.cgstRate).toBe(6); // 12% / 2
      expect(result.sgstRate).toBe(6); // 12% / 2
      expect(result.cgstAmount).toBe(3000); // 50000 * 6%
      expect(result.sgstAmount).toBe(3000); // 50000 * 6%
      expect(result.totalTaxAmount).toBe(6000);
    });
  });

  describe('Inter-State RCM (IGST)', () => {
    test('should calculate IGST for inter-state unregistered vendor at 18%', () => {
      const input: RCMTaxInput = {
        taxableAmount: 75000,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'KARNATAKA',
        recipientState: 'MAHARASHTRA',
      };

      const result = calculateRCMTax(input);
      
      expect(result.taxableAmount).toBe(75000);
      expect(result.cgstRate).toBe(0);
      expect(result.sgstRate).toBe(0);
      expect(result.cgstAmount).toBe(0);
      expect(result.sgstAmount).toBe(0);
      expect(result.igstRate).toBe(18);
      expect(result.igstAmount).toBe(13500); // 75000 * 18%
      expect(result.totalTaxAmount).toBe(13500);
      expect(result.totalAmount).toBe(88500); // 75000 + 13500
    });

    test('should calculate IGST at 12% rate for inter-state transaction', () => {
      const input: RCMTaxInput = {
        taxableAmount: 40000,
        gstRate: 12,
        taxType: 'IGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'TAMIL_NADU',
        recipientState: 'DELHI',
      };

      const result = calculateRCMTax(input);
      
      expect(result.igstRate).toBe(12);
      expect(result.igstAmount).toBe(4800); // 40000 * 12%
      expect(result.totalTaxAmount).toBe(4800);
      expect(result.totalAmount).toBe(44800);
    });
  });

  describe('Import of Services (IGST)', () => {
    test('should calculate IGST for import of services at 18%', () => {
      const input: RCMTaxInput = {
        taxableAmount: 100000,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'IMPORT_SERVICE',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientState: 'MAHARASHTRA',
        foreignCurrency: 'USD',
        foreignAmount: 1200,
        exchangeRate: 83.33,
      };

      const result = calculateRCMTax(input);
      
      expect(result.taxableAmount).toBe(99996); // 1200 * 83.33 = 99996
      expect(result.igstRate).toBe(18);
      expect(result.igstAmount).toBe(17999); // 99996 * 18% = 17999.28 rounded to 17999
      expect(result.totalTaxAmount).toBe(17999);
      expect(result.totalAmount).toBe(117995);
      expect(result.foreignCurrency).toBe('USD');
      expect(result.foreignAmount).toBe(1200);
      expect(result.exchangeRate).toBe(83.33);
    });

    test('should handle currency conversion with exchange rate', () => {
      const input: RCMTaxInput = {
        taxableAmount: 0, // Will be calculated from foreign amount
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'IMPORT_SERVICE',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientState: 'KARNATAKA',
        foreignCurrency: 'EUR',
        foreignAmount: 500,
        exchangeRate: 90.50,
      };

      const result = calculateRCMTax(input);
      
      const expectedTaxableAmount = 500 * 90.50; // 45250
      expect(result.taxableAmount).toBe(45250);
      expect(result.igstAmount).toBe(8145); // 45250 * 18%
      expect(result.totalTaxAmount).toBe(8145);
      expect(result.totalAmount).toBe(53395);
    });

    test('should handle GBP currency conversion', () => {
      const input: RCMTaxInput = {
        taxableAmount: 0,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'IMPORT_SERVICE',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientState: 'DELHI',
        foreignCurrency: 'GBP',
        foreignAmount: 800,
        exchangeRate: 104.25,
      };

      const result = calculateRCMTax(input);
      
      const expectedTaxableAmount = 800 * 104.25; // 83400
      expect(result.taxableAmount).toBe(83400);
      expect(result.igstAmount).toBe(15012); // 83400 * 18%
    });
  });

  describe('CESS Calculation', () => {
    test('should calculate CESS when applicable', () => {
      const input: RCMTaxInput = {
        taxableAmount: 100000,
        gstRate: 18,
        cessRate: 1, // 1% CESS
        taxType: 'CGST_SGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'MAHARASHTRA',
        recipientState: 'MAHARASHTRA',
      };

      const result = calculateRCMTax(input);
      
      expect(result.cessRate).toBe(1);
      expect(result.cessAmount).toBe(1000); // 100000 * 1%
      expect(result.cgstAmount).toBe(9000);
      expect(result.sgstAmount).toBe(9000);
      expect(result.totalTaxAmount).toBe(19000); // 9000 + 9000 + 1000
      expect(result.totalAmount).toBe(119000);
    });

    test('should handle no CESS when rate is 0', () => {
      const input: RCMTaxInput = {
        taxableAmount: 50000,
        gstRate: 18,
        cessRate: 0,
        taxType: 'IGST',
        rcmType: 'IMPORT_SERVICE',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientState: 'KARNATAKA',
      };

      const result = calculateRCMTax(input);
      
      expect(result.cessRate).toBe(0);
      expect(result.cessAmount).toBe(0);
      expect(result.totalTaxAmount).toBe(9000); // Only IGST
    });
  });

  describe('Validation and Error Cases', () => {
    test('should throw error for negative taxable amount', () => {
      const input: RCMTaxInput = {
        taxableAmount: -5000,
        gstRate: 18,
        taxType: 'CGST_SGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'MAHARASHTRA',
        recipientState: 'MAHARASHTRA',
      };

      expect(() => calculateRCMTax(input)).toThrow('Taxable amount cannot be negative');
    });

    test('should throw error for invalid GST rate', () => {
      const input: RCMTaxInput = {
        taxableAmount: 50000,
        gstRate: 25, // Invalid rate
        taxType: 'CGST_SGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'MAHARASHTRA',
        recipientState: 'MAHARASHTRA',
      };

      expect(() => calculateRCMTax(input)).toThrow('Invalid GST rate');
    });

    test('should throw error for missing exchange rate in foreign transaction', () => {
      const input: RCMTaxInput = {
        taxableAmount: 0,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'IMPORT_SERVICE',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientState: 'MAHARASHTRA',
        foreignCurrency: 'USD',
        foreignAmount: 1000,
        // exchangeRate missing
      };

      expect(() => calculateRCMTax(input)).toThrow('Exchange rate is required for foreign currency transactions');
    });

    test('should throw error for invalid exchange rate', () => {
      const input: RCMTaxInput = {
        taxableAmount: 0,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'IMPORT_SERVICE',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientState: 'MAHARASHTRA',
        foreignCurrency: 'USD',
        foreignAmount: 1000,
        exchangeRate: 0,
      };

      expect(() => calculateRCMTax(input)).toThrow('Exchange rate must be greater than 0');
    });

    test('should provide comprehensive tax breakdown', () => {
      const input: RCMTaxInput = {
        taxableAmount: 100000,
        gstRate: 18,
        cessRate: 2,
        taxType: 'CGST_SGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'MAHARASHTRA',
        recipientState: 'MAHARASHTRA',
      };

      const result = calculateRCMTax(input);
      
      // Verify all required fields are present
      expect(result).toHaveProperty('taxableAmount');
      expect(result).toHaveProperty('cgstRate');
      expect(result).toHaveProperty('sgstRate');
      expect(result).toHaveProperty('igstRate');
      expect(result).toHaveProperty('cessRate');
      expect(result).toHaveProperty('cgstAmount');
      expect(result).toHaveProperty('sgstAmount');
      expect(result).toHaveProperty('igstAmount');
      expect(result).toHaveProperty('cessAmount');
      expect(result).toHaveProperty('totalTaxAmount');
      expect(result).toHaveProperty('totalAmount');
    });
  });

  describe('Rounding and Precision', () => {
    test('should round tax amounts to nearest paisa', () => {
      const input: RCMTaxInput = {
        taxableAmount: 33333, // Amount that creates decimal tax
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'IMPORT_SERVICE',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientState: 'MAHARASHTRA',
      };

      const result = calculateRCMTax(input);
      
      // 33333 * 18% = 5999.94, should round to 6000
      expect(result.igstAmount).toBe(6000);
      expect(result.totalTaxAmount).toBe(6000);
      expect(result.totalAmount).toBe(39333);
    });

    test('should handle very small amounts correctly', () => {
      const input: RCMTaxInput = {
        taxableAmount: 1,
        gstRate: 18,
        taxType: 'CGST_SGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'MAHARASHTRA',
        recipientState: 'MAHARASHTRA',
      };

      const result = calculateRCMTax(input);
      
      // 1 * 9% = 0.09, should round to 0
      expect(result.cgstAmount).toBe(0);
      expect(result.sgstAmount).toBe(0);
      expect(result.totalTaxAmount).toBe(0);
      expect(result.totalAmount).toBe(1);
    });

    test('should handle large amounts without precision loss', () => {
      const input: RCMTaxInput = {
        taxableAmount: 99999999, // Very large amount
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'IMPORT_SERVICE',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientState: 'MAHARASHTRA',
      };

      const result = calculateRCMTax(input);
      
      expect(result.igstAmount).toBe(18000000); // 99999999 * 18% = 17999999.82, rounded to 18000000
      expect(result.totalAmount).toBe(117999999);
    });
  });

  describe('Different GST Rates', () => {
    test('should calculate correctly at 5% GST rate', () => {
      const input: RCMTaxInput = {
        taxableAmount: 100000,
        gstRate: 5,
        taxType: 'CGST_SGST',
        rcmType: 'UNREGISTERED',
        placeOfSupply: 'MAHARASHTRA',
        recipientState: 'MAHARASHTRA',
      };

      const result = calculateRCMTax(input);
      
      expect(result.cgstRate).toBe(2.5);
      expect(result.sgstRate).toBe(2.5);
      expect(result.cgstAmount).toBe(2500);
      expect(result.sgstAmount).toBe(2500);
      expect(result.totalTaxAmount).toBe(5000);
    });

    test('should calculate correctly at 28% GST rate', () => {
      const input: RCMTaxInput = {
        taxableAmount: 50000,
        gstRate: 28,
        taxType: 'IGST',
        rcmType: 'IMPORT_SERVICE',
        placeOfSupply: 'OUTSIDE_INDIA',
        recipientState: 'MAHARASHTRA',
      };

      const result = calculateRCMTax(input);
      
      expect(result.igstRate).toBe(28);
      expect(result.igstAmount).toBe(14000); // 50000 * 28%
      expect(result.totalTaxAmount).toBe(14000);
    });
  });
});