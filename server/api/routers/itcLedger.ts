/**
 * ITC Ledger Router - Input Tax Credit Tracking
 *
 * Manages ITC ledger calculations and tracking by period.
 */

import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { ITCMatchStatus, InvoiceType } from '@prisma/client'

export const itcLedgerRouter = createTRPCRouter({
  /**
   * Get ITC ledger for a specific period
   */
  get: protectedProcedure
    .input(z.object({ returnPeriod: z.string().regex(/^\d{6}$/) }))
    .query(async ({ ctx, input }) => {
      const { returnPeriod } = input

      let ledger = await ctx.prisma.iTCLedger.findUnique({
        where: {
          userId_returnPeriod: {
            userId: ctx.session.user.id,
            returnPeriod,
          },
        },
      })

      if (!ledger) {
        // Create empty ledger
        ledger = await ctx.prisma.iTCLedger.create({
          data: {
            userId: ctx.session.user.id,
            returnPeriod,
          },
        })
      }

      return ledger
    }),

  /**
   * Recalculate ITC for a period based on self-invoices and GSTR-2B
   */
  recalculate: protectedProcedure
    .input(z.object({ returnPeriod: z.string().regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const { returnPeriod } = input

      // Parse period to get month/year
      const month = parseInt(returnPeriod.substring(0, 2))
      const year = parseInt(returnPeriod.substring(2, 6))

      // Calculate start and end dates for the period
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0) // Last day of month

      // Get RCM ITC from self-invoices in this period
      const selfInvoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceType: InvoiceType.SELF_INVOICE,
          invoiceDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      })

      let rcmIgst = 0
      let rcmCgst = 0
      let rcmSgst = 0

      for (const invoice of selfInvoices) {
        rcmIgst += Number(invoice.igstAmount)
        rcmCgst += Number(invoice.cgstAmount)
        rcmSgst += Number(invoice.sgstAmount)
      }

      // Get B2B ITC from matched GSTR-2B entries
      const gstr2bUpload = await ctx.prisma.gSTR2BUpload.findUnique({
        where: {
          userId_returnPeriod: {
            userId: ctx.session.user.id,
            returnPeriod,
          },
        },
        include: {
          entries: true,
        },
      })

      let b2bIgst = 0
      let b2bCgst = 0
      let b2bSgst = 0
      let atRiskIgst = 0
      let atRiskCgst = 0
      let atRiskSgst = 0

      if (gstr2bUpload) {
        for (const entry of gstr2bUpload.entries) {
          const igst = Number(entry.igst)
          const cgst = Number(entry.cgst)
          const sgst = Number(entry.sgst)

          if (
            entry.matchStatus === ITCMatchStatus.MATCHED ||
            entry.matchStatus === ITCMatchStatus.MANUALLY_RESOLVED
          ) {
            b2bIgst += igst
            b2bCgst += cgst
            b2bSgst += sgst
          } else if (
            entry.matchStatus === ITCMatchStatus.AMOUNT_MISMATCH ||
            entry.matchStatus === ITCMatchStatus.IN_2B_ONLY ||
            entry.matchStatus === ITCMatchStatus.PENDING
          ) {
            atRiskIgst += igst
            atRiskCgst += cgst
            atRiskSgst += sgst
          }
        }
      }

      // Calculate net ITC
      const netIgst = rcmIgst + b2bIgst
      const netCgst = rcmCgst + b2bCgst
      const netSgst = rcmSgst + b2bSgst

      // Upsert ledger
      const ledger = await ctx.prisma.iTCLedger.upsert({
        where: {
          userId_returnPeriod: {
            userId: ctx.session.user.id,
            returnPeriod,
          },
        },
        create: {
          userId: ctx.session.user.id,
          returnPeriod,
          rcmIgst,
          rcmCgst,
          rcmSgst,
          b2bIgst,
          b2bCgst,
          b2bSgst,
          atRiskIgst,
          atRiskCgst,
          atRiskSgst,
          netIgst,
          netCgst,
          netSgst,
        },
        update: {
          rcmIgst,
          rcmCgst,
          rcmSgst,
          b2bIgst,
          b2bCgst,
          b2bSgst,
          atRiskIgst,
          atRiskCgst,
          atRiskSgst,
          netIgst,
          netCgst,
          netSgst,
        },
      })

      return ledger
    }),

  /**
   * Get ITC history over multiple periods
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        startPeriod: z.string().regex(/^\d{6}$/).optional(),
        endPeriod: z.string().regex(/^\d{6}$/).optional(),
        limit: z.number().min(1).max(24).default(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const { startPeriod, endPeriod, limit } = input

      const ledgers = await ctx.prisma.iTCLedger.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(startPeriod && { returnPeriod: { gte: startPeriod } }),
          ...(endPeriod && { returnPeriod: { lte: endPeriod } }),
        },
        orderBy: { returnPeriod: 'desc' },
        take: limit,
      })

      // Calculate totals
      const totals = {
        rcmIgst: 0,
        rcmCgst: 0,
        rcmSgst: 0,
        b2bIgst: 0,
        b2bCgst: 0,
        b2bSgst: 0,
        atRiskIgst: 0,
        atRiskCgst: 0,
        atRiskSgst: 0,
        netIgst: 0,
        netCgst: 0,
        netSgst: 0,
      }

      for (const ledger of ledgers) {
        totals.rcmIgst += Number(ledger.rcmIgst)
        totals.rcmCgst += Number(ledger.rcmCgst)
        totals.rcmSgst += Number(ledger.rcmSgst)
        totals.b2bIgst += Number(ledger.b2bIgst)
        totals.b2bCgst += Number(ledger.b2bCgst)
        totals.b2bSgst += Number(ledger.b2bSgst)
        totals.atRiskIgst += Number(ledger.atRiskIgst)
        totals.atRiskCgst += Number(ledger.atRiskCgst)
        totals.atRiskSgst += Number(ledger.atRiskSgst)
        totals.netIgst += Number(ledger.netIgst)
        totals.netCgst += Number(ledger.netCgst)
        totals.netSgst += Number(ledger.netSgst)
      }

      return {
        ledgers,
        totals,
      }
    }),

  /**
   * Get ITC breakdown by source (RCM vs B2B)
   */
  getBreakdown: protectedProcedure
    .input(z.object({ returnPeriod: z.string().regex(/^\d{6}$/) }))
    .query(async ({ ctx, input }) => {
      const { returnPeriod } = input

      const month = parseInt(returnPeriod.substring(0, 2))
      const year = parseInt(returnPeriod.substring(2, 6))
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      // Get RCM breakdown by type
      const selfInvoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceType: InvoiceType.SELF_INVOICE,
          invoiceDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          unregisteredSupplier: true,
        },
      })

      const rcmByType: Record<string, { count: number; igst: number; cgst: number; sgst: number }> = {
        INDIAN_UNREGISTERED: { count: 0, igst: 0, cgst: 0, sgst: 0 },
        IMPORT_OF_SERVICES: { count: 0, igst: 0, cgst: 0, sgst: 0 },
      }

      for (const invoice of selfInvoices) {
        const type = invoice.rcmType || 'INDIAN_UNREGISTERED'
        if (!rcmByType[type]) {
          rcmByType[type] = { count: 0, igst: 0, cgst: 0, sgst: 0 }
        }
        rcmByType[type].count++
        rcmByType[type].igst += Number(invoice.igstAmount)
        rcmByType[type].cgst += Number(invoice.cgstAmount)
        rcmByType[type].sgst += Number(invoice.sgstAmount)
      }

      // Get B2B breakdown by vendor
      const gstr2bUpload = await ctx.prisma.gSTR2BUpload.findUnique({
        where: {
          userId_returnPeriod: {
            userId: ctx.session.user.id,
            returnPeriod,
          },
        },
        include: {
          entries: {
            where: {
              matchStatus: {
                in: [ITCMatchStatus.MATCHED, ITCMatchStatus.MANUALLY_RESOLVED],
              },
            },
          },
        },
      })

      const b2bByVendor: Record<string, { vendorName?: string; count: number; igst: number; cgst: number; sgst: number }> = {}

      if (gstr2bUpload) {
        for (const entry of gstr2bUpload.entries) {
          if (!b2bByVendor[entry.vendorGstin]) {
            b2bByVendor[entry.vendorGstin] = {
              vendorName: entry.vendorName || undefined,
              count: 0,
              igst: 0,
              cgst: 0,
              sgst: 0,
            }
          }
          b2bByVendor[entry.vendorGstin].count++
          b2bByVendor[entry.vendorGstin].igst += Number(entry.igst)
          b2bByVendor[entry.vendorGstin].cgst += Number(entry.cgst)
          b2bByVendor[entry.vendorGstin].sgst += Number(entry.sgst)
        }
      }

      return {
        rcmByType,
        b2bByVendor,
      }
    }),

  /**
   * Get available periods (periods with data)
   */
  getAvailablePeriods: protectedProcedure.query(async ({ ctx }) => {
    // Get periods from ITC ledger
    const ledgerPeriods = await ctx.prisma.iTCLedger.findMany({
      where: { userId: ctx.session.user.id },
      select: { returnPeriod: true },
      orderBy: { returnPeriod: 'desc' },
    })

    // Get periods from GSTR-2B uploads
    const uploadPeriods = await ctx.prisma.gSTR2BUpload.findMany({
      where: { userId: ctx.session.user.id },
      select: { returnPeriod: true },
      orderBy: { returnPeriod: 'desc' },
    })

    // Combine and deduplicate
    const allPeriods = new Set<string>([
      ...ledgerPeriods.map((l) => l.returnPeriod),
      ...uploadPeriods.map((u) => u.returnPeriod),
    ])

    return Array.from(allPeriods).sort().reverse()
  }),
})
