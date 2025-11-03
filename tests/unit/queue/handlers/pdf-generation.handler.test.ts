import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pdfGenerationHandler } from '@/lib/queue/handlers/pdf-generation.handler'
import type { Job } from '@/lib/queue/types'
import * as pdfGenerator from '@/lib/pdf-generator'
import * as pdfUploader from '@/lib/pdf-uploader'
import { db } from '@/lib/prisma'

vi.mock('@/lib/pdf-generator')
vi.mock('@/lib/pdf-uploader')
vi.mock('@/lib/prisma', () => ({
  db: {
    invoice: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('PDF Generation Handler', () => {
  const mockJob: Job = {
    id: 'job-1',
    type: 'PDF_GENERATION',
    data: {
      invoiceId: 'invoice-123',
      userId: 'user-456',
    },
    status: 'active',
    attempts: 1,
    maxAttempts: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

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
      pan: 'ABCDE1234F',
      address: '123 Test Street, Bangalore',
    },
    client: {
      id: 'client-789',
      name: 'Test Client',
      email: 'client@example.com',
      address: '456 Client Street, USA',
      country: 'United States',
    },
    lineItems: [
      {
        id: 'item-1',
        description: 'Consulting Services',
        quantity: 10,
        rate: 100,
        amount: 1000,
        serviceCode: '99831400',
      },
    ],
    lut: {
      lutNumber: 'AD290124000001',
      lutDate: new Date('2024-01-01'),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate PDF for valid invoice', async () => {
    const mockPdfBuffer = Buffer.from('mock-pdf-content')
    const mockPdfUrl = 'https://example.com/invoices/invoice-123.pdf'

    vi.mocked(db.invoice.findUniqueOrThrow).mockResolvedValue(mockInvoice as any)
    vi.mocked(pdfGenerator.generateInvoicePDF).mockResolvedValue(mockPdfBuffer)
    vi.mocked(pdfUploader.uploadPDF).mockResolvedValue(mockPdfUrl)
    vi.mocked(db.invoice.update).mockResolvedValue({
      ...mockInvoice,
      pdfUrl: mockPdfUrl,
    } as any)

    const result = await pdfGenerationHandler(mockJob)

    // Verify database queries - should include payments
    expect(db.invoice.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'invoice-123', userId: 'user-456' },
      include: {
        user: true,
        client: true,
        lineItems: true,
        lut: true,
        payments: {
          orderBy: {
            paymentDate: 'asc'
          }
        },
      },
    })

    // Verify PDF generation
    expect(pdfGenerator.generateInvoicePDF).toHaveBeenCalledWith(mockInvoice, mockInvoice.user)

    // Verify PDF upload with timestamp in filename
    expect(pdfUploader.uploadPDF).toHaveBeenCalledWith(
      mockPdfBuffer,
      expect.stringMatching(/^invoice-123-\d+\.pdf$/)
    )

    // Verify invoice update with pdfStatus
    expect(db.invoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-123' },
      data: {
        pdfUrl: mockPdfUrl,
        pdfStatus: 'completed',
        pdfGeneratedAt: expect.any(Date),
        pdfError: null,
      },
    })

    // Verify result
    expect(result).toEqual({
      success: true,
      pdfUrl: mockPdfUrl,
      invoiceId: 'invoice-123',
    })
  })

  it('should handle invoice not found error', async () => {
    vi.mocked(db.invoice.findUniqueOrThrow).mockRejectedValue(
      new Error('Invoice not found')
    )

    await expect(pdfGenerationHandler(mockJob)).rejects.toThrow(
      'Invoice not found'
    )

    expect(pdfGenerator.generateInvoicePDF).not.toHaveBeenCalled()
    expect(pdfUploader.uploadPDF).not.toHaveBeenCalled()

    // Should call db.invoice.update with pdfStatus='failed'
    expect(db.invoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-123' },
      data: {
        pdfStatus: 'failed',
        pdfError: expect.stringContaining('Invoice not found'),
      }
    })
  })

  it('should handle PDF generation error', async () => {
    vi.mocked(db.invoice.findUniqueOrThrow).mockResolvedValue(mockInvoice as any)
    vi.mocked(pdfGenerator.generateInvoicePDF).mockRejectedValue(
      new Error('PDF generation failed')
    )

    await expect(pdfGenerationHandler(mockJob)).rejects.toThrow(
      'PDF generation failed'
    )

    expect(pdfUploader.uploadPDF).not.toHaveBeenCalled()

    // Should call db.invoice.update with pdfStatus='failed'
    expect(db.invoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-123' },
      data: {
        pdfStatus: 'failed',
        pdfError: expect.stringContaining('PDF generation failed'),
      }
    })
  })

  it('should handle PDF upload error', async () => {
    const mockPdfBuffer = Buffer.from('mock-pdf-content')

    vi.mocked(db.invoice.findUniqueOrThrow).mockResolvedValue(mockInvoice as any)
    vi.mocked(pdfGenerator.generateInvoicePDF).mockResolvedValue(mockPdfBuffer)
    vi.mocked(pdfUploader.uploadPDF).mockRejectedValue(
      new Error('Upload failed')
    )

    await expect(pdfGenerationHandler(mockJob)).rejects.toThrow('Upload failed')

    // Should call db.invoice.update with pdfStatus='failed'
    expect(db.invoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-123' },
      data: {
        pdfStatus: 'failed',
        pdfError: expect.stringContaining('Upload failed'),
      }
    })
  })

  it('should update job progress during processing', async () => {
    const mockPdfBuffer = Buffer.from('mock-pdf-content')
    const mockPdfUrl = 'https://example.com/invoices/invoice-123.pdf'

    vi.mocked(db.invoice.findUniqueOrThrow).mockResolvedValue(mockInvoice as any)
    vi.mocked(pdfGenerator.generateInvoicePDF).mockResolvedValue(mockPdfBuffer)
    vi.mocked(pdfUploader.uploadPDF).mockResolvedValue(mockPdfUrl)
    vi.mocked(db.invoice.update).mockResolvedValue({
      ...mockInvoice,
      pdfUrl: mockPdfUrl,
    } as any)

    // Create a job with progress tracking
    const jobWithProgress = {
      ...mockJob,
      updateProgress: vi.fn(),
    }

    await pdfGenerationHandler(jobWithProgress as any)

    // Verify progress updates
    expect(jobWithProgress.updateProgress).toHaveBeenCalledWith(25) // Fetched invoice
    expect(jobWithProgress.updateProgress).toHaveBeenCalledWith(50) // Generated PDF
    expect(jobWithProgress.updateProgress).toHaveBeenCalledWith(75) // Uploaded PDF
    expect(jobWithProgress.updateProgress).toHaveBeenCalledWith(100) // Completed
  })
})