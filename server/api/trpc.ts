// Load Docker secrets before anything else
import '../secrets-loader'

import { initTRPC, TRPCError } from '@trpc/server'
import { type NextRequest } from 'next/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  errorFormatter({ shape, error }) {
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

const enforceUserIsAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { role: true },
  })

  if (user?.role !== 'ADMIN') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    })
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  })
})

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed)

export const adminProcedure = t.procedure.use(enforceUserIsAdmin)