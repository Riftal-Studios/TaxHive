import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { gstinSchema, panSchema, validateGSTINPANMatch } from '@/lib/validations/indian-tax'

const ONBOARDING_STEPS = ['profile', 'client', 'lut', 'invoice', 'complete', 'skipped'] as const
type OnboardingStep = typeof ONBOARDING_STEPS[number]

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: {
        id: ctx.session.user.id,
      },
      include: {
        luts: {
          where: {
            isActive: true,
          },
          orderBy: {
            validTill: 'desc',
          },
        },
      },
    })
    return user
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().transform(val => val.trim()).optional(),
        gstin: gstinSchema.optional(),
        pan: panSchema.optional(),
        address: z.string().transform(val => val.trim()).optional(),
      }).refine(
        (data) => {
          // If both GSTIN and PAN are provided, ensure PAN matches GSTIN
          if (data.gstin && data.pan) {
            return validateGSTINPANMatch(data.gstin, data.pan)
          }
          return true
        },
        {
          message: 'PAN does not match the PAN in GSTIN',
          path: ['pan'],
        }
      )
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: input,
      })
      return user
    }),

  getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        onboardingCompleted: true,
        onboardingStep: true,
        name: true,
        gstin: true,
        pan: true,
        address: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Check if profile is completed
    const profileCompleted = !!(
      user.name &&
      user.gstin &&
      user.pan &&
      user.address
    )

    // Check if user has at least one client
    const clientCount = await ctx.prisma.client.count({
      where: { userId: ctx.session.user.id },
    })
    const clientCompleted = clientCount > 0

    // Check if user has at least one active LUT
    const lutCount = await ctx.prisma.lUT.count({
      where: {
        userId: ctx.session.user.id,
        isActive: true,
      },
    })
    const lutCompleted = lutCount > 0

    // Check if user has created at least one invoice (optional step)
    const invoiceCount = await ctx.prisma.invoice.count({
      where: { userId: ctx.session.user.id },
    })
    const invoiceCompleted = invoiceCount > 0

    // Calculate progress (33% per required step, invoice is optional)
    const requiredSteps = [profileCompleted, clientCompleted, lutCompleted]
    const completedRequiredSteps = requiredSteps.filter(Boolean).length
    const progress = user.onboardingCompleted ? 100 : Math.round((completedRequiredSteps / 3) * 100)

    // Determine current step
    let currentStep: OnboardingStep = 'profile'
    if (user.onboardingCompleted) {
      currentStep = (user.onboardingStep as OnboardingStep) || 'complete'
    } else if (!profileCompleted) {
      currentStep = 'profile'
    } else if (!clientCompleted) {
      currentStep = 'client'
    } else if (!lutCompleted) {
      currentStep = 'lut'
    } else {
      currentStep = 'invoice'
    }

    return {
      completed: user.onboardingCompleted,
      currentStep,
      steps: {
        profile: {
          completed: profileCompleted,
          required: true,
        },
        client: {
          completed: clientCompleted,
          required: true,
        },
        lut: {
          completed: lutCompleted,
          required: true,
        },
        invoice: {
          completed: invoiceCompleted,
          required: false,
        },
      },
      progress,
    }
  }),

  updateOnboardingStep: protectedProcedure
    .input(
      z.object({
        step: z.enum(ONBOARDING_STEPS),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { onboardingStep: input.step },
      })
    }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    return await ctx.prisma.user.update({
      where: { id: ctx.session.user.id },
      data: {
        onboardingCompleted: true,
        onboardingStep: 'complete',
      },
    })
  }),

  skipOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    return await ctx.prisma.user.update({
      where: { id: ctx.session.user.id },
      data: {
        onboardingCompleted: true,
        onboardingStep: 'skipped',
      },
    })
  }),
})