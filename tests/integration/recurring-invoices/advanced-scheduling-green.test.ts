import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createTestUser, createTestClient, cleanupTestData } from '@/tests/utils/test-helpers'
import { addDays, addWeeks, isWeekend } from 'date-fns'

describe('Advanced Scheduling (TDD - GREEN Phase)', () => {
  let userId: string
  let clientId: string
  
  beforeEach(async () => {
    // Setup test data
    const user = await createTestUser({
      email: 'advanced-test@example.com',
      onboardingCompleted: true
    })
    userId = user.id
    
    const client = await createTestClient({
      userId,
      name: 'Advanced Test Client',
      email: 'client@advanced-test.com'
    })
    clientId = client.id
  })
  
  afterEach(async () => {
    await cleanupTestData()
  })

  test('should successfully create template with weekend/holiday skipping', async () => {
    // GREEN: This should now pass - advanced scheduling implemented
    const holidays = [
      new Date('2024-12-25'), // Christmas
      new Date('2024-01-01')  // New Year
    ]
    
    const templateData = {
      templateName: 'Business Days Only',
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
      lineItems: [{
        description: 'Weekly Service',
        hsnCode: '998311',
        quantity: 1,
        rate: 500,
        isVariable: false
      }]
    }
    
    const recurringInvoice = await prisma.recurringInvoice.create({
      data: {
        userId,
        templateName: templateData.templateName,
        clientId: templateData.clientId,
        frequency: templateData.frequency,
        interval: templateData.interval,
        dayOfWeek: templateData.dayOfWeek,
        startDate: templateData.startDate,
        nextRunDate: addWeeks(templateData.startDate, 1),
        invoiceType: templateData.invoiceType,
        currency: templateData.currency,
        paymentTerms: templateData.paymentTerms,
        serviceCode: templateData.serviceCode,
        skipWeekends: templateData.skipWeekends,
        skipHolidays: templateData.skipHolidays,
        holidayCalendar: templateData.holidayCalendar,
        lineItems: {
          create: templateData.lineItems.map(item => ({
            description: item.description,
            hsnCode: item.hsnCode,
            quantity: item.quantity,
            rate: item.rate,
            isVariable: item.isVariable
          }))
        }
      },
      include: {
        lineItems: true
      }
    })
    
    expect(recurringInvoice).toBeDefined()
    expect(recurringInvoice.skipWeekends).toBe(true)
    expect(recurringInvoice.skipHolidays).toBe(true)
    expect(recurringInvoice.holidayCalendar).toEqual(holidays.map(h => h.toISOString()))
    expect(recurringInvoice.templateName).toBe(templateData.templateName)
    expect(recurringInvoice.lineItems).toHaveLength(1)
    expect(recurringInvoice.status).toBe('ACTIVE')
  })
  
  test('should successfully create template with timezone-aware scheduling', async () => {
    // GREEN: This should now pass - timezone handling implemented
    const templateData = {
      templateName: 'Timezone Aware Template',
      clientId,
      frequency: 'DAILY' as const,
      interval: 1,
      startDate: new Date(),
      invoiceType: 'EXPORT' as const,
      currency: 'USD',
      paymentTerms: 30,
      serviceCode: '998311',
      timezone: 'America/New_York',
      scheduleTime: '09:00',
      lineItems: [{
        description: 'Daily Service',
        hsnCode: '998311',
        quantity: 1,
        rate: 100,
        isVariable: false
      }]
    }
    
    const recurringInvoice = await prisma.recurringInvoice.create({
      data: {
        userId,
        templateName: templateData.templateName,
        clientId: templateData.clientId,
        frequency: templateData.frequency,
        interval: templateData.interval,
        startDate: templateData.startDate,
        nextRunDate: addDays(templateData.startDate, 1),
        invoiceType: templateData.invoiceType,
        currency: templateData.currency,
        paymentTerms: templateData.paymentTerms,
        serviceCode: templateData.serviceCode,
        timezone: templateData.timezone,
        scheduleTime: templateData.scheduleTime,
        lineItems: {
          create: templateData.lineItems.map(item => ({
            description: item.description,
            hsnCode: item.hsnCode,
            quantity: item.quantity,
            rate: item.rate,
            isVariable: item.isVariable
          }))
        }
      },
      include: {
        lineItems: true
      }
    })
    
    expect(recurringInvoice).toBeDefined()
    expect(recurringInvoice.timezone).toBe('America/New_York')
    expect(recurringInvoice.scheduleTime).toBe('09:00')
    expect(recurringInvoice.templateName).toBe(templateData.templateName)
    expect(recurringInvoice.lineItems).toHaveLength(1)
    expect(recurringInvoice.status).toBe('ACTIVE')
  })

  test('should use default values for advanced scheduling fields', async () => {
    // Test that defaults are applied correctly
    const templateData = {
      templateName: 'Default Values Template',
      clientId,
      frequency: 'MONTHLY' as const,
      interval: 1,
      startDate: new Date(),
      invoiceType: 'EXPORT' as const,
      currency: 'USD',
      paymentTerms: 30,
      serviceCode: '998311',
      lineItems: [{
        description: 'Monthly Service',
        hsnCode: '998311',
        quantity: 1,
        rate: 1000,
        isVariable: false
      }]
    }
    
    const recurringInvoice = await prisma.recurringInvoice.create({
      data: {
        userId,
        templateName: templateData.templateName,
        clientId: templateData.clientId,
        frequency: templateData.frequency,
        interval: templateData.interval,
        startDate: templateData.startDate,
        nextRunDate: addDays(templateData.startDate, 30),
        invoiceType: templateData.invoiceType,
        currency: templateData.currency,
        paymentTerms: templateData.paymentTerms,
        serviceCode: templateData.serviceCode,
        lineItems: {
          create: templateData.lineItems.map(item => ({
            description: item.description,
            hsnCode: item.hsnCode,
            quantity: item.quantity,
            rate: item.rate,
            isVariable: item.isVariable
          }))
        }
      }
    })
    
    expect(recurringInvoice).toBeDefined()
    expect(recurringInvoice.skipWeekends).toBe(false) // Default value
    expect(recurringInvoice.skipHolidays).toBe(false) // Default value
    expect(recurringInvoice.timezone).toBe('Asia/Kolkata') // Default value
    expect(recurringInvoice.holidayCalendar).toBeNull()
    expect(recurringInvoice.scheduleTime).toBeNull()
  })
})