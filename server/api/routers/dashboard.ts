import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { Decimal } from '@prisma/client/runtime/library'

// Helper to get the start of the current fiscal year (April 1st)
function getCurrentFiscalYearStart(): Date {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  
  // If we're in Jan-Mar, fiscal year started last year
  const fiscalYearStart = currentMonth < 3 
    ? new Date(currentYear - 1, 3, 1) // April 1st of last year
    : new Date(currentYear, 3, 1)     // April 1st of this year
    
  return fiscalYearStart
}

export const dashboardRouter = createTRPCRouter({
  getMetrics: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const now = new Date()
    const monthStart = startOfMonth(now)
    const fiscalYearStart = getCurrentFiscalYearStart()

    // Get invoice counts
    const [totalInvoices, thisMonthInvoices, thisYearInvoices] = await Promise.all([
      ctx.prisma.invoice.count({ where: { userId } }),
      ctx.prisma.invoice.count({
        where: {
          userId,
          invoiceDate: { gte: monthStart },
        },
      }),
      ctx.prisma.invoice.count({
        where: {
          userId,
          invoiceDate: { gte: fiscalYearStart },
        },
      }),
    ])

    // Get revenue total
    const revenueAgg = await ctx.prisma.invoice.aggregate({
      where: {
        userId,
        status: { in: ['PAID', 'SENT', 'PARTIALLY_PAID'] },
      },
      _sum: {
        totalInINR: true,
      },
    })

    // Get pending payments
    const pendingAgg = await ctx.prisma.invoice.aggregate({
      where: {
        userId,
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
      },
      _sum: {
        totalInINR: true,
      },
      _count: {
        id: true,
      },
    })

    // Get overdue invoices
    const overdueInvoices = await ctx.prisma.invoice.findMany({
      where: {
        userId,
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        totalInINR: true,
        dueDate: true,
      },
    })

    const overdueAmount = overdueInvoices.reduce(
      (sum: number, inv: any) => sum + Number(inv.totalInINR),
      0
    )

    // Get active clients count
    const activeClients = await ctx.prisma.client.count({
      where: {
        userId,
        isActive: true,
      },
    })

    // Get average invoice value
    const avgInvoiceValue = await ctx.prisma.invoice.aggregate({
      where: {
        userId,
        status: { not: 'CANCELLED' },
      },
      _avg: {
        totalInINR: true,
      },
    })

    return {
      totalInvoices: {
        allTime: totalInvoices,
        thisMonth: thisMonthInvoices,
        thisYear: thisYearInvoices,
      },
      revenue: {
        total: Number(revenueAgg._sum.totalInINR || 0),
        currency: 'INR',
      },
      pendingPayments: {
        count: pendingAgg._count.id,
        amount: Number(pendingAgg._sum.totalInINR || 0),
      },
      overdueInvoices: {
        count: overdueInvoices.length,
        amount: overdueAmount,
      },
      activeClients,
      averageInvoiceValue: Number(avgInvoiceValue._avg.totalInINR || 0),
    }
  }),

  getRecentInvoices: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(5),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit || 5

      const invoices = await ctx.prisma.invoice.findMany({
        where: { userId: ctx.session.user.id },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          totalInINR: true,
          status: true,
          client: {
            select: {
              name: true,
              company: true,
            },
          },
        },
        orderBy: { invoiceDate: 'desc' },
        take: limit,
      })

      return invoices.map((invoice: any) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        amount: Number(invoice.totalInINR),
        status: invoice.status,
        clientName: invoice.client.name,
        companyName: invoice.client.company,
      }))
    }),

  getPaymentStatusBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const statusGroups = await ctx.prisma.invoice.groupBy({
      by: ['status'],
      where: { userId: ctx.session.user.id },
      _count: {
        id: true,
      },
      _sum: {
        totalInINR: true,
      },
    })

    return statusGroups.map((group: any) => ({
      status: group.status,
      count: group._count.id,
      amount: Number(group._sum.totalInINR || 0),
    }))
  }),

  getClientDistribution: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(10).default(5),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit || 5

      const clientGroups = await ctx.prisma.invoice.groupBy({
        by: ['clientId'],
        where: { userId: ctx.session.user.id },
        _count: {
          id: true,
        },
        _sum: {
          totalInINR: true,
        },
        orderBy: {
          _sum: {
            totalInINR: 'desc',
          },
        },
        take: limit,
      })

      // Get client details for the grouped results
      const clientIds = clientGroups.map((g: any) => g.clientId)
      const clientDetails = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          clientId: { in: clientIds },
        },
        select: {
          clientId: true,
          client: {
            select: {
              name: true,
              company: true,
            },
          },
        },
        distinct: ['clientId'],
      })

      const clientMap = new Map(
        clientDetails.map((c: any) => [c.clientId, c.client])
      )

      return clientGroups.map((group: any) => ({
        clientId: group.clientId,
        clientName: (clientMap.get(group.clientId) as any)?.name || 'Unknown',
        companyName: (clientMap.get(group.clientId) as any)?.company || null,
        invoiceCount: group._count.id,
        totalRevenue: Number(group._sum.totalInINR || 0),
      }))
    }),

  getRevenueByMonth: protectedProcedure
    .input(
      z.object({
        months: z.number().min(1).max(12).default(6),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const monthsToFetch = input?.months || 6
      const startDate = subMonths(new Date(), monthsToFetch - 1)
      
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceDate: { gte: startOfMonth(startDate) },
          status: { in: ['PAID', 'SENT', 'PARTIALLY_PAID'] },
        },
        select: {
          invoiceDate: true,
          totalInINR: true,
          currency: true,
        },
      })

      // Group by month
      const monthlyRevenue = new Map<string, { revenue: number; invoiceCount: number }>()
      
      // Initialize all months with zero values
      for (let i = 0; i < monthsToFetch; i++) {
        const date = subMonths(new Date(), i)
        const monthKey = format(date, 'yyyy-MM')
        monthlyRevenue.set(monthKey, { revenue: 0, invoiceCount: 0 })
      }

      // Aggregate invoice data
      invoices.forEach((invoice: any) => {
        const monthKey = format(invoice.invoiceDate, 'yyyy-MM')
        const existing = monthlyRevenue.get(monthKey) || { revenue: 0, invoiceCount: 0 }
        
        monthlyRevenue.set(monthKey, {
          revenue: existing.revenue + Number(invoice.totalInINR),
          invoiceCount: existing.invoiceCount + 1,
        })
      })

      // Convert to array and sort by month
      return Array.from(monthlyRevenue.entries())
        .map(([month, data]: [string, any]) => ({
          month,
          revenue: data.revenue,
          invoiceCount: data.invoiceCount,
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
    }),
})