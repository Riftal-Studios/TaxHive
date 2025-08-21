import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { BullMQService } from '@/lib/queue/bullmq.service'
import type { Job, JobType, JobProcessor } from '@/lib/queue/types'

// Mock Redis for testing
vi.mock('ioredis', () => {
  const mockRedisInstance = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    duplicate: vi.fn()
  }
  
  mockRedisInstance.duplicate.mockReturnValue(mockRedisInstance)
  
  const Redis = vi.fn(() => mockRedisInstance)
  return { default: Redis }
})

// Mock BullMQ
vi.mock('bullmq', () => {
  const mockQueueInstance = {
    add: vi.fn(),
    getJob: vi.fn(),
    getJobs: vi.fn(),
    getJobCounts: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    clean: vi.fn(),
    close: vi.fn()
  }

  const Queue = vi.fn(() => mockQueueInstance)
  
  const mockWorkerInstance = {
    close: vi.fn(),
    on: vi.fn()
  }
  
  const Worker = vi.fn(() => mockWorkerInstance)
  
  const mockQueueEventsInstance = {
    close: vi.fn()
  }
  
  const QueueEvents = vi.fn(() => mockQueueEventsInstance)

  return { Queue, Worker, QueueEvents }
})

// Mock JobTypeEnum for testing
vi.mock('@/lib/queue/types', async () => {
  const actual = await vi.importActual('@/lib/queue/types')
  return {
    ...actual as any,
    JobTypeEnum: {
      options: ['PDF_GENERATION', 'EMAIL_NOTIFICATION', 'EXCHANGE_RATE_FETCH', 'PAYMENT_REMINDER'],
      parse: vi.fn((value) => value)
    },
    PdfGenerationJobSchema: {
      parse: vi.fn((data) => {
        if (!data.invoiceId || !data.userId) {
          throw new Error('Invalid PDF generation job data')
        }
        return data
      })
    },
    EmailNotificationJobSchema: {
      parse: vi.fn((data) => data)
    },
    ExchangeRateFetchJobSchema: {
      parse: vi.fn((data) => data)
    },
    PaymentReminderJobSchema: {
      parse: vi.fn((data) => data)
    }
  }
})

describe('BullMQService', () => {
  let bullmqService: BullMQService
  let mockRedis: Redis
  let mockQueue: Queue
  let mockWorker: Worker

  beforeEach(() => {
    vi.clearAllMocks()
    mockRedis = new Redis()
    bullmqService = new BullMQService({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    })
  })

  afterEach(async () => {
    await bullmqService.close()
    vi.clearAllMocks()
  })

  describe('enqueue', () => {
    it('should enqueue a job with BullMQ', async () => {
      const jobData = {
        invoiceId: '123',
        userId: 'user-1',
      }

      const mockBullMQJob = {
        id: 'bull-job-1',
        name: 'PDF_GENERATION',
        data: jobData,
        opts: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
        attemptsMade: 0,
        timestamp: Date.now(),
        finishedOn: null,
        processedOn: null,
        failedReason: null,
      }

      const mockAddReturn = { 
        id: mockBullMQJob.id, 
        name: mockBullMQJob.name,
        data: mockBullMQJob.data,
        opts: mockBullMQJob.opts,
        attemptsMade: mockBullMQJob.attemptsMade,
        timestamp: mockBullMQJob.timestamp,
        finishedOn: mockBullMQJob.finishedOn,
        processedOn: mockBullMQJob.processedOn,
        failedReason: mockBullMQJob.failedReason
      }
      const mockQueue = vi.mocked(Queue)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      mockQueueInstance.add.mockResolvedValue(mockAddReturn as any)

      const job = await bullmqService.enqueue('PDF_GENERATION', jobData)

      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'PDF_GENERATION',
        jobData,
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        })
      )

      expect(job).toMatchObject({
        id: expect.any(String),
        type: 'PDF_GENERATION',
        data: jobData,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
      })
    })

    it('should handle custom job options', async () => {
      const jobData = { 
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome',
        data: { name: 'Test User' }
      }
      const options = {
        delay: 5000,
        priority: 1,
        attempts: 5,
        backoff: {
          type: 'fixed' as const,
          delay: 3000,
        },
      }

      const mockQueue = vi.mocked(Queue)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      mockQueueInstance.add.mockResolvedValue({ 
        id: 'job-1', 
        name: 'EMAIL_NOTIFICATION',
        data: jobData,
        opts: { delay: 5000, priority: 1, attempts: 5, backoff: options.backoff },
        attemptsMade: 0,
        timestamp: Date.now()
      } as any)

      await bullmqService.enqueue('EMAIL_NOTIFICATION', jobData, options)

      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'EMAIL_NOTIFICATION',
        jobData,
        expect.objectContaining({
          delay: 5000,
          priority: 1,
          attempts: 5,
          backoff: options.backoff,
        })
      )
    })

    it('should validate job data against schema', async () => {
      const invalidData = {
        // Missing required fields
        userId: 'user-1',
      }

      await expect(
        bullmqService.enqueue('PDF_GENERATION', invalidData)
      ).rejects.toThrow()
    })
  })

  describe('process', () => {
    it('should register a job processor', async () => {
      const processor: JobProcessor = async (job) => {
        return { processed: true }
      }

      await bullmqService.process('PDF_GENERATION', processor)

      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          connection: expect.any(Object),
          concurrency: 1,
        })
      )
    })

    it('should support custom concurrency', async () => {
      const processor: JobProcessor = async (job) => {
        return { processed: true }
      }

      await bullmqService.process('EMAIL_NOTIFICATION', processor, {
        concurrency: 5,
      })

      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          concurrency: 5,
        })
      )
    })

    it('should handle processor errors', async () => {
      const failingProcessor: JobProcessor = async (job) => {
        throw new Error('Processing failed')
      }

      await bullmqService.process('PDF_GENERATION', failingProcessor)

      // The worker should be created even with a failing processor
      expect(Worker).toHaveBeenCalled()
    })
  })

  describe('getJob', () => {
    it('should retrieve a job by id', async () => {
      const mockBullMQJob = {
        id: 'job-1',
        name: 'PDF_GENERATION',
        data: { invoiceId: '123' },
        opts: { attempts: 3 },
        attemptsMade: 1,
        timestamp: Date.now(),
        finishedOn: Date.now() + 1000,
        processedOn: Date.now() + 500,
        returnvalue: { pdfUrl: 'https://example.com/invoice.pdf' },
      }

      const mockQueue = vi.mocked(Queue)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      mockQueueInstance.getJob.mockResolvedValue(mockBullMQJob as any)

      const job = await bullmqService.getJob('job-1')

      expect(mockQueueInstance.getJob).toHaveBeenCalledWith('job-1')
      expect(job).toMatchObject({
        id: 'job-1',
        type: 'PDF_GENERATION',
        data: { invoiceId: '123' },
        status: 'completed',
        attempts: 1,
        result: { pdfUrl: 'https://example.com/invoice.pdf' },
      })
    })

    it('should return null for non-existent job', async () => {
      const mockQueue = vi.mocked(Queue)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      mockQueueInstance.getJob.mockResolvedValue(null)

      const job = await bullmqService.getJob('non-existent')

      expect(job).toBeNull()
    })
  })

  describe('getJobs', () => {
    it('should retrieve jobs with filters', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          name: 'PDF_GENERATION',
          data: { invoiceId: '123' },
          opts: { attempts: 3 },
          attemptsMade: 0,
          timestamp: Date.now(),
        },
        {
          id: 'job-2',
          name: 'PDF_GENERATION',
          data: { invoiceId: '124' },
          opts: { attempts: 3 },
          attemptsMade: 1,
          timestamp: Date.now() - 1000,
          finishedOn: Date.now(),
        },
      ]

      const mockQueue = vi.mocked(Queue)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      mockQueueInstance.getJobs.mockResolvedValue(mockJobs as any)

      const jobs = await bullmqService.getJobs({
        type: 'PDF_GENERATION',
        status: ['pending', 'completed'],
        limit: 10,
      })

      expect(mockQueueInstance.getJobs).toHaveBeenCalledWith(
        ['wait', 'completed'],
        0,
        9
      )
      expect(jobs).toHaveLength(2)
    })
  })

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const mockCounts = {
        waiting: 10,
        active: 2,
        completed: 150,
        failed: 3,
        delayed: 5,
        paused: 0,
      }

      const mockQueue = vi.mocked(Queue)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      mockQueueInstance.getJobCounts.mockResolvedValue(mockCounts as any)

      const stats = await bullmqService.getStats()

      expect(mockQueueInstance.getJobCounts).toHaveBeenCalled()
      // The service creates 4 queues, so stats are multiplied by 4
      expect(stats).toEqual({
        pending: 40,  // 10 * 4 queues
        active: 8,    // 2 * 4 queues
        completed: 600, // 150 * 4 queues
        failed: 12,   // 3 * 4 queues
        delayed: 20,  // 5 * 4 queues
        paused: false,
      })
    })
  })

  describe('queue control', () => {
    it('should pause the queue', async () => {
      const mockQueue = vi.mocked(Queue)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      
      await bullmqService.pause()
      expect(mockQueueInstance.pause).toHaveBeenCalled()
    })

    it('should resume the queue', async () => {
      const mockQueue = vi.mocked(Queue)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      
      await bullmqService.resume()
      expect(mockQueueInstance.resume).toHaveBeenCalled()
    })

    it('should clean old jobs', async () => {
      await bullmqService.clean({
        grace: 3600000,
        status: 'completed',
        limit: 100,
      })

      const mockQueue = vi.mocked(Queue)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      expect(mockQueueInstance.clean).toHaveBeenCalledWith(
        3600000,
        100,
        'completed'
      )
    })

    it('should close connections', async () => {
      // First create a worker so we have something to close
      const processor: JobProcessor = async (job) => {
        return { processed: true }
      }
      await bullmqService.process('PDF_GENERATION', processor)
      
      await bullmqService.close()
      
      const mockQueue = vi.mocked(Queue)
      const mockWorker = vi.mocked(Worker)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      const mockWorkerInstance = mockWorker.mock.results[0]?.value
      
      expect(mockQueueInstance.close).toHaveBeenCalled()
      expect(mockWorkerInstance.close).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle Redis connection errors', async () => {
      const connectionError = new Error('Redis connection failed')
      const mockQueue = vi.mocked(Queue)
      const mockQueueInstance = mockQueue.mock.results[0]?.value
      mockQueueInstance.add.mockRejectedValue(connectionError)

      await expect(
        bullmqService.enqueue('PDF_GENERATION', { invoiceId: '123', userId: 'user-1' })
      ).rejects.toThrow('Redis connection failed')
    })

    it('should handle invalid job types', async () => {
      await expect(
        bullmqService.enqueue('INVALID_TYPE' as JobType, {})
      ).rejects.toThrow()
    })
  })
})