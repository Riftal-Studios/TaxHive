import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'

export const feedbackRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(['BUG', 'FEATURE', 'QUESTION', 'OTHER']),
        message: z
          .string()
          .min(10, 'Message must be at least 10 characters')
          .max(2000, 'Message must not exceed 2000 characters'),
        pageUrl: z.string().min(1, 'Page URL is required'),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure user ID exists
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID not found in session',
        })
      }

      try {
        const feedback = await ctx.prisma.feedback.create({
          data: {
            userId: ctx.session.user.id,
            type: input.type,
            message: input.message,
            pageUrl: input.pageUrl,
            userAgent: input.userAgent || null,
            status: 'NEW',
          },
        })

        // TODO: Send email notification to admin
        // await sendFeedbackEmail(feedback)

        return feedback
      } catch (error) {
        console.error('Feedback creation error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create feedback. Please try again.',
        })
      }
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(['NEW', 'REVIEWED', 'RESOLVED']).optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Ensure user ID exists
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID not found in session',
        })
      }

      try {
        const feedback = await ctx.prisma.feedback.findMany({
          where: {
            userId: ctx.session.user.id,
            ...(input?.status && { status: input.status }),
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: input?.limit || 50,
        })

        return feedback
      } catch (error) {
        console.error('Feedback list error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve feedback.',
        })
      }
    }),
})
