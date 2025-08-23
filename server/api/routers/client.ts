import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import Logger from '@/lib/logger'

export const clientRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        company: z.string().optional(),
        address: z.string().min(1),
        country: z.string().min(1),
        phone: z.string().optional(),
        taxId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure user ID exists
      if (!ctx.session.user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID not found in session',
        })
      }

      try {
        const client = await ctx.prisma.client.create({
          data: {
            ...input,
            userId: ctx.session.user.id,
          },
        })
        return client
      } catch (error) {
        Logger.error('Client creation error', { 
          error, 
          userId: ctx.session.user.id,
          sessionId: ctx.session.id 
        })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create client. Please ensure you are properly logged in.',
        })
      }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const clients = await ctx.prisma.client.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    return clients
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.prisma.client.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      })

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        })
      }

      return client
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        email: z.string().email(),
        company: z.string().optional(),
        address: z.string().min(1),
        country: z.string().min(1),
        phone: z.string().optional(),
        taxId: z.string().optional(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const client = await ctx.prisma.client.updateMany({
        where: {
          id,
          userId: ctx.session.user.id,
        },
        data,
      })

      if (client.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        })
      }

      return client
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.prisma.client.deleteMany({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      })

      if (client.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        })
      }

      return { success: true }
    }),
})