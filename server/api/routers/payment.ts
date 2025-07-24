import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { Decimal } from '@prisma/client/runtime/library'

const PaymentInputSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(), // Amount client sent (Y)
  currency: z.string().min(3).max(3),
  paymentDate: z.date(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'PAYPAL', 'PAYONEER', 'WISE', 'OTHER']),
  reference: z.string().optional(),
  notes: z.string().optional(),
  // Payment flow details
  amountReceivedBeforeFees: z.number().positive().optional(), // Amount before fees (Z)
  platformFeesInCurrency: z.number().min(0).optional(), // Platform fees (Y - Z)
  // Bank credit details
  creditedAmount: z.number().positive().optional(),
  actualExchangeRate: z.number().positive().optional(),
  bankChargesInr: z.number().min(0).optional(),
  fircNumber: z.string().optional(),
  fircDate: z.date().optional(),
  fircDocumentUrl: z.string().url().optional(),
})

export const paymentRouter = createTRPCRouter({
  // Record a new payment
  create: protectedProcedure
    .input(PaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { prisma, session } = ctx
      const userId = session.user.id

      // Fetch invoice to validate and update payment status
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: input.invoiceId,
          userId,
        },
        include: {
          payments: true,
        }
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      // Check if payment would exceed invoice amount
      const totalPaid = invoice.payments.reduce(
        (sum, payment) => sum.add(payment.amount),
        new Decimal(0)
      )
      const newTotalPaid = totalPaid.add(new Decimal(input.amount))

      if (newTotalPaid.greaterThan(invoice.totalAmount)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Payment amount would exceed invoice total',
        })
      }

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          invoiceId: input.invoiceId,
          amount: new Decimal(input.amount),
          currency: input.currency,
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod,
          reference: input.reference,
          notes: input.notes,
          amountReceivedBeforeFees: input.amountReceivedBeforeFees ? new Decimal(input.amountReceivedBeforeFees) : null,
          platformFeesInCurrency: input.platformFeesInCurrency ? new Decimal(input.platformFeesInCurrency) : null,
          creditedAmount: input.creditedAmount ? new Decimal(input.creditedAmount) : null,
          actualExchangeRate: input.actualExchangeRate ? new Decimal(input.actualExchangeRate) : null,
          bankChargesInr: input.bankChargesInr ? new Decimal(input.bankChargesInr) : null,
          fircNumber: input.fircNumber,
          fircDate: input.fircDate,
          fircDocumentUrl: input.fircDocumentUrl,
        },
      })

      // Update invoice payment status and amounts
      const amountPaid = newTotalPaid
      const balanceDue = new Decimal(invoice.totalAmount).minus(amountPaid)
      
      let paymentStatus: string
      if (balanceDue.equals(0)) {
        paymentStatus = 'PAID'
      } else if (amountPaid.greaterThan(0)) {
        paymentStatus = 'PARTIALLY_PAID'
      } else {
        paymentStatus = 'UNPAID'
      }

      // Also update invoice status if fully paid
      const invoiceStatus = paymentStatus === 'PAID' ? 'PAID' : invoice.status

      await prisma.invoice.update({
        where: { id: input.invoiceId },
        data: {
          paymentStatus,
          amountPaid,
          balanceDue,
          status: invoiceStatus,
        },
      })

      return payment
    }),

  // Get all payments for an invoice
  getByInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { prisma, session } = ctx
      const userId = session.user.id

      // Verify invoice belongs to user
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: input.invoiceId,
          userId,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      const payments = await prisma.payment.findMany({
        where: { invoiceId: input.invoiceId },
        orderBy: { paymentDate: 'desc' },
      })

      return payments
    }),

  // Get payment history for a user
  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        cursor: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        clientId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { prisma, session } = ctx
      const userId = session.user.id
      const limit = input.limit ?? 50

      const where: any = {
        invoice: {
          userId,
        },
      }

      if (input.clientId) {
        where.invoice.clientId = input.clientId
      }

      if (input.dateFrom || input.dateTo) {
        where.paymentDate = {}
        if (input.dateFrom) {
          where.paymentDate.gte = input.dateFrom
        }
        if (input.dateTo) {
          where.paymentDate.lte = input.dateTo
        }
      }

      const payments = await prisma.payment.findMany({
        take: limit + 1,
        where,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { paymentDate: 'desc' },
        include: {
          invoice: {
            include: {
              client: true,
            },
          },
        },
      })

      let nextCursor: typeof input.cursor | undefined = undefined
      if (payments.length > limit) {
        const nextItem = payments.pop()
        nextCursor = nextItem!.id
      }

      return {
        items: payments,
        nextCursor,
      }
    }),

  // Update a payment
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        amount: z.number().positive().optional(),
        paymentDate: z.date().optional(),
        paymentMethod: z.enum(['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'PAYPAL', 'PAYONEER', 'WISE', 'OTHER']).optional(),
        reference: z.string().optional(),
        notes: z.string().optional(),
        // Payment flow details
        amountReceivedBeforeFees: z.number().positive().optional(),
        platformFeesInCurrency: z.number().min(0).optional(),
        // Bank credit details
        creditedAmount: z.number().positive().optional(),
        actualExchangeRate: z.number().positive().optional(),
        bankChargesInr: z.number().min(0).optional(),
        fircNumber: z.string().optional(),
        fircDate: z.date().optional(),
        fircDocumentUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma, session } = ctx
      const userId = session.user.id

      // Verify payment belongs to user's invoice
      const payment = await prisma.payment.findFirst({
        where: {
          id: input.id,
          invoice: {
            userId,
          },
        },
        include: {
          invoice: {
            include: {
              payments: true,
            },
          },
        },
      })

      if (!payment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment not found',
        })
      }

      // If amount is being updated, recalculate invoice totals
      if (input.amount !== undefined && input.amount !== Number(payment.amount)) {
        const otherPayments = payment.invoice.payments.filter(p => p.id !== payment.id)
        const otherPaymentsTotal = otherPayments.reduce(
          (sum, p) => sum.add(p.amount),
          new Decimal(0)
        )
        const newTotalPaid = otherPaymentsTotal.add(new Decimal(input.amount))

        if (newTotalPaid.greaterThan(payment.invoice.totalAmount)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Updated payment amount would exceed invoice total',
          })
        }

        // Update payment
        const updatedPayment = await prisma.payment.update({
          where: { id: input.id },
          data: {
            amount: input.amount !== undefined ? new Decimal(input.amount) : undefined,
            paymentDate: input.paymentDate,
            paymentMethod: input.paymentMethod,
            reference: input.reference,
            notes: input.notes,
            amountReceivedBeforeFees: input.amountReceivedBeforeFees !== undefined ? new Decimal(input.amountReceivedBeforeFees) : undefined,
            platformFeesInCurrency: input.platformFeesInCurrency !== undefined ? new Decimal(input.platformFeesInCurrency) : undefined,
            creditedAmount: input.creditedAmount !== undefined ? new Decimal(input.creditedAmount) : undefined,
            actualExchangeRate: input.actualExchangeRate !== undefined ? new Decimal(input.actualExchangeRate) : undefined,
            bankChargesInr: input.bankChargesInr !== undefined ? new Decimal(input.bankChargesInr) : undefined,
            fircNumber: input.fircNumber,
            fircDate: input.fircDate,
            fircDocumentUrl: input.fircDocumentUrl,
          },
        })

        // Update invoice payment status and amounts
        const amountPaid = newTotalPaid
        const balanceDue = new Decimal(payment.invoice.totalAmount).minus(amountPaid)
        
        let paymentStatus: string
        if (balanceDue.equals(0)) {
          paymentStatus = 'PAID'
        } else if (amountPaid.greaterThan(0)) {
          paymentStatus = 'PARTIALLY_PAID'
        } else {
          paymentStatus = 'UNPAID'
        }

        const invoiceStatus = paymentStatus === 'PAID' ? 'PAID' : payment.invoice.status

        await prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            paymentStatus,
            amountPaid,
            balanceDue,
            status: invoiceStatus,
          },
        })

        return updatedPayment
      }

      // Update payment without amount change
      const updatedPayment = await prisma.payment.update({
        where: { id: input.id },
        data: {
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod,
          reference: input.reference,
          notes: input.notes,
          amountReceivedBeforeFees: input.amountReceivedBeforeFees !== undefined ? new Decimal(input.amountReceivedBeforeFees) : undefined,
          platformFeesInCurrency: input.platformFeesInCurrency !== undefined ? new Decimal(input.platformFeesInCurrency) : undefined,
          creditedAmount: input.creditedAmount !== undefined ? new Decimal(input.creditedAmount) : undefined,
          actualExchangeRate: input.actualExchangeRate !== undefined ? new Decimal(input.actualExchangeRate) : undefined,
          bankChargesInr: input.bankChargesInr !== undefined ? new Decimal(input.bankChargesInr) : undefined,
          fircNumber: input.fircNumber,
          fircDate: input.fircDate,
          fircDocumentUrl: input.fircDocumentUrl,
        },
      })

      return updatedPayment
    }),

  // Delete a payment
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { prisma, session } = ctx
      const userId = session.user.id

      // Verify payment belongs to user's invoice
      const payment = await prisma.payment.findFirst({
        where: {
          id: input.id,
          invoice: {
            userId,
          },
        },
        include: {
          invoice: {
            include: {
              payments: true,
            },
          },
        },
      })

      if (!payment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment not found',
        })
      }

      // Delete payment
      await prisma.payment.delete({
        where: { id: input.id },
      })

      // Recalculate invoice payment status and amounts
      const remainingPayments = payment.invoice.payments.filter(p => p.id !== payment.id)
      const amountPaid = remainingPayments.reduce(
        (sum, p) => sum.add(p.amount),
        new Decimal(0)
      )
      const balanceDue = new Decimal(payment.invoice.totalAmount).minus(amountPaid)
      
      let paymentStatus: string
      if (balanceDue.equals(0)) {
        paymentStatus = 'PAID'
      } else if (amountPaid.greaterThan(0)) {
        paymentStatus = 'PARTIALLY_PAID'
      } else {
        paymentStatus = 'UNPAID'
      }

      // Update invoice status - if it was PAID and now not fully paid, set back to SENT
      const invoiceStatus = payment.invoice.status === 'PAID' && paymentStatus !== 'PAID' 
        ? 'SENT' 
        : payment.invoice.status

      await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paymentStatus,
          amountPaid,
          balanceDue,
          status: invoiceStatus,
        },
      })

      return { success: true }
    }),

  // Get payment summary statistics
  getSummary: protectedProcedure
    .input(
      z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { prisma, session } = ctx
      const userId = session.user.id

      const dateFilter = {} as any
      if (input.dateFrom) {
        dateFilter.gte = input.dateFrom
      }
      if (input.dateTo) {
        dateFilter.lte = input.dateTo
      }

      // Get all payments for the user
      const payments = await prisma.payment.findMany({
        where: {
          invoice: {
            userId,
          },
          ...(input.dateFrom || input.dateTo ? { paymentDate: dateFilter } : {}),
        },
        include: {
          invoice: true,
        },
      })

      // Calculate summary by currency
      const summaryByCurrency = payments.reduce((acc, payment) => {
        const currency = payment.currency
        if (!acc[currency]) {
          acc[currency] = {
            total: new Decimal(0),
            count: 0,
          }
        }
        acc[currency].total = acc[currency].total.add(payment.amount)
        acc[currency].count += 1
        return acc
      }, {} as Record<string, { total: Decimal; count: number }>)

      // Convert to response format
      const summary = Object.entries(summaryByCurrency).map(([currency, data]) => ({
        currency,
        total: Number(data.total),
        count: data.count,
      }))

      return summary
    }),
})