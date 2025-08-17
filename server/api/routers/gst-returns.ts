/**
 * GST Returns tRPC Router
 * Handles GST return generation, management, and filing
 */

import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { TRPCError } from "@trpc/server"
import { generateGSTR1, validateGSTR1Data } from "@/lib/gst-returns/gstr1-generator"
import { generateGSTR3B, validateGSTR3BData } from "@/lib/gst-returns/gstr3b-generator"
import { Decimal } from '@prisma/client/runtime/library'

export const gstReturnsRouter = createTRPCRouter({
  /**
   * Generate GSTR-1 for a given period
   */
  generateGSTR1: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { gstin: true }
      })

      if (!user?.gstin) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GSTIN not configured for user"
        })
      }

      // Get turnover for HSN code length determination
      const yearStart = new Date(input.year - 1, 3, 1) // April of previous year
      const yearEnd = new Date(input.year, 2, 31, 23, 59, 59) // March of current year
      
      const yearInvoices = await ctx.prisma.invoice.findMany({
        where: {
          userId,
          invoiceDate: {
            gte: yearStart,
            lte: yearEnd
          },
          status: { not: "DRAFT" }
        },
        select: {
          subtotal: true,
          taxableAmount: true
        }
      })
      
      const turnover = yearInvoices.reduce((sum, inv) => 
        sum + (inv.taxableAmount || inv.subtotal).toNumber(), 0)

      // Get start and end dates for the period
      const startDate = new Date(input.year, input.month - 1, 1)
      const endDate = new Date(input.year, input.month, 0, 23, 59, 59)

      // Fetch all invoices for the period
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId,
          invoiceDate: {
            gte: startDate,
            lte: endDate
          },
          status: {
            not: "DRAFT"
          }
        },
        include: {
          client: true,
          lineItems: true
        }
      })

      // Transform invoices to match our generator interface
      const transformedInvoices = invoices.map(inv => ({
        ...inv,
        taxableAmount: inv.taxableAmount || inv.subtotal,
        cgstAmount: inv.cgstAmount || new Decimal(0),
        sgstAmount: inv.sgstAmount || new Decimal(0),
        igstAmount: inv.igstAmount || new Decimal(0),
        placeOfSupply: inv.placeOfSupply || inv.client.stateCode || '00',
        lineItems: inv.lineItems.map(item => ({
          ...item,
          serviceCode: item.serviceCode || '998314',
          cgstAmount: item.cgstAmount || new Decimal(0),
          sgstAmount: item.sgstAmount || new Decimal(0),
          igstAmount: item.igstAmount || new Decimal(0),
          cgstRate: item.cgstRate || new Decimal(0),
          sgstRate: item.sgstRate || new Decimal(0),
          igstRate: item.igstRate || new Decimal(0),
          uqc: item.uqc || 'OTH'
        }))
      }))

      // Get credit notes and debit notes
      const creditNotes: any[] = [] // Implement later if needed
      const debitNotes: any[] = [] // Implement later if needed

      // Generate GSTR-1 JSON
      const period = `${input.month.toString().padStart(2, '0')}${input.year}`
      const gstr1Json = generateGSTR1(
        transformedInvoices,
        creditNotes,
        debitNotes,
        {
          gstin: user.gstin,
          period,
          turnover
        }
      )

      // Check if return already exists
      const existingReturn = await ctx.prisma.gSTReturn.findUnique({
        where: {
          userId_returnType_period: {
            userId,
            returnType: "GSTR1",
            period: `${input.month.toString().padStart(2, '0')}-${input.year}`
          }
        }
      })

      // Save or update the return in database
      const gstReturn = await ctx.prisma.gSTReturn.upsert({
        where: {
          userId_returnType_period: {
            userId,
            returnType: "GSTR1",
            period: `${input.month.toString().padStart(2, '0')}-${input.year}`
          }
        },
        create: {
          userId,
          returnType: "GSTR1",
          period: `${input.month.toString().padStart(2, '0')}-${input.year}`,
          filingStatus: "DRAFT",
          b2bInvoices: gstr1Json.b2b as any || undefined,
          b2cInvoices: gstr1Json.b2cl as any || undefined,
          b2csInvoices: gstr1Json.b2cs as any || undefined,
          exportInvoices: gstr1Json.exp as any || undefined,
          hsnSummary: gstr1Json.hsn as any || undefined,
          jsonOutput: gstr1Json as any
        },
        update: {
          b2bInvoices: gstr1Json.b2b as any || undefined,
          b2cInvoices: gstr1Json.b2cl as any || undefined,
          b2csInvoices: gstr1Json.b2cs as any || undefined,
          exportInvoices: gstr1Json.exp as any || undefined,
          hsnSummary: gstr1Json.hsn as any || undefined,
          jsonOutput: gstr1Json as any,
          filingStatus: existingReturn?.filingStatus === "FILED" ? "FILED" : "DRAFT"
        }
      })

      return {
        success: true,
        returnId: gstReturn.id,
        data: gstr1Json
      }
    }),

  /**
   * Generate GSTR-3B for a given period
   */
  generateGSTR3B: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020).max(2100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { gstin: true }
      })

      if (!user?.gstin) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GSTIN not configured for user"
        })
      }

      // Get start and end dates for the period
      const startDate = new Date(input.year, input.month - 1, 1)
      const endDate = new Date(input.year, input.month, 0, 23, 59, 59)

      // Fetch all invoices for the period
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId,
          invoiceDate: {
            gte: startDate,
            lte: endDate
          },
          status: {
            not: "DRAFT"
          }
        }
      })

      // Fetch all purchase invoices for the period
      const purchaseInvoices = await ctx.prisma.purchaseInvoice.findMany({
        where: {
          userId,
          invoiceDate: {
            gte: startDate,
            lte: endDate
          }
        }
      })

      // Transform invoices to match our generator interface
      const transformedInvoices = invoices.map(inv => ({
        ...inv,
        taxableAmount: inv.taxableAmount || inv.subtotal,
        cgstAmount: inv.cgstAmount || new Decimal(0),
        sgstAmount: inv.sgstAmount || new Decimal(0),
        igstAmount: inv.igstAmount || new Decimal(0)
      }))

      const transformedPurchases = purchaseInvoices.map(purchase => ({
        ...purchase,
        itcClaimed: purchase.itcClaimed || new Decimal(0),
        itcReversed: purchase.itcReversed || new Decimal(0)
      }))

      // Generate GSTR-3B JSON
      const period = `${input.month.toString().padStart(2, '0')}${input.year}`
      const gstr3bJson = generateGSTR3B(
        transformedInvoices,
        transformedPurchases,
        {
          gstin: user.gstin,
          period
        }
      )

      // Calculate totals for storage
      const outputTax = gstr3bJson.sup_details.osup_det.iamt + 
                       gstr3bJson.sup_details.osup_det.camt + 
                       gstr3bJson.sup_details.osup_det.samt
      
      const inputTaxClaim = gstr3bJson.itc_elg.itc_net.iamt + 
                           gstr3bJson.itc_elg.itc_net.camt + 
                           gstr3bJson.itc_elg.itc_net.samt
      
      const netTaxPayable = Math.max(0, outputTax - inputTaxClaim)

      // Save or update the return in database
      const gstReturn = await ctx.prisma.gSTReturn.upsert({
        where: {
          userId_returnType_period: {
            userId,
            returnType: "GSTR3B",
            period: `${input.month.toString().padStart(2, '0')}-${input.year}`
          }
        },
        create: {
          userId,
          returnType: "GSTR3B",
          period: `${input.month.toString().padStart(2, '0')}-${input.year}`,
          filingStatus: "DRAFT",
          outputTax,
          inputTaxClaim,
          netTaxPayable,
          jsonOutput: gstr3bJson as any
        },
        update: {
          outputTax,
          inputTaxClaim,
          netTaxPayable,
          jsonOutput: gstr3bJson as any,
          filingStatus: "DRAFT"
        }
      })

      return {
        success: true,
        returnId: gstReturn.id,
        data: gstr3bJson
      }
    }),

  /**
   * Get all returns for a user
   */
  getReturns: protectedProcedure
    .input(
      z.object({
        returnType: z.enum(["GSTR1", "GSTR3B", "GSTR2A", "GSTR9"]).optional(),
        year: z.number().optional(),
        filingStatus: z.enum(["DRAFT", "READY", "FILED", "AMENDED"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const where: any = { userId }
      
      if (input?.returnType) {
        where.returnType = input.returnType
      }
      
      if (input?.year) {
        where.period = {
          contains: input.year.toString()
        }
      }
      
      if (input?.filingStatus) {
        where.filingStatus = input.filingStatus
      }

      const returns = await ctx.prisma.gSTReturn.findMany({
        where,
        orderBy: {
          period: "desc"
        }
      })

      return returns
    }),

  /**
   * Get a specific return by ID
   */
  getReturnById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const gstReturn = await ctx.prisma.gSTReturn.findFirst({
        where: {
          id: input,
          userId
        }
      })

      if (!gstReturn) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Return not found"
        })
      }

      return gstReturn
    }),

  /**
   * Update filing status of a return
   */
  updateFilingStatus: protectedProcedure
    .input(
      z.object({
        returnId: z.string(),
        filingStatus: z.enum(["DRAFT", "READY", "FILED", "AMENDED"]),
        arn: z.string().optional(),
        filingDate: z.date().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      // Verify ownership
      const existingReturn = await ctx.prisma.gSTReturn.findFirst({
        where: {
          id: input.returnId,
          userId
        }
      })

      if (!existingReturn) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Return not found"
        })
      }

      const updatedReturn = await ctx.prisma.gSTReturn.update({
        where: { id: input.returnId },
        data: {
          filingStatus: input.filingStatus,
          arn: input.arn,
          filingDate: input.filingDate
        }
      })

      return updatedReturn
    }),

  /**
   * Download return as JSON file
   */
  downloadReturnJSON: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const gstReturn = await ctx.prisma.gSTReturn.findFirst({
        where: {
          id: input,
          userId
        }
      })

      if (!gstReturn) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Return not found"
        })
      }

      return {
        filename: `${gstReturn.returnType}_${gstReturn.period.replace('-', '')}.json`,
        data: gstReturn.jsonOutput
      }
    }),

  /**
   * Get return summary for dashboard
   */
  getReturnSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id
      
      // Get current month and year
      const currentDate = new Date()
      const currentMonth = currentDate.getMonth() + 1
      const currentYear = currentDate.getFullYear()
      
      // Calculate due dates
      const gstr1DueDate = new Date(currentYear, currentMonth - 1, 11) // 11th of current month
      const gstr3bDueDate = new Date(currentYear, currentMonth - 1, 20) // 20th of current month
      
      // Get last 3 months of returns
      const returns = await ctx.prisma.gSTReturn.findMany({
        where: { userId },
        orderBy: { period: "desc" },
        take: 6
      })

      // Calculate pending returns
      const pendingGSTR1 = returns.filter(r => 
        r.returnType === "GSTR1" && r.filingStatus !== "FILED"
      )
      
      const pendingGSTR3B = returns.filter(r => 
        r.returnType === "GSTR3B" && r.filingStatus !== "FILED"
      )

      return {
        currentPeriod: `${currentMonth.toString().padStart(2, '0')}-${currentYear}`,
        dueDates: {
          gstr1: gstr1DueDate,
          gstr3b: gstr3bDueDate
        },
        pendingReturns: {
          gstr1: pendingGSTR1.length,
          gstr3b: pendingGSTR3B.length
        },
        recentReturns: returns
      }
    }),
})