import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { generateInvoiceNumber, validateGSTCompliance } from '@/lib/invoice'
import { FISCAL_YEAR, GST_CONSTANTS } from '@/lib/constants'
import { generateInvoicePDF } from '@/lib/pdf-generator'

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  serviceCode: z.string().regex(/^\d{8}$/, 'Service code must be 8 digits'),
})

export const invoiceRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        invoiceDate: z.date(),
        dueDate: z.date(),
        currency: z.string().default('USD'),
        lutId: z.string().optional(),
        igstRate: z.number().default(0),
        description: z.string().optional(),
        paymentTerms: z.string().optional(),
        bankDetails: z.string().optional(),
        notes: z.string().optional(),
        lineItems: z.array(lineItemSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate user has GST details
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
      })

      if (!user?.gstin || !user?.pan) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Please update your GST details before creating invoices',
        })
      }

      // Validate client exists and belongs to user
      const client = await ctx.prisma.client.findFirst({
        where: {
          id: input.clientId,
          userId: ctx.session.user.id,
        },
      })

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        })
      }

      // Validate LUT if provided
      if (input.lutId) {
        const lut = await ctx.prisma.lUT.findFirst({
          where: {
            id: input.lutId,
            userId: ctx.session.user.id,
            isActive: true,
          },
        })

        if (!lut) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'LUT not found',
          })
        }

        // Check if LUT is valid for invoice date
        if (input.invoiceDate < lut.validFrom || input.invoiceDate > lut.validTill) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'LUT has expired or is not yet valid',
          })
        }

        // Enforce 0% IGST for LUT exports
        if (input.igstRate !== 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'IGST must be 0% for exports under LUT',
          })
        }
      }

      // Get current exchange rate
      const exchangeRate = await ctx.prisma.exchangeRate.findFirst({
        where: {
          currency: input.currency,
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      if (!exchangeRate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Exchange rate not found for ${input.currency}. Please update exchange rates.`,
        })
      }

      // Calculate totals
      const subtotal = input.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.rate,
        0
      )
      const igstAmount = (subtotal * input.igstRate) / 100
      const totalAmount = subtotal + igstAmount
      const totalInINR = totalAmount * Number(exchangeRate.rate)

      // Generate invoice number
      const currentFY = FISCAL_YEAR.getCurrent()
      const lastInvoice = await ctx.prisma.invoice.findFirst({
        where: {
          userId: ctx.session.user.id,
          invoiceNumber: {
            startsWith: `FY${currentFY.slice(2, 5)}-${currentFY.slice(7, 9)}/`,
          },
        },
        orderBy: {
          invoiceNumber: 'desc',
        },
      })

      let sequence = 1
      if (lastInvoice) {
        const lastSequence = parseInt(lastInvoice.invoiceNumber.split('/')[1])
        sequence = lastSequence + 1
      }

      const invoiceNumber = generateInvoiceNumber(currentFY, sequence)

      // Create invoice with line items
      const invoice = await ctx.prisma.invoice.create({
        data: {
          userId: ctx.session.user.id,
          clientId: input.clientId,
          invoiceNumber,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          status: 'DRAFT',
          placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
          serviceCode: input.lineItems[0].serviceCode, // Primary service code
          lutId: input.lutId,
          currency: input.currency,
          exchangeRate: exchangeRate.rate,
          exchangeSource: exchangeRate.source,
          subtotal,
          igstRate: input.igstRate,
          igstAmount,
          totalAmount,
          totalInINR,
          description: input.description,
          paymentTerms: input.paymentTerms,
          bankDetails: input.bankDetails,
          notes: input.notes,
          lineItems: {
            create: input.lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.quantity * item.rate,
              serviceCode: item.serviceCode,
            })),
          },
        },
        include: {
          client: true,
          lineItems: true,
          lut: true,
        },
      })

      return invoice
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const invoices = await ctx.prisma.invoice.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      include: {
        client: true,
        lineItems: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    return invoices
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          client: true,
          lineItems: true,
          lut: true,
          payments: true,
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

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.updateMany({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        data: {
          status: input.status,
        },
      })

      if (invoice.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      return { success: true }
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
})