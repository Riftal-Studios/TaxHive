/**
 * RCM ITC Eligibility Rules Engine Tests
 * 
 * Tests for Section 17(5) blocked categories, RCM-specific ITC rules,
 * business purpose validation, and eligibility determination.
 * 
 * Based on:
 * - Section 17(5) of CGST Act - Blocked Credit categories
 * - GST Circular 05/2024 - Time limits for RCM ITC
 * - 2024 amendments on construction services and CSR activities
 */

import { describe, test, expect } from 'vitest';
import {
  determineITCEligibility,
  ITCEligibilityRequest,
  ITCEligibilityResult,
  BlockedCategory,
  checkBlockedCategories,
  calculateEligibleITC,
  validateBusinessPurpose,
  checkTimeLimit,
  applyProportionateRule,
  ITCReversalReason,
} from '@/lib/rcm/itc-eligibility';

describe('RCM ITC Eligibility Rules Engine', () => {
  describe('Section 17(5) Blocked Categories', () => {
    test('should block ITC for motor vehicles with seating <= 13', () => {
      const request: any = {
        category: 'MOTOR_VEHICLE',
        description: 'Company car for executives',
        seatingCapacity: 5,
        usage: 'EMPLOYEE_TRANSPORT',
        amount: 100000,
        gstAmount: 18000,
      };

      const result = checkBlockedCategories(request);
      
      expect(result.isBlocked).toBe(true);
      expect(result.blockReason).toContain('Section 17(5)(a)');
      expect(result.exception).toBeUndefined();
    });

    test('should allow ITC for motor vehicles used in taxi services', () => {
      const request: any = {
        category: 'MOTOR_VEHICLE',
        description: 'Taxi for cab services',
        seatingCapacity: 5,
        usage: 'TAXI_SERVICE',
        amount: 100000,
        gstAmount: 18000,
      };

      const result = checkBlockedCategories(request);
      
      expect(result.isBlocked).toBe(false);
      expect(result.exception).toBe('Used for taxable supply of passenger transport');
    });

    test('should block ITC for food and beverages', () => {
      const request: any = {
        category: 'FOOD_BEVERAGES',
        description: 'Office cafeteria supplies',
        usage: 'EMPLOYEE_WELFARE',
        amount: 50000,
        gstAmount: 9000,
      };

      const result = checkBlockedCategories(request);
      
      expect(result.isBlocked).toBe(true);
      expect(result.blockReason).toContain('Section 17(5)(b)');
    });

    test('should allow ITC for food when legally mandated', () => {
      const request: any = {
        category: 'FOOD_BEVERAGES',
        description: 'Mandatory meal for factory workers',
        usage: 'LEGAL_REQUIREMENT',
        legalMandateReference: 'Factories Act 1948',
        amount: 50000,
        gstAmount: 9000,
      };

      const result = checkBlockedCategories(request);
      
      expect(result.isBlocked).toBe(false);
      expect(result.exception).toContain('legally required');
    });

    test('should block ITC for health club membership', () => {
      const request: any = {
        category: 'MEMBERSHIP',
        membershipType: 'HEALTH_CLUB',
        description: 'Annual gym membership for employees',
        amount: 20000,
        gstAmount: 3600,
      };

      const result = checkBlockedCategories(request);
      
      expect(result.isBlocked).toBe(true);
      expect(result.blockReason).toContain('Section 17(5)(c)');
    });

    test('should block ITC for construction of immovable property', () => {
      const request: any = {
        category: 'CONSTRUCTION',
        description: 'Office building construction',
        constructionType: 'IMMOVABLE_PROPERTY',
        usage: 'OWN_USE',
        amount: 1000000,
        gstAmount: 180000,
      };

      const result = checkBlockedCategories(request);
      
      expect(result.isBlocked).toBe(true);
      expect(result.blockReason).toContain('Section 17(5)(d)');
    });

    test('should allow ITC for construction used as plant for rental business', () => {
      const request: any = {
        category: 'CONSTRUCTION',
        description: 'Building for rental business',
        constructionType: 'IMMOVABLE_PROPERTY',
        usage: 'RENTAL_BUSINESS',
        isPlantOrMachinery: any,
        amount: 1000000,
        gstAmount: 180000,
      };

      const result = checkBlockedCategories(request);
      
      expect(result.isBlocked).toBe(false);
      expect(result.exception).toContain('plant and machinery');
    });

    test('should block ITC for personal use', () => {
      const request: any = {
        category: 'GENERAL_GOODS',
        description: 'Laptop for personal use',
        usage: 'PERSONAL',
        businessUsePercentage: 0,
        amount: 50000,
        gstAmount: 9000,
      };

      const result = checkBlockedCategories(request);
      
      expect(result.isBlocked).toBe(true);
      expect(result.blockReason).toContain('Section 17(5)(e)');
    });

    test('should block ITC for CSR activities', () => {
      const request: any = {
        category: 'CSR_EXPENSE',
        description: 'School building under CSR',
        usage: 'CSR_ACTIVITY',
        amount: 500000,
        gstAmount: 90000,
      };

      const result = checkBlockedCategories(request);
      
      expect(result.isBlocked).toBe(true);
      expect(result.blockReason).toContain('CSR activities');
    });

    test('should block ITC for lost/stolen goods', () => {
      const request: any = {
        category: 'GENERAL_GOODS',
        description: 'Electronics inventory',
        status: 'STOLEN',
        amount: 100000,
        gstAmount: 18000,
      };

      const result = checkBlockedCategories(request);
      
      expect(result.isBlocked).toBe(true);
      expect(result.blockReason).toContain('Section 17(5)(f)');
    });
  });

  describe('RCM-Specific ITC Rules', () => {
    test('should allow 100% ITC for RCM paid on business services', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'PROFESSIONAL_SERVICES',
        description: 'Legal services from unregistered advocate',
        usage: 'BUSINESS',
        amount: 100000,
        gstAmount: 18000,
        rcmApplicable: true,
      };

      const result = determineITCEligibility(request);
      
      expect(result.isEligible).toBe(true);
      expect(result.eligibleAmount).toBe(18000);
      expect(result.eligibilityPercentage).toBe(100);
    });

    test('should block ITC for RCM on non-business use', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'TRANSPORT_SERVICES',
        description: 'Personal travel under RCM',
        usage: 'PERSONAL',
        amount: 10000,
        gstAmount: 1800,
        rcmApplicable: true,
      };

      const result = determineITCEligibility(request);
      
      expect(result.isEligible).toBe(false);
      expect(result.eligibleAmount).toBe(0);
      expect(result.ineligibleReason).toContain('non-business');
    });

    test('should handle RCM on notified services correctly', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'NOTIFIED_SERVICE',
        sacCode: '9982', // Legal services
        description: 'Advocate services',
        usage: 'BUSINESS',
        amount: 50000,
        gstAmount: 9000,
        rcmApplicable: true,
        isNotifiedService: true,
      };

      const result = determineITCEligibility(request);
      
      expect(result.isEligible).toBe(true);
      expect(result.eligibleAmount).toBe(9000);
      expect(result.complianceNote).toContain('Self-invoice required');
    });

    test('should handle RCM on import of services', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'IMPORT_SERVICES',
        description: 'Software license from USA',
        usage: 'BUSINESS',
        amount: 200000,
        gstAmount: 36000, // 18% IGST
        rcmApplicable: true,
        isImport: true,
      };

      const result = determineITCEligibility(request);
      
      expect(result.isEligible).toBe(true);
      expect(result.eligibleAmount).toBe(36000);
      expect(result.taxType).toBe('IGST');
    });

    test('should handle RCM on GTA services', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'GTA_SERVICE',
        description: 'Goods transport services',
        usage: 'BUSINESS',
        amount: 100000,
        gstAmount: 5000, // 5% under RCM for GTA
        rcmApplicable: true,
        gtaWithoutITC: false,
      };

      const result = determineITCEligibility(request);
      
      expect(result.isEligible).toBe(true);
      expect(result.eligibleAmount).toBe(5000);
    });

    test('should block ITC for GTA services when opted for no ITC', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'GTA_SERVICE',
        description: 'Goods transport services - no ITC option',
        usage: 'BUSINESS',
        amount: 100000,
        gstAmount: 5000,
        rcmApplicable: true,
        gtaWithoutITC: true, // GTA opted for 5% without ITC
      };

      const result = determineITCEligibility(request);
      
      expect(result.isEligible).toBe(false);
      expect(result.ineligibleReason).toContain('GTA service without ITC');
    });

    test('should handle RCM on commercial property rental (Oct 2024 update)', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'RENTAL_COMMERCIAL',
        description: 'Office rental from unregistered landlord',
        usage: 'BUSINESS',
        amount: 100000,
        gstAmount: 18000,
        rcmApplicable: true,
        effectiveDate: new Date('2024-10-15'), // After Oct 10, 2024
      };

      const result = determineITCEligibility(request);
      
      expect(result.isEligible).toBe(true);
      expect(result.eligibleAmount).toBe(18000);
      expect(result.complianceNote).toContain('RCM on commercial rental');
    });
  });

  describe('Proportionate ITC Rules', () => {
    test('should calculate proportionate ITC for mixed use', () => {
      const request: any = {
        category: 'GENERAL_GOODS',
        description: 'Computer for mixed use',
        usage: 'MIXED',
        businessUsePercentage: 70,
        amount: 100000,
        gstAmount: 18000,
      };

      const result = applyProportionateRule(request);
      
      expect(result.eligibleAmount).toBe(12600); // 70% of 18000
      expect(result.blockedAmount).toBe(5400); // 30% of 18000
      expect(result.rule).toBe('PROPORTIONATE');
    });

    test('should handle common credit for taxable and exempt supplies', () => {
      const request: any = {
        category: 'COMMON_CREDIT',
        description: 'Common expenses',
        usage: 'BUSINESS',
        taxableSupplies: 800000,
        exemptSupplies: 200000,
        totalSupplies: 1000000,
        amount: 50000,
        gstAmount: 9000,
      };

      const result = applyProportionateRule(request);
      
      expect(result.eligibleAmount).toBe(7200); // 80% of 9000
      expect(result.reversalAmount).toBe(1800); // 20% of 9000
      expect(result.rule).toBe('RULE_42');
    });

    test('should apply Rule 43 for capital goods', () => {
      const request: any = {
        category: 'CAPITAL_GOODS',
        description: 'Manufacturing equipment',
        usage: 'MIXED',
        isCapitalGood: any,
        taxableSupplies: 700000,
        exemptSupplies: 300000,
        totalSupplies: 1000000,
        amount: 500000,
        gstAmount: 90000,
        usefulLife: 5,
      };

      const result = applyProportionateRule(request);
      
      expect(result.eligibleAmount).toBe(63000); // 70% of 90000
      expect(result.reversalAmount).toBe(27000); // 30% of 90000
      expect(result.rule).toBe('RULE_43');
    });
  });

  describe('Time Limit Validations', () => {
    test('should allow ITC within time limit (Circular 05/2024)', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'PROFESSIONAL_SERVICES',
        usage: 'BUSINESS',
        amount: 50000,
        gstAmount: 9000,
        invoiceDate: new Date('2024-03-15'),
        selfInvoiceDate: new Date('2024-03-20'),
        currentDate: new Date('2024-10-15'), // Before Nov 30, 2024
        financialYear: '2023-24',
      };

      const result = checkTimeLimit(request);
      
      expect(result.isWithinTimeLimit).toBe(true);
      expect(result.lastDateToClaim).toEqual(new Date('2024-11-30'));
    });

    test('should block ITC after time limit expiry', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'PROFESSIONAL_SERVICES',
        usage: 'BUSINESS',
        amount: 50000,
        gstAmount: 9000,
        invoiceDate: new Date('2023-03-15'),
        selfInvoiceDate: new Date('2023-03-20'),
        currentDate: new Date('2024-12-01'), // After Nov 30, 2024
        financialYear: '2022-23',
      };

      const result = checkTimeLimit(request);
      
      expect(result.isWithinTimeLimit).toBe(false);
      expect(result.reason).toContain('Time limit expired');
    });

    test('should calculate correct deadline for RCM self-invoice', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'NOTIFIED_SERVICE',
        usage: 'BUSINESS',
        amount: 100000,
        gstAmount: 18000,
        supplyDate: new Date('2024-01-15'),
        selfInvoiceDate: new Date('2024-02-10'), // Invoice issued in Feb
        currentDate: new Date('2024-08-15'),
        financialYear: '2023-24',
      };

      const result = checkTimeLimit(request);
      
      expect(result.isWithinTimeLimit).toBe(true);
      // For self-invoice issued in FY 2023-24, deadline is Nov 30, 2024
      expect(result.lastDateToClaim).toEqual(new Date('2024-11-30'));
      expect(result.daysRemaining).toBeGreaterThan(0);
    });
  });

  describe('ITC Reversal Scenarios', () => {
    test('should identify ITC reversal for non-payment within 180 days', () => {
      const request: any = {
        category: 'GENERAL_GOODS',
        usage: 'BUSINESS',
        amount: 100000,
        gstAmount: 18000,
        invoiceDate: new Date('2024-01-01'),
        currentDate: new Date('2024-08-15'),
        paymentStatus: 'UNPAID',
        daysSinceInvoice: 227,
      };

      const result = determineITCEligibility(request);
      
      expect(result.reversalRequired).toBe(true);
      expect(result.reversalReason).toBe('NON_PAYMENT_180_DAYS');
      expect(result.reversalAmount).toBe(18000);
    });

    test('should identify ITC reversal for cancelled registration', () => {
      const request: any = {
        category: 'GENERAL_GOODS',
        usage: 'BUSINESS',
        amount: 50000,
        gstAmount: 9000,
        supplierGSTIN: '29ABCDE1234F1Z5',
        supplierStatus: 'CANCELLED',
      };

      const result = determineITCEligibility(request);
      
      expect(result.reversalRequired).toBe(true);
      expect(result.reversalReason).toBe('SUPPLIER_REGISTRATION_CANCELLED');
    });

    test('should handle ITC reclaim after payment', () => {
      const previousReversal: any = {
        reason: 'NON_PAYMENT_180_DAYS',
        amount: 18000,
        reversalDate: new Date('2024-07-01'),
      };

      const request: any = {
        category: 'GENERAL_GOODS',
        usage: 'BUSINESS',
        amount: 100000,
        gstAmount: 18000,
        paymentStatus: 'PAID',
        paymentDate: new Date('2024-08-01'),
        previousReversal,
      };

      const result = determineITCEligibility(request);
      
      expect(result.reclaimEligible).toBe(true);
      expect(result.reclaimAmount).toBe(18000);
      expect(result.reclaimMonth).toBe('August 2024');
    });
  });

  describe('Complete Eligibility Determination', () => {
    test('should process complete eligibility check with all validations', () => {
      const request: any = {
        transactionType: 'RCM',
        category: 'PROFESSIONAL_SERVICES',
        description: 'CA services under RCM',
        sacCode: '9982',
        usage: 'BUSINESS',
        amount: 100000,
        cgst: 9000,
        sgst: 9000,
        gstAmount: 18000,
        rcmApplicable: true,
        invoiceDate: new Date('2024-06-15'),
        selfInvoiceDate: new Date('2024-06-20'),
        currentDate: new Date('2024-07-15'),
        financialYear: '2024-25',
        supplierType: 'UNREGISTERED',
        businessUsePercentage: 100,
      };

      const result = determineITCEligibility(request);
      
      expect(result.isEligible).toBe(true);
      expect(result.eligibleAmount).toBe(18000);
      expect(result.cgstEligible).toBe(9000);
      expect(result.sgstEligible).toBe(9000);
      expect(result.blockedCategories).toEqual([]);
      expect(result.complianceRequirements).toContain('Self-invoice required');
      expect(result.complianceRequirements).toContain('Payment in cash only');
      expect(result.gstr3bTable).toBe('4(A)(3)'); // RCM ITC table
    });

    test('should handle complex mixed-use scenario', () => {
      const request: any = {
        category: 'MOTOR_VEHICLE',
        description: 'Vehicle for mixed use',
        seatingCapacity: 5,
        usage: 'MIXED',
        businessUsePercentage: 60,
        personalUsePercentage: 40,
        amount: 1000000,
        gstAmount: 180000,
        vehicleUsageDetails: {
          businessKm: 15000,
          personalKm: 10000,
          totalKm: 25000,
        },
      };

      const result = determineITCEligibility(request);
      
      expect(result.isEligible).toBe(false); // Blocked under 17(5)(a)
      expect(result.eligibleAmount).toBe(0);
      expect(result.blockedCategories).toContain('MOTOR_VEHICLE');
      expect(result.ineligibleReason).toContain('Section 17(5)(a)');
    });
  });
});