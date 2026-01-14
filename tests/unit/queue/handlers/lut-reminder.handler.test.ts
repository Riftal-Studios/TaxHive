import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Job, LutReminderJobData } from '@/lib/queue/types'
import type { LUT, User } from '@prisma/client'

// Mock the prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    lUT: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock the email service
vi.mock('@/lib/email/service', () => ({
  sendEmail: vi.fn(),
}))

// Import after mocks
import { lutReminderHandler } from '@/lib/queue/handlers/lut-reminder.handler'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/service'

describe('LUT Reminder Handler', () => {
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    emailVerified: null,
    password: null,
    gstin: '27AAPFU0939F1ZV',
    pan: 'AAPFU0939F',
    address: 'Test Address\nMumbai, MH 400001',
    onboardingCompleted: true,
    onboardingStep: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const createMockLUT = (overrides: Partial<LUT> = {}): LUT => ({
    id: 'lut-1',
    userId: 'user-1',
    lutNumber: 'AD290124000001',
    lutDate: new Date('2024-01-01'),
    validFrom: new Date('2024-04-01'),
    validTill: new Date('2025-03-31'),
    isActive: true,
    reminderSentAt: null,
    renewalReminderSentAt: null,
    previousLutId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('scheduled scan mode', () => {
    it('should find expiring LUTs and send reminders', async () => {
      vi.setSystemTime(new Date('2025-03-10'))

      const expiringLut = createMockLUT({
        validTill: new Date('2025-03-31'),
        reminderSentAt: null,
      })

      // Include user in the returned LUT (simulating Prisma include)
      vi.mocked(prisma.lUT.findMany).mockResolvedValue([{ ...expiringLut, user: mockUser }] as any)
      vi.mocked(prisma.lUT.update).mockResolvedValue({
        ...expiringLut,
        reminderSentAt: new Date(),
      })
      vi.mocked(sendEmail).mockResolvedValue({ messageId: 'msg-1', timestamp: new Date() })

      const mockJob: Job<LutReminderJobData> = {
        id: 'job-1',
        type: 'LUT_REMINDER',
        data: {
          mode: 'scan',
        },
        status: 'active',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await lutReminderHandler(mockJob)

      expect(prisma.lUT.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          reminderSentAt: null,
          validTill: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        include: {
          user: true,
        },
      })

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          template: 'lut-expiry-reminder',
        })
      )

      expect(prisma.lUT.update).toHaveBeenCalledWith({
        where: { id: expiringLut.id },
        data: { reminderSentAt: expect.any(Date) },
      })

      expect(result).toEqual({
        success: true,
        mode: 'scan',
        lutsFound: 1,
        remindersSent: 1,
        errors: [],
      })
    })

    it('should skip LUTs with reminders already sent', async () => {
      vi.setSystemTime(new Date('2025-03-10'))

      // Empty result since we filter in query
      vi.mocked(prisma.lUT.findMany).mockResolvedValue([])

      const mockJob: Job<LutReminderJobData> = {
        id: 'job-1',
        type: 'LUT_REMINDER',
        data: {
          mode: 'scan',
        },
        status: 'active',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await lutReminderHandler(mockJob)

      expect(result).toEqual({
        success: true,
        mode: 'scan',
        lutsFound: 0,
        remindersSent: 0,
        errors: [],
      })

      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('should handle email sending failures gracefully', async () => {
      vi.setSystemTime(new Date('2025-03-10'))

      const expiringLut = createMockLUT({
        validTill: new Date('2025-03-31'),
        reminderSentAt: null,
      })

      // Include user in the returned LUT (simulating Prisma include)
      vi.mocked(prisma.lUT.findMany).mockResolvedValue([{ ...expiringLut, user: mockUser }] as any)
      vi.mocked(sendEmail).mockRejectedValue(new Error('Email service unavailable'))

      const mockJob: Job<LutReminderJobData> = {
        id: 'job-1',
        type: 'LUT_REMINDER',
        data: {
          mode: 'scan',
        },
        status: 'active',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await lutReminderHandler(mockJob)

      expect(result).toEqual({
        success: true,
        mode: 'scan',
        lutsFound: 1,
        remindersSent: 0,
        errors: expect.arrayContaining([
          expect.objectContaining({
            lutId: expiringLut.id,
            error: 'Email service unavailable',
          }),
        ]),
      })

      // Should not mark as sent if email failed
      expect(prisma.lUT.update).not.toHaveBeenCalled()
    })

    it('should process multiple expiring LUTs', async () => {
      vi.setSystemTime(new Date('2025-03-10'))

      const lut1 = createMockLUT({ id: 'lut-1', userId: 'user-1' })
      const lut2 = createMockLUT({ id: 'lut-2', userId: 'user-2' })

      const user1 = { ...mockUser, id: 'user-1' }
      const user2 = { ...mockUser, id: 'user-2', email: 'user2@example.com' }

      vi.mocked(prisma.lUT.findMany).mockResolvedValue([
        { ...lut1, user: user1 },
        { ...lut2, user: user2 },
      ] as any)
      vi.mocked(prisma.lUT.update).mockResolvedValue(lut1)
      vi.mocked(sendEmail).mockResolvedValue({ messageId: 'msg-1', timestamp: new Date() })

      const mockJob: Job<LutReminderJobData> = {
        id: 'job-1',
        type: 'LUT_REMINDER',
        data: {
          mode: 'scan',
        },
        status: 'active',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await lutReminderHandler(mockJob)

      expect(sendEmail).toHaveBeenCalledTimes(2)
      expect(prisma.lUT.update).toHaveBeenCalledTimes(2)
      expect(result.remindersSent).toBe(2)
    })
  })

  describe('single LUT mode', () => {
    it('should send reminder for a specific LUT', async () => {
      vi.setSystemTime(new Date('2025-03-10'))

      const lut = createMockLUT({
        id: 'lut-1',
        validTill: new Date('2025-03-31'),
      })

      vi.mocked(prisma.lUT.findMany).mockResolvedValue([{ ...lut, user: mockUser }] as any)
      vi.mocked(prisma.lUT.update).mockResolvedValue({ ...lut, reminderSentAt: new Date() })
      vi.mocked(sendEmail).mockResolvedValue({ messageId: 'msg-1', timestamp: new Date() })

      const mockJob: Job<LutReminderJobData> = {
        id: 'job-1',
        type: 'LUT_REMINDER',
        data: {
          mode: 'single',
          lutId: 'lut-1',
        },
        status: 'active',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await lutReminderHandler(mockJob)

      expect(prisma.lUT.findMany).toHaveBeenCalledWith({
        where: { id: 'lut-1' },
        include: { user: true },
      })

      expect(result).toEqual({
        success: true,
        mode: 'single',
        lutsFound: 1,
        remindersSent: 1,
        errors: [],
      })
    })

    it('should return error when LUT not found', async () => {
      vi.mocked(prisma.lUT.findMany).mockResolvedValue([])

      const mockJob: Job<LutReminderJobData> = {
        id: 'job-1',
        type: 'LUT_REMINDER',
        data: {
          mode: 'single',
          lutId: 'non-existent',
        },
        status: 'active',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await lutReminderHandler(mockJob)

      expect(result).toEqual({
        success: false,
        mode: 'single',
        lutsFound: 0,
        remindersSent: 0,
        errors: [{ lutId: 'non-existent', error: 'LUT not found' }],
      })
    })
  })

  describe('renewal reminder mode', () => {
    it('should send renewal reminder for LUT expiring soon', async () => {
      vi.setSystemTime(new Date('2025-03-20'))

      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
        reminderSentAt: new Date('2025-03-01'), // Already sent first reminder
        renewalReminderSentAt: null,
      })

      vi.mocked(prisma.lUT.findMany).mockResolvedValue([{ ...lut, user: mockUser }] as any)
      vi.mocked(prisma.lUT.update).mockResolvedValue({
        ...lut,
        renewalReminderSentAt: new Date(),
      })
      vi.mocked(sendEmail).mockResolvedValue({ messageId: 'msg-1', timestamp: new Date() })

      const mockJob: Job<LutReminderJobData> = {
        id: 'job-1',
        type: 'LUT_REMINDER',
        data: {
          mode: 'renewal_scan',
        },
        status: 'active',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await lutReminderHandler(mockJob)

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          template: 'lut-renewal-reminder',
        })
      )

      expect(prisma.lUT.update).toHaveBeenCalledWith({
        where: { id: lut.id },
        data: { renewalReminderSentAt: expect.any(Date) },
      })

      expect(result).toEqual({
        success: true,
        mode: 'renewal_scan',
        lutsFound: 1,
        remindersSent: 1,
        errors: [],
      })
    })
  })
})
