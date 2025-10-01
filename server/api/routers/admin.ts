import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { updateExchangeRates, getExchangeRate } from '@/lib/exchange-rates'
import { TRPCError } from '@trpc/server'
import { CURRENCY_CODES } from '@/lib/constants'

export const adminRouter = createTRPCRouter({
  updateExchangeRates: protectedProcedure.mutation(async ({ ctx }) => {
    // You might want to add additional admin role check here
    const result = await updateExchangeRates()
    
    if (!result.success) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: result.error || 'Failed to update exchange rates',
      })
    }
    
    return result
  }),

  getLatestExchangeRates: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const rates = await ctx.prisma.exchangeRate.findMany({
      where: {
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        currency: 'asc',
      },
    })
    
    return rates
  }),

  getExchangeRateHistory: protectedProcedure
    .input(
      z.object({
        currency: z.string(),
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - input.days)
      startDate.setHours(0, 0, 0, 0)
      
      const rates = await ctx.prisma.exchangeRate.findMany({
        where: {
          currency: input.currency,
          date: {
            gte: startDate,
          },
        },
        orderBy: {
          date: 'desc',
        },
      })
      
      return rates
    }),

  // Create manual exchange rate entry (for testing or override)
  createExchangeRate: protectedProcedure
    .input(
      z.object({
        currency: z.enum(Object.values(CURRENCY_CODES) as [string, ...string[]]),
        rate: z.number().positive(),
        source: z.string().default('Manual'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const rate = await ctx.prisma.exchangeRate.upsert({
        where: {
          currency_date: {
            currency: input.currency,
            date: today,
          },
        },
        create: {
          currency: input.currency,
          rate: input.rate,
          source: input.source,
          date: today,
        },
        update: {
          rate: input.rate,
          source: input.source,
        },
      })
      
      return rate
    }),
})