/**
 * Client Portal Dashboard Tests
 * Following TDD methodology: RED phase - Write failing tests first
 * 
 * Tests for:
 * 1. Invoice listing and filtering
 * 2. Payment status display
 * 3. Dashboard metrics
 * 4. Permission-based access
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ClientPortalDashboard } from '@/lib/client-portal/dashboard';
import { generateUUID } from '@/lib/utils/uuid';

describe('ClientPortalDashboard - Invoice Management', () => {
  const mockClientId = generateUUID();
  const mockUserId = generateUUID();
  const mockInvoiceId1 = generateUUID();
  const mockInvoiceId2 = generateUUID();

  beforeEach(async () => {
    // Clean up test data
    await prisma.invoice.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.clientPortalAccess.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Setup test data
    await setupTestData();
  });

  describe('Invoice Listing', () => {
    it('should return invoices for authenticated client', async () => {
      // RED: This test will fail initially as ClientPortalDashboard doesn't exist
      const dashboard = new ClientPortalDashboard();
      
      const result = await dashboard.getClientInvoices({
        clientId: mockClientId,
        page: 1,
        limit: 10
      });

      expect(result).toHaveProperty('invoices');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('totalPages');
      expect(result.invoices).toHaveLength(2);
      expect(result.total).toBe(2);
      
      // Should include only basic invoice information (no sensitive data)
      const invoice = result.invoices[0];
      expect(invoice).toHaveProperty('id');
      expect(invoice).toHaveProperty('invoiceNumber');
      expect(invoice).toHaveProperty('invoiceDate');
      expect(invoice).toHaveProperty('dueDate');
      expect(invoice).toHaveProperty('totalAmount');
      expect(invoice).toHaveProperty('currency');
      expect(invoice).toHaveProperty('status');
      expect(invoice).toHaveProperty('paymentStatus');
      expect(invoice).toHaveProperty('balanceDue');
      
      // Should not include sensitive business data
      expect(invoice).not.toHaveProperty('exchangeRate');
      expect(invoice).not.toHaveProperty('exchangeSource');
      expect(invoice).not.toHaveProperty('lutId');
    });

    it('should filter invoices by status', async () => {
      const dashboard = new ClientPortalDashboard();
      
      const result = await dashboard.getClientInvoices({
        clientId: mockClientId,
        status: 'SENT',
        page: 1,
        limit: 10
      });

      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0].status).toBe('SENT');
    });

    it('should filter invoices by payment status', async () => {
      const dashboard = new ClientPortalDashboard();
      
      const result = await dashboard.getClientInvoices({
        clientId: mockClientId,
        paymentStatus: 'UNPAID',
        page: 1,
        limit: 10
      });

      expect(result.invoices).toHaveLength(2);
      result.invoices.forEach(invoice => {
        expect(invoice.paymentStatus).toBe('UNPAID');
      });
    });

    it('should filter invoices by date range', async () => {
      const dashboard = new ClientPortalDashboard();
      
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');
      
      const result = await dashboard.getClientInvoices({
        clientId: mockClientId,
        startDate,
        endDate,
        page: 1,
        limit: 10
      });

      expect(result.invoices).toHaveLength(2);
      result.invoices.forEach(invoice => {
        expect(new Date(invoice.invoiceDate)).toBeAfter(startDate);
        expect(new Date(invoice.invoiceDate)).toBeBefore(endDate);
      });
    });

    it('should handle pagination correctly', async () => {
      const dashboard = new ClientPortalDashboard();
      
      const page1 = await dashboard.getClientInvoices({
        clientId: mockClientId,
        page: 1,
        limit: 1
      });

      const page2 = await dashboard.getClientInvoices({
        clientId: mockClientId,
        page: 2,
        limit: 1
      });

      expect(page1.invoices).toHaveLength(1);
      expect(page2.invoices).toHaveLength(1);
      expect(page1.invoices[0].id).not.toBe(page2.invoices[0].id);
      expect(page1.totalPages).toBe(2);
      expect(page2.totalPages).toBe(2);
    });

    it('should return empty result for client without invoices', async () => {
      const emptyClientId = generateUUID();
      
      // Create client without invoices
      await prisma.client.create({
        data: {
          id: emptyClientId,
          userId: mockUserId,
          name: 'Empty Client',
          email: 'empty@example.com',
          address: 'Test Address',
          country: 'India'
        }
      });

      // Create portal access for the empty client
      await prisma.clientPortalAccess.create({
        data: {
          clientId: emptyClientId,
          userId: mockUserId,
          email: 'empty@example.com',
          isEnabled: true,
          isActive: true,
          canViewInvoices: true,
          canRecordPayments: true,
          canDownloadDocuments: true,
          canViewPaymentHistory: true
        }
      });

      const dashboard = new ClientPortalDashboard();
      
      const result = await dashboard.getClientInvoices({
        clientId: emptyClientId,
        page: 1,
        limit: 10
      });

      expect(result.invoices).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('Invoice Details', () => {
    it('should return detailed invoice information for authorized client', async () => {
      const dashboard = new ClientPortalDashboard();
      
      const result = await dashboard.getInvoiceDetails({
        invoiceId: mockInvoiceId1,
        clientId: mockClientId
      });

      expect(result).toHaveProperty('id', mockInvoiceId1);
      expect(result).toHaveProperty('invoiceNumber');
      expect(result).toHaveProperty('lineItems');
      expect(result).toHaveProperty('payments');
      expect(result.lineItems).toBeInstanceOf(Array);
      expect(result.lineItems.length).toBeGreaterThan(0);
      
      // Verify line item structure
      const lineItem = result.lineItems[0];
      expect(lineItem).toHaveProperty('description');
      expect(lineItem).toHaveProperty('quantity');
      expect(lineItem).toHaveProperty('rate');
      expect(lineItem).toHaveProperty('amount');
    });

    it('should throw error for invoice not belonging to client', async () => {
      const otherClientId = generateUUID();
      
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

      // Create portal access for the other client
      await prisma.clientPortalAccess.create({
        data: {
          clientId: otherClientId,
          userId: mockUserId,
          email: 'other@example.com',
          isEnabled: true,
          isActive: true,
          canViewInvoices: true,
          canRecordPayments: true,
          canDownloadDocuments: true,
          canViewPaymentHistory: true
        }
      });

      const dashboard = new ClientPortalDashboard();
      
      await expect(dashboard.getInvoiceDetails({
        invoiceId: mockInvoiceId1,
        clientId: otherClientId
      })).rejects.toThrow('Invoice not found or access denied');
    });

    it('should throw error for non-existent invoice', async () => {
      const dashboard = new ClientPortalDashboard();
      
      await expect(dashboard.getInvoiceDetails({
        invoiceId: 'non-existent-id',
        clientId: mockClientId
      })).rejects.toThrow('Invoice not found or access denied');
    });
  });

  describe('Dashboard Metrics', () => {
    it('should calculate correct dashboard metrics', async () => {
      const dashboard = new ClientPortalDashboard();
      
      const metrics = await dashboard.getDashboardMetrics({
        clientId: mockClientId
      });

      expect(metrics).toHaveProperty('totalInvoices');
      expect(metrics).toHaveProperty('unpaidInvoices');
      expect(metrics).toHaveProperty('overdueInvoices');
      expect(metrics).toHaveProperty('totalOutstanding');
      expect(metrics).toHaveProperty('recentActivity');
      
      expect(metrics.totalInvoices).toBe(2);
      expect(metrics.unpaidInvoices).toBe(2);
      expect(metrics.totalOutstanding).toBeGreaterThan(0);
      expect(metrics.recentActivity).toBeInstanceOf(Array);
    });

    it('should include recent activity with proper formatting', async () => {
      const dashboard = new ClientPortalDashboard();
      
      const metrics = await dashboard.getDashboardMetrics({
        clientId: mockClientId
      });

      expect(metrics.recentActivity).toHaveLength(2);
      
      const activity = metrics.recentActivity[0];
      expect(activity).toHaveProperty('type');
      expect(activity).toHaveProperty('description');
      expect(activity).toHaveProperty('date');
      expect(activity).toHaveProperty('amount');
      expect(activity.type).toBeOneOf(['INVOICE_SENT', 'PAYMENT_RECEIVED', 'INVOICE_OVERDUE']);
    });

    it('should calculate overdue invoices correctly', async () => {
      // First update existing invoices to be paid so they're not overdue
      await prisma.invoice.updateMany({
        where: { clientId: mockClientId },
        data: { paymentStatus: 'PAID' }
      });

      // Create overdue invoice
      const overdueInvoiceId = generateUUID();
      await prisma.invoice.create({
        data: {
          id: overdueInvoiceId,
          userId: mockUserId,
          clientId: mockClientId,
          invoiceNumber: 'FY24-25/003',
          invoiceDate: new Date('2024-01-01'),
          dueDate: new Date('2024-01-15'), // Past due date
          status: 'SENT',
          currency: 'USD',
          exchangeRate: 82.5,
          exchangeSource: 'RBI',
          subtotal: 500,
          totalAmount: 500,
          totalInINR: 41250,
          paymentStatus: 'UNPAID',
          balanceDue: 500,
          serviceCode: '998311'
        }
      });

      const dashboard = new ClientPortalDashboard();
      
      const metrics = await dashboard.getDashboardMetrics({
        clientId: mockClientId
      });

      expect(metrics.overdueInvoices).toBe(1);
    });
  });

  describe('Permission Checks', () => {
    it('should respect canViewInvoices permission', async () => {
      // Update portal access to disable invoice viewing
      await prisma.clientPortalAccess.update({
        where: { clientId: mockClientId },
        data: { canViewInvoices: false }
      });

      const dashboard = new ClientPortalDashboard();
      
      await expect(dashboard.getClientInvoices({
        clientId: mockClientId,
        page: 1,
        limit: 10
      })).rejects.toThrow('Permission denied: Cannot view invoices');
    });

    it('should allow access when canViewInvoices is true', async () => {
      const dashboard = new ClientPortalDashboard();
      
      const result = await dashboard.getClientInvoices({
        clientId: mockClientId,
        page: 1,
        limit: 10
      });

      expect(result.invoices).toHaveLength(2);
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

    // Create test invoices
    await prisma.invoice.create({
      data: {
        id: mockInvoiceId1,
        userId: mockUserId,
        clientId: mockClientId,
        invoiceNumber: 'FY24-25/001',
        invoiceDate: new Date('2025-06-01'),
        dueDate: new Date('2025-06-30'),
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

    await prisma.invoice.create({
      data: {
        id: mockInvoiceId2,
        userId: mockUserId,
        clientId: mockClientId,
        invoiceNumber: 'FY24-25/002',
        invoiceDate: new Date('2025-07-01'),
        dueDate: new Date('2025-07-30'),
        status: 'DRAFT',
        currency: 'USD',
        exchangeRate: 82.5,
        exchangeSource: 'RBI',
        subtotal: 1500,
        totalAmount: 1500,
        totalInINR: 123750,
        paymentStatus: 'UNPAID',
        balanceDue: 1500,
        serviceCode: '998311'
      }
    });

    // Create line items for the invoices
    await prisma.invoiceItem.createMany({
      data: [
        {
          invoiceId: mockInvoiceId1,
          description: 'Software Development Services',
          quantity: 10,
          rate: 100,
          amount: 1000,
          serviceCode: '998311'
        },
        {
          invoiceId: mockInvoiceId2,
          description: 'Consulting Services',
          quantity: 15,
          rate: 100,
          amount: 1500,
          serviceCode: '998311'
        }
      ]
    });
  }
});

// Helper function to extend expect with custom matchers
expect.extend({
  toBeAfter(received: Date, expected: Date) {
    const pass = received > expected;
    return {
      message: () => `expected ${received} to be after ${expected}`,
      pass
    };
  },
  toBeBefore(received: Date, expected: Date) {
    const pass = received < expected;
    return {
      message: () => `expected ${received} to be before ${expected}`,
      pass
    };
  },
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      message: () => `expected ${received} to be one of ${expected.join(', ')}`,
      pass
    };
  }
});