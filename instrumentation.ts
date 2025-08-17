/**
 * Next.js Instrumentation - Initialize BullMQ Workers
 * This file runs when the Next.js server starts
 */

import { Worker } from 'bullmq'
import { createRedisConnection, QUEUE_NAMES, WORKER_CONCURRENCY, isRedisConfigured } from './lib/queue/config'
import { SCHEDULE_PATTERNS } from './lib/queue/types'
import { queueManager } from './lib/queue/manager'
import path from 'path'

// Store worker instances for cleanup
const workers: Worker[] = []

export async function register() {
  // Only run on server
  if (typeof window !== 'undefined') return
  
  // Check if we're in a worker/build process
  if (process.env.NEXT_RUNTIME === 'edge') return
  
  // Check if Redis is configured
  if (!isRedisConfigured()) {
    console.log('Redis not configured. Queue workers disabled.')
    return
  }
  
  console.log('Initializing BullMQ workers...')
  
  try {
    // Initialize queues
    queueManager.initialize()
    
    // Create PDF Generation Worker
    const pdfWorker = new Worker(
      QUEUE_NAMES.PDF_GENERATION,
      path.join(__dirname, 'lib/queue/processors/pdf-generator.processor.js'),
      {
        connection: createRedisConnection(),
        concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.PDF_GENERATION],
      }
    )
    workers.push(pdfWorker)
    
    pdfWorker.on('completed', (job) => {
      console.log(`[PDF] Job ${job.id} completed`)
    })
    
    pdfWorker.on('failed', (job, err) => {
      console.error(`[PDF] Job ${job?.id} failed:`, err.message)
    })
    
    // Create Email Notification Worker
    const emailWorker = new Worker(
      QUEUE_NAMES.EMAIL_NOTIFICATION,
      path.join(__dirname, 'lib/queue/processors/email-notification.processor.js'),
      {
        connection: createRedisConnection(),
        concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.EMAIL_NOTIFICATION],
      }
    )
    workers.push(emailWorker)
    
    emailWorker.on('completed', (job) => {
      console.log(`[Email] Job ${job.id} completed`)
    })
    
    emailWorker.on('failed', (job, err) => {
      console.error(`[Email] Job ${job?.id} failed:`, err.message)
    })
    
    // Create Exchange Rates Worker
    const exchangeRatesWorker = new Worker(
      QUEUE_NAMES.EXCHANGE_RATES,
      path.join(__dirname, 'lib/queue/processors/exchange-rates.processor.js'),
      {
        connection: createRedisConnection(),
        concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.EXCHANGE_RATES],
      }
    )
    workers.push(exchangeRatesWorker)
    
    exchangeRatesWorker.on('completed', (job) => {
      console.log(`[Exchange Rates] Job ${job.id} completed`)
    })
    
    exchangeRatesWorker.on('failed', (job, err) => {
      console.error(`[Exchange Rates] Job ${job?.id} failed:`, err.message)
    })
    
    // Schedule recurring jobs
    await scheduleRecurringJobs()
    
    console.log('BullMQ workers initialized successfully')
    
    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`Received ${signal}, closing BullMQ workers...`)
      
      // Close all workers
      await Promise.all(workers.map(worker => worker.close()))
      
      // Close queue connections
      await queueManager.close()
      
      console.log('BullMQ workers closed successfully')
      process.exit(0)
    }
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    
  } catch (error) {
    console.error('Failed to initialize BullMQ workers:', error)
  }
}

// Schedule recurring jobs
async function scheduleRecurringJobs() {
  try {
    // Schedule daily RBI exchange rate fetch
    await queueManager.addRecurringJob(
      QUEUE_NAMES.EXCHANGE_RATES,
      'fetch-rbi-rates-daily',
      {
        source: 'RBI',
        date: undefined, // Will use current date
        currencies: undefined, // Will fetch all currencies
      },
      SCHEDULE_PATTERNS.RBI_DAILY,
      { timezone: 'Asia/Kolkata' }
    )
    
    console.log('Scheduled daily RBI exchange rate fetch at 1:30 PM IST')
    
    // Add more scheduled jobs as needed
    // Example: GST return reminders
    // await queueManager.addRecurringJob(...)
    
  } catch (error) {
    console.error('Failed to schedule recurring jobs:', error)
  }
}