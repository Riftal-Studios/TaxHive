/**
 * GST Filing Router
 *
 * Handles GSTR-1 and GSTR-3B filing plan generation, review, and approval.
 */

import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { FilingType, FilingStatus, Prisma } from '@prisma/client'
import {
  classifyForGSTR1,
  classifyForGSTR3B,
  GSTR1Table,
  getGSTR1DueDate,
  getGSTR3BDueDate,
  getFiscalYear,
  getUpcomingFilingPeriods,
  formatPeriod,
  isFilingOverdue,
  getDaysUntilDue,
  validateFilingItem,
  calculateConfidenceScore,
  type InvoiceForClassification,
  type InvoiceForValidation,
} from '@/lib/gst-filing'

// Input schemas
const filingTypeSchema = z.nativeEnum(FilingType)
const filingStatusSchema = z.nativeEnum(FilingStatus)

export const gstFilingRouter = createTRPCRouter({
  /**
   * List filing periods with their status
   */
  listFilingPeriods: protectedProcedure
    .input(
      z.object({
        fiscalYear: z.string().optional(),
        filingType: filingTypeSchema.optional(),
        limit: z.number().min(1).max(24).default(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.GSTFilingPeriodWhereInput = {
        userId: ctx.session.user.id,
      }

      if (input.fiscalYear) {
        where.fiscalYear = input.fiscalYear
      }

      if (input.filingType) {
        where.filingType = input.filingType
      }

      const periods = await ctx.prisma.gSTFilingPeriod.findMany({
        where,
        orderBy: [{ period: 'desc' }, { filingType: 'asc' }],
        take: input.limit,
        include: {
          _count: {
            select: { planItems: true },
          },
        },
      })

      return periods.map((p) => ({
        ...p,
        itemsCount: p._count.planItems,
        formattedPeriod: formatPeriod(p.period),
        isOverdue: isFilingOverdue(p.dueDate),
        daysUntilDue: getDaysUntilDue(p.dueDate),
      }))
    }),

  /**
   * Get a specific filing period with its items
   */
  getFilingPeriod: protectedProcedure
    .input(
      z.object({
        periodId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const period = await ctx.prisma.gSTFilingPeriod.findFirst({
        where: {
          id: input.periodId,
          userId: ctx.session.user.id,
        },
        include: {
          planItems: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  status: true,
                  client: {
                    select: {
                      name: true,
                      country: true,
                    },
                  },
                  unregisteredSupplier: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: { invoiceDate: 'asc' },
          },
        },
      })

      if (!period) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Filing period not found',
        })
      }

      return {
        ...period,
        formattedPeriod: formatPeriod(period.period),
        isOverdue: isFilingOverdue(period.dueDate),
        daysUntilDue: getDaysUntilDue(period.dueDate),
      }
    }),

  /**
   * Generate or refresh GSTR-1 filing plan
   */
  generateGSTR1Plan: protectedProcedure
    .input(
      z.object({
        period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
      })
    )
    .mutation(async ({ ctx, input }) => {
      const fiscalYear = getFiscalYear(input.period)
      const dueDate = getGSTR1DueDate(input.period)

      // Get all export invoices for this period (GSTR-1 is for outward supplies)
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceType: 'EXPORT', // Only outward supplies
          status: { not: 'DRAFT' }, // Not draft invoices
          invoiceDate: {
            gte: new Date(`${input.period}-01`),
            lt: new Date(
              new Date(`${input.period}-01`).setMonth(
                new Date(`${input.period}-01`).getMonth() + 1
              )
            ),
          },
        },
        include: {
          client: true,
          lut: true,
          paymentVoucher: true,
        },
      })

      // Find or create filing period
      let filingPeriod = await ctx.prisma.gSTFilingPeriod.findUnique({
        where: {
          userId_filingType_period: {
            userId: ctx.session.user.id,
            filingType: FilingType.GSTR1,
            period: input.period,
          },
        },
      })

      if (filingPeriod) {
        // Delete existing items
        await ctx.prisma.filingPlanItem.deleteMany({
          where: { filingPeriodId: filingPeriod.id },
        })
      } else {
        filingPeriod = await ctx.prisma.gSTFilingPeriod.create({
          data: {
            userId: ctx.session.user.id,
            filingType: FilingType.GSTR1,
            period: input.period,
            fiscalYear,
            dueDate,
            status: FilingStatus.DRAFT,
          },
        })
      }

      // Classify and create plan items
      let totalTaxableValue = new Prisma.Decimal(0)
      let totalIgst = new Prisma.Decimal(0)
      let totalCgst = new Prisma.Decimal(0)
      let totalSgst = new Prisma.Decimal(0)

      const planItems: Prisma.FilingPlanItemCreateManyInput[] = []

      for (const invoice of invoices) {
        const classificationInput: InvoiceForClassification = {
          invoiceType: invoice.invoiceType,
          isRCM: invoice.isRCM,
          rcmType: invoice.rcmType,
          lutId: invoice.lutId,
          clientGstin: invoice.client?.taxId || null,
          clientCountry: invoice.client?.country || null,
          totalInINR: Number(invoice.totalInINR),
          igstAmount: Number(invoice.igstAmount),
          cgstAmount: Number(invoice.cgstAmount),
          sgstAmount: Number(invoice.sgstAmount),
        }

        const classification = classifyForGSTR1(classificationInput)

        // Skip items not applicable for GSTR-1
        if (classification.table === GSTR1Table.NOT_APPLICABLE) {
          continue
        }

        // Validate the item
        const validationInput: InvoiceForValidation = {
          invoiceType: invoice.invoiceType,
          isRCM: invoice.isRCM,
          clientCountry: invoice.client?.country || null,
          clientGstin: invoice.client?.taxId || null,
          lutId: invoice.lutId,
          lutExpiryDate: invoice.lut?.validTill || null,
          invoiceDate: invoice.invoiceDate,
          totalInINR: Number(invoice.totalInINR),
          igstAmount: Number(invoice.igstAmount),
          paymentVoucherId: invoice.paymentVoucher?.id || null,
        }

        const flags = validateFilingItem(validationInput, input.period)
        const confidenceScore = calculateConfidenceScore(flags)

        planItems.push({
          filingPeriodId: filingPeriod.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          gstrTable: classification.tableCode!,
          recipientGstin: invoice.client?.taxId || null,
          recipientName: invoice.client?.name || null,
          taxableValue: invoice.totalInINR,
          igstAmount: invoice.igstAmount,
          cgstAmount: invoice.cgstAmount,
          sgstAmount: invoice.sgstAmount,
          confidenceScore,
          flags: flags.length > 0 ? (flags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          isIncluded: true,
        })

        totalTaxableValue = totalTaxableValue.add(invoice.totalInINR)
        totalIgst = totalIgst.add(invoice.igstAmount)
        totalCgst = totalCgst.add(invoice.cgstAmount)
        totalSgst = totalSgst.add(invoice.sgstAmount)
      }

      // Create plan items
      if (planItems.length > 0) {
        await ctx.prisma.filingPlanItem.createMany({
          data: planItems,
        })
      }

      // Update totals
      await ctx.prisma.gSTFilingPeriod.update({
        where: { id: filingPeriod.id },
        data: {
          totalTaxableValue,
          totalIgstAmount: totalIgst,
          totalCgstAmount: totalCgst,
          totalSgstAmount: totalSgst,
          totalTaxAmount: totalIgst.add(totalCgst).add(totalSgst),
          status: FilingStatus.GENERATED,
          generatedAt: new Date(),
        },
      })

      return {
        id: filingPeriod.id,
        period: input.period,
        itemsCount: planItems.length,
        totalTaxableValue: Number(totalTaxableValue),
        totalTaxAmount: Number(totalIgst.add(totalCgst).add(totalSgst)),
      }
    }),

  /**
   * Generate or refresh GSTR-3B filing plan
   */
  generateGSTR3BPlan: protectedProcedure
    .input(
      z.object({
        period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
      })
    )
    .mutation(async ({ ctx, input }) => {
      const fiscalYear = getFiscalYear(input.period)
      const dueDate = getGSTR3BDueDate(input.period)

      // Get all invoices for this period (both outward and RCM)
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          status: { not: 'DRAFT' },
          invoiceDate: {
            gte: new Date(`${input.period}-01`),
            lt: new Date(
              new Date(`${input.period}-01`).setMonth(
                new Date(`${input.period}-01`).getMonth() + 1
              )
            ),
          },
        },
        include: {
          client: true,
          lut: true,
          paymentVoucher: true,
        },
      })

      // Find or create filing period
      let filingPeriod = await ctx.prisma.gSTFilingPeriod.findUnique({
        where: {
          userId_filingType_period: {
            userId: ctx.session.user.id,
            filingType: FilingType.GSTR3B,
            period: input.period,
          },
        },
      })

      if (filingPeriod) {
        await ctx.prisma.filingPlanItem.deleteMany({
          where: { filingPeriodId: filingPeriod.id },
        })
      } else {
        filingPeriod = await ctx.prisma.gSTFilingPeriod.create({
          data: {
            userId: ctx.session.user.id,
            filingType: FilingType.GSTR3B,
            period: input.period,
            fiscalYear,
            dueDate,
            status: FilingStatus.DRAFT,
          },
        })
      }

      // Classify and create plan items
      let totalTaxableValue = new Prisma.Decimal(0)
      let totalIgst = new Prisma.Decimal(0)
      let totalCgst = new Prisma.Decimal(0)
      let totalSgst = new Prisma.Decimal(0)
      let totalItcIgst = new Prisma.Decimal(0)
      let totalItcCgst = new Prisma.Decimal(0)
      let totalItcSgst = new Prisma.Decimal(0)

      const planItems: Prisma.FilingPlanItemCreateManyInput[] = []

      for (const invoice of invoices) {
        const classificationInput: InvoiceForClassification = {
          invoiceType: invoice.invoiceType,
          isRCM: invoice.isRCM,
          rcmType: invoice.rcmType,
          lutId: invoice.lutId,
          clientGstin: invoice.client?.taxId || null,
          clientCountry: invoice.client?.country || null,
          totalInINR: Number(invoice.totalInINR),
          igstAmount: Number(invoice.igstAmount),
          cgstAmount: Number(invoice.cgstAmount),
          sgstAmount: Number(invoice.sgstAmount),
        }

        const classification = classifyForGSTR3B(classificationInput)

        // Validate the item
        const validationInput: InvoiceForValidation = {
          invoiceType: invoice.invoiceType,
          isRCM: invoice.isRCM,
          clientCountry: invoice.client?.country || null,
          clientGstin: invoice.client?.taxId || null,
          lutId: invoice.lutId,
          lutExpiryDate: invoice.lut?.validTill || null,
          invoiceDate: invoice.invoiceDate,
          totalInINR: Number(invoice.totalInINR),
          igstAmount: Number(invoice.igstAmount),
          paymentVoucherId: invoice.paymentVoucher?.id || null,
        }

        const flags = validateFilingItem(validationInput, input.period)
        const confidenceScore = calculateConfidenceScore(flags)

        planItems.push({
          filingPeriodId: filingPeriod.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          gstrTable: classification.sectionCode,
          recipientGstin: invoice.client?.taxId || null,
          recipientName: invoice.client?.name || invoice.invoiceType === 'SELF_INVOICE' ? 'Self (RCM)' : null,
          taxableValue: invoice.totalInINR,
          igstAmount: invoice.igstAmount,
          cgstAmount: invoice.cgstAmount,
          sgstAmount: invoice.sgstAmount,
          confidenceScore,
          flags: flags.length > 0 ? (flags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          isIncluded: true,
        })

        totalTaxableValue = totalTaxableValue.add(invoice.totalInINR)
        totalIgst = totalIgst.add(invoice.igstAmount)
        totalCgst = totalCgst.add(invoice.cgstAmount)
        totalSgst = totalSgst.add(invoice.sgstAmount)

        // Add ITC for RCM items
        if (classification.itcSection) {
          totalItcIgst = totalItcIgst.add(new Prisma.Decimal(classification.itcIgst))
          totalItcCgst = totalItcCgst.add(new Prisma.Decimal(classification.itcCgst))
          totalItcSgst = totalItcSgst.add(new Prisma.Decimal(classification.itcSgst))
        }
      }

      // Create plan items
      if (planItems.length > 0) {
        await ctx.prisma.filingPlanItem.createMany({
          data: planItems,
        })
      }

      const totalTax = totalIgst.add(totalCgst).add(totalSgst)
      const totalItc = totalItcIgst.add(totalItcCgst).add(totalItcSgst)

      // Update totals
      await ctx.prisma.gSTFilingPeriod.update({
        where: { id: filingPeriod.id },
        data: {
          totalTaxableValue,
          totalIgstAmount: totalIgst,
          totalCgstAmount: totalCgst,
          totalSgstAmount: totalSgst,
          totalTaxAmount: totalTax,
          totalItcIgst,
          totalItcCgst,
          totalItcSgst,
          netTaxPayable: totalTax.sub(totalItc),
          status: FilingStatus.GENERATED,
          generatedAt: new Date(),
        },
      })

      return {
        id: filingPeriod.id,
        period: input.period,
        itemsCount: planItems.length,
        totalTaxableValue: Number(totalTaxableValue),
        totalTaxAmount: Number(totalTax),
        totalItc: Number(totalItc),
        netTaxPayable: Number(totalTax.sub(totalItc)),
      }
    }),

  /**
   * Get summary by GSTR table/section
   */
  getTableSummary: protectedProcedure
    .input(
      z.object({
        periodId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const period = await ctx.prisma.gSTFilingPeriod.findFirst({
        where: {
          id: input.periodId,
          userId: ctx.session.user.id,
        },
      })

      if (!period) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Filing period not found',
        })
      }

      // Get summary by table
      const summary = await ctx.prisma.filingPlanItem.groupBy({
        by: ['gstrTable'],
        where: {
          filingPeriodId: input.periodId,
          isIncluded: true,
        },
        _count: true,
        _sum: {
          taxableValue: true,
          igstAmount: true,
          cgstAmount: true,
          sgstAmount: true,
        },
      })

      return summary.map((s) => ({
        table: s.gstrTable,
        count: s._count,
        taxableValue: Number(s._sum.taxableValue || 0),
        igst: Number(s._sum.igstAmount || 0),
        cgst: Number(s._sum.cgstAmount || 0),
        sgst: Number(s._sum.sgstAmount || 0),
        totalTax: Number(s._sum.igstAmount || 0) + Number(s._sum.cgstAmount || 0) + Number(s._sum.sgstAmount || 0),
      }))
    }),

  /**
   * Update a plan item (manual adjustment)
   */
  updatePlanItem: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        isIncluded: z.boolean().optional(),
        adjustmentNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.filingPlanItem.findFirst({
        where: { id: input.itemId },
        include: {
          filingPeriod: true,
        },
      })

      if (!item || item.filingPeriod.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan item not found',
        })
      }

      const updated = await ctx.prisma.filingPlanItem.update({
        where: { id: input.itemId },
        data: {
          isIncluded: input.isIncluded,
          adjustmentNotes: input.adjustmentNotes,
          isManuallyAdjusted: true,
        },
      })

      return updated
    }),

  /**
   * Update filing status
   */
  updateFilingStatus: protectedProcedure
    .input(
      z.object({
        periodId: z.string(),
        status: filingStatusSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const period = await ctx.prisma.gSTFilingPeriod.findFirst({
        where: {
          id: input.periodId,
          userId: ctx.session.user.id,
        },
      })

      if (!period) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Filing period not found',
        })
      }

      const updateData: Prisma.GSTFilingPeriodUpdateInput = {
        status: input.status,
      }

      if (input.status === FilingStatus.APPROVED) {
        updateData.approvedAt = new Date()
      }

      if (input.status === FilingStatus.FILED) {
        updateData.filedAt = new Date()
      }

      const updated = await ctx.prisma.gSTFilingPeriod.update({
        where: { id: input.periodId },
        data: updateData,
      })

      return updated
    }),

  /**
   * Get items with flags (issues needing review)
   */
  getFlaggedItems: protectedProcedure
    .input(
      z.object({
        periodId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const period = await ctx.prisma.gSTFilingPeriod.findFirst({
        where: {
          id: input.periodId,
          userId: ctx.session.user.id,
        },
      })

      if (!period) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Filing period not found',
        })
      }

      // Get items where flags is not null/empty
      const items = await ctx.prisma.filingPlanItem.findMany({
        where: {
          filingPeriodId: input.periodId,
          NOT: {
            flags: { equals: Prisma.JsonNull },
          },
        },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              client: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { confidenceScore: 'asc' },
      })

      return items
    }),

  /**
   * Get upcoming due dates
   */
  getUpcomingDueDates: protectedProcedure
    .input(
      z.object({
        count: z.number().min(1).max(6).default(3),
      })
    )
    .query(async ({ ctx, input }) => {
      const upcoming = getUpcomingFilingPeriods(input.count)

      // Get existing filings for these periods
      const existingFilings = await ctx.prisma.gSTFilingPeriod.findMany({
        where: {
          userId: ctx.session.user.id,
          period: { in: upcoming.map((p) => p.period) },
        },
      })

      const filingMap = new Map(
        existingFilings.map((f) => [`${f.period}-${f.filingType}`, f])
      )

      return upcoming.map((period) => ({
        period: period.period,
        formattedPeriod: formatPeriod(period.period),
        fiscalYear: period.fiscalYear,
        gstr1: {
          dueDate: period.gstr1DueDate,
          daysUntilDue: getDaysUntilDue(period.gstr1DueDate),
          isOverdue: isFilingOverdue(period.gstr1DueDate),
          status: filingMap.get(`${period.period}-GSTR1`)?.status || null,
        },
        gstr3b: {
          dueDate: period.gstr3bDueDate,
          daysUntilDue: getDaysUntilDue(period.gstr3bDueDate),
          isOverdue: isFilingOverdue(period.gstr3bDueDate),
          status: filingMap.get(`${period.period}-GSTR3B`)?.status || null,
        },
      }))
    }),
})
