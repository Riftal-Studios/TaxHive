import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// Create the handler with proper error handling
const handler = NextAuth(authOptions)

// Wrap the handler to ensure proper JSON responses even on errors
async function wrappedHandler(req: Request) {
  try {
    return await handler(req)
  } catch (error) {
    console.error('NextAuth handler error:', error)
    
    // Return a proper JSON error response instead of letting the error bubble up
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: 'An error occurred during authentication'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

export { wrappedHandler as GET, wrappedHandler as POST }