import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "../trpc"
import { TRPCError } from "@trpc/server"
import { 
  addDays, 
  addWeeks, 
  addMonths, 
  addQuarters, 
  addYears,
  setDay,
  setDate,
  setMonth,
  isAfter,
  isBefore,
  startOfDay,
  endOfDay
} from "date-fns"
import { Prisma } from "@prisma/client"

// Input validation schemas
const recurringLineItemSchema = z.object({
  description: z.string().min(1),
  hsnCode: z.string().min(1),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  isVariable: z.boolean().default(false),
  minimumQuantity: z.number().positive().optional(),
  maximumQuantity: z.number().positive().optional(),
})

const createRecurringInvoiceSchema = z.object({
  templateName: z.string().min(1),
  clientId: z.string(),
  
  // Schedule
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  interval: z.number().int().positive(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  
  // Period
  startDate: z.date(),
  endDate: z.date().optional(),
  occurrences: z.number().int().positive().optional(),
  
  // Invoice Template
  invoiceType: z.enum(['EXPORT', 'DOMESTIC_B2B', 'DOMESTIC_B2C']),
  currency: z.string().default('USD'),
  paymentTerms: z.number().int().positive(),
  serviceCode: z.string().min(1),
  placeOfSupply: z.string().optional(),
  lutId: z.string().optional(),
  
  // Notifications
  sendAutomatically: z.boolean().default(false),
  ccEmails: z.array(z.string().email()).optional(),
  emailTemplate: z.string().optional(),
  
  // Line Items
  lineItems: z.array(recurringLineItemSchema).min(1),
})

const subscriptionSchema = z.object({
  clientId: z.string(),
  planName: z.string().min(1),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  startDate: z.date(),
  trialStart: z.date().optional(),
  trialEnd: z.date().optional(),
  prorateChanges: z.boolean().default(true),
})

// Helper function to calculate next run date
function calculateNextRunDate(
  frequency: string,
  interval: number,
  currentDate: Date,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  monthOfYear?: number | null
): Date {
  const date = startOfDay(currentDate)
  
  switch (frequency) {
    case 'DAILY':
      return addDays(date, interval)
      
    case 'WEEKLY':
      let nextWeekly = addWeeks(date, interval)
      if (dayOfWeek !== null && dayOfWeek !== undefined) {
        nextWeekly = setDay(nextWeekly, dayOfWeek)
      }
      return nextWeekly
      
    case 'MONTHLY':
      let nextMonthly = addMonths(date, interval)
      if (dayOfMonth !== null && dayOfMonth !== undefined) {
        // Handle edge case where dayOfMonth doesn't exist in the month
        const lastDayOfMonth = new Date(nextMonthly.getFullYear(), nextMonthly.getMonth() + 1, 0).getDate()
        const effectiveDay = Math.min(dayOfMonth, lastDayOfMonth)
        nextMonthly = setDate(nextMonthly, effectiveDay)
      }
      return nextMonthly
      
    case 'QUARTERLY':
      return addQuarters(date, interval)
      
    case 'YEARLY':
      let nextYearly = addYears(date, interval)
      if (monthOfYear !== null && monthOfYear !== undefined) {
        nextYearly = setMonth(nextYearly, monthOfYear - 1) // JS months are 0-indexed
      }
      return nextYearly
      
    default:
      throw new Error(`Invalid frequency: ${frequency}`)
  }
}

// Helper function to calculate proration
function calculateProration(
  amount: number,
  billingDays: number,
  usedDays: number
): number {
  return (amount / billingDays) * usedDays
}

// Helper function to get period end date based on billing cycle
function getPeriodEndDate(startDate: Date, billingCycle: string): Date {
  switch (billingCycle) {
    case 'MONTHLY':
      return addMonths(startDate, 1)
    case 'QUARTERLY':
      return addQuarters(startDate, 1)
    case 'YEARLY':
      return addYears(startDate, 1)
    default:
      throw new Error(`Invalid billing cycle: ${billingCycle}`)
  }
}

export const recurringInvoicesRouter = createTRPCRouter({
  // Create a new recurring invoice template
  createRecurringInvoice: protectedProcedure
    .input(createRecurringInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      // Calculate the first run date
      const nextRunDate = calculateNextRunDate(
        input.frequency,
        input.interval,
        input.startDate,
        input.dayOfWeek,
        input.dayOfMonth,
        input.monthOfYear
      )
      
      // Verify client belongs to user
      const client = await ctx.db.client.findFirst({
        where: {
          id: input.clientId,
          userId: userId,
        },
      })
      
      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        })
      }
      
      // Create recurring invoice with line items
      const recurringInvoice = await ctx.db.recurringInvoice.create({
        data: {
          userId,
          templateName: input.templateName,
          clientId: input.clientId,
          frequency: input.frequency,
          interval: input.interval,
          dayOfWeek: input.dayOfWeek,
          dayOfMonth: input.dayOfMonth,
          monthOfYear: input.monthOfYear,
          startDate: input.startDate,
          endDate: input.endDate,
          nextRunDate,
          occurrences: input.occurrences,
          invoiceType: input.invoiceType,
          currency: input.currency,
          paymentTerms: input.paymentTerms,
          serviceCode: input.serviceCode,
          placeOfSupply: input.placeOfSupply || (input.invoiceType === 'EXPORT' ? 'Outside India (Section 2-6)' : undefined),
          lutId: input.lutId,
          sendAutomatically: input.sendAutomatically,
          ccEmails: input.ccEmails || [],
          emailTemplate: input.emailTemplate,
          lineItems: {
            create: input.lineItems.map(item => ({
              description: item.description,
              hsnCode: item.hsnCode,
              quantity: new Prisma.Decimal(item.quantity),
              rate: new Prisma.Decimal(item.rate),
              isVariable: item.isVariable,
              minimumQuantity: item.minimumQuantity ? new Prisma.Decimal(item.minimumQuantity) : null,
              maximumQuantity: item.maximumQuantity ? new Prisma.Decimal(item.maximumQuantity) : null,
            })),
          },
        },
        include: {
          lineItems: true,
          client: true,
        },
      })
      
      return recurringInvoice
    }),
  
  // Get all recurring invoices for the user
  getRecurringInvoices: protectedProcedure
    .input(z.object({
      status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ALL']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const where: any = {
        userId,
      }
      
      if (input.status && input.status !== 'ALL') {
        where.status = input.status
      }
      
      const recurringInvoices = await ctx.db.recurringInvoice.findMany({
        where,
        include: {
          client: true,
          lineItems: true,
          generatedInvoices: {
            select: {
              id: true,
              invoiceNumber: true,
              invoiceDate: true,
              status: true,
              totalAmount: true,
            },
            orderBy: {
              invoiceDate: 'desc',
            },
            take: 5,
          },
          _count: {
            select: {
              generatedInvoices: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      
      return recurringInvoices
    }),
  
  // Get a single recurring invoice by ID
  getRecurringInvoice: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const recurringInvoice = await ctx.db.recurringInvoice.findFirst({
        where: {
          id: input.id,
          userId,
        },
        include: {
          client: true,
          lineItems: true,
          lut: true,
          generatedInvoices: {
            orderBy: {
              invoiceDate: 'desc',
            },
          },
        },
      })
      
      if (!recurringInvoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurring invoice not found',
        })
      }
      
      return recurringInvoice
    }),
  
  // Update recurring invoice schedule
  updateRecurringSchedule: protectedProcedure
    .input(z.object({
      id: z.string(),
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
      interval: z.number().int().positive().optional(),
      dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
      dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
      monthOfYear: z.number().int().min(1).max(12).optional().nullable(),
      endDate: z.date().optional().nullable(),
      occurrences: z.number().int().positive().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      // Verify ownership
      const existing = await ctx.db.recurringInvoice.findFirst({
        where: {
          id: input.id,
          userId,
        },
      })
      
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurring invoice not found',
        })
      }
      
      // Calculate new next run date if schedule changed
      const frequency = input.frequency || existing.frequency
      const interval = input.interval || existing.interval
      const nextRunDate = calculateNextRunDate(
        frequency,
        interval,
        new Date(),
        input.dayOfWeek !== undefined ? input.dayOfWeek : existing.dayOfWeek,
        input.dayOfMonth !== undefined ? input.dayOfMonth : existing.dayOfMonth,
        input.monthOfYear !== undefined ? input.monthOfYear : existing.monthOfYear
      )
      
      const updated = await ctx.db.recurringInvoice.update({
        where: { id: input.id },
        data: {
          frequency: input.frequency,
          interval: input.interval,
          dayOfWeek: input.dayOfWeek,
          dayOfMonth: input.dayOfMonth,
          monthOfYear: input.monthOfYear,
          endDate: input.endDate,
          occurrences: input.occurrences,
          nextRunDate,
        },
      })
      
      return updated
    }),
  
  // Pause a recurring invoice
  pauseRecurring: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const updated = await ctx.db.recurringInvoice.update({
        where: {
          id: input.id,
          userId,
        },
        data: {
          status: 'PAUSED',
          pausedAt: new Date(),
        },
      })
      
      return updated
    }),
  
  // Resume a paused recurring invoice
  resumeRecurring: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const existing = await ctx.db.recurringInvoice.findFirst({
        where: {
          id: input.id,
          userId,
        },
      })
      
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurring invoice not found',
        })
      }
      
      // Recalculate next run date from today
      const nextRunDate = calculateNextRunDate(
        existing.frequency,
        existing.interval,
        new Date(),
        existing.dayOfWeek,
        existing.dayOfMonth,
        existing.monthOfYear
      )
      
      const updated = await ctx.db.recurringInvoice.update({
        where: { id: input.id },
        data: {
          status: 'ACTIVE',
          pausedAt: null,
          nextRunDate,
        },
      })
      
      return updated
    }),
  
  // Cancel a recurring invoice
  cancelRecurring: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const updated = await ctx.db.recurringInvoice.update({
        where: {
          id: input.id,
          userId,
        },
        data: {
          status: 'CANCELLED',
        },
      })
      
      return updated
    }),
  
  // Preview next N invoices
  previewNextInvoices: protectedProcedure
    .input(z.object({
      id: z.string(),
      count: z.number().int().min(1).max(12).default(3),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const recurringInvoice = await ctx.db.recurringInvoice.findFirst({
        where: {
          id: input.id,
          userId,
        },
        include: {
          client: true,
          lineItems: true,
        },
      })
      
      if (!recurringInvoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurring invoice not found',
        })
      }
      
      const previews = []
      let currentDate = recurringInvoice.nextRunDate
      
      for (let i = 0; i < input.count; i++) {
        // Calculate total amount
        const subtotal = recurringInvoice.lineItems.reduce((sum, item) => {
          return sum + Number(item.quantity) * Number(item.rate)
        }, 0)
        
        previews.push({
          invoiceDate: currentDate,
          clientName: recurringInvoice.client.name,
          amount: subtotal,
          currency: recurringInvoice.currency,
        })
        
        // Calculate next date
        currentDate = calculateNextRunDate(
          recurringInvoice.frequency,
          recurringInvoice.interval,
          currentDate,
          recurringInvoice.dayOfWeek,
          recurringInvoice.dayOfMonth,
          recurringInvoice.monthOfYear
        )
        
        // Check if we've exceeded end date or occurrences
        if (recurringInvoice.endDate && isAfter(currentDate, recurringInvoice.endDate)) {
          break
        }
        if (recurringInvoice.occurrences && (recurringInvoice.generatedCount + i + 1) >= recurringInvoice.occurrences) {
          break
        }
      }
      
      return previews
    }),
  
  // Generate invoice now (manual trigger)
  generateInvoiceNow: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const recurringInvoice = await ctx.db.recurringInvoice.findFirst({
        where: {
          id: input.id,
          userId,
        },
        include: {
          client: true,
          lineItems: true,
        },
      })
      
      if (!recurringInvoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recurring invoice not found',
        })
      }
      
      // Get exchange rate if needed
      let exchangeRate = new Prisma.Decimal(1)
      let exchangeSource = 'Manual'
      
      if (recurringInvoice.currency !== 'INR') {
        const latestRate = await ctx.db.exchangeRate.findFirst({
          where: {
            currency: recurringInvoice.currency,
          },
          orderBy: {
            date: 'desc',
          },
        })
        
        if (latestRate) {
          exchangeRate = latestRate.rate
          exchangeSource = latestRate.source
        }
      }
      
      // Calculate amounts
      const subtotal = recurringInvoice.lineItems.reduce((sum, item) => {
        return sum.add(item.quantity.mul(item.rate))
      }, new Prisma.Decimal(0))
      
      const totalInINR = subtotal.mul(exchangeRate)
      const dueDate = addDays(new Date(), recurringInvoice.paymentTerms)
      
      // Get the next invoice number
      const currentFiscalYear = new Date().getMonth() >= 3 
        ? `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`
        : `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(2)}`
      
      const lastInvoice = await ctx.db.invoice.findFirst({
        where: {
          userId,
          invoiceNumber: {
            startsWith: `FY${currentFiscalYear.slice(2, 4)}-${currentFiscalYear.slice(7, 9)}/`,
          },
        },
        orderBy: {
          invoiceNumber: 'desc',
        },
      })
      
      const nextNumber = lastInvoice
        ? parseInt(lastInvoice.invoiceNumber.split('/')[1]) + 1
        : 1
      
      const invoiceNumber = `FY${currentFiscalYear.slice(2, 4)}-${currentFiscalYear.slice(7, 9)}/${nextNumber.toString().padStart(3, '0')}`
      
      // Create the invoice
      const invoice = await ctx.db.invoice.create({
        data: {
          userId,
          clientId: recurringInvoice.clientId,
          recurringInvoiceId: recurringInvoice.id,
          invoiceNumber,
          invoiceDate: new Date(),
          dueDate,
          status: 'DRAFT',
          invoiceType: recurringInvoice.invoiceType,
          placeOfSupply: recurringInvoice.placeOfSupply || 'Outside India (Section 2-6)',
          serviceCode: recurringInvoice.serviceCode,
          lutId: recurringInvoice.lutId,
          currency: recurringInvoice.currency,
          exchangeRate,
          exchangeSource,
          subtotal,
          totalAmount: subtotal,
          totalInINR,
          balanceDue: subtotal,
          paymentTerms: `Net ${recurringInvoice.paymentTerms} days`,
          lineItems: {
            create: recurringInvoice.lineItems.map(item => ({
              description: item.description,
              serviceCode: item.hsnCode,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.quantity.mul(item.rate),
            })),
          },
        },
        include: {
          lineItems: true,
          client: true,
        },
      })
      
      // Update recurring invoice
      const nextRunDate = calculateNextRunDate(
        recurringInvoice.frequency,
        recurringInvoice.interval,
        recurringInvoice.nextRunDate,
        recurringInvoice.dayOfWeek,
        recurringInvoice.dayOfMonth,
        recurringInvoice.monthOfYear
      )
      
      await ctx.db.recurringInvoice.update({
        where: { id: recurringInvoice.id },
        data: {
          generatedCount: {
            increment: 1,
          },
          nextRunDate,
          status: recurringInvoice.occurrences && (recurringInvoice.generatedCount + 1) >= recurringInvoice.occurrences
            ? 'COMPLETED'
            : recurringInvoice.status,
        },
      })
      
      return invoice
    }),
  
  // Get recurring history
  getRecurringHistory: protectedProcedure
    .input(z.object({
      id: z.string(),
      limit: z.number().int().min(1).max(100).default(10),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const invoices = await ctx.db.invoice.findMany({
        where: {
          userId,
          recurringInvoiceId: input.id,
        },
        include: {
          client: true,
          payments: true,
        },
        orderBy: {
          invoiceDate: 'desc',
        },
        take: input.limit,
        skip: input.offset,
      })
      
      const total = await ctx.db.invoice.count({
        where: {
          userId,
          recurringInvoiceId: input.id,
        },
      })
      
      return {
        invoices,
        total,
      }
    }),
  
  // Create a subscription
  createSubscription: protectedProcedure
    .input(subscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      // Verify client belongs to user
      const client = await ctx.db.client.findFirst({
        where: {
          id: input.clientId,
          userId,
        },
      })
      
      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        })
      }
      
      const currentPeriodEnd = getPeriodEndDate(input.startDate, input.billingCycle)
      
      // Determine initial status
      let status = 'ACTIVE'
      if (input.trialEnd && isAfter(input.trialEnd, new Date())) {
        status = 'TRIALING'
      }
      
      const subscription = await ctx.db.subscription.create({
        data: {
          userId,
          clientId: input.clientId,
          planName: input.planName,
          billingCycle: input.billingCycle,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency,
          startDate: input.startDate,
          currentPeriodStart: input.startDate,
          currentPeriodEnd,
          trialStart: input.trialStart,
          trialEnd: input.trialEnd,
          status,
          prorateChanges: input.prorateChanges,
        },
        include: {
          client: true,
        },
      })
      
      return subscription
    }),
  
  // Get all subscriptions
  getSubscriptions: protectedProcedure
    .input(z.object({
      status: z.enum(['TRIALING', 'ACTIVE', 'CANCELLED', 'PAST_DUE', 'ALL']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const where: any = {
        userId,
      }
      
      if (input.status && input.status !== 'ALL') {
        where.status = input.status
      }
      
      const subscriptions = await ctx.db.subscription.findMany({
        where,
        include: {
          client: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      
      return subscriptions
    }),
  
  // Update subscription
  updateSubscription: protectedProcedure
    .input(z.object({
      id: z.string(),
      planName: z.string().optional(),
      amount: z.number().positive().optional(),
      billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const existing = await ctx.db.subscription.findFirst({
        where: {
          id: input.id,
          userId,
        },
      })
      
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        })
      }
      
      // Handle proration if amount or billing cycle changed
      let proratedAmount = null
      if (input.amount && existing.prorateChanges) {
        const daysInPeriod = Math.ceil(
          (existing.currentPeriodEnd.getTime() - existing.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
        )
        const daysUsed = Math.ceil(
          (new Date().getTime() - existing.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
        )
        
        proratedAmount = calculateProration(
          input.amount,
          daysInPeriod,
          daysUsed
        )
      }
      
      const updated = await ctx.db.subscription.update({
        where: { id: input.id },
        data: {
          planName: input.planName,
          amount: input.amount ? new Prisma.Decimal(input.amount) : undefined,
          billingCycle: input.billingCycle,
        },
      })
      
      return {
        subscription: updated,
        proratedAmount,
      }
    }),
  
  // Cancel subscription
  cancelSubscription: protectedProcedure
    .input(z.object({
      id: z.string(),
      immediately: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const cancelledAt = input.immediately ? new Date() : undefined
      
      const updated = await ctx.db.subscription.update({
        where: {
          id: input.id,
          userId,
        },
        data: {
          status: 'CANCELLED',
          cancelledAt,
        },
      })
      
      return updated
    }),
  
  // Get upcoming recurring invoices
  getUpcomingRecurringInvoices: protectedProcedure
    .input(z.object({
      days: z.number().int().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const endDate = addDays(new Date(), input.days)
      
      const upcoming = await ctx.db.recurringInvoice.findMany({
        where: {
          userId,
          status: 'ACTIVE',
          nextRunDate: {
            gte: new Date(),
            lte: endDate,
          },
        },
        include: {
          client: true,
          lineItems: true,
        },
        orderBy: {
          nextRunDate: 'asc',
        },
      })
      
      return upcoming.map(recurring => {
        const subtotal = recurring.lineItems.reduce((sum, item) => {
          return sum + Number(item.quantity) * Number(item.rate)
        }, 0)
        
        return {
          id: recurring.id,
          templateName: recurring.templateName,
          clientName: recurring.client.name,
          nextRunDate: recurring.nextRunDate,
          amount: subtotal,
          currency: recurring.currency,
          frequency: recurring.frequency,
        }
      })
    }),
  
  // Record usage for variable billing
  recordUsage: protectedProcedure
    .input(z.object({
      recurringInvoiceId: z.string(),
      lineItemId: z.string(),
      quantity: z.number().positive(),
      period: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      // Verify ownership and that line item is variable
      const lineItem = await ctx.db.recurringLineItem.findFirst({
        where: {
          id: input.lineItemId,
          recurringInvoiceId: input.recurringInvoiceId,
          recurringInvoice: {
            userId,
          },
          isVariable: true,
        },
      })
      
      if (!lineItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Variable line item not found',
        })
      }
      
      // Validate quantity against min/max
      if (lineItem.minimumQuantity && input.quantity < Number(lineItem.minimumQuantity)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Quantity must be at least ${lineItem.minimumQuantity}`,
        })
      }
      
      if (lineItem.maximumQuantity && input.quantity > Number(lineItem.maximumQuantity)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Quantity must not exceed ${lineItem.maximumQuantity}`,
        })
      }
      
      // Here you might want to store this usage in a separate table
      // For now, we'll just return success
      return {
        success: true,
        lineItemId: input.lineItemId,
        quantity: input.quantity,
        period: input.period,
      }
    }),
})