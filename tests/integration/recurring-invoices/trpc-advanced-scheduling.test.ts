import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createTestUser, createTestClient, cleanupTestData } from '@/tests/utils/test-helpers'
import { createTRPCMsw } from 'msw-trpc'
import { appRouter } from '@/server/api/root'
import { addWeeks, addDays } from 'date-fns'

describe('tRPC Advanced Scheduling Integration', () => {
  let userId: string
  let clientId: string
  
  beforeEach(async () => {
    // Setup test data
    const user = await createTestUser({
      email: 'trpc-test@example.com',
      onboardingCompleted: true
    })
    userId = user.id
    
    const client = await createTestClient({
      userId,
      name: 'TRPC Test Client',
      email: 'client@trpc-test.com'
    })
    clientId = client.id
  })
  
  afterEach(async () => {
    await cleanupTestData()
  })

  test('should create recurring invoice with advanced scheduling via tRPC', async () => {
    // Create a mock context for tRPC
    const ctx = {
      session: { user: { id: userId } },
      db: prisma
    }
    
    const caller = appRouter.createCaller(ctx)
    
    const holidays = [
      new Date('2024-12-25'), // Christmas
      new Date('2024-01-01')  // New Year
    ]
    
    const input = {
      templateName: 'Advanced TRPC Template',
      clientId,
      frequency: 'WEEKLY' as const,
      interval: 1,
      dayOfWeek: 1, // Monday
      startDate: new Date(),
      invoiceType: 'EXPORT' as const,
      currency: 'USD',
      paymentTerms: 30,
      serviceCode: '998311',
      skipWeekends: true,
      skipHolidays: true,
      holidayCalendar: holidays,
      timezone: 'America/New_York',
      scheduleTime: '10:30',
      lineItems: [{
        description: 'Weekly Advanced Service',
        hsnCode: '998311',
        quantity: 1,
        rate: 750,
        isVariable: false
      }]
    }
    
    const result = await caller.recurringInvoices.createRecurringInvoice(input)
    
    expect(result).toBeDefined()
    expect(result.templateName).toBe('Advanced TRPC Template')
    expect(result.skipWeekends).toBe(true)
    expect(result.skipHolidays).toBe(true)
    expect(result.timezone).toBe('America/New_York')
    expect(result.scheduleTime).toBe('10:30')
    expect(result.holidayCalendar).toEqual(holidays.map(h => h.toISOString()))
    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0].description).toBe('Weekly Advanced Service')
    expect(result.status).toBe('ACTIVE')
  })

  test('should update recurring invoice schedule with advanced features via tRPC', async () => {
    // First create a basic recurring invoice
    const recurringInvoice = await prisma.recurringInvoice.create({
      data: {
        userId,
        templateName: 'Basic Schedule',
        clientId,
        frequency: 'MONTHLY',
        interval: 1,
        startDate: new Date(),
        nextRunDate: addDays(new Date(), 30),
        invoiceType: 'EXPORT',
        currency: 'USD',
        paymentTerms: 30,
        serviceCode: '998311',
        lineItems: {
          create: [{
            description: 'Basic Service',
            hsnCode: '998311',
            quantity: 1,
            rate: 500,
            isVariable: false
          }]
        }
      }
    })
    
    // Create a mock context for tRPC
    const ctx = {
      session: { user: { id: userId } },
      db: prisma
    }
    
    const caller = appRouter.createCaller(ctx)
    
    const holidays = [new Date('2024-07-04')] // Independence Day
    
    const updateInput = {
      id: recurringInvoice.id,
      frequency: 'WEEKLY' as const,
      interval: 2,
      dayOfWeek: 3, // Wednesday
      skipWeekends: true,
      skipHolidays: true,
      holidayCalendar: holidays,
      timezone: 'Europe/London',
      scheduleTime: '14:15'
    }
    
    const result = await caller.recurringInvoices.updateRecurringSchedule(updateInput)
    
    expect(result).toBeDefined()
    expect(result.frequency).toBe('WEEKLY')
    expect(result.interval).toBe(2)
    expect(result.dayOfWeek).toBe(3)
    expect(result.skipWeekends).toBe(true)
    expect(result.skipHolidays).toBe(true)
    expect(result.timezone).toBe('Europe/London')
    expect(result.scheduleTime).toBe('14:15')
    expect(result.holidayCalendar).toEqual(holidays.map(h => h.toISOString()))
  })

  test('should validate schedule time format via tRPC', async () => {
    // Create a mock context for tRPC
    const ctx = {
      session: { user: { id: userId } },
      db: prisma
    }
    
    const caller = appRouter.createCaller(ctx)
    
    const input = {
      templateName: 'Invalid Time Template',
      clientId,
      frequency: 'DAILY' as const,
      interval: 1,
      startDate: new Date(),
      invoiceType: 'EXPORT' as const,
      currency: 'USD',
      paymentTerms: 30,
      serviceCode: '998311',
      scheduleTime: '25:70', // Invalid time format
      lineItems: [{
        description: 'Daily Service',
        hsnCode: '998311',
        quantity: 1,
        rate: 100,
        isVariable: false
      }]
    }
    
    await expect(
      caller.recurringInvoices.createRecurringInvoice(input)
    ).rejects.toThrow() // Should fail due to invalid time format
  })

  test('should use default values when advanced fields not provided via tRPC', async () => {
    // Create a mock context for tRPC
    const ctx = {
      session: { user: { id: userId } },
      db: prisma
    }
    
    const caller = appRouter.createCaller(ctx)
    
    const input = {
      templateName: 'Default Values Template',
      clientId,
      frequency: 'MONTHLY' as const,
      interval: 1,
      startDate: new Date(),
      invoiceType: 'EXPORT' as const,
      currency: 'USD',
      paymentTerms: 30,
      serviceCode: '998311',
      // Not providing advanced scheduling fields - should use defaults
      lineItems: [{
        description: 'Monthly Service',
        hsnCode: '998311',
        quantity: 1,
        rate: 1200,
        isVariable: false
      }]
    }
    
    const result = await caller.recurringInvoices.createRecurringInvoice(input)
    
    expect(result).toBeDefined()
    expect(result.skipWeekends).toBe(false) // Default value
    expect(result.skipHolidays).toBe(false) // Default value
    expect(result.timezone).toBe('Asia/Kolkata') // Default value
    expect(result.holidayCalendar).toBeNull()
    expect(result.scheduleTime).toBeNull()
  })
})