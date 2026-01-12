import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { InvoiceType } from '@prisma/client'

export const paymentVoucherRouter = createTRPCRouter({
  /**
   * Get payment voucher by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const voucher = await ctx.prisma.paymentVoucher.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          selfInvoice: {
            include: {
              lineItems: true,
              unregisteredSupplier: true,
            },
          },
        },
      })

      if (!voucher) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment voucher not found',
        })
      }

      return voucher
    }),

  /**
   * Get payment voucher by self-invoice ID
   */
  getByInvoiceId: protectedProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const voucher = await ctx.prisma.paymentVoucher.findFirst({
        where: {
          selfInvoiceId: input.invoiceId,
          userId: ctx.session.user.id,
        },
        include: {
          selfInvoice: {
            include: {
              lineItems: true,
              unregisteredSupplier: true,
            },
          },
        },
      })

      if (!voucher) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment voucher not found for this invoice',
        })
      }

      return voucher
    }),

  /**
   * List all payment vouchers
   */
  list: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        fiscalYear: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const filters: Record<string, unknown> = {
        userId: ctx.session.user.id,
      }

      if (input?.startDate || input?.endDate) {
        filters.voucherDate = {}
        if (input?.startDate) {
          (filters.voucherDate as Record<string, Date>).gte = input.startDate
        }
        if (input?.endDate) {
          (filters.voucherDate as Record<string, Date>).lte = input.endDate
        }
      }

      if (input?.fiscalYear) {
        filters.voucherNumber = {
          startsWith: `PV/${input.fiscalYear}/`,
        }
      }

      const vouchers = await ctx.prisma.paymentVoucher.findMany({
        where: filters,
        include: {
          selfInvoice: {
            select: {
              invoiceNumber: true,
              invoiceDate: true,
              subtotal: true,
              totalAmount: true,
              unregisteredSupplier: {
                select: {
                  name: true,
                  state: true,
                },
              },
            },
          },
        },
        orderBy: {
          voucherDate: 'desc',
        },
      })

      return vouchers
    }),

  /**
   * Update payment voucher details (payment mode, reference, notes only)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        paymentReference: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const result = await ctx.prisma.paymentVoucher.updateMany({
        where: {
          id,
          userId: ctx.session.user.id,
        },
        data,
      })

      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment voucher not found',
        })
      }

      // Fetch and return the updated voucher
      const voucher = await ctx.prisma.paymentVoucher.findUnique({
        where: { id },
        include: {
          selfInvoice: true,
        },
      })

      return voucher
    }),

  /**
   * Get payment voucher summary for a period
   */
  getSummary: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const vouchers = await ctx.prisma.paymentVoucher.findMany({
        where: {
          userId: ctx.session.user.id,
          voucherDate: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        include: {
          selfInvoice: {
            select: {
              subtotal: true,
              totalAmount: true,
              igstAmount: true,
              cgstAmount: true,
              sgstAmount: true,
            },
          },
        },
      })

      // Group by payment mode
      const byPaymentMode: Record<string, { count: number; total: number }> = {}

      let totalAmount = 0
      let totalGST = 0
      let totalPreTax = 0

      for (const voucher of vouchers) {
        const mode = voucher.paymentMode
        if (!byPaymentMode[mode]) {
          byPaymentMode[mode] = { count: 0, total: 0 }
        }
        byPaymentMode[mode].count++
        byPaymentMode[mode].total += Number(voucher.amount)

        totalPreTax += Number(voucher.amount)
        totalAmount += Number(voucher.selfInvoice.totalAmount)
        totalGST += Number(voucher.selfInvoice.igstAmount) +
                    Number(voucher.selfInvoice.cgstAmount) +
                    Number(voucher.selfInvoice.sgstAmount)
      }

      return {
        count: vouchers.length,
        totalPreTax,
        totalGST,
        totalAmount,
        byPaymentMode,
      }
    }),

  /**
   * Get pending self-invoices (for compliance tracking - approaching or past 30-day deadline)
   */
  getPendingSelfInvoices: protectedProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const twentyFiveDaysAgo = new Date()
    twentyFiveDaysAgo.setDate(twentyFiveDaysAgo.getDate() - 25)

    // Find invoices where receipt date is approaching or past 30 days
    // but self-invoice wasn't created (shouldn't happen normally, but for tracking)
    const invoices = await ctx.prisma.invoice.findMany({
      where: {
        userId: ctx.session.user.id,
        invoiceType: InvoiceType.SELF_INVOICE,
        dateOfReceiptOfSupply: {
          lte: twentyFiveDaysAgo,
        },
      },
      include: {
        unregisteredSupplier: true,
        paymentVoucher: true,
      },
      orderBy: {
        dateOfReceiptOfSupply: 'asc',
      },
    })

    // Calculate days since receipt for each invoice
    const results = invoices.map(invoice => {
      const receiptDate = new Date(invoice.dateOfReceiptOfSupply!)
      const invoiceDate = new Date(invoice.invoiceDate)
      const daysSinceReceipt = Math.floor(
        (invoiceDate.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      return {
        ...invoice,
        daysSinceReceipt,
        isOverdue: daysSinceReceipt > 30,
        daysRemaining: Math.max(0, 30 - daysSinceReceipt),
      }
    })

    return {
      invoices: results,
      overdueCount: results.filter(r => r.isOverdue).length,
      approachingDeadlineCount: results.filter(r => !r.isOverdue && r.daysRemaining <= 5).length,
    }
  }),
})
