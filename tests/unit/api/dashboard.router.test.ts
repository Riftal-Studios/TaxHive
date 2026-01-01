import { describe, it, expect, beforeEach, vi } from 'vitest'
import { dashboardRouter } from '@/server/api/routers/dashboard'
import type { Session } from 'next-auth'
import { Prisma } from '@prisma/client'
const Decimal = Prisma.Decimal

// Mock Prisma
const mockPrismaInvoice = {
  count: vi.fn(),
  findMany: vi.fn(),
  aggregate: vi.fn(),
  groupBy: vi.fn(),
}

const mockPrismaClient = {
  count: vi.fn(),
}

const mockPrismaExchangeRate = {
  findFirst: vi.fn(),
}

const mockPrisma = {
  invoice: mockPrismaInvoice,
  client: mockPrismaClient,
  exchangeRate: mockPrismaExchangeRate,
}

describe('Dashboard Router', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
    expires: '2025-01-01',
  }

  const createContext = (session: Session | null = mockSession) => {
    return {
      session,
      prisma: mockPrisma as any,
      req: {
        headers: new Headers(),
      } as any,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getMetrics', () => {
    it('should return dashboard metrics for the user', async () => {
      // Mock total invoices count
      mockPrismaInvoice.count.mockResolvedValueOnce(25) // Total invoices
      mockPrismaInvoice.count.mockResolvedValueOnce(8)  // This month
      mockPrismaInvoice.count.mockResolvedValueOnce(15) // This FY

      // Mock revenue aggregation
      mockPrismaInvoice.aggregate.mockResolvedValueOnce({
        _sum: {
          totalInINR: new Decimal('1500000'),
        },
      })

      // Mock pending payments
      mockPrismaInvoice.aggregate.mockResolvedValueOnce({
        _sum: {
          totalInINR: new Decimal('350000'),
        },
        _count: {
          id: 5,
        },
      })

      // Mock overdue invoices
      mockPrismaInvoice.findMany.mockResolvedValueOnce([
        {
          id: 'inv-1',
          totalInINR: new Decimal('50000'),
          dueDate: new Date('2024-12-01'),
        },
        {
          id: 'inv-2',
          totalInINR: new Decimal('75000'),
          dueDate: new Date('2024-11-15'),
        },
      ])

      // Mock active clients
      mockPrismaClient.count.mockResolvedValueOnce(12)

      // Mock average invoice value
      mockPrismaInvoice.aggregate.mockResolvedValueOnce({
        _avg: {
          totalInINR: new Decimal('60000'),
        },
      })

      const caller = dashboardRouter.createCaller(createContext())
      const result = await caller.getMetrics()

      expect(result).toEqual({
        totalInvoices: {
          allTime: 25,
          thisMonth: 8,
          thisYear: 15,
        },
        revenue: {
          total: 1500000,
          currency: 'INR',
        },
        pendingPayments: {
          count: 5,
          amount: 350000,
        },
        overdueInvoices: {
          count: 2,
          amount: 125000,
        },
        activeClients: 12,
        averageInvoiceValue: 60000,
      })
    })

    it('should handle zero values gracefully', async () => {
      mockPrismaInvoice.count.mockResolvedValue(0)
      mockPrismaInvoice.aggregate.mockResolvedValue({
        _sum: { totalInINR: null },
        _count: { id: 0 },
        _avg: { totalInINR: null },
      })
      mockPrismaInvoice.findMany.mockResolvedValue([])
      mockPrismaClient.count.mockResolvedValue(0)

      const caller = dashboardRouter.createCaller(createContext())
      const result = await caller.getMetrics()

      expect(result).toEqual({
        totalInvoices: {
          allTime: 0,
          thisMonth: 0,
          thisYear: 0,
        },
        revenue: {
          total: 0,
          currency: 'INR',
        },
        pendingPayments: {
          count: 0,
          amount: 0,
        },
        overdueInvoices: {
          count: 0,
          amount: 0,
        },
        activeClients: 0,
        averageInvoiceValue: 0,
      })
    })

    it('should throw error if not authenticated', async () => {
      const caller = dashboardRouter.createCaller(createContext(null))
      await expect(caller.getMetrics()).rejects.toThrow('UNAUTHORIZED')
    })
  })

  describe('getRecentInvoices', () => {
    it('should return recent invoices with client details', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          invoiceNumber: 'FY24-25/001',
          invoiceDate: new Date('2024-12-20'),
          totalInINR: new Decimal('100000'),
          status: 'SENT',
          client: {
            name: 'Tech Corp',
            company: 'Tech Corp Inc',
          },
        },
        {
          id: 'inv-2',
          invoiceNumber: 'FY24-25/002',
          invoiceDate: new Date('2024-12-15'),
          totalInINR: new Decimal('75000'),
          status: 'PAID',
          client: {
            name: 'Digital Agency',
            company: null,
          },
        },
      ]

      mockPrismaInvoice.findMany.mockResolvedValueOnce(mockInvoices)

      const caller = dashboardRouter.createCaller(createContext())
      const result = await caller.getRecentInvoices({ limit: 5 })

      expect(result).toEqual([
        {
          id: 'inv-1',
          invoiceNumber: 'FY24-25/001',
          invoiceDate: new Date('2024-12-20'),
          amount: 100000,
          status: 'SENT',
          clientName: 'Tech Corp',
          companyName: 'Tech Corp Inc',
        },
        {
          id: 'inv-2',
          invoiceNumber: 'FY24-25/002',
          invoiceDate: new Date('2024-12-15'),
          amount: 75000,
          status: 'PAID',
          clientName: 'Digital Agency',
          companyName: null,
        },
      ])

      expect(mockPrismaInvoice.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          totalInINR: true,
          status: true,
          client: {
            select: {
              name: true,
              company: true,
            },
          },
        },
        orderBy: { invoiceDate: 'desc' },
        take: 5,
      })
    })

    it('should apply limit parameter', async () => {
      mockPrismaInvoice.findMany.mockResolvedValueOnce([])

      const caller = dashboardRouter.createCaller(createContext())
      await caller.getRecentInvoices({ limit: 10 })

      expect(mockPrismaInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      )
    })

    it('should use default limit if not provided', async () => {
      mockPrismaInvoice.findMany.mockResolvedValueOnce([])

      const caller = dashboardRouter.createCaller(createContext())
      await caller.getRecentInvoices()

      expect(mockPrismaInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      )
    })
  })

  describe('getPaymentStatusBreakdown', () => {
    it('should return payment status breakdown with counts and amounts', async () => {
      const mockStatusGroups = [
        {
          status: 'PAID',
          _count: { id: 10 },
          _sum: { totalInINR: new Decimal('800000') },
        },
        {
          status: 'SENT',
          _count: { id: 5 },
          _sum: { totalInINR: new Decimal('350000') },
        },
        {
          status: 'DRAFT',
          _count: { id: 3 },
          _sum: { totalInINR: new Decimal('150000') },
        },
      ]

      mockPrismaInvoice.groupBy.mockResolvedValueOnce(mockStatusGroups)

      const caller = dashboardRouter.createCaller(createContext())
      const result = await caller.getPaymentStatusBreakdown()

      expect(result).toEqual([
        { status: 'PAID', count: 10, amount: 800000 },
        { status: 'SENT', count: 5, amount: 350000 },
        { status: 'DRAFT', count: 3, amount: 150000 },
      ])
    })

    it('should handle null sum values', async () => {
      const mockStatusGroups = [
        {
          status: 'CANCELLED',
          _count: { id: 2 },
          _sum: { totalInINR: null },
        },
      ]

      mockPrismaInvoice.groupBy.mockResolvedValueOnce(mockStatusGroups)

      const caller = dashboardRouter.createCaller(createContext())
      const result = await caller.getPaymentStatusBreakdown()

      expect(result).toEqual([
        { status: 'CANCELLED', count: 2, amount: 0 },
      ])
    })
  })

  describe('getClientDistribution', () => {
    it('should return top clients by invoice count and revenue', async () => {
      const mockClientGroups = [
        {
          clientId: 'client-1',
          _count: { id: 15 },
          _sum: { totalInINR: new Decimal('1200000') },
          client: {
            name: 'Tech Corp',
            company: 'Tech Corp Inc',
          },
        },
        {
          clientId: 'client-2',
          _count: { id: 8 },
          _sum: { totalInINR: new Decimal('600000') },
          client: {
            name: 'Digital Agency',
            company: null,
          },
        },
      ]

      mockPrismaInvoice.groupBy.mockResolvedValueOnce(mockClientGroups)
      
      // Need to mock the enhanced client details
      mockPrismaInvoice.findMany.mockResolvedValueOnce([
        {
          clientId: 'client-1',
          client: {
            name: 'Tech Corp',
            company: 'Tech Corp Inc',
          },
        },
        {
          clientId: 'client-2',
          client: {
            name: 'Digital Agency',
            company: null,
          },
        },
      ])

      const caller = dashboardRouter.createCaller(createContext())
      const result = await caller.getClientDistribution({ limit: 5 })

      expect(result).toEqual([
        {
          clientId: 'client-1',
          clientName: 'Tech Corp',
          companyName: 'Tech Corp Inc',
          invoiceCount: 15,
          totalRevenue: 1200000,
        },
        {
          clientId: 'client-2',
          clientName: 'Digital Agency',
          companyName: null,
          invoiceCount: 8,
          totalRevenue: 600000,
        },
      ])
    })

    it('should limit results based on parameter', async () => {
      mockPrismaInvoice.groupBy.mockResolvedValueOnce([])
      mockPrismaInvoice.findMany.mockResolvedValueOnce([])

      const caller = dashboardRouter.createCaller(createContext())
      await caller.getClientDistribution({ limit: 10 })

      expect(mockPrismaInvoice.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      )
    })
  })

  describe('getRevenueByMonth', () => {
    it('should return revenue aggregated by month', async () => {
      const mockInvoices = [
        {
          invoiceDate: new Date('2024-12-15'),
          totalInINR: new Decimal('100000'),
          currency: 'USD',
        },
        {
          invoiceDate: new Date('2024-12-20'),
          totalInINR: new Decimal('75000'),
          currency: 'EUR',
        },
        {
          invoiceDate: new Date('2024-11-10'),
          totalInINR: new Decimal('150000'),
          currency: 'USD',
        },
      ]

      mockPrismaInvoice.findMany.mockResolvedValueOnce(mockInvoices)

      const caller = dashboardRouter.createCaller(createContext())
      const result = await caller.getRevenueByMonth({ months: 6 })

      expect(result).toContainEqual({
        month: '2024-12',
        revenue: 175000,
        invoiceCount: 2,
      })
      expect(result).toContainEqual({
        month: '2024-11',
        revenue: 150000,
        invoiceCount: 1,
      })
    })

    it('should include months with zero revenue', async () => {
      mockPrismaInvoice.findMany.mockResolvedValueOnce([])

      const caller = dashboardRouter.createCaller(createContext())
      const result = await caller.getRevenueByMonth({ months: 3 })

      expect(result).toHaveLength(3)
      result.forEach(month => {
        expect(month.revenue).toBe(0)
        expect(month.invoiceCount).toBe(0)
      })
    })
  })
})