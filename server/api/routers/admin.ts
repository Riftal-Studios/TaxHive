import { z } from 'zod'
import { createTRPCRouter, adminProcedure } from '@/server/api/trpc'
import { updateExchangeRates } from '@/lib/exchange-rates'
import { TRPCError } from '@trpc/server'
import { CURRENCY_CODES } from '@/lib/constants'

export const adminRouter = createTRPCRouter({
  // ── Exchange Rate Management ─────────────────────────────────

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
    return ctx.prisma.exchangeRate.findMany({
      where: {
        date: { gte: today, lt: new Date(today.getTime() + 86400000) },
      },
      orderBy: { currency: 'asc' },
    })
  }),

  getExchangeRateHistory: adminProcedure
    .input(z.object({
      currency: z.string(),
      days: z.number().min(1).max(365).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - input.days)
      startDate.setHours(0, 0, 0, 0)
      return ctx.prisma.exchangeRate.findMany({
        where: { currency: input.currency, date: { gte: startDate } },
        orderBy: { date: 'desc' },
      })
    }),

  createExchangeRate: adminProcedure
    .input(z.object({
      currency: z.enum(Object.values(CURRENCY_CODES) as [string, ...string[]]),
      rate: z.number().positive(),
      source: z.string().default('Manual'),
    }))
    .mutation(async ({ ctx, input }) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return ctx.prisma.exchangeRate.upsert({
        where: { currency_date: { currency: input.currency, date: today } },
        create: { currency: input.currency, rate: input.rate, source: input.source, date: today },
        update: { rate: input.rate, source: input.source },
      })
    }),

  // ── User Management ──────────────────────────────────────────

  getAllUsers: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where = input.search ? {
        OR: [
          { name: { contains: input.search, mode: 'insensitive' as const } },
          { email: { contains: input.search, mode: 'insensitive' as const } },
        ],
      } : {}

      const [users, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            gstin: true,
            onboardingCompleted: true,
            createdAt: true,
            _count: { select: { invoices: true, clients: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.user.count({ where }),
      ])

      return { users, total, page: input.page, totalPages: Math.ceil(total / input.limit) }
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
          onboardingCompleted: true,
          onboardingStep: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              invoices: true,
              clients: true,
              feedback: true,
              paymentVouchers: true,
              luts: true,
            },
          },
        },
      })

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
      }

      const recentInvoices = await ctx.prisma.invoice.findMany({
        where: { userId: input.id },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      return { ...user, recentInvoices }
    }),

  getUserStats: adminProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

    const [totalUsers, activeUsers, newUsersThisMonth, usersByRole] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.user.count({ where: { onboardingCompleted: true } }),
      ctx.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      ctx.prisma.user.groupBy({ by: ['role'], _count: true }),
    ])

    return {
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      adminCount: usersByRole.find(r => r.role === 'ADMIN')?._count ?? 0,
    }
  }),

  getSystemMetrics: adminProcedure.query(async ({ ctx }) => {
    const [
      totalInvoices,
      totalRevenue,
      totalClients,
      totalFeedback,
      pendingFeedback,
    ] = await Promise.all([
      ctx.prisma.invoice.count(),
      ctx.prisma.invoice.aggregate({ _sum: { totalInINR: true } }),
      ctx.prisma.client.count(),
      ctx.prisma.feedback.count(),
      ctx.prisma.feedback.count({ where: { status: 'NEW' } }),
    ])

    return {
      totalInvoices,
      totalRevenue: Number(totalRevenue._sum.totalInINR ?? 0),
      totalClients,
      totalFeedback,
      pendingFeedback,
    }
  }),

  // ── Feedback Management ──────────────────────────────────────

  getAllFeedback: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      status: z.enum(['NEW', 'REVIEWED', 'RESOLVED']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where = input.status ? { status: input.status } : {}

      const [feedback, total] = await Promise.all([
        ctx.prisma.feedback.findMany({
          where,
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.feedback.count({ where }),
      ])

      return { feedback, total, page: input.page, totalPages: Math.ceil(total / input.limit) }
    }),

  updateFeedbackStatus: adminProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['NEW', 'REVIEWED', 'RESOLVED']),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.feedback.update({
        where: { id: input.id },
        data: { status: input.status },
      })
    }),
})
