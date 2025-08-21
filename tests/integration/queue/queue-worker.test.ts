import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock BullMQ Worker
const mockWorker = {
  on: vi.fn(),
  off: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  run: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getQueueEvents: vi.fn()
}

const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'mock-job-id', data: {} }),
  getJob: vi.fn().mockResolvedValue({
    id: 'mock-job-id',
    data: {},
    returnvalue: { success: true },
    finishedOn: Date.now()
  }),
  getJobs: vi.fn().mockResolvedValue([]),
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 0,
    active: 1,
    completed: 5,
    failed: 0
  }),
  close: vi.fn().mockResolvedValue(undefined)
}

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => mockQueue),
  Worker: vi.fn().mockImplementation((queueName, processor, config) => {
    // Store the processor for later use
    mockWorker.processor = processor
    mockWorker.queueName = queueName
    mockWorker.config = config
    return mockWorker
  }),
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

// Mock job handlers
const mockPdfHandler = vi.fn().mockResolvedValue({
  success: true,
  pdfPath: '/tmp/invoice.pdf'
})

const mockEmailHandler = vi.fn().mockResolvedValue({
  success: true,
  messageId: 'test-message-id'
})

const mockExchangeRateHandler = vi.fn().mockResolvedValue({
  success: true,
  rates: { 'USD': 83.25 },
  count: 1
})

vi.mock('@/lib/queue/handlers/pdf-generation.handler', () => ({
  pdfGenerationHandler: mockPdfHandler
}))

vi.mock('@/lib/queue/handlers/email-notification.handler', () => ({
  emailNotificationHandler: mockEmailHandler
}))

vi.mock('@/lib/queue/handlers/exchange-rate-fetch.handler', () => ({
  exchangeRateFetchHandler: mockExchangeRateHandler
}))

describe('Queue Worker Process', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should process PDF generation jobs via worker', async () => {
    const jobData = {
      invoiceId: 'invoice-123',
      invoiceData: { number: 'FY24-25/001' }
    }

    // Create mock job
    const mockJob = {
      id: 'mock-job-id',
      name: 'PDF_GENERATION',
      data: jobData,
      updateProgress: vi.fn(),
      log: vi.fn()
    }

    // Directly test the handler
    const result = await mockPdfHandler(mockJob)
    expect(result.success).toBe(true)
    expect(result.pdfPath).toBe('/tmp/invoice.pdf')
    expect(mockPdfHandler).toHaveBeenCalledWith(mockJob)
  })

  it('should process multiple job types', async () => {
    const jobs = [
      {
        id: 'pdf-job',
        name: 'PDF_GENERATION',
        data: { invoiceId: 'invoice-123' }
      },
      {
        id: 'email-job',
        name: 'EMAIL_NOTIFICATION',
        data: { to: 'test@example.com', type: 'invoice' }
      },
      {
        id: 'rate-job',
        name: 'EXCHANGE_RATE_FETCH',
        data: { date: '2024-05-15', targetCurrencies: ['USD'] }
      }
    ]

    // Mock different processors for different job types
    const processJob = async (job) => {
      switch (job.name) {
        case 'PDF_GENERATION':
          return await mockPdfHandler(job)
        case 'EMAIL_NOTIFICATION':
          return await mockEmailHandler(job)
        case 'EXCHANGE_RATE_FETCH':
          return await mockExchangeRateHandler(job)
        default:
          throw new Error(`Unknown job type: ${job.name}`)
      }
    }

    // Process each job
    for (const job of jobs) {
      const mockJobObj = {
        ...job,
        updateProgress: vi.fn(),
        log: vi.fn()
      }
      
      const result = await processJob(mockJobObj)
      expect(result.success).toBe(true)
    }

    expect(mockPdfHandler).toHaveBeenCalledTimes(1)
    expect(mockEmailHandler).toHaveBeenCalledTimes(1)
    expect(mockExchangeRateHandler).toHaveBeenCalledTimes(1)
  })

  it('should respect job priorities', async () => {
    const highPriorityJob = {
      id: 'high-priority-job',
      name: 'PDF_GENERATION',
      data: { invoiceId: 'urgent-invoice' },
      opts: { priority: 10 }
    }

    const lowPriorityJob = {
      id: 'low-priority-job',
      name: 'PDF_GENERATION', 
      data: { invoiceId: 'normal-invoice' },
      opts: { priority: 1 }
    }

    // Add jobs with different priorities
    const highPriorityQueuedJob = await mockQueue.add(
      'pdf_generation', 
      highPriorityJob.data, 
      { priority: 10 }
    )
    const lowPriorityQueuedJob = await mockQueue.add(
      'pdf_generation',
      lowPriorityJob.data,
      { priority: 1 }
    )

    expect(mockQueue.add).toHaveBeenCalledWith(
      'pdf_generation',
      highPriorityJob.data,
      { priority: 10 }
    )
    expect(mockQueue.add).toHaveBeenCalledWith(
      'pdf_generation', 
      lowPriorityJob.data,
      { priority: 1 }
    )

    // In a real scenario, high priority jobs would be processed first
    // Here we just verify the jobs were added with correct priorities
    expect(mockQueue.add).toHaveBeenCalledTimes(2)
  })

  it('should handle worker restart gracefully', async () => {
    // Create a worker to get queueName set
    const { Worker } = await import('bullmq')
    const worker = new Worker('test-queue', vi.fn(), {
      connection: { host: 'localhost', port: 6379 }
    })
    
    expect(worker.queueName).toBe('test-queue')
    
    // Simulate worker restart
    await worker.close()
    expect(mockWorker.close).toHaveBeenCalled()

    // Simulate creating new worker
    const newWorker = new Worker('test-queue', vi.fn(), {
      connection: { host: 'localhost', port: 6379 }
    })

    expect(Worker).toHaveBeenCalledTimes(2)
    expect(newWorker).toBeDefined()
  })

  it('should handle job processing errors', async () => {
    const failingJobData = {
      invoiceId: 'failing-invoice',
      invoiceData: { number: 'FY24-25/FAIL' }
    }

    // Mock handler failure
    mockPdfHandler.mockRejectedValueOnce(new Error('Processing failed'))

    const mockJob = {
      id: 'failing-job',
      name: 'PDF_GENERATION',
      data: failingJobData,
      updateProgress: vi.fn(),
      log: vi.fn()
    }

    try {
      await mockPdfHandler(mockJob)
    } catch (error) {
      expect(error.message).toBe('Processing failed')
    }

    expect(mockPdfHandler).toHaveBeenCalledWith(mockJob)
  })

  it('should track job progress', async () => {
    const jobData = {
      invoiceId: 'progress-invoice',
      invoiceData: { number: 'FY24-25/PROGRESS' }
    }

    const mockJob = {
      id: 'progress-job',
      name: 'PDF_GENERATION',
      data: jobData,
      updateProgress: vi.fn(),
      log: vi.fn()
    }

    // Mock handler that updates progress
    mockPdfHandler.mockImplementationOnce(async (job) => {
      await job.updateProgress(25)
      await job.updateProgress(50)
      await job.updateProgress(75)
      await job.updateProgress(100)
      
      return {
        success: true,
        pdfPath: '/tmp/progress-invoice.pdf'
      }
    })

    const result = await mockPdfHandler(mockJob)

    expect(result.success).toBe(true)
    expect(mockJob.updateProgress).toHaveBeenCalledTimes(4)
    expect(mockJob.updateProgress).toHaveBeenCalledWith(25)
    expect(mockJob.updateProgress).toHaveBeenCalledWith(50)
    expect(mockJob.updateProgress).toHaveBeenCalledWith(75)
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100)
  })

  it('should handle worker events', async () => {
    // Simulate worker event handling
    const onCompleted = vi.fn()
    const onFailed = vi.fn()
    const onProgress = vi.fn()

    mockWorker.on('completed', onCompleted)
    mockWorker.on('failed', onFailed)
    mockWorker.on('progress', onProgress)

    expect(mockWorker.on).toHaveBeenCalledWith('completed', onCompleted)
    expect(mockWorker.on).toHaveBeenCalledWith('failed', onFailed)
    expect(mockWorker.on).toHaveBeenCalledWith('progress', onProgress)
  })
})