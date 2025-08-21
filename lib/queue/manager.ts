import { Queue, QueueEvents, Job } from 'bullmq'
import { createRedisConnection, QUEUE_NAMES, DEFAULT_JOB_OPTIONS, isRedisConfigured } from './config'
import type { 
  JobData, 
  QueueMetrics,
  PDFGenerationJobData,
  EmailNotificationJobData,
  ExchangeRateJobData,
  InvoiceProcessingJobData,
  GSTReturnJobData
} from './types'

// Singleton queue instances
let queues: Map<string, Queue> | null = null
let queueEvents: Map<string, QueueEvents> | null = null

// Initialize queues
export function initializeQueues(): Map<string, Queue> {
  if (!isRedisConfigured()) {
    console.warn('Redis not configured. Queue functionality disabled.')
    return new Map()
  }

  if (queues) return queues

  queues = new Map()
  queueEvents = new Map()

  // Create a queue for each defined queue name
  Object.values(QUEUE_NAMES).forEach(queueName => {
    const connection = createRedisConnection()
    const queue = new Queue(queueName, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    })
    
    queues!.set(queueName, queue)

    // Create queue events for monitoring
    const events = new QueueEvents(queueName, { connection: createRedisConnection() })
    queueEvents!.set(queueName, events)

    // Log queue events in development
    if (process.env.NODE_ENV === 'development') {
      events.on('completed', ({ jobId }) => {
        console.log(`[${queueName}] Job ${jobId} completed`)
      })

      events.on('failed', ({ jobId, failedReason }) => {
        console.error(`[${queueName}] Job ${jobId} failed: ${failedReason}`)
      })
    }
  })

  return queues
}

// Get a specific queue
export function getQueue(queueName: string): Queue | null {
  if (!queues) {
    initializeQueues()
  }
  return queues?.get(queueName) || null
}

// Add job to PDF generation queue
export async function addPDFGenerationJob(
  data: PDFGenerationJobData,
  options?: { priority?: number; delay?: number }
): Promise<Job | null> {
  const queue = getQueue(QUEUE_NAMES.PDF_GENERATION)
  if (!queue) return null

  return queue.add('generate-pdf', data, {
    priority: options?.priority,
    delay: options?.delay,
  })
}

// Add job to email notification queue
export async function addEmailNotificationJob(
  data: EmailNotificationJobData,
  options?: { priority?: number; delay?: number }
): Promise<Job | null> {
  const queue = getQueue(QUEUE_NAMES.EMAIL_NOTIFICATION)
  if (!queue) return null

  return queue.add('send-email', data, {
    priority: options?.priority,
    delay: options?.delay,
  })
}

// Add job to exchange rates queue
export async function addExchangeRateJob(
  data: ExchangeRateJobData,
  options?: { priority?: number; delay?: number }
): Promise<Job | null> {
  const queue = getQueue(QUEUE_NAMES.EXCHANGE_RATES)
  if (!queue) return null

  return queue.add('fetch-rates', data, {
    priority: options?.priority,
    delay: options?.delay,
  })
}

// Add job to invoice processing queue
export async function addInvoiceProcessingJob(
  data: InvoiceProcessingJobData,
  options?: { priority?: number; delay?: number }
): Promise<Job | null> {
  const queue = getQueue(QUEUE_NAMES.INVOICE_PROCESSING)
  if (!queue) return null

  return queue.add('process-invoice', data, {
    priority: options?.priority,
    delay: options?.delay,
  })
}

// Add job to GST returns queue
export async function addGSTReturnJob(
  data: GSTReturnJobData,
  options?: { priority?: number; delay?: number }
): Promise<Job | null> {
  const queue = getQueue(QUEUE_NAMES.GST_RETURNS)
  if (!queue) return null

  return queue.add('process-return', data, {
    priority: options?.priority,
    delay: options?.delay,
  })
}

// Add recurring job (for scheduled tasks like RBI rates)
export async function addRecurringJob(
  queueName: string,
  jobName: string,
  data: JobData,
  pattern: string, // Cron pattern
  options?: { timezone?: string }
): Promise<void> {
  const queue = getQueue(queueName)
  if (!queue) return

  await queue.add(jobName, data, {
    repeat: {
      pattern,
      tz: options?.timezone || 'Asia/Kolkata',
    },
  })
}

// Get queue metrics
export async function getQueueMetrics(queueName: string): Promise<QueueMetrics | null> {
  const queue = getQueue(queueName)
  if (!queue) return null

  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getPausedCount(),
  ])

  return {
    name: queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  }
}

// Get all queue metrics
export async function getAllQueueMetrics(): Promise<QueueMetrics[]> {
  const metrics: QueueMetrics[] = []
  
  for (const queueName of Object.values(QUEUE_NAMES)) {
    const metric = await getQueueMetrics(queueName)
    if (metric) metrics.push(metric)
  }

  return metrics
}

// Clean up queues (remove old jobs)
export async function cleanQueues(
  queueName?: string,
  options?: {
    grace?: number // Grace period in milliseconds
    limit?: number // Max number of jobs to clean
    status?: 'completed' | 'failed'
  }
): Promise<string[]> {
  const queuesToClean = queueName 
    ? [getQueue(queueName)].filter(Boolean) as Queue[]
    : Array.from(queues?.values() || [])

  const cleanedJobs: string[] = []

  for (const queue of queuesToClean) {
    const grace = options?.grace || 24 * 3600 * 1000 // 24 hours default
    const limit = options?.limit || 1000
    const status = options?.status || 'completed'

    const jobs = await queue.clean(grace, limit, status)
    cleanedJobs.push(...jobs)
  }

  return cleanedJobs
}

// Pause a queue
export async function pauseQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueName)
  if (queue) await queue.pause()
}

// Resume a queue
export async function resumeQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueName)
  if (queue) await queue.resume()
}

// Get job by ID
export async function getJob(queueName: string, jobId: string): Promise<Job | null> {
  const queue = getQueue(queueName)
  if (!queue) return null
  
  return queue.getJob(jobId)
}

// Retry a failed job
export async function retryJob(queueName: string, jobId: string): Promise<void> {
  const job = await getJob(queueName, jobId)
  if (job && (await job.isFailed())) {
    await job.retry()
  }
}

// Remove a job
export async function removeJob(queueName: string, jobId: string): Promise<void> {
  const job = await getJob(queueName, jobId)
  if (job) {
    await job.remove()
  }
}

// Close all connections (for graceful shutdown)
export async function closeQueues(): Promise<void> {
  if (queues) {
    for (const queue of queues.values()) {
      await queue.close()
    }
    queues = null
  }

  if (queueEvents) {
    for (const events of queueEvents.values()) {
      await events.close()
    }
    queueEvents = null
  }
}

// Export for use in API routes
export const queueManager = {
  initialize: initializeQueues,
  getQueue,
  addPDFGenerationJob,
  addEmailNotificationJob,
  addExchangeRateJob,
  addInvoiceProcessingJob,
  addGSTReturnJob,
  addRecurringJob,
  getQueueMetrics,
  getAllQueueMetrics,
  cleanQueues,
  pauseQueue,
  resumeQueue,
  getJob,
  retryJob,
  removeJob,
  close: closeQueues,
}
