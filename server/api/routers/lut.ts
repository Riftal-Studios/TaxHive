import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { Prisma } from '@prisma/client'
import { getLUTStatus, daysUntilLUTExpiry, getLUTExpiryWarning } from '@/lib/lut-utils'

// LUT number validation regex
// Common formats: AD290320241234567, LUT/GST/2024-25/12345, etc.
const LUT_NUMBER_REGEX = /^[A-Z0-9\/\-]{10,50}$/

const lutNumberSchema = z.string()
  .min(10, 'LUT number must be at least 10 characters')
  .max(50, 'LUT number must not exceed 50 characters')
  .regex(LUT_NUMBER_REGEX, 'Invalid LUT number format')

const dateRangeSchema = z.object({
  lutDate: z.date(),
  validFrom: z.date(),
  validTill: z.date(),
}).refine(
  (data) => data.validFrom <= data.validTill,
  {
    message: 'Valid from date must be before valid till date',
    path: ['validFrom'],
  }
).refine(
  (data) => data.lutDate <= data.validFrom,
  {
    message: 'LUT date must be before or equal to valid from date',
    path: ['lutDate'],
  }
)

export const lutRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        activeOnly: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.LUTWhereInput = {
        userId: ctx.session.user.id,
      }

      if (input?.activeOnly) {
        where.isActive = true
      }

      return await ctx.prisma.lUT.findMany({
        where,
        orderBy: { validTill: 'desc' },
      })
    }),

  // Get the active LUT status for dashboard banner
  getActiveStatus: protectedProcedure.query(async ({ ctx }) => {
    const activeLut = await ctx.prisma.lUT.findFirst({
      where: {
        userId: ctx.session.user.id,
        isActive: true,
      },
    })

    if (!activeLut) {
      return {
        hasActiveLut: false,
        lut: null,
        status: null,
        daysRemaining: null,
        warning: null,
      }
    }

    const status = getLUTStatus(activeLut)
    const daysRemaining = daysUntilLUTExpiry(activeLut)
    const warning = getLUTExpiryWarning(activeLut)

    return {
      hasActiveLut: true,
      lut: activeLut,
      status,
      daysRemaining,
      warning,
    }
  }),

  create: protectedProcedure
    .input(
      z.object({
        lutNumber: lutNumberSchema,
        lutDate: z.date(),
        validFrom: z.date(),
        validTill: z.date(),
      }).refine(
        (data) => data.validFrom <= data.validTill,
        {
          message: 'Valid from date must be before valid till date',
          path: ['validFrom'],
        }
      ).refine(
        (data) => data.lutDate <= data.validFrom,
        {
          message: 'LUT date must be before or equal to valid from date',
          path: ['lutDate'],
        }
      )
    )
    .mutation(async ({ ctx, input }) => {
      // Create the new LUT
      const newLUT = await ctx.prisma.lUT.create({
        data: {
          userId: ctx.session.user.id,
          ...input,
          isActive: true,
        },
      })

      // Deactivate other active LUTs for this user
      await ctx.prisma.lUT.updateMany({
        where: {
          userId: ctx.session.user.id,
          isActive: true,
          id: { not: newLUT.id },
        },
        data: { isActive: false },
      })

      return newLUT
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        lutNumber: lutNumberSchema.optional(),
        lutDate: z.date().optional(),
        validFrom: z.date().optional(),
        validTill: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input

      // Verify ownership
      const existingLUT = await ctx.prisma.lUT.findUnique({
        where: { id },
        select: { 
          userId: true,
          lutDate: true,
          validFrom: true,
          validTill: true,
        },
      })

      if (!existingLUT || existingLUT.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Not found',
        })
      }

      // Validate date ranges if any dates are being updated
      const mergedDates = {
        lutDate: updateData.lutDate ?? existingLUT.lutDate,
        validFrom: updateData.validFrom ?? existingLUT.validFrom,
        validTill: updateData.validTill ?? existingLUT.validTill,
      }

      // Apply date validation
      const dateValidation = dateRangeSchema.safeParse(mergedDates)
      if (!dateValidation.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: dateValidation.error.issues[0].message,
        })
      }

      return await ctx.prisma.lUT.update({
        where: { id },
        data: updateData,
      })
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const lut = await ctx.prisma.lUT.findUnique({
        where: { id: input.id },
        select: { userId: true },
      })

      if (!lut || lut.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Not found',
        })
      }

      // Check if any invoices are using this LUT
      const invoiceCount = await ctx.prisma.invoice.count({
        where: { lutId: input.id },
      })

      if (invoiceCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot delete LUT that is referenced by invoices',
        })
      }

      return await ctx.prisma.lUT.delete({
        where: { id: input.id },
      })
    }),

  // Get details for LUT renewal (pre-populated form data)
  getRenewalDetails: protectedProcedure
    .input(z.object({ lutId: z.string() }))
    .query(async ({ ctx, input }) => {
      const previousLut = await ctx.prisma.lUT.findUnique({
        where: { id: input.lutId, userId: ctx.session.user.id },
      })

      if (!previousLut) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'LUT not found',
        })
      }

      // Calculate suggested dates for the next financial year
      const previousValidTill = new Date(previousLut.validTill)
      const suggestedValidFrom = new Date(previousValidTill)
      suggestedValidFrom.setDate(suggestedValidFrom.getDate() + 1)

      // Next FY typically ends on March 31st of the following year
      const suggestedValidTill = new Date(suggestedValidFrom)
      suggestedValidTill.setFullYear(suggestedValidTill.getFullYear() + 1)
      suggestedValidTill.setMonth(2) // March
      suggestedValidTill.setDate(31)

      return {
        previousLut,
        suggestedValidFrom,
        suggestedValidTill,
      }
    }),

  // Renew an existing LUT
  renew: protectedProcedure
    .input(
      z.object({
        previousLutId: z.string(),
        lutNumber: lutNumberSchema,
        lutDate: z.date(),
        validFrom: z.date(),
        validTill: z.date(),
      }).refine(
        (data) => data.validFrom <= data.validTill,
        {
          message: 'Valid from date must be before valid till date',
          path: ['validFrom'],
        }
      ).refine(
        (data) => data.lutDate <= data.validFrom,
        {
          message: 'LUT date must be before or equal to valid from date',
          path: ['lutDate'],
        }
      )
    )
    .mutation(async ({ ctx, input }) => {
      const { previousLutId, ...lutData } = input

      // Verify ownership of previous LUT
      const previousLut = await ctx.prisma.lUT.findUnique({
        where: { id: previousLutId, userId: ctx.session.user.id },
      })

      if (!previousLut) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Previous LUT not found',
        })
      }

      // Create the new LUT with reference to previous
      const newLUT = await ctx.prisma.lUT.create({
        data: {
          userId: ctx.session.user.id,
          ...lutData,
          isActive: true,
          previousLutId: previousLutId,
        },
      })

      // Deactivate the previous LUT and any other active LUTs
      await ctx.prisma.lUT.updateMany({
        where: {
          userId: ctx.session.user.id,
          isActive: true,
          id: { not: newLUT.id },
        },
        data: { isActive: false },
      })

      return newLUT
    }),

  toggleActive: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and get current status
      const lut = await ctx.prisma.lUT.findUnique({
        where: { id: input.id },
        select: { 
          userId: true,
          isActive: true,
        },
      })

      if (!lut || lut.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Not found',
        })
      }

      const newActiveStatus = !lut.isActive

      // If activating this LUT, deactivate others first
      if (newActiveStatus) {
        await ctx.prisma.lUT.updateMany({
          where: {
            userId: ctx.session.user.id,
            isActive: true,
            id: { not: input.id },
          },
          data: { isActive: false },
        })
      }

      // Toggle the active status
      return await ctx.prisma.lUT.update({
        where: { id: input.id },
        data: { isActive: newActiveStatus },
      })
    }),
})