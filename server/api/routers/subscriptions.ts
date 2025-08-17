import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { addDays, addMonths, addYears } from 'date-fns'

// Input schemas
const createSubscriptionPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  currency: z.string().default('USD'),
  
  // Pricing
  monthlyPrice: z.number().min(0),
  yearlyPrice: z.number().min(0).optional(),
  setupFee: z.number().min(0).default(0),
  
  // Billing
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  paymentTerms: z.number().min(0).default(30),
  
  // Features
  features: z.array(z.string()).default([]),
  maxUsers: z.number().min(1).optional(),
  maxInvoices: z.number().min(1).optional(),
  
  // Trial
  trialPeriodDays: z.number().min(0).default(0),
  
  // Status
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
})

const createSubscriptionSchema = z.object({
  clientId: z.string(),
  planId: z.string(),
  
  // Billing details
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  customPrice: z.number().min(0).optional(),
  discountPercentage: z.number().min(0).max(100).default(0),
  
  // Dates
  startDate: z.date().optional(),
  trialEndDate: z.date().optional(),
  nextBillingDate: z.date().optional(),
  
  // Options
  autoRenew: z.boolean().default(true),
  sendInvoiceAutomatically: z.boolean().default(true),
  
  // Payment method
  paymentMethodId: z.string().optional(),
  
  notes: z.string().optional(),
})

const updateSubscriptionSchema = z.object({
  id: z.string(),
  
  // Plan change
  planId: z.string().optional(),
  
  // Billing updates
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  customPrice: z.number().min(0).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  
  // Status changes
  status: z.enum(['TRIAL', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED']).optional(),
  
  // Options
  autoRenew: z.boolean().optional(),
  sendInvoiceAutomatically: z.boolean().optional(),
  
  // Dates
  nextBillingDate: z.date().optional(),
  endDate: z.date().optional(),
  
  notes: z.string().optional(),
})

export const subscriptionsRouter = createTRPCRouter({
  // Subscription Plans
  createPlan: protectedProcedure
    .input(createSubscriptionPlanSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if plan with same name exists
      const existing = await ctx.prisma.subscriptionPlan.findFirst({
        where: {
          userId: ctx.session.user.id,
          name: input.name,
        },
      })
      
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A subscription plan with this name already exists',
        })
      }
      
      // Create the plan
      return ctx.prisma.subscriptionPlan.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
          features: input.features ? JSON.stringify(input.features) : '[]',
        },
      })
    }),
  
  getPlans: protectedProcedure
    .input(z.object({
      includeInactive: z.boolean().default(false),
    }).optional())
    .query(async ({ ctx, input }) => {
      const plans = await ctx.prisma.subscriptionPlan.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input?.includeInactive ? {} : { isActive: true }),
        },
        include: {
          _count: {
            select: {
              subscriptions: true,
            },
          },
        },
        orderBy: {
          monthlyPrice: 'asc',
        },
      })
      
      // Parse features JSON
      return plans.map(plan => ({
        ...plan,
        features: plan.features ? JSON.parse(plan.features as string) : [],
        activeSubscriptions: plan._count.subscriptions,
      }))
    }),
  
  getPlanById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const plan = await ctx.prisma.subscriptionPlan.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          subscriptions: {
            include: {
              client: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      })
      
      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription plan not found',
        })
      }
      
      return {
        ...plan,
        features: plan.features ? JSON.parse(plan.features as string) : [],
      }
    }),
  
  updatePlan: protectedProcedure
    .input(createSubscriptionPlanSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      
      // Verify plan exists and belongs to user
      const existing = await ctx.prisma.subscriptionPlan.findFirst({
        where: {
          id,
          userId: ctx.session.user.id,
        },
      })
      
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription plan not found',
        })
      }
      
      return ctx.prisma.subscriptionPlan.update({
        where: { id },
        data: {
          ...data,
          features: data.features ? JSON.stringify(data.features) : '[]',
        },
      })
    }),
  
  deletePlan: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if plan has active subscriptions
      const activeSubscriptions = await ctx.prisma.subscription.count({
        where: {
          planId: input.id,
          status: { in: ['TRIAL', 'ACTIVE'] },
        },
      })
      
      if (activeSubscriptions > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot delete plan with active subscriptions',
        })
      }
      
      // Soft delete by marking inactive
      return ctx.prisma.subscriptionPlan.update({
        where: { id: input.id },
        data: {
          isActive: false,
          isPublic: false,
        },
      })
    }),
  
  // Customer Subscriptions
  createSubscription: protectedProcedure
    .input(createSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify client exists
      const client = await ctx.prisma.client.findFirst({
        where: {
          id: input.clientId,
          userId: ctx.session.user.id,
        },
      })
      
      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        })
      }
      
      // Verify plan exists
      const plan = await ctx.prisma.subscriptionPlan.findFirst({
        where: {
          id: input.planId,
          userId: ctx.session.user.id,
        },
      })
      
      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription plan not found',
        })
      }
      
      // Check if client already has active subscription
      const existingActive = await ctx.prisma.subscription.findFirst({
        where: {
          clientId: input.clientId,
          status: { in: ['TRIAL', 'ACTIVE'] },
        },
      })
      
      if (existingActive) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Client already has an active subscription',
        })
      }
      
      // Calculate dates
      const startDate = input.startDate || new Date()
      const trialEndDate = plan.trialPeriodDays > 0 
        ? addDays(startDate, plan.trialPeriodDays)
        : startDate
      
      const billingCycle = input.billingCycle || plan.billingCycle
      let nextBillingDate = trialEndDate
      
      switch (billingCycle) {
        case 'MONTHLY':
          nextBillingDate = addMonths(trialEndDate, 1)
          break
        case 'QUARTERLY':
          nextBillingDate = addMonths(trialEndDate, 3)
          break
        case 'YEARLY':
          nextBillingDate = addYears(trialEndDate, 1)
          break
      }
      
      // Calculate subscription price
      const basePrice = billingCycle === 'YEARLY' && plan.yearlyPrice 
        ? plan.yearlyPrice.toNumber()
        : plan.monthlyPrice.toNumber() * (billingCycle === 'QUARTERLY' ? 3 : billingCycle === 'YEARLY' ? 12 : 1)
      
      const customPrice = input.customPrice || basePrice
      const discountAmount = (customPrice * (input.discountPercentage || 0)) / 100
      const currentPrice = customPrice - discountAmount
      
      // Create subscription
      const subscription = await ctx.prisma.subscription.create({
        data: {
          userId: ctx.session.user.id,
          clientId: input.clientId,
          planId: input.planId,
          status: plan.trialPeriodDays > 0 ? 'TRIAL' : 'ACTIVE',
          startDate,
          trialEndDate: plan.trialPeriodDays > 0 ? trialEndDate : undefined,
          nextBillingDate,
          billingCycle,
          currentPrice,
          discountPercentage: input.discountPercentage || 0,
          autoRenew: input.autoRenew,
          notes: input.notes,
        },
        include: {
          client: true,
          plan: true,
        },
      })
      
      // If auto-invoice is enabled, create a recurring invoice
      if (input.sendInvoiceAutomatically) {
        await ctx.prisma.recurringInvoice.create({
          data: {
            userId: ctx.session.user.id,
            templateName: `Subscription - ${plan.name} - ${client.name}`,
            clientId: input.clientId,
            frequency: billingCycle,
            interval: 1,
            nextRunDate: nextBillingDate,
            startDate,
            currency: plan.currency,
            paymentTerms: plan.paymentTerms,
            invoiceType: 'EXPORT',
            serviceCode: '9983',
            placeOfSupply: 'Outside India (Section 2-6)',
            sendAutomatically: true,
            metadata: JSON.stringify({ subscriptionId: subscription.id }),
            lineItems: {
              create: [{
                description: `${plan.name} Subscription (${billingCycle})`,
                hsnCode: '9983',
                quantity: 1,
                rate: currentPrice,
                isVariable: false,
              }],
            },
          },
        })
      }
      
      return subscription
    }),
  
  getSubscriptions: protectedProcedure
    .input(z.object({
      clientId: z.string().optional(),
      planId: z.string().optional(),
      status: z.enum(['TRIAL', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const subscriptions = await ctx.prisma.subscription.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input?.clientId && { clientId: input.clientId }),
          ...(input?.planId && { planId: input.planId }),
          ...(input?.status && { status: input.status }),
        },
        include: {
          client: true,
          plan: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      
      return subscriptions.map(sub => ({
        ...sub,
        planFeatures: sub.plan.features ? JSON.parse(sub.plan.features as string) : [],
      }))
    }),
  
  getSubscriptionById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const subscription = await ctx.prisma.subscription.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          client: true,
          plan: true,
        },
      })
      
      if (!subscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        })
      }
      
      return {
        ...subscription,
        planFeatures: subscription.plan.features ? JSON.parse(subscription.plan.features as string) : [],
      }
    }),
  
  updateSubscription: protectedProcedure
    .input(updateSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      
      // Verify subscription exists
      const existing = await ctx.prisma.subscription.findFirst({
        where: {
          id,
          userId: ctx.session.user.id,
        },
      })
      
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        })
      }
      
      // If changing plan, verify new plan exists
      if (data.planId) {
        const plan = await ctx.prisma.subscriptionPlan.findFirst({
          where: {
            id: data.planId,
            userId: ctx.session.user.id,
          },
        })
        
        if (!plan) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subscription plan not found',
          })
        }
      }
      
      return ctx.prisma.subscription.update({
        where: { id },
        data,
      })
    }),
  
  cancelSubscription: protectedProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string().optional(),
      immediate: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const subscription = await ctx.prisma.subscription.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      })
      
      if (!subscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        })
      }
      
      // Cancel associated recurring invoice if exists
      const recurringInvoice = await ctx.prisma.recurringInvoice.findFirst({
        where: {
          userId: ctx.session.user.id,
          metadata: {
            contains: subscription.id,
          },
        },
      })
      
      if (recurringInvoice) {
        await ctx.prisma.recurringInvoice.update({
          where: { id: recurringInvoice.id },
          data: { 
            status: 'PAUSED',
            endDate: input.immediate ? new Date() : subscription.nextBillingDate,
          },
        })
      }
      
      return ctx.prisma.subscription.update({
        where: { id: input.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: input.reason,
          endDate: input.immediate ? new Date() : subscription.nextBillingDate,
          autoRenew: false,
        },
      })
    }),
  
  pauseSubscription: protectedProcedure
    .input(z.object({
      id: z.string(),
      resumeDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const subscription = await ctx.prisma.subscription.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
          status: 'ACTIVE',
        },
      })
      
      if (!subscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Active subscription not found',
        })
      }
      
      return ctx.prisma.subscription.update({
        where: { id: input.id },
        data: {
          status: 'PAUSED',
          pausedAt: new Date(),
          resumeDate: input.resumeDate,
        },
      })
    }),
  
  resumeSubscription: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const subscription = await ctx.prisma.subscription.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
          status: 'PAUSED',
        },
      })
      
      if (!subscription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Paused subscription not found',
        })
      }
      
      return ctx.prisma.subscription.update({
        where: { id: input.id },
        data: {
          status: 'ACTIVE',
          pausedAt: null,
          resumeDate: null,
        },
      })
    }),
  
  // Analytics
  getSubscriptionMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      const [
        totalSubscriptions,
        activeSubscriptions,
        trialSubscriptions,
        monthlyRecurringRevenue,
        averageSubscriptionValue,
        churnedLastMonth,
      ] = await Promise.all([
        ctx.prisma.subscription.count({
          where: { userId: ctx.session.user.id },
        }),
        ctx.prisma.subscription.count({
          where: {
            userId: ctx.session.user.id,
            status: 'ACTIVE',
          },
        }),
        ctx.prisma.subscription.count({
          where: {
            userId: ctx.session.user.id,
            status: 'TRIAL',
          },
        }),
        ctx.prisma.subscription.aggregate({
          where: {
            userId: ctx.session.user.id,
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
          },
          _sum: {
            currentPrice: true,
          },
        }),
        ctx.prisma.subscription.aggregate({
          where: {
            userId: ctx.session.user.id,
            status: 'ACTIVE',
          },
          _avg: {
            currentPrice: true,
          },
        }),
        ctx.prisma.subscription.count({
          where: {
            userId: ctx.session.user.id,
            status: 'CANCELLED',
            cancelledAt: {
              gte: addMonths(new Date(), -1),
            },
          },
        }),
      ])
      
      // Calculate MRR including quarterly and yearly subscriptions
      const quarterlySubscriptions = await ctx.prisma.subscription.aggregate({
        where: {
          userId: ctx.session.user.id,
          status: 'ACTIVE',
          billingCycle: 'QUARTERLY',
        },
        _sum: {
          currentPrice: true,
        },
      })
      
      const yearlySubscriptions = await ctx.prisma.subscription.aggregate({
        where: {
          userId: ctx.session.user.id,
          status: 'ACTIVE',
          billingCycle: 'YEARLY',
        },
        _sum: {
          currentPrice: true,
        },
      })
      
      const mrr = 
        (monthlyRecurringRevenue._sum.currentPrice?.toNumber() || 0) +
        ((quarterlySubscriptions._sum.currentPrice?.toNumber() || 0) / 3) +
        ((yearlySubscriptions._sum.currentPrice?.toNumber() || 0) / 12)
      
      const churnRate = activeSubscriptions > 0 
        ? (churnedLastMonth / (activeSubscriptions + churnedLastMonth)) * 100
        : 0
      
      return {
        totalSubscriptions,
        activeSubscriptions,
        trialSubscriptions,
        monthlyRecurringRevenue: mrr,
        averageSubscriptionValue: averageSubscriptionValue._avg.currentPrice?.toNumber() || 0,
        churnRate,
        churnedLastMonth,
      }
    }),
})