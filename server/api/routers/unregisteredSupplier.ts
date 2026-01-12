import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { GST_STATE_CODES, gstStateCodeSchema } from '@/lib/validations/gst'

/**
 * Unregistered Supplier Router
 * Manages suppliers without GST registration for RCM Self Invoices
 */
export const unregisteredSupplierRouter = createTRPCRouter({
  /**
   * Create a new unregistered supplier
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Supplier name is required'),
        address: z.string().min(1, 'Address is required'),
        state: z.string().min(1, 'State is required'),
        stateCode: gstStateCodeSchema,
        pan: z.string().optional().nullable(),
        pincode: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        email: z.string().email().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID not found in session',
        })
      }

      // Validate state code matches state name
      const expectedStateName = GST_STATE_CODES[input.stateCode]
      if (!expectedStateName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid state code: ${input.stateCode}`,
        })
      }

      try {
        const supplier = await ctx.prisma.unregisteredSupplier.create({
          data: {
            ...input,
            userId: ctx.session.user.id,
          },
        })
        return supplier
      } catch (error) {
        console.error('Unregistered supplier creation error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create supplier',
        })
      }
    }),

  /**
   * List all unregistered suppliers for the current user
   */
  list: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional().default(false),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const suppliers = await ctx.prisma.unregisteredSupplier.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input?.includeInactive ? {} : { isActive: true }),
        },
        orderBy: {
          name: 'asc',
        },
      })
      return suppliers
    }),

  /**
   * Get a supplier by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const supplier = await ctx.prisma.unregisteredSupplier.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          invoices: {
            orderBy: { invoiceDate: 'desc' },
            take: 10,
            select: {
              id: true,
              invoiceNumber: true,
              invoiceDate: true,
              totalAmount: true,
              status: true,
            },
          },
        },
      })

      if (!supplier) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier not found',
        })
      }

      return supplier
    }),

  /**
   * Update a supplier
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, 'Supplier name is required'),
        address: z.string().min(1, 'Address is required'),
        state: z.string().min(1, 'State is required'),
        stateCode: gstStateCodeSchema,
        pan: z.string().optional().nullable(),
        pincode: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        email: z.string().email().optional().nullable(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      // Validate state code
      if (!GST_STATE_CODES[data.stateCode]) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid state code: ${data.stateCode}`,
        })
      }

      const result = await ctx.prisma.unregisteredSupplier.updateMany({
        where: {
          id,
          userId: ctx.session.user.id,
        },
        data,
      })

      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier not found',
        })
      }

      // Fetch and return the updated supplier
      const supplier = await ctx.prisma.unregisteredSupplier.findUnique({
        where: { id },
      })

      return supplier
    }),

  /**
   * Delete (soft-delete by marking inactive) a supplier
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if supplier has any invoices
      const invoiceCount = await ctx.prisma.invoice.count({
        where: {
          unregisteredSupplierId: input.id,
        },
      })

      if (invoiceCount > 0) {
        // Soft delete - mark as inactive
        await ctx.prisma.unregisteredSupplier.updateMany({
          where: {
            id: input.id,
            userId: ctx.session.user.id,
          },
          data: {
            isActive: false,
          },
        })
        return { success: true, softDeleted: true }
      }

      // Hard delete if no invoices
      const result = await ctx.prisma.unregisteredSupplier.deleteMany({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      })

      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier not found',
        })
      }

      return { success: true, softDeleted: false }
    }),

  /**
   * Get all GST state codes for dropdown selection
   */
  getStateCodes: protectedProcedure.query(() => {
    return Object.entries(GST_STATE_CODES).map(([code, name]) => ({
      code,
      name,
    }))
  }),
})
