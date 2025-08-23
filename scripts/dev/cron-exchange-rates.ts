#!/usr/bin/env ts-node
/**
 * Cron job to fetch exchange rates daily
 * Enqueues exchange rate fetch job to the queue
 */

import 'dotenv/config'
import { Logger } from '@/lib/logger'
import { BullMQService } from '@/lib/queue/bullmq.service'

// Initialize queue service
const queueService = new BullMQService({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
})

async function fetchExchangeRates() {
  try {
    Logger.info('Enqueuing exchange rate fetch job...')
    
    const job = await queueService.enqueue('EXCHANGE_RATE_FETCH', {
      date: new Date(),
      currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'AED'],
      source: 'RBI',
      cleanOldRates: true,
      cleanOlderThan: 30, // Clean rates older than 30 days
    })

    Logger.info(`✅ Exchange rate fetch job enqueued: ${job.id}`)
  } catch (error) {
    Logger.error('Failed to enqueue exchange rate fetch job:', error)
    process.exit(1)
  } finally {
    await queueService.close()
  }
}

fetchExchangeRates()