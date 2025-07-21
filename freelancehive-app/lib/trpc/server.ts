import 'server-only'

import { headers } from 'next/headers'
import { type NextRequest } from 'next/server'
import { createTRPCContext } from '@/server/api/trpc'
import { appRouter } from '@/server/api/root'
import { createCallerFactory } from '@/server/api/trpc'

export const api = createCallerFactory(appRouter)(async () => {
  const heads = new Headers(headers())
  heads.set('x-trpc-source', 'rsc')

  return createTRPCContext({
    req: {
      headers: heads,
    } as NextRequest,
  })
})