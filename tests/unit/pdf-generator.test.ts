import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateInvoicePDF } from '@/lib/pdf-generator'
import type { Invoice, InvoiceItem, User, Client, LUT } from '@prisma/client'
import { Prisma } from '@prisma/client'
const Decimal = Prisma.Decimal

// Create mock function for Gotenberg client
const mockHtmlToPdf = vi.fn(() => Promise.resolve(Buffer.from('mock-pdf-content')))
const mockIsHealthy = vi.fn(() => Promise.resolve(true))

// Track the HTML passed to htmlToPdf for assertion
let capturedHtml = ''

// Mock gotenberg client
vi.mock('@/lib/gotenberg-client', () => ({
  getGotenbergClient: vi.fn(() => ({
    htmlToPdf: vi.fn(async (html: string) => {
      capturedHtml = html
      return mockHtmlToPdf()
    }),
    isHealthy: mockIsHealthy,
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
    password: null,
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
    currency: 'USD',
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
    exchangeRateOverridden: false,
    exchangeRateOverriddenAt: null,
    subtotal: new Decimal(5000),
    igstAmount: new Decimal(0),
    totalAmount: new Decimal(5000),
    totalInINR: new Decimal(417500), // 5000 * 83.5
    description: 'Development services for April 2024',
    paymentTerms: 'Net 30 days',
    bankDetails: 'Account: 1234567890, IFSC: SBIN0001234',
    pdfUrl: null,
    pdfStatus: 'pending',
    pdfError: null,
    pdfGeneratedAt: null,
    pdfJobId: null,
    publicAccessToken: null,
    tokenExpiresAt: null,
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
    capturedHtml = ''
    mockHtmlToPdf.mockClear()
    mockHtmlToPdf.mockResolvedValue(Buffer.from('mock-pdf-content'))
  })

  it('should generate PDF with all GST-compliant fields', async () => {
    const pdf = await generateInvoicePDF(mockInvoice, mockUser)

    expect(pdf).toBeInstanceOf(Buffer)
    expect(pdf.length).toBeGreaterThan(0)
  })

  it('should include mandatory GST invoice fields', async () => {
    await generateInvoicePDF(mockInvoice, mockUser)

    // Verify HTML content includes all mandatory fields
    expect(capturedHtml).toBeTruthy()

    // Check for supplier GSTIN
    expect(capturedHtml).toContain('GSTIN: 29ABCDE1234F1Z5')

    // Check for invoice number
    expect(capturedHtml).toContain('Invoice #FY24-25/001')

    // Check for HSN/SAC code
    expect(capturedHtml).toContain('99831000')

    // Check for place of supply
    expect(capturedHtml).toContain('Outside India (Section 2-6)')

    // Check for 0% IGST declaration
    expect(capturedHtml).toContain('IGST @ 0%')

    // Check for LUT declaration
    expect(capturedHtml).toContain('SUPPLY MEANT FOR EXPORT UNDER LUT NO LUT/2024/001')
    expect(capturedHtml).toContain('TAX NOT PAYABLE')
  })

  it('should show exchange rate information', async () => {
    await generateInvoicePDF(mockInvoice, mockUser)

    // Check for exchange rate
    expect(capturedHtml).toContain('1 USD = ₹83.50')
    expect(capturedHtml).toContain('RBI Reference Rate')
  })

  it('should calculate and show amounts in both currencies', async () => {
    await generateInvoicePDF(mockInvoice, mockUser)

    // Check for USD amounts
    expect(capturedHtml).toContain('$3,000.00')
    expect(capturedHtml).toContain('$2,000.00')
    expect(capturedHtml).toContain('$5,000.00')

    // Check for INR amounts
    expect(capturedHtml).toContain('₹2,50,500.00')
    expect(capturedHtml).toContain('₹1,67,000.00')
    expect(capturedHtml).toContain('₹4,17,500.00')
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

    // Should show IGST rate instead of LUT
    expect(capturedHtml).toContain('IGST @ 18%')
    expect(capturedHtml).not.toContain('LUT NO')
  })

  it('should include all line items with proper formatting', async () => {
    await generateInvoicePDF(mockInvoice, mockUser)

    // Check line items
    expect(capturedHtml).toContain('Website Development - Phase 1')
    expect(capturedHtml).toContain('API Integration Services')
    expect(capturedHtml).toContain('40') // quantity
  })

  it('should handle Gotenberg errors gracefully', async () => {
    mockHtmlToPdf.mockRejectedValueOnce(new Error('Gotenberg error (500): Internal server error'))

    await expect(generateInvoicePDF(mockInvoice, mockUser))
      .rejects.toThrow('Failed to generate PDF')
  })

  it('should handle Gotenberg timeout errors', async () => {
    mockHtmlToPdf.mockRejectedValueOnce(new Error('aborted'))

    await expect(generateInvoicePDF(mockInvoice, mockUser))
      .rejects.toThrow('Failed to generate PDF')
  })
})
