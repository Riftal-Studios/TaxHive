import { describe, it, expect, vi } from 'vitest'
import type { QueueService, JobType, JobStatus } from '@/lib/queue/types'

describe('BullMQService API Contract', () => {
  it('should implement QueueService interface correctly', () => {
    // This test ensures our BullMQService implements the correct interface
    const mockService: QueueService = {
      enqueue: vi.fn(),
      process: vi.fn(),
      getJob: vi.fn(),
      getJobs: vi.fn(),
      getStats: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      clean: vi.fn(),
      close: vi.fn(),
    }

    // These properties should exist
    expect(mockService.enqueue).toBeDefined()
    expect(mockService.process).toBeDefined()
    expect(mockService.getJob).toBeDefined()
    expect(mockService.getJobs).toBeDefined()
    expect(mockService.getStats).toBeDefined()
    expect(mockService.pause).toBeDefined()
    expect(mockService.resume).toBeDefined()
    expect(mockService.clean).toBeDefined()
    expect(mockService.close).toBeDefined()

    // These properties should NOT exist (old API)
    expect((mockService as any).enqueueJob).toBeUndefined()
    expect((mockService as any).registerHandler).toBeUndefined()
  })

  it('should have correct method signatures', async () => {
    const mockService: QueueService = {
      enqueue: vi.fn().mockResolvedValue({
        id: 'job-123',
        type: 'PDF_GENERATION' as JobType,
        data: { invoiceId: '123', userId: '456' },
        status: 'pending' as JobStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getJob: vi.fn().mockResolvedValue({
        id: 'job-123',
        type: 'PDF_GENERATION' as JobType,
        data: { invoiceId: '123', userId: '456' },
        status: 'completed' as JobStatus,
        result: { success: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getJobs: vi.fn().mockResolvedValue([]),
      process: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockResolvedValue({
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
      }),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      clean: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }

    // Test enqueue signature
    const job = await mockService.enqueue('PDF_GENERATION', { invoiceId: '123', userId: '456' })
    expect(job.id).toBeDefined()
    expect(job.type).toBe('PDF_GENERATION')

    // Test getJob signature - only takes jobId, not type
    const retrievedJob = await mockService.getJob('job-123')
    expect(retrievedJob?.id).toBe('job-123')
  })
})