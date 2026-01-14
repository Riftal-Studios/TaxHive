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
  // Import of Services functions
  calculateImportOfServicesGST,
  validateImportOfServicesInvoice,
} from '@/lib/validations/gst'
import { InvoiceType, PaymentMode, SupplierType, RcmType } from '@prisma/client'

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
        // Foreign currency details (for Import of Services)
        foreignCurrency: z.string().optional(),
        foreignAmount: z.number().positive().optional(),
        exchangeRate: z.number().positive().optional(),
        exchangeSource: z.string().optional(),
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

      // Calculate subtotal from line items
      const subtotal = calculateSubtotal(input.lineItems)

      // Variables for GST calculation and validation
      let gstComponents: {
        cgst: number
        sgst: number
        igst: number
        totalTax: number
        cgstRate?: number
        sgstRate?: number
        igstRate: number
        foreignCurrency?: string
        foreignAmount?: number
        exchangeRate?: number
      }
      let validation: { isValid: boolean; errors: string[]; warnings: string[] }
      let rcmType: RcmType
      let placeOfSupply: string
      let amountInINR: number
      let foreignCurrencyData: { currency: string; amount: number; exchangeRate: number; source: string } | null = null

      // Handle based on supplier type
      if (supplier.supplierType === SupplierType.FOREIGN_SERVICE) {
        // ==========================
        // IMPORT OF SERVICES RCM
        // ==========================
        rcmType = RcmType.IMPORT_OF_SERVICES

        // Validate required foreign currency details
        if (!input.foreignCurrency || !input.foreignAmount || !input.exchangeRate) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Foreign currency, amount, and exchange rate are required for Import of Services',
          })
        }

        // Validate supplier has country
        if (!supplier.country) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Foreign supplier must have a country set',
          })
        }

        // Calculate INR amount from foreign currency
        amountInINR = input.foreignAmount * input.exchangeRate
        foreignCurrencyData = {
          currency: input.foreignCurrency,
          amount: input.foreignAmount,
          exchangeRate: input.exchangeRate,
          source: input.exchangeSource || 'Manual',
        }

        // Calculate GST (always IGST for import of services)
        gstComponents = calculateImportOfServicesGST(
          amountInINR,
          input.gstRate,
          {
            foreignCurrency: input.foreignCurrency,
            foreignAmount: input.foreignAmount,
            exchangeRate: input.exchangeRate,
          }
        )

        // Validate import of services invoice
        validation = validateImportOfServicesInvoice({
          invoiceDate: input.invoiceDate,
          dateOfReceiptOfSupply: input.dateOfReceiptOfSupply,
          gstRate: input.gstRate,
          serviceCode: input.lineItems[0].sacCode,
          supplierName: supplier.name,
          supplierCountry: supplier.country,
          supplierCountryName: supplier.countryName || undefined,
          amountInINR,
          foreignCurrency: input.foreignCurrency,
          foreignAmount: input.foreignAmount,
          exchangeRate: input.exchangeRate,
          exchangeRateSource: input.exchangeSource,
        })

        // Place of supply for import of services
        placeOfSupply = 'Outside India (Import of Services)'
      } else {
        // ==========================
        // INDIAN UNREGISTERED RCM
        // ==========================
        rcmType = RcmType.INDIAN_UNREGISTERED

        // For Indian unregistered suppliers, stateCode is required
        if (!supplier.stateCode) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Supplier state code is required for Indian unregistered suppliers',
          })
        }

        amountInINR = subtotal

        // Calculate GST components (may be IGST or CGST+SGST based on state)
        gstComponents = calculateRCMGSTComponents(
          subtotal,
          input.gstRate,
          supplier.stateCode,
          recipientStateCode
        )

        // Validate Indian RCM self-invoice
        validation = validateRCMSelfInvoice({
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

        // Place of supply for Indian RCM
        placeOfSupply = getRCMPlaceOfSupply(supplier.stateCode, recipientStateCode)
      }

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
        const totalAmount = amountInINR + gstComponents.totalTax

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
            placeOfSupply, // Set based on supplier type above
            serviceCode: input.lineItems[0].sacCode,
            unregisteredSupplierId: input.unregisteredSupplierId,
            dateOfReceiptOfSupply: input.dateOfReceiptOfSupply,
            // Currency handling based on supplier type
            currency: foreignCurrencyData ? foreignCurrencyData.currency : 'INR',
            exchangeRate: foreignCurrencyData ? foreignCurrencyData.exchangeRate : 1,
            exchangeSource: foreignCurrencyData ? foreignCurrencyData.source : 'N/A',
            subtotal: amountInINR, // Always store in INR
            // Foreign currency details (for import of services)
            foreignCurrency: foreignCurrencyData?.currency,
            foreignAmount: foreignCurrencyData?.amount,
            // GST components
            igstRate: gstComponents.igstRate,
            igstAmount: gstComponents.igst,
            cgstRate: gstComponents.cgstRate ?? 0,
            cgstAmount: gstComponents.cgst,
            sgstRate: gstComponents.sgstRate ?? 0,
            sgstAmount: gstComponents.sgst,
            totalAmount,
            totalInINR: totalAmount, // Always in INR
            // RCM tracking
            isRCM: true,
            rcmType, // IMPORT_OF_SERVICES or INDIAN_UNREGISTERED
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
        // Foreign currency details (optional, required for foreign suppliers)
        foreignCurrency: z.string().optional(),
        foreignAmount: z.number().positive().optional(),
        exchangeRate: z.number().positive().optional(),
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
        select: { stateCode: true, state: true, supplierType: true, country: true, countryName: true },
      })

      if (!supplier) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier not found',
        })
      }

      // Handle based on supplier type
      if (supplier.supplierType === SupplierType.FOREIGN_SERVICE) {
        // ==========================
        // IMPORT OF SERVICES
        // ==========================

        // Validate foreign currency details are provided
        if (!input.foreignCurrency || !input.foreignAmount || !input.exchangeRate) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Foreign currency details are required for Import of Services calculation',
          })
        }

        const amountInINR = input.foreignAmount * input.exchangeRate
        const gstComponents = calculateImportOfServicesGST(amountInINR, input.gstRate)

        return {
          ...gstComponents,
          supplierCountry: supplier.country,
          supplierCountryName: supplier.countryName,
          supplierType: 'FOREIGN_SERVICE',
          rcmType: 'IMPORT_OF_SERVICES',
          gstr3bTable: '3.1(a)',
          foreignCurrency: input.foreignCurrency,
          foreignAmount: input.foreignAmount,
          exchangeRate: input.exchangeRate,
          amountInINR,
          totalAmount: amountInINR + gstComponents.totalTax,
        }
      }

      // ==========================
      // INDIAN UNREGISTERED
      // ==========================
      if (!supplier.stateCode) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Supplier state code is required for Indian unregistered suppliers',
        })
      }

      const gstComponents = calculateRCMGSTComponents(
        input.amount,
        input.gstRate,
        supplier.stateCode, // Now guaranteed non-null
        recipientStateCode
      )

      return {
        ...gstComponents,
        supplierState: supplier.state,
        supplierType: 'INDIAN_UNREGISTERED',
        rcmType: 'INDIAN_UNREGISTERED',
        gstr3bTable: '3.1(d)',
        totalAmount: input.amount + gstComponents.totalTax,
      }
    }),

  /**
   * Get RCM liability summary for GSTR-3B
   * Returns separate summaries for:
   * - Table 3.1(a) - Import of Services
   * - Table 3.1(d) - Inward supplies from unregistered (Indian)
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
          rcmType: true,
          subtotal: true,
        },
      })

      // Initialize summaries
      const emptySummary = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, totalTax: 0, count: 0 }

      // Separate by RCM type
      const importOfServices = { ...emptySummary }
      const indianUnregistered = { ...emptySummary }

      for (const inv of invoices) {
        const target = inv.rcmType === RcmType.IMPORT_OF_SERVICES ? importOfServices : indianUnregistered
        target.taxableValue += Number(inv.subtotal)
        target.igst += Number(inv.igstAmount)
        target.cgst += Number(inv.cgstAmount)
        target.sgst += Number(inv.sgstAmount)
        target.totalTax += Number(inv.rcmLiability)
        target.count += 1
      }

      // Calculate combined totals
      const combined = {
        taxableValue: importOfServices.taxableValue + indianUnregistered.taxableValue,
        igst: importOfServices.igst + indianUnregistered.igst,
        cgst: importOfServices.cgst + indianUnregistered.cgst,
        sgst: importOfServices.sgst + indianUnregistered.sgst,
        totalTax: importOfServices.totalTax + indianUnregistered.totalTax,
        count: importOfServices.count + indianUnregistered.count,
      }

      return {
        // Table 3.1(a) - Import of Services (always IGST only)
        table31a: {
          ...importOfServices,
          description: 'GSTR-3B Table 3.1(a) - Import of Services (IGST)',
        },
        // Table 3.1(d) - Inward supplies from unregistered (can be IGST or CGST+SGST)
        table31d: {
          ...indianUnregistered,
          description: 'GSTR-3B Table 3.1(d) - Tax on Inward RCM (Unregistered)',
        },
        // Combined totals
        combined: {
          ...combined,
          description: 'Total RCM Liability',
        },
      }
    }),

  /**
   * Get ITC summary for GSTR-3B Table 4A(3)
   * ITC from both Import of Services and Indian Unregistered RCM
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
          rcmType: true,
        },
      })

      // Initialize summaries
      const emptySummary = { igst: 0, cgst: 0, sgst: 0, totalITC: 0, count: 0 }

      // Separate by RCM type
      const importOfServices = { ...emptySummary }
      const indianUnregistered = { ...emptySummary }

      for (const inv of invoices) {
        const target = inv.rcmType === RcmType.IMPORT_OF_SERVICES ? importOfServices : indianUnregistered
        target.igst += Number(inv.igstAmount)
        target.cgst += Number(inv.cgstAmount)
        target.sgst += Number(inv.sgstAmount)
        target.totalITC += Number(inv.itcClaimable)
        target.count += 1
      }

      // Calculate combined totals (this is what goes into GSTR-3B Table 4A(3))
      const combined = {
        igst: importOfServices.igst + indianUnregistered.igst,
        cgst: importOfServices.cgst + indianUnregistered.cgst,
        sgst: importOfServices.sgst + indianUnregistered.sgst,
        totalITC: importOfServices.totalITC + indianUnregistered.totalITC,
        count: importOfServices.count + indianUnregistered.count,
      }

      return {
        // ITC from Import of Services (always IGST)
        importOfServices: {
          ...importOfServices,
          description: 'ITC from Import of Services (IGST only)',
        },
        // ITC from Indian Unregistered (can be IGST or CGST+SGST)
        indianUnregistered: {
          ...indianUnregistered,
          description: 'ITC from Indian Unregistered RCM',
        },
        // Combined ITC for GSTR-3B Table 4A(3)
        combined: {
          ...combined,
          description: 'GSTR-3B Table 4A(3) - ITC from Inward supplies liable to Reverse Charge',
        },
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
