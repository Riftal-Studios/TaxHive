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
import { generateSecureToken, getTokenExpirationDate } from '@/lib/utils/token'
import { getNextInvoiceSequence } from '@/lib/invoice-number-utils'
import { generateInvoicePDF } from '@/lib/pdf-generator'
import { GST_CONSTANTS } from '@/lib/constants'
import { validateGSTInvoice, exportHsnSacCodeSchema } from '@/lib/validations/gst'
import { queueManager } from '@/lib/queue/manager'
import { JOB_PRIORITIES } from '@/lib/queue/config'
import { db } from '@/lib/prisma'
import type { StateCode } from '@/lib/gst'
import Logger from '@/lib/logger'

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
        
        // Get the next invoice number by finding the highest existing number
        const existingInvoices = await tx.invoice.findMany({
          where: {
            userId,
            invoiceNumber: {
              startsWith: `FY${currentFY.slice(2, 4)}-${currentFY.slice(-2)}/`,
            },
          },
          select: { invoiceNumber: true },
        })
        
        const invoiceNumbers = existingInvoices.map(inv => inv.invoiceNumber)
        const nextSequence = getNextInvoiceSequence(invoiceNumbers)
        const invoiceNumber = generateInvoiceNumber(currentFY, nextSequence)
        
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
        
        // Create invoice with public access token
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
            // Set payment fields for new invoice
            paymentStatus: 'UNPAID',
            amountPaid: 0,
            balanceDue: totalAmount, // Set balance due to total amount for new invoice
            // Generate public access token
            publicAccessToken: generateSecureToken(),
            tokenExpiresAt: getTokenExpirationDate(90), // 90 days expiration
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
        
        // Queue PDF generation for new invoice
        try {
          const job = await queueManager.addPDFGenerationJob(
            {
              type: 'invoice',
              entityId: invoice.id,
              userId: ctx.session.user.id,
              options: {
                sendEmail: false, // Can be configured based on user preferences
                saveToS3: !!process.env.AWS_S3_BUCKET,
              },
            },
            {
              priority: JOB_PRIORITIES.HIGH,
            }
          )
          
          if (job) {
            // Update invoice with job ID and status
            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                pdfStatus: 'generating',
                pdfJobId: job.id,
              }
            })
          } else {
            // Queue service not available, mark as pending
            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                pdfStatus: 'pending',
                pdfError: 'Queue service temporarily unavailable',
              }
            })
          }
        } catch (error) {
          Logger.error('Failed to queue PDF generation for new invoice', { error })
          // Mark as failed but don't fail invoice creation
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              pdfStatus: 'failed',
              pdfError: error instanceof Error ? error.message : 'Failed to queue PDF generation',
            }
          })
        }
        
        // Queue email notification if client has email
        try {
          const client = await tx.client.findUnique({
            where: { id: input.clientId },
            select: { email: true, name: true },
          })
          
          if (client?.email) {
            await queueManager.addEmailNotificationJob(
              {
                type: 'invoice-created',
                to: client.email,
                data: {
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.invoiceNumber,
                  clientName: client.name,
                  totalAmount: totalAmount,
                  currency: input.currency,
                  dueDate: input.dueDate.toISOString(),
                },
                userId: ctx.session.user.id,
              },
              {
                priority: JOB_PRIORITIES.NORMAL,
                delay: 5000, // Delay 5 seconds to ensure PDF is generated
              }
            )
          }
        } catch (error) {
          Logger.error('Failed to queue email notification', { error })
          // Don't fail invoice creation for email issues
        }
        
        return invoice
      })
    }),

  list: protectedProcedure
    .input(z.object({
      clientId: z.string().optional(),
      status: z.enum(['UNPAID', 'PAID', 'PARTIALLY_PAID', 'OVERDUE']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { 
        userId: ctx.session.user.id 
      }
      
      if (input?.clientId) {
        where.clientId = input.clientId
      }
      
      if (input?.status) {
        // Map status to paymentStatus field
        if (input.status === 'UNPAID') {
          where.paymentStatus = 'UNPAID'
        } else if (input.status === 'PAID') {
          where.paymentStatus = 'PAID'
        } else if (input.status === 'PARTIALLY_PAID') {
          where.paymentStatus = 'PARTIAL'
        } else if (input.status === 'OVERDUE') {
          where.AND = [
            { paymentStatus: { not: 'PAID' } },
            { dueDate: { lt: new Date() } }
          ]
        }
      }
      
      return await ctx.prisma.invoice.findMany({
        where,
        include: { client: true },
        orderBy: { createdAt: 'desc' },
      })
    }),

  getById: protectedProcedure
    .input(z.object({ 
      id: z.string(),
      includePayments: z.boolean().optional().default(false)
    }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          client: true,
          lineItems: true,
          lut: true,
          payments: input.includePayments || undefined,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }
      
      // Always recalculate balance to ensure accuracy
      if (invoice.payments) {
        const totalPaid = invoice.payments.reduce((sum, payment) => 
          sum + Number(payment.amount), 0
        )
        const balanceDue = Number(invoice.totalAmount) - totalPaid
        
        // Update if there's a mismatch
        if (Math.abs(Number(invoice.balanceDue) - balanceDue) > 0.01) {
          await ctx.prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: totalPaid,
              balanceDue: balanceDue,
              paymentStatus: balanceDue <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID'
            }
          })
          // Refetch the updated invoice to get correct Decimal types
          return await ctx.prisma.invoice.findUnique({
            where: { id: invoice.id },
            include: {
              client: true,
              lineItems: true,
              lut: true,
              payments: input.includePayments || undefined,
            },
          }) as typeof invoice
        }
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
          
          // Get the current invoice to get the exchange rate and amount paid
          const currentInvoice = await tx.invoice.findUnique({
            where: { id },
          })
          
          const exchangeRate = updateData.exchangeRate || Number(currentInvoice?.exchangeRate || 1)
          const amountPaid = Number(currentInvoice?.amountPaid || 0)
          const balanceDue = totalAmount - amountPaid
          
          await tx.invoice.update({
            where: { id },
            data: {
              subtotal,
              totalAmount,
              totalInINR: totalAmount * exchangeRate,
              balanceDue, // Update balance due based on new total
              serviceCode: lineItems[0].sacCode, // Update service code from first line item
            },
          })
        }
        
        // Queue PDF regeneration after any update
        try {
          const queueService = getQueue()
          if (queueService) {
            const job = await queueService.enqueue('PDF_GENERATION', {
              invoiceId: id,
              userId: ctx.session.user.id,
            })
            
            // Update invoice with job ID and status
            await tx.invoice.update({
              where: { id },
              data: {
                pdfStatus: 'generating',
                pdfJobId: job.id,
                pdfError: null, // Clear any previous error
              }
            })
          } else {
            Logger.warn('Queue service not available for PDF regeneration after update')
          }
        } catch (error) {
          Logger.error('Failed to queue PDF regeneration after update', { error })
          // Mark as failed but don't fail the update
          await tx.invoice.update({
            where: { id },
            data: {
              pdfStatus: 'failed',
              pdfError: error instanceof Error ? error.message : 'Failed to queue PDF regeneration',
            }
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
        status: z.enum(['DRAFT', 'SENT', 'CANCELLED']),
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
      const existingInvoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceNumber: {
            startsWith: `FY${currentFY.slice(2, 4)}-${currentFY.slice(-2)}/`,
          },
        },
        select: { invoiceNumber: true },
      })
      
      const invoiceNumbers = existingInvoices.map(inv => inv.invoiceNumber)
      const nextSequence = getNextInvoiceSequence(invoiceNumbers)
      return generateInvoiceNumber(currentFY, nextSequence)
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
        Logger.error('PDF generation error', { error })
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
        const queueService = getQueue()
        if (!queueService) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Queue service is not available',
          })
        }
        const job = await queueService.enqueue('PDF_GENERATION', {
          invoiceId: input.id,
          userId: ctx.session.user.id,
        })

        return {
          success: true,
          jobId: job.id,
          message: 'PDF generation queued successfully',
        }
      } catch (error) {
        Logger.error('Failed to queue PDF generation', { error })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof TRPCError ? error.message : 'Failed to queue PDF generation',
        })
      }
    }),

  // Check PDF generation status
  getPDFGenerationStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      try {
        const queueService = getQueue()
        if (!queueService) {
          return { status: 'unknown', progress: 0 }
        }
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
        Logger.error('Failed to get job status', { error })
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
      date: z.string().optional(), // Optional date in YYYY-MM-DD format
    }))
    .query(async ({ ctx, input }) => {
      // Use provided date or today
      const targetDate = input.date ? new Date(input.date) : new Date()
      targetDate.setHours(0, 0, 0, 0)
      
      // First check if we have the rate for the target date
      const exchangeRate = await ctx.prisma.exchangeRate.findFirst({
        where: {
          currency: input.currency,
          date: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
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
      
      // If no rate found for target date, get the most recent rate before that date
      const latestRate = await ctx.prisma.exchangeRate.findFirst({
        where: {
          currency: input.currency,
          date: {
            lte: targetDate,
          },
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

      // Get user details for the email
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      })
      
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        })
      }

      // Generate new public access token if not exists or expired
      if (!invoice.publicAccessToken || !invoice.tokenExpiresAt || new Date() > invoice.tokenExpiresAt) {
        await ctx.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            publicAccessToken: generateSecureToken(),
            tokenExpiresAt: getTokenExpirationDate(90), // 90 days expiration
          },
        })
        // Refetch invoice to get updated token
        const updatedInvoice = await ctx.prisma.invoice.findUnique({
          where: { id: invoice.id },
        })
        if (updatedInvoice) {
          invoice.publicAccessToken = updatedInvoice.publicAccessToken
        }
      }
      
      // Queue invoice email
      const queueService = getQueue()
      if (!queueService) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Queue service is not available',
        })
      }
      const job = await queueService.enqueue('EMAIL_NOTIFICATION', {
        to: input.to || invoice.client.email,
        cc: input.cc,
        bcc: input.bcc,
        subject: `Invoice ${invoice.invoiceNumber} from ${user.name || 'Your Service Provider'}`,
        template: 'invoice',
        data: {
          clientName: invoice.client.name,
          senderName: user.name || 'Your Service Provider',
          senderEmail: user.email,
          companyName: user.name,
          companyGSTIN: user.gstin,
          companyAddress: user.address,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
          dueDate: new Date(invoice.dueDate).toLocaleDateString('en-IN'),
          amount: Number(invoice.totalAmount),
          currency: invoice.currency,
          viewUrl: `${process.env.NEXTAUTH_URL}/invoice/${invoice.publicAccessToken}`,
          downloadUrl: `${process.env.NEXTAUTH_URL}/api/invoices/public/${invoice.publicAccessToken}/download`,
          bankDetails: invoice.bankDetails || undefined,
          customMessage: input.customMessage,
        },
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

      // Get user details for the email
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      })
      
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        })
      }
      
      // Generate new public access token if not exists or expired
      if (!invoice.publicAccessToken || !invoice.tokenExpiresAt || new Date() > invoice.tokenExpiresAt) {
        await ctx.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            publicAccessToken: generateSecureToken(),
            tokenExpiresAt: getTokenExpirationDate(90), // 90 days expiration
          },
        })
        // Refetch invoice to get updated token
        const updatedInvoice = await ctx.prisma.invoice.findUnique({
          where: { id: invoice.id },
        })
        if (updatedInvoice) {
          invoice.publicAccessToken = updatedInvoice.publicAccessToken
        }
      }
      
      // Calculate days overdue
      const dueDate = new Date(invoice.dueDate)
      const today = new Date()
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
      
      // Queue payment reminder email
      const queueService = getQueue()
      if (!queueService) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Queue service is not available',
        })
      }
      const job = await queueService.enqueue('EMAIL_NOTIFICATION', {
        to: input.to || invoice.client.email,
        cc: input.cc,
        bcc: input.bcc,
        subject: `Payment Reminder: Invoice ${invoice.invoiceNumber}`,
        template: 'payment-reminder',
        data: {
          clientName: invoice.client.name,
          senderName: user.name || 'Your Service Provider',
          senderEmail: user.email,
          companyName: user.name,
          companyGSTIN: user.gstin,
          companyAddress: user.address,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
          dueDate: new Date(invoice.dueDate).toLocaleDateString('en-IN'),
          amount: Number(invoice.balanceDue),
          currency: invoice.currency,
          viewUrl: `${process.env.NEXTAUTH_URL}/invoice/${invoice.publicAccessToken}`,
          downloadUrl: `${process.env.NEXTAUTH_URL}/api/invoices/public/${invoice.publicAccessToken}/download`,
          bankDetails: invoice.bankDetails || undefined,
          daysOverdue: daysOverdue,
          customMessage: input.customMessage,
        },
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
      const queueService = getQueue()
      if (!queueService) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Queue service is not available',
        })
      }
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
  
  // Recalculate balance due for an invoice
  recalculateBalance: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
        include: { payments: true }
      })
      
      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }
      
      // Calculate total paid from all payments
      const totalPaid = invoice.payments.reduce((sum, payment) => 
        sum + Number(payment.amount), 0
      )
      
      const balanceDue = Number(invoice.totalAmount) - totalPaid
      const paymentStatus = balanceDue <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID'
      
      // Update invoice with correct values
      const updated = await ctx.prisma.invoice.update({
        where: { id: input.id },
        data: {
          amountPaid: totalPaid,
          balanceDue: balanceDue,
          paymentStatus: paymentStatus,
        }
      })
      
      return updated
    }),

  // Regenerate public access token for an invoice
  regeneratePublicToken: protectedProcedure
    .input(z.object({ 
      id: z.string(),
      expirationDays: z.number().optional().default(90),
    }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
      })
      
      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }
      
      // Generate new token
      const updated = await ctx.prisma.invoice.update({
        where: { id: input.id },
        data: {
          publicAccessToken: generateSecureToken(),
          tokenExpiresAt: getTokenExpirationDate(input.expirationDays),
        }
      })
      
      return {
        publicAccessToken: updated.publicAccessToken,
        tokenExpiresAt: updated.tokenExpiresAt,
        publicUrl: `${process.env.NEXTAUTH_URL}/invoice/${updated.publicAccessToken}`,
      }
    }),

  regeneratePDF: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input

      // Verify invoice belongs to user
      const invoice = await db.invoice.findFirst({
        where: {
          id,
          userId: ctx.session.user.id,
        },
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      // Queue PDF regeneration
      try {
        const queueService = getQueue()
        if (!queueService) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Queue service is not available',
          })
        }
        const job = await queueService.enqueue('PDF_GENERATION', {
          invoiceId: id,
          userId: ctx.session.user.id,
        })
        
        // Update invoice with job ID and status
        await ctx.prisma.invoice.update({
          where: { id },
          data: {
            pdfStatus: 'generating',
            pdfJobId: job.id,
            pdfError: null, // Clear any previous error
          }
        })
        
        return { success: true, message: 'PDF regeneration queued', jobId: job.id }
      } catch (error) {
        // Mark as failed
        await ctx.prisma.invoice.update({
          where: { id },
          data: {
            pdfStatus: 'failed',
            pdfError: error instanceof Error ? error.message : 'Failed to queue PDF regeneration',
          }
        })
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to queue PDF regeneration',
        })
      }
    }),

  // Check PDF status for an invoice
  checkPDFStatus: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
        select: {
          pdfStatus: true,
          pdfError: true,
          pdfUrl: true,
          pdfGeneratedAt: true,
          pdfJobId: true,
        }
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      // If there's a job ID and status is generating, check the job status
      if (invoice.pdfJobId && invoice.pdfStatus === 'generating') {
        try {
          const queueService = getQueue()
          if (!queueService) {
            // Can't check job status, return current status
            return {
              status: invoice.pdfStatus || 'pending',
              error: invoice.pdfError,
              pdfUrl: invoice.pdfUrl,
              pdfGeneratedAt: invoice.pdfGeneratedAt,
              progress: 0,
            }
          }
          const job = await queueService.getJob(invoice.pdfJobId)
          if (job) {
            // Map job status to our status
            if (job.status === 'completed') {
              // Job completed but database might not be updated yet
              // Double-check by refetching invoice
              const updatedInvoice = await ctx.prisma.invoice.findUnique({
                where: { id: input.id },
                select: {
                  pdfStatus: true,
                  pdfError: true,
                  pdfUrl: true,
                  pdfGeneratedAt: true,
                }
              })
              return {
                status: updatedInvoice?.pdfStatus || 'completed',
                error: updatedInvoice?.pdfError || null,
                pdfUrl: updatedInvoice?.pdfUrl || null,
                pdfGeneratedAt: updatedInvoice?.pdfGeneratedAt || null,
                progress: 100,
              }
            } else if (job.status === 'failed') {
              return {
                status: 'failed',
                error: job.error || invoice.pdfError || 'PDF generation failed',
                pdfUrl: invoice.pdfUrl,
                pdfGeneratedAt: invoice.pdfGeneratedAt,
                progress: 0,
              }
            } else {
              // Still in progress
              return {
                status: 'generating',
                error: null,
                pdfUrl: invoice.pdfUrl,
                pdfGeneratedAt: invoice.pdfGeneratedAt,
                progress: job.progress || 0,
              }
            }
          }
        } catch (error) {
          Logger.error('Error checking job status', { error })
        }
      }

      return {
        status: invoice.pdfStatus || 'pending',
        error: invoice.pdfError,
        pdfUrl: invoice.pdfUrl,
        pdfGeneratedAt: invoice.pdfGeneratedAt,
        progress: invoice.pdfStatus === 'completed' ? 100 : 0,
      }
    }),

  // GST-related endpoints for domestic invoices
  validateGSTIN: protectedProcedure
    .input(z.object({
      gstin: z.string(),
    }))
    .query(async ({ input }) => {
      const { validateGSTIN } = await import('@/lib/gst')
      return validateGSTIN(input.gstin)
    }),

  calculateGST: protectedProcedure
    .input(z.object({
      lineItems: z.array(z.object({
        amount: z.number(),
        gstRate: z.number(),
      })),
      supplierStateCode: z.string().length(2),
      customerStateCode: z.string().length(2),
    }))
    .mutation(async ({ input }) => {
      const { calculateInvoiceGST } = await import('@/lib/gst')
      
      const result = calculateInvoiceGST(
        input.lineItems,
        input.supplierStateCode as StateCode,
        input.customerStateCode as StateCode
      )
      
      // Return the result directly (already numbers, not Decimals)
      return result
    }),

  createDomesticInvoice: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        invoiceType: z.enum(['DOMESTIC_B2B', 'DOMESTIC_B2C']),
        buyerGSTIN: z.string().optional(),
        placeOfSupply: z.string().length(2), // State code
        issueDate: z.date(),
        dueDate: z.date(),
        currency: z.string().default('INR'),
        paymentTerms: z.number().optional(),
        bankDetails: z.string().optional(),
        notes: z.string().optional(),
        lineItems: z.array(z.object({
          description: z.string().min(1),
          quantity: z.number().positive(),
          rate: z.number().positive(),
          sacCode: z.string(),
          gstRate: z.number(),
        })).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { calculateInvoiceGST, calculateGST: calculateGSTAmount, validateGSTIN, getStateCodeFromGSTIN } = await import('@/lib/gst')
      
      // Validate B2B GSTIN if provided
      if (input.invoiceType === 'DOMESTIC_B2B' && input.buyerGSTIN) {
        const gstinValidation = validateGSTIN(input.buyerGSTIN)
        if (!gstinValidation.valid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid buyer GSTIN: ${gstinValidation.error}`,
          })
        }
      }
      
      // Get supplier state code from user's GSTIN
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { gstin: true },
      })
      
      if (!user?.gstin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Supplier GSTIN not configured. Please update your profile.',
        })
      }
      
      const supplierStateCode = getStateCodeFromGSTIN(user.gstin)
      if (!supplierStateCode) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid supplier GSTIN format.',
        })
      }
      
      // Calculate GST for all line items and individual items
      const lineItemsWithAmounts = input.lineItems.map(item => ({
        ...item,
        amount: item.quantity * item.rate,
      }))
      
      // Calculate GST for the entire invoice
      const gstCalculation = calculateInvoiceGST(
        lineItemsWithAmounts,
        supplierStateCode,
        input.placeOfSupply as StateCode
      )
      
      // Calculate GST for individual line items for storage
      const individualItemGST = lineItemsWithAmounts.map(item => 
        calculateGSTAmount(
          item.amount,
          item.gstRate,
          supplierStateCode,
          input.placeOfSupply as StateCode
        )
      )
      
      // Use transaction for atomicity
      return await ctx.prisma.$transaction(async (tx) => {
        // Get the current fiscal year
        const currentFY = getCurrentFiscalYear(input.issueDate)
        
        // Get the next invoice number
        const existingInvoices = await tx.invoice.findMany({
          where: {
            userId,
            invoiceNumber: {
              startsWith: `FY${currentFY.slice(2, 4)}-${currentFY.slice(-2)}/`,
            },
          },
          select: { invoiceNumber: true },
        })
        
        const invoiceNumbers = existingInvoices.map(inv => inv.invoiceNumber)
        const nextSequence = getNextInvoiceSequence(invoiceNumbers)
        const invoiceNumber = generateInvoiceNumber(currentFY, nextSequence)
        
        // Create invoice with GST details
        const invoice = await tx.invoice.create({
          data: {
            userId,
            clientId: input.clientId,
            invoiceType: input.invoiceType,
            buyerGSTIN: input.buyerGSTIN,
            invoiceNumber,
            invoiceDate: input.issueDate,
            dueDate: input.dueDate,
            currency: input.currency,
            exchangeRate: 1, // INR to INR
            exchangeSource: 'Fixed',
            subtotal: gstCalculation.taxableAmount,
            taxableAmount: gstCalculation.taxableAmount,
            cgstRate: gstCalculation.cgstRate,
            sgstRate: gstCalculation.sgstRate,
            igstRate: gstCalculation.igstRate,
            cgstAmount: gstCalculation.cgstAmount,
            sgstAmount: gstCalculation.sgstAmount,
            igstAmount: gstCalculation.igstAmount,
            totalGSTAmount: gstCalculation.totalGSTAmount,
            totalAmount: gstCalculation.totalAmount,
            totalInINR: gstCalculation.totalAmount,
            status: 'DRAFT',
            placeOfSupply: input.placeOfSupply,
            serviceCode: input.lineItems[0].sacCode,
            paymentTerms: input.paymentTerms?.toString(),
            bankDetails: input.bankDetails,
            notes: input.notes,
            paymentStatus: 'UNPAID',
            amountPaid: 0,
            balanceDue: gstCalculation.totalAmount,
            publicAccessToken: generateSecureToken(),
            tokenExpiresAt: getTokenExpirationDate(90),
          },
        })
        
        // Create line items with pre-calculated GST details
        for (let i = 0; i < input.lineItems.length; i++) {
          const item = input.lineItems[i]
          const itemAmount = item.quantity * item.rate
          const itemGST = individualItemGST[i] // Use pre-calculated GST
          
          await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              amount: itemAmount,
              serviceCode: item.sacCode,
              gstRate: item.gstRate,
              cgstAmount: itemGST.cgstAmount,
              sgstAmount: itemGST.sgstAmount,
              igstAmount: itemGST.igstAmount,
            },
          })
        }
        
        // Queue PDF generation
        try {
          const queueService = getQueue()
          if (queueService) {
            const job = await queueService.enqueue('PDF_GENERATION', {
              invoiceId: invoice.id,
              userId: ctx.session.user.id,
            })
            
            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                pdfStatus: 'generating',
                pdfJobId: job.id,
              },
            })
          }
        } catch (error) {
          Logger.error('Failed to queue PDF generation', { error })
        }
        
        return invoice
      })
    }),
})