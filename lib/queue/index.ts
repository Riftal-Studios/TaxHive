import { BullMQService } from './bullmq.service'
import type { QueueService } from './types'

let queueService: QueueService | null = null

export function getQueueService(): QueueService {
  if (!queueService) {
    // Parse Redis URL if available, otherwise use individual config
    let redisConfig: any = {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    }
    
    // If REDIS_URL is provided, parse it
    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL)
      redisConfig = {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password || undefined,
      }
    }

    queueService = new BullMQService({
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential' as const,
          delay: 2000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: false, // Keep failed jobs for debugging
      },
    })
  }

  return queueService
}

export { type QueueService, type Job, type JobType, type JobStatus } from './types'
export { BullMQService } from './bullmq.service'