import { describe, test, expect, beforeEach } from 'vitest';
import { 
  getRCMDueDate, 
  checkOverdueStatus, 
  calculateInterest, 
  trackPaymentStatus,
  generateChallanNumber,
  validateRCMPayment,
  type RCMComplianceInput,
  type RCMPaymentInput,
  type RCMOverdueResult 
} from '@/lib/rcm/rcm-compliance';

/**
 * Test suite for RCM (Reverse Charge Mechanism) compliance features
 * 
 * Tests the compliance tracking including:
 * - Due date calculation (20th of next month)
 * - Payment status tracking
 * - Overdue detection
 * - Interest calculation for late payments
 * - GSTR-3B reporting integration
 * 
 * All tests are written FIRST (RED phase) before implementation
 */
describe('RCM Compliance', () => {
  describe('Due Date Calculation', () => {
    test('should calculate due date as 20th of next month for transaction in January', () => {
      const transactionDate = new Date('2024-01-15'); // January 15th
      const dueDate = getRCMDueDate(transactionDate);
      
      expect(dueDate.getDate()).toBe(20);
      expect(dueDate.getMonth()).toBe(1); // February (0-indexed)
      expect(dueDate.getFullYear()).toBe(2024);
    });

    test('should calculate due date as 20th of next month for transaction in December', () => {
      const transactionDate = new Date('2024-12-25'); // December 25th
      const dueDate = getRCMDueDate(transactionDate);
      
      expect(dueDate.getDate()).toBe(20);
      expect(dueDate.getMonth()).toBe(0); // January of next year (0-indexed)
      expect(dueDate.getFullYear()).toBe(2025);
    });

    test('should calculate due date for end of month transaction', () => {
      const transactionDate = new Date('2024-03-31'); // March 31st
      const dueDate = getRCMDueDate(transactionDate);
      
      expect(dueDate.getDate()).toBe(20);
      expect(dueDate.getMonth()).toBe(3); // April (0-indexed)
      expect(dueDate.getFullYear()).toBe(2024);
    });

    test('should calculate due date for leap year February', () => {
      const transactionDate = new Date('2024-02-29'); // Leap year February 29th
      const dueDate = getRCMDueDate(transactionDate);
      
      expect(dueDate.getDate()).toBe(20);
      expect(dueDate.getMonth()).toBe(2); // March (0-indexed)
      expect(dueDate.getFullYear()).toBe(2024);
    });

    test('should handle date at midnight correctly', () => {
      const transactionDate = new Date('2024-06-01T00:00:00.000Z'); // June 1st midnight
      const dueDate = getRCMDueDate(transactionDate);
      
      expect(dueDate.getDate()).toBe(20);
      expect(dueDate.getMonth()).toBe(6); // July (0-indexed)
      expect(dueDate.getFullYear()).toBe(2024);
    });

    test('should throw error for invalid date', () => {
      const invalidDate = new Date('invalid-date');
      
      expect(() => getRCMDueDate(invalidDate)).toThrow('Invalid transaction date');
    });

    test('should throw error for future date beyond reasonable limit', () => {
      const futureDate = new Date('2030-01-01'); // Too far in future
      
      expect(() => getRCMDueDate(futureDate)).toThrow('Transaction date cannot be too far in the future');
    });
  });

  describe('Overdue Status Detection', () => {
    test('should detect overdue status when current date is after due date', () => {
      const dueDate = new Date('2024-02-20');
      const currentDate = new Date('2024-02-25'); // 5 days after due date
      
      const result = checkOverdueStatus(dueDate, currentDate);
      
      expect(result.isOverdue).toBe(true);
      expect(result.daysPastDue).toBe(5);
      expect(result.overdueCategory).toBe('MINOR'); // 1-30 days
    });

    test('should not detect overdue when current date is before due date', () => {
      const dueDate = new Date('2024-02-20');
      const currentDate = new Date('2024-02-15'); // 5 days before due date
      
      const result = checkOverdueStatus(dueDate, currentDate);
      
      expect(result.isOverdue).toBe(false);
      expect(result.daysPastDue).toBe(0);
      expect(result.overdueCategory).toBe('NOT_OVERDUE');
    });

    test('should not detect overdue when current date equals due date', () => {
      const dueDate = new Date('2024-02-20');
      const currentDate = new Date('2024-02-20');
      
      const result = checkOverdueStatus(dueDate, currentDate);
      
      expect(result.isOverdue).toBe(false);
      expect(result.daysPastDue).toBe(0);
      expect(result.overdueCategory).toBe('NOT_OVERDUE');
    });

    test('should categorize overdue as MINOR (1-30 days)', () => {
      const dueDate = new Date('2024-02-20');
      const currentDate = new Date('2024-03-15'); // 24 days after due date
      
      const result = checkOverdueStatus(dueDate, currentDate);
      
      expect(result.isOverdue).toBe(true);
      expect(result.daysPastDue).toBe(24);
      expect(result.overdueCategory).toBe('MINOR');
    });

    test('should categorize overdue as MAJOR (31-90 days)', () => {
      const dueDate = new Date('2024-02-20');
      const currentDate = new Date('2024-04-25'); // 65 days after due date
      
      const result = checkOverdueStatus(dueDate, currentDate);
      
      expect(result.isOverdue).toBe(true);
      expect(result.daysPastDue).toBe(65);
      expect(result.overdueCategory).toBe('MAJOR');
    });

    test('should categorize overdue as CRITICAL (90+ days)', () => {
      const dueDate = new Date('2024-02-20');
      const currentDate = new Date('2024-06-01'); // 102 days after due date
      
      const result = checkOverdueStatus(dueDate, currentDate);
      
      expect(result.isOverdue).toBe(true);
      expect(result.daysPastDue).toBe(102);
      expect(result.overdueCategory).toBe('CRITICAL');
    });

    test('should handle leap year calculations correctly', () => {
      const dueDate = new Date('2024-02-20'); // Leap year
      const currentDate = new Date('2024-03-20'); // Exactly 29 days after (Feb has 29 days)
      
      const result = checkOverdueStatus(dueDate, currentDate);
      
      expect(result.daysPastDue).toBe(29);
      expect(result.overdueCategory).toBe('MINOR');
    });
  });

  describe('Interest Calculation', () => {
    test('should calculate interest at 18% per annum for overdue amount', () => {
      const principal = 100000; // ₹1,00,000
      const daysOverdue = 30;
      const interestRate = 18; // 18% per annum
      
      const interest = calculateInterest(principal, daysOverdue, interestRate);
      
      // Interest = 100000 * 18% * 30/365 = 1479.45 (rounded)
      expect(interest).toBe(1479);
    });

    test('should calculate interest for 60 days overdue', () => {
      const principal = 50000;
      const daysOverdue = 60;
      const interestRate = 18;
      
      const interest = calculateInterest(principal, daysOverdue, interestRate);
      
      // Interest = 50000 * 18% * 60/365 = 1479.45 (rounded)
      expect(interest).toBe(1479);
    });

    test('should calculate interest for 365 days (full year)', () => {
      const principal = 100000;
      const daysOverdue = 365;
      const interestRate = 18;
      
      const interest = calculateInterest(principal, daysOverdue, interestRate);
      
      // Interest = 100000 * 18% * 365/365 = 18000
      expect(interest).toBe(18000);
    });

    test('should return 0 interest for 0 days overdue', () => {
      const principal = 100000;
      const daysOverdue = 0;
      const interestRate = 18;
      
      const interest = calculateInterest(principal, daysOverdue, interestRate);
      
      expect(interest).toBe(0);
    });

    test('should handle small amounts correctly', () => {
      const principal = 1000; // ₹1,000
      const daysOverdue = 30;
      const interestRate = 18;
      
      const interest = calculateInterest(principal, daysOverdue, interestRate);
      
      // Interest = 1000 * 18% * 30/365 = 14.79 (rounded to 15)
      expect(interest).toBe(15);
    });

    test('should throw error for negative principal amount', () => {
      expect(() => calculateInterest(-1000, 30, 18)).toThrow('Principal amount cannot be negative');
    });

    test('should throw error for negative days overdue', () => {
      expect(() => calculateInterest(100000, -10, 18)).toThrow('Days overdue cannot be negative');
    });

    test('should throw error for invalid interest rate', () => {
      expect(() => calculateInterest(100000, 30, -5)).toThrow('Interest rate must be positive');
    });
  });

  describe('Payment Status Tracking', () => {
    test('should track payment status as PENDING when created', () => {
      const input: RCMComplianceInput = {
        taxAmount: 18000,
        transactionDate: new Date('2024-01-15'),
        rcmType: 'UNREGISTERED',
        vendorName: 'Test Vendor',
      };

      const currentDate = new Date('2024-01-25'); // Before due date
      const result = trackPaymentStatus(input, currentDate);
      
      expect(result.paymentStatus).toBe('PENDING');
      expect(result.dueDate.getDate()).toBe(20);
      expect(result.dueDate.getMonth()).toBe(1); // February
      expect(result.paymentDate).toBe(null);
      expect(result.challanNumber).toBe(null);
    });

    test('should update payment status to PAID when payment is made', () => {
      const paymentInput: RCMPaymentInput = {
        rcmTransactionId: 'rcm_123',
        paymentDate: new Date('2024-02-15'),
        challanNumber: 'CHAL27-20240215-001234',
        paymentAmount: 18000,
        paymentMethod: 'ONLINE',
      };

      const result = validateRCMPayment(paymentInput);
      
      expect(result.isValid).toBe(true);
      expect(result.paymentStatus).toBe('PAID');
      expect(result.validationMessages).toHaveLength(0);
    });

    test('should detect OVERDUE status when payment is late', () => {
      const input: RCMComplianceInput = {
        taxAmount: 18000,
        transactionDate: new Date('2024-01-15'),
        rcmType: 'UNREGISTERED',
        vendorName: 'Test Vendor',
      };

      const currentDate = new Date('2024-02-25'); // 5 days after due date
      const result = trackPaymentStatus(input, currentDate);
      
      expect(result.paymentStatus).toBe('OVERDUE');
      expect(result.overdueInfo?.isOverdue).toBe(true);
      expect(result.overdueInfo?.daysPastDue).toBe(5);
      expect(result.interestAmount).toBeGreaterThan(0);
    });

    test('should calculate correct interest for overdue payment', () => {
      const input: RCMComplianceInput = {
        taxAmount: 100000,
        transactionDate: new Date('2024-01-15'),
        rcmType: 'IMPORT_SERVICE',
        vendorName: 'Adobe Inc.',
      };

      const currentDate = new Date('2024-03-20'); // 29 days after due date (Feb 20)
      const result = trackPaymentStatus(input, currentDate);
      
      expect(result.paymentStatus).toBe('OVERDUE');
      expect(result.interestAmount).toBe(1430); // 29 days: 100000 * 18% * 29/365
    });
  });

  describe('Challan Number Generation', () => {
    test('should generate valid challan number with correct format', () => {
      const challanNumber = generateChallanNumber('MAHARASHTRA', new Date('2024-02-15'));
      
      expect(challanNumber).toMatch(/^CHAL27-\d{8}-\d{6}$/); // CHAL + state code + date + sequence
      expect(challanNumber).toContain('CHAL27'); // Maharashtra state code
      expect(challanNumber).toContain('20240215'); // Date in YYYYMMDD format
    });

    test('should generate different challan numbers for same date', () => {
      const date = new Date('2024-02-15');
      const challan1 = generateChallanNumber('KARNATAKA', date);
      const challan2 = generateChallanNumber('KARNATAKA', date);
      
      expect(challan1).not.toBe(challan2);
      expect(challan1).toContain('CHAL29'); // Karnataka state code
      expect(challan2).toContain('CHAL29'); // Karnataka state code
    });

    test('should handle different states correctly', () => {
      const date = new Date('2024-02-15');
      
      const maharashtraChallan = generateChallanNumber('MAHARASHTRA', date);
      const karnatakaChallan = generateChallanNumber('KARNATAKA', date);
      const delhiChallan = generateChallanNumber('DELHI', date);
      
      expect(maharashtraChallan).toContain('CHAL27');
      expect(karnatakaChallan).toContain('CHAL29');
      expect(delhiChallan).toContain('CHAL07');
    });

    test('should throw error for invalid state', () => {
      const date = new Date('2024-02-15');
      
      expect(() => generateChallanNumber('INVALID_STATE', date)).toThrow('Invalid state code');
    });
  });

  describe('Payment Validation', () => {
    test('should validate complete payment details', () => {
      const input: RCMPaymentInput = {
        rcmTransactionId: 'rcm_123',
        paymentDate: new Date('2024-02-15'),
        challanNumber: 'CHAL27-20240215-001234',
        paymentAmount: 18000,
        paymentMethod: 'ONLINE',
      };

      const result = validateRCMPayment(input);
      
      expect(result.isValid).toBe(true);
      expect(result.validationMessages).toHaveLength(0);
    });

    test('should fail validation for missing challan number', () => {
      const input: RCMPaymentInput = {
        rcmTransactionId: 'rcm_123',
        paymentDate: new Date('2024-02-15'),
        challanNumber: '',
        paymentAmount: 18000,
        paymentMethod: 'ONLINE',
      };

      const result = validateRCMPayment(input);
      
      expect(result.isValid).toBe(false);
      expect(result.validationMessages).toContain('Challan number is required');
    });

    test('should fail validation for invalid payment amount', () => {
      const input: RCMPaymentInput = {
        rcmTransactionId: 'rcm_123',
        paymentDate: new Date('2024-02-15'),
        challanNumber: 'CHAL27-20240215-001234',
        paymentAmount: 0,
        paymentMethod: 'ONLINE',
      };

      const result = validateRCMPayment(input);
      
      expect(result.isValid).toBe(false);
      expect(result.validationMessages).toContain('Payment amount must be greater than 0');
    });

    test('should fail validation for future payment date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10); // 10 days in future
      
      const input: RCMPaymentInput = {
        rcmTransactionId: 'rcm_123',
        paymentDate: futureDate,
        challanNumber: 'CHAL27-20240215-001234',
        paymentAmount: 18000,
        paymentMethod: 'ONLINE',
      };

      const result = validateRCMPayment(input);
      
      expect(result.isValid).toBe(false);
      expect(result.validationMessages).toContain('Payment date cannot be in the future');
    });

    test('should validate challan number format', () => {
      const input: RCMPaymentInput = {
        rcmTransactionId: 'rcm_123',
        paymentDate: new Date('2024-02-15'),
        challanNumber: 'INVALID_FORMAT',
        paymentAmount: 18000,
        paymentMethod: 'ONLINE',
      };

      const result = validateRCMPayment(input);
      
      expect(result.isValid).toBe(false);
      expect(result.validationMessages).toContain('Invalid challan number format');
    });
  });

  describe('GSTR-3B Integration', () => {
    test('should generate correct return period for transaction date', () => {
      const transactionDate = new Date('2024-01-15');
      const input: RCMComplianceInput = {
        taxAmount: 18000,
        transactionDate,
        rcmType: 'UNREGISTERED',
        vendorName: 'Test Vendor',
      };

      const result = trackPaymentStatus(input);
      
      expect(result.returnPeriod).toBe('01-2024'); // January 2024
      expect(result.includedInReturn).toBe(false); // Not yet included
    });

    test('should generate correct return period for December transaction', () => {
      const transactionDate = new Date('2024-12-15');
      const input: RCMComplianceInput = {
        taxAmount: 25000,
        transactionDate,
        rcmType: 'IMPORT_SERVICE',
        vendorName: 'Microsoft',
      };

      const result = trackPaymentStatus(input);
      
      expect(result.returnPeriod).toBe('12-2024'); // December 2024
    });

    test('should provide GSTR-3B mapping details', () => {
      const input: RCMComplianceInput = {
        taxAmount: 50000,
        transactionDate: new Date('2024-03-10'),
        rcmType: 'UNREGISTERED',
        vendorName: 'Unregistered Vendor',
      };

      const result = trackPaymentStatus(input);
      
      expect(result.gstr3bMapping).toBeDefined();
      expect(result.gstr3bMapping?.table).toBe('3.1'); // RCM table in GSTR-3B
      expect(result.gstr3bMapping?.applicableTurnover).toBe(50000);
      expect(result.gstr3bMapping?.taxLiability).toBe(9000); // Calculated tax at 18%
    });
  });
});