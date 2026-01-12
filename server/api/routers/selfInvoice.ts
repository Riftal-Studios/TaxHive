import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import {
  getCurrentFiscalYear,
  calculateSubtotal,
} from '@/lib/invoice-utils'
import {
  generateSelfInvoiceNumber,
  getNextSelfInvoiceSequence,
  generatePaymentVoucherNumber,
  getNextPaymentVoucherSequence,
} from '@/lib/invoice-number-utils'
import {
  calculateRCMGSTComponents,
  validateRCMSelfInvoice,
  getRCMPlaceOfSupply,
  rcmGstRateSchema,
  getStateCodeFromGSTIN,
  exportHsnSacCodeSchema,
} from '@/lib/validations/gst'
import { InvoiceType, PaymentMode } from '@prisma/client'

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  sacCode: exportHsnSacCodeSchema,
})

const paymentModeSchema = z.nativeEnum(PaymentMode)

export const selfInvoiceRouter = createTRPCRouter({
  /**
   * Create a new RCM Self Invoice with auto-generated Payment Voucher
   */
  create: protectedProcedure
    .input(
      z.object({
        unregisteredSupplierId: z.string(),
        invoiceDate: z.date(),
        dateOfReceiptOfSupply: z.date(),
        gstRate: rcmGstRateSchema,
        lineItems: z.array(lineItemSchema).min(1),
        description: z.string().optional(),
        notes: z.string().optional(),
        // Payment voucher details
        paymentMode: paymentModeSchema,
        paymentReference: z.string().optional(),
        paymentNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.prisma
      const userId = ctx.session.user.id

      // Get user GSTIN to determine recipient state
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { gstin: true, name: true, address: true },
      })

      if (!user?.gstin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User GSTIN is required for RCM Self Invoice',
        })
      }

      const recipientStateCode = getStateCodeFromGSTIN(user.gstin)
      if (!recipientStateCode) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not determine state from GSTIN',
        })
      }

      // Get unregistered supplier
      const supplier = await db.unregisteredSupplier.findFirst({
        where: {
          id: input.unregisteredSupplierId,
          userId,
          isActive: true,
        },
      })

      if (!supplier) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Unregistered supplier not found',
        })
      }

      // Calculate subtotal and GST components
      const subtotal = calculateSubtotal(input.lineItems)
      const gstComponents = calculateRCMGSTComponents(
        subtotal,
        input.gstRate,
        supplier.stateCode,
        recipientStateCode
      )

      // Validate self-invoice
      const validation = validateRCMSelfInvoice({
        invoiceDate: input.invoiceDate,
        dateOfReceiptOfSupply: input.dateOfReceiptOfSupply,
        gstRate: input.gstRate,
        serviceCode: input.lineItems[0].sacCode,
        supplierStateCode: supplier.stateCode,
        recipientStateCode,
        supplierName: supplier.name,
        supplierAddress: supplier.address,
        amount: subtotal,
      })

      if (!validation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `RCM validation failed: ${validation.errors.join(', ')}`,
        })
      }

      // Use transaction for atomicity
      return await db.$transaction(async (tx) => {
        // Get current fiscal year
        const currentFY = getCurrentFiscalYear(input.invoiceDate)

        // Get next self-invoice number
        const existingInvoices = await tx.invoice.findMany({
          where: {
            userId,
            invoiceType: InvoiceType.SELF_INVOICE,
            invoiceNumber: {
              startsWith: `SI/${currentFY}/`,
            },
          },
          select: { invoiceNumber: true },
        })

        const invoiceNumbers = existingInvoices.map(inv => inv.invoiceNumber)
        const nextSequence = getNextSelfInvoiceSequence(invoiceNumbers)
        const invoiceNumber = generateSelfInvoiceNumber(currentFY, nextSequence)

        // Calculate total amount (including GST)
        const totalAmount = subtotal + gstComponents.totalTax

        // Place of supply for RCM
        const placeOfSupply = getRCMPlaceOfSupply(supplier.stateCode, recipientStateCode)

        // Create self-invoice
        const invoice = await tx.invoice.create({
          data: {
            userId,
            clientId: null, // No client for self-invoice
            invoiceNumber,
            invoiceDate: input.invoiceDate,
            dueDate: input.invoiceDate, // Self-invoices are typically due immediately
            status: 'SENT', // Self-invoices are immediately sent (to yourself)
            invoiceType: InvoiceType.SELF_INVOICE,
            placeOfSupply,
            serviceCode: input.lineItems[0].sacCode,
            unregisteredSupplierId: input.unregisteredSupplierId,
            dateOfReceiptOfSupply: input.dateOfReceiptOfSupply,
            currency: 'INR', // Self-invoices are always in INR
            exchangeRate: 1,
            exchangeSource: 'N/A',
            subtotal,
            // GST components
            igstRate: gstComponents.igstRate,
            igstAmount: gstComponents.igst,
            cgstRate: gstComponents.cgstRate,
            cgstAmount: gstComponents.cgst,
            sgstRate: gstComponents.sgstRate,
            sgstAmount: gstComponents.sgst,
            totalAmount,
            totalInINR: totalAmount, // Already in INR
            // RCM tracking
            isRCM: true,
            rcmLiability: gstComponents.totalTax,
            itcClaimable: gstComponents.totalTax, // Full ITC claimable
            // Payment status for self-invoice (marks payment made to supplier)
            paymentStatus: 'PAID',
            amountPaid: totalAmount,
            balanceDue: 0,
            description: input.description,
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

        // Get next payment voucher number
        const existingVouchers = await tx.paymentVoucher.findMany({
          where: {
            userId,
            voucherNumber: {
              startsWith: `PV/${currentFY}/`,
            },
          },
          select: { voucherNumber: true },
        })

        const voucherNumbers = existingVouchers.map(v => v.voucherNumber)
        const nextVoucherSequence = getNextPaymentVoucherSequence(voucherNumbers)
        const voucherNumber = generatePaymentVoucherNumber(currentFY, nextVoucherSequence)

        // Create payment voucher
        const paymentVoucher = await tx.paymentVoucher.create({
          data: {
            userId,
            voucherNumber,
            voucherDate: input.invoiceDate,
            selfInvoiceId: invoice.id,
            supplierName: supplier.name,
            supplierAddress: supplier.address,
            amount: subtotal, // Pre-tax amount paid to supplier
            paymentMode: input.paymentMode,
            paymentReference: input.paymentReference,
            notes: input.paymentNotes,
            pdfStatus: 'pending',
          },
        })

        // Return invoice with payment voucher
        return {
          invoice,
          paymentVoucher,
          gstComponents,
          warnings: validation.warnings,
        }
      })
    }),

  /**
   * Get next self-invoice number
   */
  getNextNumber: protectedProcedure.query(async ({ ctx }) => {
    const currentFY = getCurrentFiscalYear()
    const existingInvoices = await ctx.prisma.invoice.findMany({
      where: {
        userId: ctx.session.user.id,
        invoiceType: InvoiceType.SELF_INVOICE,
        invoiceNumber: {
          startsWith: `SI/${currentFY}/`,
        },
      },
      select: { invoiceNumber: true },
    })

    const invoiceNumbers = existingInvoices.map(inv => inv.invoiceNumber)
    const nextSequence = getNextSelfInvoiceSequence(invoiceNumbers)
    return generateSelfInvoiceNumber(currentFY, nextSequence)
  }),

  /**
   * List self-invoices with filters
   */
  list: protectedProcedure
    .input(
      z.object({
        fiscalYear: z.string().optional(),
        supplierId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const filters: Record<string, unknown> = {
        userId: ctx.session.user.id,
        invoiceType: InvoiceType.SELF_INVOICE,
      }

      if (input?.supplierId) {
        filters.unregisteredSupplierId = input.supplierId
      }

      if (input?.startDate || input?.endDate) {
        filters.invoiceDate = {}
        if (input?.startDate) {
          (filters.invoiceDate as Record<string, Date>).gte = input.startDate
        }
        if (input?.endDate) {
          (filters.invoiceDate as Record<string, Date>).lte = input.endDate
        }
      }

      if (input?.fiscalYear) {
        filters.invoiceNumber = {
          startsWith: `SI/${input.fiscalYear}/`,
        }
      }

      const invoices = await ctx.prisma.invoice.findMany({
        where: filters,
        include: {
          unregisteredSupplier: true,
          lineItems: true,
          paymentVoucher: true,
        },
        orderBy: {
          invoiceDate: 'desc',
        },
      })

      return invoices
    }),

  /**
   * Get self-invoice by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
          invoiceType: InvoiceType.SELF_INVOICE,
        },
        include: {
          unregisteredSupplier: true,
          lineItems: true,
          paymentVoucher: true,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Self-invoice not found',
        })
      }

      return invoice
    }),

  /**
   * Calculate GST components preview (before creating invoice)
   */
  calculateGST: protectedProcedure
    .input(
      z.object({
        supplierId: z.string(),
        amount: z.number().positive(),
        gstRate: rcmGstRateSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      // Get user GSTIN
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { gstin: true },
      })

      if (!user?.gstin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User GSTIN is required',
        })
      }

      const recipientStateCode = getStateCodeFromGSTIN(user.gstin)
      if (!recipientStateCode) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not determine state from GSTIN',
        })
      }

      // Get supplier
      const supplier = await ctx.prisma.unregisteredSupplier.findFirst({
        where: {
          id: input.supplierId,
          userId: ctx.session.user.id,
        },
        select: { stateCode: true, state: true },
      })

      if (!supplier) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier not found',
        })
      }

      const gstComponents = calculateRCMGSTComponents(
        input.amount,
        input.gstRate,
        supplier.stateCode,
        recipientStateCode
      )

      return {
        ...gstComponents,
        supplierState: supplier.state,
        totalAmount: input.amount + gstComponents.totalTax,
      }
    }),

  /**
   * Get RCM liability summary for GSTR-3B Table 3.1(d)
   */
  getRCMLiabilitySummary: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceType: InvoiceType.SELF_INVOICE,
          isRCM: true,
          invoiceDate: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        select: {
          igstAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          rcmLiability: true,
          subtotal: true,
        },
      })

      // Calculate totals
      const summary = invoices.reduce(
        (acc, inv) => ({
          taxableValue: acc.taxableValue + Number(inv.subtotal),
          igst: acc.igst + Number(inv.igstAmount),
          cgst: acc.cgst + Number(inv.cgstAmount),
          sgst: acc.sgst + Number(inv.sgstAmount),
          totalTax: acc.totalTax + Number(inv.rcmLiability),
          count: acc.count + 1,
        }),
        { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, totalTax: 0, count: 0 }
      )

      return {
        ...summary,
        description: 'GSTR-3B Table 3.1(d) - Tax payable on Reverse Charge',
      }
    }),

  /**
   * Get ITC summary for GSTR-3B Table 4A(3)
   */
  getITCSummary: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceType: InvoiceType.SELF_INVOICE,
          isRCM: true,
          invoiceDate: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        select: {
          igstAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          itcClaimable: true,
        },
      })

      // Calculate totals
      const summary = invoices.reduce(
        (acc, inv) => ({
          igst: acc.igst + Number(inv.igstAmount),
          cgst: acc.cgst + Number(inv.cgstAmount),
          sgst: acc.sgst + Number(inv.sgstAmount),
          totalITC: acc.totalITC + Number(inv.itcClaimable),
          count: acc.count + 1,
        }),
        { igst: 0, cgst: 0, sgst: 0, totalITC: 0, count: 0 }
      )

      return {
        ...summary,
        description: 'GSTR-3B Table 4A(3) - ITC from Inward supplies liable to Reverse Charge',
      }
    }),

  /**
   * Update a self-invoice
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        invoiceDate: z.date().optional(),
        dateOfReceiptOfSupply: z.date().optional(),
        notes: z.string().optional(),
        // Note: Changing line items or GST rate requires recalculation
        // For now, allow updating metadata fields only
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.prisma
      const userId = ctx.session.user.id

      // Verify ownership
      const existingInvoice = await db.invoice.findFirst({
        where: {
          id: input.id,
          userId,
          invoiceType: InvoiceType.SELF_INVOICE,
        },
      })

      if (!existingInvoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Self-invoice not found',
        })
      }

      // Validate dates if provided
      if (input.invoiceDate && input.dateOfReceiptOfSupply) {
        // Basic validation: invoice date cannot be before receipt date
        if (input.invoiceDate < input.dateOfReceiptOfSupply) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invoice date cannot be before the date of receipt of supply',
          })
        }
      }

      // Update the invoice
      const updatedInvoice = await db.invoice.update({
        where: { id: input.id },
        data: {
          ...(input.invoiceDate && { invoiceDate: input.invoiceDate }),
          ...(input.dateOfReceiptOfSupply && { dateOfReceiptOfSupply: input.dateOfReceiptOfSupply }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
        include: {
          unregisteredSupplier: true,
          lineItems: true,
          paymentVoucher: true,
        },
      })

      return updatedInvoice
    }),

  /**
   * Delete a self-invoice (and its payment voucher)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Note: Payment voucher is automatically deleted due to cascade
      const invoice = await ctx.prisma.invoice.deleteMany({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
          invoiceType: InvoiceType.SELF_INVOICE,
        },
      })

      if (invoice.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Self-invoice not found',
        })
      }

      return { success: true }
    }),
})
