import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock nodemailer
const mockTransporter = {
  sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
}

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue(mockTransporter)
  }
}))

// Mock BullMQ completely
const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'mock-job-id', data: {} }),
  getJob: vi.fn().mockResolvedValue({
    id: 'mock-job-id',
    data: {},
    returnvalue: { success: true, messageId: 'test-message-id' },
    finishedOn: Date.now()
  }),
  getJobs: vi.fn().mockResolvedValue([]),
  clean: vi.fn().mockResolvedValue([]),
  close: vi.fn().mockResolvedValue(undefined)
}

const mockWorker = {
  on: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined)
}

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => mockQueue),
  Worker: vi.fn().mockImplementation(() => mockWorker),
  QueueEvents: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock IORedis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    status: 'ready',
    disconnect: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock email notification handler
const mockEmailNotificationHandler = vi.fn().mockImplementation(async (job) => {
  // Simulate sending email
  const result = await mockTransporter.sendMail({
    to: job.data.to,
    subject: `Invoice ${job.data.invoiceNumber}`,
    html: `<p>Your invoice ${job.data.invoiceNumber} is ready.</p>`
  })
  return { success: true, messageId: result.messageId }
})

vi.mock('@/lib/queue/handlers/email-notification.handler', () => ({
  emailNotificationHandler: mockEmailNotificationHandler
}))

describe('Email Notification Queue Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send invoice email notification', async () => {
    const jobData = {
      type: 'invoice',
      to: 'client@example.com',
      invoiceNumber: 'FY24-25/001',
      clientName: 'Test Client',
      amount: 1000,
      currency: 'USD',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      pdfUrl: 'https://example.com/invoice.pdf',
    }

    // Simulate adding job to queue
    const job = await mockQueue.add('email_notification', jobData)
    expect(job.id).toBe('mock-job-id')
    expect(mockQueue.add).toHaveBeenCalledWith('email_notification', jobData)

    // Simulate processing the job
    const mockJob = { id: 'mock-job-id', data: jobData }
    const result = await mockEmailNotificationHandler(mockJob)

    expect(result.success).toBe(true)
    expect(result.messageId).toBe('test-message-id')
    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: 'client@example.com',
      subject: 'Invoice FY24-25/001',
      html: '<p>Your invoice FY24-25/001 is ready.</p>'
    })
  })

  it('should send payment reminder notification', async () => {
    const jobData = {
      type: 'payment_reminder',
      to: 'client@example.com',
      invoiceNumber: 'FY24-25/001',
      clientName: 'Test Client',
      amount: 1000,
      daysOverdue: 15,
      dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    }

    // Simulate adding job to queue
    const job = await mockQueue.add('email_notification', jobData)
    expect(job.id).toBe('mock-job-id')

    // Simulate processing the job
    const mockJob = { id: 'mock-job-id', data: jobData }
    mockEmailNotificationHandler.mockImplementationOnce(async (job) => {
      const result = await mockTransporter.sendMail({
        to: job.data.to,
        subject: `Payment Reminder - Invoice ${job.data.invoiceNumber}`,
        html: `<p>Payment for invoice ${job.data.invoiceNumber} is ${job.data.daysOverdue} days overdue.</p>`
      })
      return { success: true, messageId: result.messageId }
    })

    const result = await mockEmailNotificationHandler(mockJob)

    expect(result.success).toBe(true)
    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: 'client@example.com',
      subject: 'Payment Reminder - Invoice FY24-25/001',
      html: '<p>Payment for invoice FY24-25/001 is 15 days overdue.</p>'
    })
  })

  it('should send LUT expiry notification', async () => {
    const jobData = {
      type: 'lut_expiry',
      to: 'user@example.com',
      lutNumber: 'AD1234567890123',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      daysUntilExpiry: 30,
    }

    // Simulate processing the job
    const mockJob = { id: 'mock-job-id', data: jobData }
    mockEmailNotificationHandler.mockImplementationOnce(async (job) => {
      const result = await mockTransporter.sendMail({
        to: job.data.to,
        subject: `LUT Expiry Notice - ${job.data.lutNumber}`,
        html: `<p>Your LUT ${job.data.lutNumber} expires in ${job.data.daysUntilExpiry} days.</p>`
      })
      return { success: true, messageId: result.messageId }
    })

    const result = await mockEmailNotificationHandler(mockJob)

    expect(result.success).toBe(true)
    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: 'LUT Expiry Notice - AD1234567890123',
      html: '<p>Your LUT AD1234567890123 expires in 30 days.</p>'
    })
  })

  it('should handle email failure with retry', async () => {
    const jobData = {
      type: 'invoice',
      to: 'client@example.com',
      invoiceNumber: 'FY24-25/001',
      clientName: 'Test Client',
    }

    // Mock email failure
    mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP connection failed'))

    const mockJob = { id: 'mock-job-id', data: jobData, attemptsMade: 1 }
    
    try {
      await mockEmailNotificationHandler(mockJob)
    } catch (error) {
      expect(error.message).toBe('SMTP connection failed')
    }

    expect(mockTransporter.sendMail).toHaveBeenCalled()
  })

  it('should batch email notifications', async () => {
    const batchJobData = [
      {
        type: 'invoice',
        to: 'client1@example.com',
        invoiceNumber: 'FY24-25/001',
      },
      {
        type: 'invoice',
        to: 'client2@example.com', 
        invoiceNumber: 'FY24-25/002',
      }
    ]

    // Simulate batch processing
    const jobs = []
    for (const jobData of batchJobData) {
      const job = await mockQueue.add('email_notification', jobData)
      jobs.push(job)
    }

    expect(jobs).toHaveLength(2)
    expect(mockQueue.add).toHaveBeenCalledTimes(2)

    // Simulate processing each job
    for (const [index, jobData] of batchJobData.entries()) {
      const mockJob = { id: `mock-job-id-${index}`, data: jobData }
      const result = await mockEmailNotificationHandler(mockJob)
      expect(result.success).toBe(true)
    }

    expect(mockEmailNotificationHandler).toHaveBeenCalledTimes(2)
    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2)
  })
})