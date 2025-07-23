import { describe, it, expect, beforeEach, vi } from 'vitest'
import { userRouter } from '@/server/api/routers/user'
import type { Session } from 'next-auth'

// Mock Prisma
const mockPrismaUser = {
  findUnique: vi.fn(),
  update: vi.fn(),
}

const mockPrisma = {
  user: mockPrismaUser,
}

describe('User Router', () => {
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

  describe('getProfile', () => {
    it('should return user profile with active LUTs', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: '123 Test St',
        luts: [
          {
            id: 'lut-1',
            lutNumber: 'LUT/2024/001',
            isActive: true,
            validTill: new Date('2025-12-31'),
          },
        ],
      }

      mockPrismaUser.findUnique.mockResolvedValueOnce(mockUser)

      const caller = userRouter.createCaller(createContext())
      const result = await caller.getProfile()

      expect(result).toEqual(mockUser)
      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: {
          luts: {
            where: { isActive: true },
            orderBy: { validTill: 'desc' },
          },
        },
      })
    })

    it('should throw error if not authenticated', async () => {
      const caller = userRouter.createCaller(createContext(null))
      await expect(caller.getProfile()).rejects.toThrow('UNAUTHORIZED')
    })
  })

  describe('updateProfile', () => {
    describe('GSTIN validation', () => {
      it('should accept valid GSTIN format', async () => {
        const validGSTINs = [
          '29ABCDE1234F1Z5',
          '27AAPFU0939F1ZV',
          '09AAACI1195H1Z8',
        ]

        for (const gstin of validGSTINs) {
          mockPrismaUser.update.mockResolvedValueOnce({ gstin })
          const caller = userRouter.createCaller(createContext())
          
          await expect(
            caller.updateProfile({ gstin })
          ).resolves.toBeTruthy()
        }
      })

      it('should reject invalid GSTIN format', async () => {
        const invalidGSTINs = [
          '29ABCDE1234F1Z', // Too short
          '29ABCDE1234F1Z55', // Too long
          '29ABCDE1234F1A5', // Wrong 14th character (should be Z)
          '2AABCDE1234F1Z5', // Only 1 digit at start
          '29ABCD1234F1Z5', // Only 4 letters in position 3-7
          '29ABCDE12F1Z5', // Only 2 digits in position 8-11
          '29ABCDE12341Z5', // No letter at position 12
          '29ABCDE1234FAZ5', // Letter instead of digit at position 13
          'AAABCDE1234F1Z5', // Letters instead of digits at start
        ]

        const caller = userRouter.createCaller(createContext())

        for (const gstin of invalidGSTINs) {
          await expect(
            caller.updateProfile({ gstin })
          ).rejects.toThrow()
        }
      })

      it('should allow empty GSTIN', async () => {
        mockPrismaUser.update.mockResolvedValueOnce({ gstin: '' })
        const caller = userRouter.createCaller(createContext())
        
        await expect(
          caller.updateProfile({ gstin: '' })
        ).resolves.toBeTruthy()
      })
    })

    describe('PAN validation', () => {
      it('should accept valid PAN format', async () => {
        const validPANs = [
          'ABCDE1234F',
          'ZZZZZ9999Z',
          'AAAPA1234C',
        ]

        for (const pan of validPANs) {
          mockPrismaUser.update.mockResolvedValueOnce({ pan })
          const caller = userRouter.createCaller(createContext())
          
          await expect(
            caller.updateProfile({ pan })
          ).resolves.toBeTruthy()
        }
      })

      it('should reject invalid PAN format', async () => {
        const invalidPANs = [
          'ABCDE1234', // Too short
          'ABCDE1234FG', // Too long
          'ABCD1234F', // Only 4 letters at start
          'ABCDE123F', // Only 3 digits in middle
          'ABCDE12345', // Digit instead of letter at end
          '12CDE1234F', // Digits at start
          'ABCDE1A34F', // Letter in digit position
        ]

        const caller = userRouter.createCaller(createContext())

        for (const pan of invalidPANs) {
          await expect(
            caller.updateProfile({ pan })
          ).rejects.toThrow()
        }
      })

      it('should allow empty PAN', async () => {
        mockPrismaUser.update.mockResolvedValueOnce({ pan: '' })
        const caller = userRouter.createCaller(createContext())
        
        await expect(
          caller.updateProfile({ pan: '' })
        ).resolves.toBeTruthy()
      })
    })

    describe('Profile update', () => {
      it('should update all profile fields', async () => {
        const updateData = {
          name: 'Updated Name',
          gstin: '29ABCDE1234F1Z5',
          pan: 'ABCDE1234F',
          address: 'Updated Address, City 123456',
        }

        mockPrismaUser.update.mockResolvedValueOnce({
          id: 'user-123',
          ...updateData,
        })

        const caller = userRouter.createCaller(createContext())
        const result = await caller.updateProfile(updateData)

        expect(result).toMatchObject(updateData)
        expect(mockPrismaUser.update).toHaveBeenCalledWith({
          where: { id: 'user-123' },
          data: updateData,
        })
      })

      it('should update only provided fields', async () => {
        const partialUpdate = {
          name: 'New Name',
          address: 'New Address',
        }

        mockPrismaUser.update.mockResolvedValueOnce({
          id: 'user-123',
          ...partialUpdate,
        })

        const caller = userRouter.createCaller(createContext())
        const result = await caller.updateProfile(partialUpdate)

        expect(result).toMatchObject(partialUpdate)
        expect(mockPrismaUser.update).toHaveBeenCalledWith({
          where: { id: 'user-123' },
          data: partialUpdate,
        })
      })

      it('should throw error if not authenticated', async () => {
        const caller = userRouter.createCaller(createContext(null))
        
        await expect(
          caller.updateProfile({ name: 'Test' })
        ).rejects.toThrow('UNAUTHORIZED')
      })

      it('should trim whitespace from all fields', async () => {
        const inputWithSpaces = {
          name: '  Test User  ',
          gstin: '  29ABCDE1234F1Z5  ',
          pan: '  ABCDE1234F  ',
          address: '  123 Test St  ',
        }

        const expectedData = {
          name: 'Test User',
          gstin: '29ABCDE1234F1Z5',
          pan: 'ABCDE1234F',
          address: '123 Test St',
        }

        mockPrismaUser.update.mockResolvedValueOnce({
          id: 'user-123',
          ...expectedData,
        })

        const caller = userRouter.createCaller(createContext())
        await caller.updateProfile(inputWithSpaces)

        expect(mockPrismaUser.update).toHaveBeenCalledWith({
          where: { id: 'user-123' },
          data: expectedData,
        })
      })

      it('should convert GSTIN and PAN to uppercase', async () => {
        const lowercaseInput = {
          gstin: '29abcde1234f1z5',
          pan: 'abcde1234f',
        }

        const expectedData = {
          gstin: '29ABCDE1234F1Z5',
          pan: 'ABCDE1234F',
        }

        mockPrismaUser.update.mockResolvedValueOnce({
          id: 'user-123',
          ...expectedData,
        })

        const caller = userRouter.createCaller(createContext())
        await caller.updateProfile(lowercaseInput)

        expect(mockPrismaUser.update).toHaveBeenCalledWith({
          where: { id: 'user-123' },
          data: expectedData,
        })
      })
    })
  })
})