import { z } from 'zod'
import { createTRPCRouter, adminProcedure } from '@/server/api/trpc'
import { updateExchangeRates } from '@/lib/exchange-rates'
import { TRPCError } from '@trpc/server'
import { CURRENCY_CODES } from '@/lib/constants'
import { startOfMonth, startOfWeek } from 'date-fns'

export const adminRouter = createTRPCRouter({
  // ============ USER MANAGEMENT ============

  getAllUsers: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        sortBy: z.enum(['createdAt', 'email', 'name']).default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, search, sortBy, sortOrder } = input
      const skip = (page - 1) * limit

      const where = search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}

      const [users, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            emailVerified: true,
            onboardingCompleted: true,
            createdAt: true,
            _count: {
              select: {
                clients: true,
                invoices: true,
              },
            },
          },
        }),
        ctx.prisma.user.count({ where }),
      ])

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    }),

  getUserById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          gstin: true,
          pan: true,
          address: true,
          emailVerified: true,
          onboardingCompleted: true,
          onboardingStep: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              clients: true,
              invoices: true,
              luts: true,
              feedback: true,
            },
          },
        },
      })

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
      }

      return user
    }),

  getUserStats: adminProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const thisMonthStart = startOfMonth(now)
    const thisWeekStart = startOfWeek(now)

    const [
      totalUsers,
      verifiedUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      completedOnboarding,
    ] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.user.count({ where: { emailVerified: { not: null } } }),
      ctx.prisma.user.count({ where: { createdAt: { gte: thisMonthStart } } }),
      ctx.prisma.user.count({ where: { createdAt: { gte: thisWeekStart } } }),
      ctx.prisma.user.count({ where: { onboardingCompleted: true } }),
    ])

    return {
      totalUsers,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      completedOnboarding,
      onboardingRate: totalUsers > 0 ? (completedOnboarding / totalUsers) * 100 : 0,
    }
  }),

  // ============ SYSTEM METRICS ============

  getSystemMetrics: adminProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const thisMonthStart = startOfMonth(now)

    const [
      totalInvoices,
      invoicesThisMonth,
      invoicesByStatus,
      totalRevenue,
      revenueThisMonth,
      totalClients,
      activeClients,
    ] = await Promise.all([
      ctx.prisma.invoice.count(),
      ctx.prisma.invoice.count({ where: { createdAt: { gte: thisMonthStart } } }),
      ctx.prisma.invoice.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      ctx.prisma.invoice.aggregate({ _sum: { totalInINR: true } }),
      ctx.prisma.invoice.aggregate({
        where: { createdAt: { gte: thisMonthStart } },
        _sum: { totalInINR: true },
      }),
      ctx.prisma.client.count(),
      ctx.prisma.client.count({ where: { isActive: true } }),
    ])

    const statusCounts = invoicesByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status
        return acc
      },
      {} as Record<string, number>
    )

    return {
      invoices: {
        total: totalInvoices,
        thisMonth: invoicesThisMonth,
        byStatus: statusCounts,
      },
      revenue: {
        totalINR: totalRevenue._sum.totalInINR?.toNumber() ?? 0,
        thisMonthINR: revenueThisMonth._sum.totalInINR?.toNumber() ?? 0,
      },
      clients: {
        total: totalClients,
        active: activeClients,
      },
    }
  }),

  // ============ FEEDBACK MANAGEMENT ============

  getAllFeedback: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['NEW', 'REVIEWED', 'RESOLVED']).optional(),
        type: z.enum(['BUG', 'FEATURE', 'QUESTION', 'OTHER']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, status, type } = input
      const skip = (page - 1) * limit

      const where = {
        ...(status && { status }),
        ...(type && { type }),
      }

      const [feedback, total] = await Promise.all([
        ctx.prisma.feedback.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        }),
        ctx.prisma.feedback.count({ where }),
      ])

      return {
        feedback,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    }),

  updateFeedbackStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['NEW', 'REVIEWED', 'RESOLVED']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const feedback = await ctx.prisma.feedback.update({
        where: { id: input.id },
        data: { status: input.status },
      })

      return feedback
    }),

  // ============ EXCHANGE RATES (existing) ============

  updateExchangeRates: adminProcedure.mutation(async () => {
    const result = await updateExchangeRates()
    
    if (!result.success) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: result.error || 'Failed to update exchange rates',
      })
    }
    
    return result
  }),

  getLatestExchangeRates: adminProcedure.query(async ({ ctx }) => {
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

  getExchangeRateHistory: adminProcedure
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
  createExchangeRate: adminProcedure
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