import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { appRouter } from '@/server/api/root'
import { createTestUser, createTestClient, createTestContext, cleanupDatabase, prisma } from '../utils/test-helpers'
import type { Session } from 'next-auth'
import { INVOICE_STATUS, GST_CONSTANTS, FISCAL_YEAR } from '@/lib/constants'

// Mock the queue system to avoid Redis connections in tests
vi.mock('@/lib/queue/manager', () => ({
  queueManager: {
    addPDFGenerationJob: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    addEmailNotificationJob: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    addExchangeRateJob: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJobStatus: vi.fn().mockResolvedValue({ state: 'completed', progress: 100 }),
    cleanup: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('Invoice Router', () => {
  let testUser: any
  let testClient: any
  let testLUT: any
  let ctx: any
  let caller: any

  beforeEach(async () => {
    // Clean up any existing data first
    await cleanupDatabase()
    
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
    
    // Use test context creator to avoid Next.js API issues
    ctx = createTestContext(session)
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
        exchangeRate: 83.50,
        exchangeRateSource: 'RBI',
        lutId: testLUT.id,
        description: 'Software development services',
        paymentTerms: 30,
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
      expect(Number(invoice.igstRate)).toBe(0)
      expect(Number(invoice.igstAmount)).toBe(0)
      expect(invoice.lutId).toBe(testLUT.id)
      
      // Check invoice number format
      expect(invoice.invoiceNumber).toMatch(/^FY\d{2}-\d{2}\/\d{3}$/)
      expect(invoice.invoiceNumber).toContain(currentFY.slice(2, 5))
      
      // Check calculations
      expect(Number(invoice.subtotal)).toBe(5000)
      expect(Number(invoice.totalAmount)).toBe(5000)
      expect(Number(invoice.exchangeRate)).toBe(83.50)
      expect(Number(invoice.totalInINR)).toBe(417500)
      
      // Line items are not included in create response, but serviceCode is set from first item
      expect(invoice.serviceCode).toBe('99831400')
    })

    it('should validate 8-digit service code for exports', async () => {
      await expect(
        caller.invoices.create({
          clientId: testClient.id,
          issueDate: new Date(),
          dueDate: new Date(),
          currency: 'USD',
          exchangeRate: 83.50,
          exchangeRateSource: 'RBI',
          lutId: testLUT.id,
          lineItems: [
            {
              description: 'Invalid service code',
              quantity: 1,
              rate: 100,
              sacCode: '12345678', // Invalid code not in SAC list
            },
          ],
        })
      ).rejects.toThrow('HSN/SAC code must be a valid code from the GST Classification Scheme')
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

    it('should use provided exchange rate', async () => {
      const invoice = await caller.invoices.create({
        clientId: testClient.id,
        issueDate: new Date(),
        dueDate: new Date(),
        currency: 'USD',
        exchangeRate: 85.25,
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

      expect(invoice.exchangeSource).toBe('Manual')
      expect(Number(invoice.exchangeRate)).toBe(85.25)
    })

  })

  describe('list', () => {
    it('should return invoices for authenticated user', async () => {
      // Create invoice for test user
      await caller.invoices.create({
        clientId: testClient.id,
        issueDate: new Date(),
        dueDate: new Date(),
        currency: 'USD',
        exchangeRate: 85.0,
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

      // List should return the user's invoice
      const invoices = await caller.invoices.list()
      expect(invoices).toHaveLength(1)
      expect(invoices[0].serviceCode).toBe('99831400')
    })
  })
})