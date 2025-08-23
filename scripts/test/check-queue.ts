#!/usr/bin/env tsx
import { getQueueService } from '../../lib/queue'
import { Logger } from '../../lib/logger'

async function checkQueue() {
  const queueService = getQueueService()
  
  Logger.info('Checking queue status...')
  const stats = await queueService.getStats()
  Logger.info('Queue Stats:', stats)
  
  // Get recent jobs
  const jobs = await queueService.getJobs({ limit: 10 })
  Logger.info('\nRecent jobs:')
  jobs.forEach(job => {
    Logger.info(`- Job ${job.id}: ${job.type} - ${job.status}`)
    if (job.error) {
      Logger.info('  Error:', job.error.message)
    }
    if (job.status === 'completed') {
      Logger.info('  Result:', JSON.stringify(job.result, null, 2))
    }
  })
  
  process.exit(0)
}

checkQueue().catch(Logger.error)