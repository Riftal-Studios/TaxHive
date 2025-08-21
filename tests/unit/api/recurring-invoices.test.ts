import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { createTRPCMsw } from 'msw-trpc'
import { setupServer } from 'msw/node'
import { appRouter } from '@/server/api/root'
import { createTestUser, createTestClient, cleanupTestData } from '@/tests/utils/test-helpers'
import { addDays, addMonths } from 'date-fns'

// Mock tRPC context
const mockContext = {
  session: { user: { id: 'test-user-id' } },
  db: undefined // Will be set in beforeEach
}

// Create MSW server for API mocking
const server = setupServer()

describe('Recurring Invoices tRPC Router (TDD)', () => {
  let userId: string
  let clientId: string
  
  beforeEach(async () => {
    server.listen()
    
    // Setup test data
    const user = await createTestUser({
      email: 'trpc-test@example.com',
      onboardingCompleted: true
    })
    userId = user.id
    mockContext.session.user.id = userId
    
    const client = await createTestClient({
      userId,
      name: 'tRPC Test Client',
      email: 'client@trpc-test.com'
    })
    clientId = client.id
  })
  
  afterEach(async () => {
    server.resetHandlers()
    server.close()
    await cleanupTestData()
  })

  describe('Advanced Template Operations (TDD - RED Phase)', () => {
    test('should fail: create template with custom fields via API', async () => {
      // RED: This test should fail - custom fields endpoint not implemented
      const templateData = {
        templateName: 'Custom Fields Template',
        clientId,
        frequency: 'MONTHLY' as const,
        interval: 1,
        startDate: new Date(),
        invoiceType: 'EXPORT' as const,
        currency: 'USD',
        paymentTerms: 30,
        serviceCode: '998311',
        customFields: { // This should fail - not in API schema
          projectCode: 'PROJ-001',
          department: 'Engineering',
          costCenter: 'CC-123'
        },
        lineItems: [{
          description: 'Consulting Services',
          hsnCode: '998311',
          quantity: 1,
          rate: 1000,
          isVariable: false
        }]
      }
      
      // This should fail because customFields is not in the input schema
      expect(() => {
        // TypeScript should catch this error
        appRouter.createCaller(mockContext).recurringInvoices.createRecurringInvoice({
          ...templateData,
          // @ts-expect-error: customFields not in schema
          customFields: templateData.customFields
        })
      }).toThrow() // Should fail at TypeScript level
    })
    
    test('should fail: bulk create templates', async () => {
      // RED: This test should fail - bulk operations not implemented
      const templatesData = [
        {
          templateName: 'Template 1',
          clientId,
          frequency: 'MONTHLY' as const,
          interval: 1,
          startDate: new Date(),
          invoiceType: 'EXPORT' as const,
          currency: 'USD',
          paymentTerms: 30,
          serviceCode: '998311',
          lineItems: [{
            description: 'Service 1',
            hsnCode: '998311',
            quantity: 1,
            rate: 1000,
            isVariable: false
          }]
        },
        {
          templateName: 'Template 2',
          clientId,
          frequency: 'WEEKLY' as const,
          interval: 1,
          startDate: new Date(),
          invoiceType: 'EXPORT' as const,
          currency: 'USD',
          paymentTerms: 15,
          serviceCode: '998311',
          lineItems: [{
            description: 'Service 2',
            hsnCode: '998311',
            quantity: 1,
            rate: 500,
            isVariable: false
          }]
        }
      ]
      
      // This should fail because bulk create endpoint doesn't exist
      expect(() => {
        // @ts-expect-error: bulkCreateRecurringInvoices doesn't exist
        appRouter.createCaller(mockContext).recurringInvoices.bulkCreateRecurringInvoices({
          templates: templatesData
        })
      }).toThrow() // Should fail - endpoint doesn't exist
    })
    
    test('should fail: duplicate template with modifications', async () => {
      // RED: This test should fail - template duplication with modifications not implemented
      const originalTemplateId = 'template-id-123'
      const modifications = {
        templateName: 'Duplicated Template',
        frequency: 'WEEKLY' as const,
        interval: 2,
        customizations: {
          adjustPricing: true,
          priceMultiplier: 1.1
        }
      }
      
      // This should fail because advanced duplication endpoint doesn't exist
      expect(() => {
        // @ts-expect-error: duplicateTemplateWithModifications doesn't exist
        appRouter.createCaller(mockContext).recurringInvoices.duplicateTemplateWithModifications({
          sourceTemplateId: originalTemplateId,
          modifications
        })
      }).toThrow() // Should fail - endpoint doesn't exist
    })
  })

  describe('Usage Tracking API (TDD - RED Phase)', () => {
    test('should fail: record usage data via API', async () => {
      // RED: This test should fail - usage tracking API not implemented
      const usageData = {
        recurringInvoiceId: 'template-id-123',
        lineItemId: 'line-item-id-456',
        period: new Date(),
        usageRecords: [
          { timestamp: new Date(), quantity: 100, metadata: { endpoint: '/api/v1' } },
          { timestamp: addDays(new Date(), 1), quantity: 150, metadata: { endpoint: '/api/v2' } }
        ]
      }
      
      // This should fail because usage tracking endpoint doesn't exist
      expect(() => {
        // @ts-expect-error: recordUsageBatch doesn't exist
        appRouter.createCaller(mockContext).recurringInvoices.recordUsageBatch(usageData)
      }).toThrow() // Should fail - endpoint doesn't exist
    })
    
    test('should fail: get usage analytics', async () => {
      // RED: This test should fail - usage analytics API not implemented
      const analyticsQuery = {
        recurringInvoiceId: 'template-id-123',
        period: 'last_30_days',
        groupBy: 'day',
        metrics: ['total_usage', 'average_daily', 'peak_usage']
      }
      
      // This should fail because usage analytics endpoint doesn't exist
      expect(() => {
        // @ts-expect-error: getUsageAnalytics doesn't exist
        appRouter.createCaller(mockContext).recurringInvoices.getUsageAnalytics(analyticsQuery)
      }).toThrow() // Should fail - endpoint doesn't exist
    })
  })

  describe('Advanced Scheduling API (TDD - RED Phase)', () => {
    test('should fail: update template with holiday calendar', async () => {
      // RED: This test should fail - holiday calendar API not implemented
      const templateId = 'template-id-123'
      const holidaySettings = {
        skipWeekends: true,
        skipHolidays: true,
        holidayCalendar: 'US_FEDERAL',
        customHolidays: [
          { date: new Date('2024-12-24'), name: 'Christmas Eve' },
          { date: new Date('2024-12-31'), name: 'New Year Eve' }
        ],
        rescheduleStrategy: 'next_business_day' as const
      }
      
      // This should fail because holiday calendar update endpoint doesn't exist
      expect(() => {
        // @ts-expect-error: updateHolidaySettings doesn't exist
        appRouter.createCaller(mockContext).recurringInvoices.updateHolidaySettings({
          id: templateId,
          ...holidaySettings
        })
      }).toThrow() // Should fail - endpoint doesn't exist
    })
    
    test('should fail: set timezone-aware scheduling', async () => {
      // RED: This test should fail - timezone scheduling API not implemented
      const templateId = 'template-id-123'
      const timezoneSettings = {
        timezone: 'America/New_York',
        scheduleTime: '09:00',
        businessHoursOnly: true,
        businessHours: {
          start: '09:00',
          end: '17:00',
          weekdays: [1, 2, 3, 4, 5] // Monday to Friday
        }
      }
      
      // This should fail because timezone settings endpoint doesn't exist
      expect(() => {
        // @ts-expect-error: updateTimezoneSettings doesn't exist
        appRouter.createCaller(mockContext).recurringInvoices.updateTimezoneSettings({
          id: templateId,
          ...timezoneSettings
        })
      }).toThrow() // Should fail - endpoint doesn't exist
    })
  })

  describe('Template Analytics API (TDD - RED Phase)', () => {
    test('should fail: get template performance metrics', async () => {
      // RED: This test should fail - analytics API not implemented
      const templateId = 'template-id-123'
      const metricsQuery = {
        period: 'last_90_days',
        metrics: [
          'generation_success_rate',
          'average_generation_time',
          'total_revenue',
          'payment_success_rate',
          'client_satisfaction'
        ]
      }
      
      // This should fail because analytics endpoint doesn't exist
      expect(() => {
        // @ts-expect-error: getTemplateMetrics doesn't exist
        appRouter.createCaller(mockContext).recurringInvoices.getTemplateMetrics({
          id: templateId,
          ...metricsQuery
        })
      }).toThrow() // Should fail - endpoint doesn't exist
    })
    
    test('should fail: get template insights and recommendations', async () => {
      // RED: This test should fail - insights API not implemented
      const templateId = 'template-id-123'
      
      // This should fail because insights endpoint doesn't exist
      expect(() => {
        // @ts-expect-error: getTemplateInsights doesn't exist
        appRouter.createCaller(mockContext).recurringInvoices.getTemplateInsights({
          id: templateId,
          includeRecommendations: true,
          analysisDepth: 'comprehensive'
        })
      }).toThrow() // Should fail - endpoint doesn't exist
    })
  })

  describe('Template Versioning API (TDD - RED Phase)', () => {
    test('should fail: create new template version', async () => {
      // RED: This test should fail - versioning API not implemented
      const templateId = 'template-id-123'
      const versionData = {
        versionNumber: '2.0.0',
        changeDescription: 'Updated pricing and added new line item',
        changes: {
          lineItems: {
            added: [{
              description: 'New Service',
              hsnCode: '998311',
              quantity: 1,
              rate: 200,
              isVariable: false
            }],
            modified: [{
              id: 'line-item-1',
              rate: 1100 // Increased from 1000
            }]
          },
          schedule: {
            frequency: 'WEEKLY', // Changed from MONTHLY
            interval: 2
          }
        },
        effectiveDate: addDays(new Date(), 30)
      }
      
      // This should fail because versioning endpoint doesn't exist
      expect(() => {
        // @ts-expect-error: createTemplateVersion doesn't exist
        appRouter.createCaller(mockContext).recurringInvoices.createTemplateVersion({
          templateId,
          ...versionData
        })
      }).toThrow() // Should fail - endpoint doesn't exist
    })
    
    test('should fail: get template version history', async () => {
      // RED: This test should fail - version history API not implemented
      const templateId = 'template-id-123'
      
      // This should fail because version history endpoint doesn't exist
      expect(() => {
        // @ts-expect-error: getTemplateVersionHistory doesn't exist
        appRouter.createCaller(mockContext).recurringInvoices.getTemplateVersionHistory({
          id: templateId,
          includeChangelog: true,
          includeDiff: true
        })
      }).toThrow() // Should fail - endpoint doesn't exist
    })
  })

  describe('Existing API Functionality Tests (GREEN Phase)', () => {
    test('should successfully create recurring invoice via API', async () => {
      // GREEN: This should pass - basic API functionality exists
      const templateData = {
        templateName: 'API Test Template',
        clientId,
        frequency: 'MONTHLY' as const,
        interval: 1,
        startDate: new Date(),
        invoiceType: 'EXPORT' as const,
        currency: 'USD',
        paymentTerms: 30,
        serviceCode: '998311',
        lineItems: [{
          description: 'Consulting Services',
          hsnCode: '998311',
          quantity: 1,
          rate: 1000,
          isVariable: false
        }]
      }
      
      // Mock the context and database
      const mockDb = {
        client: {
          findFirst: vi.fn().mockResolvedValue({ id: clientId, userId, name: 'Test Client' })
        },
        recurringInvoice: {
          create: vi.fn().mockResolvedValue({
            id: 'created-template-id',
            ...templateData,
            userId,
            nextRunDate: addMonths(templateData.startDate, 1),
            lineItems: templateData.lineItems
          })
        }
      }
      
      const caller = appRouter.createCaller({
        ...mockContext,
        db: mockDb
      })
      
      const result = await caller.recurringInvoices.createRecurringInvoice(templateData)
      
      expect(result).toBeDefined()
      expect(result.templateName).toBe(templateData.templateName)
      expect(mockDb.recurringInvoice.create).toHaveBeenCalledOnce()
    })
    
    test('should successfully record basic usage', async () => {
      // GREEN: This should pass - basic usage recording exists
      const usageData = {
        recurringInvoiceId: 'template-id-123',
        lineItemId: 'line-item-id-456',
        quantity: 5000,
        period: new Date()
      }
      
      // Mock the database calls
      const mockDb = {
        recurringLineItem: {
          findFirst: vi.fn().mockResolvedValue({
            id: usageData.lineItemId,
            isVariable: true,
            minimumQuantity: 1000,
            maximumQuantity: 10000,
            recurringInvoice: { userId }
          })
        }
      }
      
      const caller = appRouter.createCaller({
        ...mockContext,
        db: mockDb
      })
      
      const result = await caller.recurringInvoices.recordUsage(usageData)
      
      expect(result.success).toBe(true)
      expect(result.quantity).toBe(usageData.quantity)
    })
  })
})