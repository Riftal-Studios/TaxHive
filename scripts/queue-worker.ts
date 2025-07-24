#!/usr/bin/env ts-node
/**
 * Queue worker process
 * Processes jobs from the BullMQ queue
 */

import 'dotenv/config'
import { BullMQService } from '@/lib/queue/bullmq.service'
import { pdfGenerationHandler } from '@/lib/queue/handlers/pdf-generation.handler'
import { emailNotificationHandler } from '@/lib/queue/handlers/email-notification.handler'
import { exchangeRateFetchHandler } from '@/lib/queue/handlers/exchange-rate-fetch.handler'

// Initialize queue service
const queueService = new BullMQService({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
})

// Register job handlers
queueService.registerHandler('PDF_GENERATION', pdfGenerationHandler)
queueService.registerHandler('EMAIL_NOTIFICATION', emailNotificationHandler)
queueService.registerHandler('EXCHANGE_RATE_FETCH', exchangeRateFetchHandler)

// Start processing jobs
async function start() {
  console.log('🚀 Queue worker started')
  console.log(`Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`)
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...')
    await queueService.close()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...')
    await queueService.close()
    process.exit(0)
  })

  // Keep the process running
  await new Promise(() => {})
}

start().catch((error) => {
  console.error('Worker failed to start:', error)
  process.exit(1)
})