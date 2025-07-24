import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Pages that don't require onboarding completion
const ONBOARDING_EXEMPT_PATHS = [
  '/onboarding',
  '/auth/',
  '/api/',
  '/settings', // Allow settings access during onboarding
  '/clients',  // Allow clients access during onboarding
  '/invoices/new', // Allow invoice creation during onboarding
  '/test-onboarding', // Test page
  '/dashboard', // Temporarily allow dashboard to debug
]

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token
    
    // If user is authenticated and trying to access auth pages, redirect to dashboard
    if (token && req.nextUrl.pathname.startsWith('/auth/')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    
    // Check if path is exempt from onboarding check
    const isExemptPath = ONBOARDING_EXEMPT_PATHS.some(path => 
      req.nextUrl.pathname.startsWith(path)
    )
    
    // Temporarily disable onboarding check for debugging
    // if (token && !isExemptPath) {
    //   // Check if user has completed onboarding
    //   const userResponse = await fetch(`${req.nextUrl.origin}/api/trpc/users.getOnboardingStatus`, {
    //     method: 'GET',
    //     headers: {
    //       cookie: req.headers.get('cookie') || '',
    //     },
    //   })
      
    //   if (userResponse.ok) {
    //     const data = await userResponse.json()
    //     const onboardingStatus = data?.result?.data
        
    //     // If onboarding is not completed and user is not on onboarding page, redirect
    //     if (!onboardingStatus?.completed && req.nextUrl.pathname !== '/onboarding') {
    //       return NextResponse.redirect(new URL('/onboarding', req.url))
    //     }
    //   }
    // }
    
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
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - api/trpc (tRPC endpoints need separate auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|api/trpc|_next/static|_next/image|favicon.ico).*)',
  ],
}