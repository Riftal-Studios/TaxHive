import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { generateIRN, getIRNByDocument } from '@/lib/einvoice/generator'
import { cancelIRN, canCancelIRN, getCancellationHistory } from '@/lib/einvoice/cancellation'
import { getIRPAuthToken, revokeIRPToken, isIRPAuthenticated } from '@/lib/einvoice/auth'
import { encryptCredentials, decryptCredentials } from '@/lib/einvoice/crypto'
import { GSP_PROVIDERS, CANCEL_REASONS } from '@/lib/einvoice/constants'

export const einvoiceRouter = createTRPCRouter({
  // Get e-invoice configuration
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.db.eInvoiceConfig.findUnique({
      where: { userId: ctx.session.user.id }
    })

    if (!config) {
      return null
    }

    // Don't return encrypted credentials
    return {
      ...config,
      password: undefined,
      clientSecret: undefined
    }
  }),

  // Save e-invoice configuration
  saveConfig: protectedProcedure
    .input(z.object({
      gspProvider: z.enum(['CLEARTAX', 'VAYANA', 'CYGNET', 'CUSTOM']),
      gspUrl: z.string().optional(),
      environment: z.enum(['SANDBOX', 'PRODUCTION']),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      username: z.string().min(1),
      password: z.string().min(1),
      gstin: z.string().length(15),
      autoGenerate: z.boolean().default(false),
      autoCancel: z.boolean().default(false),
      cancelWithin: z.number().min(1).max(24).default(24),
      includeQRCode: z.boolean().default(true),
      bulkGeneration: z.boolean().default(false),
      ewayBillEnabled: z.boolean().default(false),
      ewayBillThreshold: z.number().default(50000),
      transportMode: z.string().optional(),
      transporterId: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key'
      
      // Encrypt sensitive credentials
      const encryptedPassword = encryptCredentials(input.password, encryptionKey)
      const encryptedClientSecret = input.clientSecret 
        ? encryptCredentials(input.clientSecret, encryptionKey)
        : undefined

      const existing = await ctx.db.eInvoiceConfig.findUnique({
        where: { userId: ctx.session.user.id }
      })

      if (existing) {
        return ctx.db.eInvoiceConfig.update({
          where: { id: existing.id },
          data: {
            ...input,
            password: encryptedPassword,
            clientSecret: encryptedClientSecret
          }
        })
      } else {
        return ctx.db.eInvoiceConfig.create({
          data: {
            ...input,
            userId: ctx.session.user.id,
            password: encryptedPassword,
            clientSecret: encryptedClientSecret
          }
        })
      }
    }),

  // Test authentication
  testAuth: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await getIRPAuthToken(ctx.session.user.id, true)
    
    if (!result.success) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: result.error || 'Authentication failed'
      })
    }

    return {
      success: true,
      message: 'Authentication successful',
      tokenExpiry: result.tokenExpiry
    }
  }),

  // Check authentication status
  isAuthenticated: protectedProcedure.query(async ({ ctx }) => {
    return isIRPAuthenticated(ctx.session.user.id)
  }),

  // Generate IRN for an invoice
  generateIRN: protectedProcedure
    .input(z.object({
      invoiceId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await generateIRN(input.invoiceId, ctx.session.user.id)
      
      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Failed to generate IRN'
        })
      }

      return result
    }),

  // Cancel an IRN
  cancelIRN: protectedProcedure
    .input(z.object({
      invoiceId: z.string(),
      reason: z.enum(['1', '2', '3', '4']),
      remarks: z.string().min(1).max(100)
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await cancelIRN(
        input.invoiceId,
        ctx.session.user.id,
        input.reason,
        input.remarks
      )
      
      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Failed to cancel IRN'
        })
      }

      return result
    }),

  // Check if IRN can be cancelled
  canCancelIRN: protectedProcedure
    .input(z.object({
      invoiceId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return canCancelIRN(input.invoiceId, ctx.session.user.id)
    }),

  // Get cancellation history
  getCancellationHistory: protectedProcedure
    .input(z.object({
      invoiceId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return getCancellationHistory(input.invoiceId, ctx.session.user.id)
    }),

  // Get e-invoice by invoice ID
  getEInvoice: protectedProcedure
    .input(z.object({
      invoiceId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.eInvoice.findUnique({
        where: {
          invoiceId: input.invoiceId
        }
      })
    }),

  // Get all e-invoices
  getEInvoices: protectedProcedure
    .input(z.object({
      status: z.enum(['PENDING', 'GENERATED', 'CANCELLED', 'FAILED']).optional(),
      fromDate: z.date().optional(),
      toDate: z.date().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0)
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        userId: ctx.session.user.id
      }

      if (input.status) {
        where.status = input.status
      }

      if (input.fromDate || input.toDate) {
        where.docDate = {}
        if (input.fromDate) {
          where.docDate.gte = input.fromDate
        }
        if (input.toDate) {
          where.docDate.lte = input.toDate
        }
      }

      const [einvoices, total] = await Promise.all([
        ctx.db.eInvoice.findMany({
          where,
          include: {
            invoice: {
              include: {
                client: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: input.limit,
          skip: input.offset
        }),
        ctx.db.eInvoice.count({ where })
      ])

      return { einvoices, total }
    }),

  // Get e-invoice statistics
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const [
      totalGenerated,
      totalCancelled,
      totalFailed,
      totalPending,
      recentEInvoices
    ] = await Promise.all([
      ctx.db.eInvoice.count({
        where: { userId, status: 'GENERATED' }
      }),
      ctx.db.eInvoice.count({
        where: { userId, status: 'CANCELLED' }
      }),
      ctx.db.eInvoice.count({
        where: { userId, status: 'FAILED' }
      }),
      ctx.db.eInvoice.count({
        where: { userId, status: 'PENDING' }
      }),
      ctx.db.eInvoice.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          invoice: {
            include: {
              client: true
            }
          }
        }
      })
    ])

    return {
      totalGenerated,
      totalCancelled,
      totalFailed,
      totalPending,
      total: totalGenerated + totalCancelled + totalFailed + totalPending,
      recentEInvoices
    }
  }),

  // Bulk generate IRNs
  bulkGenerateIRNs: protectedProcedure
    .input(z.object({
      invoiceIds: z.array(z.string()).min(1).max(10)
    }))
    .mutation(async ({ ctx, input }) => {
      const results = []
      
      for (const invoiceId of input.invoiceIds) {
        try {
          const result = await generateIRN(invoiceId, ctx.session.user.id)
          results.push({
            invoiceId,
            success: result.success,
            irn: result.irn,
            error: result.error
          })
        } catch (error) {
          results.push({
            invoiceId,
            success: false,
            error: 'Failed to generate IRN'
          })
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      return results
    }),

  // Get GSP providers list
  getGSPProviders: protectedProcedure.query(() => {
    return Object.entries(GSP_PROVIDERS).map(([key, value]) => ({
      value: key,
      label: value.name,
      sandboxUrl: value.sandboxUrl,
      productionUrl: value.productionUrl
    }))
  }),

  // Get cancel reasons
  getCancelReasons: protectedProcedure.query(() => {
    return Object.entries(CANCEL_REASONS).map(([key, value]) => ({
      value: key,
      label: value
    }))
  }),

  // Revoke authentication token
  revokeAuth: protectedProcedure.mutation(async ({ ctx }) => {
    const success = await revokeIRPToken(ctx.session.user.id)
    
    if (!success) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to revoke authentication token'
      })
    }

    return { success: true }
  })
})