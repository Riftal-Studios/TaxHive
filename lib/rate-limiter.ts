import { NextRequest, NextResponse } from 'next/server'

// In-memory store for rate limiting
// Note: This will reset on server restart. For production, use Redis or similar.
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

interface RateLimitOptions {
  maxRequests: number
  windowMs: number // in milliseconds
}

export function rateLimit(options: RateLimitOptions) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Skip rate limiting in development
    if (process.env.NODE_ENV === 'development') {
      return null
    }

    // Get IP address from headers, common for proxies/load balancers
    const ip = request.headers.get('x-forwarded-for') ?? 
               request.headers.get('x-real-ip') ?? 
               request.headers.get('cf-connecting-ip') ?? // Cloudflare
               'unknown'
    const key = `rate_limit:${ip}`
    const now = Date.now()

    let record = rateLimitStore.get(key)

    // Reset if window has passed
    if (!record || record.resetTime < now) {
      record = {
        count: 1,
        resetTime: now + options.windowMs,
      }
      rateLimitStore.set(key, record)
      return null // Allow request
    }

    if (record.count >= options.maxRequests) {
      return NextResponse.json(
        { error: 'Too many requests, please try again later.' },
        { status: 429 }
      )
    }

    record.count++
    rateLimitStore.set(key, record)
    return null // Allow request
  }
}

// Specific rate limiter for authentication routes
export const authRateLimit = rateLimit({
  maxRequests: 5, // Allow 5 requests
  windowMs: 60 * 1000, // per minute
})
