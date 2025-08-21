/**
 * Client Portal Document Download Tests
 * Following TDD methodology: RED phase - Write failing tests first
 * 
 * Tests for:
 * 1. Secure document access
 * 2. Download permissions and tokens
 * 3. Document expiry and access control
 * 4. Audit logging for downloads
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ClientPortalDocuments } from '@/lib/client-portal/documents';
import { generateUUID } from '@/lib/utils/uuid';

describe('ClientPortalDocuments - Secure Document Access', () => {
  const mockClientId = generateUUID();
  const mockUserId = generateUUID();
  const mockInvoiceId = generateUUID();

  beforeEach(async () => {
    // Clean up test data in correct order (child tables first)
    await prisma.clientPortalActivity.deleteMany({});
    await prisma.clientPaymentSubmission.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.clientPortalAccess.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Setup test data
    await setupTestData();
  });

  describe('Document Access Control', () => {
    it('should generate secure download URL for authorized client', async () => {
      // RED: This test will fail initially as ClientPortalDocuments doesn't exist
      const documents = new ClientPortalDocuments();
      
      const result = await documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      expect(result).toHaveProperty('downloadUrl');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('token');
      
      expect(result.downloadUrl).toMatch(/^https?:\/\/.*\/api\/client-portal\/download\/.+$/);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.token).toMatch(/^[a-zA-Z0-9]{32,}$/);
      
      // Token should expire in 1 hour by default
      const expectedExpiry = new Date(Date.now() + 60 * 60 * 1000);
      const timeDiff = Math.abs(result.expiresAt.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute tolerance
    });

    it('should reject access for client without permission', async () => {
      // Update portal access to disable document downloads
      await prisma.clientPortalAccess.update({
        where: { clientId: mockClientId },
        data: { canDownloadDocuments: false }
      });

      const documents = new ClientPortalDocuments();
      
      await expect(documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Permission denied: Cannot download documents');
    });

    it('should reject access for invoice not belonging to client', async () => {
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
          serviceCode: '998311',
          pdfUrl: 'https://example.com/other-invoice.pdf'
        }
      });

      const documents = new ClientPortalDocuments();
      
      await expect(documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: otherInvoiceId, // Invoice belongs to different client
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Document not found or access denied');
    });

    it('should reject access when document does not exist', async () => {
      // Create invoice without PDF
      const noPdfInvoiceId = generateUUID();
      await prisma.invoice.create({
        data: {
          id: noPdfInvoiceId,
          userId: mockUserId,
          clientId: mockClientId,
          invoiceNumber: 'FY24-25/999',
          invoiceDate: new Date('2024-06-01'),
          dueDate: new Date('2024-06-30'),
          status: 'DRAFT',
          currency: 'USD',
          exchangeRate: 82.5,
          exchangeSource: 'RBI',
          subtotal: 1000,
          totalAmount: 1000,
          totalInINR: 82500,
          paymentStatus: 'UNPAID',
          balanceDue: 1000,
          serviceCode: '998311',
          pdfUrl: null // No PDF available
        }
      });

      const documents = new ClientPortalDocuments();
      
      await expect(documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: noPdfInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Document not available');
    });

    it('should validate different document types', async () => {
      const documents = new ClientPortalDocuments();
      
      // Test valid document type
      const result = await documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      expect(result.downloadUrl).toBeTruthy();

      // Test invalid document type
      await expect(documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVALID_TYPE' as any,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Invalid document type');
    });
  });

  describe('Download Token Validation', () => {
    it('should validate correct download token', async () => {
      const documents = new ClientPortalDocuments();
      
      const { token } = await documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const result = await documents.validateDownloadToken({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      expect(result).toHaveProperty('documentUrl');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('mimeType');
      expect(result).toHaveProperty('fileSize');
      expect(result.documentUrl).toBe('https://example.com/invoice.pdf');
      expect(result.filename).toMatch(/^FY24-25-001_.*\.pdf$/);
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should fail validation for invalid token', async () => {
      const documents = new ClientPortalDocuments();
      
      await expect(documents.validateDownloadToken({
        token: 'invalid-token',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Invalid or expired download token');
    });

    it('should fail validation for expired token', async () => {
      const documents = new ClientPortalDocuments();
      
      // Mock an expired token by creating one directly in database
      const expiredTokenId = generateUUID();
      const expiredToken = 'expired-token-12345';
      
      // Create expired token record (this would normally be done by generateDownloadUrl)
      await prisma.clientPortalActivity.create({
        data: {
          portalAccessId: (await prisma.clientPortalAccess.findFirst())!.id,
          action: 'DOWNLOAD_TOKEN_CREATED',
          entityType: 'INVOICE',
          entityId: mockInvoiceId,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser',
          metadata: {
            token: expiredToken,
            expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
            documentType: 'INVOICE_PDF'
          }
        }
      });

      await expect(documents.validateDownloadToken({
        token: expiredToken,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Invalid or expired download token');
    });

    it('should fail validation for token used from different IP', async () => {
      const documents = new ClientPortalDocuments();
      
      const { token } = await documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      await expect(documents.validateDownloadToken({
        token,
        ipAddress: '192.168.2.1', // Different IP
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Token access from unauthorized IP address');
    });

    it('should mark token as used after successful validation', async () => {
      const documents = new ClientPortalDocuments();
      
      const { token } = await documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      // First validation should succeed
      await documents.validateDownloadToken({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      // Second validation should fail (token already used)
      await expect(documents.validateDownloadToken({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Download token already used');
    });
  });

  describe('Download Audit Logging', () => {
    it('should log token generation activity', async () => {
      const documents = new ClientPortalDocuments();
      
      await documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const activities = await prisma.clientPortalActivity.findMany({
        where: {
          action: 'DOWNLOAD_TOKEN_CREATED',
          entityType: 'INVOICE',
          entityId: mockInvoiceId
        }
      });

      expect(activities).toHaveLength(1);
      expect(activities[0].ipAddress).toBe('192.168.1.1');
      expect(activities[0].metadata).toHaveProperty('documentType', 'INVOICE_PDF');
    });

    it('should log successful download activity', async () => {
      const documents = new ClientPortalDocuments();
      
      const { token } = await documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      await documents.validateDownloadToken({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const activities = await prisma.clientPortalActivity.findMany({
        where: {
          action: 'DOWNLOAD_PDF',
          entityType: 'INVOICE',
          entityId: mockInvoiceId
        }
      });

      expect(activities).toHaveLength(1);
      expect(activities[0].statusCode).toBe(200);
      expect(activities[0].metadata).toHaveProperty('filename');
      expect(activities[0].metadata).toHaveProperty('fileSize');
    });

    it('should log failed download attempts', async () => {
      const documents = new ClientPortalDocuments();
      
      try {
        await documents.validateDownloadToken({
          token: 'invalid-token',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser'
        });
      } catch (error) {
        // Expected to fail
      }

      const activities = await prisma.clientPortalActivity.findMany({
        where: {
          action: 'DOWNLOAD_FAILED',
          ipAddress: '192.168.1.1'
        }
      });

      expect(activities).toHaveLength(1);
      expect(activities[0].statusCode).toBe(401);
      expect(activities[0].errorMessage).toBe('Invalid or expired download token');
    });

    it('should track download metrics per client', async () => {
      const documents = new ClientPortalDocuments();
      
      // Generate and use multiple download tokens
      for (let i = 0; i < 3; i++) {
        const { token } = await documents.generateDownloadUrl({
          clientId: mockClientId,
          invoiceId: mockInvoiceId,
          documentType: 'INVOICE_PDF',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser'
        });

        await documents.validateDownloadToken({
          token,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser'
        });
      }

      const downloadCount = await prisma.clientPortalActivity.count({
        where: {
          portalAccessId: (await prisma.clientPortalAccess.findFirst())!.id,
          action: 'DOWNLOAD_PDF'
        }
      });

      expect(downloadCount).toBe(3);
    });
  });

  describe('Document Types and Metadata', () => {
    it('should handle different document types with correct metadata', async () => {
      const documents = new ClientPortalDocuments();
      
      const testCases = [
        {
          documentType: 'INVOICE_PDF' as const,
          expectedMimeType: 'application/pdf',
          expectedExtension: 'pdf'
        }
      ];

      for (const testCase of testCases) {
        const { token } = await documents.generateDownloadUrl({
          clientId: mockClientId,
          invoiceId: mockInvoiceId,
          documentType: testCase.documentType,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser'
        });

        const result = await documents.validateDownloadToken({
          token,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser'
        });

        expect(result.mimeType).toBe(testCase.expectedMimeType);
        expect(result.filename).toMatch(new RegExp(`\\.${testCase.expectedExtension}$`));
      }
    });

    it('should generate proper filename with invoice number', async () => {
      const documents = new ClientPortalDocuments();
      
      const { token } = await documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const result = await documents.validateDownloadToken({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      expect(result.filename).toMatch(/^FY24-25-001_\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it('should include file size in metadata when available', async () => {
      const documents = new ClientPortalDocuments();
      
      const { token } = await documents.generateDownloadUrl({
        clientId: mockClientId,
        invoiceId: mockInvoiceId,
        documentType: 'INVOICE_PDF',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const result = await documents.validateDownloadToken({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      expect(result.fileSize).toBe(256000); // Mock file size
      expect(typeof result.fileSize).toBe('number');
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
        serviceCode: '998311',
        pdfUrl: 'https://example.com/invoice.pdf',
        pdfStatus: 'completed'
      }
    });
  }
});