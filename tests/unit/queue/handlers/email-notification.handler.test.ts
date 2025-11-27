import { describe, it, expect, vi, beforeEach } from 'vitest'
import { emailNotificationHandler } from '@/lib/queue/handlers/email-notification.handler'
import type { Job, EmailNotificationJobData } from '@/lib/queue/types'
import * as emailService from '@/lib/email/service'
import { db } from '@/lib/prisma'

vi.mock('@/lib/email/service')
vi.mock('@/lib/prisma', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
    },
  },
}))

describe('Email Notification Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Invoice Email', () => {
    const mockJob: Job<EmailNotificationJobData> = {
      id: 'job-1',
      type: 'EMAIL_NOTIFICATION',
      data: {
        to: 'client@example.com',
        subject: 'Invoice FY24-25/001',
        template: 'invoice',
        data: {
          invoiceId: 'invoice-123',
          invoiceNumber: 'FY24-25/001',
          clientName: 'Test Client',
          amount: '$1000.00',
          dueDate: '2024-02-01',
          viewUrl: 'https://example.com/invoices/view/invoice-123',
        },
        userId: 'user-456',
      },
      status: 'active',
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should send invoice email successfully', async () => {
      const mockUser = {
        id: 'user-456',
        name: 'Test User',
        email: 'user@example.com',
      }

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(emailService.sendEmail).mockResolvedValue({
        messageId: 'msg-123',
        accepted: ['client@example.com'],
        rejected: [],
      } as any)

      const result = await emailNotificationHandler(mockJob)

      // Verify user lookup
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-456' },
      })

      // Verify email sent
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'client@example.com',
        subject: 'Invoice FY24-25/001',
        template: 'invoice',
        data: {
          ...mockJob.data.data,
          senderName: 'Test User',
          senderEmail: 'user@example.com',
        },
      })

      // Verify result
      expect(result).toEqual({
        success: true,
        messageId: 'msg-123',
        template: 'invoice',
        to: 'client@example.com',
      })
    })
  })

  describe('Payment Reminder Email', () => {
    const mockJob: Job<EmailNotificationJobData> = {
      id: 'job-2',
      type: 'EMAIL_NOTIFICATION',
      data: {
        to: 'client@example.com',
        subject: 'Payment Reminder: Invoice FY24-25/001',
        template: 'payment-reminder',
        data: {
          invoiceId: 'invoice-123',
          invoiceNumber: 'FY24-25/001',
          clientName: 'Test Client',
          amount: '$1000.00',
          daysOverdue: 7,
          viewUrl: 'https://example.com/invoices/view/invoice-123',
        },
        userId: 'user-456',
      },
      status: 'active',
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should send payment reminder email successfully', async () => {
      const mockUser = {
        id: 'user-456',
        name: 'Test User',
        email: 'user@example.com',
      }

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(emailService.sendEmail).mockResolvedValue({
        messageId: 'msg-124',
        accepted: ['client@example.com'],
        rejected: [],
      } as any)

      const result = await emailNotificationHandler(mockJob)

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'client@example.com',
        subject: 'Payment Reminder: Invoice FY24-25/001',
        template: 'payment-reminder',
        data: {
          ...mockJob.data.data,
          senderName: 'Test User',
          senderEmail: 'user@example.com',
        },
      })

      expect(result).toEqual({
        success: true,
        messageId: 'msg-124',
        template: 'payment-reminder',
        to: 'client@example.com',
      })
    })
  })

  describe('LUT Expiry Reminder Email', () => {
    const mockJob: Job<EmailNotificationJobData> = {
      id: 'job-3',
      type: 'EMAIL_NOTIFICATION',
      data: {
        to: 'user@example.com',
        subject: 'LUT Expiry Reminder',
        template: 'lut-expiry',
        data: {
          lutNumber: 'AD290124000001',
          expiryDate: '2024-12-31',
          daysRemaining: 30,
        },
        userId: 'user-456',
      },
      status: 'active',
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should send LUT expiry reminder successfully', async () => {
      vi.mocked(emailService.sendEmail).mockResolvedValue({
        messageId: 'msg-125',
        accepted: ['user@example.com'],
        rejected: [],
      } as any)

      const result = await emailNotificationHandler(mockJob)

      // No user lookup needed for self-emails
      expect(db.user.findUnique).not.toHaveBeenCalled()

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'LUT Expiry Reminder',
        template: 'lut-expiry',
        data: mockJob.data.data,
      })

      expect(result).toEqual({
        success: true,
        messageId: 'msg-125',
        template: 'lut-expiry',
        to: 'user@example.com',
      })
    })
  })

  describe('Error Handling', () => {
    const mockJob: Job<EmailNotificationJobData> = {
      id: 'job-4',
      type: 'EMAIL_NOTIFICATION',
      data: {
        to: 'client@example.com',
        subject: 'Test Email',
        template: 'invoice',
        data: { test: 'data' },
        userId: 'user-456',
      },
      status: 'active',
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should handle user not found error', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null)

      await expect(emailNotificationHandler(mockJob)).rejects.toThrow(
        'User not found'
      )

      expect(emailService.sendEmail).not.toHaveBeenCalled()
    })

    it('should handle email sending error', async () => {
      const mockUser = {
        id: 'user-456',
        name: 'Test User',
        email: 'user@example.com',
      }

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(emailService.sendEmail).mockRejectedValue(
        new Error('SMTP connection failed')
      )

      await expect(emailNotificationHandler(mockJob)).rejects.toThrow(
        'SMTP connection failed'
      )
    })

    it('should handle rejected recipients', async () => {
      const mockUser = {
        id: 'user-456',
        name: 'Test User',
        email: 'user@example.com',
      }

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(emailService.sendEmail).mockResolvedValue({
        messageId: 'msg-126',
        accepted: [],
        rejected: ['client@example.com'],
      } as any)

      await expect(emailNotificationHandler(mockJob)).rejects.toThrow(
        'Email rejected by server'
      )
    })
  })

  describe('Progress Tracking', () => {
    it('should update job progress during processing', async () => {
      const mockJob = {
        id: 'job-5',
        type: 'EMAIL_NOTIFICATION' as const,
        data: {
          to: 'client@example.com',
          subject: 'Test Email',
          template: 'invoice',
          data: { test: 'data' },
          userId: 'user-456',
        },
        status: 'active' as const,
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        updateProgress: vi.fn(),
      }

      const mockUser = {
        id: 'user-456',
        name: 'Test User',
        email: 'user@example.com',
      }

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(emailService.sendEmail).mockResolvedValue({
        messageId: 'msg-127',
        accepted: ['client@example.com'],
        rejected: [],
      } as any)

      await emailNotificationHandler(mockJob as any)

      // Verify progress updates
      expect(mockJob.updateProgress).toHaveBeenCalledWith(25) // Data prepared
      expect(mockJob.updateProgress).toHaveBeenCalledWith(75) // Email sent
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100) // Completed
    })
  })
})