import { z } from 'zod'

// Job Types
export const JobTypeEnum = z.enum([
  'PDF_GENERATION',
  'EMAIL_NOTIFICATION',
  'EXCHANGE_RATE_FETCH',
  'PAYMENT_REMINDER',
])

export type JobType = z.infer<typeof JobTypeEnum>

// Job Status
export const JobStatusEnum = z.enum([
  'pending',
  'active',
  'completed',
  'failed',
  'delayed',
])

export type JobStatus = z.infer<typeof JobStatusEnum>

// Job Progress
export interface JobProgress {
  current: number
  total: number
  percentage: number
}

// Job Error
export interface JobError {
  message: string
  stack?: string
  code?: string
}

// Base Job Interface
export interface Job<T = unknown> {
  id: string
  type: JobType
  data: T
  status: JobStatus
  attempts: number
  maxAttempts: number
  priority?: number
  progress?: JobProgress
  error?: JobError
  result?: unknown
  createdAt: Date
  updatedAt: Date
  processedAt?: Date
  completedAt?: Date
  failedAt?: Date
}

// Job Options
export interface JobOptions {
  delay?: number // Delay in milliseconds
  priority?: number // Job priority (1-10, 1 being highest)
  attempts?: number // Max retry attempts
  backoff?: {
    type: 'fixed' | 'exponential'
    delay: number
  }
  removeOnComplete?: boolean | number // Remove job after completion
  removeOnFail?: boolean | number // Remove job after failure
}

// Queue Stats
export interface QueueStats {
  pending: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
}

// Job Filter Options
export interface JobFilterOptions {
  type?: JobType
  status?: JobStatus[]
  limit?: number
  offset?: number
  order?: 'asc' | 'desc'
}

// Clean Options
export interface CleanOptions {
  grace: number // Grace period in milliseconds
  status: JobStatus
  limit?: number
}

// Processor Options
export interface ProcessorOptions {
  concurrency?: number
}

// Job Processor Function
export type JobProcessor<T = unknown> = (job: Job<T>) => Promise<unknown>

// Queue Service Interface
export interface QueueService {
  // Job Management
  enqueue<T = unknown>(type: JobType, data: T, options?: JobOptions): Promise<Job<T>>
  process<T = unknown>(type: JobType, processor: JobProcessor<T>, options?: ProcessorOptions): Promise<void>
  
  // Job Queries
  getJob(jobId: string): Promise<Job | null>
  getJobs(options?: JobFilterOptions): Promise<Job[]>
  
  // Queue Management
  getStats(): Promise<QueueStats>
  pause(): Promise<void>
  resume(): Promise<void>
  clean(options: CleanOptions): Promise<void>
  close(): Promise<void>
}

// Job Type Specific Data Schemas
export const PdfGenerationJobSchema = z.object({
  invoiceId: z.string(),
  userId: z.string(),
})

export const EmailNotificationJobSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  template: z.string(),
  data: z.record(z.string(), z.any()),
  userId: z.string().optional(),
})

export const ExchangeRateFetchJobSchema = z.object({
  date: z.date(),
  currencies: z.array(z.string()),
  source: z.enum(['RBI', 'FALLBACK']).optional(),
})

export const PaymentReminderJobSchema = z.object({
  invoiceId: z.string(),
  clientId: z.string(),
  userId: z.string(),
  reminderNumber: z.number(),
})

// Type helpers
export type PdfGenerationJobData = z.infer<typeof PdfGenerationJobSchema>
export type EmailNotificationJobData = z.infer<typeof EmailNotificationJobSchema>
export type ExchangeRateFetchJobData = z.infer<typeof ExchangeRateFetchJobSchema>
export type PaymentReminderJobData = z.infer<typeof PaymentReminderJobSchema>

// Job Events
export interface QueueEvents {
  'job:created': (job: Job) => void
  'job:active': (job: Job) => void
  'job:progress': (job: Job, progress: JobProgress) => void
  'job:completed': (job: Job, result: unknown) => void
  'job:failed': (job: Job, error: JobError) => void
  'job:retrying': (job: Job, attempt: number) => void
  'queue:paused': () => void
  'queue:resumed': () => void
  'queue:error': (error: Error) => void
}