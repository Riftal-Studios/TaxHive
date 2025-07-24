import { BullMQService } from './bullmq.service'
import type { QueueService } from './types'

let queueService: QueueService | null = null

export function getQueueService(): QueueService {
  if (!queueService) {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
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