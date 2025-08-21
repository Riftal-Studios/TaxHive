import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { faker } from '@faker-js/faker'

describe('Recurring Invoice TDD - Simple Implementation Plan', () => {
  let userId: string
  let clientId: string
  
  beforeEach(async () => {
    // Clean up first - order matters for foreign keys
    await prisma.recurringLineItem.deleteMany()
    await prisma.recurringInvoice.deleteMany()
    await prisma.subscription.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.client.deleteMany()
    await prisma.user.deleteMany()
    
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        name: 'TDD Test User',
        onboardingCompleted: true
      }
    })
    userId = user.id
    
    // Create test client
    const client = await prisma.client.create({
      data: {
        userId,
        name: 'TDD Test Client',
        email: faker.internet.email(),
        address: '123 Test St',
        country: 'United States'
      }
    })
    clientId = client.id
  })
  
  afterEach(async () => {
    // Clean up after each test - order matters for foreign keys
    await prisma.recurringLineItem.deleteMany()
    await prisma.recurringInvoice.deleteMany()
    await prisma.subscription.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.client.deleteMany()
    await prisma.user.deleteMany()
  })

  describe('TDD RED Phase - Features to Implement', () => {
    test('RED: Should fail to create template with custom fields (not in schema)', async () => {
      const templateData = {
        userId,
        templateName: 'Custom Fields Template',
        clientId,
        frequency: 'MONTHLY' as const,
        interval: 1,
        startDate: new Date(),
        nextRunDate: new Date(),
        invoiceType: 'EXPORT' as const,
        currency: 'USD',
        paymentTerms: 30,
        serviceCode: '998311',
      }
      
      // This should work fine - basic template creation
      const template = await prisma.recurringInvoice.create({
        data: templateData
      })
      
      expect(template).toBeDefined()
      
      // But trying to add custom fields should fail
      await expect(
        prisma.recurringInvoice.update({
          where: { id: template.id },
          data: {
            // @ts-expect-error: customFields doesn't exist in schema
            customFields: { projectCode: 'PROJ-001' }
          }
        })
      ).rejects.toThrow()
    })
    
    test('RED: Should fail to create usage tracking records (table does not exist)', async () => {
      // Create a basic recurring invoice with variable line item
      const template = await prisma.recurringInvoice.create({
        data: {
          userId,
          templateName: 'Usage Template',
          clientId,
          frequency: 'MONTHLY',
          interval: 1,
          startDate: new Date(),
          nextRunDate: new Date(),
          invoiceType: 'EXPORT',
          currency: 'USD',
          paymentTerms: 30,
          serviceCode: '998311',
          lineItems: {
            create: [{
              description: 'API Calls',
              hsnCode: '998311',
              quantity: 0,
              rate: 0.01,
              isVariable: true,
              minimumQuantity: 1000,
              maximumQuantity: 100000
            }]
          }
        },
        include: { lineItems: true }
      })
      
      const lineItem = template.lineItems[0]
      
      // This should fail - usageTracking table doesn't exist
      await expect(async () => {
        // @ts-expect-error: usageTracking table doesn't exist
        await prisma.usageTracking.create({
          data: {
            lineItemId: lineItem.id,
            period: new Date(),
            quantity: 5000,
            metadata: { source: 'api_gateway' }
          }
        })
      }).rejects.toThrow()
    })
    
    test('RED: Should fail to access template analytics (table does not exist)', async () => {
      // Create a basic template
      const template = await prisma.recurringInvoice.create({
        data: {
          userId,
          templateName: 'Analytics Template',
          clientId,
          frequency: 'MONTHLY',
          interval: 1,
          startDate: new Date(),
          nextRunDate: new Date(),
          invoiceType: 'EXPORT',
          currency: 'USD',
          paymentTerms: 30,
          serviceCode: '998311'
        }
      })
      
      // This should fail - templateAnalytics table doesn't exist
      await expect(async () => {
        // @ts-expect-error: templateAnalytics table doesn't exist
        await prisma.templateAnalytics.create({
          data: {
            templateId: template.id,
            metric: 'generation_success_rate',
            value: 0.95,
            period: 'monthly'
          }
        })
      }).rejects.toThrow()
    })
    
    test('RED: Should fail to create template with advanced scheduling (fields do not exist)', async () => {
      // This should fail because advanced scheduling fields don't exist
      await expect(
        prisma.recurringInvoice.create({
          data: {
            userId,
            templateName: 'Advanced Schedule Template',
            clientId,
            frequency: 'WEEKLY',
            interval: 1,
            startDate: new Date(),
            nextRunDate: new Date(),
            invoiceType: 'EXPORT',
            currency: 'USD',
            paymentTerms: 30,
            serviceCode: '998311',
            // @ts-expect-error: skipHolidays doesn't exist in schema
            skipHolidays: true,
            // @ts-expect-error: skipWeekends doesn't exist in schema
            skipWeekends: true,
            // @ts-expect-error: timezone doesn't exist in schema
            timezone: 'America/New_York'
          }
        })
      ).rejects.toThrow()
    })
    
    test('RED: Should fail to create template version (versioning not implemented)', async () => {
      // Create a basic template first
      const template = await prisma.recurringInvoice.create({
        data: {
          userId,
          templateName: 'Versioned Template',
          clientId,
          frequency: 'MONTHLY',
          interval: 1,
          startDate: new Date(),
          nextRunDate: new Date(),
          invoiceType: 'EXPORT',
          currency: 'USD',
          paymentTerms: 30,
          serviceCode: '998311'
        }
      })
      
      // This should fail - templateVersions table doesn't exist
      await expect(async () => {
        // @ts-expect-error: templateVersions table doesn't exist
        await prisma.templateVersions.create({
          data: {
            templateId: template.id,
            version: '2.0.0',
            changes: { pricing: 'updated' },
            createdBy: userId
          }
        })
      }).rejects.toThrow()
    })
  })

  describe('TDD GREEN Phase - Existing Features Work', () => {
    test('GREEN: Should successfully create basic recurring invoice template', async () => {
      const templateData = {
        userId,
        templateName: 'Basic Monthly Template',
        clientId,
        frequency: 'MONTHLY' as const,
        interval: 1,
        startDate: new Date(),
        nextRunDate: new Date(),
        invoiceType: 'EXPORT' as const,
        currency: 'USD',
        paymentTerms: 30,
        serviceCode: '998311'
      }
      
      const template = await prisma.recurringInvoice.create({
        data: templateData
      })
      
      expect(template).toBeDefined()
      expect(template.templateName).toBe('Basic Monthly Template')
      expect(template.status).toBe('ACTIVE')
      expect(template.frequency).toBe('MONTHLY')
    })
    
    test('GREEN: Should successfully create template with variable line items', async () => {
      const template = await prisma.recurringInvoice.create({
        data: {
          userId,
          templateName: 'Variable Service Template',
          clientId,
          frequency: 'MONTHLY',
          interval: 1,
          startDate: new Date(),
          nextRunDate: new Date(),
          invoiceType: 'EXPORT',
          currency: 'USD',
          paymentTerms: 30,
          serviceCode: '998311',
          lineItems: {
            create: [{
              description: 'Variable Hours',
              hsnCode: '998311',
              quantity: 10,
              rate: 150,
              isVariable: true,
              minimumQuantity: 5,
              maximumQuantity: 100
            }]
          }
        },
        include: { lineItems: true }
      })
      
      expect(template.lineItems).toHaveLength(1)
      expect(template.lineItems[0].isVariable).toBe(true)
      expect(template.lineItems[0].minimumQuantity).toBeDefined()
      expect(template.lineItems[0].maximumQuantity).toBeDefined()
    })
    
    test('GREEN: Should successfully create subscription', async () => {
      const subscription = await prisma.subscription.create({
        data: {
          userId,
          clientId,
          planName: 'Basic Plan',
          billingCycle: 'MONTHLY',
          amount: 99.99,
          currency: 'USD',
          startDate: new Date(),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      })
      
      expect(subscription).toBeDefined()
      expect(subscription.planName).toBe('Basic Plan')
      expect(subscription.status).toBe('ACTIVE')
      expect(subscription.billingCycle).toBe('MONTHLY')
    })
  })
})