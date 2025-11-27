import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Session } from 'next-auth'
import { TRPCError } from '@trpc/server'

// Mock server-only to allow imports in test environment
vi.mock('server-only', () => ({}))

// Mock the queue module to simulate unavailable queue service
vi.mock('@/lib/queue', () => {
  const mockGetQueue = vi.fn()
  const mockIsQueueServiceAvailable = vi.fn()

  return {
    getQueueService: mockGetQueue,
    isQueueServiceAvailable: mockIsQueueServiceAvailable,
  }
})

vi.mock('@/lib/prisma', () => ({
  db: {
    invoice: {
      findUnique: vi.fn(),
    },
  },
  prisma: {
    invoice: {
      findUnique: vi.fn(),
    },
  },
}))

// Import the router after mocks are set up
import { invoiceRouter } from '@/server/api/routers/invoice'
import { db } from '@/lib/prisma'
import { getQueueService, isQueueServiceAvailable } from '@/lib/queue'

describe('checkPDFStatus', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
    expires: '2025-12-31',
  }

  const mockReq = {
    headers: new Headers(),
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return PDF status from database when queue service is unavailable', async () => {
    // Setup: Queue service is not available
    vi.mocked(isQueueServiceAvailable).mockReturnValue(false)
    vi.mocked(getQueueService).mockReturnValue(null as any)

    const mockInvoice = {
      id: 'invoice-123',
      pdfStatus: 'completed',
      pdfError: null,
      pdfUrl: '/uploads/invoices/invoice-123.pdf',
      pdfGeneratedAt: new Date('2024-04-15'),
      pdfJobId: 'job-123',
    }

    vi.mocked(db.invoice.findUnique).mockResolvedValue(mockInvoice as any)

    const ctx = {
      session: mockSession,
      prisma: db as any,
      req: mockReq,
    }
    const caller = invoiceRouter.createCaller(ctx)

    // Act: Call checkPDFStatus
    const result = await caller.checkPDFStatus({ id: 'invoice-123' })

    // Assert: Should return the PDF status from database
    expect(result).toEqual({
      status: 'completed',
      error: null,
      pdfUrl: '/uploads/invoices/invoice-123.pdf',
      pdfGeneratedAt: mockInvoice.pdfGeneratedAt,
      progress: 100,
    })
  })

  it('should return pending status when PDF has not been generated yet', async () => {
    vi.mocked(isQueueServiceAvailable).mockReturnValue(false)
    vi.mocked(getQueueService).mockReturnValue(null as any)

    const mockInvoice = {
      id: 'invoice-123',
      pdfStatus: 'pending',
      pdfError: null,
      pdfUrl: null,
      pdfGeneratedAt: null,
      pdfJobId: null,
    }

    vi.mocked(db.invoice.findUnique).mockResolvedValue(mockInvoice as any)

    const ctx = {
      session: mockSession,
      prisma: db as any,
      req: mockReq,
    }
    const caller = invoiceRouter.createCaller(ctx)

    const result = await caller.checkPDFStatus({ id: 'invoice-123' })

    expect(result).toEqual({
      status: 'pending',
      error: null,
      pdfUrl: null,
      pdfGeneratedAt: null,
      progress: 0,
    })
  })

  it('should return error status when PDF generation failed', async () => {
    vi.mocked(isQueueServiceAvailable).mockReturnValue(false)
    vi.mocked(getQueueService).mockReturnValue(null as any)

    const mockInvoice = {
      id: 'invoice-123',
      pdfStatus: 'failed',
      pdfError: 'PDF generation failed: Template error',
      pdfUrl: null,
      pdfGeneratedAt: null,
      pdfJobId: 'job-123',
    }

    vi.mocked(db.invoice.findUnique).mockResolvedValue(mockInvoice as any)

    const ctx = {
      session: mockSession,
      prisma: db as any,
      req: mockReq,
    }
    const caller = invoiceRouter.createCaller(ctx)

    const result = await caller.checkPDFStatus({ id: 'invoice-123' })

    expect(result).toEqual({
      status: 'failed',
      error: 'PDF generation failed: Template error',
      pdfUrl: null,
      pdfGeneratedAt: null,
      progress: 0,
    })
  })

  it('should check job status when queue service is available and PDF is generating', async () => {
    const mockGetJob = vi.fn()
    const mockQueueService = {
      getJob: mockGetJob,
    }

    vi.mocked(isQueueServiceAvailable).mockReturnValue(true)
    vi.mocked(getQueueService).mockReturnValue(mockQueueService as any)

    const mockInvoice = {
      id: 'invoice-123',
      pdfStatus: 'generating',
      pdfError: null,
      pdfUrl: null,
      pdfGeneratedAt: null,
      pdfJobId: 'job-123',
    }

    const mockJob = {
      id: 'job-123',
      status: 'active',
      progress: 75,
    }

    vi.mocked(db.invoice.findUnique).mockResolvedValue(mockInvoice as any)
    mockGetJob.mockResolvedValue(mockJob)

    const ctx = {
      session: mockSession,
      prisma: db as any,
      req: mockReq,
    }
    const caller = invoiceRouter.createCaller(ctx)

    const result = await caller.checkPDFStatus({ id: 'invoice-123' })

    expect(mockGetJob).toHaveBeenCalledWith('job-123')
    expect(result).toEqual({
      status: 'generating',
      error: null,
      pdfUrl: null,
      pdfGeneratedAt: null,
      progress: 75,
    })
  })

  it('should throw NOT_FOUND error if invoice does not exist', async () => {
    vi.mocked(isQueueServiceAvailable).mockReturnValue(false)
    vi.mocked(getQueueService).mockReturnValue(null as any)

    vi.mocked(db.invoice.findUnique).mockResolvedValue(null)

    const ctx = {
      session: mockSession,
      prisma: db as any,
      req: mockReq,
    }
    const caller = invoiceRouter.createCaller(ctx)

    await expect(caller.checkPDFStatus({ id: 'non-existent' })).rejects.toThrow(TRPCError)
  })
})
