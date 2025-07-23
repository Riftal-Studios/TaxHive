import { describe, it, expect, beforeEach, vi } from 'vitest'
import { lutRouter } from '@/server/api/routers/lut'
import type { Session } from 'next-auth'

// Mock Prisma
const mockPrismaLUT = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}

const mockPrismaInvoice = {
  count: vi.fn(),
}

const mockPrisma = {
  lUT: mockPrismaLUT,
  invoice: mockPrismaInvoice,
}

describe('LUT Router', () => {
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

  describe('list', () => {
    it('should return all LUTs for the user', async () => {
      const mockLUTs = [
        {
          id: 'lut-1',
          userId: 'user-123',
          lutNumber: 'AD290320241234567',
          lutDate: new Date('2024-03-29'),
          validFrom: new Date('2024-04-01'),
          validTill: new Date('2025-03-31'),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'lut-2',
          userId: 'user-123',
          lutNumber: 'AD290320231234567',
          lutDate: new Date('2023-03-29'),
          validFrom: new Date('2023-04-01'),
          validTill: new Date('2024-03-31'),
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockPrismaLUT.findMany.mockResolvedValueOnce(mockLUTs)

      const caller = lutRouter.createCaller(createContext())
      const result = await caller.list()

      expect(result).toEqual(mockLUTs)
      expect(mockPrismaLUT.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { validTill: 'desc' },
      })
    })

    it('should return only active LUTs when filtered', async () => {
      const mockActiveLUTs = [
        {
          id: 'lut-1',
          userId: 'user-123',
          lutNumber: 'AD290320241234567',
          lutDate: new Date('2024-03-29'),
          validFrom: new Date('2024-04-01'),
          validTill: new Date('2025-03-31'),
          isActive: true,
        },
      ]

      mockPrismaLUT.findMany.mockResolvedValueOnce(mockActiveLUTs)

      const caller = lutRouter.createCaller(createContext())
      const result = await caller.list({ activeOnly: true })

      expect(result).toEqual(mockActiveLUTs)
      expect(mockPrismaLUT.findMany).toHaveBeenCalledWith({
        where: { 
          userId: 'user-123',
          isActive: true,
        },
        orderBy: { validTill: 'desc' },
      })
    })

    it('should throw error if not authenticated', async () => {
      const caller = lutRouter.createCaller(createContext(null))
      await expect(caller.list()).rejects.toThrow('UNAUTHORIZED')
    })
  })

  describe('create', () => {
    it('should create a new LUT with valid data', async () => {
      const newLUT = {
        lutNumber: 'AD290320241234567',
        lutDate: new Date('2024-03-29'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      }

      const createdLUT = {
        id: 'lut-new',
        userId: 'user-123',
        ...newLUT,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaLUT.create.mockResolvedValueOnce(createdLUT)

      const caller = lutRouter.createCaller(createContext())
      const result = await caller.create(newLUT)

      expect(result).toEqual(createdLUT)
      expect(mockPrismaLUT.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          ...newLUT,
          isActive: true,
        },
      })
    })

    it('should validate LUT number format', async () => {
      const invalidLUTs = [
        { lutNumber: '123', lutDate: new Date(), validFrom: new Date(), validTill: new Date() }, // Too short
        { lutNumber: 'INVALID123456789012345', lutDate: new Date(), validFrom: new Date(), validTill: new Date() }, // Invalid format
        { lutNumber: '', lutDate: new Date(), validFrom: new Date(), validTill: new Date() }, // Empty
      ]

      const caller = lutRouter.createCaller(createContext())

      for (const invalidLUT of invalidLUTs) {
        await expect(caller.create(invalidLUT)).rejects.toThrow()
      }
    })

    it('should validate date ranges', async () => {
      const caller = lutRouter.createCaller(createContext())

      // validFrom after validTill
      await expect(
        caller.create({
          lutNumber: 'AD290320241234567',
          lutDate: new Date('2024-03-29'),
          validFrom: new Date('2025-04-01'),
          validTill: new Date('2024-03-31'),
        })
      ).rejects.toThrow('Valid from date must be before valid till date')

      // lutDate after validFrom
      await expect(
        caller.create({
          lutNumber: 'AD290320241234567',
          lutDate: new Date('2024-04-15'),
          validFrom: new Date('2024-04-01'),
          validTill: new Date('2025-03-31'),
        })
      ).rejects.toThrow('LUT date must be before or equal to valid from date')
    })

    it('should deactivate overlapping LUTs', async () => {
      const newLUT = {
        lutNumber: 'AD290320241234567',
        lutDate: new Date('2024-03-29'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      }

      mockPrismaLUT.create.mockResolvedValueOnce({
        id: 'lut-new',
        userId: 'user-123',
        ...newLUT,
        isActive: true,
      })

      const caller = lutRouter.createCaller(createContext())
      await caller.create(newLUT)

      // Should deactivate other active LUTs
      expect(mockPrismaLUT.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
          id: { not: 'lut-new' }, // The newly created LUT's ID
        },
        data: { isActive: false },
      })
    })

    it('should throw error if not authenticated', async () => {
      const caller = lutRouter.createCaller(createContext(null))
      await expect(
        caller.create({
          lutNumber: 'AD290320241234567',
          lutDate: new Date(),
          validFrom: new Date(),
          validTill: new Date(),
        })
      ).rejects.toThrow('UNAUTHORIZED')
    })
  })

  describe('update', () => {
    it('should update LUT details', async () => {
      const updateData = {
        id: 'lut-1',
        lutNumber: 'AD290320241234568',
        validTill: new Date('2025-06-30'),
      }

      const updatedLUT = {
        id: 'lut-1',
        userId: 'user-123',
        lutNumber: 'AD290320241234568',
        lutDate: new Date('2024-03-29'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-06-30'),
        isActive: true,
      }

      mockPrismaLUT.findUnique.mockResolvedValueOnce({ 
        userId: 'user-123',
        lutDate: new Date('2024-03-29'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })
      mockPrismaLUT.update.mockResolvedValueOnce(updatedLUT)

      const caller = lutRouter.createCaller(createContext())
      const result = await caller.update(updateData)

      expect(result).toEqual(updatedLUT)
      expect(mockPrismaLUT.update).toHaveBeenCalledWith({
        where: { id: 'lut-1' },
        data: {
          lutNumber: 'AD290320241234568',
          validTill: new Date('2025-06-30'),
        },
      })
    })

    it('should prevent updating another user\'s LUT', async () => {
      mockPrismaLUT.findUnique.mockResolvedValueOnce({ userId: 'other-user' })

      const caller = lutRouter.createCaller(createContext())
      await expect(
        caller.update({
          id: 'lut-1',
          lutNumber: 'AD290320241234568',
        })
      ).rejects.toThrow('Not found')
    })

    it('should validate updated date ranges', async () => {
      mockPrismaLUT.findUnique.mockResolvedValueOnce({
        userId: 'user-123',
        validFrom: new Date('2024-04-01'),
      })

      const caller = lutRouter.createCaller(createContext())
      
      await expect(
        caller.update({
          id: 'lut-1',
          validTill: new Date('2024-03-01'), // Before validFrom
        })
      ).rejects.toThrow()
    })

    it('should throw error if not authenticated', async () => {
      const caller = lutRouter.createCaller(createContext(null))
      await expect(
        caller.update({ id: 'lut-1', lutNumber: 'NEW123' })
      ).rejects.toThrow('UNAUTHORIZED')
    })
  })

  describe('delete', () => {
    it('should delete LUT if no invoices are using it', async () => {
      mockPrismaLUT.findUnique.mockResolvedValueOnce({ userId: 'user-123' })
      mockPrismaInvoice.count.mockResolvedValueOnce(0)

      const caller = lutRouter.createCaller(createContext())
      await caller.delete({ id: 'lut-1' })

      expect(mockPrismaLUT.delete).toHaveBeenCalledWith({
        where: { id: 'lut-1' },
      })
    })

    it('should prevent deletion if invoices are using the LUT', async () => {
      mockPrismaLUT.findUnique.mockResolvedValueOnce({ userId: 'user-123' })
      mockPrismaInvoice.count.mockResolvedValueOnce(5)

      const caller = lutRouter.createCaller(createContext())
      await expect(
        caller.delete({ id: 'lut-1' })
      ).rejects.toThrow('Cannot delete LUT that is referenced by invoices')
    })

    it('should prevent deleting another user\'s LUT', async () => {
      mockPrismaLUT.findUnique.mockResolvedValueOnce({ userId: 'other-user' })

      const caller = lutRouter.createCaller(createContext())
      await expect(
        caller.delete({ id: 'lut-1' })
      ).rejects.toThrow('Not found')
    })

    it('should throw error if not authenticated', async () => {
      const caller = lutRouter.createCaller(createContext(null))
      await expect(
        caller.delete({ id: 'lut-1' })
      ).rejects.toThrow('UNAUTHORIZED')
    })
  })

  describe('toggleActive', () => {
    it('should toggle LUT active status', async () => {
      mockPrismaLUT.findUnique.mockResolvedValueOnce({ 
        userId: 'user-123',
        isActive: true,
      })

      mockPrismaLUT.update.mockResolvedValueOnce({
        id: 'lut-1',
        isActive: false,
      })

      const caller = lutRouter.createCaller(createContext())
      const result = await caller.toggleActive({ id: 'lut-1' })

      expect(result.isActive).toBe(false)
      expect(mockPrismaLUT.update).toHaveBeenCalledWith({
        where: { id: 'lut-1' },
        data: { isActive: false },
      })
    })

    it('should deactivate other LUTs when activating one', async () => {
      mockPrismaLUT.findUnique.mockResolvedValueOnce({ 
        userId: 'user-123',
        isActive: false,
      })

      mockPrismaLUT.update.mockResolvedValueOnce({
        id: 'lut-1',
        isActive: true,
      })

      const caller = lutRouter.createCaller(createContext())
      await caller.toggleActive({ id: 'lut-1' })

      // Should deactivate other active LUTs
      expect(mockPrismaLUT.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
          id: { not: 'lut-1' },
        },
        data: { isActive: false },
      })
    })

    it('should prevent toggling another user\'s LUT', async () => {
      mockPrismaLUT.findUnique.mockResolvedValueOnce({ userId: 'other-user' })

      const caller = lutRouter.createCaller(createContext())
      await expect(
        caller.toggleActive({ id: 'lut-1' })
      ).rejects.toThrow('Not found')
    })

    it('should throw error if not authenticated', async () => {
      const caller = lutRouter.createCaller(createContext(null))
      await expect(
        caller.toggleActive({ id: 'lut-1' })
      ).rejects.toThrow('UNAUTHORIZED')
    })
  })
})