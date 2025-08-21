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
  endOfDay,
  getDay,
  isWeekend,
  formatInTimeZone
} from "date-fns"
import { fromZonedTime, toZonedTime } from "date-fns-tz"
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
  
  // Template Management
  customFields: z.record(z.any()).optional(),
  
  // Advanced Scheduling
  skipWeekends: z.boolean().default(false),
  skipHolidays: z.boolean().default(false),
  holidayCalendar: z.array(z.date()).optional(),
  timezone: z.string().default('Asia/Kolkata'),
  scheduleTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:mm format
  
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

// Utility function to check if a date is a weekend
function isDateWeekend(date: Date): boolean {
  return isWeekend(date)
}

// Utility function to check if a date is in the holiday calendar
function isDateHoliday(date: Date, holidayCalendar?: Date[]): boolean {
  if (!holidayCalendar || holidayCalendar.length === 0) return false
  
  const dateString = date.toISOString().split('T')[0]
  return holidayCalendar.some(holiday => {
    const holidayString = holiday.toISOString().split('T')[0]
    return holidayString === dateString
  })
}

// Utility function to adjust date to skip weekends and holidays
function adjustDateForSkipping(
  date: Date, 
  skipWeekends: boolean = false, 
  skipHolidays: boolean = false, 
  holidayCalendar?: Date[]
): Date {
  let adjustedDate = new Date(date)
  
  // Keep adjusting until we find a valid date
  while (
    (skipWeekends && isDateWeekend(adjustedDate)) ||
    (skipHolidays && isDateHoliday(adjustedDate, holidayCalendar))
  ) {
    adjustedDate = addDays(adjustedDate, 1)
  }
  
  return adjustedDate
}

// Utility function to convert time between timezones
function convertToTimezone(date: Date, timezone: string): Date {
  return toZonedTime(date, timezone)
}

// Utility function to apply schedule time to a date
function applyScheduleTime(date: Date, scheduleTime?: string, timezone: string = 'Asia/Kolkata'): Date {
  if (!scheduleTime) return date
  
  const [hours, minutes] = scheduleTime.split(':').map(Number)
  const dateWithTime = new Date(date)
  dateWithTime.setHours(hours, minutes, 0, 0)
  
  // Convert to UTC for storage
  return fromZonedTime(dateWithTime, timezone)
}

// Helper function to calculate next run date with advanced scheduling
function calculateNextRunDate(
  frequency: string,
  interval: number,
  currentDate: Date,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  monthOfYear?: number | null,
  skipWeekends: boolean = false,
  skipHolidays: boolean = false,
  holidayCalendar?: Date[],
  timezone: string = 'Asia/Kolkata',
  scheduleTime?: string
): Date {
  const date = startOfDay(currentDate)
  let nextDate: Date
  
  switch (frequency) {
    case 'DAILY':
      nextDate = addDays(date, interval)
      break
      
    case 'WEEKLY':
      nextDate = addWeeks(date, interval)
      if (dayOfWeek !== null && dayOfWeek !== undefined) {
        nextDate = setDay(nextDate, dayOfWeek)
      }
      break
      
    case 'MONTHLY':
      nextDate = addMonths(date, interval)
      if (dayOfMonth !== null && dayOfMonth !== undefined) {
        // Handle edge case where dayOfMonth doesn't exist in the month
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
        const effectiveDay = Math.min(dayOfMonth, lastDayOfMonth)
        nextDate = setDate(nextDate, effectiveDay)
      }
      break
      
    case 'QUARTERLY':
      nextDate = addQuarters(date, interval)
      break
      
    case 'YEARLY':
      nextDate = addYears(date, interval)
      if (monthOfYear !== null && monthOfYear !== undefined) {
        nextDate = setMonth(nextDate, monthOfYear - 1) // JS months are 0-indexed
      }
      break
      
    default:
      throw new Error(`Invalid frequency: ${frequency}`)
  }
  
  // Apply weekend and holiday skipping
  nextDate = adjustDateForSkipping(nextDate, skipWeekends, skipHolidays, holidayCalendar)
  
  // Apply schedule time and timezone
  nextDate = applyScheduleTime(nextDate, scheduleTime, timezone)
  
  return nextDate
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
      
      // Calculate the first run date with advanced scheduling
      const nextRunDate = calculateNextRunDate(
        input.frequency,
        input.interval,
        input.startDate,
        input.dayOfWeek,
        input.dayOfMonth,
        input.monthOfYear,
        input.skipWeekends,
        input.skipHolidays,
        input.holidayCalendar,
        input.timezone,
        input.scheduleTime
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
          customFields: input.customFields,
          skipWeekends: input.skipWeekends,
          skipHolidays: input.skipHolidays,
          holidayCalendar: input.holidayCalendar,
          timezone: input.timezone,
          scheduleTime: input.scheduleTime,
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
      
      // Create initial version (1.0.0) for the template
      const initialVersion = await ctx.db.templateVersion.create({
        data: {
          templateId: recurringInvoice.id,
          version: '1.0.0',
          changes: {
            type: 'initial_creation',
            templateData: {
              templateName: input.templateName,
              frequency: input.frequency,
              interval: input.interval,
              invoiceType: input.invoiceType,
              currency: input.currency,
              paymentTerms: input.paymentTerms,
              serviceCode: input.serviceCode,
              customFields: input.customFields,
              lineItems: input.lineItems
            }
          },
          effectiveDate: new Date(),
          createdBy: userId
        }
      })
      
      // Update the template to reference this initial version as current
      await ctx.db.recurringInvoice.update({
        where: { id: recurringInvoice.id },
        data: { currentVersionId: initialVersion.id }
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
      skipWeekends: z.boolean().optional(),
      skipHolidays: z.boolean().optional(),
      holidayCalendar: z.array(z.date()).optional(),
      timezone: z.string().optional(),
      scheduleTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
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
        input.monthOfYear !== undefined ? input.monthOfYear : existing.monthOfYear,
        input.skipWeekends !== undefined ? input.skipWeekends : existing.skipWeekends,
        input.skipHolidays !== undefined ? input.skipHolidays : existing.skipHolidays,
        input.holidayCalendar || (existing.holidayCalendar as Date[] | undefined),
        input.timezone || existing.timezone,
        input.scheduleTime !== undefined ? input.scheduleTime : (existing.scheduleTime || undefined)
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
          skipWeekends: input.skipWeekends,
          skipHolidays: input.skipHolidays,
          holidayCalendar: input.holidayCalendar,
          timezone: input.timezone,
          scheduleTime: input.scheduleTime,
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
        existing.monthOfYear,
        existing.skipWeekends,
        existing.skipHolidays,
        existing.holidayCalendar as Date[] | undefined,
        existing.timezone,
        existing.scheduleTime || undefined
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
          recurringInvoice.monthOfYear,
          recurringInvoice.skipWeekends,
          recurringInvoice.skipHolidays,
          recurringInvoice.holidayCalendar as Date[] | undefined,
          recurringInvoice.timezone,
          recurringInvoice.scheduleTime || undefined
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
        recurringInvoice.monthOfYear,
        recurringInvoice.skipWeekends,
        recurringInvoice.skipHolidays,
        recurringInvoice.holidayCalendar as Date[] | undefined,
        recurringInvoice.timezone,
        recurringInvoice.scheduleTime || undefined
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