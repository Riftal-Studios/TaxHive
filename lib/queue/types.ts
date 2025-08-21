import { Job as BullMQJob } from 'bullmq'

// Re-export BullMQ Job as our Job type
export type Job<T = unknown> = BullMQJob<T>

// Job Type Enum
export enum JobTypeEnum {
  PDF_GENERATION = 'pdf-generation',
  EMAIL_NOTIFICATION = 'email-notification',
  EXCHANGE_RATE_FETCH = 'exchange-rate-fetch',
  INVOICE_PROCESSING = 'invoice-processing',
  GST_RETURN = 'gst-return',
  PAYMENT_REMINDER = 'payment-reminder'
}

// Job Type
export type JobType = 
  | 'pdf-generation'
  | 'email-notification'
  | 'exchange-rate-fetch'
  | 'invoice-processing'
  | 'gst-return'
  | 'payment-reminder'

// Job Options
export interface JobOptions {
  delay?: number
  attempts?: number
  backoff?: {
    type: 'exponential' | 'fixed'
    delay: number
  }
  removeOnComplete?: boolean | number
  removeOnFail?: boolean | number
  priority?: number
  repeat?: {
    cron?: string
    every?: number
    tz?: string
  }
}

// Job Progress
export interface JobProgress {
  percentage: number
  message?: string
  data?: unknown
}

// Job Filter Options
export interface JobFilterOptions {
  type?: JobType
  status?: Array<'pending' | 'active' | 'completed' | 'failed' | 'delayed'>
  limit?: number
  offset?: number
}

// Clean Options
export interface CleanOptions {
  status: 'completed' | 'failed' | 'active' | 'delayed'
  grace: number // milliseconds
  limit?: number
}

// Processor Options
export interface ProcessorOptions {
  concurrency?: number
  limiter?: {
    max: number
    duration: number
  }
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

// Queue Service Interface
export interface QueueService {
  enqueue<T = JobData>(type: JobType, data: T, options?: JobOptions): Promise<Job<T>>
  process<T = JobData>(type: JobType, processor: JobProcessor<T, JobResult>, options?: ProcessorOptions): Promise<void>
  getJob(jobId: string): Promise<Job | null>
  getJobs(options?: JobFilterOptions): Promise<Job[]>
  getStats(): Promise<QueueStats>
  pause(): Promise<void>
  resume(): Promise<void>
  clean(options: CleanOptions): Promise<void>
  close(): Promise<void>
  
  // Alias methods for backward compatibility
  enqueueJob<T = JobData>(type: JobType, data: T, options?: JobOptions): Promise<Job<T>>
  registerHandler<T = JobData>(type: JobType, handler: JobProcessor<T, JobResult>, options?: ProcessorOptions): Promise<void>
}

// PDF Generation Job Types
export interface PDFGenerationJobData {
  type: 'invoice' | 'credit-note' | 'debit-note' | 'receipt'
  entityId: string // Invoice ID, Credit Note ID, etc.
  userId: string
  options?: {
    sendEmail?: boolean
    saveToS3?: boolean
  }
}

export interface PDFGenerationJobResult {
  pdfUrl: string
  pdfPath?: string
  s3Key?: string
  generatedAt: Date
}

// Email Notification Job Types
export interface EmailNotificationJobData {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  template: string
  data: Record<string, any> // Template-specific data
  attachments?: Array<{
    filename: string
    path?: string
    content?: Buffer | string
    contentType?: string
  }>
  userId?: string
}

export interface EmailNotificationJobResult {
  messageId: string
  accepted: string[]
  rejected: string[]
  sentAt: Date
}

// Exchange Rate Job Types
export interface ExchangeRateJobData {
  source?: 'RBI' | 'EXCHANGE_RATE_API' | 'CURRENCY_API' | 'FIXER'
  date?: Date | string // Date object or YYYY-MM-DD format, defaults to today
  currencies?: string[] // Specific currencies to fetch, defaults to all
  cleanOldRates?: boolean // Whether to clean old exchange rates
  cleanOlderThan?: number // Days threshold for cleaning old rates
}

export interface ExchangeRateJobResult {
  source: string
  date: string
  rates: Record<string, number>
  baseCurrency: string
  fetchedAt: Date
}

// Invoice Processing Job Types
export interface InvoiceProcessingJobData {
  invoiceId: string
  userId: string
  tasks: Array<'generate-pdf' | 'send-email' | 'update-gst-return' | 'sync-accounting'>
}

export interface InvoiceProcessingJobResult {
  invoiceId: string
  completedTasks: string[]
  failedTasks: string[]
  results: Record<string, any>
}

// GST Return Job Types
export interface GSTReturnJobData {
  userId: string
  period: string // YYYY-MM format
  type: 'GSTR1' | 'GSTR3B' | 'GSTR2A'
  action: 'generate' | 'file' | 'download'
  data?: Record<string, any>
}

export interface GSTReturnJobResult {
  returnId: string
  status: 'generated' | 'filed' | 'downloaded'
  fileUrl?: string
  arn?: string // Acknowledgment Reference Number
  generatedAt: Date
}

// Generic Job Types
export type JobData =
  | PDFGenerationJobData
  | EmailNotificationJobData
  | ExchangeRateJobData
  | InvoiceProcessingJobData
  | GSTReturnJobData

export type JobResult =
  | PDFGenerationJobResult
  | EmailNotificationJobResult
  | ExchangeRateJobResult
  | InvoiceProcessingJobResult
  | GSTReturnJobResult

// Job Status Types
export interface JobStatus {
  id: string
  name: string
  queue: string
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused'
  progress: number
  data: JobData
  result?: JobResult
  error?: string
  createdAt: Date
  processedAt?: Date
  completedAt?: Date
  failedAt?: Date
}

// Queue Metrics
export interface QueueMetrics {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
  avgProcessingTime?: number
  throughput?: number // jobs per minute
}

// Processor function type
export type JobProcessor<T extends JobData, R extends JobResult> = (
  job: Job<T>
) => Promise<R>

// Schedule patterns for recurring jobs
export interface SchedulePattern {
  pattern: string // Cron pattern or RRule
  timezone?: string
  startDate?: Date
  endDate?: Date
}

// Common schedule patterns
export const SCHEDULE_PATTERNS = {
  // RBI rates are published daily at 1:30 PM IST
  RBI_DAILY: '30 13 * * *', // 1:30 PM IST daily
  
  // GST Return reminders
  GSTR1_REMINDER: '0 9 8 * *', // 9 AM on 8th of every month
  GSTR3B_REMINDER: '0 9 18 * *', // 9 AM on 18th of every month
  
  // Payment reminders
  WEEKLY_PAYMENT_REMINDER: '0 10 * * MON', // 10 AM every Monday
  MONTHLY_PAYMENT_REMINDER: '0 10 1 * *', // 10 AM on 1st of every month
  
  // Backup and maintenance
  DAILY_BACKUP: '0 2 * * *', // 2 AM daily
  WEEKLY_CLEANUP: '0 3 * * SUN', // 3 AM every Sunday
} as const

// Zod Schemas for job validation (placeholder exports - actual schemas would be defined elsewhere)
export const PdfGenerationJobSchema = {} as any
export const EmailNotificationJobSchema = {} as any
export const ExchangeRateFetchJobSchema = {} as any
export const PaymentReminderJobSchema = {} as any
