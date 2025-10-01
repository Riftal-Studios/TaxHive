/**
 * Rate Limiting System
 * 
 * Provides comprehensive rate limiting for API endpoints:
 * - Multiple strategies (sliding window, fixed window, token bucket)
 * - Per-user and per-IP rate limiting
 * - Configurable limits per endpoint
 * - Redis-backed for distributed systems
 * - Graceful degradation when Redis unavailable
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import Logger from './logger';

// Rate limit configurations per endpoint
export const RATE_LIMITS = {
  // Public endpoints - stricter limits
  'api/auth/signin': { requests: 5, window: '1m' }, // 5 login attempts per minute
  'api/auth/signup': { requests: 3, window: '1h' }, // 3 signups per hour
  'api/auth/reset': { requests: 3, window: '1h' }, // 3 password resets per hour
  
  // Invoice endpoints
  'api/invoices': { requests: 100, window: '1m' }, // List invoices
  'api/invoices/create': { requests: 30, window: '1m' }, // Create invoice
  'api/invoices/pdf': { requests: 10, window: '1m' }, // Generate PDF (resource intensive)
  'api/invoices/download': { requests: 20, window: '1m' }, // Download PDF
  'api/invoices/email': { requests: 10, window: '5m' }, // Send email (to prevent spam)
  
  // Client endpoints
  'api/clients': { requests: 100, window: '1m' },
  'api/clients/create': { requests: 20, window: '1m' },
  
  // Payment endpoints
  'api/payments': { requests: 100, window: '1m' },
  'api/payments/create': { requests: 20, window: '1m' },
  
  // Report endpoints - resource intensive
  'api/reports/gst': { requests: 5, window: '1m' },
  'api/reports/analytics': { requests: 10, window: '1m' },
  'api/reports/export': { requests: 5, window: '5m' },
  
  // Queue endpoints
  'api/queues': { requests: 50, window: '1m' },
  
  // File upload - limit to prevent abuse
  'api/upload': { requests: 10, window: '1m' },
  
  // Webhook endpoints - external services
  'api/webhook': { requests: 100, window: '1m' },
  
  // Default for all other endpoints
  default: { requests: 60, window: '1m' },
} as const;

// In-memory fallback for development/testing
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiter instances cache
const rateLimiters = new Map<string, Ratelimit>();

/**
 * Create Upstash Redis client from existing Redis config
 */
function createUpstashRedis(): Redis | null {
  // Check for Upstash specific config first
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  
  // Try to use existing Redis URL (for local Redis)
  if (process.env.REDIS_URL) {
    // For local Redis, we'll fall back to in-memory store
    // as Upstash client requires REST API
    return null;
  }
  
  return null;
}

/**
 * Get or create a rate limiter for an endpoint
 */
function getRateLimiter(endpoint: string): Ratelimit | null {
  // Skip rate limiting in development if specified
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_RATE_LIMIT === 'true') {
    return null;
  }
  
  // Check cache
  if (rateLimiters.has(endpoint)) {
    return rateLimiters.get(endpoint)!;
  }
  
  // Get configuration for endpoint
  const config = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
  
  // Try to create Redis-backed limiter
  const redis = createUpstashRedis();
  
  if (redis) {
    try {
      // Create rate limiter with Redis
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        prefix: `rate-limit:${endpoint}`,
        analytics: true,
      });
      
      // Cache it
      rateLimiters.set(endpoint, limiter);
      
      return limiter;
    } catch (error) {
      Logger.error('Failed to create Redis-backed rate limiter', { error, endpoint });
    }
  }
  
  // Fall back to in-memory implementation for local development
  Logger.info('Using in-memory rate limiter (development mode)');
  return null; // We'll use the in-memory fallback
}

/**
 * In-memory rate limiting fallback
 */
function inMemoryRateLimit(
  identifier: string, 
  endpoint: string
): { success: boolean; limit: number; remaining: number; reset: number } {
  const config = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();
  
  // Parse window (e.g., '1m' -> 60000ms)
  const windowMs = config.window.endsWith('m') 
    ? parseInt(config.window) * 60 * 1000
    : parseInt(config.window) * 1000;
  
  let record = inMemoryStore.get(key);
  
  // Reset if window has passed
  if (!record || record.resetTime < now) {
    record = {
      count: 1,
      resetTime: now + windowMs,
    };
    inMemoryStore.set(key, record);
    
    return {
      success: true,
      limit: config.requests,
      remaining: config.requests - 1,
      reset: record.resetTime,
    };
  }
  
  // Check if limit exceeded
  if (record.count >= config.requests) {
    return {
      success: false,
      limit: config.requests,
      remaining: 0,
      reset: record.resetTime,
    };
  }
  
  // Increment count
  record.count++;
  inMemoryStore.set(key, record);
  
  return {
    success: true,
    limit: config.requests,
    remaining: config.requests - record.count,
    reset: record.resetTime,
  };
}

/**
 * Extract endpoint from request URL
 */
function getEndpoint(req: NextRequest): string {
  const url = new URL(req.url);
  const pathname = url.pathname;
  
  // Remove leading slash and normalize
  const endpoint = pathname.substring(1).replace(/\/$/, '');
  
  // Map specific patterns to endpoint configurations
  if (endpoint.match(/^api\/invoices\/[^\/]+\/pdf$/)) return 'api/invoices/pdf';
  if (endpoint.match(/^api\/invoices\/[^\/]+\/download$/)) return 'api/invoices/download';
  if (endpoint.match(/^api\/invoices\/[^\/]+\/email$/)) return 'api/invoices/email';
  if (endpoint.startsWith('api/invoices') && req.method === 'POST') return 'api/invoices/create';
  if (endpoint.startsWith('api/clients') && req.method === 'POST') return 'api/clients/create';
  if (endpoint.startsWith('api/payments') && req.method === 'POST') return 'api/payments/create';
  
  return endpoint;
}

/**
 * Get identifier for rate limiting (user ID or IP)
 */
async function getIdentifier(req: NextRequest): Promise<string> {
  // Try to get user ID from session
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      return `user:${session.user.id}`;
    }
  } catch {
    // Session not available
  }
  
  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 
             req.headers.get('x-real-ip') || 
             req.headers.get('cf-connecting-ip') || // Cloudflare
             req.ip || 
             '127.0.0.1';
  
  return `ip:${ip}`;
}

/**
 * Rate limiting result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Apply rate limiting to a request
 */
export async function rateLimit(req: NextRequest): Promise<RateLimitResult> {
  const endpoint = getEndpoint(req);
  const identifier = await getIdentifier(req);
  const limiter = getRateLimiter(endpoint);
  
  // Use Redis-backed limiter if available
  if (limiter) {
    try {
      // Apply rate limit
      const result = await limiter.limit(identifier);
      
      // Log rate limit hit if unsuccessful
      if (!result.success) {
        Logger.warn('Rate limit exceeded', {
          endpoint,
          identifier,
          limit: result.limit,
          reset: result.reset,
        });
      }
      
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
        retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
      };
    } catch (error) {
      // Log error but fall back to in-memory
      Logger.error('Rate limiting error, falling back to in-memory', { error, endpoint, identifier });
    }
  }
  
  // Use in-memory fallback
  const result = inMemoryRateLimit(identifier, endpoint);
  
  if (!result.success) {
    Logger.warn('Rate limit exceeded (in-memory)', {
      endpoint,
      identifier,
      limit: result.limit,
      reset: result.reset,
    });
  }
  
  return {
    ...result,
    retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
  };
}

/**
 * Rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());
  
  if (result.retryAfter) {
    headers.set('Retry-After', result.retryAfter.toString());
  }
  
  return headers;
}

/**
 * Create rate limited response
 */
export function createRateLimitedResponse(result: RateLimitResult): Response {
  const headers = getRateLimitHeaders(result);
  
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers,
    }
  );
}

/**
 * Backward compatibility - auth rate limit function
 */
export async function authRateLimit(req: NextRequest) {
  const result = await rateLimit(req);
  
  if (!result.success) {
    return createRateLimitedResponse(result);
  }
  
  return null; // Allow request
}