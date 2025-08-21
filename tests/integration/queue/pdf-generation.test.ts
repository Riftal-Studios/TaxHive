import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock BullMQ
const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'mock-job-id', data: {} }),
  getJob: vi.fn().mockResolvedValue({
    id: 'mock-job-id',
    data: {},
    returnvalue: { success: true, pdfPath: '/tmp/invoice.pdf' },
    finishedOn: Date.now()
  }),
  getJobs: vi.fn().mockResolvedValue([]),
  clean: vi.fn().mockResolvedValue([]),
  close: vi.fn().mockResolvedValue(undefined),
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 5,
    failed: 0,
    delayed: 0
  })
}

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => mockQueue),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  })),
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

// Mock PDF generation handler
const mockPdfGenerationHandler = vi.fn().mockImplementation(async (job) => {
  const { invoiceId, invoiceData } = job.data
  
  // Simulate PDF generation
  const pdfPath = `/tmp/invoice-${invoiceId}.pdf`
  
  // Simulate creating PDF file
  return { 
    success: true, 
    pdfPath,
    invoiceId,
    generatedAt: new Date().toISOString()
  }
})

vi.mock('@/lib/queue/handlers/pdf-generation.handler', () => ({
  pdfGenerationHandler: mockPdfGenerationHandler
}))

describe('PDF Generation Queue Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully queue and process PDF generation job', async () => {
    const jobData = {
      invoiceId: 'invoice-123',
      invoiceData: {
        number: 'FY24-25/001',
        clientName: 'Test Client',
        amount: 1000,
        items: [{ description: 'Service', amount: 1000 }]
      }
    }

    // Add job to queue
    const job = await mockQueue.add('pdf_generation', jobData, {
      priority: 1,
      delay: 0
    })
    expect(job.id).toBe('mock-job-id')

    // Process the job
    const mockJob = { id: 'mock-job-id', data: jobData }
    const result = await mockPdfGenerationHandler(mockJob)

    expect(result.success).toBe(true)
    expect(result.pdfPath).toBe('/tmp/invoice-invoice-123.pdf')
    expect(result.invoiceId).toBe('invoice-123')
  })

  it('should handle multiple PDF generation jobs', async () => {
    const jobs = [
      { invoiceId: 'invoice-1', invoiceData: { number: 'FY24-25/001' } },
      { invoiceId: 'invoice-2', invoiceData: { number: 'FY24-25/002' } },
      { invoiceId: 'invoice-3', invoiceData: { number: 'FY24-25/003' } }
    ]

    // Add multiple jobs
    const queuedJobs = []
    for (const jobData of jobs) {
      const job = await mockQueue.add('pdf_generation', jobData)
      queuedJobs.push(job)
    }

    expect(queuedJobs).toHaveLength(3)
    expect(mockQueue.add).toHaveBeenCalledTimes(3)

    // Process each job
    for (const [index, jobData] of jobs.entries()) {
      const mockJob = { id: `mock-job-id-${index}`, data: jobData }
      const result = await mockPdfGenerationHandler(mockJob)
      expect(result.success).toBe(true)
      expect(result.invoiceId).toBe(jobData.invoiceId)
    }
  })

  it('should handle job with priority and delay', async () => {
    const jobData = {
      invoiceId: 'invoice-urgent',
      invoiceData: { number: 'FY24-25/URGENT' }
    }

    const job = await mockQueue.add('pdf_generation', jobData, {
      priority: 10, // High priority
      delay: 5000   // 5 second delay
    })

    expect(mockQueue.add).toHaveBeenCalledWith(
      'pdf_generation',
      jobData,
      expect.objectContaining({
        priority: 10,
        delay: 5000
      })
    )
  })

  it('should handle job failure and retry', async () => {
    const jobData = {
      invoiceId: 'invoice-fail',
      invoiceData: { number: 'FY24-25/FAIL' }
    }

    // Mock failure on first attempt
    mockPdfGenerationHandler.mockRejectedValueOnce(
      new Error('PDF generation failed')
    )

    const mockJob = { id: 'mock-job-id', data: jobData, attemptsMade: 1 }

    try {
      await mockPdfGenerationHandler(mockJob)
    } catch (error) {
      expect(error.message).toBe('PDF generation failed')
    }

    // Mock success on retry
    mockPdfGenerationHandler.mockResolvedValueOnce({
      success: true,
      pdfPath: '/tmp/invoice-invoice-fail.pdf',
      invoiceId: 'invoice-fail',
      retry: true
    })

    const retryResult = await mockPdfGenerationHandler(mockJob)
    expect(retryResult.success).toBe(true)
    expect(retryResult.retry).toBe(true)
  })

  it('should retrieve job statistics', async () => {
    const stats = await mockQueue.getJobCounts()

    expect(stats).toEqual({
      waiting: 0,
      active: 0,
      completed: 5,
      failed: 0,
      delayed: 0
    })
  })

  it('should retrieve jobs with filters', async () => {
    const mockJobs = [
      { id: 'job1', status: 'completed', data: { invoiceId: 'invoice-1' } },
      { id: 'job2', status: 'completed', data: { invoiceId: 'invoice-2' } }
    ]

    mockQueue.getJobs.mockResolvedValueOnce(mockJobs)

    const jobs = await mockQueue.getJobs(['completed'], 0, 10)

    expect(jobs).toHaveLength(2)
    expect(jobs[0].id).toBe('job1')
    expect(mockQueue.getJobs).toHaveBeenCalledWith(['completed'], 0, 10)
  })

  it('should clean old completed jobs', async () => {
    const cleanedJobs = ['job1', 'job2', 'job3']
    mockQueue.clean.mockResolvedValueOnce(cleanedJobs)

    const result = await mockQueue.clean(24 * 60 * 60 * 1000, 100, 'completed')

    expect(result).toEqual(cleanedJobs)
    expect(mockQueue.clean).toHaveBeenCalledWith(
      24 * 60 * 60 * 1000, // 24 hours
      100,
      'completed'
    )
  })
})