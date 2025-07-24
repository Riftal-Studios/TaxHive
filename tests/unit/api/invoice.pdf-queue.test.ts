import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { Session } from 'next-auth'

// First, set up all mocks before any imports
const mockEnqueueJob = vi.fn()
const mockGetJob = vi.fn()
const mockRegisterHandler = vi.fn()
const mockClose = vi.fn()

vi.mock('@/lib/queue/bullmq.service', () => ({
  BullMQService: vi.fn().mockImplementation(() => ({
    enqueueJob: mockEnqueueJob,
    getJob: mockGetJob,
    registerHandler: mockRegisterHandler,
    close: mockClose,
  })),
}))

vi.mock('@/lib/prisma', () => ({
  db: {
    invoice: {
      findFirst: vi.fn(),
    },
  },
  prisma: {
    invoice: {
      findFirst: vi.fn(),
    },
  },
}))

// Import the router after mocks are set up
import { invoiceRouter } from '@/server/api/routers/invoice'

describe('Invoice PDF Queue Integration', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
    expires: '2025-12-31',
  }

  const mockInvoice = {
    id: 'invoice-123',
    invoiceNumber: 'FY24-25/001',
    userId: 'user-123',
    status: 'SENT',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnqueueJob.mockClear()
    mockGetJob.mockClear()
  })

  describe('queuePDFGeneration', () => {
    it('should enqueue PDF generation job for valid invoice', async () => {
      const mockJobId = 'job-123'
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(mockInvoice as any)
      mockEnqueueJob.mockResolvedValue({ id: mockJobId })

      // Create a minimal context for tRPC
      const ctx = {
        session: mockSession,
        prisma,
      }
      const caller = invoiceRouter.createCaller(ctx as any)

      const result = await caller.queuePDFGeneration({ id: 'invoice-123' })

      expect(result).toEqual({
        success: true,
        jobId: mockJobId,
        message: 'PDF generation queued successfully',
      })

      expect(mockEnqueueJob).toHaveBeenCalledWith('PDF_GENERATION', {
        invoiceId: 'invoice-123',
        userId: 'user-123',
      })
    })

    it('should throw error if invoice not found', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null)

      const ctx = {
        session: mockSession,
        prisma,
      }
      const caller = invoiceRouter.createCaller(ctx as any)

      await expect(caller.queuePDFGeneration({ id: 'invoice-123' })).rejects.toThrow('Invoice not found')
    })
  })

  describe('getPDFGenerationStatus', () => {
    it('should return job status for valid job', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'completed',
        result: {
          success: true,
          pdfUrl: '/uploads/invoices/invoice-123.pdf',
        },
      }

      mockGetJob.mockResolvedValue(mockJob)

      const { prisma } = await import('@/lib/prisma')
      const ctx = {
        session: mockSession,
        prisma,
      }
      const caller = invoiceRouter.createCaller(ctx as any)

      const result = await caller.getPDFGenerationStatus({ jobId: 'job-123' })

      expect(result).toEqual({
        jobId: 'job-123',
        status: 'completed',
        pdfUrl: '/uploads/invoices/invoice-123.pdf',
      })
    })

    it('should return pending status for active job', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'active',
        progress: 50,
      }

      mockGetJob.mockResolvedValue(mockJob)

      const { prisma } = await import('@/lib/prisma')
      const ctx = {
        session: mockSession,
        prisma,
      }
      const caller = invoiceRouter.createCaller(ctx as any)

      const result = await caller.getPDFGenerationStatus({ jobId: 'job-123' })

      expect(result).toEqual({
        jobId: 'job-123',
        status: 'active',
        progress: 50,
      })
    })

    it('should handle failed jobs', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'failed',
        error: 'PDF generation failed',
      }

      mockGetJob.mockResolvedValue(mockJob)

      const { prisma } = await import('@/lib/prisma')
      const ctx = {
        session: mockSession,
        prisma,
      }
      const caller = invoiceRouter.createCaller(ctx as any)

      const result = await caller.getPDFGenerationStatus({ jobId: 'job-123' })

      expect(result).toEqual({
        jobId: 'job-123',
        status: 'failed',
        error: 'PDF generation failed',
      })
    })
  })
})