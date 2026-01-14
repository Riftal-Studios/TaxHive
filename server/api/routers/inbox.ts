/**
 * Inbox Router - Smart Invoice Inbox
 *
 * Handles document uploads, AI classification, review, and conversion to invoices.
 */

import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import {
  DocumentSourceType,
  DocumentStatus,
  DocumentClassification,
  ReviewStatus,
  Prisma,
} from '@prisma/client'
import { getQueueService } from '@/lib/queue'

// Input schemas
const documentSourceTypeSchema = z.nativeEnum(DocumentSourceType)
const documentStatusSchema = z.nativeEnum(DocumentStatus)
const documentClassificationSchema = z.nativeEnum(DocumentClassification)
const reviewStatusSchema = z.nativeEnum(ReviewStatus)

export const inboxRouter = createTRPCRouter({
  /**
   * List documents in inbox with filtering and pagination
   */
  list: protectedProcedure
    .input(
      z.object({
        status: documentStatusSchema.optional(),
        classification: documentClassificationSchema.optional(),
        reviewStatus: reviewStatusSchema.optional(),
        sourceType: documentSourceTypeSchema.optional(),
        query: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status, classification, reviewStatus, sourceType, query, limit, cursor } = input

      const where = {
        userId: ctx.session.user.id,
        ...(status && { status }),
        ...(classification && { classification }),
        ...(reviewStatus && { reviewStatus }),
        ...(sourceType && { sourceType }),
        ...(query && {
          OR: [
            { originalFilename: { contains: query, mode: 'insensitive' as const } },
            { extractedVendorName: { contains: query, mode: 'insensitive' as const } },
          ],
        }),
      }

      const documents = await ctx.prisma.documentUpload.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          filename: true,
          originalFilename: true,
          mimeType: true,
          fileSize: true,
          sourceType: true,
          status: true,
          classification: true,
          confidenceScore: true,
          extractedAmount: true,
          extractedCurrency: true,
          extractedDate: true,
          extractedVendorName: true,
          reviewStatus: true,
          linkedInvoiceId: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      let nextCursor: string | undefined
      if (documents.length > limit) {
        const nextItem = documents.pop()
        nextCursor = nextItem?.id
      }

      return {
        documents,
        nextCursor,
      }
    }),

  /**
   * Get a single document by ID with full details
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const document = await ctx.prisma.documentUpload.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          linkedInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
              invoiceType: true,
            },
          },
        },
      })

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        })
      }

      return document
    }),

  /**
   * Create a document upload record (called after file upload)
   */
  create: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        originalFilename: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
        fileUrl: z.string(),
        sourceType: documentSourceTypeSchema,
        sourcePlatform: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create document record
      const document = await ctx.prisma.documentUpload.create({
        data: {
          userId: ctx.session.user.id,
          filename: input.filename,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          fileUrl: input.fileUrl,
          sourceType: input.sourceType,
          sourcePlatform: input.sourcePlatform,
          status: DocumentStatus.PENDING,
          reviewStatus: ReviewStatus.PENDING_REVIEW,
        },
      })

      // Queue document for processing
      try {
        const job = await getQueueService().enqueue('DOCUMENT_PROCESSING', {
          documentUploadId: document.id,
          userId: ctx.session.user.id,
          sourceType: input.sourceType,
          filename: input.originalFilename,
          fileUrl: input.fileUrl,
          mimeType: input.mimeType,
        })

        // Update document with job ID
        await ctx.prisma.documentUpload.update({
          where: { id: document.id },
          data: { processingJobId: job.id },
        })
      } catch (error) {
        console.error('Failed to queue document processing:', error)
        // Document still created, can be reprocessed later
      }

      return document
    }),

  /**
   * Update document classification (manual override)
   */
  updateClassification: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        classification: documentClassificationSchema,
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.prisma.documentUpload.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      })

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        })
      }

      return ctx.prisma.documentUpload.update({
        where: { id: input.id },
        data: {
          classification: input.classification,
          reviewStatus: ReviewStatus.APPROVED,
          reviewedAt: new Date(),
          reviewNotes: input.notes,
        },
      })
    }),

  /**
   * Approve a document
   */
  approve: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.prisma.documentUpload.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      })

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        })
      }

      if (document.status !== DocumentStatus.PROCESSED) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only approve processed documents',
        })
      }

      return ctx.prisma.documentUpload.update({
        where: { id: input.id },
        data: {
          reviewStatus: ReviewStatus.APPROVED,
          reviewedAt: new Date(),
          reviewNotes: input.notes,
        },
      })
    }),

  /**
   * Reject a document
   */
  reject: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.prisma.documentUpload.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      })

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        })
      }

      return ctx.prisma.documentUpload.update({
        where: { id: input.id },
        data: {
          reviewStatus: ReviewStatus.REJECTED,
          reviewedAt: new Date(),
          reviewNotes: input.reason,
        },
      })
    }),

  /**
   * Reprocess a failed or pending document
   */
  reprocess: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.prisma.documentUpload.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      })

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        })
      }

      if (document.status === DocumentStatus.PROCESSING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Document is already being processed',
        })
      }

      // Reset status
      await ctx.prisma.documentUpload.update({
        where: { id: input.id },
        data: {
          status: DocumentStatus.PENDING,
          reviewStatus: ReviewStatus.PENDING_REVIEW,
          classification: null,
          confidenceScore: null,
          extractedData: Prisma.DbNull,
          rawExtractionData: Prisma.DbNull,
        },
      })

      // Queue for processing
      const job = await getQueueService().enqueue('DOCUMENT_PROCESSING', {
        documentUploadId: document.id,
        userId: ctx.session.user.id,
        sourceType: document.sourceType,
        filename: document.originalFilename,
        fileUrl: document.fileUrl,
        mimeType: document.mimeType,
      })

      await ctx.prisma.documentUpload.update({
        where: { id: input.id },
        data: { processingJobId: job.id },
      })

      return { success: true, jobId: job.id }
    }),

  /**
   * Delete a document
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.prisma.documentUpload.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      })

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        })
      }

      if (document.linkedInvoiceId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete document linked to an invoice',
        })
      }

      // TODO: Delete file from storage

      await ctx.prisma.documentUpload.delete({
        where: { id: input.id },
      })

      return { success: true }
    }),

  /**
   * Get inbox statistics
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const [
      totalCount,
      pendingCount,
      processingCount,
      processedCount,
      failedCount,
      needsReviewCount,
      autoApprovedCount,
    ] = await Promise.all([
      ctx.prisma.documentUpload.count({ where: { userId } }),
      ctx.prisma.documentUpload.count({ where: { userId, status: DocumentStatus.PENDING } }),
      ctx.prisma.documentUpload.count({ where: { userId, status: DocumentStatus.PROCESSING } }),
      ctx.prisma.documentUpload.count({ where: { userId, status: DocumentStatus.PROCESSED } }),
      ctx.prisma.documentUpload.count({ where: { userId, status: DocumentStatus.FAILED } }),
      ctx.prisma.documentUpload.count({
        where: {
          userId,
          reviewStatus: { in: [ReviewStatus.REVIEW_RECOMMENDED, ReviewStatus.MANUAL_REQUIRED] },
        },
      }),
      ctx.prisma.documentUpload.count({
        where: { userId, reviewStatus: ReviewStatus.AUTO_APPROVED },
      }),
    ])

    // Get classification breakdown
    const classificationBreakdown = await ctx.prisma.documentUpload.groupBy({
      by: ['classification'],
      where: { userId, classification: { not: null } },
      _count: true,
    })

    return {
      total: totalCount,
      byStatus: {
        pending: pendingCount,
        processing: processingCount,
        processed: processedCount,
        failed: failedCount,
      },
      needsReview: needsReviewCount,
      autoApproved: autoApprovedCount,
      byClassification: classificationBreakdown.reduce<Record<string, number>>(
        (acc, item) => {
          if (item.classification) {
            acc[item.classification] = item._count
          }
          return acc
        },
        {}
      ),
    }
  }),

  /**
   * Get source types for dropdown
   */
  getSourceTypes: protectedProcedure.query(() => {
    return Object.values(DocumentSourceType).map(type => ({
      value: type,
      label: formatSourceType(type),
    }))
  }),
})

/**
 * Format source type for display
 */
function formatSourceType(type: DocumentSourceType): string {
  const labels: Record<DocumentSourceType, string> = {
    [DocumentSourceType.UPWORK]: 'Upwork',
    [DocumentSourceType.TOPTAL]: 'Toptal',
    [DocumentSourceType.CLIENT_INVOICE]: 'Client Invoice',
    [DocumentSourceType.VENDOR_BILL]: 'Vendor Bill',
    [DocumentSourceType.BANK_STATEMENT]: 'Bank Statement',
    [DocumentSourceType.SCREENSHOT]: 'Screenshot',
    [DocumentSourceType.OTHER]: 'Other',
  }
  return labels[type] || type
}
