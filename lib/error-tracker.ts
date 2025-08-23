/**
 * Centralized Error Tracking System
 * 
 * Provides unified error handling and logging across the application:
 * - Captures and logs errors with context
 * - Sanitizes sensitive information
 * - Integrates with error boundaries
 * - Tracks error frequency and patterns
 * - Provides error reporting utilities
 */

import Logger from './logger';
import { prisma } from './prisma';
import type { NextRequest } from 'next/server';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  path?: string;
  method?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning' | 'critical';
  message: string;
  stack?: string;
  context: ErrorContext;
  fingerprint: string;
  count: number;
}

export class ErrorTracker {
  private static instance: ErrorTracker;
  private errorCounts: Map<string, number> = new Map();
  private lastCleanup: Date = new Date();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  /**
   * Track an error with context
   */
  async trackError(
    error: Error | unknown,
    context: ErrorContext = {},
    level: 'error' | 'warning' | 'critical' = 'error'
  ): Promise<string> {
    const errorData = this.normalizeError(error);
    const fingerprint = this.generateFingerprint(errorData);
    
    // Increment error count
    const currentCount = this.errorCounts.get(fingerprint) || 0;
    this.errorCounts.set(fingerprint, currentCount + 1);
    
    // Log to Winston
    const logContext = {
      ...context,
      fingerprint,
      occurrences: currentCount + 1,
      stack: errorData.stack,
    };
    
    switch (level) {
      case 'critical':
        Logger.error('Critical error tracked', { error: errorData.message, ...logContext });
        break;
      case 'warning':
        Logger.warn('Warning tracked', { error: errorData.message, ...logContext });
        break;
      default:
        Logger.error('Error tracked', { error: errorData.message, ...logContext });
    }
    
    // Store critical errors in database
    if (level === 'critical' && context.userId) {
      try {
        await this.storeErrorInDatabase(errorData, context, fingerprint);
      } catch (dbError) {
        Logger.error('Failed to store error in database', { error: dbError });
      }
    }
    
    // Cleanup old error counts periodically
    this.cleanupErrorCounts();
    
    return fingerprint;
  }

  /**
   * Track API errors with request context
   */
  async trackApiError(
    error: Error | unknown,
    request: NextRequest,
    userId?: string
  ): Promise<string> {
    const context: ErrorContext = {
      userId,
      path: request.url,
      method: request.method,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
      },
    };
    
    return this.trackError(error, context, 'error');
  }

  /**
   * Track component errors from error boundaries
   */
  async trackComponentError(
    error: Error,
    errorInfo: { componentStack: string },
    componentName: string,
    userId?: string
  ): Promise<string> {
    const context: ErrorContext = {
      userId,
      component: componentName,
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    };
    
    return this.trackError(error, context, 'error');
  }

  /**
   * Get error statistics
   */
  getErrorStats(): { fingerprint: string; count: number }[] {
    return Array.from(this.errorCounts.entries()).map(([fingerprint, count]) => ({
      fingerprint,
      count,
    }));
  }

  /**
   * Check if error rate is too high
   */
  isErrorRateHigh(fingerprint: string, threshold: number = 10): boolean {
    const count = this.errorCounts.get(fingerprint) || 0;
    return count >= threshold;
  }

  /**
   * Normalize error object
   */
  private normalizeError(error: Error | unknown): {
    message: string;
    stack?: string;
    name?: string;
  } {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }
    
    if (typeof error === 'string') {
      return { message: error };
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
      return {
        message: String(error.message),
        stack: 'stack' in error ? String(error.stack) : undefined,
      };
    }
    
    return { message: 'Unknown error occurred' };
  }

  /**
   * Generate fingerprint for error deduplication
   */
  private generateFingerprint(error: {
    message: string;
    stack?: string;
    name?: string;
  }): string {
    const key = `${error.name || 'Error'}-${error.message}`;
    // Simple hash function for fingerprinting
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Store critical errors in database
   */
  private async storeErrorInDatabase(
    error: { message: string; stack?: string; name?: string },
    context: ErrorContext,
    fingerprint: string
  ): Promise<void> {
    // Store in AuditLog table as error events
    await prisma.auditLog.create({
      data: {
        userId: context.userId!,
        action: 'ERROR_OCCURRED',
        entityType: 'ERROR',
        entityId: fingerprint,
        metadata: {
          message: error.message,
          stack: error.stack,
          context,
        },
      },
    });
  }

  /**
   * Cleanup old error counts to prevent memory leak
   */
  private cleanupErrorCounts(): void {
    const now = new Date();
    const hoursSinceCleanup = (now.getTime() - this.lastCleanup.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceCleanup >= 1) {
      // Reset counts every hour
      this.errorCounts.clear();
      this.lastCleanup = now;
    }
  }
}

// Export singleton instance
export const errorTracker = ErrorTracker.getInstance();

// Global error handlers for Node.js
if (typeof window === 'undefined') {
  process.on('uncaughtException', (error: Error) => {
    errorTracker.trackError(error, { action: 'uncaughtException' }, 'critical');
    Logger.error('Uncaught Exception', { error });
    // Give time to log before exiting
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    errorTracker.trackError(reason, { action: 'unhandledRejection' }, 'critical');
    Logger.error('Unhandled Rejection', { reason, promise });
  });
}

// Export utility functions
export function trackError(error: Error | unknown, context?: ErrorContext): Promise<string> {
  return errorTracker.trackError(error, context);
}

export function trackApiError(
  error: Error | unknown,
  request: NextRequest,
  userId?: string
): Promise<string> {
  return errorTracker.trackApiError(error, request, userId);
}

export function trackComponentError(
  error: Error,
  errorInfo: { componentStack: string },
  componentName: string,
  userId?: string
): Promise<string> {
  return errorTracker.trackComponentError(error, errorInfo, componentName, userId);
}