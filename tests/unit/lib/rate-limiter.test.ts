import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limiter'
import { NextRequest } from 'next/server'

// Mock Upstash Redis
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    eval: vi.fn(),
  })),
}))

// Mock @upstash/ratelimit
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn(),
  })),
}))

describe('Rate Limiter', () => {
  let mockRequest: NextRequest
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    vi.clearAllMocks()
    originalEnv = process.env
    process.env = { ...originalEnv }
    
    // Create mock request with proper URL object
    const url = new URL('http://localhost:3000/api/invoices/pdf')
    mockRequest = {
      headers: new Headers({
        'x-forwarded-for': '192.168.1.100',
        'user-agent': 'Mozilla/5.0',
      }),
      url: url.toString(),
      nextUrl: {
        pathname: '/api/invoices/pdf',
        origin: 'http://localhost:3000',
      },
      ip: '192.168.1.100',
    } as unknown as NextRequest
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Configuration', () => {
    it('should have correct rate limit configurations', () => {
      expect(RATE_LIMITS['api/auth/signin']).toEqual({
        requests: 5,
        window: '1m',
      })
      
      expect(RATE_LIMITS['api/invoices/pdf']).toEqual({
        requests: 10,
        window: '1m',
      })
      
      expect(RATE_LIMITS.default).toEqual({
        requests: 60,
        window: '1m',
      })
    })
  })

  describe('With Upstash Redis', () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.com'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    })

    it('should allow request when under rate limit', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = vi.fn().mockResolvedValue({
        success: true,
        remaining: 9,
        reset: Date.now() + 60000,
        limit: 10,
      })
      
      ;(Ratelimit as any).mockImplementation(() => ({
        limit: mockLimit,
      }))
      
      const result = await rateLimit(mockRequest)
      
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(9)
      expect(result.limit).toBe(10)
      expect(mockLimit).toHaveBeenCalledWith('192.168.1.100:api/invoices/pdf')
    })

    it('should block request when rate limit exceeded', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = vi.fn().mockResolvedValue({
        success: false,
        remaining: 0,
        reset: Date.now() + 60000,
        limit: 10,
      })
      
      ;(Ratelimit as any).mockImplementation(() => ({
        limit: mockLimit,
      }))
      
      const result = await rateLimit(mockRequest)
      
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.limit).toBe(10)
    })

    it('should use endpoint-specific rate limits', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = vi.fn().mockResolvedValue({
        success: true,
        remaining: 4,
        reset: Date.now() + 60000,
        limit: 5,
      })
      
      ;(Ratelimit as any).mockImplementation(() => ({
        limit: mockLimit,
      }))
      
      // Test auth endpoint
      const authRequest = {
        ...mockRequest,
        url: 'http://localhost:3000/api/auth/signin',
        nextUrl: {
          pathname: '/api/auth/signin',
        },
      } as NextRequest
      
      const result = await rateLimit(authRequest)
      
      expect(mockLimit).toHaveBeenCalledWith('192.168.1.100:api/auth/signin')
      expect(result.limit).toBe(5)
    })

    it('should use default rate limit for unknown endpoints', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = vi.fn().mockResolvedValue({
        success: true,
        remaining: 59,
        reset: Date.now() + 60000,
        limit: 60,
      })
      
      ;(Ratelimit as any).mockImplementation(() => ({
        limit: mockLimit,
      }))
      
      // Test unknown endpoint
      const unknownRequest = {
        ...mockRequest,
        url: 'http://localhost:3000/api/unknown',
        nextUrl: {
          pathname: '/api/unknown',
        },
      } as NextRequest
      
      const result = await rateLimit(unknownRequest)
      
      expect(mockLimit).toHaveBeenCalledWith('192.168.1.100:api/unknown')
      expect(result.limit).toBe(60)
    })
  })

  describe('With In-Memory Fallback', () => {
    beforeEach(() => {
      // Remove Upstash environment variables to trigger in-memory fallback
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      
      // Reset the module to clear any cached instances
      vi.resetModules()
    })

    it('should use in-memory rate limiter when Upstash is not configured', async () => {
      const { rateLimit } = await import('@/lib/rate-limiter')
      
      // Make multiple requests
      const results = []
      for (let i = 0; i < 12; i++) {
        const result = await rateLimit(mockRequest)
        results.push(result)
      }
      
      // First 10 should succeed (PDF endpoint limit)
      for (let i = 0; i < 10; i++) {
        expect(results[i].success).toBe(true)
        expect(results[i].remaining).toBe(9 - i)
      }
      
      // 11th and 12th should be blocked
      expect(results[10].success).toBe(false)
      expect(results[11].success).toBe(false)
    })

    it('should track different IPs separately', async () => {
      const { rateLimit } = await import('@/lib/rate-limiter')
      
      // Request from first IP
      const result1 = await rateLimit(mockRequest)
      expect(result1.success).toBe(true)
      expect(result1.remaining).toBe(9)
      
      // Request from second IP
      const request2 = {
        ...mockRequest,
        headers: new Headers({
          'x-forwarded-for': '192.168.1.101',
        }),
        ip: '192.168.1.101',
      } as unknown as NextRequest
      
      const result2 = await rateLimit(request2)
      expect(result2.success).toBe(true)
      expect(result2.remaining).toBe(9)
    })

    it('should reset rate limits after window expires', async () => {
      vi.useFakeTimers()
      const { rateLimit } = await import('@/lib/rate-limiter')
      
      // Use up all requests
      for (let i = 0; i < 10; i++) {
        await rateLimit(mockRequest)
      }
      
      // Should be blocked
      let result = await rateLimit(mockRequest)
      expect(result.success).toBe(false)
      
      // Advance time by 1 minute
      vi.advanceTimersByTime(60000)
      
      // Should be allowed again
      result = await rateLimit(mockRequest)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(9)
      
      vi.useRealTimers()
    })
  })

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.com'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
      
      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = vi.fn().mockRejectedValue(new Error('Redis connection failed'))
      
      ;(Ratelimit as any).mockImplementation(() => ({
        limit: mockLimit,
      }))
      
      // Should fall back to in-memory limiter
      const result = await rateLimit(mockRequest)
      
      // In-memory limiter should work
      expect(result.success).toBe(true)
      expect(result.limit).toBe(10) // PDF endpoint limit
    })

    it('should handle missing IP address', async () => {
      const requestNoIp = {
        headers: new Headers(),
        url: 'http://localhost:3000/api/test',
        nextUrl: {
          pathname: '/api/test',
        },
      } as NextRequest
      
      const { rateLimit } = await import('@/lib/rate-limiter')
      const result = await rateLimit(requestNoIp)
      
      // Should use a default identifier
      expect(result.success).toBe(true)
    })

    it('should handle malformed requests', async () => {
      const malformedRequest = {
        headers: new Headers({
          'x-forwarded-for': 'not-an-ip',
        }),
        url: 'not-a-url',
        nextUrl: {
          pathname: '',
        },
      } as NextRequest
      
      const { rateLimit } = await import('@/lib/rate-limiter')
      const result = await rateLimit(malformedRequest)
      
      // Should still work with defaults
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('limit')
      expect(result).toHaveProperty('remaining')
    })
  })

  describe('Integration with Middleware', () => {
    it('should provide proper response headers', async () => {
      const { rateLimit } = await import('@/lib/rate-limiter')
      const result = await rateLimit(mockRequest)
      
      expect(result).toHaveProperty('limit')
      expect(result).toHaveProperty('remaining')
      expect(result).toHaveProperty('reset')
      
      // These can be used for response headers
      expect(typeof result.limit).toBe('number')
      expect(typeof result.remaining).toBe('number')
      expect(typeof result.reset).toBe('number')
    })

    it('should work with authenticated users', async () => {
      const authenticatedRequest = {
        ...mockRequest,
        headers: new Headers({
          'x-forwarded-for': '192.168.1.100',
          'x-user-id': 'user-123',
        }),
      } as NextRequest
      
      const { rateLimit } = await import('@/lib/rate-limiter')
      const result = await rateLimit(authenticatedRequest)
      
      expect(result.success).toBe(true)
    })
  })

  describe('Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const { rateLimit } = await import('@/lib/rate-limiter')
      
      // Make 5 concurrent requests
      const promises = Array.from({ length: 5 }, () => 
        rateLimit(mockRequest)
      )
      
      const results = await Promise.all(promises)
      
      // All should succeed and have correct remaining counts
      results.forEach((result, index) => {
        expect(result.success).toBe(true)
        expect(result.remaining).toBeLessThanOrEqual(9)
      })
    })

    it('should clean up old entries to prevent memory leaks', async () => {
      vi.useFakeTimers()
      const { rateLimit } = await import('@/lib/rate-limiter')
      
      // Create entries for multiple IPs
      for (let i = 0; i < 100; i++) {
        const request = {
          ...mockRequest,
          headers: new Headers({
            'x-forwarded-for': `192.168.1.${i}`,
          }),
          ip: `192.168.1.${i}`,
        } as NextRequest
        
        await rateLimit(request)
      }
      
      // Advance time to trigger cleanup
      vi.advanceTimersByTime(120000) // 2 minutes
      
      // Make a new request to trigger cleanup
      await rateLimit(mockRequest)
      
      // Old entries should be cleaned up
      // (Implementation would need to expose memory store size for verification)
      
      vi.useRealTimers()
    })
  })
})