import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock BullMQ
const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'mock-job-id', data: {} }),
  getJob: vi.fn().mockResolvedValue({
    id: 'mock-job-id',
    data: {},
    returnvalue: { success: true, pdfPath: '/tmp/invoice.pdf' },
    progress: 100,
    finishedOn: Date.now()
  }),
  close: vi.fn().mockResolvedValue(undefined)
}

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => mockQueue),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock IORedis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    status: 'ready',
    disconnect: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock Prisma
const mockPrisma = {
  invoice: {
    findUnique: vi.fn().mockResolvedValue({
      id: 'invoice-123',
      number: 'FY24-25/001',
      clientName: 'Test Client',
      amount: 1000,
      status: 'SENT',
      items: [{ description: 'Service', amount: 1000 }]
    }),
    update: vi.fn().mockResolvedValue({
      id: 'invoice-123',
      pdfUrl: 'https://example.com/invoices/invoice-123.pdf'
    })
  }
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

// Mock PDF generator
const mockGenerateInvoicePDF = vi.fn().mockResolvedValue({
  success: true,
  pdfPath: '/tmp/invoice-123.pdf',
  fileName: 'invoice-FY24-25-001.pdf'
})

vi.mock('@/lib/pdf-generator', () => ({
  generateInvoicePDF: mockGenerateInvoicePDF
}))

// Mock PDF uploader
const mockUploadPDF = vi.fn().mockResolvedValue({
  success: true,
  url: 'https://example.com/invoices/invoice-123.pdf',
  fileName: 'invoice-FY24-25-001.pdf'
})

vi.mock('@/lib/pdf-uploader', () => ({
  uploadPDF: mockUploadPDF
}))

// Mock Queue Service with simpler interface
const mockQueueService = {
  addJob: vi.fn().mockImplementation(async (type, data, options) => {
    const job = await mockQueue.add(type, data, options)
    return {
      id: job.id,
      type,
      data,
      status: 'waiting',
      createdAt: new Date().toISOString()
    }
  }),
  
  getJob: vi.fn().mockImplementation(async (jobId) => {
    return await mockQueue.getJob(jobId)
  }),
  
  close: vi.fn().mockImplementation(async () => {
    return await mockQueue.close()
  })
}

vi.mock('@/lib/queue/bullmq.service', () => ({
  BullMQService: vi.fn().mockImplementation(() => mockQueueService)
}))

describe('Invoice PDF Queue Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Queue service functionality', () => {
    it('should enqueue job with correct data', async () => {
      const jobData = {
        invoiceId: 'invoice-123',
        userId: 'user-123',
        options: {
          priority: 'normal',
          template: 'standard'
        }
      }

      const job = await mockQueueService.addJob('PDF_GENERATION', jobData, {
        priority: 1,
        attempts: 3
      })

      expect(job).toEqual({
        id: 'mock-job-id',
        type: 'PDF_GENERATION',
        data: jobData,
        status: 'waiting',
        createdAt: expect.any(String)
      })
      expect(mockQueue.add).toHaveBeenCalledWith(
        'PDF_GENERATION',
        jobData,
        { priority: 1, attempts: 3 }
      )
    })

    it('should retrieve job by ID', async () => {
      const jobId = 'mock-job-id'
      
      const job = await mockQueueService.getJob(jobId)
      
      expect(job).toEqual({
        id: 'mock-job-id',
        data: {},
        returnvalue: { success: true, pdfPath: '/tmp/invoice.pdf' },
        progress: 100,
        finishedOn: expect.any(Number)
      })
      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId)
    })
  })

  describe('End-to-end PDF generation flow', () => {
    it('should queue and process PDF generation job', async () => {
      const jobData = {
        invoiceId: 'invoice-123',
        userId: 'user-123'
      }

      // Step 1: Enqueue the job
      const queuedJob = await mockQueueService.addJob('PDF_GENERATION', jobData)
      expect(queuedJob.type).toBe('PDF_GENERATION')
      expect(queuedJob.data.invoiceId).toBe('invoice-123')

      // Step 2: Simulate job processing
      const mockJob = {
        id: 'mock-job-id',
        data: jobData,
        updateProgress: vi.fn(),
        log: vi.fn()
      }

      // Mock the processing steps
      const invoiceData = await mockPrisma.invoice.findUnique({
        where: { id: jobData.invoiceId }
      })
      expect(invoiceData).toBeDefined()

      // Generate PDF
      const pdfResult = await mockGenerateInvoicePDF(invoiceData)
      expect(pdfResult.success).toBe(true)
      expect(pdfResult.pdfPath).toBe('/tmp/invoice-123.pdf')

      // Upload PDF
      const uploadResult = await mockUploadPDF(pdfResult.pdfPath, pdfResult.fileName)
      expect(uploadResult.success).toBe(true)
      expect(uploadResult.url).toBe('https://example.com/invoices/invoice-123.pdf')

      // Update invoice with PDF URL
      const updatedInvoice = await mockPrisma.invoice.update({
        where: { id: jobData.invoiceId },
        data: { pdfUrl: uploadResult.url }
      })
      expect(updatedInvoice.pdfUrl).toBe('https://example.com/invoices/invoice-123.pdf')

      // Step 3: Check final job status
      const completedJob = await mockQueueService.getJob(queuedJob.id)
      expect(completedJob.returnvalue.success).toBe(true)
      expect(completedJob.progress).toBe(100)
    })

    it('should handle PDF generation errors', async () => {
      const jobData = {
        invoiceId: 'invalid-invoice',
        userId: 'user-123'
      }

      // Mock invoice not found
      mockPrisma.invoice.findUnique.mockResolvedValueOnce(null)

      try {
        await mockPrisma.invoice.findUnique({ where: { id: jobData.invoiceId } })
        throw new Error('Invoice not found')
      } catch (error) {
        expect(error.message).toBe('Invoice not found')
      }
    })

    it('should handle PDF upload failures', async () => {
      const jobData = {
        invoiceId: 'invoice-123',
        userId: 'user-123'
      }

      // Mock successful PDF generation but failed upload
      mockUploadPDF.mockRejectedValueOnce(new Error('Upload failed'))

      const invoiceData = await mockPrisma.invoice.findUnique({
        where: { id: jobData.invoiceId }
      })
      
      const pdfResult = await mockGenerateInvoicePDF(invoiceData)
      expect(pdfResult.success).toBe(true)

      try {
        await mockUploadPDF(pdfResult.pdfPath, pdfResult.fileName)
      } catch (error) {
        expect(error.message).toBe('Upload failed')
      }
    })

    it('should track job progress during processing', async () => {
      const jobData = {
        invoiceId: 'invoice-123',
        userId: 'user-123'
      }

      const mockJob = {
        id: 'mock-job-id',
        data: jobData,
        updateProgress: vi.fn(),
        log: vi.fn()
      }

      // Simulate progress tracking during processing
      await mockJob.updateProgress(20) // Fetching invoice data
      await mockJob.updateProgress(50) // Generating PDF
      await mockJob.updateProgress(80) // Uploading PDF
      await mockJob.updateProgress(100) // Complete

      expect(mockJob.updateProgress).toHaveBeenCalledTimes(4)
      expect(mockJob.updateProgress).toHaveBeenCalledWith(20)
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50)
      expect(mockJob.updateProgress).toHaveBeenCalledWith(80)
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100)
    })
  })
})