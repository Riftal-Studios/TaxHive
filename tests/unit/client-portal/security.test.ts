/**
 * Client Portal Security Tests
 * Following TDD methodology: RED phase - Write failing tests first
 * 
 * Tests for:
 * 1. Access control and authorization
 * 2. Rate limiting and abuse prevention
 * 3. Security headers and CSRF protection
 * 4. Data isolation between clients
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ClientPortalSecurity } from '@/lib/client-portal/security';
import { generateUUID } from '@/lib/utils/uuid';

describe('ClientPortalSecurity - Access Control & Protection', () => {
  const mockClientId1 = generateUUID();
  const mockClientId2 = generateUUID();
  const mockUserId = generateUUID();
  const mockInvoiceId1 = generateUUID();
  const mockInvoiceId2 = generateUUID();

  beforeEach(async () => {
    // Clean up test data
    await prisma.clientPortalActivity.deleteMany({});
    await prisma.clientPortalSession.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.clientPortalAccess.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Setup test data
    await setupTestData();
  });

  describe('Data Isolation', () => {
    it('should prevent client from accessing other client data', async () => {
      // RED: This test will fail initially as ClientPortalSecurity doesn't exist
      const security = new ClientPortalSecurity();
      
      // Test invoice access
      const hasAccess = await security.validateInvoiceAccess({
        clientId: mockClientId1,
        invoiceId: mockInvoiceId2 // Belongs to mockClientId2
      });

      expect(hasAccess).toBe(false);
    });

    it('should allow client to access their own data', async () => {
      const security = new ClientPortalSecurity();
      
      const hasAccess = await security.validateInvoiceAccess({
        clientId: mockClientId1,
        invoiceId: mockInvoiceId1 // Belongs to mockClientId1
      });

      expect(hasAccess).toBe(true);
    });

    it('should validate resource ownership before any operation', async () => {
      const security = new ClientPortalSecurity();
      
      // Test with non-existent invoice
      await expect(security.validateInvoiceAccess({
        clientId: mockClientId1,
        invoiceId: 'non-existent-invoice'
      })).resolves.toBe(false);
    });

    it('should prevent SQL injection in resource validation', async () => {
      const security = new ClientPortalSecurity();
      
      // Attempt SQL injection in invoice ID
      const maliciousInvoiceId = "'; DROP TABLE invoices; --";
      
      await expect(security.validateInvoiceAccess({
        clientId: mockClientId1,
        invoiceId: maliciousInvoiceId
      })).resolves.toBe(false);
      
      // Verify table still exists by checking invoice count
      const invoiceCount = await prisma.invoice.count();
      expect(invoiceCount).toBe(2); // Should still have our test invoices
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per client', async () => {
      const security = new ClientPortalSecurity();
      
      const clientIp = '192.168.1.1';
      const action = 'LOGIN_ATTEMPT';
      
      // Make requests up to limit (5 per minute)
      for (let i = 0; i < 5; i++) {
        const isAllowed = await security.checkRateLimit({
          clientId: mockClientId1,
          ipAddress: clientIp,
          action,
          timeWindow: 60, // 1 minute
          maxAttempts: 5
        });
        expect(isAllowed).toBe(true);
      }
      
      // 6th request should be blocked
      const isBlocked = await security.checkRateLimit({
        clientId: mockClientId1,
        ipAddress: clientIp,
        action,
        timeWindow: 60,
        maxAttempts: 5
      });
      
      expect(isBlocked).toBe(false);
    });

    it('should have separate rate limits per IP address', async () => {
      const security = new ClientPortalSecurity();
      
      const action = 'LOGIN_ATTEMPT';
      
      // Make 5 requests from first IP
      for (let i = 0; i < 5; i++) {
        await security.checkRateLimit({
          clientId: mockClientId1,
          ipAddress: '192.168.1.1',
          action,
          timeWindow: 60,
          maxAttempts: 5
        });
      }
      
      // Requests from second IP should still be allowed
      const isAllowed = await security.checkRateLimit({
        clientId: mockClientId1,
        ipAddress: '192.168.1.2',
        action,
        timeWindow: 60,
        maxAttempts: 5
      });
      
      expect(isAllowed).toBe(true);
    });

    it('should reset rate limit after time window', async () => {
      const security = new ClientPortalSecurity();
      
      const clientIp = '192.168.1.1';
      const action = 'LOGIN_ATTEMPT';
      
      // Fill up rate limit
      for (let i = 0; i < 5; i++) {
        await security.checkRateLimit({
          clientId: mockClientId1,
          ipAddress: clientIp,
          action,
          timeWindow: 1, // 1 second window for testing
          maxAttempts: 5
        });
      }
      
      // Should be blocked immediately
      expect(await security.checkRateLimit({
        clientId: mockClientId1,
        ipAddress: clientIp,
        action,
        timeWindow: 1,
        maxAttempts: 5
      })).toBe(false);
      
      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be allowed again
      expect(await security.checkRateLimit({
        clientId: mockClientId1,
        ipAddress: clientIp,
        action,
        timeWindow: 1,
        maxAttempts: 5
      })).toBe(true);
    });

    it('should have different limits for different actions', async () => {
      const security = new ClientPortalSecurity();
      
      const clientIp = '192.168.1.1';
      
      // Fill up login attempts
      for (let i = 0; i < 3; i++) {
        await security.checkRateLimit({
          clientId: mockClientId1,
          ipAddress: clientIp,
          action: 'LOGIN_ATTEMPT',
          timeWindow: 60,
          maxAttempts: 3
        });
      }
      
      // Login should be blocked
      expect(await security.checkRateLimit({
        clientId: mockClientId1,
        ipAddress: clientIp,
        action: 'LOGIN_ATTEMPT',
        timeWindow: 60,
        maxAttempts: 3
      })).toBe(false);
      
      // But downloads should still be allowed (different action)
      expect(await security.checkRateLimit({
        clientId: mockClientId1,
        ipAddress: clientIp,
        action: 'DOWNLOAD_PDF',
        timeWindow: 60,
        maxAttempts: 10
      })).toBe(true);
    });
  });

  describe('Session Security', () => {
    it('should validate session tokens securely', async () => {
      const security = new ClientPortalSecurity();
      
      // Create a mock session
      const sessionToken = 'valid-session-token-12345';
      const session = await prisma.clientPortalSession.create({
        data: {
          portalAccessId: (await prisma.clientPortalAccess.findFirst({ where: { clientId: mockClientId1 } }))!.id,
          sessionToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser',
          isActive: true
        }
      });

      const isValid = await security.validateSession({
        sessionToken,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      expect(isValid).toBe(true);
    });

    it('should reject expired sessions', async () => {
      const security = new ClientPortalSecurity();
      
      const expiredSessionToken = 'expired-session-token-12345';
      await prisma.clientPortalSession.create({
        data: {
          portalAccessId: (await prisma.clientPortalAccess.findFirst({ where: { clientId: mockClientId1 } }))!.id,
          sessionToken: expiredSessionToken,
          expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser',
          isActive: true
        }
      });

      const isValid = await security.validateSession({
        sessionToken: expiredSessionToken,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      expect(isValid).toBe(false);
    });

    it('should reject sessions from different IP when strict mode enabled', async () => {
      const security = new ClientPortalSecurity();
      
      const sessionToken = 'strict-session-token-12345';
      await prisma.clientPortalSession.create({
        data: {
          portalAccessId: (await prisma.clientPortalAccess.findFirst({ where: { clientId: mockClientId1 } }))!.id,
          sessionToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser',
          isActive: true
        }
      });

      const isValid = await security.validateSession({
        sessionToken,
        ipAddress: '192.168.1.2', // Different IP
        userAgent: 'Mozilla/5.0 Test Browser',
        strictIpCheck: true
      });

      expect(isValid).toBe(false);
    });

    it('should detect session hijacking attempts', async () => {
      const security = new ClientPortalSecurity();
      
      const sessionToken = 'hijack-test-session-12345';
      await prisma.clientPortalSession.create({
        data: {
          portalAccessId: (await prisma.clientPortalAccess.findFirst({ where: { clientId: mockClientId1 } }))!.id,
          sessionToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Original Browser',
          isActive: true
        }
      });

      // Attempt to use session from different user agent
      const suspiciousActivity = await security.detectSuspiciousActivity({
        sessionToken,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Different Browser'
      });

      expect(suspiciousActivity.isSuspicious).toBe(true);
      expect(suspiciousActivity.reasons).toContain('USER_AGENT_CHANGE');
    });
  });

  describe('IP Whitelisting', () => {
    it('should enforce IP whitelist when configured', async () => {
      // Update client portal access with IP whitelist
      await prisma.clientPortalAccess.update({
        where: { clientId: mockClientId1 },
        data: { allowedIPs: ['192.168.1.1', '10.0.0.1'] }
      });

      const security = new ClientPortalSecurity();
      
      // Should allow access from whitelisted IP
      const allowedAccess = await security.validateIPAccess({
        clientId: mockClientId1,
        ipAddress: '192.168.1.1'
      });
      expect(allowedAccess).toBe(true);

      // Should block access from non-whitelisted IP
      const blockedAccess = await security.validateIPAccess({
        clientId: mockClientId1,
        ipAddress: '192.168.2.1'
      });
      expect(blockedAccess).toBe(false);
    });

    it('should allow all IPs when whitelist is empty', async () => {
      const security = new ClientPortalSecurity();
      
      const access = await security.validateIPAccess({
        clientId: mockClientId1,
        ipAddress: '192.168.99.99'
      });
      
      expect(access).toBe(true);
    });

    it('should support CIDR notation in IP whitelist', async () => {
      await prisma.clientPortalAccess.update({
        where: { clientId: mockClientId1 },
        data: { allowedIPs: ['192.168.1.0/24'] }
      });

      const security = new ClientPortalSecurity();
      
      // Should allow IPs in range
      expect(await security.validateIPAccess({
        clientId: mockClientId1,
        ipAddress: '192.168.1.50'
      })).toBe(true);

      // Should block IPs outside range
      expect(await security.validateIPAccess({
        clientId: mockClientId1,
        ipAddress: '192.168.2.50'
      })).toBe(false);
    });
  });

  describe('CSRF Protection', () => {
    it('should generate CSRF tokens for sessions', async () => {
      const security = new ClientPortalSecurity();
      
      const csrfToken = await security.generateCSRFToken({
        sessionId: 'test-session-id',
        clientId: mockClientId1
      });

      expect(csrfToken).toMatch(/^[a-zA-Z0-9+/]+=*$/); // Base64 format
      expect(csrfToken.length).toBeGreaterThan(20);
    });

    it('should validate CSRF tokens correctly', async () => {
      const security = new ClientPortalSecurity();
      
      const csrfToken = await security.generateCSRFToken({
        sessionId: 'test-session-id',
        clientId: mockClientId1
      });

      const isValid = await security.validateCSRFToken({
        token: csrfToken,
        sessionId: 'test-session-id',
        clientId: mockClientId1
      });

      expect(isValid).toBe(true);
    });

    it('should reject invalid CSRF tokens', async () => {
      const security = new ClientPortalSecurity();
      
      const isValid = await security.validateCSRFToken({
        token: 'invalid-csrf-token',
        sessionId: 'test-session-id',
        clientId: mockClientId1
      });

      expect(isValid).toBe(false);
    });

    it('should reject CSRF tokens for different sessions', async () => {
      const security = new ClientPortalSecurity();
      
      const csrfToken = await security.generateCSRFToken({
        sessionId: 'session-1',
        clientId: mockClientId1
      });

      const isValid = await security.validateCSRFToken({
        token: csrfToken,
        sessionId: 'session-2', // Different session
        clientId: mockClientId1
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    it('should log security events', async () => {
      const security = new ClientPortalSecurity();
      
      await security.logSecurityEvent({
        clientId: mockClientId1,
        eventType: 'SUSPICIOUS_ACTIVITY',
        severity: 'HIGH',
        description: 'Multiple failed login attempts',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        metadata: {
          attemptCount: 5,
          timeWindow: '5 minutes'
        }
      });

      const events = await prisma.clientPortalActivity.findMany({
        where: {
          action: 'SECURITY_EVENT',
          entityType: 'SECURITY'
        }
      });

      expect(events).toHaveLength(1);
      expect(events[0].metadata).toHaveProperty('eventType', 'SUSPICIOUS_ACTIVITY');
      expect(events[0].metadata).toHaveProperty('severity', 'HIGH');
    });

    it('should track failed authentication attempts', async () => {
      const security = new ClientPortalSecurity();
      
      await security.logFailedAuthAttempt({
        email: 'client@example.com',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        reason: 'INVALID_TOKEN'
      });

      const events = await prisma.clientPortalActivity.findMany({
        where: {
          action: 'AUTH_FAILED',
          ipAddress: '192.168.1.1'
        }
      });

      expect(events).toHaveLength(1);
      expect(events[0].metadata).toHaveProperty('reason', 'INVALID_TOKEN');
    });

    it('should aggregate security metrics', async () => {
      const security = new ClientPortalSecurity();
      
      // Generate multiple security events
      for (let i = 0; i < 3; i++) {
        await security.logSecurityEvent({
          clientId: mockClientId1,
          eventType: 'RATE_LIMIT_EXCEEDED',
          severity: 'MEDIUM',
          description: 'Rate limit exceeded',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser'
        });
      }

      const metrics = await security.getSecurityMetrics({
        clientId: mockClientId1,
        timeRange: '24h'
      });

      expect(metrics).toHaveProperty('totalEvents');
      expect(metrics).toHaveProperty('highSeverityEvents');
      expect(metrics).toHaveProperty('uniqueIPs');
      expect(metrics.totalEvents).toBe(3);
    });
  });

  describe('Vulnerability Prevention', () => {
    it('should sanitize input parameters', async () => {
      const security = new ClientPortalSecurity();
      
      const maliciousInput = "<script>alert('xss')</script>";
      const sanitized = await security.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('should validate file upload types', async () => {
      const security = new ClientPortalSecurity();
      
      // Valid file types
      expect(security.validateFileType('document.pdf', ['pdf', 'jpg', 'png'])).toBe(true);
      expect(security.validateFileType('receipt.jpg', ['pdf', 'jpg', 'png'])).toBe(true);
      
      // Invalid file types
      expect(security.validateFileType('malware.exe', ['pdf', 'jpg', 'png'])).toBe(false);
      expect(security.validateFileType('script.js', ['pdf', 'jpg', 'png'])).toBe(false);
    });

    it('should prevent directory traversal in file paths', async () => {
      const security = new ClientPortalSecurity();
      
      const safePath = security.sanitizeFilePath('invoice-123.pdf');
      expect(safePath).toBe('invoice-123.pdf');
      
      const maliciousPath = security.sanitizeFilePath('../../../etc/passwd');
      expect(maliciousPath).not.toContain('../');
      expect(maliciousPath).not.toContain('/etc/');
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

    // Create two clients for isolation testing
    await prisma.client.createMany({
      data: [
        {
          id: mockClientId1,
          userId: mockUserId,
          name: 'Client 1',
          email: 'client1@example.com',
          address: 'Address 1',
          country: 'India'
        },
        {
          id: mockClientId2,
          userId: mockUserId,
          name: 'Client 2',
          email: 'client2@example.com',
          address: 'Address 2',
          country: 'India'
        }
      ]
    });

    // Create portal access for both clients
    await prisma.clientPortalAccess.createMany({
      data: [
        {
          clientId: mockClientId1,
          userId: mockUserId,
          email: 'client1@example.com',
          isEnabled: true,
          isActive: true,
          canViewInvoices: true,
          canRecordPayments: true,
          canDownloadDocuments: true,
          canViewPaymentHistory: true
        },
        {
          clientId: mockClientId2,
          userId: mockUserId,
          email: 'client2@example.com',
          isEnabled: true,
          isActive: true,
          canViewInvoices: true,
          canRecordPayments: true,
          canDownloadDocuments: true,
          canViewPaymentHistory: true
        }
      ]
    });

    // Create invoices for each client
    await prisma.invoice.createMany({
      data: [
        {
          id: mockInvoiceId1,
          userId: mockUserId,
          clientId: mockClientId1,
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
        },
        {
          id: mockInvoiceId2,
          userId: mockUserId,
          clientId: mockClientId2,
          invoiceNumber: 'FY24-25/002',
          invoiceDate: new Date('2024-06-01'),
          dueDate: new Date('2024-06-30'),
          status: 'SENT',
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
      ]
    });
  }
});