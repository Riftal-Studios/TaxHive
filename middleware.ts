import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit, getRateLimitHeaders } from './lib/rate-limiter'

// Pages that don't require onboarding completion
const ONBOARDING_EXEMPT_PATHS = [
  '/onboarding',
  '/auth/',
  '/api/',
  '/settings', // Allow settings access during onboarding
  '/clients',  // Allow clients access during onboarding
  '/invoices/new', // Allow invoice creation during onboarding
  '/test-onboarding', // Test page
]

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token
    
    // Apply rate limiting to API routes
    if (req.nextUrl.pathname.startsWith('/api/')) {
      // Skip rate limiting for certain endpoints
      const skipRateLimitPaths = [
        '/api/auth/', // Auth endpoints handled separately
        '/api/health', // Health check should always work
      ];
      
      const shouldSkipRateLimit = skipRateLimitPaths.some(path => 
        req.nextUrl.pathname.startsWith(path)
      );
      
      if (!shouldSkipRateLimit) {
        const rateLimitResult = await rateLimit(req as NextRequest);
        
        if (!rateLimitResult.success) {
          // Return 429 Too Many Requests
          const headers = getRateLimitHeaders(rateLimitResult);
          
          return new NextResponse(
            JSON.stringify({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded. Please try again later.',
              retryAfter: rateLimitResult.retryAfter,
            }),
            {
              status: 429,
              headers,
            }
          );
        }
        
        // Add rate limit headers to successful responses
        const response = NextResponse.next();
        const headers = getRateLimitHeaders(rateLimitResult);
        headers.forEach((value, key) => {
          response.headers.set(key, value);
        });
        
        return response;
      }
    }
    
    // If user is authenticated and trying to access auth pages, redirect to dashboard
    if (token && req.nextUrl.pathname.startsWith('/auth/')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    
    // Check if path is exempt from onboarding check
    const isExemptPath = ONBOARDING_EXEMPT_PATHS.some(path => 
      req.nextUrl.pathname.startsWith(path)
    )
    
    // Check onboarding status for authenticated users
    if (token && !isExemptPath) {
      // If onboarding is not completed, redirect to onboarding
      if (!token.onboardingCompleted) {
        return NextResponse.redirect(new URL('/onboarding', req.url))
      }
    }
    
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to auth pages without token
        if (req.nextUrl.pathname.startsWith('/auth/')) {
          return true
        }
        // Allow access to home page without token
        if (req.nextUrl.pathname === '/') {
          return true
        }
        // Require token for all other pages
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths including API routes for rate limiting
     * Exclude only:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}