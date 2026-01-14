/**
 * GSTR-2B Router - ITC Reconciliation
 *
 * Handles GSTR-2B upload, parsing, and reconciliation with purchase invoices.
 */

import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { ITCMatchStatus, InvoiceType } from '@prisma/client'
import { parseGSTR2B, validateGSTR2BJson, type GSTR2BJson } from '@/lib/gstr2b-parser'
import {
  runReconciliation,
  findPotentialMatches,
  type PurchaseInvoice,
  type GSTR2BEntry as ReconciliationEntry,
} from '@/lib/itc-reconciliation'

// Input schemas
const matchStatusSchema = z.nativeEnum(ITCMatchStatus)

export const gstr2bRouter = createTRPCRouter({
  /**
   * Upload and parse GSTR-2B JSON
   */
  upload: protectedProcedure
    .input(
      z.object({
        jsonData: z.unknown(),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { jsonData, fileName } = input

      // Validate GSTR-2B JSON structure
      if (!validateGSTR2BJson(jsonData)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid GSTR-2B JSON structure. Expected gstin (15 chars) and fp (6 chars) fields.',
        })
      }

      const gstr2bJson = jsonData as GSTR2BJson

      // Parse the JSON
      const parseResult = parseGSTR2B(gstr2bJson)
      if (!parseResult.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: parseResult.error || 'Failed to parse GSTR-2B JSON',
        })
      }

      // Check if upload already exists for this period
      const existingUpload = await ctx.prisma.gSTR2BUpload.findUnique({
        where: {
          userId_returnPeriod: {
            userId: ctx.session.user.id,
            returnPeriod: parseResult.returnPeriod!,
          },
        },
      })

      if (existingUpload) {
        // Delete existing entries and update
        await ctx.prisma.gSTR2BEntry.deleteMany({
          where: { uploadId: existingUpload.id },
        })

        await ctx.prisma.gSTR2BUpload.update({
          where: { id: existingUpload.id },
          data: {
            gstin: parseResult.gstin!,
            fileName,
            rawJson: jsonData as object,
            status: 'PROCESSING',
            entriesCount: parseResult.entries.length,
            matchedCount: 0,
            mismatchedCount: 0,
            errorMessage: null,
          },
        })

        // Insert new entries
        if (parseResult.entries.length > 0) {
          await ctx.prisma.gSTR2BEntry.createMany({
            data: parseResult.entries.map((entry) => ({
              uploadId: existingUpload.id,
              vendorGstin: entry.vendorGstin,
              vendorName: entry.vendorName,
              invoiceNumber: entry.invoiceNumber,
              invoiceDate: entry.invoiceDate,
              invoiceValue: entry.invoiceValue,
              taxableValue: entry.taxableValue,
              igst: entry.igst,
              cgst: entry.cgst,
              sgst: entry.sgst,
              cess: entry.cess,
              supplyType: entry.supplyType,
              itcAvailability: entry.itcAvailability,
              reason: entry.reason,
            })),
          })
        }

        await ctx.prisma.gSTR2BUpload.update({
          where: { id: existingUpload.id },
          data: { status: 'COMPLETED' },
        })

        return {
          id: existingUpload.id,
          entriesCount: parseResult.entries.length,
          summary: parseResult.summary,
          isUpdate: true,
        }
      }

      // Create new upload
      const upload = await ctx.prisma.gSTR2BUpload.create({
        data: {
          userId: ctx.session.user.id,
          gstin: parseResult.gstin!,
          returnPeriod: parseResult.returnPeriod!,
          fileName,
          rawJson: jsonData as object,
          status: 'PROCESSING',
          entriesCount: parseResult.entries.length,
        },
      })

      // Insert entries
      if (parseResult.entries.length > 0) {
        await ctx.prisma.gSTR2BEntry.createMany({
          data: parseResult.entries.map((entry) => ({
            uploadId: upload.id,
            vendorGstin: entry.vendorGstin,
            vendorName: entry.vendorName,
            invoiceNumber: entry.invoiceNumber,
            invoiceDate: entry.invoiceDate,
            invoiceValue: entry.invoiceValue,
            taxableValue: entry.taxableValue,
            igst: entry.igst,
            cgst: entry.cgst,
            sgst: entry.sgst,
            cess: entry.cess,
            supplyType: entry.supplyType,
            itcAvailability: entry.itcAvailability,
            reason: entry.reason,
          })),
        })
      }

      await ctx.prisma.gSTR2BUpload.update({
        where: { id: upload.id },
        data: { status: 'COMPLETED' },
      })

      return {
        id: upload.id,
        entriesCount: parseResult.entries.length,
        summary: parseResult.summary,
        isUpdate: false,
      }
    }),

  /**
   * List GSTR-2B uploads
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input

      const uploads = await ctx.prisma.gSTR2BUpload.findMany({
        where: { userId: ctx.session.user.id },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { returnPeriod: 'desc' },
        select: {
          id: true,
          gstin: true,
          returnPeriod: true,
          fileName: true,
          status: true,
          entriesCount: true,
          matchedCount: true,
          mismatchedCount: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      let nextCursor: string | undefined
      if (uploads.length > limit) {
        const nextItem = uploads.pop()
        nextCursor = nextItem?.id
      }

      return {
        uploads,
        nextCursor,
      }
    }),

  /**
   * Get upload by ID with summary
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const upload = await ctx.prisma.gSTR2BUpload.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          _count: {
            select: { entries: true },
          },
        },
      })

      if (!upload) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'GSTR-2B upload not found',
        })
      }

      // Get match status counts
      const statusCounts = await ctx.prisma.gSTR2BEntry.groupBy({
        by: ['matchStatus'],
        where: { uploadId: upload.id },
        _count: true,
      })

      const statusCountMap = Object.fromEntries(
        statusCounts.map((s) => [s.matchStatus, s._count])
      )

      return {
        ...upload,
        statusCounts: statusCountMap,
      }
    }),

  /**
   * Get upload by return period
   */
  getByPeriod: protectedProcedure
    .input(z.object({ returnPeriod: z.string() }))
    .query(async ({ ctx, input }) => {
      const upload = await ctx.prisma.gSTR2BUpload.findFirst({
        where: {
          returnPeriod: input.returnPeriod,
          userId: ctx.session.user.id,
        },
        include: {
          _count: {
            select: { entries: true },
          },
        },
      })

      if (!upload) {
        return { upload: null }
      }

      // Get match status counts
      const statusCounts = await ctx.prisma.gSTR2BEntry.groupBy({
        by: ['matchStatus'],
        where: { uploadId: upload.id },
        _count: true,
      })

      const statusCountMap = Object.fromEntries(
        statusCounts.map((s) => [s.matchStatus, s._count])
      )

      const matchedCount = (statusCountMap['MATCHED'] || 0) + (statusCountMap['MANUALLY_RESOLVED'] || 0)
      const mismatchedCount = (statusCountMap['AMOUNT_MISMATCH'] || 0) + (statusCountMap['NOT_IN_2B'] || 0) + (statusCountMap['IN_2B_ONLY'] || 0)

      return {
        upload: {
          ...upload,
          entriesCount: upload._count.entries,
          matchedCount,
          mismatchedCount,
          statusCounts: statusCountMap,
        },
      }
    }),

  /**
   * Get entries for an upload with filtering
   */
  getEntries: protectedProcedure
    .input(
      z.object({
        uploadId: z.string(),
        matchStatus: matchStatusSchema.optional(),
        vendorGstin: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { uploadId, matchStatus, vendorGstin, limit, cursor } = input

      // Verify upload belongs to user
      const upload = await ctx.prisma.gSTR2BUpload.findFirst({
        where: {
          id: uploadId,
          userId: ctx.session.user.id,
        },
      })

      if (!upload) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'GSTR-2B upload not found',
        })
      }

      const entries = await ctx.prisma.gSTR2BEntry.findMany({
        where: {
          uploadId,
          ...(matchStatus && { matchStatus }),
          ...(vendorGstin && { vendorGstin }),
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: [{ matchStatus: 'asc' }, { invoiceDate: 'desc' }],
      })

      let nextCursor: string | undefined
      if (entries.length > limit) {
        const nextItem = entries.pop()
        nextCursor = nextItem?.id
      }

      return {
        entries,
        nextCursor,
      }
    }),

  /**
   * Run reconciliation for an upload
   */
  runReconciliation: protectedProcedure
    .input(z.object({ uploadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { uploadId } = input

      // Get upload
      const upload = await ctx.prisma.gSTR2BUpload.findFirst({
        where: {
          id: uploadId,
          userId: ctx.session.user.id,
        },
        include: {
          entries: true,
        },
      })

      if (!upload) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'GSTR-2B upload not found',
        })
      }

      // Get user's purchase invoices (self-invoices with vendors)
      // Self-invoices are Invoices with invoiceType: SELF_INVOICE
      const selfInvoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceType: InvoiceType.SELF_INVOICE,
        },
        include: {
          unregisteredSupplier: true,
        },
      })

      // Convert to PurchaseInvoice format
      // Note: Unregistered suppliers don't have GSTIN - vendorGstin is empty
      // For proper B2B reconciliation, we need purchase invoices from registered vendors
      const purchaseInvoices: PurchaseInvoice[] = selfInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorGstin: '', // Unregistered suppliers don't have GSTIN
        invoiceDate: inv.invoiceDate,
        taxableValue: Number(inv.subtotal),
        igst: Number(inv.igstAmount),
        cgst: Number(inv.cgstAmount),
        sgst: Number(inv.sgstAmount),
      }))

      // Convert GSTR-2B entries to reconciliation format
      const gstr2bEntries: ReconciliationEntry[] = upload.entries.map((entry) => ({
        vendorGstin: entry.vendorGstin,
        invoiceNumber: entry.invoiceNumber,
        invoiceDate: entry.invoiceDate,
        taxableValue: Number(entry.taxableValue),
        igst: Number(entry.igst),
        cgst: Number(entry.cgst),
        sgst: Number(entry.sgst),
        cess: Number(entry.cess),
      }))

      // Run reconciliation
      const result = runReconciliation(purchaseInvoices, gstr2bEntries)

      // Update entries with match results
      const updatePromises: Promise<unknown>[] = []

      // Update matched entries
      for (const match of result.matched) {
        const entry = upload.entries.find(
          (e) => e.invoiceNumber === match.gstr2bEntry.invoiceNumber &&
                 e.vendorGstin === match.gstr2bEntry.vendorGstin
        )
        if (entry) {
          updatePromises.push(
            ctx.prisma.gSTR2BEntry.update({
              where: { id: entry.id },
              data: {
                matchStatus: ITCMatchStatus.MATCHED,
                matchedInvoiceId: match.invoice.id,
                matchConfidence: match.matchResult.confidence / 100,
              },
            })
          )
        }
      }

      // Update mismatched entries
      for (const mismatch of result.amountMismatches) {
        const entry = upload.entries.find(
          (e) => e.invoiceNumber === mismatch.gstr2bEntry.invoiceNumber &&
                 e.vendorGstin === mismatch.gstr2bEntry.vendorGstin
        )
        if (entry) {
          updatePromises.push(
            ctx.prisma.gSTR2BEntry.update({
              where: { id: entry.id },
              data: {
                matchStatus: ITCMatchStatus.AMOUNT_MISMATCH,
                matchedInvoiceId: mismatch.invoice.id,
                mismatchDetails: mismatch.mismatchDetails as object,
              },
            })
          )
        }
      }

      // Update entries only in 2B
      for (const entry2b of result.in2BOnly) {
        const entry = upload.entries.find(
          (e) => e.invoiceNumber === entry2b.invoiceNumber &&
                 e.vendorGstin === entry2b.vendorGstin
        )
        if (entry) {
          updatePromises.push(
            ctx.prisma.gSTR2BEntry.update({
              where: { id: entry.id },
              data: {
                matchStatus: ITCMatchStatus.IN_2B_ONLY,
              },
            })
          )
        }
      }

      await Promise.all(updatePromises)

      // Update upload summary
      await ctx.prisma.gSTR2BUpload.update({
        where: { id: uploadId },
        data: {
          matchedCount: result.summary.totalMatched,
          mismatchedCount: result.summary.totalAmountMismatches + result.summary.totalIn2BOnly,
        },
      })

      return {
        matched: result.summary.totalMatched,
        amountMismatches: result.summary.totalAmountMismatches,
        in2BOnly: result.summary.totalIn2BOnly,
        notIn2B: result.summary.totalNotIn2B,
        totalMatchedITC: result.summary.totalMatchedITC,
      }
    }),

  /**
   * Manually match an entry to an invoice
   */
  manualMatch: protectedProcedure
    .input(
      z.object({
        entryId: z.string(),
        invoiceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { entryId, invoiceId } = input

      // Get entry with upload
      const entry = await ctx.prisma.gSTR2BEntry.findFirst({
        where: { id: entryId },
        include: {
          upload: true,
        },
      })

      if (!entry || entry.upload.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entry not found',
        })
      }

      // Verify invoice exists and belongs to user
      const invoice = await ctx.prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          userId: ctx.session.user.id,
          invoiceType: InvoiceType.SELF_INVOICE,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      // Update entry
      await ctx.prisma.gSTR2BEntry.update({
        where: { id: entryId },
        data: {
          matchStatus: ITCMatchStatus.MANUALLY_RESOLVED,
          matchedInvoiceId: invoiceId,
          matchConfidence: 1.0,
        },
      })

      return { success: true }
    }),

  /**
   * Update match status
   */
  updateMatchStatus: protectedProcedure
    .input(
      z.object({
        entryId: z.string(),
        status: matchStatusSchema,
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { entryId, status, notes } = input

      // Get entry with upload
      const entry = await ctx.prisma.gSTR2BEntry.findFirst({
        where: { id: entryId },
        include: {
          upload: true,
        },
      })

      if (!entry || entry.upload.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entry not found',
        })
      }

      await ctx.prisma.gSTR2BEntry.update({
        where: { id: entryId },
        data: {
          matchStatus: status,
          ...(notes && {
            mismatchDetails: {
              ...((entry.mismatchDetails as object) || {}),
              notes,
            },
          }),
        },
      })

      return { success: true }
    }),

  /**
   * Get reconciliation summary for a period
   */
  getSummary: protectedProcedure
    .input(z.object({ uploadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const upload = await ctx.prisma.gSTR2BUpload.findFirst({
        where: {
          id: input.uploadId,
          userId: ctx.session.user.id,
        },
      })

      if (!upload) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'GSTR-2B upload not found',
        })
      }

      // Get aggregated data by status
      const entries = await ctx.prisma.gSTR2BEntry.findMany({
        where: { uploadId: upload.id },
      })

      const summary = {
        total: entries.length,
        matched: 0,
        matchedITC: { igst: 0, cgst: 0, sgst: 0 },
        amountMismatch: 0,
        mismatchITC: { igst: 0, cgst: 0, sgst: 0 },
        in2BOnly: 0,
        in2BOnlyITC: { igst: 0, cgst: 0, sgst: 0 },
        pending: 0,
        pendingITC: { igst: 0, cgst: 0, sgst: 0 },
        rejected: 0,
        manuallyResolved: 0,
        resolvedITC: { igst: 0, cgst: 0, sgst: 0 },
      }

      for (const entry of entries) {
        const igst = Number(entry.igst)
        const cgst = Number(entry.cgst)
        const sgst = Number(entry.sgst)

        switch (entry.matchStatus) {
          case ITCMatchStatus.MATCHED:
            summary.matched++
            summary.matchedITC.igst += igst
            summary.matchedITC.cgst += cgst
            summary.matchedITC.sgst += sgst
            break
          case ITCMatchStatus.AMOUNT_MISMATCH:
            summary.amountMismatch++
            summary.mismatchITC.igst += igst
            summary.mismatchITC.cgst += cgst
            summary.mismatchITC.sgst += sgst
            break
          case ITCMatchStatus.IN_2B_ONLY:
            summary.in2BOnly++
            summary.in2BOnlyITC.igst += igst
            summary.in2BOnlyITC.cgst += cgst
            summary.in2BOnlyITC.sgst += sgst
            break
          case ITCMatchStatus.PENDING:
            summary.pending++
            summary.pendingITC.igst += igst
            summary.pendingITC.cgst += cgst
            summary.pendingITC.sgst += sgst
            break
          case ITCMatchStatus.REJECTED:
            summary.rejected++
            break
          case ITCMatchStatus.MANUALLY_RESOLVED:
            summary.manuallyResolved++
            summary.resolvedITC.igst += igst
            summary.resolvedITC.cgst += cgst
            summary.resolvedITC.sgst += sgst
            break
        }
      }

      return summary
    }),

  /**
   * Find potential matches for an unmatched entry
   */
  findPotentialMatches: protectedProcedure
    .input(
      z.object({
        entryId: z.string(),
        limit: z.number().min(1).max(10).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const { entryId, limit } = input

      // Get entry
      const entry = await ctx.prisma.gSTR2BEntry.findFirst({
        where: { id: entryId },
        include: { upload: true },
      })

      if (!entry || entry.upload.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entry not found',
        })
      }

      // Get user's purchase invoices (self-invoices)
      const selfInvoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceType: InvoiceType.SELF_INVOICE,
        },
        include: { unregisteredSupplier: true },
      })

      const purchaseInvoices: PurchaseInvoice[] = selfInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorGstin: '', // Unregistered suppliers don't have GSTIN
        invoiceDate: inv.invoiceDate,
        taxableValue: Number(inv.subtotal),
        igst: Number(inv.igstAmount),
        cgst: Number(inv.cgstAmount),
        sgst: Number(inv.sgstAmount),
      }))

      const gstr2bEntry: ReconciliationEntry = {
        vendorGstin: entry.vendorGstin,
        invoiceNumber: entry.invoiceNumber,
        invoiceDate: entry.invoiceDate,
        taxableValue: Number(entry.taxableValue),
        igst: Number(entry.igst),
        cgst: Number(entry.cgst),
        sgst: Number(entry.sgst),
      }

      const matches = findPotentialMatches(gstr2bEntry, purchaseInvoices, limit)

      // Get full invoice details for matches
      const invoiceIds = matches.map((m) => m.invoice.id)
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          id: { in: invoiceIds },
          invoiceType: InvoiceType.SELF_INVOICE,
        },
        include: { unregisteredSupplier: true },
      })

      return matches.map((match) => ({
        invoice: invoices.find((i) => i.id === match.invoice.id),
        similarity: match.similarity,
      }))
    }),
})
