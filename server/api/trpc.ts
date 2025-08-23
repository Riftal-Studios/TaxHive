// Load Docker secrets before anything else
import '../secrets-loader'

import { initTRPC, TRPCError } from '@trpc/server'
import { type NextRequest } from 'next/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleTRPCError } from './error-handler'

export const createTRPCContext = async (opts: { req: NextRequest }) => {
  const session = await getServerSession(authOptions)

  return {
    session,
    prisma,
    req: opts.req,
  }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, ctx, path }) {
    // Track errors with our centralized system
    if (error.code === 'INTERNAL_SERVER_ERROR' || error.code === 'BAD_REQUEST') {
      handleTRPCError(error, ctx, path).catch(() => {
        // Ignore tracking errors to prevent cascading failures
      });
    }
    
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createCallerFactory = t.createCallerFactory

export const createTRPCRouter = t.router

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  })
})

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed)