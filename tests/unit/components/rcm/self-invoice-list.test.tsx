import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SelfInvoiceList } from '@/components/rcm/self-invoice-list'
import { api } from '@/lib/trpc/client'

// Mock tRPC
vi.mock('@/lib/trpc/client', () => ({
  api: {
    rcm: {
      getSelfInvoices: {
        useQuery: vi.fn(),
      },
      downloadSelfInvoice: {
        useMutation: vi.fn(),
      },
      emailSelfInvoice: {
        useMutation: vi.fn(),
      },
      cancelSelfInvoice: {
        useMutation: vi.fn(),
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
  useSearchParams: () => ({
    get: vi.fn((key: string) => null),
    toString: vi.fn(() => ''),
  }),
}))

describe('SelfInvoiceList', () => {
  const mockSelfInvoices = [
    {
      id: 'inv1',
      invoiceNumber: 'RCM/2024-25/001',
      invoiceDate: new Date('2024-03-15'),
      supplier: {
        name: 'Test Supplier 1',
        gstin: '29ABCDE1234F1Z5',
      },
      serviceType: {
        name: 'Professional Services',
        sacCode: '998311',
      },
      taxableAmount: 10000,
      cgstAmount: 900,
      sgstAmount: 900,
      igstAmount: 0,
      totalAmount: 11800,
      status: 'GENERATED',
      createdAt: new Date('2024-03-15'),
    },
    {
      id: 'inv2',
      invoiceNumber: 'RCM/2024-25/002',
      invoiceDate: new Date('2024-03-16'),
      supplier: {
        name: 'Test Supplier 2',
        gstin: '27FGHIJ5678K2L6',
      },
      serviceType: {
        name: 'IT Services',
        sacCode: '998313',
      },
      taxableAmount: 20000,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 3600,
      totalAmount: 23600,
      status: 'GENERATED',
      createdAt: new Date('2024-03-16'),
    },
    {
      id: 'inv3',
      invoiceNumber: 'RCM/2024-25/003',
      invoiceDate: new Date('2024-03-17'),
      supplier: {
        name: 'Test Supplier 3',
        gstin: '29XYZAB9876C3D4',
      },
      serviceType: {
        name: 'Consulting Services',
        sacCode: '998312',
      },
      taxableAmount: 15000,
      cgstAmount: 1350,
      sgstAmount: 1350,
      igstAmount: 0,
      totalAmount: 17700,
      status: 'CANCELLED',
      createdAt: new Date('2024-03-17'),
    },
  ]

  const mockDownloadSelfInvoice = vi.fn()
  const mockEmailSelfInvoice = vi.fn()
  const mockCancelSelfInvoice = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
      data: { invoices: mockSelfInvoices, total: 3 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    ;(api.rcm.downloadSelfInvoice.useMutation as any).mockReturnValue({
      mutateAsync: mockDownloadSelfInvoice,
      isLoading: false,
      error: null,
    })

    ;(api.rcm.emailSelfInvoice.useMutation as any).mockReturnValue({
      mutateAsync: mockEmailSelfInvoice,
      isLoading: false,
      error: null,
    })

    ;(api.rcm.cancelSelfInvoice.useMutation as any).mockReturnValue({
      mutateAsync: mockCancelSelfInvoice,
      isLoading: false,
      error: null,
    })
  })

  describe('List Rendering', () => {
    it('should render list header with correct columns', () => {
      render(<SelfInvoiceList />)

      expect(screen.getByText(/invoice number/i)).toBeInTheDocument()
      expect(screen.getByText(/date/i)).toBeInTheDocument()
      expect(screen.getByText(/supplier/i)).toBeInTheDocument()
      expect(screen.getByText(/service/i)).toBeInTheDocument()
      expect(screen.getByText(/taxable amount/i)).toBeInTheDocument()
      expect(screen.getByText(/gst/i)).toBeInTheDocument()
      expect(screen.getByText(/total/i)).toBeInTheDocument()
      expect(screen.getByText(/status/i)).toBeInTheDocument()
      expect(screen.getByText(/actions/i)).toBeInTheDocument()
    })

    it('should render all self-invoices', () => {
      render(<SelfInvoiceList />)

      // Check invoice numbers
      expect(screen.getByText('RCM/2024-25/001')).toBeInTheDocument()
      expect(screen.getByText('RCM/2024-25/002')).toBeInTheDocument()
      expect(screen.getByText('RCM/2024-25/003')).toBeInTheDocument()

      // Check suppliers
      expect(screen.getByText('Test Supplier 1')).toBeInTheDocument()
      expect(screen.getByText('Test Supplier 2')).toBeInTheDocument()
      expect(screen.getByText('Test Supplier 3')).toBeInTheDocument()

      // Check amounts
      expect(screen.getByText('₹10,000')).toBeInTheDocument()
      expect(screen.getByText('₹20,000')).toBeInTheDocument()
      expect(screen.getByText('₹15,000')).toBeInTheDocument()
    })

    it('should display correct GST amounts', () => {
      render(<SelfInvoiceList />)

      // First invoice - CGST/SGST
      expect(screen.getByText('CGST: ₹900')).toBeInTheDocument()
      expect(screen.getByText('SGST: ₹900')).toBeInTheDocument()

      // Second invoice - IGST
      expect(screen.getByText('IGST: ₹3,600')).toBeInTheDocument()
    })

    it('should display correct status badges', () => {
      render(<SelfInvoiceList />)

      const generatedBadges = screen.getAllByText('GENERATED')
      expect(generatedBadges).toHaveLength(2)

      const cancelledBadge = screen.getByText('CANCELLED')
      expect(cancelledBadge).toBeInTheDocument()
      expect(cancelledBadge).toHaveClass('bg-red-100') // Check styling
    })

    it('should show empty state when no invoices', () => {
      ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
        data: { invoices: [], total: 0 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<SelfInvoiceList />)

      expect(screen.getByText(/no self-invoices found/i)).toBeInTheDocument()
      expect(screen.getByText(/create your first self-invoice/i)).toBeInTheDocument()
    })
  })

  describe('Filtering and Search', () => {
    it('should render filter controls', () => {
      render(<SelfInvoiceList />)

      expect(screen.getByPlaceholderText(/search by invoice number or supplier/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/status filter/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/date from/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/date to/i)).toBeInTheDocument()
    })

    it('should filter by status', async () => {
      const refetchMock = vi.fn()
      ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
        data: { invoices: mockSelfInvoices, total: 3 },
        isLoading: false,
        error: null,
        refetch: refetchMock,
      })

      render(<SelfInvoiceList />)

      const statusFilter = screen.getByLabelText(/status filter/i)
      fireEvent.change(statusFilter, { target: { value: 'GENERATED' } })

      await waitFor(() => {
        expect(refetchMock).toHaveBeenCalled()
      })
    })

    it('should search by invoice number', async () => {
      const refetchMock = vi.fn()
      ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
        data: { invoices: mockSelfInvoices, total: 3 },
        isLoading: false,
        error: null,
        refetch: refetchMock,
      })

      render(<SelfInvoiceList />)

      const searchInput = screen.getByPlaceholderText(/search by invoice number or supplier/i)
      fireEvent.change(searchInput, { target: { value: 'RCM/2024-25/001' } })

      // Debounced search
      await waitFor(() => {
        expect(refetchMock).toHaveBeenCalled()
      }, { timeout: 600 })
    })

    it('should filter by date range', async () => {
      const refetchMock = vi.fn()
      ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
        data: { invoices: mockSelfInvoices, total: 3 },
        isLoading: false,
        error: null,
        refetch: refetchMock,
      })

      render(<SelfInvoiceList />)

      const dateFromInput = screen.getByLabelText(/date from/i)
      const dateToInput = screen.getByLabelText(/date to/i)

      fireEvent.change(dateFromInput, { target: { value: '2024-03-15' } })
      fireEvent.change(dateToInput, { target: { value: '2024-03-16' } })

      await waitFor(() => {
        expect(refetchMock).toHaveBeenCalled()
      })
    })
  })

  describe('Actions', () => {
    it('should show action buttons for generated invoices', () => {
      render(<SelfInvoiceList />)

      // Find first invoice row (GENERATED status)
      const firstInvoiceActions = screen.getAllByRole('button', { name: /view/i })[0]
        .closest('div')

      expect(firstInvoiceActions?.querySelector('[aria-label="View"]')).toBeInTheDocument()
      expect(firstInvoiceActions?.querySelector('[aria-label="Download"]')).toBeInTheDocument()
      expect(firstInvoiceActions?.querySelector('[aria-label="Email"]')).toBeInTheDocument()
      expect(firstInvoiceActions?.querySelector('[aria-label="Cancel"]')).toBeInTheDocument()
    })

    it('should disable actions for cancelled invoices', () => {
      render(<SelfInvoiceList />)

      // Find cancelled invoice row
      const cancelledRow = screen.getByText('CANCELLED').closest('tr')
      const actionButtons = cancelledRow?.querySelectorAll('button')

      actionButtons?.forEach(button => {
        if (button.getAttribute('aria-label') !== 'View') {
          expect(button).toBeDisabled()
        }
      })
    })

    it('should handle download action', async () => {
      mockDownloadSelfInvoice.mockResolvedValue({ url: 'blob:test' })

      render(<SelfInvoiceList />)

      const downloadButtons = screen.getAllByLabelText('Download')
      fireEvent.click(downloadButtons[0])

      await waitFor(() => {
        expect(mockDownloadSelfInvoice).toHaveBeenCalledWith({ id: 'inv1' })
      })
    })

    it('should handle email action with dialog', async () => {
      render(<SelfInvoiceList />)

      const emailButtons = screen.getAllByLabelText('Email')
      fireEvent.click(emailButtons[0])

      // Check if email dialog opens
      await waitFor(() => {
        expect(screen.getByText(/send self-invoice/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      })

      // Fill email and send
      const emailInput = screen.getByLabelText(/email address/i)
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

      const sendButton = screen.getByRole('button', { name: /send/i })
      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(mockEmailSelfInvoice).toHaveBeenCalledWith({
          id: 'inv1',
          email: 'test@example.com',
        })
      })
    })

    it('should handle cancel action with confirmation', async () => {
      render(<SelfInvoiceList />)

      const cancelButtons = screen.getAllByLabelText('Cancel')
      fireEvent.click(cancelButtons[0])

      // Check if confirmation dialog opens
      await waitFor(() => {
        expect(screen.getByText(/cancel self-invoice/i)).toBeInTheDocument()
        expect(screen.getByText(/are you sure you want to cancel/i)).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockCancelSelfInvoice).toHaveBeenCalledWith({ id: 'inv1' })
      })
    })

    it('should navigate to view page on view action', () => {
      const pushMock = vi.fn()
      vi.mocked(require('next/navigation').useRouter).mockReturnValue({
        push: pushMock,
        refresh: vi.fn(),
      })

      render(<SelfInvoiceList />)

      const viewButtons = screen.getAllByLabelText('View')
      fireEvent.click(viewButtons[0])

      expect(pushMock).toHaveBeenCalledWith('/rcm/self-invoice/inv1')
    })
  })

  describe('Pagination', () => {
    it('should render pagination controls', () => {
      ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
        data: { invoices: mockSelfInvoices, total: 25 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<SelfInvoiceList />)

      expect(screen.getByLabelText(/previous page/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/next page/i)).toBeInTheDocument()
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument()
    })

    it('should handle page navigation', async () => {
      const refetchMock = vi.fn()
      ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
        data: { invoices: mockSelfInvoices, total: 25 },
        isLoading: false,
        error: null,
        refetch: refetchMock,
      })

      render(<SelfInvoiceList />)

      const nextButton = screen.getByLabelText(/next page/i)
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(refetchMock).toHaveBeenCalled()
      })
    })

    it('should disable previous button on first page', () => {
      render(<SelfInvoiceList />)

      const previousButton = screen.getByLabelText(/previous page/i)
      expect(previousButton).toBeDisabled()
    })

    it('should disable next button on last page', () => {
      ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
        data: { invoices: mockSelfInvoices, total: 3 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<SelfInvoiceList />)

      const nextButton = screen.getByLabelText(/next page/i)
      expect(nextButton).toBeDisabled()
    })
  })

  describe('Loading and Error States', () => {
    it('should show loading state', () => {
      ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      render(<SelfInvoiceList />)

      expect(screen.getByText(/loading self-invoices/i)).toBeInTheDocument()
    })

    it('should show error state', () => {
      ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load invoices'),
        refetch: vi.fn(),
      })

      render(<SelfInvoiceList />)

      expect(screen.getByText(/failed to load self-invoices/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('should retry on error', async () => {
      const refetchMock = vi.fn()
      ;(api.rcm.getSelfInvoices.useQuery as any).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load'),
        refetch: refetchMock,
      })

      render(<SelfInvoiceList />)

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(refetchMock).toHaveBeenCalled()
    })
  })

  describe('Bulk Actions', () => {
    it('should show bulk action controls when items are selected', () => {
      render(<SelfInvoiceList />)

      // Select first checkbox
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1]) // Skip header checkbox

      expect(screen.getByText(/1 selected/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /bulk download/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /bulk email/i })).toBeInTheDocument()
    })

    it('should select all items when header checkbox is clicked', () => {
      render(<SelfInvoiceList />)

      const headerCheckbox = screen.getAllByRole('checkbox')[0]
      fireEvent.click(headerCheckbox)

      expect(screen.getByText(/3 selected/i)).toBeInTheDocument()
    })

    it('should handle bulk download', async () => {
      render(<SelfInvoiceList />)

      // Select items
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])
      fireEvent.click(checkboxes[2])

      const bulkDownloadButton = screen.getByRole('button', { name: /bulk download/i })
      fireEvent.click(bulkDownloadButton)

      await waitFor(() => {
        expect(mockDownloadSelfInvoice).toHaveBeenCalledTimes(2)
        expect(mockDownloadSelfInvoice).toHaveBeenCalledWith({ id: 'inv1' })
        expect(mockDownloadSelfInvoice).toHaveBeenCalledWith({ id: 'inv2' })
      })
    })
  })
})