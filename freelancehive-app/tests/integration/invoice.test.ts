import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appRouter } from '@/server/api/root'
import { createTRPCContext } from '@/server/api/trpc'
import { createTestUser, createTestClient, cleanupDatabase, prisma } from '../utils/test-helpers'
import type { Session } from 'next-auth'
import { INVOICE_STATUS, GST_CONSTANTS, FISCAL_YEAR } from '@/lib/constants'

describe('Invoice Router', () => {
  let testUser: any
  let testClient: any
  let testLUT: any
  let ctx: any
  let caller: any

  beforeEach(async () => {
    // Create test data
    testUser = await createTestUser({
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
    })
    
    testClient = await createTestClient(testUser.id)
    
    // Create LUT for 0% GST
    testLUT = await prisma.lUT.create({
      data: {
        userId: testUser.id,
        lutNumber: 'AD290124000001',
        lutDate: new Date('2024-01-01'),
        validFrom: new Date('2024-01-01'),
        validTill: new Date('2024-12-31'),
        isActive: true,
      },
    })
    
    // Create exchange rate
    await prisma.exchangeRate.create({
      data: {
        currency: 'USD',
        rate: 83.50,
        source: 'RBI',
        date: new Date(),
      },
    })
    
    // Create context with authenticated session
    const session: Session = {
      user: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }
    
    ctx = await createTRPCContext({
      req: {
        headers: new Headers(),
      } as any,
    })
    
    ctx.session = session
    caller = appRouter.createCaller(ctx)
  })

  afterEach(async () => {
    await cleanupDatabase()
  })

  describe('create', () => {
    it('should create invoice with GST compliance', async () => {
      const currentFY = FISCAL_YEAR.getCurrent()
      
      const invoice = await caller.invoices.create({
        clientId: testClient.id,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: 'USD',
        exchangeRate: 1,
        exchangeRateSource: 'Manual',
        lutId: testLUT.id,
        description: 'Software development services',
        paymentTerms: 'Net 30 days',
        bankDetails: 'HDFC Bank\nAccount: 1234567890',
        lineItems: [
          {
            description: 'Backend API Development',
            quantity: 80,
            rate: 50,
            sacCode: '99831400',
          },
          {
            description: 'Frontend Development',
            quantity: 20,
            rate: 50,
            sacCode: '99831400',
          },
        ],
      })

      // Check GST compliance
      expect(invoice.placeOfSupply).toBe(GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT)
      expect(invoice.igstRate).toBe(0)
      expect(invoice.igstAmount).toBe(0)
      expect(invoice.lutId).toBe(testLUT.id)
      
      // Check invoice number format
      expect(invoice.invoiceNumber).toMatch(/^FY\d{2}-\d{2}\/\d{3}$/)
      expect(invoice.invoiceNumber).toContain(currentFY.slice(2, 5))
      
      // Check calculations
      expect(Number(invoice.subtotal)).toBe(5000)
      expect(Number(invoice.totalAmount)).toBe(5000)
      expect(Number(invoice.exchangeRate)).toBe(83.50)
      expect(Number(invoice.totalInINR)).toBe(417500)
      
      // Check line items
      expect(invoice.lineItems).toHaveLength(2)
      expect(invoice.lineItems[0].serviceCode).toBe('99831400')
    })

    it('should validate 8-digit service code for exports', async () => {
      await expect(
        caller.invoices.create({
          clientId: testClient.id,
          issueDate: new Date(),
          dueDate: new Date(),
          currency: 'USD',
          lutId: testLUT.id,
          lineItems: [
            {
              description: 'Invalid service code',
              quantity: 1,
              rate: 100,
              sacCode: '9983', // Only 4 digits
            },
          ],
        })
      ).rejects.toThrow('Service code must be 8 digits for exports')
    })

    it('should enforce 0% IGST for LUT exports', async () => {
      await expect(
        caller.invoices.create({
          clientId: testClient.id,
          issueDate: new Date(),
          dueDate: new Date(),
          currency: 'USD',
          lutId: testLUT.id,
          igstRate: 18, // Should be 0
          lineItems: [
            {
              description: 'Service',
              quantity: 1,
              rate: 100,
              sacCode: '99831400',
            },
          ],
        })
      ).rejects.toThrow('IGST must be 0% for exports under LUT')
    })

    it('should auto-generate sequential invoice numbers', async () => {
      // Create first invoice
      const invoice1 = await caller.invoices.create({
        clientId: testClient.id,
        issueDate: new Date(),
        dueDate: new Date(),
        currency: 'USD',
        exchangeRate: 1,
        exchangeRateSource: 'Manual',
        lutId: testLUT.id,
        lineItems: [
          {
            description: 'Service 1',
            quantity: 1,
            rate: 100,
            sacCode: '99831400',
          },
        ],
      })

      // Create second invoice
      const invoice2 = await caller.invoices.create({
        clientId: testClient.id,
        issueDate: new Date(),
        dueDate: new Date(),
        currency: 'USD',
        exchangeRate: 1,
        exchangeRateSource: 'Manual',
        lutId: testLUT.id,
        lineItems: [
          {
            description: 'Service 2',
            quantity: 1,
            rate: 100,
            sacCode: '99831400',
          },
        ],
      })

      const num1 = parseInt(invoice1.invoiceNumber.split('/')[1])
      const num2 = parseInt(invoice2.invoiceNumber.split('/')[1])
      
      expect(num2).toBe(num1 + 1)
    })

    it('should fetch current exchange rate', async () => {
      const invoice = await caller.invoices.create({
        clientId: testClient.id,
        issueDate: new Date(),
        dueDate: new Date(),
        currency: 'USD',
        exchangeRate: 1,
        exchangeRateSource: 'Manual',
        lutId: testLUT.id,
        lineItems: [
          {
            description: 'Service',
            quantity: 1,
            rate: 100,
            sacCode: '99831400',
          },
        ],
      })

      expect(invoice.exchangeSource).toBe('RBI')
      expect(Number(invoice.exchangeRate)).toBe(83.50)
    })

    it('should validate LUT is active and valid', async () => {
      // Create expired LUT
      const expiredLUT = await prisma.lUT.create({
        data: {
          userId: testUser.id,
          lutNumber: 'AD290124000002',
          lutDate: new Date('2023-01-01'),
          validFrom: new Date('2023-01-01'),
          validTill: new Date('2023-12-31'), // Expired
          isActive: true,
        },
      })

      await expect(
        caller.invoices.create({
          clientId: testClient.id,
          issueDate: new Date(),
          dueDate: new Date(),
          currency: 'USD',
          lutId: expiredLUT.id,
          lineItems: [
            {
              description: 'Service',
              quantity: 1,
              rate: 100,
              sacCode: '99831400',
            },
          ],
        })
      ).rejects.toThrow('LUT has expired')
    })
  })

  describe('list', () => {
    it('should return only invoices for authenticated user', async () => {
      // Create invoice for test user
      await caller.invoices.create({
        clientId: testClient.id,
        issueDate: new Date(),
        dueDate: new Date(),
        currency: 'USD',
        exchangeRate: 1,
        exchangeRateSource: 'Manual',
        lutId: testLUT.id,
        lineItems: [
          {
            description: 'Service',
            quantity: 1,
            rate: 100,
            sacCode: '99831400',
          },
        ],
      })

      // Create another user with invoice
      const otherUser = await createTestUser()
      const otherClient = await createTestClient(otherUser.id)
      const otherLUT = await prisma.lUT.create({
        data: {
          userId: otherUser.id,
          lutNumber: 'AD290124000003',
          lutDate: new Date(),
          validFrom: new Date(),
          validTill: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      })
      
      const otherCtx = { ...ctx, session: { user: { id: otherUser.id } } }
      const otherCaller = appRouter.createCaller(otherCtx)
      
      await otherCaller.invoices.create({
        clientId: otherClient.id,
        issueDate: new Date(),
        dueDate: new Date(),
        currency: 'USD',
        exchangeRate: 1,
        exchangeRateSource: 'Manual',
        lutId: otherLUT.id,
        lineItems: [
          {
            description: 'Other Service',
            quantity: 1,
            rate: 200,
            sacCode: '99831400',
          },
        ],
      })

      // List should only return test user's invoice
      const invoices = await caller.invoices.list()
      expect(invoices).toHaveLength(1)
      expect(invoices[0].lineItems[0].description).toBe('Service')
    })
  })
})