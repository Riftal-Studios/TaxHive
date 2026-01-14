import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { GST_STATE_CODES, gstStateCodeSchema } from '@/lib/validations/gst'
import { SupplierType } from '@prisma/client'

// Common ISO country codes for popular foreign service providers
const COMMON_COUNTRIES = {
  US: 'United States',
  DE: 'Germany',
  GB: 'United Kingdom',
  IE: 'Ireland',
  NL: 'Netherlands',
  SG: 'Singapore',
  AU: 'Australia',
  CA: 'Canada',
  FR: 'France',
  JP: 'Japan',
} as const

/**
 * Unregistered Supplier Router
 * Manages suppliers without GST registration for RCM Self Invoices
 * Supports both Indian unregistered and Foreign service providers
 */
export const unregisteredSupplierRouter = createTRPCRouter({
  /**
   * Create a new Indian unregistered supplier
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
            supplierType: SupplierType.INDIAN_UNREGISTERED,
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
   * Create a new foreign service supplier (Import of Services)
   */
  createForeign: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Supplier name is required'),
        address: z.string().min(1, 'Address is required'),
        country: z.string().length(2, 'Country code must be 2 characters (ISO format)'),
        countryName: z.string().min(1, 'Country name is required'),
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

      // Validate it's not India
      if (input.country.toUpperCase() === 'IN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Foreign suppliers cannot be from India. Use Indian Unregistered supplier type instead.',
        })
      }

      try {
        const supplier = await ctx.prisma.unregisteredSupplier.create({
          data: {
            name: input.name,
            address: input.address,
            country: input.country.toUpperCase(),
            countryName: input.countryName,
            phone: input.phone,
            email: input.email,
            supplierType: SupplierType.FOREIGN_SERVICE,
            userId: ctx.session.user.id,
          },
        })
        return supplier
      } catch (error) {
        console.error('Foreign supplier creation error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create foreign supplier',
        })
      }
    }),

  /**
   * List all unregistered suppliers for the current user
   * Can filter by supplier type and active status
   */
  list: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional().default(false),
        supplierType: z.nativeEnum(SupplierType).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const suppliers = await ctx.prisma.unregisteredSupplier.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input?.includeInactive ? {} : { isActive: true }),
          ...(input?.supplierType ? { supplierType: input.supplierType } : {}),
        },
        orderBy: {
          name: 'asc',
        },
      })
      return suppliers
    }),

  /**
   * List only Indian unregistered suppliers
   */
  listIndian: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional().default(false),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const suppliers = await ctx.prisma.unregisteredSupplier.findMany({
        where: {
          userId: ctx.session.user.id,
          supplierType: SupplierType.INDIAN_UNREGISTERED,
          ...(input?.includeInactive ? {} : { isActive: true }),
        },
        orderBy: {
          name: 'asc',
        },
      })
      return suppliers
    }),

  /**
   * List only foreign service suppliers
   */
  listForeign: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional().default(false),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const suppliers = await ctx.prisma.unregisteredSupplier.findMany({
        where: {
          userId: ctx.session.user.id,
          supplierType: SupplierType.FOREIGN_SERVICE,
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
   * Update an Indian unregistered supplier
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

      // Check supplier exists and is Indian type
      const existing = await ctx.prisma.unregisteredSupplier.findFirst({
        where: { id, userId: ctx.session.user.id },
        select: { supplierType: true },
      })

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier not found',
        })
      }

      if (existing.supplierType !== SupplierType.INDIAN_UNREGISTERED) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot update foreign supplier with Indian supplier data. Use updateForeign instead.',
        })
      }

      const supplier = await ctx.prisma.unregisteredSupplier.update({
        where: { id },
        data,
      })

      return supplier
    }),

  /**
   * Update a foreign service supplier
   */
  updateForeign: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, 'Supplier name is required'),
        address: z.string().min(1, 'Address is required'),
        country: z.string().length(2, 'Country code must be 2 characters (ISO format)'),
        countryName: z.string().min(1, 'Country name is required'),
        phone: z.string().optional().nullable(),
        email: z.string().email().optional().nullable(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, country, ...data } = input

      // Validate it's not India
      if (country.toUpperCase() === 'IN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Foreign suppliers cannot be from India.',
        })
      }

      // Check supplier exists and is foreign type
      const existing = await ctx.prisma.unregisteredSupplier.findFirst({
        where: { id, userId: ctx.session.user.id },
        select: { supplierType: true },
      })

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier not found',
        })
      }

      if (existing.supplierType !== SupplierType.FOREIGN_SERVICE) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot update Indian supplier with foreign supplier data. Use update instead.',
        })
      }

      const supplier = await ctx.prisma.unregisteredSupplier.update({
        where: { id },
        data: {
          ...data,
          country: country.toUpperCase(),
        },
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
   * Get all GST state codes for dropdown selection (Indian suppliers)
   */
  getStateCodes: protectedProcedure.query(() => {
    return Object.entries(GST_STATE_CODES).map(([code, name]) => ({
      code,
      name,
    }))
  }),

  /**
   * Get common country codes for dropdown selection (Foreign suppliers)
   */
  getCountryCodes: protectedProcedure.query(() => {
    return Object.entries(COMMON_COUNTRIES).map(([code, name]) => ({
      code,
      name,
    }))
  }),
})
