import { describe, it, expect, beforeEach, vi } from 'vitest'
import { userRouter } from '@/server/api/routers/user'
import type { Session } from 'next-auth'

// Mock Prisma
const mockPrismaUser = {
  findUnique: vi.fn(),
  update: vi.fn(),
}

const mockPrismaClient = {
  count: vi.fn(),
}

const mockPrismaInvoice = {
  count: vi.fn(),
}

const mockPrismaLUT = {
  count: vi.fn(),
}

const mockPrisma = {
  user: mockPrismaUser,
  client: mockPrismaClient,
  invoice: mockPrismaInvoice,
  lUT: mockPrismaLUT,
}

describe('User Onboarding', () => {
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

  describe('getOnboardingStatus', () => {
    it('should return initial onboarding status for new user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        onboardingCompleted: false,
        onboardingStep: null,
        name: null,
        gstin: null,
        pan: null,
        address: null,
      }

      mockPrismaUser.findUnique.mockResolvedValueOnce(mockUser)
      mockPrismaClient.count.mockResolvedValueOnce(0)
      mockPrismaLUT.count.mockResolvedValueOnce(0)
      mockPrismaInvoice.count.mockResolvedValueOnce(0)

      const caller = userRouter.createCaller(createContext())
      const status = await caller.getOnboardingStatus()

      expect(status).toEqual({
        completed: false,
        currentStep: 'profile',
        steps: {
          profile: {
            completed: false,
            required: true,
          },
          client: {
            completed: false,
            required: true,
          },
          lut: {
            completed: false,
            required: true,
          },
          invoice: {
            completed: false,
            required: false,
          },
        },
        progress: 0,
      })
    })

    it('should mark profile step as completed when all fields are filled', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        onboardingCompleted: false,
        onboardingStep: 'profile',
        name: 'Test User',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: '123 Test St',
      }

      mockPrismaUser.findUnique.mockResolvedValueOnce(mockUser)
      mockPrismaClient.count.mockResolvedValueOnce(0)
      mockPrismaLUT.count.mockResolvedValueOnce(0)
      mockPrismaInvoice.count.mockResolvedValueOnce(0)

      const caller = userRouter.createCaller(createContext())
      const status = await caller.getOnboardingStatus()

      expect(status.steps.profile.completed).toBe(true)
      expect(status.currentStep).toBe('client')
      expect(status.progress).toBe(33)
    })

    it('should calculate progress based on completed steps', async () => {
      const mockUser = {
        id: 'user-123',
        onboardingCompleted: false,
        onboardingStep: 'lut',
        name: 'Test User',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: '123 Test St',
      }

      mockPrismaUser.findUnique.mockResolvedValueOnce(mockUser)
      mockPrismaClient.count.mockResolvedValueOnce(1) // Has client
      mockPrismaLUT.count.mockResolvedValueOnce(0)
      mockPrismaInvoice.count.mockResolvedValueOnce(0)

      const caller = userRouter.createCaller(createContext())
      const status = await caller.getOnboardingStatus()

      expect(status.steps.profile.completed).toBe(true)
      expect(status.steps.client.completed).toBe(true)
      expect(status.steps.lut.completed).toBe(false)
      expect(status.progress).toBe(67)
    })

    it('should mark onboarding as completed when all required steps are done', async () => {
      const mockUser = {
        id: 'user-123',
        onboardingCompleted: true,
        onboardingStep: 'complete',
        name: 'Test User',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: '123 Test St',
      }

      mockPrismaUser.findUnique.mockResolvedValueOnce(mockUser)
      mockPrismaClient.count.mockResolvedValueOnce(1) // Has client
      mockPrismaLUT.count.mockResolvedValueOnce(1) // Has LUT
      mockPrismaInvoice.count.mockResolvedValueOnce(0)

      const caller = userRouter.createCaller(createContext())
      const status = await caller.getOnboardingStatus()

      expect(status.completed).toBe(true)
      expect(status.progress).toBe(100)
      expect(status.steps.profile.completed).toBe(true)
      expect(status.steps.client.completed).toBe(true)
      expect(status.steps.lut.completed).toBe(true)
    })

    it('should throw error if not authenticated', async () => {
      const caller = userRouter.createCaller(createContext(null))
      await expect(caller.getOnboardingStatus()).rejects.toThrow('UNAUTHORIZED')
    })
  })

  describe('updateOnboardingStep', () => {
    it('should update onboarding step', async () => {
      mockPrismaUser.update.mockResolvedValueOnce({
        id: 'user-123',
        onboardingStep: 'client',
      })

      const caller = userRouter.createCaller(createContext())
      const result = await caller.updateOnboardingStep({ step: 'client' })

      expect(result.onboardingStep).toBe('client')
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { onboardingStep: 'client' },
      })
    })

    it('should reject invalid onboarding steps', async () => {
      const caller = userRouter.createCaller(createContext())
      
      await expect(
        caller.updateOnboardingStep({ step: 'invalid' as any })
      ).rejects.toThrow()
    })

    it('should throw error if not authenticated', async () => {
      const caller = userRouter.createCaller(createContext(null))
      
      await expect(
        caller.updateOnboardingStep({ step: 'client' })
      ).rejects.toThrow('UNAUTHORIZED')
    })
  })

  describe('completeOnboarding', () => {
    it('should mark onboarding as completed', async () => {
      mockPrismaUser.update.mockResolvedValueOnce({
        id: 'user-123',
        onboardingCompleted: true,
        onboardingStep: 'complete',
      })

      const caller = userRouter.createCaller(createContext())
      const result = await caller.completeOnboarding()

      expect(result.onboardingCompleted).toBe(true)
      expect(result.onboardingStep).toBe('complete')
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          onboardingCompleted: true,
          onboardingStep: 'complete',
        },
      })
    })

    it('should throw error if not authenticated', async () => {
      const caller = userRouter.createCaller(createContext(null))
      await expect(caller.completeOnboarding()).rejects.toThrow('UNAUTHORIZED')
    })
  })

  describe('skipOnboarding', () => {
    it('should allow skipping onboarding', async () => {
      mockPrismaUser.update.mockResolvedValueOnce({
        id: 'user-123',
        onboardingCompleted: true,
        onboardingStep: 'skipped',
      })

      const caller = userRouter.createCaller(createContext())
      const result = await caller.skipOnboarding()

      expect(result.onboardingCompleted).toBe(true)
      expect(result.onboardingStep).toBe('skipped')
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          onboardingCompleted: true,
          onboardingStep: 'skipped',
        },
      })
    })

    it('should throw error if not authenticated', async () => {
      const caller = userRouter.createCaller(createContext(null))
      await expect(caller.skipOnboarding()).rejects.toThrow('UNAUTHORIZED')
    })
  })
})