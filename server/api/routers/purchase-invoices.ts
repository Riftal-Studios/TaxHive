import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { 
  calculateITC, 
  checkRule36_4Compliance,
  matchInvoiceWithGSTR2A,
  calculateMonthlyITCSummary,
  ITC_CATEGORIES
} from '@/lib/itc'

// Input schemas
const createVendorSchema = z.object({
  name: z.string().min(1),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional().nullable(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional().nullable(),
  address: z.string().min(1),
  stateCode: z.string().length(2),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  isRegistered: z.boolean().default(true),
})

const createPurchaseInvoiceSchema = z.object({
  vendorId: z.string(),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.date(),
  placeOfSupply: z.string().optional(),
  taxableAmount: z.number().min(0),
  cgstRate: z.number().min(0).default(0),
  sgstRate: z.number().min(0).default(0),
  igstRate: z.number().min(0).default(0),
  cgstAmount: z.number().min(0).default(0),
  sgstAmount: z.number().min(0).default(0),
  igstAmount: z.number().min(0).default(0),
  cessAmount: z.number().min(0).default(0),
  totalGSTAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0),
  itcCategory: z.enum(['INPUTS', 'CAPITAL_GOODS', 'INPUT_SERVICES', 'BLOCKED']).default('INPUTS'),
  itcEligible: z.boolean().default(true),
  itcClaimed: z.number().min(0).default(0),
  itcReversed: z.number().min(0).default(0),
  reversalReason: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  documentUrl: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    hsnSacCode: z.string(),
    quantity: z.number().min(0),
    rate: z.number().min(0),
    amount: z.number().min(0),
    gstRate: z.number().min(0),
    cgstAmount: z.number().min(0).default(0),
    sgstAmount: z.number().min(0).default(0),
    igstAmount: z.number().min(0).default(0),
  })),
})

export const purchaseInvoicesRouter = createTRPCRouter({
  // Vendor Management
  createVendor: protectedProcedure
    .input(createVendorSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate GSTIN and PAN consistency
      if (input.isRegistered && !input.gstin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'GSTIN is required for registered vendors',
        })
      }
      
      if (!input.isRegistered && !input.pan) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'PAN is required for unregistered vendors',
        })
      }
      
      // Check if vendor already exists
      if (input.gstin) {
        const existing = await ctx.prisma.vendor.findFirst({
          where: {
            userId: ctx.session.user.id,
            gstin: input.gstin,
          },
        })
        
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Vendor with this GSTIN already exists',
          })
        }
      }
      
      return ctx.prisma.vendor.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
        },
      })
    }),
  
  getVendors: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.vendor.findMany({
      where: {
        userId: ctx.session.user.id,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    })
  }),
  
  getVendorById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          purchases: {
            orderBy: {
              invoiceDate: 'desc',
            },
            take: 10,
          },
        },
      })
      
      if (!vendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found',
        })
      }
      
      return vendor
    }),
  
  // Purchase Invoice Management
  // Alias for compatibility
  create: protectedProcedure
    .input(createPurchaseInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify vendor exists and belongs to user
      const vendor = await ctx.prisma.vendor.findFirst({
        where: {
          id: input.vendorId,
          userId: ctx.session.user.id,
        },
      })
      
      if (!vendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found',
        })
      }
      
      // Check for duplicate invoice
      const existing = await ctx.prisma.purchaseInvoice.findFirst({
        where: {
          userId: ctx.session.user.id,
          vendorId: input.vendorId,
          invoiceNumber: input.invoiceNumber,
        },
      })
      
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Invoice with this number already exists for this vendor',
        })
      }
      
      // Get place of supply from input or vendor's state
      const placeOfSupply = input.placeOfSupply || vendor.stateCode
      
      // Use GST rates from input or calculate from amounts
      let cgstRate = input.cgstRate || 0
      let sgstRate = input.sgstRate || 0
      let igstRate = input.igstRate || 0
      
      if (!cgstRate && !sgstRate && !igstRate && input.taxableAmount > 0) {
        if (input.cgstAmount > 0) {
          cgstRate = (input.cgstAmount / input.taxableAmount) * 100
        }
        if (input.sgstAmount > 0) {
          sgstRate = (input.sgstAmount / input.taxableAmount) * 100
        }
        if (input.igstAmount > 0) {
          igstRate = (input.igstAmount / input.taxableAmount) * 100
        }
      }
      
      // Calculate ITC
      const itcCalculation = calculateITC({
        taxableAmount: input.taxableAmount,
        cgstAmount: input.cgstAmount,
        sgstAmount: input.sgstAmount,
        igstAmount: input.igstAmount,
        cessAmount: input.cessAmount,
        category: input.itcCategory,
        isEligible: input.itcEligible,
      })
      
      // Calculate total amount
      const totalGST = input.cgstAmount + input.sgstAmount + input.igstAmount + (input.cessAmount || 0)
      const totalAmount = input.taxableAmount + totalGST
      
      // Create purchase invoice with line items
      const purchaseInvoice = await ctx.prisma.purchaseInvoice.create({
        data: {
          userId: ctx.session.user.id,
          vendorId: input.vendorId,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.invoiceDate,
          placeOfSupply,
          taxableAmount: input.taxableAmount,
          cgstRate,
          sgstRate,
          igstRate,
          cgstAmount: input.cgstAmount,
          sgstAmount: input.sgstAmount,
          igstAmount: input.igstAmount,
          cessAmount: input.cessAmount || 0,
          totalGSTAmount: totalGST,
          totalAmount,
          itcCategory: input.itcCategory,
          itcEligible: input.itcEligible,
          itcClaimed: input.itcClaimed || itcCalculation.eligibleITC,
          itcReversed: input.itcReversed || 0,
          reversalReason: input.reversalReason,
          description: input.description,
          notes: input.notes,
          documentUrl: input.documentUrl,
          lineItems: {
            create: input.lineItems,
          },
        },
        include: {
          vendor: true,
          lineItems: true,
        },
      })
      
      // Update ITC register for the month
      const period = input.invoiceDate.toISOString().slice(0, 7) // YYYY-MM
      const financialYear = getFinancialYear(input.invoiceDate)
      
      await updateITCRegister(ctx, ctx.session.user.id, period, financialYear, itcCalculation)
      
      return purchaseInvoice
    }),
  
  createPurchaseInvoice: protectedProcedure
    .input(createPurchaseInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify vendor exists and belongs to user
      const vendor = await ctx.prisma.vendor.findFirst({
        where: {
          id: input.vendorId,
          userId: ctx.session.user.id,
        },
      })
      
      if (!vendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found',
        })
      }
      
      // Check for duplicate invoice
      const existing = await ctx.prisma.purchaseInvoice.findFirst({
        where: {
          userId: ctx.session.user.id,
          vendorId: input.vendorId,
          invoiceNumber: input.invoiceNumber,
        },
      })
      
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Invoice with this number already exists for this vendor',
        })
      }
      
      // Get place of supply from input or vendor's state
      const placeOfSupply = input.placeOfSupply || vendor.stateCode
      
      // Use GST rates from input or calculate from amounts
      let cgstRate = input.cgstRate || 0
      let sgstRate = input.sgstRate || 0
      let igstRate = input.igstRate || 0
      
      if (!cgstRate && !sgstRate && !igstRate && input.taxableAmount > 0) {
        if (input.cgstAmount > 0) {
          cgstRate = (input.cgstAmount / input.taxableAmount) * 100
        }
        if (input.sgstAmount > 0) {
          sgstRate = (input.sgstAmount / input.taxableAmount) * 100
        }
        if (input.igstAmount > 0) {
          igstRate = (input.igstAmount / input.taxableAmount) * 100
        }
      }
      
      // Calculate ITC
      const itcCalculation = calculateITC({
        taxableAmount: input.taxableAmount,
        cgstAmount: input.cgstAmount,
        sgstAmount: input.sgstAmount,
        igstAmount: input.igstAmount,
        cessAmount: input.cessAmount,
        category: input.itcCategory,
        isEligible: input.itcEligible,
      })
      
      // Calculate total amount
      const totalGST = input.cgstAmount + input.sgstAmount + input.igstAmount + (input.cessAmount || 0)
      const totalAmount = input.taxableAmount + totalGST
      
      // Create purchase invoice with line items
      const purchaseInvoice = await ctx.prisma.purchaseInvoice.create({
        data: {
          userId: ctx.session.user.id,
          vendorId: input.vendorId,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.invoiceDate,
          placeOfSupply,
          taxableAmount: input.taxableAmount,
          cgstRate,
          sgstRate,
          igstRate,
          cgstAmount: input.cgstAmount,
          sgstAmount: input.sgstAmount,
          igstAmount: input.igstAmount,
          cessAmount: input.cessAmount || 0,
          totalGSTAmount: totalGST,
          totalAmount,
          itcCategory: input.itcCategory,
          itcEligible: input.itcEligible,
          itcClaimed: input.itcClaimed || itcCalculation.eligibleITC,
          itcReversed: input.itcReversed || 0,
          reversalReason: input.reversalReason,
          description: input.description,
          notes: input.notes,
          documentUrl: input.documentUrl,
          lineItems: {
            create: input.lineItems,
          },
        },
        include: {
          vendor: true,
          lineItems: true,
        },
      })
      
      // Update ITC register for the month
      const period = input.invoiceDate.toISOString().slice(0, 7) // YYYY-MM
      const financialYear = getFinancialYear(input.invoiceDate)
      
      await updateITCRegister(ctx, ctx.session.user.id, period, financialYear, itcCalculation)
      
      return purchaseInvoice
    }),
  
  getPurchaseInvoices: protectedProcedure
    .input(z.object({
      vendorId: z.string().optional(),
      month: z.string().optional(), // YYYY-MM format
      matchStatus: z.enum(['MATCHED', 'MISMATCHED', 'NOT_AVAILABLE']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {
        userId: ctx.session.user.id,
      }
      
      if (input?.vendorId) {
        where.vendorId = input.vendorId
      }
      
      if (input?.month) {
        const startDate = new Date(input.month + '-01')
        const endDate = new Date(startDate)
        endDate.setMonth(endDate.getMonth() + 1)
        
        where.invoiceDate = {
          gte: startDate,
          lt: endDate,
        }
      }
      
      if (input?.matchStatus) {
        where.matchStatus = input.matchStatus
      }
      
      return ctx.prisma.purchaseInvoice.findMany({
        where,
        include: {
          vendor: true,
          lineItems: true,
        },
        orderBy: {
          invoiceDate: 'desc',
        },
      })
    }),
  
  // Get all purchase invoices with pagination
  getAll: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(10),
      vendorId: z.string().optional(),
      matchStatus: z.enum(['MATCHED', 'MISMATCHED', 'NOT_AVAILABLE']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page || 1
      const limit = input?.limit || 10
      const skip = (page - 1) * limit
      
      const where: any = {
        userId: ctx.session.user.id,
      }
      
      if (input?.vendorId) {
        where.vendorId = input.vendorId
      }
      
      if (input?.matchStatus) {
        where.matchStatus = input.matchStatus
      }
      
      const [purchases, total] = await Promise.all([
        ctx.prisma.purchaseInvoice.findMany({
          where,
          include: {
            vendor: true,
            lineItems: true,
          },
          orderBy: {
            invoiceDate: 'desc',
          },
          skip,
          take: limit,
        }),
        ctx.prisma.purchaseInvoice.count({ where }),
      ])
      
      return {
        purchases,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    }),
  
  // Delete purchase invoice
  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      // Verify invoice exists and belongs to user
      const invoice = await ctx.prisma.purchaseInvoice.findFirst({
        where: {
          id: input,
          userId: ctx.session.user.id,
        },
      })
      
      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Purchase invoice not found',
        })
      }
      
      // Update ITC register to reverse the claimed ITC
      const period = invoice.invoiceDate.toISOString().slice(0, 7)
      const register = await ctx.prisma.iTCRegister.findUnique({
        where: {
          userId_period: {
            userId: ctx.session.user.id,
            period,
          },
        },
      })
      
      if (register) {
        await ctx.prisma.iTCRegister.update({
          where: {
            userId_period: {
              userId: ctx.session.user.id,
              period,
            },
          },
          data: {
            eligibleITC: {
              decrement: invoice.itcClaimed,
            },
            claimedITC: {
              decrement: invoice.itcClaimed,
            },
            closingBalance: {
              decrement: invoice.itcClaimed,
            },
            // Update category breakup
            ...(invoice.itcCategory === 'INPUTS' && {
              inputsITC: { decrement: invoice.itcClaimed },
            }),
            ...(invoice.itcCategory === 'CAPITAL_GOODS' && {
              capitalGoodsITC: { decrement: invoice.itcClaimed },
            }),
            ...(invoice.itcCategory === 'INPUT_SERVICES' && {
              inputServicesITC: { decrement: invoice.itcClaimed },
            }),
          },
        })
      }
      
      // Delete the invoice (line items will be cascade deleted)
      await ctx.prisma.purchaseInvoice.delete({
        where: { id: input },
      })
      
      return { success: true }
    }),
  
  getPurchaseInvoiceById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.purchaseInvoice.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          vendor: true,
          lineItems: true,
        },
      })
      
      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Purchase invoice not found',
        })
      }
      
      return invoice
    }),
  
  // ITC Management
  checkITCEligibility: protectedProcedure
    .input(z.object({
      category: z.enum(['INPUTS', 'CAPITAL_GOODS', 'INPUT_SERVICES', 'BLOCKED']),
      description: z.string(),
      amount: z.number().positive(),
      gstRate: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      const gstAmount = (input.amount * input.gstRate) / 100
      
      const result = calculateITC({
        taxableAmount: input.amount,
        cgstAmount: gstAmount / 2,
        sgstAmount: gstAmount / 2,
        igstAmount: 0,
        category: input.category,
        isEligible: input.category !== 'BLOCKED',
      })
      
      return result
    }),
  
  getITCRegister: protectedProcedure
    .input(z.object({
      period: z.string(), // YYYY-MM format
    }))
    .query(async ({ ctx, input }) => {
      const register = await ctx.prisma.iTCRegister.findUnique({
        where: {
          userId_period: {
            userId: ctx.session.user.id,
            period: input.period,
          },
        },
      })
      
      if (!register) {
        // Return empty register if not found
        return {
          period: input.period,
          openingBalance: 0,
          eligibleITC: 0,
          claimedITC: 0,
          reversedITC: 0,
          blockedITC: 0,
          closingBalance: 0,
          inputsITC: 0,
          capitalGoodsITC: 0,
          inputServicesITC: 0,
        }
      }
      
      return register
    }),
  
  getMonthlyITCSummary: protectedProcedure
    .input(z.object({
      month: z.string(), // YYYY-MM format
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.month + '-01')
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)
      
      const purchases = await ctx.prisma.purchaseInvoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceDate: {
            gte: startDate,
            lt: endDate,
          },
        },
      })
      
      // Get previous month's closing balance as opening balance
      const prevMonth = new Date(startDate)
      prevMonth.setMonth(prevMonth.getMonth() - 1)
      const prevPeriod = prevMonth.toISOString().slice(0, 7)
      
      const prevRegister = await ctx.prisma.iTCRegister.findUnique({
        where: {
          userId_period: {
            userId: ctx.session.user.id,
            period: prevPeriod,
          },
        },
      })
      
      const openingBalance = prevRegister?.closingBalance.toNumber() || 0
      
      const summary = calculateMonthlyITCSummary(
        purchases.map(p => ({
          cgstAmount: p.cgstAmount.toNumber(),
          sgstAmount: p.sgstAmount.toNumber(),
          igstAmount: p.igstAmount.toNumber(),
          itcCategory: p.itcCategory as keyof typeof ITC_CATEGORIES,
          itcEligible: p.itcEligible,
          itcClaimed: p.itcClaimed.toNumber(),
          itcReversed: p.itcReversed.toNumber(),
        })),
        openingBalance
      )
      
      return summary
    }),
  
  // GSTR-2A Reconciliation
  matchWithGSTR2A: protectedProcedure
    .input(z.object({
      invoiceId: z.string(),
      gstr2aEntry: z.object({
        invoiceNumber: z.string(),
        invoiceDate: z.date(),
        taxableAmount: z.number(),
        cgstAmount: z.number(),
        sgstAmount: z.number(),
        igstAmount: z.number(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.purchaseInvoice.findFirst({
        where: {
          id: input.invoiceId,
          userId: ctx.session.user.id,
        },
        include: {
          vendor: true,
        },
      })
      
      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Purchase invoice not found',
        })
      }
      
      const matchResult = matchInvoiceWithGSTR2A(
        {
          invoiceNumber: invoice.invoiceNumber,
          vendorGSTIN: invoice.vendor.gstin || '',
          invoiceDate: invoice.invoiceDate,
          taxableAmount: invoice.taxableAmount.toNumber(),
          cgstAmount: invoice.cgstAmount.toNumber(),
          sgstAmount: invoice.sgstAmount.toNumber(),
          igstAmount: invoice.igstAmount.toNumber(),
        },
        input.gstr2aEntry
      )
      
      // Update invoice match status
      await ctx.prisma.purchaseInvoice.update({
        where: { id: input.invoiceId },
        data: {
          gstr2aMatched: matchResult.matchStatus === 'MATCHED',
          matchStatus: matchResult.matchStatus,
        },
      })
      
      return matchResult
    }),
  
  checkRule36_4: protectedProcedure
    .input(z.object({
      month: z.string(), // YYYY-MM format
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.month + '-01')
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)
      
      const purchases = await ctx.prisma.purchaseInvoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceDate: {
            gte: startDate,
            lt: endDate,
          },
        },
      })
      
      const itcAsPerGSTR2A = purchases
        .filter(p => p.gstr2aMatched)
        .reduce((sum, p) => sum + p.itcClaimed.toNumber(), 0)
      
      const totalITCClaimed = purchases
        .reduce((sum, p) => sum + p.itcClaimed.toNumber(), 0)
      
      return checkRule36_4Compliance(itcAsPerGSTR2A, totalITCClaimed)
    }),
})

// Helper functions
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

async function updateITCRegister(
  ctx: any,
  userId: string,
  period: string,
  financialYear: string,
  itcCalculation: any
) {
  const existing = await ctx.prisma.iTCRegister.findUnique({
    where: {
      userId_period: {
        userId,
        period,
      },
    },
  })
  
  if (existing) {
    // Update existing register
    await ctx.prisma.iTCRegister.update({
      where: {
        userId_period: {
          userId,
          period,
        },
      },
      data: {
        eligibleITC: {
          increment: itcCalculation.eligibleITC,
        },
        claimedITC: {
          increment: itcCalculation.eligibleITC,
        },
        blockedITC: {
          increment: itcCalculation.blockedITC,
        },
        closingBalance: {
          increment: itcCalculation.eligibleITC,
        },
        // Update category breakup based on ITC category
        ...(itcCalculation.category === 'INPUTS' && {
          inputsITC: { increment: itcCalculation.eligibleITC },
        }),
        ...(itcCalculation.category === 'CAPITAL_GOODS' && {
          capitalGoodsITC: { increment: itcCalculation.eligibleITC },
        }),
        ...(itcCalculation.category === 'INPUT_SERVICES' && {
          inputServicesITC: { increment: itcCalculation.eligibleITC },
        }),
      },
    })
  } else {
    // Create new register
    await ctx.prisma.iTCRegister.create({
      data: {
        userId,
        period,
        financialYear,
        openingBalance: 0, // Will be updated from previous month
        eligibleITC: itcCalculation.eligibleITC,
        claimedITC: itcCalculation.eligibleITC,
        blockedITC: itcCalculation.blockedITC,
        reversedITC: 0,
        closingBalance: itcCalculation.eligibleITC,
        inputsITC: itcCalculation.category === 'INPUTS' ? itcCalculation.eligibleITC : 0,
        capitalGoodsITC: itcCalculation.category === 'CAPITAL_GOODS' ? itcCalculation.eligibleITC : 0,
        inputServicesITC: itcCalculation.category === 'INPUT_SERVICES' ? itcCalculation.eligibleITC : 0,
      },
    })
  }
}