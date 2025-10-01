import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Prisma first before importing modules that use it
vi.mock('@/lib/prisma', () => {
  const mockDb = {
    invoice: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    invoiceItem: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    client: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    payment: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback: any) => callback(mockDb)),
  }
  return {
    db: mockDb,
    prisma: mockDb, // Also export as prisma for compatibility
  }
})

// Mock cache
vi.mock('@/lib/cache/redis-cache', () => ({
  cache: {
    cached: vi.fn((type, key, fn) => fn()),
    clearType: vi.fn(),
    invalidate: vi.fn(),
  },
}))

// Now import the services after mocks are set up
import { InvoiceService } from '@/server/services/invoice.service'
import { ClientService } from '@/server/services/client.service'
import { db } from '@/lib/prisma'

// Get the mock db for easier access
const mockDb = db as any

describe('Service Layer Tests', () => {
  describe('InvoiceService', () => {
    let invoiceService: InvoiceService

    beforeEach(() => {
      invoiceService = new InvoiceService()
      vi.clearAllMocks()
    })

    it('should list invoices with filters', async () => {
      const mockInvoices = [
        { id: '1', invoiceNumber: 'INV-001', totalAmount: 1000 },
        { id: '2', invoiceNumber: 'INV-002', totalAmount: 2000 },
      ]

      mockDb.invoice.findMany.mockResolvedValue(mockInvoices as any)

      const result = await invoiceService.listInvoices({
        userId: 'user123',
        status: 'UNPAID',
      })

      expect(result).toEqual(mockInvoices)
      expect(mockDb.invoice.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          paymentStatus: 'UNPAID',
        },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should get invoice by id', async () => {
      const mockInvoice = {
        id: 'inv123',
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        payments: [],
      }

      mockDb.invoice.findUnique.mockResolvedValue(mockInvoice as any)

      const result = await invoiceService.getInvoiceById('inv123', 'user123', false)

      expect(result).toEqual(mockInvoice)
      expect(mockDb.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv123', userId: 'user123' },
        include: {
          client: true,
          lineItems: true,
          lut: true,
          payments: undefined,
        },
      })
    })

    it('should recalculate invoice balance', async () => {
      const mockInvoice = {
        id: 'inv123',
        totalAmount: 1000,
        payments: [
          { amount: 300 },
          { amount: 200 },
        ],
      }

      mockDb.invoice.findUnique.mockResolvedValue(mockInvoice as any)
      mockDb.invoice.update.mockResolvedValue({
        ...mockInvoice,
        amountPaid: 500,
        balanceDue: 500,
        paymentStatus: 'PARTIAL',
      } as any)

      const result = await invoiceService.recalculateBalance('inv123', 'user123')

      expect(result.amountPaid).toBe(500)
      expect(result.balanceDue).toBe(500)
      expect(result.paymentStatus).toBe('PARTIAL')
    })
  })

  describe('ClientService', () => {
    let clientService: ClientService

    beforeEach(() => {
      clientService = new ClientService()
      vi.clearAllMocks()
    })

    it('should create a client', async () => {
      const mockClient = {
        id: 'client123',
        name: 'Test Client',
        email: 'test@example.com',
      }

      mockDb.client.findFirst.mockResolvedValue(null) // No existing client
      mockDb.client.create.mockResolvedValue(mockClient as any)

      const result = await clientService.createClient({
        name: 'Test Client',
        email: 'test@example.com',
        address: '123 Test St',
        country: 'USA',
        userId: 'user123',
      })

      expect(result).toEqual(mockClient)
      expect(mockDb.client.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Client',
          email: 'test@example.com',
          address: '123 Test St',
          country: 'USA',
          userId: 'user123',
        },
      })
    })

    it('should list clients', async () => {
      const mockClients = [
        { id: '1', name: 'Client 1' },
        { id: '2', name: 'Client 2' },
      ]

      mockDb.client.findMany.mockResolvedValue(mockClients as any)

      const result = await clientService.listClients({ userId: 'user123' })

      expect(result).toEqual(mockClients)
      expect(mockDb.client.findMany).toHaveBeenCalledWith({
        where: { userId: 'user123', isActive: true },
        orderBy: { name: 'asc' },
      })
    })

    it('should update a client', async () => {
      const mockClient = {
        id: 'client123',
        name: 'Updated Client',
      }

      mockDb.client.findFirst.mockResolvedValue({ id: 'client123' } as any)
      mockDb.client.update.mockResolvedValue(mockClient as any)

      const result = await clientService.updateClient(
        'client123',
        { name: 'Updated Client' },
        'user123'
      )

      expect(result).toEqual(mockClient)
      expect(mockDb.client.update).toHaveBeenCalledWith({
        where: { id: 'client123' },
        data: { name: 'Updated Client' },
      })
    })

    it('should delete a client', async () => {
      mockDb.invoice.count.mockResolvedValue(0) // No invoices
      mockDb.client.deleteMany.mockResolvedValue({ count: 1 } as any)

      await clientService.deleteClient('client123', 'user123')

      expect(mockDb.client.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'client123',
          userId: 'user123',
        },
      })
    })

    it('should throw error when client not found for update', async () => {
      mockDb.client.findFirst.mockResolvedValue(null)

      await expect(
        clientService.updateClient('client123', { name: 'Test' }, 'user123')
      ).rejects.toThrow('Client not found')
    })

    it('should throw error when client not found for delete', async () => {
      mockDb.invoice.count.mockResolvedValue(0) // No invoices
      mockDb.client.deleteMany.mockResolvedValue({ count: 0 } as any)

      await expect(
        clientService.deleteClient('client123', 'user123')
      ).rejects.toThrow('Client not found')
    })
  })
})