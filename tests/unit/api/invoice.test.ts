import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import type { Session } from 'next-auth'

// Mock dependencies first before importing them
vi.mock('@/lib/prisma', () => ({
  db: {
    invoice: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    invoiceItem: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  prisma: {
    invoice: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/pdf-generator', () => ({
  generateInvoicePDF: vi.fn(),
}))

vi.mock('@/lib/queue/bullmq.service', () => ({
  BullMQService: vi.fn().mockImplementation(() => ({
    enqueueJob: vi.fn(),
    getJob: vi.fn(),
  })),
}))

// Now import the modules
import { db } from '@/lib/prisma'
import { invoiceRouter } from '@/server/api/routers/invoice'

// Set up transaction mock implementation
;(db.$transaction as any).mockImplementation(async (callback: any) => {
  // Create a complete transaction mock that includes all the methods
  const txMock = {
    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    invoiceItem: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
  return callback(txMock)
})

const mockSession: Session = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  },
  expires: '2025-12-31',
}

const createCaller = () => {
  return invoiceRouter.createCaller({
    session: mockSession,
    prisma: db as any,
    req: {} as any,
  })
}

describe('Invoice Router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset transaction mock
    ;(db.$transaction as any).mockImplementation(async (callback: any) => {
      const txMock = {
        invoice: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          count: vi.fn().mockResolvedValue(0),
        },
        invoiceItem: {
          createMany: vi.fn(),
          deleteMany: vi.fn(),
        },
      }
      return callback(txMock)
    })
  })

  describe('list', () => {
    it('should list invoices for the current user', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          userId: 'test-user-id',
          clientId: 'client-1',
          invoiceNumber: 'FY24-25/001',
          issueDate: new Date('2024-04-15'),
          dueDate: new Date('2024-05-15'),
          currency: 'USD',
          exchangeRate: 83.5,
          subtotal: 1000,
          totalAmount: 1000,
          status: 'DRAFT',
          client: {
            id: 'client-1',
            name: 'Test Client',
            email: 'client@example.com',
          },
        },
      ]

      vi.mocked(db.invoice.findMany).mockResolvedValue(mockInvoices as any)

      const caller = createCaller()
      const result = await caller.list()

      expect(db.invoice.findMany).toHaveBeenCalledWith({
        where: { userId: 'test-user-id' },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
      })
      expect(result).toEqual(mockInvoices)
    })
  })

  describe('getById', () => {
    it('should get invoice by id', async () => {
      const mockInvoice = {
        id: 'inv-1',
        userId: 'test-user-id',
        clientId: 'client-1',
        invoiceNumber: 'FY24-25/001',
        client: {
          id: 'client-1',
          name: 'Test Client',
        },
        lineItems: [
          {
            id: 'item-1',
            description: 'Web Development',
            sacCode: '99831190',
            quantity: 10,
            rate: 100,
            amount: 1000,
          },
        ],
        lut: {
          id: 'lut-1',
          lutNumber: 'AD1234567890123',
          validFrom: new Date('2024-04-01'),
          validTill: new Date('2025-03-31'),
        },
      }

      vi.mocked(db.invoice.findUnique).mockResolvedValue(mockInvoice as any)

      const caller = createCaller()
      const result = await caller.getById({ id: 'inv-1' })

      expect(db.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv-1', userId: 'test-user-id' },
        include: {
          client: true,
          lineItems: true,
          lut: true,
        },
      })
      expect(result).toEqual(mockInvoice)
    })

    it('should throw error if invoice not found', async () => {
      vi.mocked(db.invoice.findUnique).mockResolvedValue(null)

      const caller = createCaller()
      await expect(caller.getById({ id: 'non-existent' })).rejects.toThrow(
        TRPCError
      )
    })
  })

  describe('create', () => {
    it('should create invoice with line items', async () => {
      const input = {
        clientId: 'client-1',
        lutId: 'lut-1',
        issueDate: new Date('2024-04-15'),
        dueDate: new Date('2024-05-15'),
        currency: 'USD',
        exchangeRate: 83.5,
        exchangeRateSource: 'RBI',
        paymentTerms: 30,
        notes: 'Thank you for your business',
        bankDetails: 'Bank: Test Bank\nAccount: 1234567890',
        lineItems: [
          {
            description: 'Web Development Services',
            sacCode: '99831190',
            quantity: 10,
            rate: 100,
          },
          {
            description: 'UI/UX Design',
            sacCode: '99831140',
            quantity: 5,
            rate: 80,
          },
        ],
      }

      const mockInvoice = {
        id: 'inv-1',
        userId: 'test-user-id',
        invoiceNumber: 'FY24-25/001',
        ...input,
        subtotal: 1400,
        gstAmount: 0,
        totalAmount: 1400,
        status: 'DRAFT',
      }

      // Mock transaction
      const mockTx = {
        invoice: {
          findMany: vi.fn().mockResolvedValue([]), // Add findMany for invoice number generation
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue(mockInvoice),
          update: vi.fn().mockResolvedValue(mockInvoice), // Add update method
        },
        invoiceItem: { // Changed from lineItem to invoiceItem to match schema
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      }

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const caller = createCaller()
      const result = await caller.create(input)

      expect(mockTx.invoice.findMany).toHaveBeenCalled() // Check findMany was called
      expect(mockTx.invoice.create).toHaveBeenCalled()
      expect(mockTx.invoiceItem.createMany).toHaveBeenCalled() // Changed from lineItem to invoiceItem
      expect(result).toEqual(mockInvoice)
    })

    it('should validate HSN/SAC codes', async () => {
      const input = {
        clientId: 'client-1',
        lutId: 'lut-1',
        issueDate: new Date('2024-04-15'),
        dueDate: new Date('2024-05-15'),
        currency: 'USD',
        exchangeRate: 83.5,
        exchangeRateSource: 'RBI',
        paymentTerms: 30,
        lineItems: [
          {
            description: 'Invalid SAC code',
            sacCode: '1234', // Invalid - should be 8 digits
            quantity: 10,
            rate: 100,
          },
        ],
      }

      const caller = createCaller()
      await expect(caller.create(input)).rejects.toThrow()
    })
  })

  describe('update', () => {
    it('should update invoice and line items', async () => {
      const input = {
        id: 'inv-1',
        notes: 'Updated notes',
        lineItems: [
          {
            description: 'Updated Service',
            sacCode: '99831190',
            quantity: 20,
            rate: 150,
          },
        ],
      }

      const mockUpdatedInvoice = {
        id: 'inv-1',
        userId: 'test-user-id',
        notes: 'Updated notes',
        subtotal: 3000,
        totalAmount: 3000,
      }

      const mockTx = {
        invoice: {
          findUnique: vi.fn().mockResolvedValue({ id: 'inv-1', exchangeRate: 1 }), // Add findUnique method
          update: vi.fn().mockResolvedValue(mockUpdatedInvoice),
        },
        invoiceItem: { // Changed from lineItem to invoiceItem
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
      }

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(mockTx as any)
      })

      const caller = createCaller()
      const result = await caller.update(input)

      expect(mockTx.invoice.update).toHaveBeenCalled()
      expect(mockTx.invoiceItem.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId: 'inv-1' },
      })
      expect(mockTx.invoiceItem.createMany).toHaveBeenCalled()
      expect(result).toEqual(mockUpdatedInvoice)
    })
  })

  describe('delete', () => {
    it('should delete invoice', async () => {
      const mockInvoice = {
        id: 'inv-1',
        userId: 'test-user-id',
      }

      vi.mocked(db.invoice.delete).mockResolvedValue(mockInvoice as any)

      const caller = createCaller()
      const result = await caller.delete({ id: 'inv-1' })

      expect(db.invoice.delete).toHaveBeenCalledWith({
        where: { id: 'inv-1', userId: 'test-user-id' },
      })
      expect(result).toEqual(mockInvoice)
    })
  })

  describe('updateStatus', () => {
    it('should update invoice status', async () => {
      const mockInvoice = {
        id: 'inv-1',
        userId: 'test-user-id',
        status: 'SENT',
      }

      vi.mocked(db.invoice.update).mockResolvedValue(mockInvoice as any)

      const caller = createCaller()
      const result = await caller.updateStatus({ id: 'inv-1', status: 'SENT' })

      expect(db.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1', userId: 'test-user-id' },
        data: { status: 'SENT' },
      })
      expect(result).toEqual(mockInvoice)
    })
  })

  describe('getNextInvoiceNumber', () => {
    it('should get next invoice number for fiscal year', async () => {
      // Mock findMany to return existing invoices with invoice numbers
      vi.mocked(db.invoice.findMany).mockResolvedValue([
        { invoiceNumber: 'FY25-26/001' },
        { invoiceNumber: 'FY25-26/002' },
        { invoiceNumber: 'FY25-26/003' },
        { invoiceNumber: 'FY25-26/004' },
        { invoiceNumber: 'FY25-26/005' },
      ] as any)

      const caller = createCaller()
      const result = await caller.getNextInvoiceNumber()

      expect(db.invoice.findMany).toHaveBeenCalled()
      expect(result).toMatch(/^FY\d{2}-\d{2}\/006$/)
    })

    it('should start from 001 for new fiscal year', async () => {
      // Mock findMany to return no existing invoices
      vi.mocked(db.invoice.findMany).mockResolvedValue([])

      const caller = createCaller()
      const result = await caller.getNextInvoiceNumber()

      expect(result).toMatch(/^FY\d{2}-\d{2}\/001$/)
    })
  })
})