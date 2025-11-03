import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateInvoicePDF } from '@/lib/pdf-generator'
import type { Invoice, InvoiceItem, User, Client, LUT } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

// Create mock functions
const mockSetContent = vi.fn()
const mockPdf = vi.fn(() => Buffer.from('mock-pdf-content'))
const mockPageClose = vi.fn()

const mockPage = {
  setContent: mockSetContent,
  pdf: mockPdf,
  close: mockPageClose,
}

const mockBrowser = {
  newPage: vi.fn(() => mockPage),
}

// Mock browser pool
vi.mock('@/lib/browser-pool', () => ({
  getBrowserPool: vi.fn(() => ({
    execute: vi.fn(async (fn) => await fn(mockBrowser)),
  })),
}))

describe('PDF Invoice Generator', () => {
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test Freelancer',
    gstin: '29ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    address: '123 Business St, Bangalore, Karnataka 560001',
    emailVerified: null,
    onboardingCompleted: true,
    onboardingStep: 'complete',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockClient: Client = {
    id: 'client-1',
    userId: 'user-1',
    name: 'International Corp',
    email: 'client@example.com',
    company: 'International Corp Ltd',
    address: '456 Global Ave, New York, NY 10001',
    country: 'USA',
    phone: '+1-555-0123',
    taxId: 'US-TAX-123',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockLUT: LUT = {
    id: 'lut-1',
    userId: 'user-1',
    lutNumber: 'LUT/2024/001',
    lutDate: new Date('2024-01-01'),
    validFrom: new Date('2024-01-01'),
    validTill: new Date('2025-12-31'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockInvoice: Invoice & {
    lineItems: InvoiceItem[]
    client: Client
    lut: LUT | null
  } = {
    id: 'inv-1',
    userId: 'user-1',
    clientId: 'client-1',
    invoiceNumber: 'FY24-25/001',
    invoiceDate: new Date('2024-04-15'),
    dueDate: new Date('2024-05-15'),
    status: 'draft',
    placeOfSupply: 'Outside India (Section 2-6)',
    serviceCode: '99831000',
    lutId: 'lut-1',
    igstRate: new Decimal(0),
    currency: 'USD',
    exchangeRate: new Decimal(83.5),
    exchangeSource: 'RBI Reference Rate',
    subtotal: new Decimal(5000),
    igstAmount: new Decimal(0),
    totalAmount: new Decimal(5000),
    totalInINR: new Decimal(417500), // 5000 * 83.5
    description: 'Development services for April 2024',
    paymentTerms: 'Net 30 days',
    bankDetails: 'Account: 1234567890, IFSC: SBIN0001234',
    pdfUrl: null,
    notes: 'Thank you for your business',
    paymentStatus: 'UNPAID',
    amountPaid: new Decimal(0),
    balanceDue: new Decimal(5000),
    createdAt: new Date(),
    updatedAt: new Date(),
    lineItems: [
      {
        id: 'item-1',
        invoiceId: 'inv-1',
        description: 'Website Development - Phase 1',
        serviceCode: '99831000',
        quantity: new Decimal(1),
        rate: new Decimal(3000),
        amount: new Decimal(3000),
      },
      {
        id: 'item-2',
        invoiceId: 'inv-1',
        description: 'API Integration Services',
        serviceCode: '99831000',
        quantity: new Decimal(40),
        rate: new Decimal(50),
        amount: new Decimal(2000),
      },
    ],
    client: mockClient,
    lut: mockLUT,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSetContent.mockClear()
    mockPdf.mockClear()
    mockPageClose.mockClear()
  })

  it('should generate PDF with all GST-compliant fields', async () => {
    const pdf = await generateInvoicePDF(mockInvoice, mockUser)

    expect(pdf).toBeInstanceOf(Buffer)
    expect(pdf.length).toBeGreaterThan(0)
  })

  it('should include mandatory GST invoice fields', async () => {
    await generateInvoicePDF(mockInvoice, mockUser)

    // Verify HTML content includes all mandatory fields
    expect(mockSetContent).toHaveBeenCalled()
    const htmlContent = mockSetContent.mock.calls[0][0]
    
    // Check for supplier GSTIN
    expect(htmlContent).toContain('GSTIN: 29ABCDE1234F1Z5')
    
    // Check for invoice number
    expect(htmlContent).toContain('Invoice #FY24-25/001')
    
    // Check for HSN/SAC code
    expect(htmlContent).toContain('99831000')
    
    // Check for place of supply
    expect(htmlContent).toContain('Outside India (Section 2-6)')
    
    // Check for 0% IGST declaration
    expect(htmlContent).toContain('IGST @ 0%')
    
    // Check for LUT declaration
    expect(htmlContent).toContain('SUPPLY MEANT FOR EXPORT UNDER LUT NO LUT/2024/001')
    expect(htmlContent).toContain('TAX NOT PAYABLE')
  })

  it('should show exchange rate information', async () => {
    await generateInvoicePDF(mockInvoice, mockUser)

    const htmlContent = mockSetContent.mock.calls[0][0]
    
    // Check for exchange rate
    expect(htmlContent).toContain('1 USD = ₹83.50')
    expect(htmlContent).toContain('RBI Reference Rate')
  })

  it('should calculate and show amounts in both currencies', async () => {
    await generateInvoicePDF(mockInvoice, mockUser)

    const htmlContent = mockSetContent.mock.calls[0][0]
    
    // Check for USD amounts
    expect(htmlContent).toContain('$3,000.00')
    expect(htmlContent).toContain('$2,000.00')
    expect(htmlContent).toContain('$5,000.00')
    
    // Check for INR amounts
    expect(htmlContent).toContain('₹2,50,500.00')
    expect(htmlContent).toContain('₹1,67,000.00')
    expect(htmlContent).toContain('₹4,17,500.00')
  })

  it('should handle invoice without LUT', async () => {
    const invoiceWithoutLUT = {
      ...mockInvoice,
      lutId: null,
      lut: null,
      igstRate: new Decimal(18),
      igstAmount: new Decimal(900),
      totalAmount: new Decimal(5900),
    }

    await generateInvoicePDF(invoiceWithoutLUT, mockUser)

    const htmlContent = mockSetContent.mock.calls[0][0]
    
    // Should show IGST rate instead of LUT
    expect(htmlContent).toContain('IGST @ 18%')
    expect(htmlContent).not.toContain('LUT NO')
  })

  it('should include all line items with proper formatting', async () => {
    await generateInvoicePDF(mockInvoice, mockUser)

    const htmlContent = mockSetContent.mock.calls[0][0]
    
    // Check line items
    expect(htmlContent).toContain('Website Development - Phase 1')
    expect(htmlContent).toContain('API Integration Services')
    expect(htmlContent).toContain('40') // quantity
  })

  it('should handle PDF generation errors gracefully', async () => {
    const { getBrowserPool } = await import('@/lib/browser-pool')
    vi.mocked(getBrowserPool).mockReturnValueOnce({
      execute: vi.fn().mockRejectedValueOnce(new Error('Browser pool error')),
    } as any)

    await expect(generateInvoicePDF(mockInvoice, mockUser))
      .rejects.toThrow('Failed to generate PDF')
  })
})