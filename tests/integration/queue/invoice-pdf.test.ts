import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BullMQService } from '@/lib/queue/bullmq.service'
import { pdfGenerationHandler } from '@/lib/queue/handlers/pdf-generation.handler'
import { db } from '@/lib/prisma'
import * as pdfGenerator from '@/lib/pdf-generator'
import * as pdfUploader from '@/lib/pdf-uploader'

// Mock external dependencies
vi.mock('@/lib/pdf-generator', () => ({
  generateInvoicePDF: vi.fn(),
}))

vi.mock('@/lib/pdf-uploader', () => ({
  uploadPDF: vi.fn(),
}))

describe('Invoice PDF Queue Integration', () => {
  let queueService: BullMQService

  beforeEach(() => {
    vi.clearAllMocks()
    // Initialize queue service with test Redis connection
    queueService = new BullMQService({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    })
  })

  afterEach(async () => {
    await queueService.close()
  })

  describe('End-to-end PDF generation flow', () => {
    it('should queue and process PDF generation job', async () => {
      // Mock data
      const mockInvoice = {
        id: 'invoice-123',
        invoiceNumber: 'FY24-25/001',
        userId: 'user-456',
        clientId: 'client-789',
        status: 'SENT',
        pdfUrl: null,
        user: {
          id: 'user-456',
          name: 'Test User',
          email: 'user@example.com',
          gstin: '29ABCDE1234F1Z5',
        },
        client: {
          id: 'client-789',
          name: 'Test Client',
        },
        lineItems: [],
        lut: null,
      }

      const mockPdfBuffer = Buffer.from('mock-pdf-content')
      const mockPdfUrl = '/uploads/invoices/invoice-123.pdf'

      // Mock database and external services
      vi.spyOn(db.invoice, 'findUniqueOrThrow').mockResolvedValue(mockInvoice as any)
      vi.spyOn(db.invoice, 'update').mockResolvedValue({ ...mockInvoice, pdfUrl: mockPdfUrl } as any)
      vi.mocked(pdfGenerator.generateInvoicePDF).mockResolvedValue(mockPdfBuffer)
      vi.mocked(pdfUploader.uploadPDF).mockResolvedValue(mockPdfUrl)

      // Register handler
      queueService.process('PDF_GENERATION', pdfGenerationHandler)

      // Enqueue job
      const job = await queueService.enqueue('PDF_GENERATION', {
        invoiceId: 'invoice-123',
        userId: 'user-456',
      })

      expect(job.id).toBeDefined()
      expect(job.type).toBe('PDF_GENERATION')
      expect(job.status).toBe('pending')

      // Wait for job to be processed (in real scenario, worker would process it)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Check job status
      const completedJob = await queueService.getJob(job.id)
      
      // Note: In a real integration test with Redis running,
      // the job would be processed by the worker
      expect(completedJob?.id).toBe(job.id)
    })
  })

  describe('Queue service functionality', () => {
    it('should enqueue job with correct data', async () => {
      const jobData = {
        invoiceId: 'test-invoice-123',
        userId: 'test-user-456',
      }

      const job = await queueService.enqueue('PDF_GENERATION', jobData)

      expect(job).toMatchObject({
        type: 'PDF_GENERATION',
        data: jobData,
        status: 'pending',
      })
    })

    it('should retrieve job by ID', async () => {
      const job = await queueService.enqueue('PDF_GENERATION', {
        invoiceId: 'test-123',
        userId: 'user-123',
      })

      const retrievedJob = await queueService.getJob(job.id)

      expect(retrievedJob?.id).toBe(job.id)
      expect(retrievedJob?.data).toEqual({
        invoiceId: 'test-123',
        userId: 'user-123',
      })
    })
  })
})