#!/usr/bin/env tsx
import { getQueueService } from '../../lib/queue'

async function checkQueue() {
  const queueService = getQueueService()
  
  console.log('Checking queue status...')
  const stats = await queueService.getStats()
  console.log('Queue Stats:', stats)
  
  // Get recent jobs
  const jobs = await queueService.getJobs({ limit: 10 })
  console.log('\nRecent jobs:')
  jobs.forEach(job => {
    console.log(`- Job ${job.id}: ${job.type} - ${job.status}`)
    if (job.error) {
      console.log('  Error:', job.error.message)
    }
    if (job.status === 'completed') {
      console.log('  Result:', JSON.stringify(job.result, null, 2))
    }
  })
  
  process.exit(0)
}

checkQueue().catch(console.error)