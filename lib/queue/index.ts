import { BullMQService } from './bullmq.service'
import type { QueueService } from './types'

let queueService: QueueService | null = null

export function getQueueService(): QueueService {
  if (!queueService) {
    // Parse Redis URL if available, otherwise use individual config
    let redisConfig: { host: string; port: number; password?: string } = {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    }
    
    // If REDIS_URL is provided, parse it
    if (process.env.REDIS_URL) {
      const url = new URL(process.env.REDIS_URL)
      // For Redis URLs like redis://:password@host:port, the password is in username
      // For Redis URLs like redis://user:password@host:port, the password is in password
      const password = url.password || (url.username === '' ? url.username : null) || 
                       (url.pathname && url.pathname.includes('@') ? url.username : null)
      
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
          password: password || undefined,
        }
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