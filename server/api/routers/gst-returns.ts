/**
 * GST Returns tRPC Router
 * Handles GST return generation, management, and filing
 */

import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { TRPCError } from "@trpc/server"
import { generateGSTR1, generateGSTR3B } from "@/lib/gst-returns"
import { getStateCodeFromGSTIN } from "@/lib/gst"

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

      const supplierStateCode = getStateCodeFromGSTIN(user.gstin)
      if (!supplierStateCode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid GSTIN format"
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
        },
        include: {
          client: true,
          lineItems: true
        }
      })

      // Generate GSTR-1 JSON
      const gstr1Json = generateGSTR1(
        invoices,
        user.gstin,
        input.month,
        input.year,
        supplierStateCode
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

      // Generate GSTR-3B JSON
      const gstr3bJson = generateGSTR3B(
        invoices,
        purchaseInvoices,
        user.gstin,
        input.month,
        input.year
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