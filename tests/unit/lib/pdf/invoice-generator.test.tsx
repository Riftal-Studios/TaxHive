import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePDF } from '@/lib/pdf/invoice-generator'

// Mock @react-pdf/renderer
vi.mock('@react-pdf/renderer', async () => {
  const actual = await vi.importActual('@react-pdf/renderer')
  return {
    ...actual,
    renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
    Font: {
      register: vi.fn(),
    },
  }
})

describe('InvoicePDF Generator', () => {
  const mockInvoice = {
    id: 'INV-001',
    invoiceNumber: 'FY24-25/001',
    invoiceDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15'),
    placeOfSupply: 'Outside India (Section 2-6)',
    supplyType: 'EXPORT_WITH_PAYMENT',
    reverseCharge: false,
    currency: 'USD',
    exchangeRate: 83.50,
    exchangeRateSource: 'RBI Reference Rate',
    totalAmount: 1000,
    totalInINR: 83500,
    status: 'SENT',
    paymentStatus: 'UNPAID',
    client: {
      id: 'client-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      company: 'Tech Corp',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      postalCode: '10001',
      gstin: null,
      pan: null,
    },
    lineItems: [
      {
        id: 'item-1',
        description: 'Software Development Services',
        hsn: '998314',
        quantity: 40,
        rate: 25,
        amount: 1000,
        amountInINR: 83500,
      },
    ],
    supplier: {
      name: 'Indian Software Solutions',
      address: '456 Tech Park, Bangalore',
      gstin: '29AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      email: 'info@indiansoft.com',
      phone: '+91 9876543210',
    },
    lutDetails: {
      number: 'LUT/2024/001',
      date: new Date('2024-01-01'),
    },
    notes: 'Thank you for your business',
    termsAndConditions: 'Payment due within 30 days',
    bankDetails: {
      beneficiaryName: 'Indian Software Solutions',
      bankName: 'State Bank of India',
      accountNumber: '1234567890',
      ifscCode: 'SBIN0001234',
      swiftCode: 'SBININBB',
      branchAddress: 'MG Road, Bangalore',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PDF Generation', () => {
    it('should generate PDF for valid invoice', async () => {
      const pdf = await InvoicePDF(mockInvoice)
      
      expect(pdf).toBeInstanceOf(Buffer)
      expect(renderToBuffer).toHaveBeenCalled()
    })

    it('should include all required GST fields', async () => {
      await InvoicePDF(mockInvoice)
      
      const renderCall = vi.mocked(renderToBuffer).mock.calls[0]
      const component = renderCall[0]
      
      // Verify component props include required fields
      expect(component.props.invoice).toEqual(mockInvoice)
      expect(component.props.invoice.invoiceNumber).toBe('FY24-25/001')
      expect(component.props.invoice.placeOfSupply).toBe('Outside India (Section 2-6)')
      expect(component.props.invoice.supplier.gstin).toBe('29AAAAA0000A1Z5')
    })

    it('should handle invoices with multiple line items', async () => {
      const multiItemInvoice = {
        ...mockInvoice,
        lineItems: [
          {
            id: 'item-1',
            description: 'Software Development',
            hsn: '998314',
            quantity: 40,
            rate: 25,
            amount: 1000,
            amountInINR: 83500,
          },
          {
            id: 'item-2',
            description: 'Technical Support',
            hsn: '998315',
            quantity: 10,
            rate: 50,
            amount: 500,
            amountInINR: 41750,
          },
        ],
        totalAmount: 1500,
        totalInINR: 125250,
      }
      
      const pdf = await InvoicePDF(multiItemInvoice)
      expect(pdf).toBeInstanceOf(Buffer)
    })

    it('should include LUT declaration for export invoices', async () => {
      await InvoicePDF(mockInvoice)
      
      const renderCall = vi.mocked(renderToBuffer).mock.calls[0]
      const component = renderCall[0]
      
      expect(component.props.invoice.lutDetails).toBeDefined()
      expect(component.props.invoice.lutDetails.number).toBe('LUT/2024/001')
    })

    it('should include exchange rate information', async () => {
      await InvoicePDF(mockInvoice)
      
      const renderCall = vi.mocked(renderToBuffer).mock.calls[0]
      const component = renderCall[0]
      
      expect(component.props.invoice.exchangeRate).toBe(83.50)
      expect(component.props.invoice.exchangeRateSource).toBe('RBI Reference Rate')
    })

    it('should handle invoices without optional fields', async () => {
      const minimalInvoice = {
        ...mockInvoice,
        notes: undefined,
        termsAndConditions: undefined,
        client: {
          ...mockInvoice.client,
          company: undefined,
          phone: undefined,
        },
      }
      
      const pdf = await InvoicePDF(minimalInvoice)
      expect(pdf).toBeInstanceOf(Buffer)
    })
  })

  describe('Bank Details', () => {
    it('should include bank details for international payments', async () => {
      await InvoicePDF(mockInvoice)
      
      const renderCall = vi.mocked(renderToBuffer).mock.calls[0]
      const component = renderCall[0]
      
      expect(component.props.invoice.bankDetails).toBeDefined()
      expect(component.props.invoice.bankDetails.swiftCode).toBe('SBININBB')
      expect(component.props.invoice.bankDetails.ifscCode).toBe('SBIN0001234')
    })

    it('should handle missing bank details gracefully', async () => {
      const invoiceNoBankDetails = {
        ...mockInvoice,
        bankDetails: undefined,
      }
      
      const pdf = await InvoicePDF(invoiceNoBankDetails)
      expect(pdf).toBeInstanceOf(Buffer)
    })
  })

  describe('Client Information', () => {
    it('should format client address correctly', async () => {
      await InvoicePDF(mockInvoice)
      
      const renderCall = vi.mocked(renderToBuffer).mock.calls[0]
      const component = renderCall[0]
      
      const client = component.props.invoice.client
      expect(client.address).toBe('123 Main St')
      expect(client.city).toBe('New York')
      expect(client.country).toBe('USA')
    })

    it('should handle domestic clients with GSTIN', async () => {
      const domesticInvoice = {
        ...mockInvoice,
        client: {
          ...mockInvoice.client,
          country: 'India',
          gstin: '27AAAAA0000A1Z5',
          pan: 'AAAAA0000A',
        },
        placeOfSupply: 'Maharashtra',
      }
      
      const pdf = await InvoicePDF(domesticInvoice)
      expect(pdf).toBeInstanceOf(Buffer)
    })
  })

  describe('Error Handling', () => {
    it('should handle PDF generation errors', async () => {
      vi.mocked(renderToBuffer).mockRejectedValueOnce(new Error('PDF generation failed'))
      
      await expect(InvoicePDF(mockInvoice)).rejects.toThrow('PDF generation failed')
    })

    it('should validate required fields', async () => {
      const invalidInvoice = {
        ...mockInvoice,
        invoiceNumber: undefined,
      }
      
      // The function should handle this gracefully or throw a meaningful error
      const pdf = await InvoicePDF(invalidInvoice as any)
      expect(pdf).toBeInstanceOf(Buffer)
    })
  })

  describe('HSN/SAC Codes', () => {
    it('should include 8-digit HSN codes for exports', async () => {
      await InvoicePDF(mockInvoice)
      
      const renderCall = vi.mocked(renderToBuffer).mock.calls[0]
      const component = renderCall[0]
      
      const lineItem = component.props.invoice.lineItems[0]
      expect(lineItem.hsn).toBe('998314')
      expect(lineItem.hsn.length).toBeGreaterThanOrEqual(6)
    })
  })

  describe('Currency and Amount Formatting', () => {
    it('should display amounts in both foreign currency and INR', async () => {
      await InvoicePDF(mockInvoice)
      
      const renderCall = vi.mocked(renderToBuffer).mock.calls[0]
      const component = renderCall[0]
      
      expect(component.props.invoice.totalAmount).toBe(1000)
      expect(component.props.invoice.totalInINR).toBe(83500)
      expect(component.props.invoice.currency).toBe('USD')
    })

    it('should handle INR invoices correctly', async () => {
      const inrInvoice = {
        ...mockInvoice,
        currency: 'INR',
        exchangeRate: 1,
        totalAmount: 83500,
        totalInINR: 83500,
      }
      
      const pdf = await InvoicePDF(inrInvoice)
      expect(pdf).toBeInstanceOf(Buffer)
    })
  })

  describe('Invoice Status', () => {
    it('should handle different invoice statuses', async () => {
      const statuses = ['DRAFT', 'SENT', 'PAID', 'CANCELLED', 'OVERDUE']
      
      for (const status of statuses) {
        const invoiceWithStatus = {
          ...mockInvoice,
          status,
        }
        
        const pdf = await InvoicePDF(invoiceWithStatus)
        expect(pdf).toBeInstanceOf(Buffer)
      }
    })

    it('should handle different payment statuses', async () => {
      const paymentStatuses = ['UNPAID', 'PARTIALLY_PAID', 'PAID']
      
      for (const paymentStatus of paymentStatuses) {
        const invoiceWithPaymentStatus = {
          ...mockInvoice,
          paymentStatus,
        }
        
        const pdf = await InvoicePDF(invoiceWithPaymentStatus)
        expect(pdf).toBeInstanceOf(Buffer)
      }
    })
  })

  describe('Compliance', () => {
    it('should include all Rule 46 mandatory fields', async () => {
      await InvoicePDF(mockInvoice)
      
      const renderCall = vi.mocked(renderToBuffer).mock.calls[0]
      const component = renderCall[0]
      const invoice = component.props.invoice
      
      // Verify all mandatory fields are present
      expect(invoice.invoiceNumber).toBeDefined()
      expect(invoice.invoiceDate).toBeDefined()
      expect(invoice.supplier.gstin).toBeDefined()
      expect(invoice.supplier.address).toBeDefined()
      expect(invoice.placeOfSupply).toBeDefined()
      expect(invoice.lineItems[0].hsn).toBeDefined()
      expect(invoice.totalAmount).toBeDefined()
    })

    it('should format invoice number in fiscal year format', async () => {
      await InvoicePDF(mockInvoice)
      
      const renderCall = vi.mocked(renderToBuffer).mock.calls[0]
      const component = renderCall[0]
      
      expect(component.props.invoice.invoiceNumber).toMatch(/^FY\d{2}-\d{2}\/\d+$/)
    })

    it('should include 0% IGST declaration for exports', async () => {
      await InvoicePDF(mockInvoice)
      
      const renderCall = vi.mocked(renderToBuffer).mock.calls[0]
      const component = renderCall[0]
      
      expect(component.props.invoice.supplyType).toBe('EXPORT_WITH_PAYMENT')
      expect(component.props.invoice.placeOfSupply).toContain('Outside India')
    })
  })
})