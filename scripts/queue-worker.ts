#!/usr/bin/env ts-node
/**
 * Queue worker process
 * Processes jobs from the BullMQ queue
 */

import dotenv from 'dotenv'
import path from 'path'

// Load .env.local for local development
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
import { BullMQService } from '../lib/queue/bullmq.service'
import { pdfGenerationHandler } from '../lib/queue/handlers/pdf-generation.handler'
import { emailNotificationHandler } from '../lib/queue/handlers/email-notification.handler'
import { exchangeRateFetchHandler } from '../lib/queue/handlers/exchange-rate-fetch.handler'

// Debug environment loading
console.log('Environment check:')
console.log('REDIS_URL:', process.env.REDIS_URL)
console.log('REDIS_HOST:', process.env.REDIS_HOST)
console.log('REDIS_PORT:', process.env.REDIS_PORT)
console.log('REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? '***' : 'not set')

// Initialize queue service
let redisConfig: { host: string; port: number; password?: string } = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
}

// If REDIS_URL is provided, prefer using REDIS_PASSWORD directly if available
// This avoids URL encoding/decoding issues
if (process.env.REDIS_URL && process.env.REDIS_PASSWORD) {
  const url = new URL(process.env.REDIS_URL)
  redisConfig = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: process.env.REDIS_PASSWORD, // Use password directly, not from URL
  }
} else if (process.env.REDIS_URL) {
  // Fallback to parsing from URL if REDIS_PASSWORD not available
  const url = new URL(process.env.REDIS_URL)
  // Handle the common redis://:password@host format
  if (!url.password && url.username === '' && process.env.REDIS_URL.includes('://:')) {
    const match = process.env.REDIS_URL.match(/redis:\/\/:([^@]+)@/)
    if (match) {
      redisConfig = {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: decodeURIComponent(match[1]),
      }
    }
  } else {
    redisConfig = {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
    }
  }
}

const queueService = new BullMQService({
  redis: redisConfig,
})

// Register job handlers
queueService.registerHandler('PDF_GENERATION', pdfGenerationHandler)
queueService.registerHandler('EMAIL_NOTIFICATION', emailNotificationHandler)
queueService.registerHandler('EXCHANGE_RATE_FETCH', exchangeRateFetchHandler)

// Start processing jobs
async function start() {
  console.log('🚀 Queue worker started')
  console.log(`Redis: ${redisConfig.host}:${redisConfig.port}${redisConfig.password ? ' (with auth)' : ''}`)
  
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