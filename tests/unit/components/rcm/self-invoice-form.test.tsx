import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelfInvoiceForm } from '@/components/rcm/self-invoice-form-simple'
import { api } from '@/lib/trpc/client'

// Mock tRPC
vi.mock('@/lib/trpc/client', () => ({
  api: {
    rcm: {
      createTransaction: {
        useMutation: vi.fn(),
      },
      generateSelfInvoice: {
        useMutation: vi.fn(),
      },
      getSuppliers: {
        useQuery: vi.fn(),
      },
      getServiceTypes: {
        useQuery: vi.fn(),
      },
    },
  },
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

describe('SelfInvoiceForm', () => {
  const mockSuppliers = [
    {
      id: 'sup1',
      name: 'Test Supplier 1',
      gstin: '29ABCDE1234F1Z5',
      address: '123 Test Street',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
    },
    {
      id: 'sup2',
      name: 'Test Supplier 2',
      gstin: '27FGHIJ5678K2L6',
      address: '456 Another Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
  ]

  const mockServiceTypes = [
    { id: 'st1', name: 'Professional Services', sacCode: '998311' },
    { id: 'st2', name: 'IT Services', sacCode: '998313' },
    { id: 'st3', name: 'Consulting Services', sacCode: '998312' },
  ]

  const mockCreateTransaction = vi.fn()
  const mockGenerateSelfInvoice = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mocks
    ;(api.rcm.getSuppliers.useQuery as any).mockReturnValue({
      data: mockSuppliers,
      isLoading: false,
      error: null,
    })

    ;(api.rcm.getServiceTypes.useQuery as any).mockReturnValue({
      data: mockServiceTypes,
      isLoading: false,
      error: null,
    })

    ;(api.rcm.createTransaction.useMutation as any).mockReturnValue({
      mutateAsync: mockCreateTransaction,
      isLoading: false,
      error: null,
    })

    ;(api.rcm.generateSelfInvoice.useMutation as any).mockReturnValue({
      mutateAsync: mockGenerateSelfInvoice,
      isLoading: false,
      error: null,
    })
  })

  describe('Form Rendering', () => {
    it('should render all required form fields', () => {
      render(<SelfInvoiceForm />)

      // Check for supplier selection
      expect(screen.getByLabelText(/supplier/i)).toBeInTheDocument()

      // Check for service type selection
      expect(screen.getByLabelText(/service type/i)).toBeInTheDocument()

      // Check for amount fields
      expect(screen.getByLabelText(/taxable amount/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/cgst amount/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/sgst amount/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/igst amount/i)).toBeInTheDocument()

      // Check for date fields
      expect(screen.getByLabelText(/invoice date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/payment date/i)).toBeInTheDocument()

      // Check for description
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()

      // Check for submit button
      expect(screen.getByRole('button', { name: /generate self-invoice/i })).toBeInTheDocument()
    })

    it('should render preview button', () => {
      render(<SelfInvoiceForm />)
      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
    })

    it('should load and display suppliers', async () => {
      render(<SelfInvoiceForm />)

      await waitFor(() => {
        const supplierSelect = screen.getByLabelText(/supplier/i)
        expect(supplierSelect).toBeInTheDocument()
      })

      // Check if suppliers are loaded in the select
      fireEvent.click(screen.getByLabelText(/supplier/i))
      
      await waitFor(() => {
        expect(screen.getByText('Test Supplier 1')).toBeInTheDocument()
        expect(screen.getByText('Test Supplier 2')).toBeInTheDocument()
      })
    })

    it('should load and display service types', async () => {
      render(<SelfInvoiceForm />)

      await waitFor(() => {
        const serviceSelect = screen.getByLabelText(/service type/i)
        expect(serviceSelect).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText(/service type/i))
      
      await waitFor(() => {
        expect(screen.getByText('Professional Services')).toBeInTheDocument()
        expect(screen.getByText('IT Services')).toBeInTheDocument()
        expect(screen.getByText('Consulting Services')).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    it('should require supplier selection', async () => {
      render(<SelfInvoiceForm />)
      
      const submitButton = screen.getByRole('button', { name: /generate self-invoice/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/supplier is required/i)).toBeInTheDocument()
      })
    })

    it('should require service type selection', async () => {
      render(<SelfInvoiceForm />)
      
      const submitButton = screen.getByRole('button', { name: /generate self-invoice/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/service type is required/i)).toBeInTheDocument()
      })
    })

    it('should require taxable amount', async () => {
      render(<SelfInvoiceForm />)
      
      const submitButton = screen.getByRole('button', { name: /generate self-invoice/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/taxable amount is required/i)).toBeInTheDocument()
      })
    })

    it('should validate minimum taxable amount', async () => {
      render(<SelfInvoiceForm />)
      
      const taxableInput = screen.getByLabelText(/taxable amount/i)
      await userEvent.type(taxableInput, '-100')
      
      const submitButton = screen.getByRole('button', { name: /generate self-invoice/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/must be greater than 0/i)).toBeInTheDocument()
      })
    })

    it('should auto-calculate GST amounts based on supply type', async () => {
      render(<SelfInvoiceForm />)
      
      const taxableInput = screen.getByLabelText(/taxable amount/i)
      await userEvent.type(taxableInput, '10000')
      
      // Select intra-state supply (should calculate CGST/SGST)
      const supplyTypeRadio = screen.getByLabelText(/intra-state/i)
      fireEvent.click(supplyTypeRadio)

      await waitFor(() => {
        const cgstInput = screen.getByLabelText(/cgst amount/i) as HTMLInputElement
        const sgstInput = screen.getByLabelText(/sgst amount/i) as HTMLInputElement
        const igstInput = screen.getByLabelText(/igst amount/i) as HTMLInputElement
        
        expect(cgstInput.value).toBe('900') // 9% of 10000
        expect(sgstInput.value).toBe('900') // 9% of 10000
        expect(igstInput.value).toBe('0')
      })
    })

    it('should calculate IGST for inter-state supply', async () => {
      render(<SelfInvoiceForm />)
      
      const taxableInput = screen.getByLabelText(/taxable amount/i)
      await userEvent.type(taxableInput, '10000')
      
      // Select inter-state supply (should calculate IGST)
      const supplyTypeRadio = screen.getByLabelText(/inter-state/i)
      fireEvent.click(supplyTypeRadio)

      await waitFor(() => {
        const cgstInput = screen.getByLabelText(/cgst amount/i) as HTMLInputElement
        const sgstInput = screen.getByLabelText(/sgst amount/i) as HTMLInputElement
        const igstInput = screen.getByLabelText(/igst amount/i) as HTMLInputElement
        
        expect(cgstInput.value).toBe('0')
        expect(sgstInput.value).toBe('0')
        expect(igstInput.value).toBe('1800') // 18% of 10000
      })
    })
  })

  describe('Form Submission', () => {
    it('should create transaction and generate self-invoice on valid submission', async () => {
      const mockTransactionId = 'trans123'
      const mockInvoiceId = 'inv123'
      
      mockCreateTransaction.mockResolvedValue({ id: mockTransactionId })
      mockGenerateSelfInvoice.mockResolvedValue({ id: mockInvoiceId })

      render(<SelfInvoiceForm />)
      
      // Fill form
      const supplierSelect = screen.getByLabelText(/supplier/i)
      fireEvent.change(supplierSelect, { target: { value: 'sup1' } })
      
      const serviceSelect = screen.getByLabelText(/service type/i)
      fireEvent.change(serviceSelect, { target: { value: 'st1' } })
      
      const taxableInput = screen.getByLabelText(/taxable amount/i)
      await userEvent.type(taxableInput, '10000')
      
      const descriptionInput = screen.getByLabelText(/description/i)
      await userEvent.type(descriptionInput, 'Test service description')
      
      const submitButton = screen.getByRole('button', { name: /generate self-invoice/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            supplierId: 'sup1',
            serviceTypeId: 'st1',
            taxableAmount: 10000,
            description: 'Test service description',
          })
        )
        
        expect(mockGenerateSelfInvoice).toHaveBeenCalledWith({
          transactionId: mockTransactionId,
        })
      })
    })

    it('should show success message after successful submission', async () => {
      mockCreateTransaction.mockResolvedValue({ id: 'trans123' })
      mockGenerateSelfInvoice.mockResolvedValue({ id: 'inv123' })

      render(<SelfInvoiceForm />)
      
      // Fill minimum required fields
      const supplierSelect = screen.getByLabelText(/supplier/i)
      fireEvent.change(supplierSelect, { target: { value: 'sup1' } })
      
      const serviceSelect = screen.getByLabelText(/service type/i)
      fireEvent.change(serviceSelect, { target: { value: 'st1' } })
      
      const taxableInput = screen.getByLabelText(/taxable amount/i)
      await userEvent.type(taxableInput, '10000')
      
      const submitButton = screen.getByRole('button', { name: /generate self-invoice/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/self-invoice generated successfully/i)).toBeInTheDocument()
      })
    })

    it('should handle submission errors gracefully', async () => {
      mockCreateTransaction.mockRejectedValue(new Error('Failed to create transaction'))

      render(<SelfInvoiceForm />)
      
      // Fill form
      const supplierSelect = screen.getByLabelText(/supplier/i)
      fireEvent.change(supplierSelect, { target: { value: 'sup1' } })
      
      const serviceSelect = screen.getByLabelText(/service type/i)
      fireEvent.change(serviceSelect, { target: { value: 'st1' } })
      
      const taxableInput = screen.getByLabelText(/taxable amount/i)
      await userEvent.type(taxableInput, '10000')
      
      const submitButton = screen.getByRole('button', { name: /generate self-invoice/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to create transaction/i)).toBeInTheDocument()
      })
    })
  })

  describe('Preview Functionality', () => {
    it('should show preview modal when preview button is clicked', async () => {
      render(<SelfInvoiceForm />)
      
      // Fill form
      const supplierSelect = screen.getByLabelText(/supplier/i)
      fireEvent.change(supplierSelect, { target: { value: 'sup1' } })
      
      const serviceSelect = screen.getByLabelText(/service type/i)
      fireEvent.change(serviceSelect, { target: { value: 'st1' } })
      
      const taxableInput = screen.getByLabelText(/taxable amount/i)
      await userEvent.type(taxableInput, '10000')
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)

      await waitFor(() => {
        expect(screen.getByText(/self-invoice preview/i)).toBeInTheDocument()
        expect(screen.getByText(/Test Supplier 1/)).toBeInTheDocument()
        expect(screen.getByText(/29ABCDE1234F1Z5/)).toBeInTheDocument()
        expect(screen.getByText(/Professional Services/)).toBeInTheDocument()
        expect(screen.getByText(/10,000/)).toBeInTheDocument()
      })
    })

    it('should close preview modal when close button is clicked', async () => {
      render(<SelfInvoiceForm />)
      
      // Open preview
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      await waitFor(() => {
        expect(screen.getByText(/self-invoice preview/i)).toBeInTheDocument()
      })
      
      // Close preview
      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/self-invoice preview/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Loading States', () => {
    it('should show loading state while fetching suppliers', () => {
      ;(api.rcm.getSuppliers.useQuery as any).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      })

      render(<SelfInvoiceForm />)
      
      expect(screen.getByText(/loading suppliers/i)).toBeInTheDocument()
    })

    it('should show loading state while submitting form', async () => {
      ;(api.rcm.createTransaction.useMutation as any).mockReturnValue({
        mutateAsync: mockCreateTransaction,
        isLoading: true,
        error: null,
      })

      render(<SelfInvoiceForm />)
      
      const submitButton = screen.getByRole('button', { name: /generating/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    it('should display error when suppliers fail to load', () => {
      ;(api.rcm.getSuppliers.useQuery as any).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load suppliers'),
      })

      render(<SelfInvoiceForm />)
      
      expect(screen.getByText(/failed to load suppliers/i)).toBeInTheDocument()
    })

    it('should display error when service types fail to load', () => {
      ;(api.rcm.getServiceTypes.useQuery as any).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load service types'),
      })

      render(<SelfInvoiceForm />)
      
      expect(screen.getByText(/failed to load service types/i)).toBeInTheDocument()
    })
  })
})