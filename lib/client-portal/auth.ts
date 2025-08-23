/**
 * Client Portal Authentication System
 * 
 * Handles magic link authentication, session management, and security controls
 * for the client portal. Implements secure, stateless authentication using
 * time-limited tokens and IP validation.
 */

import { prisma } from '@/lib/prisma';
import { generateUUID } from '@/lib/utils/uuid';
import crypto from 'crypto';
import Logger from '@/lib/logger';

interface MagicLinkRequest {
  email: string;
  clientId: string;
  ipAddress: string;
  userAgent: string;
}

interface MagicLinkResponse {
  token: string;
  expiresAt: Date;
  magicLink: string;
}

interface TokenValidationRequest {
  token: string;
  ipAddress: string;
  userAgent: string;
}

interface SessionResponse {
  sessionToken: string;
  expiresAt: Date;
  portalAccess: {
    clientId: string;
    email: string;
    permissions: {
      canViewInvoices: boolean;
      canRecordPayments: boolean;
      canDownloadDocuments: boolean;
      canViewPaymentHistory: boolean;
    };
  };
}

interface SessionValidationRequest {
  sessionToken: string;
  ipAddress: string;
  userAgent: string;
}

export class ClientPortalAuth {
  private readonly TOKEN_EXPIRY_MINUTES = 15;
  private readonly SESSION_TIMEOUT_MINUTES = 30;
  private readonly MAX_ATTEMPTS = 3;

  /**
   * Generate a magic link for client authentication
   */
  async generateMagicLink(request: MagicLinkRequest): Promise<MagicLinkResponse> {
    const { email, clientId, ipAddress, userAgent } = request;

    // Find and validate portal access
    const portalAccess = await prisma.clientPortalAccess.findUnique({
      where: { clientId },
      include: { client: true }
    });

    if (!portalAccess) {
      throw new Error('Client portal access not found');
    }

    if (!portalAccess.isEnabled || !portalAccess.isActive) {
      throw new Error('Portal access is disabled');
    }

    if (portalAccess.email !== email) {
      throw new Error('Email does not match portal access');
    }

    // Check IP whitelist if configured
    if (portalAccess.allowedIPs.length > 0) {
      const isAllowed = this.validateIPAddress(ipAddress, portalAccess.allowedIPs);
      if (!isAllowed) {
        throw new Error('IP address not allowed');
      }
    }

    // Invalidate previous tokens for this portal access
    await prisma.clientPortalLoginToken.updateMany({
      where: {
        portalAccessId: portalAccess.id,
        isUsed: false,
        expiresAt: { gt: new Date() }
      },
      data: { isUsed: true }
    });

    // Generate new token
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Store token in database
    await prisma.clientPortalLoginToken.create({
      data: {
        portalAccessId: portalAccess.id,
        token,
        email,
        expiresAt,
        ipAddress,
        userAgent
      }
    });

    // Generate magic link URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/client-portal/auth/verify?token=${token}`;

    return {
      token,
      expiresAt,
      magicLink
    };
  }

  /**
   * Validate magic link token and create session
   */
  async validateMagicLink(request: TokenValidationRequest): Promise<SessionResponse> {
    const { token, ipAddress, userAgent } = request;

    // Find the token
    const loginToken = await prisma.clientPortalLoginToken.findUnique({
      where: { token },
      include: {
        portalAccess: {
          include: { client: true }
        }
      }
    });

    if (!loginToken) {
      throw new Error('Invalid or expired token');
    }

    // Check if token is expired
    if (loginToken.expiresAt < new Date()) {
      throw new Error('Invalid or expired token');
    }

    // Check if token is already used
    if (loginToken.isUsed) {
      throw new Error('Invalid or expired token');
    }

    // Check attempt limits
    if (loginToken.attempts >= this.MAX_ATTEMPTS) {
      throw new Error('Too many failed attempts');
    }

    // Validate IP and User Agent (basic security check)
    const isValidContext = this.validateRequestContext(loginToken, ipAddress, userAgent);
    if (!isValidContext) {
      // Increment attempts on failed validation
      const newAttempts = loginToken.attempts + 1;
      await prisma.clientPortalLoginToken.update({
        where: { id: loginToken.id },
        data: { attempts: newAttempts }
      });

      if (newAttempts >= this.MAX_ATTEMPTS) {
        throw new Error('Too many failed attempts');
      } else {
        throw new Error('IP address not allowed');
      }
    }

    // Mark token as used
    await prisma.clientPortalLoginToken.update({
      where: { id: loginToken.id },
      data: {
        isUsed: true,
        usedAt: new Date()
      }
    });

    // Create new session
    const sessionToken = this.generateSecureToken();
    const sessionTimeout = loginToken.portalAccess.sessionTimeout || this.SESSION_TIMEOUT_MINUTES;
    const sessionExpiresAt = new Date(Date.now() + sessionTimeout * 60 * 1000);

    await prisma.clientPortalSession.create({
      data: {
        portalAccessId: loginToken.portalAccess.id,
        sessionToken,
        expiresAt: sessionExpiresAt,
        ipAddress,
        userAgent,
        isActive: true
      }
    });

    // Update login statistics
    await prisma.clientPortalAccess.update({
      where: { id: loginToken.portalAccess.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 }
      }
    });

    // Log successful login activity
    await this.logActivity({
      portalAccessId: loginToken.portalAccess.id,
      action: 'LOGIN',
      ipAddress,
      userAgent,
      statusCode: 200
    });

    return {
      sessionToken,
      expiresAt: sessionExpiresAt,
      portalAccess: {
        clientId: loginToken.portalAccess.clientId,
        email: loginToken.portalAccess.email,
        permissions: {
          canViewInvoices: loginToken.portalAccess.canViewInvoices,
          canRecordPayments: loginToken.portalAccess.canRecordPayments,
          canDownloadDocuments: loginToken.portalAccess.canDownloadDocuments,
          canViewPaymentHistory: loginToken.portalAccess.canViewPaymentHistory
        }
      }
    };
  }

  /**
   * Validate existing session
   */
  async validateSession(request: SessionValidationRequest): Promise<SessionResponse> {
    const { sessionToken, ipAddress, userAgent } = request;

    const session = await prisma.clientPortalSession.findUnique({
      where: { sessionToken },
      include: {
        portalAccess: {
          include: { client: true }
        }
      }
    });

    if (!session) {
      throw new Error('Invalid or expired session');
    }

    if (!session.isActive || session.expiresAt < new Date()) {
      throw new Error('Invalid or expired session');
    }

    // Update last activity
    await prisma.clientPortalSession.update({
      where: { id: session.id },
      data: { lastActivity: new Date() }
    });

    return {
      sessionToken,
      expiresAt: session.expiresAt,
      portalAccess: {
        clientId: session.portalAccess.clientId,
        email: session.portalAccess.email,
        permissions: {
          canViewInvoices: session.portalAccess.canViewInvoices,
          canRecordPayments: session.portalAccess.canRecordPayments,
          canDownloadDocuments: session.portalAccess.canDownloadDocuments,
          canViewPaymentHistory: session.portalAccess.canViewPaymentHistory
        }
      }
    };
  }

  /**
   * Logout and invalidate session
   */
  async logout(sessionToken: string): Promise<void> {
    const session = await prisma.clientPortalSession.findUnique({
      where: { sessionToken }
    });

    if (session) {
      await prisma.clientPortalSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });

      // Log logout activity
      await this.logActivity({
        portalAccessId: session.portalAccessId,
        action: 'LOGOUT',
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        statusCode: 200
      });
    }
  }

  /**
   * Generate cryptographically secure token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate IP address against whitelist
   */
  private validateIPAddress(ipAddress: string, allowedIPs: string[]): boolean {
    if (allowedIPs.length === 0) {
      return true; // No restrictions
    }

    return allowedIPs.some(allowedIP => {
      // Support CIDR notation in the future
      // For now, exact match
      return allowedIP === ipAddress;
    });
  }

  /**
   * Validate request context (IP and User Agent)
   */
  private validateRequestContext(
    loginToken: any,
    ipAddress: string,
    userAgent: string
  ): boolean {
    // Check IP whitelist if configured
    if (loginToken.portalAccess.allowedIPs.length > 0) {
      const isAllowed = this.validateIPAddress(ipAddress, loginToken.portalAccess.allowedIPs);
      if (!isAllowed) {
        Logger.warn(`IP address not in whitelist: ${ipAddress}`);
        return false;
      }
    }

    // For magic links, we allow some flexibility in IP and User Agent
    // but log discrepancies for security monitoring
    
    // If IP changes drastically, it might be suspicious
    // For now, we'll log but not block unless it's a whitelist violation
    if (loginToken.ipAddress !== ipAddress) {
      Logger.warn(`IP address changed during token validation: ${loginToken.ipAddress} -> ${ipAddress}`);
    }

    if (loginToken.userAgent !== userAgent) {
      Logger.warn(`User agent changed during token validation: ${loginToken.userAgent} -> ${userAgent}`);
    }

    return true;
  }

  /**
   * Log activity for audit trail
   */
  private async logActivity(data: {
    portalAccessId: string;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    statusCode?: number;
    errorMessage?: string;
    metadata?: any;
  }): Promise<void> {
    await prisma.clientPortalActivity.create({
      data: {
        portalAccessId: data.portalAccessId,
        action: data.action,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        statusCode: data.statusCode,
        errorMessage: data.errorMessage,
        metadata: data.metadata,
        timestamp: new Date()
      }
    });
  }
}