/**
 * tRPC Error Handler
 * 
 * Centralized error handling for tRPC procedures:
 * - Catches and logs tRPC errors
 * - Provides consistent error formatting
 * - Integrates with error tracking system
 */

import { TRPCError } from '@trpc/server';
import { TRPC_ERROR_CODE_KEY } from '@trpc/server/unstable-core-do-not-import';
import Logger from '@/lib/logger';
import { errorTracker } from '@/lib/error-tracker';
import type { Context } from './trpc';

export interface TRPCErrorOptions {
  code?: typeof TRPC_ERROR_CODE_KEY;
  cause?: unknown;
  data?: unknown;
}

export class TRPCErrorHandler {
  /**
   * Handle tRPC errors with logging and tracking
   */
  static async handleError(
    error: unknown,
    ctx: Context,
    path: string
  ): Promise<TRPCError> {
    // Get user ID from context
    const userId = ctx.session?.user?.id;
    
    // Track error
    const fingerprint = await errorTracker.trackError(
      error,
      {
        userId,
        path,
        action: 'trpc_procedure',
        metadata: {
          procedure: path,
        },
      },
      error instanceof TRPCError && error.code === 'INTERNAL_SERVER_ERROR' 
        ? 'critical' 
        : 'error'
    );
    
    // Log error
    Logger.error('tRPC error occurred', {
      error: error instanceof Error ? error.message : error,
      path,
      userId,
      fingerprint,
    });
    
    // Convert to TRPCError if needed
    if (error instanceof TRPCError) {
      return error;
    }
    
    // Handle Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('P2002')) {
        return new TRPCError({
          code: 'CONFLICT',
          message: 'A record with this value already exists',
        });
      }
      
      if (error.message.includes('P2025')) {
        return new TRPCError({
          code: 'NOT_FOUND',
          message: 'Record not found',
        });
      }
      
      if (error.message.includes('P2003')) {
        return new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Foreign key constraint failed',
        });
      }
      
      // Check for common patterns
      if (error.message.toLowerCase().includes('unauthorized')) {
        return new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to perform this action',
        });
      }
      
      if (error.message.toLowerCase().includes('not found')) {
        return new TRPCError({
          code: 'NOT_FOUND',
          message: error.message,
        });
      }
      
      if (error.message.toLowerCase().includes('invalid')) {
        return new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }
    
    // Default to internal server error
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error instanceof Error ? error.message : 'Unknown error',
    });
  }

  /**
   * Create a wrapped procedure with error handling
   */
  static withErrorHandler<T extends (...args: any[]) => any>(
    fn: T,
    procedurePath: string
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        // Extract context from arguments
        const ctx = args[0]?.ctx as Context;
        throw await TRPCErrorHandler.handleError(error, ctx, procedurePath);
      }
    }) as T;
  }

  /**
   * Log successful tRPC calls for monitoring
   */
  static logSuccess(
    path: string,
    ctx: Context,
    duration?: number
  ): void {
    Logger.http('tRPC procedure successful', {
      path,
      userId: ctx.session?.user?.id,
      duration,
    });
  }

  /**
   * Create custom tRPC error with tracking
   */
  static createError(
    message: string,
    code: typeof TRPC_ERROR_CODE_KEY = 'INTERNAL_SERVER_ERROR',
    cause?: unknown
  ): TRPCError {
    const error = new TRPCError({
      code,
      message,
      cause,
    });
    
    // Track the error creation
    errorTracker.trackError(error, {
      action: 'trpc_error_created',
      metadata: { code, message },
    });
    
    return error;
  }
}

// Export convenience functions
export const handleTRPCError = TRPCErrorHandler.handleError;
export const withTRPCErrorHandler = TRPCErrorHandler.withErrorHandler;
export const logTRPCSuccess = TRPCErrorHandler.logSuccess;
export const createTRPCError = TRPCErrorHandler.createError;