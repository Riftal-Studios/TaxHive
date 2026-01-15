import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import type { Client, LUT } from '@prisma/client'

// Mock data
const mockClients: Client[] = [
  {
    id: 'client-1',
    userId: 'user-1',
    name: 'Test Client Inc',
    email: 'client@test.com',
    company: 'Test Client Inc',
    address: '123 Test St',
    country: 'United States',
    currency: 'USD',
    phone: '+1234567890',
    taxId: '123456789',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'client-2',
    userId: 'user-1',
    name: 'Another Client',
    email: 'another@test.com',
    company: 'Another Inc',
    address: '456 Another St',
    country: 'Canada',
    currency: 'CAD',
    phone: '+9876543210',
    taxId: '987654321',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockLuts: LUT[] = [
  {
    id: 'lut-1',
    userId: 'user-1',
    lutNumber: 'AD1234567890123',
    lutDate: new Date('2024-04-01'),
    validFrom: new Date('2024-04-01'),
    validTill: new Date('2025-03-31'),
    isActive: true,
    reminderSentAt: null,
    renewalReminderSentAt: null,
    previousLutId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

describe('InvoiceForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render all required fields', () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    // Check for main form fields
    expect(screen.getByLabelText(/client/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/lut/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/issue date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/payment terms/i)).toBeInTheDocument()
    
    // Check for line items section
    expect(screen.getByText(/line items/i)).toBeInTheDocument()
    expect(screen.getByText(/add line item/i)).toBeInTheDocument()
    
    // Check for additional fields
    expect(screen.getByLabelText(/bank details/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
    
    // Check for action buttons
    expect(screen.getByText(/save draft/i)).toBeInTheDocument()
    expect(screen.getByText(/cancel/i)).toBeInTheDocument()
  })

  it('should populate client dropdown with provided clients', async () => {
    const user = userEvent.setup()
    
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    const clientButton = screen.getByLabelText(/client/i)
    expect(clientButton).toHaveTextContent('Select a client')
    
    await user.click(clientButton)
    
    expect(screen.getByText('Test Client Inc')).toBeInTheDocument()
    expect(screen.getByText('Another Client')).toBeInTheDocument()
  })

  it('should add and remove line items', async () => {
    const user = userEvent.setup()
    
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    // Should have one line item by default
    expect(screen.getAllByLabelText(/description/i)).toHaveLength(1)
    
    // Add a line item
    const addButton = screen.getByText(/add line item/i)
    await user.click(addButton)
    
    expect(screen.getAllByLabelText(/description/i)).toHaveLength(2)
    
    // Remove a line item
    const removeButtons = screen.getAllByLabelText(/remove line item/i)
    await user.click(removeButtons[0])
    
    expect(screen.getAllByLabelText(/description/i)).toHaveLength(1)
  })

  it('should calculate line item amounts correctly', async () => {
    const user = userEvent.setup()

    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    const quantityInput = screen.getByLabelText(/quantity/i)
    // Use regex that matches "Rate" at start but not "Exchange Rate" or "Manual exchange rate"
    const rateInput = screen.getByLabelText(/^rate\s/i)
    
    await user.clear(quantityInput)
    await user.type(quantityInput, '10')
    
    await user.clear(rateInput)
    await user.type(rateInput, '100')
    
    // Check if amount is calculated correctly - the component shows the amount without currency symbol
    await waitFor(() => {
      expect(screen.getByText('1,000.00')).toBeInTheDocument()
    })
  })

  it('should validate SAC/HSN code format', async () => {
    const user = userEvent.setup()

    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    const sacInput = screen.getByLabelText(/sac.*code/i)

    // Enter invalid SAC code
    await user.type(sacInput, '1234')
    // Submit form to trigger validation (validation happens on submit, not blur)
    await user.click(screen.getByText(/save draft/i))

    // Validation message from the component
    expect(screen.getByText(/sac\/hsn code must be a valid code/i)).toBeInTheDocument()

    // Enter valid SAC code
    await user.clear(sacInput)
    await user.type(sacInput, '99831190')
    await user.click(screen.getByText(/save draft/i))

    expect(screen.queryByText(/sac\/hsn code must be a valid code/i)).not.toBeInTheDocument()
  })

  it('should calculate totals correctly', async () => {
    const user = userEvent.setup()
    
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    // Fill first line item
    const quantityInput = screen.getByLabelText(/quantity/i)
    // Use regex that matches "Rate" at start but not "Exchange Rate" or "Manual exchange rate"
    const rateInput = screen.getByLabelText(/^rate\s/i)

    await user.clear(quantityInput)
    await user.type(quantityInput, '10')

    await user.clear(rateInput)
    await user.type(rateInput, '100')

    // Add second line item
    await user.click(screen.getByText(/add line item/i))

    const quantityInputs = screen.getAllByLabelText(/quantity/i)
    const rateInputs = screen.getAllByLabelText(/^rate\s/i)
    
    await user.clear(quantityInputs[1])
    await user.type(quantityInputs[1], '5')
    
    await user.clear(rateInputs[1])
    await user.type(rateInputs[1], '200')
    
    // Check totals - check that the values are present somewhere
    expect(screen.getByText('Subtotal:')).toBeInTheDocument()
    // $2,000.00 appears twice (subtotal and total are equal with 0% IGST)
    expect(screen.getAllByText('$2,000.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('IGST (0%):')).toBeInTheDocument()
    expect(screen.getByText('Total:')).toBeInTheDocument()
  })

  it('should validate required fields before submission', async () => {
    const user = userEvent.setup()
    
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    // Try to submit without filling required fields
    const saveButton = screen.getByText(/save draft/i)
    await user.click(saveButton)
    
    expect(mockOnSubmit).not.toHaveBeenCalled()
    
    // Check for validation errors
    expect(screen.getByText(/client is required/i)).toBeInTheDocument()
    expect(screen.getByText(/description is required/i)).toBeInTheDocument()
  })

  it('should submit form with correct data', async () => {
    const user = userEvent.setup()
    
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    // Fill required fields
    await user.click(screen.getByLabelText(/client/i))
    await user.click(screen.getByText('Test Client Inc'))
    
    await user.click(screen.getByLabelText(/lut/i))
    await user.click(screen.getByText('AD1234567890123'))
    
    // Fill line item
    await user.type(screen.getByLabelText(/description/i), 'Web Development Services')
    await user.type(screen.getByLabelText(/sac.*code/i), '99831190')
    await user.clear(screen.getByLabelText(/quantity/i))
    await user.type(screen.getByLabelText(/quantity/i), '10')
    // Use regex that matches "Rate" at start but not "Exchange Rate" or "Manual exchange rate"
    await user.clear(screen.getByLabelText(/^rate\s/i))
    await user.type(screen.getByLabelText(/^rate\s/i), '100')
    
    // Fill additional fields
    await user.type(screen.getByLabelText(/bank details/i), 'Bank: Test Bank\nAccount: 1234567890')
    await user.type(screen.getByLabelText(/notes/i), 'Thank you for your business')
    
    // Submit form
    await user.click(screen.getByText(/save draft/i))
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          lutId: 'lut-1',
          lineItems: expect.arrayContaining([
            expect.objectContaining({
              description: 'Web Development Services',
              sacCode: '99831190',
              quantity: 10,
              rate: 100,
            }),
          ]),
          bankDetails: 'Bank: Test Bank\nAccount: 1234567890',
          notes: 'Thank you for your business',
        })
      )
    })
  })

  it('should handle cancel action', async () => {
    const user = userEvent.setup()
    
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    await user.click(screen.getByText(/cancel/i))
    
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('should show LUT declaration when LUT is selected', async () => {
    const user = userEvent.setup()
    
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    // Select LUT
    await user.click(screen.getByLabelText(/lut/i))
    await user.click(screen.getByText('AD1234567890123'))
    
    // Check for LUT declaration text
    expect(screen.getByText(/supply meant for export under lut/i)).toBeInTheDocument()
    expect(screen.getByText(/tax not payable/i)).toBeInTheDocument()
  })
})