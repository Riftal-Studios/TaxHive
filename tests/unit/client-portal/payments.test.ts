/**
 * Client Portal Payment Recording Tests
 * Following TDD methodology: RED phase - Write failing tests first
 * 
 * Tests for:
 * 1. Payment submission
 * 2. Payment verification workflow
 * 3. File upload for receipts
 * 4. Auto-matching payments
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ClientPortalPayments } from '@/lib/client-portal/payments';
import { generateUUID } from '@/lib/utils/uuid';

describe('ClientPortalPayments - Payment Management', () => {
  const mockClientId = generateUUID();
  const mockUserId = generateUUID();
  const mockInvoiceId = generateUUID();

  beforeEach(async () => {
    // Clean up test data
    await prisma.clientPaymentSubmission.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.clientPortalAccess.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Setup test data
    await setupTestData();
  });

  describe('Payment Submission', () => {
    it('should allow client to submit payment information', async () => {
      // RED: This test will fail initially as ClientPortalPayments doesn't exist
      const payments = new ClientPortalPayments();
      
      const paymentData = {
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789',
        bankName: 'Test Bank',
        accountLastFour: '1234',
        notes: 'Payment made via wire transfer',
        receiptUrls: ['https://example.com/receipt1.pdf']
      };

      const result = await payments.submitPayment(paymentData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status', 'SUBMITTED');
      expect(result).toHaveProperty('amount', 1000);
      expect(result).toHaveProperty('currency', 'USD');
      expect(result).toHaveProperty('transactionRef', 'TXN123456789');
      expect(result).toHaveProperty('receiptUrls');
      expect(result.receiptUrls).toContain('https://example.com/receipt1.pdf');
    });

    it('should validate payment amount against invoice balance', async () => {
      const payments = new ClientPortalPayments();
      
      const paymentData = {
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 2000, // More than invoice amount (1000)
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      };

      await expect(payments.submitPayment(paymentData)).rejects.toThrow(
        'Payment amount exceeds invoice balance'
      );
    });

    it('should validate currency matches invoice currency', async () => {
      const payments = new ClientPortalPayments();
      
      const paymentData = {
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000,
        currency: 'EUR', // Different from invoice currency (USD)
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      };

      await expect(payments.submitPayment(paymentData)).rejects.toThrow(
        'Payment currency must match invoice currency'
      );
    });

    it('should prevent duplicate payment submissions for same transaction', async () => {
      const payments = new ClientPortalPayments();
      
      const paymentData = {
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      };

      // Submit first payment
      await payments.submitPayment(paymentData);

      // Try to submit duplicate
      await expect(payments.submitPayment(paymentData)).rejects.toThrow(
        'Payment with this transaction reference already exists'
      );
    });

    it('should reject payment submission when client lacks permission', async () => {
      // Update portal access to disable payment recording
      await prisma.clientPortalAccess.update({
        where: { clientId: mockClientId },
        data: { canRecordPayments: false }
      });

      const payments = new ClientPortalPayments();
      
      const paymentData = {
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      };

      await expect(payments.submitPayment(paymentData)).rejects.toThrow(
        'Permission denied: Cannot record payments'
      );
    });

    it('should reject payment for invoice not belonging to client', async () => {
      const otherClientId = generateUUID();
      const otherInvoiceId = generateUUID();
      
      // Create invoice for different client
      await prisma.client.create({
        data: {
          id: otherClientId,
          userId: mockUserId,
          name: 'Other Client',
          email: 'other@example.com',
          address: 'Other Address',
          country: 'India'
        }
      });

      await prisma.invoice.create({
        data: {
          id: otherInvoiceId,
          userId: mockUserId,
          clientId: otherClientId,
          invoiceNumber: 'FY24-25/999',
          invoiceDate: new Date('2024-06-01'),
          dueDate: new Date('2024-06-30'),
          status: 'SENT',
          currency: 'USD',
          exchangeRate: 82.5,
          exchangeSource: 'RBI',
          subtotal: 1000,
          totalAmount: 1000,
          totalInINR: 82500,
          paymentStatus: 'UNPAID',
          balanceDue: 1000,
          serviceCode: '998311'
        }
      });

      const payments = new ClientPortalPayments();
      
      const paymentData = {
        clientId: mockClientId,
        invoiceId: otherInvoiceId, // Invoice belongs to different client
        amount: 1000,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      };

      await expect(payments.submitPayment(paymentData)).rejects.toThrow(
        'Invoice not found or access denied'
      );
    });
  });

  describe('Payment History and Status', () => {
    it('should return payment history for client invoices', async () => {
      const payments = new ClientPortalPayments();
      
      // Submit a payment first
      await payments.submitPayment({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 500,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      });

      const history = await payments.getPaymentHistory({
        clientId: mockClientId,
        page: 1,
        limit: 10
      });

      expect(history).toHaveProperty('payments');
      expect(history).toHaveProperty('total');
      expect(history.payments).toHaveLength(1);
      
      const payment = history.payments[0];
      expect(payment).toHaveProperty('amount', 500);
      expect(payment).toHaveProperty('status', 'SUBMITTED');
      expect(payment).toHaveProperty('invoiceNumber');
      expect(payment).toHaveProperty('paymentDate');
    });

    it('should filter payment history by status', async () => {
      const payments = new ClientPortalPayments();
      
      // Submit multiple payments
      await payments.submitPayment({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 500,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      });

      // Manually verify one payment
      const submission = await prisma.clientPaymentSubmission.findFirst({
        where: { transactionRef: 'TXN123456789' }
      });

      await prisma.clientPaymentSubmission.update({
        where: { id: submission!.id },
        data: { status: 'VERIFIED', verifiedAt: new Date() }
      });

      const verifiedHistory = await payments.getPaymentHistory({
        clientId: mockClientId,
        status: 'VERIFIED',
        page: 1,
        limit: 10
      });

      expect(verifiedHistory.payments).toHaveLength(1);
      expect(verifiedHistory.payments[0].status).toBe('VERIFIED');
    });

    it('should return payment status for specific invoice', async () => {
      const payments = new ClientPortalPayments();
      
      await payments.submitPayment({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      });

      const status = await payments.getInvoicePaymentStatus({
        clientId: mockClientId,
        invoiceId: mockInvoiceId
      });

      expect(status).toHaveProperty('invoiceId', mockInvoiceId);
      expect(status).toHaveProperty('totalAmount', 1000);
      expect(status).toHaveProperty('amountPaid', 0); // Not yet verified
      expect(status).toHaveProperty('balanceDue', 1000);
      expect(status).toHaveProperty('submittedPayments');
      expect(status.submittedPayments).toHaveLength(1);
      expect(status.submittedPayments[0].status).toBe('SUBMITTED');
    });
  });

  describe('Auto-matching and Verification', () => {
    it('should auto-match payments with high confidence', async () => {
      const payments = new ClientPortalPayments();
      
      // Submit payment with exact amount and within reasonable timeframe
      const result = await payments.submitPayment({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000, // Exact invoice amount
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      });

      // Auto-matching should be attempted
      const submission = await prisma.clientPaymentSubmission.findUnique({
        where: { id: result.id }
      });

      expect(submission?.autoMatched).toBe(true);
      expect(submission?.matchConfidence?.toNumber()).toBeGreaterThanOrEqual(0.8);
    });

    it('should not auto-match payments with low confidence', async () => {
      const payments = new ClientPortalPayments();
      
      // Submit payment with partial amount
      const result = await payments.submitPayment({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 500, // Partial amount
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      });

      const submission = await prisma.clientPaymentSubmission.findUnique({
        where: { id: result.id }
      });

      expect(submission?.autoMatched).toBe(false);
      expect(submission?.matchConfidence?.toNumber()).toBeLessThan(0.8);
    });

    it('should create verified payment record when auto-matched with high confidence', async () => {
      // Mock the auto-verification process
      const payments = new ClientPortalPayments();
      
      const result = await payments.submitPayment({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000, // Exact amount
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      });

      // Simulate admin verification of high-confidence match
      await payments.verifyPayment({
        submissionId: result.id,
        verifiedBy: mockUserId,
        notes: 'Auto-verified based on exact amount match'
      });

      const submission = await prisma.clientPaymentSubmission.findUnique({
        where: { id: result.id },
        include: { linkedPayment: true }
      });

      expect(submission?.status).toBe('VERIFIED');
      expect(submission?.linkedPayment).toBeTruthy();
      expect(submission?.linkedPayment?.amount.toNumber()).toBe(1000);
    });
  });

  describe('File Upload for Receipts', () => {
    it('should validate receipt file URLs', async () => {
      const payments = new ClientPortalPayments();
      
      const validUrls = [
        'https://secure-bucket.s3.amazonaws.com/receipt1.pdf',
        'https://storage.googleapis.com/bucket/receipt2.jpg'
      ];

      const paymentData = {
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789',
        receiptUrls: validUrls
      };

      const result = await payments.submitPayment(paymentData);
      expect(result.receiptUrls).toEqual(validUrls);
    });

    it('should reject invalid receipt URLs', async () => {
      const payments = new ClientPortalPayments();
      
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid-protocol.com/file.pdf'
      ];

      const paymentData = {
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789',
        receiptUrls: invalidUrls
      };

      await expect(payments.submitPayment(paymentData)).rejects.toThrow(
        'Invalid receipt URL format'
      );
    });

    it('should limit number of receipt files', async () => {
      const payments = new ClientPortalPayments();
      
      const tooManyUrls = Array.from({ length: 11 }, (_, i) => 
        `https://example.com/receipt${i}.pdf`
      );

      const paymentData = {
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789',
        receiptUrls: tooManyUrls
      };

      await expect(payments.submitPayment(paymentData)).rejects.toThrow(
        'Maximum 10 receipt files allowed'
      );
    });
  });

  describe('Payment Notifications', () => {
    it('should create notification when payment is submitted', async () => {
      const payments = new ClientPortalPayments();
      
      await payments.submitPayment({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      });

      const notifications = await prisma.clientPortalNotification.findMany({
        where: {
          clientId: mockClientId,
          type: 'PAYMENT_SUBMITTED'
        }
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toContain('Payment Submitted');
      expect(notifications[0].message).toContain('$1,000');
    });

    it('should create notification when payment is verified', async () => {
      const payments = new ClientPortalPayments();
      
      const result = await payments.submitPayment({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        amount: 1000,
        currency: 'USD',
        paymentDate: new Date('2024-08-15'),
        paymentMethod: 'WIRE',
        transactionRef: 'TXN123456789'
      });

      await payments.verifyPayment({
        submissionId: result.id,
        verifiedBy: mockUserId,
        notes: 'Payment verified'
      });

      const notifications = await prisma.clientPortalNotification.findMany({
        where: {
          clientId: mockClientId,
          type: 'PAYMENT_VERIFIED'
        }
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toContain('Payment Verified');
    });
  });

  // Helper function to setup test data
  async function setupTestData() {
    await prisma.user.create({
      data: {
        id: mockUserId,
        email: 'business@example.com',
        name: 'Business Owner'
      }
    });

    await prisma.client.create({
      data: {
        id: mockClientId,
        userId: mockUserId,
        name: 'Test Client',
        email: 'client@example.com',
        address: 'Test Address',
        country: 'India'
      }
    });

    await prisma.clientPortalAccess.create({
      data: {
        clientId: mockClientId,
        userId: mockUserId,
        email: 'client@example.com',
        isEnabled: true,
        isActive: true,
        canViewInvoices: true,
        canRecordPayments: true,
        canDownloadDocuments: true,
        canViewPaymentHistory: true
      }
    });

    await prisma.invoice.create({
      data: {
        id: mockInvoiceId,
        userId: mockUserId,
        clientId: mockClientId,
        invoiceNumber: 'FY24-25/001',
        invoiceDate: new Date('2024-06-01'),
        dueDate: new Date('2024-06-30'),
        status: 'SENT',
        currency: 'USD',
        exchangeRate: 82.5,
        exchangeSource: 'RBI',
        subtotal: 1000,
        totalAmount: 1000,
        totalInINR: 82500,
        paymentStatus: 'UNPAID',
        balanceDue: 1000,
        serviceCode: '998311'
      }
    });
  }
});