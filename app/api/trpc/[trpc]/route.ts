import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type NextRequest, NextResponse } from 'next/server'
import { appRouter } from '@/server/api/root'
import { createTRPCContext } from '@/server/api/trpc'

const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    req,
  })
}

// Helper to add CORS headers
const setCorsHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers)

  // Allow requests from the same origin and common development origins
  const origin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '*'
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Access-Control-Allow-Credentials', 'true')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`
            )
          }
        : undefined,
  })

  return setCorsHeaders(response)
}

// Handle preflight requests
export const OPTIONS = async () => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  })
}

export { handler as GET, handler as POST }