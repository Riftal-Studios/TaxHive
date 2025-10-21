import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

/**
 * Pages that don't require onboarding completion
 * Users can access these pages even if they haven't completed onboarding
 */
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

    /**
     * Redirect authenticated users from marketing pages to app
     * - Unauthenticated users see marketing landing page
     * - Authenticated users go to dashboard or onboarding
     */
    if (token && req.nextUrl.pathname === '/') {
      const redirectUrl = token.onboardingCompleted ? '/dashboard' : '/onboarding'
      return NextResponse.redirect(new URL(redirectUrl, req.url))
    }

    /**
     * Redirect authenticated users trying to access auth pages
     * (signin, signup, etc.) to dashboard
     */
    if (token && req.nextUrl.pathname.startsWith('/auth/')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    /**
     * Onboarding check: Redirect users who haven't completed onboarding
     * to the onboarding flow (except for exempt paths)
     */
    const isExemptPath = ONBOARDING_EXEMPT_PATHS.some(path =>
      req.nextUrl.pathname.startsWith(path)
    )

    if (token && !isExemptPath && !token.onboardingCompleted) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
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
        // Allow access to marketing pages without token
        const marketingPaths = ['/', '/features', '/pricing', '/blog']
        const isMarketingPath = marketingPaths.some(path =>
          req.nextUrl.pathname === path || req.nextUrl.pathname.startsWith(path + '/')
        )
        if (isMarketingPath) {
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
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - api/trpc (tRPC endpoints need separate auth)
     * - api/health (health check endpoint)
     * - api/invoices/public (public invoice API endpoints)
     * - invoice/ (public invoice pages - note the trailing slash to not match /invoices)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sitemap.xml (sitemap for SEO)
     * - robots.txt (robots file for SEO)
     */
    '/((?!api/auth|api/trpc|api/health|api/invoices/public|invoice/|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}