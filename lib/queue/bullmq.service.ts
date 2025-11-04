// Only import server-only in Next.js context, not in standalone Node.js scripts
if (typeof window === 'undefined' && process.env.NEXT_RUNTIME) {
  require('server-only')
}

import { Queue, Worker, Job as BullMQJob, QueueEvents } from 'bullmq'
import Redis from 'ioredis'
import { 
  type QueueService, 
  type Job, 
  type JobType, 
  type JobStatus,
  type JobProgress,
  type JobOptions, 
  type JobProcessor,
  type ProcessorOptions,
  type JobFilterOptions,
  type QueueStats,
  type CleanOptions,
  JobTypeEnum,
  PdfGenerationJobSchema,
  EmailNotificationJobSchema,
  ExchangeRateFetchJobSchema,
  PaymentReminderJobSchema,
} from './types'

interface BullMQConfig {
  redis: {
    host: string
    port: number
    password?: string
  }
  defaultJobOptions?: JobOptions
}

export class BullMQService implements QueueService {
  private queues: Map<JobType, Queue> = new Map()
  private workers: Map<JobType, Worker> = new Map()
  private connection: Redis
  private config: BullMQConfig
  private queueEvents: QueueEvents

  constructor(config: BullMQConfig) {
    this.config = config
    this.connection = new Redis({
      ...config.redis,
      maxRetriesPerRequest: null, // Required by BullMQ
    })
    this.queueEvents = new QueueEvents('gsthive', {
      connection: this.connection.duplicate(),
    })
    
    // Initialize queues for each job type
    JobTypeEnum.options.forEach((jobType) => {
      this.getOrCreateQueue(jobType)
    })
  }

  private getOrCreateQueue(type: JobType): Queue {
    if (!this.queues.has(type)) {
      const queue = new Queue(`gsthive-${type}`, {
        connection: this.connection.duplicate(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 24 * 3600, // 24 hours
            count: 100,
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // 7 days
          },
        },
      })
      this.queues.set(type, queue)
    }
    return this.queues.get(type)!
  }

  private validateJobData(type: JobType, data: unknown): void {
    switch (type) {
      case 'PDF_GENERATION':
        PdfGenerationJobSchema.parse(data)
        break
      case 'EMAIL_NOTIFICATION':
        EmailNotificationJobSchema.parse(data)
        break
      case 'EXCHANGE_RATE_FETCH':
        ExchangeRateFetchJobSchema.parse(data)
        break
      case 'PAYMENT_REMINDER':
        PaymentReminderJobSchema.parse(data)
        break
      default:
        throw new Error(`Unknown job type: ${type}`)
    }
  }

  async enqueue<T = unknown>(
    type: JobType, 
    data: T, 
    options?: JobOptions
  ): Promise<Job<T>> {
    // Validate job type
    JobTypeEnum.parse(type)
    
    // Validate job data
    this.validateJobData(type, data)

    const queue = this.getOrCreateQueue(type)
    
    const bullMQOptions = {
      attempts: options?.attempts ?? 3,
      delay: options?.delay,
      priority: options?.priority,
      backoff: options?.backoff ?? {
        type: 'exponential' as const,
        delay: 2000,
      },
      removeOnComplete: options?.removeOnComplete,
      removeOnFail: options?.removeOnFail,
    }

    const bullMQJob = await queue.add(type, data, bullMQOptions)

    return this.bullMQJobToJob<T>(bullMQJob)
  }

  async process<T = unknown>(
    type: JobType, 
    processor: JobProcessor<T>, 
    options?: ProcessorOptions
  ): Promise<void> {
    const queueName = `gsthive-${type}`
    
    const worker = new Worker(
      queueName,
      async (bullMQJob: BullMQJob) => {
        const job = this.bullMQJobToJob<T>(bullMQJob)
        return await processor(job)
      },
      {
        connection: this.connection.duplicate(),
        concurrency: options?.concurrency ?? 1,
      }
    )

    this.workers.set(type, worker)

    // Set up event listeners
    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err)
    })

    // Handle stalled jobs - jobs that were being processed but worker lost connection
    worker.on('stalled', (jobId) => {
      console.warn(`Job ${jobId} has stalled and will be retried`)
    })

    worker.on('error', (err) => {
      console.error(`Worker error for ${type}:`, err)
    })
  }

  async getJob(jobId: string): Promise<Job | null> {
    // Try to find the job in any queue
    for (const queue of this.queues.values()) {
      const bullMQJob = await queue.getJob(jobId)
      if (bullMQJob) {
        return this.bullMQJobToJob(bullMQJob)
      }
    }
    return null
  }

  async getJobs(options?: JobFilterOptions): Promise<Job[]> {
    const jobs: Job[] = []
    const queuesToSearch = options?.type 
      ? [this.getOrCreateQueue(options.type)]
      : Array.from(this.queues.values())

    for (const queue of queuesToSearch) {
      const statuses = this.mapStatusesToBullMQ(options?.status || ['pending', 'active', 'completed', 'failed', 'delayed'])
      const start = options?.offset ?? 0
      const end = start + (options?.limit ?? 100) - 1

      const bullMQJobs = await queue.getJobs(statuses, start, end)
      jobs.push(...bullMQJobs.map(job => this.bullMQJobToJob(job)))
    }

    return jobs
  }

  async getStats(): Promise<QueueStats> {
    const stats: QueueStats = {
      pending: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: false,
    }

    for (const queue of this.queues.values()) {
      const counts = await queue.getJobCounts()
      stats.pending += counts.waiting ?? 0
      stats.active += counts.active ?? 0
      stats.completed += counts.completed ?? 0
      stats.failed += counts.failed ?? 0
      stats.delayed += counts.delayed ?? 0
      stats.paused = stats.paused || (counts.paused ?? 0) > 0
    }

    return stats
  }

  async pause(): Promise<void> {
    await Promise.all(
      Array.from(this.queues.values()).map(queue => queue.pause())
    )
  }

  async resume(): Promise<void> {
    await Promise.all(
      Array.from(this.queues.values()).map(queue => queue.resume())
    )
  }

  async clean(options: CleanOptions): Promise<void> {
    const status = this.mapStatusToBullMQ(options.status) as "active" | "completed" | "failed" | "delayed" | "prioritized" | "paused" | "wait" | undefined
    await Promise.all(
      Array.from(this.queues.values()).map(queue => 
        queue.clean(options.grace, options.limit ?? 1000, status)
      )
    )
  }

  async close(): Promise<void> {
    // Close all workers
    await Promise.all(
      Array.from(this.workers.values()).map(worker => worker.close())
    )
    
    // Close all queues
    await Promise.all(
      Array.from(this.queues.values()).map(queue => queue.close())
    )
    
    // Close queue events
    await this.queueEvents.close()
    
    // Close Redis connection
    this.connection.disconnect()
  }

  // Alias methods for backward compatibility
  async enqueueJob<T = unknown>(type: JobType, data: T, options?: JobOptions): Promise<Job<T>> {
    return this.enqueue(type, data, options)
  }

  async registerHandler<T = unknown>(type: JobType, handler: JobProcessor<T>, options?: ProcessorOptions): Promise<void> {
    return this.process(type, handler, options)
  }

  private bullMQJobToJob<T = unknown>(bullMQJob: BullMQJob): Job<T> {
    const status = this.getBullMQJobStatus(bullMQJob)
    
    return {
      id: bullMQJob.id!,
      type: bullMQJob.name as JobType,
      data: bullMQJob.data as T,
      status,
      attempts: bullMQJob.attemptsMade ?? 0,
      maxAttempts: bullMQJob.opts.attempts ?? 3,
      priority: bullMQJob.opts.priority,
      progress: bullMQJob.progress as JobProgress | undefined,
      error: bullMQJob.failedReason ? {
        message: bullMQJob.failedReason,
        stack: bullMQJob.stacktrace?.join('\n'),
      } : undefined,
      result: bullMQJob.returnvalue,
      createdAt: new Date(bullMQJob.timestamp!),
      updatedAt: new Date(bullMQJob.timestamp!),
      processedAt: bullMQJob.processedOn ? new Date(bullMQJob.processedOn) : undefined,
      completedAt: bullMQJob.finishedOn ? new Date(bullMQJob.finishedOn) : undefined,
      failedAt: bullMQJob.failedReason && bullMQJob.finishedOn ? new Date(bullMQJob.finishedOn) : undefined,
    }
  }

  private getBullMQJobStatus(job: BullMQJob): JobStatus {
    if (job.finishedOn) {
      return job.failedReason ? 'failed' : 'completed'
    }
    if (job.processedOn) {
      return 'active'
    }
    if (job.opts.delay && job.opts.delay > 0) {
      return 'delayed'
    }
    return 'pending'
  }

  private mapStatusesToBullMQ(statuses: JobStatus[]): ('active' | 'completed' | 'failed' | 'delayed' | 'prioritized' | 'paused' | 'wait')[] {
    const mapping: Record<JobStatus, 'active' | 'completed' | 'failed' | 'delayed' | 'wait'> = {
      pending: 'wait',
      active: 'active',
      completed: 'completed',
      failed: 'failed',
      delayed: 'delayed',
    }
    
    return statuses.map(status => mapping[status])
  }

  private mapStatusToBullMQ(status: JobStatus): string {
    const mapping: Record<JobStatus, string> = {
      pending: 'wait',
      active: 'active',
      completed: 'completed',
      failed: 'failed',
      delayed: 'delayed',
    }
    
    return mapping[status]
  }
}