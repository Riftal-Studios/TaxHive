#!/usr/bin/env tsx
/**
 * Queue Worker
 *
 * Processes background jobs from BullMQ queues including:
 * - PDF generation
 * - Email notifications
 * - Exchange rate fetching
 *
 * Usage: npm run worker
 */

import { getQueueService } from '@/lib/queue'
import {
  pdfGenerationHandler,
  emailNotificationHandler,
  exchangeRateFetchHandler
} from '@/lib/queue/handlers'

async function startWorker() {
  console.log('🚀 Starting queue worker...')

  try {
    const queueService = getQueueService()

    // Register handlers for each job type
    console.log('📝 Registering PDF generation handler...')
    await queueService.process('PDF_GENERATION', pdfGenerationHandler, {
      concurrency: 2, // Process 2 PDFs concurrently
    })

    console.log('📧 Registering email notification handler...')
    await queueService.process('EMAIL_NOTIFICATION', emailNotificationHandler, {
      concurrency: 5, // Process 5 emails concurrently
    })

    console.log('💱 Registering exchange rate fetch handler...')
    await queueService.process('EXCHANGE_RATE_FETCH', exchangeRateFetchHandler, {
      concurrency: 1, // Process one at a time
    })

    console.log('✅ Queue worker started successfully!')
    console.log('👂 Listening for jobs...')
    console.log('Press CTRL+C to stop\n')

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down worker...')
      await queueService.close()
      console.log('✅ Worker stopped gracefully')
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down worker...')
      await queueService.close()
      console.log('✅ Worker stopped gracefully')
      process.exit(0)
    })

  } catch (error) {
    console.error('❌ Failed to start queue worker:', error)
    process.exit(1)
  }
}

// Start the worker
startWorker().catch((error) => {
  console.error('❌ Unhandled error in worker:', error)
  process.exit(1)
})
