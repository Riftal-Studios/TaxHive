import { ConnectionOptions } from 'bullmq'
import Redis from 'ioredis'

// Redis connection configuration
export function getRedisConfig(): ConnectionOptions {
  // If REDIS_URL is provided, use it (takes precedence)
  if (process.env.REDIS_URL) {
    return {
      connection: new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null, // Important for workers
        enableOfflineQueue: false, // Fail fast for API operations
      }),
    }
  }

  // Otherwise use individual settings
  const config: ConnectionOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // Important for workers
    enableOfflineQueue: false, // Fail fast for API operations
  }

  return config
}

// Create a new Redis connection for BullMQ
export function createRedisConnection(): Redis {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    })
  }

  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  })
}

// Queue names as constants to avoid typos
export const QUEUE_NAMES = {
  PDF_GENERATION: 'pdf-generation',
  EMAIL_NOTIFICATION: 'email-notification',
  EXCHANGE_RATES: 'exchange-rates',
  INVOICE_PROCESSING: 'invoice-processing',
  GST_RETURNS: 'gst-returns',
} as const

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES]

// Job priorities
export const JOB_PRIORITIES = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
} as const

// Default job options
export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
    age: 24 * 3600, // Remove completed jobs older than 24 hours
  },
  removeOnFail: {
    count: 500, // Keep last 500 failed jobs for debugging
    age: 7 * 24 * 3600, // Remove failed jobs older than 7 days
  },
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // Start with 2 second delay
  },
}

// Worker concurrency settings
export const WORKER_CONCURRENCY = {
  [QUEUE_NAMES.PDF_GENERATION]: 2, // CPU intensive, limit concurrency
  [QUEUE_NAMES.EMAIL_NOTIFICATION]: 5, // I/O bound, can handle more
  [QUEUE_NAMES.EXCHANGE_RATES]: 1, // Sequential processing for rate limits
  [QUEUE_NAMES.INVOICE_PROCESSING]: 3,
  [QUEUE_NAMES.GST_RETURNS]: 2,
}

// Check if Redis is configured
export function isRedisConfigured(): boolean {
  return !!(process.env.REDIS_URL || process.env.REDIS_HOST)
}