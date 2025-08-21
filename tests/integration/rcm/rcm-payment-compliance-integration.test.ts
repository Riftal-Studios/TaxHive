import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * TDD Integration Test Suite for RCM Phase 3: Payment & Compliance Integration
 * 
 * These tests are written FIRST (RED phase) to define integration requirements
 * for payment tracking, GSTR-3B filing, and compliance monitoring.
 * 
 * Tests integration between:
 * - Payment tracking and database
 * - GSTR-3B generation with actual data
 * - Compliance dashboard with real metrics
 * - End-to-end payment workflows
 */

// Import actual implementations
import { detectRCM } from '@/lib/rcm/rcm-detector';
import { 
  createRCMPaymentLiability,
  updatePaymentStatus,
  getOverduePayments,
  processPaymentBatch
} from '@/lib/rcm/rcm-payment-service';
import {
  prepareGSTR3B,
  fileGSTR3B,
  validateGSTR3BData
} from '@/lib/rcm/gstr3b-service';
import {
  getComplianceDashboard,
  calculateComplianceMetrics,
  generateComplianceAlerts
} from '@/lib/rcm/compliance-service';

const prisma = new PrismaClient();

describe('RCM Phase 3: Payment & Compliance Integration', () => {
  
  // Mock current date for testing
  const MOCK_CURRENT_DATE = new Date('2024-06-15');
  
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_CURRENT_DATE);
    
    // Clear test data
    await clearTestData();
    
    // Seed test data
    await seedTestData();
  });

  afterEach(async () => {
    await clearTestData();
    vi.useRealTimers();
  });

  describe('End-to-End Payment Workflow', () => {
    test('should create payment liability from RCM detection', async () => {
      // Step 1: Detect RCM
      const rcmResult = detectRCM({
        vendorGSTIN: null,
        vendorName: 'Unregistered Vendor',
        vendorCountry: 'INDIA',
        placeOfSupply: 'MAHARASHTRA',
        recipientGSTIN: '27AABCU9603R1ZV',
        recipientState: 'MAHARASHTRA',
        serviceType: 'CONSULTING',
        taxableAmount: 100000,
      });

      expect(rcmResult.isRCMApplicable).toBe(true);

      // Step 2: Create payment liability
      const liability = await createRCMPaymentLiability({
        transactionId: 'TEST-001',
        vendorName: 'Unregistered Vendor',
        taxableAmount: 100000,
        gstRate: rcmResult.gstRate!,
        taxType: rcmResult.taxType!,
        rcmType: rcmResult.rcmType!,
        transactionDate: new Date('2024-06-01'),
      });

      expect(liability).toBeDefined();
      expect(liability.id).toBeDefined();
      expect(liability.totalGST).toBe(18000);
      expect(liability.dueDate).toEqual(new Date('2024-07-20'));
      expect(liability.status).toBe('PENDING');

      // Step 3: Verify database persistence
      const savedLiability = await prisma.rCMPaymentLiability.findUnique({
        where: { id: liability.id }
      });

      expect(savedLiability).toBeDefined();
      expect(savedLiability?.vendorName).toBe('Unregistered Vendor');
      expect(Number(savedLiability?.totalGST)).toBe(18000);
    });

    test('should track payment status updates', async () => {
      // Create liability
      const liability = await createRCMPaymentLiability({
        transactionId: 'TEST-002',
        vendorName: 'ABC Services',
        taxableAmount: 50000,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'UNREGISTERED',
        transactionDate: new Date('2024-06-05'),
      });

      // Make partial payment
      const partialPayment = await updatePaymentStatus({
        liabilityId: liability.id,
        paidAmount: 5000,
        paymentDate: new Date('2024-06-10'),
        paymentReference: 'PAY-001',
      });

      expect(partialPayment.status).toBe('PARTIALLY_PAID');
      expect(Number(partialPayment.paidAmount)).toBe(5000);
      expect(Number(partialPayment.remainingAmount)).toBe(4000);

      // Complete payment
      const fullPayment = await updatePaymentStatus({
        liabilityId: liability.id,
        paidAmount: 4000,
        paymentDate: new Date('2024-06-15'),
        paymentReference: 'PAY-002',
      });

      expect(fullPayment.status).toBe('PAID');
      expect(Number(fullPayment.paidAmount)).toBe(9000);
      expect(Number(fullPayment.remainingAmount)).toBe(0);

      // Verify payment history
      const payments = await prisma.rCMPayment.findMany({
        where: { liabilityId: liability.id },
        orderBy: { paymentDate: 'asc' }
      });

      expect(payments.length).toBe(2);
      expect(Number(payments[0].amount)).toBe(5000);
      expect(Number(payments[1].amount)).toBe(4000);
    });

    test('should handle overdue payments with interest', async () => {
      // Create overdue liability
      const liability = await createRCMPaymentLiability({
        transactionId: 'TEST-003',
        vendorName: 'XYZ Transport',
        taxableAmount: 75000,
        gstRate: 5,
        taxType: 'IGST',
        rcmType: 'NOTIFIED_SERVICE',
        transactionDate: new Date('2024-04-01'),
      });

      // Due date would be 2024-05-20, current date is 2024-06-15 (26 days overdue)
      const overduePayments = await getOverduePayments();
      
      expect(overduePayments.length).toBeGreaterThan(0);
      
      const overdueLiability = overduePayments.find(p => p.id === liability.id);
      expect(overdueLiability).toBeDefined();
      expect(overdueLiability?.daysOverdue).toBe(26);
      
      // Calculate interest
      const interestAmount = (3750 * 0.18 * 26) / 365; // Principal * Rate * Days / 365
      expect(Number(overdueLiability?.interestAmount)).toBeCloseTo(48.08, 2);
      
      // Make payment with interest
      const paymentWithInterest = await updatePaymentStatus({
        liabilityId: liability.id,
        paidAmount: 3750 + 48.08,
        paymentDate: MOCK_CURRENT_DATE,
        paymentReference: 'PAY-003',
        includesInterest: true,
        interestAmount: 48.08,
      });

      expect(paymentWithInterest.status).toBe('PAID');
      expect(Number(paymentWithInterest.interestPaid)).toBeCloseTo(48.08, 2);
    });
  });

  describe('GSTR-3B Generation with RCM Data', () => {
    test('should prepare GSTR-3B with RCM transactions', async () => {
      // Create multiple RCM transactions
      await createRCMPaymentLiability({
        transactionId: 'GSTR-001',
        vendorName: 'Unregistered Vendor 1',
        taxableAmount: 100000,
        gstRate: 18,
        taxType: 'CGST_SGST',
        rcmType: 'UNREGISTERED',
        transactionDate: new Date('2024-06-01'),
      });

      await createRCMPaymentLiability({
        transactionId: 'GSTR-002',
        vendorName: 'Foreign Software Co',
        vendorCountry: 'USA',
        taxableAmount: 200000,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'IMPORT_SERVICE',
        transactionDate: new Date('2024-06-05'),
      });

      await createRCMPaymentLiability({
        transactionId: 'GSTR-003',
        vendorName: 'ABC Legal Services',
        hsnSacCode: '998211',
        taxableAmount: 50000,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'NOTIFIED_SERVICE',
        transactionDate: new Date('2024-06-10'),
      });

      // Prepare GSTR-3B for June 2024
      const gstr3b = await prepareGSTR3B({
        gstin: '27AABCU9603R1ZV',
        returnPeriod: '062024',
        month: 6,
        year: 2024,
      });

      // Verify Table 3.1(d) - Inward supplies liable to reverse charge
      expect(gstr3b.table31d).toBeDefined();
      expect(gstr3b.table31d.totalTaxableValue).toBe(350000);
      expect(gstr3b.table31d.centralTax).toBe(9000); // From CGST_SGST transaction
      expect(gstr3b.table31d.stateTax).toBe(9000);  // From CGST_SGST transaction
      expect(gstr3b.table31d.integratedTax).toBe(45000); // 36000 + 9000 from IGST transactions
      expect(gstr3b.table31d.cess).toBe(0);

      // Verify categories are tracked
      expect(gstr3b.rcmBreakdown.unregistered.count).toBe(1);
      expect(gstr3b.rcmBreakdown.unregistered.taxableValue).toBe(100000);
      expect(gstr3b.rcmBreakdown.importService.count).toBe(1);
      expect(gstr3b.rcmBreakdown.importService.taxableValue).toBe(200000);
      expect(gstr3b.rcmBreakdown.notifiedService.count).toBe(1);
      expect(gstr3b.rcmBreakdown.notifiedService.taxableValue).toBe(50000);
    });

    test('should calculate ITC on RCM correctly', async () => {
      // Create RCM transactions with ITC eligibility
      const liability1 = await createRCMPaymentLiability({
        transactionId: 'ITC-001',
        vendorName: 'Legal Services Ltd',
        hsnSacCode: '998211',
        taxableAmount: 100000,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'NOTIFIED_SERVICE',
        transactionDate: new Date('2024-06-01'),
        itcEligible: true,
        itcCategory: 'INPUT_SERVICES',
      });

      // Mark as paid (ITC available only after payment)
      await updatePaymentStatus({
        liabilityId: liability1.id,
        paidAmount: 18000,
        paymentDate: new Date('2024-06-10'),
        paymentReference: 'PAY-ITC-001',
      });

      const liability2 = await createRCMPaymentLiability({
        transactionId: 'ITC-002',
        vendorName: 'Rent-a-cab Services',
        hsnSacCode: '996411',
        taxableAmount: 20000,
        gstRate: 5,
        taxType: 'CGST_SGST',
        rcmType: 'NOTIFIED_SERVICE',
        transactionDate: new Date('2024-06-05'),
        itcEligible: false, // Not eligible under Section 17(5)
        itcIneligibleReason: 'Section 17(5) - Motor vehicles',
      });

      await updatePaymentStatus({
        liabilityId: liability2.id,
        paidAmount: 1000,
        paymentDate: new Date('2024-06-12'),
        paymentReference: 'PAY-ITC-002',
      });

      // Prepare GSTR-3B
      const gstr3b = await prepareGSTR3B({
        gstin: '27AABCU9603R1ZV',
        returnPeriod: '062024',
        month: 6,
        year: 2024,
      });

      // Verify Table 4(B) - ITC on RCM
      expect(gstr3b.table4B).toBeDefined();
      expect(gstr3b.table4B.inputServices.integratedTax).toBe(18000); // Only eligible ITC
      expect(gstr3b.table4B.inputServices.centralTax).toBe(0);
      expect(gstr3b.table4B.inputServices.stateTax).toBe(0);
      expect(gstr3b.table4B.totalITC).toBe(18000);
      expect(gstr3b.table4B.ineligibleITC).toBe(1000); // Ineligible amount tracked
    });

    test('should validate GSTR-3B data before filing', async () => {
      // Create some test transactions
      await createRCMPaymentLiability({
        transactionId: 'VAL-001',
        vendorName: 'Test Vendor',
        taxableAmount: 100000,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'UNREGISTERED',
        transactionDate: new Date('2024-06-01'),
      });

      // Prepare GSTR-3B
      const gstr3b = await prepareGSTR3B({
        gstin: '27AABCU9603R1ZV',
        returnPeriod: '062024',
        month: 6,
        year: 2024,
      });

      // Validate
      const validation = await validateGSTR3BData(gstr3b);

      expect(validation.isValid).toBeDefined();
      expect(validation.errors).toBeDefined();
      expect(validation.warnings).toBeDefined();

      // Check specific validations
      if (!validation.isValid) {
        expect(validation.errors).toContain('Unpaid RCM liabilities exist');
      }
    });
  });

  describe('Compliance Dashboard Integration', () => {
    test('should generate comprehensive compliance dashboard', async () => {
      // Create diverse test data
      await createTestComplianceData();

      // Get dashboard
      const dashboard = await getComplianceDashboard({
        userId: 'test-user',
        period: '062024',
      });

      expect(dashboard).toBeDefined();
      
      // Overall metrics
      expect(dashboard.complianceScore).toBeDefined();
      expect(dashboard.complianceScore).toBeGreaterThanOrEqual(0);
      expect(dashboard.complianceScore).toBeLessThanOrEqual(100);
      
      // Payment metrics
      expect(dashboard.paymentMetrics).toBeDefined();
      expect(dashboard.paymentMetrics.totalLiabilities).toBeGreaterThan(0);
      expect(dashboard.paymentMetrics.paidOnTime).toBeDefined();
      expect(dashboard.paymentMetrics.paidLate).toBeDefined();
      expect(dashboard.paymentMetrics.unpaid).toBeDefined();
      
      // Filing metrics
      expect(dashboard.filingMetrics).toBeDefined();
      expect(dashboard.filingMetrics.returnsFiledOnTime).toBeDefined();
      expect(dashboard.filingMetrics.returnsPending).toBeDefined();
      
      // Risk assessment
      expect(dashboard.riskLevel).toBeDefined();
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(dashboard.riskLevel);
    });

    test('should generate compliance alerts', async () => {
      // Create test scenarios
      await createRCMPaymentLiability({
        transactionId: 'ALERT-001',
        vendorName: 'Overdue Vendor',
        taxableAmount: 100000,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'UNREGISTERED',
        transactionDate: new Date('2024-04-01'), // Old transaction - overdue
      });

      await createRCMPaymentLiability({
        transactionId: 'ALERT-002',
        vendorName: 'Upcoming Vendor',
        taxableAmount: 50000,
        gstRate: 18,
        taxType: 'CGST_SGST',
        rcmType: 'NOTIFIED_SERVICE',
        transactionDate: new Date('2024-06-10'), // Due soon
      });

      // Generate alerts
      const alerts = await generateComplianceAlerts({
        userId: 'test-user',
      });

      expect(alerts.length).toBeGreaterThan(0);
      
      // Check for overdue alert
      const overdueAlert = alerts.find(a => a.type === 'PAYMENT_OVERDUE');
      expect(overdueAlert).toBeDefined();
      expect(overdueAlert?.priority).toBe('HIGH');
      
      // Check for upcoming alert
      const upcomingAlert = alerts.find(a => a.type === 'PAYMENT_DUE_SOON');
      expect(upcomingAlert).toBeDefined();
      expect(upcomingAlert?.priority).toBe('MEDIUM');
    });

    test('should track compliance trends over time', async () => {
      // Create historical data
      await createHistoricalComplianceData();

      // Calculate metrics
      const metrics = await calculateComplianceMetrics({
        userId: 'test-user',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-06-30'),
      });

      expect(metrics.trends).toBeDefined();
      expect(metrics.trends.length).toBe(3); // 3 months
      
      // Verify trend calculation
      const trend = metrics.trends;
      expect(trend[0].month).toBe('April 2024');
      expect(trend[1].month).toBe('May 2024');
      expect(trend[2].month).toBe('June 2024');
      
      // Check for compliance improvement/decline
      expect(metrics.complianceDirection).toBeDefined();
      expect(['IMPROVING', 'STABLE', 'DECLINING']).toContain(metrics.complianceDirection);
    });
  });

  describe('Batch Payment Processing', () => {
    test('should process multiple payments in batch', async () => {
      // Create multiple liabilities
      const liabilities = [];
      for (let i = 1; i <= 5; i++) {
        const liability = await createRCMPaymentLiability({
          transactionId: `BATCH-${i}`,
          vendorName: `Vendor ${i}`,
          taxableAmount: 10000 * i,
          gstRate: 18,
          taxType: 'IGST',
          rcmType: 'UNREGISTERED',
          transactionDate: new Date('2024-06-01'),
        });
        liabilities.push(liability);
      }

      // Process batch payment
      const batchResult = await processPaymentBatch({
        payments: liabilities.map(l => ({
          liabilityId: l.id,
          amount: Number(l.totalGST),
          paymentDate: MOCK_CURRENT_DATE,
          paymentReference: `BATCH-PAY-${l.id}`,
        })),
      });

      expect(batchResult.successful).toBe(5);
      expect(batchResult.failed).toBe(0);
      expect(batchResult.totalAmount).toBe(27000); // Sum of all GST amounts
      
      // Verify all marked as paid
      for (const liability of liabilities) {
        const updated = await prisma.rCMPaymentLiability.findUnique({
          where: { id: liability.id }
        });
        expect(updated?.status).toBe('PAID');
      }
    });

    test('should handle partial batch failures gracefully', async () => {
      // Create liabilities
      const liability1 = await createRCMPaymentLiability({
        transactionId: 'BATCH-FAIL-1',
        vendorName: 'Valid Vendor',
        taxableAmount: 50000,
        gstRate: 18,
        taxType: 'IGST',
        rcmType: 'UNREGISTERED',
        transactionDate: new Date('2024-06-01'),
      });

      // Process batch with one invalid ID
      const batchResult = await processPaymentBatch({
        payments: [
          {
            liabilityId: liability1.id,
            amount: 9000,
            paymentDate: MOCK_CURRENT_DATE,
            paymentReference: 'VALID-PAY',
          },
          {
            liabilityId: 'INVALID-ID',
            amount: 5000,
            paymentDate: MOCK_CURRENT_DATE,
            paymentReference: 'INVALID-PAY',
          },
        ],
      });

      expect(batchResult.successful).toBe(1);
      expect(batchResult.failed).toBe(1);
      expect(batchResult.errors).toBeDefined();
      expect(batchResult.errors[0]).toContain('INVALID-ID');
    });
  });
});

/**
 * Helper functions for test data
 */
async function clearTestData() {
  await prisma.rCMPayment.deleteMany({
    where: { id: { startsWith: 'test-' } }
  });
  await prisma.rCMPaymentLiability.deleteMany({
    where: { transactionId: { startsWith: 'TEST-' } }
  });
  await prisma.rCMPaymentLiability.deleteMany({
    where: { transactionId: { startsWith: 'GSTR-' } }
  });
  await prisma.rCMPaymentLiability.deleteMany({
    where: { transactionId: { startsWith: 'ITC-' } }
  });
  await prisma.rCMPaymentLiability.deleteMany({
    where: { transactionId: { startsWith: 'VAL-' } }
  });
  await prisma.rCMPaymentLiability.deleteMany({
    where: { transactionId: { startsWith: 'ALERT-' } }
  });
  await prisma.rCMPaymentLiability.deleteMany({
    where: { transactionId: { startsWith: 'BATCH-' } }
  });
}

async function seedTestData() {
  // Seed RCM rules if needed
  const rulesCount = await prisma.rCMRule.count();
  if (rulesCount === 0) {
    await prisma.rCMRule.createMany({
      data: [
        {
          id: 'test-legal-services',
          ruleType: 'SERVICE',
          category: 'NOTIFIED',
          hsnSacCodes: ['9982', '998211'],
          description: 'Legal services',
          gstRate: 18,
          effectiveFrom: new Date('2017-07-01'),
          isActive: true,
          priority: 10,
        },
      ],
    });
  }
}

async function createTestComplianceData() {
  // Create various payment statuses
  await createRCMPaymentLiability({
    transactionId: 'TEST-COMP-001',
    vendorName: 'On-time Vendor',
    taxableAmount: 50000,
    gstRate: 18,
    taxType: 'IGST',
    rcmType: 'UNREGISTERED',
    transactionDate: new Date('2024-05-01'),
    status: 'PAID',
    paidDate: new Date('2024-05-15'),
  });

  await createRCMPaymentLiability({
    transactionId: 'TEST-COMP-002',
    vendorName: 'Late Vendor',
    taxableAmount: 30000,
    gstRate: 18,
    taxType: 'CGST_SGST',
    rcmType: 'NOTIFIED_SERVICE',
    transactionDate: new Date('2024-04-01'),
    status: 'PAID',
    paidDate: new Date('2024-05-25'), // Paid late
  });

  await createRCMPaymentLiability({
    transactionId: 'TEST-COMP-003',
    vendorName: 'Unpaid Vendor',
    taxableAmount: 40000,
    gstRate: 18,
    taxType: 'IGST',
    rcmType: 'IMPORT_SERVICE',
    transactionDate: new Date('2024-05-15'),
    status: 'PENDING',
  });
}

async function createHistoricalComplianceData() {
  // April data
  await createRCMPaymentLiability({
    transactionId: 'HIST-APR-001',
    vendorName: 'April Vendor 1',
    taxableAmount: 60000,
    gstRate: 18,
    taxType: 'IGST',
    rcmType: 'UNREGISTERED',
    transactionDate: new Date('2024-04-05'),
    status: 'PAID',
    paidDate: new Date('2024-04-20'),
  });

  // May data
  await createRCMPaymentLiability({
    transactionId: 'HIST-MAY-001',
    vendorName: 'May Vendor 1',
    taxableAmount: 70000,
    gstRate: 18,
    taxType: 'CGST_SGST',
    rcmType: 'NOTIFIED_SERVICE',
    transactionDate: new Date('2024-05-05'),
    status: 'PAID',
    paidDate: new Date('2024-05-18'),
  });

  // June data
  await createRCMPaymentLiability({
    transactionId: 'HIST-JUN-001',
    vendorName: 'June Vendor 1',
    taxableAmount: 80000,
    gstRate: 18,
    taxType: 'IGST',
    rcmType: 'IMPORT_SERVICE',
    transactionDate: new Date('2024-06-05'),
    status: 'PENDING',
  });
}