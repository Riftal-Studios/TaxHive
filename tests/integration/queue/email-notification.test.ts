import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { BullMQService } from '@/lib/queue/bullmq.service'
import { emailNotificationHandler } from '@/lib/queue/handlers/email-notification.handler'
import nodemailer from 'nodemailer'

// Mock nodemailer
vi.mock('nodemailer')

describe('Email Notification Queue Integration', () => {
  let queueService: BullMQService
  let mockTransporter: any

  beforeAll(async () => {
    // Initialize queue service
    queueService = new BullMQService({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    })

    // Mock nodemailer transporter
    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    }
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as any)

    // Register the email notification handler
    await queueService.registerHandler('EMAIL_NOTIFICATION', emailNotificationHandler)
  })

  afterAll(async () => {
    await queueService.close()
    vi.restoreAllMocks()
  })

  it('should send invoice email notification', async () => {
    const job = await queueService.enqueueJob('EMAIL_NOTIFICATION', {
      type: 'invoice',
      to: 'client@example.com',
      invoiceNumber: 'FY24-25/001',
      clientName: 'Test Client',
      amount: 1000,
      currency: 'USD',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      pdfUrl: 'https://example.com/invoice.pdf',
    })

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000))

    const completedJob = await queueService.getJob(job.id)
    expect(completedJob?.status).toBe('completed')
    expect(completedJob?.result).toEqual({
      success: true,
      messageId: 'test-message-id',
    })

    // Verify email was sent
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: expect.stringContaining('Invoice FY24-25/001'),
      })
    )
  })

  it('should send payment reminder notification', async () => {
    const job = await queueService.enqueueJob('EMAIL_NOTIFICATION', {
      type: 'payment_reminder',
      to: 'client@example.com',
      invoiceNumber: 'FY24-25/001',
      clientName: 'Test Client',
      amount: 1000,
      currency: 'USD',
      daysOverdue: 7,
    })

    await new Promise(resolve => setTimeout(resolve, 1000))

    const completedJob = await queueService.getJob(job.id)
    expect(completedJob?.status).toBe('completed')

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: expect.stringContaining('Payment Reminder'),
      })
    )
  })

  it('should send LUT expiry notification', async () => {
    const job = await queueService.enqueueJob('EMAIL_NOTIFICATION', {
      type: 'lut_expiry',
      to: 'user@example.com',
      lutNumber: 'AD270324000123456',
      expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      daysUntilExpiry: 15,
    })

    await new Promise(resolve => setTimeout(resolve, 1000))

    const completedJob = await queueService.getJob(job.id)
    expect(completedJob?.status).toBe('completed')

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('LUT Expiry'),
      })
    )
  })

  it('should handle email failure with retry', async () => {
    // Mock failure
    mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP error'))
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockResolvedValueOnce({ messageId: 'retry-success' })

    const job = await queueService.enqueueJob('EMAIL_NOTIFICATION', {
      type: 'invoice',
      to: 'fail@example.com',
      invoiceNumber: 'FY24-25/002',
      clientName: 'Test Client',
      amount: 2000,
      currency: 'USD',
      dueDate: new Date(),
    }, {
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 100,
      },
    })

    // Wait for retries
    await new Promise(resolve => setTimeout(resolve, 2000))

    const completedJob = await queueService.getJob(job.id)
    expect(completedJob?.status).toBe('completed')
    expect(completedJob?.attempts).toBe(3)
    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3)
  })

  it('should batch email notifications', async () => {
    const emails = [
      { to: 'client1@example.com', invoiceNumber: 'FY24-25/003' },
      { to: 'client2@example.com', invoiceNumber: 'FY24-25/004' },
      { to: 'client3@example.com', invoiceNumber: 'FY24-25/005' },
    ]

    const jobs = await Promise.all(
      emails.map(email =>
        queueService.enqueueJob('EMAIL_NOTIFICATION', {
          type: 'invoice',
          to: email.to,
          invoiceNumber: email.invoiceNumber,
          clientName: 'Test Client',
          amount: 1000,
          currency: 'USD',
          dueDate: new Date(),
        })
      )
    )

    expect(jobs).toHaveLength(3)

    // Wait for all to process
    await new Promise(resolve => setTimeout(resolve, 2000))

    const completedJobs = await Promise.all(
      jobs.map(job => queueService.getJob(job.id))
    )

    completedJobs.forEach(job => {
      expect(job?.status).toBe('completed')
    })

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(emails.length)
  })
})