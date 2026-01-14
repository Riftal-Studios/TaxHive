import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { startOfMonth, subMonths, format, differenceInDays } from 'date-fns'
import {
  calculateComplianceHealth,
  getComplianceIssues,
  type LUTStatus,
} from '@/lib/dashboard/compliance-health'
import {
  calculateGSTSummary,
  type GSTSummaryInput,
} from '@/lib/dashboard/gst-summary'
import {
  generateFilingCalendar,
  getNextFilingDeadlines,
  type FilingPeriodData,
} from '@/lib/dashboard/filing-calendar'
import {
  calculateITCHealth,
  type ITCHealthInput,
} from '@/lib/dashboard/itc-health'

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
      (sum, inv) => sum + Number(inv.totalInINR),
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

      return invoices.map(invoice => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        amount: Number(invoice.totalInINR),
        status: invoice.status,
        clientName: invoice.client?.name ?? 'Self Invoice',
        companyName: invoice.client?.company ?? null,
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

    return statusGroups.map(group => ({
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

      // Get client details for the grouped results (filter out null clientIds for self-invoices)
      const clientIds = clientGroups.map(g => g.clientId).filter((id): id is string => id !== null)
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
        clientDetails.map(c => [c.clientId, c.client])
      )

      return clientGroups.map(group => ({
        clientId: group.clientId,
        clientName: clientMap.get(group.clientId)?.name || 'Unknown',
        companyName: clientMap.get(group.clientId)?.company || null,
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
      invoices.forEach(invoice => {
        const monthKey = format(invoice.invoiceDate, 'yyyy-MM')
        const existing = monthlyRevenue.get(monthKey) || { revenue: 0, invoiceCount: 0 }
        
        monthlyRevenue.set(monthKey, {
          revenue: existing.revenue + Number(invoice.totalInINR),
          invoiceCount: existing.invoiceCount + 1,
        })
      })

      // Convert to array and sort by month
      return Array.from(monthlyRevenue.entries())
        .map(([month, data]) => ({
          month,
          revenue: data.revenue,
          invoiceCount: data.invoiceCount,
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
    }),

  getComplianceHealth: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const now = new Date()

    // 1. Get LUT status
    const activeLut = await ctx.prisma.lUT.findFirst({
      where: {
        userId,
        validFrom: { lte: now },
        validTill: { gte: now },
      },
      orderBy: { validTill: 'desc' },
    })

    let lutStatus: LUTStatus = 'MISSING'
    let lutDaysRemaining: number | null = null

    if (activeLut) {
      lutDaysRemaining = differenceInDays(activeLut.validTill, now)
      if (lutDaysRemaining < 0) {
        lutStatus = 'EXPIRED'
      } else if (lutDaysRemaining <= 30) {
        lutStatus = 'EXPIRING'
      } else {
        lutStatus = 'VALID'
      }
    } else {
      // Check if there was ever a LUT (might be expired)
      const expiredLut = await ctx.prisma.lUT.findFirst({
        where: { userId },
        orderBy: { validTill: 'desc' },
      })
      if (expiredLut) {
        lutDaysRemaining = differenceInDays(expiredLut.validTill, now)
        lutStatus = 'EXPIRED'
      }
    }

    // 2. Get filing counts
    const [pendingFilings, overdueFilings] = await Promise.all([
      ctx.prisma.gSTFilingPeriod.count({
        where: {
          userId,
          status: { in: ['DRAFT', 'GENERATED', 'IN_REVIEW'] },
          dueDate: { gte: now },
        },
      }),
      ctx.prisma.gSTFilingPeriod.count({
        where: {
          userId,
          status: { notIn: ['FILED'] },
          dueDate: { lt: now },
        },
      }),
    ])

    // 3. Get unreconciled ITC
    const unreconciledITC = await ctx.prisma.gSTR2BEntry.aggregate({
      where: {
        upload: { userId },
        matchStatus: { in: ['PENDING', 'AMOUNT_MISMATCH', 'NOT_IN_2B', 'IN_2B_ONLY'] },
      },
      _count: { id: true },
      _sum: { igst: true, cgst: true, sgst: true },
    })

    const unreconciledITCCount = unreconciledITC._count.id
    const unreconciledITCAmount =
      Number(unreconciledITC._sum.igst || 0) +
      Number(unreconciledITC._sum.cgst || 0) +
      Number(unreconciledITC._sum.sgst || 0)

    // Calculate compliance health
    const healthInput = {
      lutStatus,
      lutDaysRemaining,
      pendingFilingsCount: pendingFilings,
      overdueFilingsCount: overdueFilings,
      unreconciledITCCount,
      unreconciledITCAmount,
    }

    const health = calculateComplianceHealth(healthInput)
    const issues = getComplianceIssues(healthInput)

    return {
      score: health.score,
      status: health.status,
      issues,
      details: {
        lut: {
          status: lutStatus,
          daysRemaining: lutDaysRemaining,
        },
        filings: {
          pending: pendingFilings,
          overdue: overdueFilings,
        },
        itc: {
          unreconciledCount: unreconciledITCCount,
          unreconciledAmount: unreconciledITCAmount,
        },
      },
    }
  }),

  getGSTSummary: protectedProcedure
    .input(
      z
        .object({
          period: z.string().optional(), // YYYY-MM format, defaults to current month
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const now = new Date()

      // Determine the period
      const periodStr = input?.period || format(now, 'yyyy-MM')
      const [year, month] = periodStr.split('-').map(Number)
      const periodStart = new Date(year, month - 1, 1)
      const periodEnd = new Date(year, month, 0, 23, 59, 59, 999)

      // 1. Get output tax from domestic invoices (non-export)
      const outputTax = await ctx.prisma.invoice.aggregate({
        where: {
          userId,
          invoiceDate: { gte: periodStart, lte: periodEnd },
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          // Only domestic invoices have output tax
          client: {
            country: 'IN',
          },
        },
        _sum: {
          igstAmount: true,
          cgstAmount: true,
          sgstAmount: true,
        },
      })

      // 2. Get ITC from matched GSTR-2B entries
      const returnPeriod = `${month.toString().padStart(2, '0')}${year}` // MMYYYY format
      const itc = await ctx.prisma.gSTR2BEntry.aggregate({
        where: {
          upload: { userId, returnPeriod },
          matchStatus: 'MATCHED',
        },
        _sum: {
          igst: true,
          cgst: true,
          sgst: true,
        },
      })

      // 3. Get RCM from self-invoices
      const rcm = await ctx.prisma.invoice.aggregate({
        where: {
          userId,
          invoiceDate: { gte: periodStart, lte: periodEnd },
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          clientId: null, // Self-invoices have no client
          unregisteredSupplierId: { not: null },
        },
        _sum: {
          igstAmount: true,
          cgstAmount: true,
          sgstAmount: true,
        },
      })

      // Build input for calculation
      const summaryInput: GSTSummaryInput = {
        outputIGST: Number(outputTax._sum.igstAmount || 0),
        outputCGST: Number(outputTax._sum.cgstAmount || 0),
        outputSGST: Number(outputTax._sum.sgstAmount || 0),
        itcIGST: Number(itc._sum.igst || 0),
        itcCGST: Number(itc._sum.cgst || 0),
        itcSGST: Number(itc._sum.sgst || 0),
        rcmIGST: Number(rcm._sum.igstAmount || 0),
        rcmCGST: Number(rcm._sum.cgstAmount || 0),
        rcmSGST: Number(rcm._sum.sgstAmount || 0),
      }

      const summary = calculateGSTSummary(summaryInput)

      return {
        period: periodStr,
        ...summary,
      }
    }),

  getFilingCalendar: protectedProcedure
    .input(
      z
        .object({
          monthsAhead: z.number().min(1).max(12).default(3),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const monthsAhead = input?.monthsAhead || 3

      // Get filing periods from database
      const filings = await ctx.prisma.gSTFilingPeriod.findMany({
        where: { userId },
        select: {
          period: true,
          filingType: true,
          status: true,
          approvedAt: true,
        },
        orderBy: { period: 'desc' },
        take: 24, // Last 2 years of filings
      })

      // Convert to FilingPeriodData format
      const filingData: FilingPeriodData[] = filings.map((f) => ({
        period: f.period,
        filingType: f.filingType,
        status: f.status,
        filedAt: f.status === 'FILED' ? f.approvedAt : null,
      }))

      const calendar = generateFilingCalendar(filingData, monthsAhead)
      const nextDeadlines = getNextFilingDeadlines(filingData, 4)
      const overdueCount = calendar.filter((e) => e.isOverdue).length

      return {
        calendar,
        nextDeadlines,
        overdueCount,
        hasOverdue: overdueCount > 0,
      }
    }),

  getITCHealth: protectedProcedure
    .input(
      z
        .object({
          period: z.string().optional(), // MMYYYY format
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const now = new Date()

      // Default to current period
      const periodStr =
        input?.period ||
        `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear()}`

      // Count entries by match status
      const entryCounts = await ctx.prisma.gSTR2BEntry.groupBy({
        by: ['matchStatus'],
        where: {
          upload: { userId, returnPeriod: periodStr },
        },
        _count: { id: true },
        _sum: { igst: true, cgst: true, sgst: true },
      })

      // Build the input for calculation
      const countMap: Record<
        string,
        { count: number; amount: number }
      > = {}

      for (const entry of entryCounts) {
        const amount =
          Number(entry._sum.igst || 0) +
          Number(entry._sum.cgst || 0) +
          Number(entry._sum.sgst || 0)
        countMap[entry.matchStatus] = {
          count: entry._count.id,
          amount,
        }
      }

      const totalEntries = entryCounts.reduce((sum, e) => sum + e._count.id, 0)

      const healthInput: ITCHealthInput = {
        totalEntries,
        matchedCount: countMap['MATCHED']?.count || 0,
        matchedAmount: countMap['MATCHED']?.amount || 0,
        amountMismatchCount: countMap['AMOUNT_MISMATCH']?.count || 0,
        amountMismatchAmount: countMap['AMOUNT_MISMATCH']?.amount || 0,
        notIn2BCount: countMap['NOT_IN_2B']?.count || 0,
        notIn2BAmount: countMap['NOT_IN_2B']?.amount || 0,
        in2BOnlyCount: countMap['IN_2B_ONLY']?.count || 0,
        in2BOnlyAmount: countMap['IN_2B_ONLY']?.amount || 0,
        pendingCount: countMap['PENDING']?.count || 0,
        pendingAmount: countMap['PENDING']?.amount || 0,
      }

      const health = calculateITCHealth(healthInput)

      return {
        period: periodStr,
        ...health,
        breakdown: {
          matched: countMap['MATCHED'] || { count: 0, amount: 0 },
          amountMismatch: countMap['AMOUNT_MISMATCH'] || { count: 0, amount: 0 },
          notIn2B: countMap['NOT_IN_2B'] || { count: 0, amount: 0 },
          in2BOnly: countMap['IN_2B_ONLY'] || { count: 0, amount: 0 },
          pending: countMap['PENDING'] || { count: 0, amount: 0 },
        },
      }
    }),
})