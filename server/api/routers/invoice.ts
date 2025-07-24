import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { 
  generateInvoiceNumber, 
  getCurrentFiscalYear, 
  calculateSubtotal, 
  calculateGST, 
  calculateTotal, 
  validateHSNCode 
} from '@/lib/invoice-utils'
import { generateInvoicePDF } from '@/lib/pdf-generator'
import { BullMQService } from '@/lib/queue/bullmq.service'
import { GST_CONSTANTS } from '@/lib/constants'
import { validateGSTInvoice, exportHsnSacCodeSchema } from '@/lib/validations/gst'

// Initialize queue service (in production, this would be injected via dependency injection)
const queueService = new BullMQService({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
})

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  sacCode: exportHsnSacCodeSchema,
})

export const invoiceRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        lutId: z.string().optional(),
        issueDate: z.date(),
        dueDate: z.date(),
        currency: z.string().default('USD'),
        exchangeRate: z.number(),
        exchangeRateSource: z.string(),
        paymentTerms: z.number().optional(),
        bankDetails: z.string().optional(),
        notes: z.string().optional(),
        lineItems: z.array(lineItemSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.prisma
      const userId = ctx.session.user.id
      
      // Use transaction for atomicity
      return await db.$transaction(async (tx) => {
        // Get the current fiscal year
        const currentFY = getCurrentFiscalYear(input.issueDate)
        
        // Get the next invoice number
        const invoiceCount = await tx.invoice.count({
          where: {
            userId,
            invoiceNumber: {
              startsWith: `FY${currentFY.slice(2, 5)}-${currentFY.slice(-2)}/`,
            },
          },
        })
        
        const invoiceNumber = generateInvoiceNumber(currentFY, invoiceCount + 1)
        
        // Calculate totals
        const subtotal = calculateSubtotal(input.lineItems)
        const gstAmount = 0 // Always 0 for exports under LUT
        const totalAmount = calculateTotal(subtotal, gstAmount)
        
        // Validate GST compliance
        const gstValidation = validateGSTInvoice({
          placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
          serviceCode: input.lineItems[0].sacCode,
          igstRate: 0,
          lutId: input.lutId,
          currency: input.currency,
          exchangeRate: input.exchangeRate,
          exchangeSource: input.exchangeRateSource,
        })
        
        if (!gstValidation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `GST validation failed: ${gstValidation.errors.join(', ')}`,
          })
        }
        
        // Create invoice
        const invoice = await tx.invoice.create({
          data: {
            userId,
            clientId: input.clientId,
            lutId: input.lutId,
            invoiceNumber,
            invoiceDate: input.issueDate,
            dueDate: input.dueDate,
            currency: input.currency,
            exchangeRate: input.exchangeRate,
            exchangeSource: input.exchangeRateSource,
            subtotal,
            igstRate: 0,
            igstAmount: gstAmount,
            totalAmount,
            totalInINR: totalAmount * input.exchangeRate,
            status: 'DRAFT',
            placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
            serviceCode: input.lineItems[0].sacCode,
            paymentTerms: input.paymentTerms?.toString(),
            bankDetails: input.bankDetails,
            notes: input.notes,
          },
        })
        
        // Create line items
        await tx.invoiceItem.createMany({
          data: input.lineItems.map((item) => ({
            invoiceId: invoice.id,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.quantity * item.rate,
            serviceCode: item.sacCode,
          })),
        })
        
        return invoice
      })
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.invoice.findMany({
      where: { userId: ctx.session.user.id },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    })
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          client: true,
          lineItems: true,
          lut: true,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      return invoice
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        clientId: z.string().optional(),
        lutId: z.string().optional(),
        issueDate: z.date().optional(),
        dueDate: z.date().optional(),
        currency: z.string().optional(),
        exchangeRate: z.number().optional(),
        exchangeRateSource: z.string().optional(),
        paymentTerms: z.number().optional(),
        bankDetails: z.string().optional(),
        notes: z.string().optional(),
        lineItems: z.array(lineItemSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, lineItems, ...updateData } = input
      const db = ctx.prisma
      const userId = ctx.session.user.id
      
      return await db.$transaction(async (tx) => {
        // Build update data with proper relation handling
        const data: Record<string, unknown> = {}
        
        // Handle direct fields
        if (updateData.issueDate !== undefined) data.invoiceDate = updateData.issueDate
        if (updateData.dueDate !== undefined) data.dueDate = updateData.dueDate
        if (updateData.currency !== undefined) data.currency = updateData.currency
        if (updateData.exchangeRate !== undefined) data.exchangeRate = updateData.exchangeRate
        if (updateData.exchangeRateSource !== undefined) data.exchangeSource = updateData.exchangeRateSource
        if (updateData.paymentTerms !== undefined) data.paymentTerms = updateData.paymentTerms?.toString()
        if (updateData.bankDetails !== undefined) data.bankDetails = updateData.bankDetails
        if (updateData.notes !== undefined) data.notes = updateData.notes
        
        // Handle relations
        if (updateData.clientId !== undefined) {
          data.client = { connect: { id: updateData.clientId } }
        }
        if (updateData.lutId !== undefined) {
          data.lut = updateData.lutId ? { connect: { id: updateData.lutId } } : { disconnect: true }
        }
        
        // Update invoice
        const invoice = await tx.invoice.update({
          where: { id, userId },
          data,
        })
        
        // Update line items if provided
        if (lineItems) {
          // Delete existing line items
          await tx.invoiceItem.deleteMany({
            where: { invoiceId: id },
          })
          
          // Create new line items
          await tx.invoiceItem.createMany({
            data: lineItems.map((item) => ({
              invoiceId: id,
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.quantity * item.rate,
              serviceCode: item.sacCode,
            })),
          })
          
          // Update invoice totals
          const subtotal = calculateSubtotal(lineItems)
          const totalAmount = calculateTotal(subtotal, 0)
          
          // Get the current invoice to get the exchange rate
          const currentInvoice = await tx.invoice.findUnique({
            where: { id },
          })
          
          const exchangeRate = updateData.exchangeRate || Number(currentInvoice?.exchangeRate || 1)
          
          await tx.invoice.update({
            where: { id },
            data: {
              subtotal,
              totalAmount,
              totalInINR: totalAmount * exchangeRate,
            },
          })
        }
        
        return invoice
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.invoice.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      })
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.invoice.update({
        where: { id: input.id, userId: ctx.session.user.id },
        data: { status: input.status },
      })
    }),

  getNextInvoiceNumber: protectedProcedure
    .query(async ({ ctx }) => {
      const currentFY = getCurrentFiscalYear()
      const count = await ctx.prisma.invoice.count({
        where: {
          userId: ctx.session.user.id,
          invoiceNumber: {
            startsWith: `FY${currentFY.slice(2, 5)}-${currentFY.slice(-2)}/`,
          },
        },
      })
      
      return generateInvoiceNumber(currentFY, count + 1)
    }),

  generatePDF: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get invoice with all relations
      const invoice = await ctx.prisma.invoice.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          client: true,
          lineItems: true,
          lut: true,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      // Get user details
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      })

      if (!user) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'User not found',
        })
      }

      try {
        const pdfBuffer = await generateInvoicePDF(invoice, user)
        
        // Convert buffer to base64 for transmission
        const pdfBase64 = pdfBuffer.toString('base64')
        
        return {
          success: true,
          pdf: pdfBase64,
          filename: `invoice-${invoice.invoiceNumber.replace('/', '-')}.pdf`,
        }
      } catch (error) {
        console.error('PDF generation error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate PDF',
        })
      }
    }),

  // Queue-based PDF generation
  queuePDFGeneration: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify invoice exists and belongs to user
      const invoice = await ctx.prisma.invoice.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      try {
        // Enqueue PDF generation job
        const job = await queueService.enqueueJob('PDF_GENERATION', {
          invoiceId: input.id,
          userId: ctx.session.user.id,
        })

        return {
          success: true,
          jobId: job.id,
          message: 'PDF generation queued successfully',
        }
      } catch (error) {
        console.error('Failed to queue PDF generation:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to queue PDF generation',
        })
      }
    }),

  // Check PDF generation status
  getPDFGenerationStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      try {
        const job = await queueService.getJob(input.jobId)

        if (!job) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Job not found',
          })
        }

        // Map job status to response
        if (job.status === 'completed' && job.result) {
          return {
            jobId: job.id,
            status: 'completed',
            pdfUrl: (job.result as { pdfUrl: string }).pdfUrl,
          }
        } else if (job.status === 'failed') {
          return {
            jobId: job.id,
            status: 'failed',
            error: job.error || 'PDF generation failed',
          }
        } else {
          return {
            jobId: job.id,
            status: job.status,
            progress: job.progress,
          }
        }
      } catch (error) {
        console.error('Failed to get job status:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get job status',
        })
      }
    }),

  // Get current exchange rate for a currency
  getCurrentExchangeRate: protectedProcedure
    .input(z.object({
      currency: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // First check if we have today's rate
      const exchangeRate = await ctx.prisma.exchangeRate.findFirst({
        where: {
          currency: input.currency,
          date: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      
      if (exchangeRate) {
        return {
          rate: Number(exchangeRate.rate),
          source: exchangeRate.source,
          date: exchangeRate.date,
        }
      }
      
      // If no rate found for today, get the most recent rate
      const latestRate = await ctx.prisma.exchangeRate.findFirst({
        where: {
          currency: input.currency,
        },
        orderBy: {
          date: 'desc',
        },
      })
      
      if (latestRate) {
        return {
          rate: Number(latestRate.rate),
          source: latestRate.source,
          date: latestRate.date,
        }
      }
      
      // No rates found - return null to indicate manual entry needed
      return null
    }),

  // Send invoice email
  sendInvoiceEmail: protectedProcedure
    .input(z.object({
      id: z.string(),
      to: z.string().email(),
      cc: z.string().email().optional(),
      bcc: z.string().email().optional(),
      customMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify invoice ownership
      const invoice = await ctx.prisma.invoice.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          client: true,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      // Queue email notification
      const job = await queueService.enqueueJob('EMAIL_NOTIFICATION', {
        type: 'invoice',
        to: input.to || invoice.client.email,
        cc: input.cc,
        bcc: input.bcc,
        invoiceId: invoice.id,
        customMessage: input.customMessage,
        userId: ctx.session.user.id,
      })

      // Update invoice status to SENT if it's a DRAFT
      if (invoice.status === 'DRAFT') {
        await ctx.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'SENT' },
        })
      }

      return {
        success: true,
        jobId: job.id,
      }
    }),

  // Send payment reminder
  sendPaymentReminder: protectedProcedure
    .input(z.object({
      id: z.string(),
      to: z.string().email().optional(),
      cc: z.string().email().optional(),
      bcc: z.string().email().optional(),
      customMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify invoice ownership
      const invoice = await ctx.prisma.invoice.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          client: true,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      // Queue payment reminder email
      const job = await queueService.enqueueJob('EMAIL_NOTIFICATION', {
        type: 'payment-reminder',
        to: input.to || invoice.client.email,
        cc: input.cc,
        bcc: input.bcc,
        invoiceId: invoice.id,
        customMessage: input.customMessage,
        userId: ctx.session.user.id,
      })

      return {
        success: true,
        jobId: job.id,
      }
    }),

  // Get email history for an invoice
  getEmailHistory: protectedProcedure
    .input(z.object({
      invoiceId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const emails = await ctx.prisma.emailHistory.findMany({
        where: {
          invoiceId: input.invoiceId,
          userId: ctx.session.user.id,
        },
        orderBy: {
          sentAt: 'desc',
        },
      })

      return emails
    }),

  // Get email send status
  getEmailStatus: protectedProcedure
    .input(z.object({
      jobId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const job = await queueService.getJob(input.jobId)
      
      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Job not found',
        })
      }

      return {
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
      }
    }),
})