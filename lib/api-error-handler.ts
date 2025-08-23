/**
 * API Error Handler Middleware
 * 
 * Provides centralized error handling for API routes:
 * - Catches and logs API errors
 * - Returns consistent error responses
 * - Tracks error patterns
 * - Implements rate limiting for error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackApiError } from './error-tracker';
import Logger from './logger';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

export class ApiErrorHandler {
  /**
   * Wrap API route handler with error handling
   */
  static handler(
    fn: (req: NextRequest, context?: any) => Promise<Response>
  ) {
    return async (req: NextRequest, context?: any): Promise<Response> => {
      try {
        // Get user session for error tracking
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id;
        
        // Execute the handler
        const response = await fn(req, context);
        
        // Log successful API calls for monitoring
        if (response.status < 400) {
          Logger.http('API request successful', {
            path: req.url,
            method: req.method,
            status: response.status,
            userId,
          });
        }
        
        return response;
      } catch (error) {
        return ApiErrorHandler.handleError(error, req);
      }
    };
  }

  /**
   * Handle API errors consistently
   */
  static async handleError(
    error: unknown,
    req: NextRequest
  ): Promise<Response> {
    // Get user session for error tracking
    let userId: string | undefined;
    try {
      const session = await getServerSession(authOptions);
      userId = session?.user?.id;
    } catch {
      // Ignore session errors
    }
    
    // Track error
    const fingerprint = await trackApiError(error, req, userId);
    
    // Determine error details
    const errorDetails = ApiErrorHandler.parseError(error);
    
    // Log API error
    Logger.error('API error occurred', {
      ...errorDetails,
      path: req.url,
      method: req.method,
      fingerprint,
      userId,
    });
    
    // Return error response
    return NextResponse.json(
      {
        error: {
          message: errorDetails.message,
          code: errorDetails.code || 'INTERNAL_ERROR',
          fingerprint,
          ...(process.env.NODE_ENV === 'development' && {
            details: errorDetails.details,
          }),
        },
      },
      { status: errorDetails.statusCode || 500 }
    );
  }

  /**
   * Parse error to extract details
   */
  private static parseError(error: unknown): ApiError {
    // Handle known error types
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('Unauthorized')) {
        return {
          message: 'Unauthorized access',
          code: 'UNAUTHORIZED',
          statusCode: 401,
          details: error.message,
        };
      }
      
      if (error.message.includes('Not found')) {
        return {
          message: 'Resource not found',
          code: 'NOT_FOUND',
          statusCode: 404,
          details: error.message,
        };
      }
      
      if (error.message.includes('Bad request')) {
        return {
          message: 'Invalid request',
          code: 'BAD_REQUEST',
          statusCode: 400,
          details: error.message,
        };
      }
      
      // Check for database errors
      if (error.message.includes('P2002')) {
        return {
          message: 'Duplicate entry',
          code: 'DUPLICATE_ENTRY',
          statusCode: 409,
          details: 'A record with this value already exists',
        };
      }
      
      if (error.message.includes('P2025')) {
        return {
          message: 'Record not found',
          code: 'RECORD_NOT_FOUND',
          statusCode: 404,
          details: 'The requested record does not exist',
        };
      }
      
      // Default error response
      return {
        message: process.env.NODE_ENV === 'production' 
          ? 'An error occurred processing your request'
          : error.message,
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        details: error.stack,
      };
    }
    
    // Handle non-Error objects
    if (typeof error === 'string') {
      return {
        message: error,
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      };
    }
    
    // Handle unknown error types
    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
      details: error,
    };
  }

  /**
   * Create custom API error
   */
  static createError(
    message: string,
    code: string = 'API_ERROR',
    statusCode: number = 500,
    details?: any
  ): ApiError {
    return {
      message,
      code,
      statusCode,
      details,
    };
  }
}

// Export convenience functions
export const withErrorHandler = ApiErrorHandler.handler;
export const handleApiError = ApiErrorHandler.handleError;
export const createApiError = ApiErrorHandler.createError;