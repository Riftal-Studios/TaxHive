import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // If user is authenticated and trying to access auth pages, redirect to dashboard
    if (req.nextauth.token && req.nextUrl.pathname.startsWith('/auth/')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
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