/**
 * Client Portal Authentication Tests
 * Following TDD methodology: RED phase - Write failing tests first
 * 
 * Tests for:
 * 1. Magic link generation
 * 2. Magic link validation
 * 3. Session management
 * 4. Security controls
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ClientPortalAuth } from '@/lib/client-portal/auth';
import { generateUUID } from '@/lib/utils/uuid';

describe('ClientPortalAuth - Magic Link Authentication', () => {
  const mockEmail = 'client@example.com';
  const mockClientId = generateUUID();
  const mockUserId = generateUUID();

  beforeEach(async () => {
    // Clean up test data
    await prisma.clientPortalLoginToken.deleteMany({});
    await prisma.clientPortalSession.deleteMany({});
    await prisma.clientPortalAccess.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('Magic Link Generation', () => {
    it('should generate magic link for valid client', async () => {
      await setupEnabledPortalAccess();
      const auth = new ClientPortalAuth();
      
      const result = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('magicLink');
      expect(result.token).toMatch(/^[a-zA-Z0-9]{64}$/); // 32 bytes = 64 hex chars
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.magicLink).toContain(result.token);
    });

    it('should fail for non-existent client', async () => {
      const auth = new ClientPortalAuth();
      
      await expect(auth.generateMagicLink({
        email: mockEmail,
        clientId: 'invalid-client-id',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Client portal access not found');
    });

    it('should fail for disabled portal access', async () => {
      // Setup: Create client with disabled portal access
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
          email: mockEmail,
          address: 'Test Address',
          country: 'India'
        }
      });

      await prisma.clientPortalAccess.create({
        data: {
          clientId: mockClientId,
          userId: mockUserId,
          email: mockEmail,
          isEnabled: false,
          isActive: false
        }
      });

      const auth = new ClientPortalAuth();
      
      await expect(auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Portal access is disabled');
    });

    it('should invalidate previous tokens when generating new one', async () => {
      // Setup enabled client portal
      await setupEnabledPortalAccess();
      
      const auth = new ClientPortalAuth();
      
      // Generate first token
      const firstResult = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      // Generate second token
      const secondResult = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      // Verify first token is invalidated
      const firstToken = await prisma.clientPortalLoginToken.findUnique({
        where: { token: firstResult.token }
      });
      
      expect(firstToken?.isUsed).toBe(true);
      expect(secondResult.token).not.toBe(firstResult.token);
    });
  });

  describe('Magic Link Validation', () => {
    it('should validate correct magic link token', async () => {
      await setupEnabledPortalAccess();
      const auth = new ClientPortalAuth();
      
      const { token } = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const result = await auth.validateMagicLink({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      expect(result).toHaveProperty('sessionToken');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('portalAccess');
      expect(result.portalAccess.clientId).toBe(mockClientId);
    });

    it('should fail for invalid token', async () => {
      const auth = new ClientPortalAuth();
      
      await expect(auth.validateMagicLink({
        token: 'invalid-token',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Invalid or expired token');
    });

    it('should fail for expired token', async () => {
      await setupEnabledPortalAccess();
      const auth = new ClientPortalAuth();
      
      // Create expired token directly in database
      const expiredToken = await prisma.clientPortalLoginToken.create({
        data: {
          portalAccessId: (await prisma.clientPortalAccess.findFirst())!.id,
          token: 'expired-token',
          email: mockEmail,
          expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser'
        }
      });

      await expect(auth.validateMagicLink({
        token: expiredToken.token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Invalid or expired token');
    });

    it('should fail for already used token', async () => {
      await setupEnabledPortalAccess();
      const auth = new ClientPortalAuth();
      
      const { token } = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      // Use token once
      await auth.validateMagicLink({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      // Try to use token again
      await expect(auth.validateMagicLink({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Invalid or expired token');
    });

    it('should enforce attempt limits', async () => {
      // Setup with IP whitelist to force failures
      await setupEnabledPortalAccess(['192.168.1.1'], 30);
      const auth = new ClientPortalAuth();
      
      const { token } = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      // Make multiple failed attempts with wrong IP (outside whitelist)
      for (let i = 0; i < 3; i++) {
        try {
          await auth.validateMagicLink({
            token,
            ipAddress: '192.168.1.999', // Wrong IP (not in whitelist)
            userAgent: 'Mozilla/5.0 Test Browser'
          });
        } catch (error) {
          // Expected to fail due to IP not in whitelist
        }
      }

      // Should now be locked out even with correct details
      await expect(auth.validateMagicLink({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Too many failed attempts');
    });
  });

  describe('Session Management', () => {
    it('should create valid session after successful login', async () => {
      await setupEnabledPortalAccess();
      const auth = new ClientPortalAuth();
      
      const { token } = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const result = await auth.validateMagicLink({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const session = await prisma.clientPortalSession.findUnique({
        where: { sessionToken: result.sessionToken }
      });

      expect(session).toBeTruthy();
      expect(session?.isActive).toBe(true);
      expect(session?.expiresAt).toBeInstanceOf(Date);
      expect(session?.ipAddress).toBe('192.168.1.1');
    });

    it('should validate existing session', async () => {
      await setupEnabledPortalAccess();
      const auth = new ClientPortalAuth();
      
      // Create session
      const { token } = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const { sessionToken } = await auth.validateMagicLink({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      // Validate session
      const sessionData = await auth.validateSession({
        sessionToken,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      expect(sessionData).toHaveProperty('portalAccess');
      expect(sessionData.portalAccess.clientId).toBe(mockClientId);
    });

    it('should fail validation for expired session', async () => {
      const auth = new ClientPortalAuth();
      
      await expect(auth.validateSession({
        sessionToken: 'invalid-session-token',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('Invalid or expired session');
    });

    it('should logout and invalidate session', async () => {
      await setupEnabledPortalAccess();
      const auth = new ClientPortalAuth();
      
      // Create session
      const { token } = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const { sessionToken } = await auth.validateMagicLink({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      // Logout
      await auth.logout(sessionToken);

      // Verify session is inactive
      const session = await prisma.clientPortalSession.findUnique({
        where: { sessionToken }
      });

      expect(session?.isActive).toBe(false);
    });
  });

  describe('Security Controls', () => {
    it('should enforce IP whitelist when configured', async () => {
      await setupEnabledPortalAccess(['192.168.1.1', '10.0.0.1']);
      const auth = new ClientPortalAuth();
      
      // Should work from allowed IP
      const { token } = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      await expect(auth.validateMagicLink({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      })).resolves.toBeTruthy();

      // Should fail from disallowed IP
      const { token: token2 } = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      await expect(auth.validateMagicLink({
        token: token2,
        ipAddress: '192.168.2.1', // Not in whitelist
        userAgent: 'Mozilla/5.0 Test Browser'
      })).rejects.toThrow('IP address not allowed');
    });

    it('should respect session timeout settings', async () => {
      await setupEnabledPortalAccess([], 1); // 1 minute timeout
      const auth = new ClientPortalAuth();
      
      const { token } = await auth.generateMagicLink({
        email: mockEmail,
        clientId: mockClientId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const { sessionToken } = await auth.validateMagicLink({
        token,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const session = await prisma.clientPortalSession.findUnique({
        where: { sessionToken }
      });

      const expectedExpiry = new Date(Date.now() + 1 * 60 * 1000); // 1 minute from now
      const timeDiff = Math.abs(session!.expiresAt.getTime() - expectedExpiry.getTime());
      
      expect(timeDiff).toBeLessThan(1000); // Within 1 second tolerance
    });
  });

  // Helper function to setup enabled portal access
  async function setupEnabledPortalAccess(allowedIPs: string[] = [], sessionTimeout: number = 30) {
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
        email: mockEmail,
        address: 'Test Address',
        country: 'India'
      }
    });

    await prisma.clientPortalAccess.create({
      data: {
        clientId: mockClientId,
        userId: mockUserId,
        email: mockEmail,
        isEnabled: true,
        isActive: true,
        sessionTimeout,
        allowedIPs
      }
    });
  }
});