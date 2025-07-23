import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { QueueService, Job, JobType, JobStatus, QueueStats } from '@/lib/queue/types'

describe('QueueService Interface', () => {
  let queueService: QueueService

  beforeEach(() => {
    // This will be mocked for interface testing
    queueService = {
      enqueue: vi.fn(),
      process: vi.fn(),
      getJob: vi.fn(),
      getJobs: vi.fn(),
      getStats: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      clean: vi.fn(),
      close: vi.fn(),
    }
  })

  describe('enqueue', () => {
    it('should enqueue a job with required fields', async () => {
      const jobData = {
        invoiceId: '123',
        userId: 'user-1',
      }

      const expectedJob: Job = {
        id: 'job-1',
        type: 'PDF_GENERATION',
        data: jobData,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(queueService.enqueue).mockResolvedValue(expectedJob)

      const job = await queueService.enqueue('PDF_GENERATION', jobData)

      expect(queueService.enqueue).toHaveBeenCalledWith('PDF_GENERATION', jobData)
      expect(job).toEqual(expectedJob)
      expect(job.type).toBe('PDF_GENERATION')
      expect(job.status).toBe('pending')
      expect(job.attempts).toBe(0)
    })

    it('should enqueue a job with custom options', async () => {
      const jobData = { test: 'data' }
      const options = {
        delay: 5000,
        priority: 1,
        attempts: 5,
      }

      await queueService.enqueue('EMAIL_NOTIFICATION', jobData, options)

      expect(queueService.enqueue).toHaveBeenCalledWith('EMAIL_NOTIFICATION', jobData, options)
    })

    it('should handle different job types', async () => {
      const jobTypes: JobType[] = [
        'PDF_GENERATION',
        'EMAIL_NOTIFICATION',
        'EXCHANGE_RATE_FETCH',
        'PAYMENT_REMINDER',
      ]

      for (const type of jobTypes) {
        await queueService.enqueue(type, { test: type })
        expect(queueService.enqueue).toHaveBeenCalledWith(type, { test: type })
      }
    })
  })

  describe('process', () => {
    it('should register a processor for a job type', async () => {
      const processor = vi.fn()
      
      await queueService.process('PDF_GENERATION', processor)

      expect(queueService.process).toHaveBeenCalledWith('PDF_GENERATION', processor)
    })

    it('should support concurrency options', async () => {
      const processor = vi.fn()
      const options = { concurrency: 5 }

      await queueService.process('EMAIL_NOTIFICATION', processor, options)

      expect(queueService.process).toHaveBeenCalledWith('EMAIL_NOTIFICATION', processor, options)
    })
  })

  describe('getJob', () => {
    it('should retrieve a job by id', async () => {
      const mockJob: Job = {
        id: 'job-1',
        type: 'PDF_GENERATION',
        data: { invoiceId: '123' },
        status: 'completed',
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        result: { pdfUrl: 'https://example.com/invoice.pdf' },
      }

      vi.mocked(queueService.getJob).mockResolvedValue(mockJob)

      const job = await queueService.getJob('job-1')

      expect(queueService.getJob).toHaveBeenCalledWith('job-1')
      expect(job).toEqual(mockJob)
    })

    it('should return null for non-existent job', async () => {
      vi.mocked(queueService.getJob).mockResolvedValue(null)

      const job = await queueService.getJob('non-existent')

      expect(job).toBeNull()
    })
  })

  describe('getJobs', () => {
    it('should retrieve jobs with filters', async () => {
      const mockJobs: Job[] = [
        {
          id: 'job-1',
          type: 'PDF_GENERATION',
          data: {},
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'job-2',
          type: 'PDF_GENERATION',
          data: {},
          status: 'completed',
          attempts: 1,
          maxAttempts: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(queueService.getJobs).mockResolvedValue(mockJobs)

      const jobs = await queueService.getJobs({
        type: 'PDF_GENERATION',
        status: ['pending', 'completed'],
        limit: 10,
      })

      expect(queueService.getJobs).toHaveBeenCalledWith({
        type: 'PDF_GENERATION',
        status: ['pending', 'completed'],
        limit: 10,
      })
      expect(jobs).toHaveLength(2)
    })

    it('should support pagination', async () => {
      await queueService.getJobs({
        limit: 20,
        offset: 40,
      })

      expect(queueService.getJobs).toHaveBeenCalledWith({
        limit: 20,
        offset: 40,
      })
    })
  })

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const mockStats: QueueStats = {
        pending: 10,
        active: 2,
        completed: 150,
        failed: 3,
        delayed: 5,
        paused: false,
      }

      vi.mocked(queueService.getStats).mockResolvedValue(mockStats)

      const stats = await queueService.getStats()

      expect(stats).toEqual(mockStats)
      expect(stats.pending).toBe(10)
      expect(stats.failed).toBe(3)
    })
  })

  describe('queue control methods', () => {
    it('should pause the queue', async () => {
      await queueService.pause()
      expect(queueService.pause).toHaveBeenCalled()
    })

    it('should resume the queue', async () => {
      await queueService.resume()
      expect(queueService.resume).toHaveBeenCalled()
    })

    it('should clean old jobs', async () => {
      const options = {
        grace: 3600000, // 1 hour
        status: 'completed' as JobStatus,
        limit: 100,
      }

      await queueService.clean(options)
      expect(queueService.clean).toHaveBeenCalledWith(options)
    })

    it('should close the queue connection', async () => {
      await queueService.close()
      expect(queueService.close).toHaveBeenCalled()
    })
  })
})

describe('Job Error Handling', () => {
  it('should handle job failures with retry logic', async () => {
    const failedJob: Job = {
      id: 'job-1',
      type: 'EMAIL_NOTIFICATION',
      data: { to: 'test@example.com' },
      status: 'failed',
      attempts: 3,
      maxAttempts: 3,
      error: {
        message: 'SMTP connection failed',
        stack: 'Error: SMTP connection failed...',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      failedAt: new Date(),
    }

    expect(failedJob.attempts).toBe(failedJob.maxAttempts)
    expect(failedJob.status).toBe('failed')
    expect(failedJob.error).toBeDefined()
  })

  it('should track job progress for long-running tasks', async () => {
    const jobWithProgress: Job = {
      id: 'job-1',
      type: 'PDF_GENERATION',
      data: { invoiceIds: ['1', '2', '3'] },
      status: 'active',
      attempts: 1,
      maxAttempts: 3,
      progress: {
        current: 2,
        total: 3,
        percentage: 66.67,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(jobWithProgress.progress?.percentage).toBeCloseTo(66.67)
  })
})