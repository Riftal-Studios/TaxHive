import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { Decimal } from '@prisma/client/runtime/library'
import { generateAdvanceReceiptPDF } from '@/lib/pdf/advance-receipt-generator'
import { uploadPDF } from '@/lib/pdf-uploader'

// Input schemas
const createAdvanceReceiptSchema = z.object({
  clientId: z.string(),
  receiptDate: z.date(),
  
  // Amount Details
  currency: z.string().default('USD'),
  amount: z.number().positive(),
  exchangeRate: z.number().positive().default(1),
  
  // Payment Details
  paymentMode: z.enum(['WIRE', 'CHEQUE', 'UPI', 'CASH']),
  bankReference: z.string().optional(),
  bankName: z.string().optional(),
  chequeNumber: z.string().optional(),
  chequeDate: z.date().optional(),
  
  // GST (rarely applicable for exports)
  isGSTApplicable: z.boolean().default(false),
  gstRate: z.number().min(0).max(28).optional(),
  
  // Notes
  notes: z.string().optional(),
})

const adjustAdvanceSchema = z.object({
  advanceReceiptId: z.string(),
  invoiceId: z.string(),
  adjustmentAmount: z.number().positive().optional(), // If not provided, adjusts maximum possible
  remarks: z.string().optional(),
})

const processRefundSchema = z.object({
  advanceReceiptId: z.string(),
  refundAmount: z.number().positive(),
  refundMode: z.enum(['WIRE', 'CHEQUE', 'UPI', 'CASH']),
  bankReference: z.string().optional(),
  reason: z.string(),
  approvedBy: z.string().optional(),
})

export const advanceReceiptsRouter = createTRPCRouter({
  // Create advance receipt
  createAdvanceReceipt: protectedProcedure
    .input(createAdvanceReceiptSchema)
    .mutation(async ({ ctx, input }) => {
      // Generate receipt number
      const financialYear = getFinancialYear(input.receiptDate)
      const lastReceipt = await ctx.prisma.advanceReceipt.findFirst({
        where: {
          userId: ctx.session.user.id,
          receiptNumber: {
            startsWith: `ADV-${financialYear}`,
          },
        },
        orderBy: {
          receiptNumber: 'desc',
        },
      })
      
      let sequenceNumber = 1
      if (lastReceipt) {
        const lastSequence = parseInt(lastReceipt.receiptNumber.split('/')[1] || '0')
        sequenceNumber = lastSequence + 1
      }
      
      const receiptNumber = `ADV-${financialYear}/${sequenceNumber.toString().padStart(4, '0')}`
      
      // Calculate INR amount
      const amountINR = input.amount * input.exchangeRate
      
      // Calculate GST if applicable
      let cgstAmount = 0
      let sgstAmount = 0
      let igstAmount = 0
      
      if (input.isGSTApplicable && input.gstRate) {
        // For exports under LUT, GST is typically not applicable
        // But if it is (rare cases), calculate it
        const gstAmount = (amountINR * input.gstRate) / 100
        
        // Determine if IGST or CGST/SGST based on client location
        const client = await ctx.prisma.client.findUnique({
          where: { id: input.clientId },
        })
        
        if (!client) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Client not found',
          })
        }
        
        // For exports, it's always IGST (if applicable)
        if (client.country !== 'India') {
          igstAmount = gstAmount
        } else {
          // For domestic, split between CGST and SGST
          cgstAmount = gstAmount / 2
          sgstAmount = gstAmount / 2
        }
      }
      
      // Create the advance receipt
      const advanceReceipt = await ctx.prisma.advanceReceipt.create({
        data: {
          userId: ctx.session.user.id,
          receiptNumber,
          receiptDate: input.receiptDate,
          clientId: input.clientId,
          currency: input.currency,
          amount: new Decimal(input.amount),
          exchangeRate: new Decimal(input.exchangeRate),
          amountINR: new Decimal(amountINR),
          paymentMode: input.paymentMode,
          bankReference: input.bankReference,
          bankName: input.bankName,
          chequeNumber: input.chequeNumber,
          chequeDate: input.chequeDate,
          isGSTApplicable: input.isGSTApplicable,
          gstRate: input.gstRate ? new Decimal(input.gstRate) : null,
          cgstAmount: cgstAmount > 0 ? new Decimal(cgstAmount) : null,
          sgstAmount: sgstAmount > 0 ? new Decimal(sgstAmount) : null,
          igstAmount: igstAmount > 0 ? new Decimal(igstAmount) : null,
          adjustedAmount: new Decimal(0),
          unadjustedAmount: new Decimal(input.amount),
          status: 'RECEIVED',
          notes: input.notes,
        },
        include: {
          client: true,
        },
      })
      
      return advanceReceipt
    }),
  
  // Get all advance receipts
  getAdvanceReceipts: protectedProcedure
    .input(z.object({
      clientId: z.string().optional(),
      status: z.enum(['RECEIVED', 'PARTIALLY_ADJUSTED', 'FULLY_ADJUSTED', 'REFUNDED']).optional(),
      onlyUnadjusted: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {
        userId: ctx.session.user.id,
      }
      
      if (input?.clientId) {
        where.clientId = input.clientId
      }
      
      if (input?.status) {
        where.status = input.status
      }
      
      if (input?.onlyUnadjusted) {
        where.unadjustedAmount = {
          gt: 0,
        }
      }
      
      return ctx.prisma.advanceReceipt.findMany({
        where,
        include: {
          client: true,
          adjustments: {
            include: {
              invoice: true,
            },
          },
          refunds: true,
        },
        orderBy: {
          receiptDate: 'desc',
        },
      })
    }),
  
  // Get single advance receipt
  getAdvanceReceiptById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const receipt = await ctx.prisma.advanceReceipt.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          client: true,
          adjustments: {
            include: {
              invoice: {
                include: {
                  client: true,
                },
              },
            },
            orderBy: {
              adjustmentDate: 'desc',
            },
          },
          refunds: {
            orderBy: {
              refundDate: 'desc',
            },
          },
        },
      })
      
      if (!receipt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Advance receipt not found',
        })
      }
      
      return receipt
    }),
  
  // Adjust advance against invoice
  adjustAdvanceToInvoice: protectedProcedure
    .input(adjustAdvanceSchema)
    .mutation(async ({ ctx, input }) => {
      // Get advance receipt
      const advanceReceipt = await ctx.prisma.advanceReceipt.findFirst({
        where: {
          id: input.advanceReceiptId,
          userId: ctx.session.user.id,
        },
      })
      
      if (!advanceReceipt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Advance receipt not found',
        })
      }
      
      // Check if advance has unadjusted amount
      if (advanceReceipt.unadjustedAmount.toNumber() <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No unadjusted amount available in this advance receipt',
        })
      }
      
      // Get invoice
      const invoice = await ctx.prisma.invoice.findFirst({
        where: {
          id: input.invoiceId,
          userId: ctx.session.user.id,
        },
      })
      
      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }
      
      // Check if invoice has balance due
      if (invoice.balanceDue.toNumber() <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invoice is already fully paid',
        })
      }
      
      // Calculate adjustment amount
      const availableAmount = advanceReceipt.unadjustedAmount.toNumber()
      const invoiceBalance = invoice.balanceDue.toNumber()
      const adjustmentAmount = input.adjustmentAmount 
        ? Math.min(input.adjustmentAmount, availableAmount, invoiceBalance)
        : Math.min(availableAmount, invoiceBalance)
      
      // Create adjustment
      const adjustment = await ctx.prisma.advanceAdjustment.create({
        data: {
          advanceReceiptId: input.advanceReceiptId,
          invoiceId: input.invoiceId,
          adjustmentDate: new Date(),
          adjustedAmount: new Decimal(adjustmentAmount),
          gstAdjusted: advanceReceipt.isGSTApplicable 
            ? new Decimal((adjustmentAmount * (advanceReceipt.gstRate?.toNumber() || 0)) / 100)
            : null,
          remarks: input.remarks,
        },
      })
      
      // Update advance receipt
      const newAdjustedAmount = advanceReceipt.adjustedAmount.toNumber() + adjustmentAmount
      const newUnadjustedAmount = advanceReceipt.unadjustedAmount.toNumber() - adjustmentAmount
      
      await ctx.prisma.advanceReceipt.update({
        where: { id: input.advanceReceiptId },
        data: {
          adjustedAmount: new Decimal(newAdjustedAmount),
          unadjustedAmount: new Decimal(newUnadjustedAmount),
          status: newUnadjustedAmount === 0 ? 'FULLY_ADJUSTED' : 'PARTIALLY_ADJUSTED',
        },
      })
      
      // Update invoice
      const newAdvanceAdjusted = invoice.advanceAdjusted.toNumber() + adjustmentAmount
      const newBalanceDue = invoice.balanceDue.toNumber() - adjustmentAmount
      const newAmountPaid = invoice.amountPaid.toNumber() + adjustmentAmount
      
      await ctx.prisma.invoice.update({
        where: { id: input.invoiceId },
        data: {
          advanceAdjusted: new Decimal(newAdvanceAdjusted),
          balanceDue: new Decimal(newBalanceDue),
          amountPaid: new Decimal(newAmountPaid),
          paymentStatus: newBalanceDue === 0 ? 'PAID' : 'PARTIALLY_PAID',
        },
      })
      
      return adjustment
    }),
  
  // Auto-adjust advances for a client
  autoAdjustAdvances: protectedProcedure
    .input(z.object({
      clientId: z.string(),
      method: z.enum(['FIFO', 'LIFO']).default('FIFO'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get all unadjusted advances for the client
      const advances = await ctx.prisma.advanceReceipt.findMany({
        where: {
          userId: ctx.session.user.id,
          clientId: input.clientId,
          unadjustedAmount: {
            gt: 0,
          },
        },
        orderBy: {
          receiptDate: input.method === 'FIFO' ? 'asc' : 'desc',
        },
      })
      
      if (advances.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No unadjusted advances found for this client',
        })
      }
      
      // Get unpaid invoices for the client
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          clientId: input.clientId,
          balanceDue: {
            gt: 0,
          },
        },
        orderBy: {
          invoiceDate: 'asc', // Always adjust oldest invoices first
        },
      })
      
      if (invoices.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No unpaid invoices found for this client',
        })
      }
      
      const adjustments = []
      
      // Process adjustments
      for (const advance of advances) {
        let remainingAdvance = advance.unadjustedAmount.toNumber()
        
        for (const invoice of invoices) {
          if (remainingAdvance <= 0) break
          
          const invoiceBalance = invoice.balanceDue.toNumber()
          if (invoiceBalance <= 0) continue
          
          const adjustmentAmount = Math.min(remainingAdvance, invoiceBalance)
          
          // Create adjustment
          const adjustment = await ctx.prisma.advanceAdjustment.create({
            data: {
              advanceReceiptId: advance.id,
              invoiceId: invoice.id,
              adjustmentDate: new Date(),
              adjustedAmount: new Decimal(adjustmentAmount),
              remarks: `Auto-adjusted using ${input.method} method`,
            },
          })
          
          adjustments.push(adjustment)
          
          // Update advance
          remainingAdvance -= adjustmentAmount
          await ctx.prisma.advanceReceipt.update({
            where: { id: advance.id },
            data: {
              adjustedAmount: {
                increment: adjustmentAmount,
              },
              unadjustedAmount: {
                decrement: adjustmentAmount,
              },
              status: remainingAdvance === 0 ? 'FULLY_ADJUSTED' : 'PARTIALLY_ADJUSTED',
            },
          })
          
          // Update invoice
          const newBalance = invoiceBalance - adjustmentAmount
          await ctx.prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              advanceAdjusted: {
                increment: adjustmentAmount,
              },
              balanceDue: {
                decrement: adjustmentAmount,
              },
              amountPaid: {
                increment: adjustmentAmount,
              },
              paymentStatus: newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID',
            },
          })
          
          // Update invoice balance for next iteration
          invoice.balanceDue = new Decimal(newBalance)
        }
      }
      
      return {
        adjustmentsCreated: adjustments.length,
        adjustments,
      }
    }),
  
  // Process refund
  processRefund: protectedProcedure
    .input(processRefundSchema)
    .mutation(async ({ ctx, input }) => {
      // Get advance receipt
      const advanceReceipt = await ctx.prisma.advanceReceipt.findFirst({
        where: {
          id: input.advanceReceiptId,
          userId: ctx.session.user.id,
        },
      })
      
      if (!advanceReceipt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Advance receipt not found',
        })
      }
      
      // Check if advance has unadjusted amount
      if (advanceReceipt.unadjustedAmount.toNumber() < input.refundAmount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Refund amount exceeds unadjusted amount',
        })
      }
      
      // Generate refund number
      const lastRefund = await ctx.prisma.advanceRefund.findFirst({
        orderBy: {
          refundNumber: 'desc',
        },
      })
      
      let refundNumber = 'REF-001'
      if (lastRefund) {
        const lastSequence = parseInt(lastRefund.refundNumber.split('-')[1] || '0')
        refundNumber = `REF-${(lastSequence + 1).toString().padStart(3, '0')}`
      }
      
      // Create refund
      const refund = await ctx.prisma.advanceRefund.create({
        data: {
          advanceReceiptId: input.advanceReceiptId,
          refundNumber,
          refundDate: new Date(),
          refundAmount: new Decimal(input.refundAmount),
          refundMode: input.refundMode,
          bankReference: input.bankReference,
          gstRefunded: advanceReceipt.isGSTApplicable
            ? new Decimal((input.refundAmount * (advanceReceipt.gstRate?.toNumber() || 0)) / 100)
            : null,
          reason: input.reason,
          approvedBy: input.approvedBy,
        },
      })
      
      // Update advance receipt
      const newUnadjustedAmount = advanceReceipt.unadjustedAmount.toNumber() - input.refundAmount
      const isFullyRefunded = newUnadjustedAmount === 0 && advanceReceipt.adjustedAmount.toNumber() === 0
      
      await ctx.prisma.advanceReceipt.update({
        where: { id: input.advanceReceiptId },
        data: {
          unadjustedAmount: new Decimal(newUnadjustedAmount),
          status: isFullyRefunded ? 'REFUNDED' : advanceReceipt.status,
        },
      })
      
      return refund
    }),
  
  // Get client advance statement
  getClientAdvanceStatement: protectedProcedure
    .input(z.object({
      clientId: z.string(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        userId: ctx.session.user.id,
        clientId: input.clientId,
      }
      
      if (input.startDate || input.endDate) {
        where.receiptDate = {}
        if (input.startDate) {
          where.receiptDate.gte = input.startDate
        }
        if (input.endDate) {
          where.receiptDate.lte = input.endDate
        }
      }
      
      const advances = await ctx.prisma.advanceReceipt.findMany({
        where,
        include: {
          adjustments: {
            include: {
              invoice: true,
            },
          },
          refunds: true,
        },
        orderBy: {
          receiptDate: 'asc',
        },
      })
      
      // Calculate totals
      const totalReceived = advances.reduce((sum, adv) => sum + adv.amount.toNumber(), 0)
      const totalAdjusted = advances.reduce((sum, adv) => sum + adv.adjustedAmount.toNumber(), 0)
      const totalRefunded = advances.reduce((sum, adv) => 
        sum + adv.refunds.reduce((refSum, ref) => refSum + ref.refundAmount.toNumber(), 0), 0)
      const totalUnadjusted = advances.reduce((sum, adv) => sum + adv.unadjustedAmount.toNumber(), 0)
      
      return {
        advances,
        summary: {
          totalReceived,
          totalAdjusted,
          totalRefunded,
          totalUnadjusted,
          advanceCount: advances.length,
        },
      }
    }),
  
  // Get advance receipt metrics
  getAdvanceMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      const advances = await ctx.prisma.advanceReceipt.findMany({
        where: {
          userId: ctx.session.user.id,
        },
      })
      
      const totalReceived = advances.reduce((sum, adv) => sum + adv.amountINR.toNumber(), 0)
      const totalAdjusted = advances.reduce((sum, adv) => sum + adv.adjustedAmount.toNumber() * adv.exchangeRate.toNumber(), 0)
      const totalUnadjusted = advances.reduce((sum, adv) => sum + adv.unadjustedAmount.toNumber() * adv.exchangeRate.toNumber(), 0)
      
      const byStatus = {
        received: advances.filter(a => a.status === 'RECEIVED').length,
        partiallyAdjusted: advances.filter(a => a.status === 'PARTIALLY_ADJUSTED').length,
        fullyAdjusted: advances.filter(a => a.status === 'FULLY_ADJUSTED').length,
        refunded: advances.filter(a => a.status === 'REFUNDED').length,
      }
      
      // Get aging of unadjusted advances
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      
      const aging = {
        current: advances.filter(a => 
          a.unadjustedAmount.toNumber() > 0 && a.receiptDate > thirtyDaysAgo
        ).reduce((sum, a) => sum + a.unadjustedAmount.toNumber() * a.exchangeRate.toNumber(), 0),
        thirtyDays: advances.filter(a => 
          a.unadjustedAmount.toNumber() > 0 && a.receiptDate <= thirtyDaysAgo && a.receiptDate > sixtyDaysAgo
        ).reduce((sum, a) => sum + a.unadjustedAmount.toNumber() * a.exchangeRate.toNumber(), 0),
        sixtyDays: advances.filter(a => 
          a.unadjustedAmount.toNumber() > 0 && a.receiptDate <= sixtyDaysAgo && a.receiptDate > ninetyDaysAgo
        ).reduce((sum, a) => sum + a.unadjustedAmount.toNumber() * a.exchangeRate.toNumber(), 0),
        ninetyDaysPlus: advances.filter(a => 
          a.unadjustedAmount.toNumber() > 0 && a.receiptDate <= ninetyDaysAgo
        ).reduce((sum, a) => sum + a.unadjustedAmount.toNumber() * a.exchangeRate.toNumber(), 0),
      }
      
      return {
        totalReceived,
        totalAdjusted,
        totalUnadjusted,
        byStatus,
        aging,
        totalReceipts: advances.length,
      }
    }),
  
  // Generate PDF for advance receipt
  generatePDF: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get receipt with relations
      const receipt = await ctx.prisma.advanceReceipt.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          client: true,
        },
      })
      
      if (!receipt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Advance receipt not found',
        })
      }
      
      // Get user details
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      })
      
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        })
      }
      
      try {
        // Generate PDF
        const pdfBuffer = await generateAdvanceReceiptPDF(receipt, user)
        
        // Upload PDF
        const filename = `advance-receipts/${receipt.receiptNumber.replace(/\//g, '-')}.pdf`
        const pdfUrl = await uploadPDF(pdfBuffer, filename)
        
        // Update receipt with PDF URL
        await ctx.prisma.advanceReceipt.update({
          where: { id: input.id },
          data: {
            receiptPDF: pdfUrl,
          },
        })
        
        return {
          pdfUrl,
          success: true,
        }
      } catch (error) {
        console.error('PDF generation error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate PDF',
        })
      }
    }),
})

// Helper function to get financial year
function getFinancialYear(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth()
  
  if (month >= 3) {
    // April to March
    return `FY${year.toString().slice(2)}-${(year + 1).toString().slice(2)}`
  } else {
    // January to March
    return `FY${(year - 1).toString().slice(2)}-${year.toString().slice(2)}`
  }
}