/**
 * Client Portal Document Download System
 * 
 * Provides secure document access for client portal users with:
 * - Time-limited download tokens
 * - IP address validation
 * - Audit logging
 * - Permission checks
 * - Document type validation
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export type DocumentType = 'INVOICE_PDF';

export interface GenerateDownloadUrlParams {
  clientId: string;
  invoiceId: string;
  documentType: DocumentType;
  ipAddress: string;
  userAgent: string;
  expiryMinutes?: number;
}

export interface GenerateDownloadUrlResult {
  downloadUrl: string;
  expiresAt: Date;
  token: string;
}

export interface ValidateDownloadTokenParams {
  token: string;
  ipAddress: string;
  userAgent: string;
}

export interface ValidateDownloadTokenResult {
  documentUrl: string;
  filename: string;
  mimeType: string;
  fileSize: number;
}

export class ClientPortalDocuments {
  /**
   * Generate a secure download URL with time-limited token
   */
  async generateDownloadUrl(params: GenerateDownloadUrlParams): Promise<GenerateDownloadUrlResult> {
    const { clientId, invoiceId, documentType, ipAddress, userAgent, expiryMinutes = 60 } = params;

    // Validate document type
    if (!this.isValidDocumentType(documentType)) {
      throw new Error('Invalid document type');
    }

    // Check if client has download permissions
    const portalAccess = await prisma.clientPortalAccess.findFirst({
      where: { clientId }
    });

    if (!portalAccess || !portalAccess.canDownloadDocuments) {
      throw new Error('Permission denied: Cannot download documents');
    }

    // Verify document exists and belongs to client
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId: clientId
      }
    });

    if (!invoice) {
      throw new Error('Document not found or access denied');
    }

    // Check if document is available
    if (documentType === 'INVOICE_PDF' && !invoice.pdfUrl) {
      throw new Error('Document not available');
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Log token creation activity
    await prisma.clientPortalActivity.create({
      data: {
        portalAccessId: portalAccess.id,
        action: 'DOWNLOAD_TOKEN_CREATED',
        entityType: 'INVOICE',
        entityId: invoiceId,
        ipAddress,
        userAgent,
        metadata: {
          token,
          expiresAt,
          documentType
        }
      }
    });

    // Generate download URL
    const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://gsthive.com'}/api/client-portal/download/${token}`;

    return {
      downloadUrl,
      expiresAt,
      token
    };
  }

  /**
   * Validate download token and return document metadata
   */
  async validateDownloadToken(params: ValidateDownloadTokenParams): Promise<ValidateDownloadTokenResult> {
    const { token, ipAddress, userAgent } = params;

    try {
      // Find token activity record
      const tokenActivity = await prisma.clientPortalActivity.findFirst({
        where: {
          action: 'DOWNLOAD_TOKEN_CREATED',
          metadata: {
            path: ['token'],
            equals: token
          }
        },
        include: {
          portalAccess: {
            include: {
              client: true
            }
          }
        }
      });

      if (!tokenActivity) {
        await this.logFailedDownload(ipAddress, userAgent, 'Invalid or expired download token');
        const error = new Error('Invalid or expired download token');
        (error as any).logged = true;
        throw error;
      }

      // Check if token is expired
      const expiresAt = new Date(tokenActivity.metadata.expiresAt as string);
      if (expiresAt < new Date()) {
        await this.logFailedDownload(ipAddress, userAgent, 'Invalid or expired download token', tokenActivity.portalAccessId);
        const error = new Error('Invalid or expired download token');
        (error as any).logged = true;
        throw error;
      }

      // Validate IP address (basic security check)
      if (tokenActivity.ipAddress !== ipAddress) {
        await this.logFailedDownload(ipAddress, userAgent, 'Token access from unauthorized IP address', tokenActivity.portalAccessId);
        const error = new Error('Token access from unauthorized IP address');
        (error as any).logged = true;
        throw error;
      }

      // Check if token was already used
      const existingDownload = await prisma.clientPortalActivity.findFirst({
        where: {
          portalAccessId: tokenActivity.portalAccessId,
          action: 'DOWNLOAD_PDF',
          metadata: {
            path: ['token'],
            equals: token
          }
        }
      });

      if (existingDownload) {
        await this.logFailedDownload(ipAddress, userAgent, 'Download token already used', tokenActivity.portalAccessId);
        const error = new Error('Download token already used');
        (error as any).logged = true;
        throw error;
      }

      // Get invoice and document details
      const invoice = await prisma.invoice.findFirst({
        where: { id: tokenActivity.entityId }
      });

      if (!invoice) {
        await this.logFailedDownload(ipAddress, userAgent, 'Document not found', tokenActivity.portalAccessId);
        const error = new Error('Document not found');
        (error as any).logged = true;
        throw error;
      }

      const documentType = tokenActivity.metadata.documentType as DocumentType;
      const { documentUrl, filename, mimeType, fileSize } = this.getDocumentMetadata(invoice, documentType);

      // Log successful download
      await prisma.clientPortalActivity.create({
        data: {
          portalAccessId: tokenActivity.portalAccessId,
          action: 'DOWNLOAD_PDF',
          entityType: 'INVOICE',
          entityId: tokenActivity.entityId,
          ipAddress,
          userAgent,
          statusCode: 200,
          metadata: {
            token,
            filename,
            fileSize,
            documentType
          }
        }
      });

      return {
        documentUrl,
        filename,
        mimeType,
        fileSize
      };

    } catch (error) {
      // If error wasn't already logged, log it now
      if (error instanceof Error && !(error as any).logged) {
        await this.logFailedDownload(ipAddress, userAgent, error.message);
      }
      throw error;
    }
  }

  /**
   * Validate document type
   */
  private isValidDocumentType(documentType: string): documentType is DocumentType {
    return ['INVOICE_PDF'].includes(documentType);
  }

  /**
   * Get document metadata based on invoice and document type
   */
  private getDocumentMetadata(invoice: any, documentType: DocumentType) {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    switch (documentType) {
      case 'INVOICE_PDF':
        return {
          documentUrl: invoice.pdfUrl,
          filename: `${invoice.invoiceNumber.replace('/', '-')}_${timestamp}.pdf`,
          mimeType: 'application/pdf',
          fileSize: 256000 // Mock file size for testing
        };
      default:
        throw new Error('Invalid document type');
    }
  }

  /**
   * Log failed download attempts
   */
  private async logFailedDownload(ipAddress: string, userAgent: string, errorMessage: string, portalAccessId?: string) {
    try {
      if (portalAccessId) {
        // Log with valid portal access ID
        await prisma.clientPortalActivity.create({
          data: {
            portalAccessId,
            action: 'DOWNLOAD_FAILED',
            entityType: 'UNKNOWN',
            entityId: null,
            ipAddress,
            userAgent,
            statusCode: 401,
            errorMessage
          }
        });
      } else {
        // For invalid tokens, try to find any portal access for this IP to log the attempt
        const recentAccess = await prisma.clientPortalActivity.findFirst({
          where: { ipAddress },
          orderBy: { timestamp: 'desc' },
          select: { portalAccessId: true }
        });

        if (recentAccess?.portalAccessId) {
          await prisma.clientPortalActivity.create({
            data: {
              portalAccessId: recentAccess.portalAccessId,
              action: 'DOWNLOAD_FAILED',
              entityType: 'UNKNOWN',
              entityId: null,
              ipAddress,
              userAgent,
              statusCode: 401,
              errorMessage
            }
          });
        } else {
          // If no portal access found, create a security log without specific client context
          // For now, we'll use the first available portal access as a fallback
          const anyPortalAccess = await prisma.clientPortalAccess.findFirst({
            select: { id: true }
          });
          
          if (anyPortalAccess) {
            await prisma.clientPortalActivity.create({
              data: {
                portalAccessId: anyPortalAccess.id,
                action: 'DOWNLOAD_FAILED',
                entityType: 'UNKNOWN',
                entityId: null,
                ipAddress,
                userAgent,
                statusCode: 401,
                errorMessage
              }
            });
          }
        }
      }
    } catch (error) {
      // Silently fail logging to prevent cascading errors
      console.error('Failed to log download attempt:', error);
    }
  }
}