import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { queueManager } from '@/lib/queue/manager'
import { JOB_PRIORITIES } from '@/lib/queue/config'

export const queuesRouter = createTRPCRouter({
  // Get queue metrics
  getMetrics: protectedProcedure.query(async () => {
    return queueManager.getAllQueueMetrics()
  }),
  
  // Get specific queue metrics
  getQueueMetrics: protectedProcedure
    .input(z.object({
      queueName: z.string(),
    }))
    .query(async ({ input }) => {
      return queueManager.getQueueMetrics(input.queueName)
    }),
  
  // Get jobs from a queue
  getJobs: protectedProcedure
    .input(z.object({
      queueName: z.string(),
      status: z.enum(['waiting', 'active', 'completed', 'failed', 'delayed']).optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const queue = queueManager.getQueue(input.queueName)
      if (!queue) return []
      
      let jobs = []
      
      if (input.status) {
        switch (input.status) {
          case 'waiting':
            jobs = await queue.getWaiting(0, input.limit - 1)
            break
          case 'active':
            jobs = await queue.getActive(0, input.limit - 1)
            break
          case 'completed':
            jobs = await queue.getCompleted(0, input.limit - 1)
            break
          case 'failed':
            jobs = await queue.getFailed(0, input.limit - 1)
            break
          case 'delayed':
            jobs = await queue.getDelayed(0, input.limit - 1)
            break
        }
      } else {
        // Get all job types
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(0, 4),
          queue.getActive(0, 4),
          queue.getCompleted(0, 4),
          queue.getFailed(0, 4),
          queue.getDelayed(0, 4),
        ])
        
        jobs = [...waiting, ...active, ...completed, ...failed, ...delayed]
      }
      
      return jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        status: job.failedReason ? 'failed' : 
                job.finishedOn ? 'completed' :
                job.processedOn ? 'active' :
                job.opts.delay ? 'delayed' : 'waiting',
        progress: job.progress,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        failedReason: job.failedReason,
      }))
    }),
  
  // Pause a queue
  pauseQueue: protectedProcedure
    .input(z.object({
      queueName: z.string(),
    }))
    .mutation(async ({ input }) => {
      await queueManager.pauseQueue(input.queueName)
      return { success: true }
    }),
  
  // Resume a queue
  resumeQueue: protectedProcedure
    .input(z.object({
      queueName: z.string(),
    }))
    .mutation(async ({ input }) => {
      await queueManager.resumeQueue(input.queueName)
      return { success: true }
    }),
  
  // Clean queue
  cleanQueue: protectedProcedure
    .input(z.object({
      queueName: z.string(),
      status: z.enum(['completed', 'failed']),
      grace: z.number().optional(), // Grace period in ms
      limit: z.number().optional(), // Max jobs to clean
    }))
    .mutation(async ({ input }) => {
      const cleanedJobs = await queueManager.cleanQueues(input.queueName, {
        status: input.status,
        grace: input.grace,
        limit: input.limit,
      })
      
      return { 
        success: true,
        cleanedCount: cleanedJobs.length,
      }
    }),
  
  // Retry failed job
  retryJob: protectedProcedure
    .input(z.object({
      queueName: z.string(),
      jobId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await queueManager.retryJob(input.queueName, input.jobId)
      return { success: true }
    }),
  
  // Remove job
  removeJob: protectedProcedure
    .input(z.object({
      queueName: z.string(),
      jobId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await queueManager.removeJob(input.queueName, input.jobId)
      return { success: true }
    }),
  
  // Add test job (for development/testing)
  addTestJob: protectedProcedure
    .input(z.object({
      type: z.enum(['pdf', 'email', 'exchange']),
      data: z.record(z.any()),
      priority: z.number().optional(),
      delay: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let job = null
      
      switch (input.type) {
        case 'pdf':
          job = await queueManager.addPDFGenerationJob(
            {
              ...input.data,
              userId: ctx.session.user.id,
            } as any,
            {
              priority: input.priority || JOB_PRIORITIES.NORMAL,
              delay: input.delay,
            }
          )
          break
          
        case 'email':
          job = await queueManager.addEmailNotificationJob(
            {
              ...input.data,
              userId: ctx.session.user.id,
            } as any,
            {
              priority: input.priority || JOB_PRIORITIES.NORMAL,
              delay: input.delay,
            }
          )
          break
          
        case 'exchange':
          job = await queueManager.addExchangeRateJob(
            input.data as any,
            {
              priority: input.priority || JOB_PRIORITIES.LOW,
              delay: input.delay,
            }
          )
          break
      }
      
      return { 
        success: !!job,
        jobId: job?.id,
      }
    }),
})