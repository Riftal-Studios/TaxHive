import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: {
        id: ctx.session.user.id,
      },
      include: {
        luts: {
          where: {
            isActive: true,
          },
          orderBy: {
            validTill: 'desc',
          },
        },
      },
    })
    return user
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        gstin: z.string().optional(),
        pan: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: input,
      })
      return user
    }),
})