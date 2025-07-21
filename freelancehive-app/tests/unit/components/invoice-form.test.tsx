import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import type { Client } from '@prisma/client'

describe('InvoiceForm', () => {
  const mockClients: Client[] = [
    {
      id: '1',
      userId: 'user1',
      name: 'Test Client',
      email: 'client@test.com',
      company: 'Test Co',
      address: '123 Test St',
      country: 'United States',
      phone: '+1-555-0123',
      taxId: 'US123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockLUTs = [
    {
      id: 'lut1',
      lutNumber: 'AD290124000001',
      validTill: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  ]

  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render invoice form with required fields', () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLUTs}
        onSubmit={mockOnSubmit}
      />
    )

    expect(screen.getByLabelText('Client')).toBeInTheDocument()
    expect(screen.getByLabelText('Invoice Date')).toBeInTheDocument()
    expect(screen.getByLabelText('Due Date')).toBeInTheDocument()
    expect(screen.getByLabelText('Currency')).toBeInTheDocument()
    expect(screen.getByLabelText('LUT (for 0% GST)')).toBeInTheDocument()
    expect(screen.getByText('Line Items')).toBeInTheDocument()
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLUTs}
        onSubmit={mockOnSubmit}
      />
    )

    // Try to submit without filling required fields
    await user.click(screen.getByText('Create Invoice'))

    await waitFor(() => {
      expect(screen.getByText('Client is required')).toBeInTheDocument()
      expect(screen.getByText('At least one line item is required')).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should validate 8-digit service code', async () => {
    const user = userEvent.setup()
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLUTs}
        onSubmit={mockOnSubmit}
      />
    )

    // Add line item with invalid service code
    await user.click(screen.getByText('Add Line Item'))
    await user.type(screen.getByLabelText('Description'), 'Test Service')
    await user.type(screen.getByLabelText('Quantity'), '1')
    await user.type(screen.getByLabelText('Rate'), '100')
    await user.type(screen.getByLabelText('Service Code'), '9983') // Only 4 digits

    await user.click(screen.getByText('Create Invoice'))

    await waitFor(() => {
      expect(screen.getByText('Service code must be 8 digits')).toBeInTheDocument()
    })
  })

  it('should calculate totals correctly', async () => {
    const user = userEvent.setup()
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLUTs}
        onSubmit={mockOnSubmit}
      />
    )

    // Add first line item
    await user.click(screen.getByText('Add Line Item'))
    const lineItems = screen.getAllByRole('group', { name: /line item/i })
    
    await user.type(within(lineItems[0]).getByLabelText('Description'), 'Service 1')
    await user.type(within(lineItems[0]).getByLabelText('Quantity'), '10')
    await user.type(within(lineItems[0]).getByLabelText('Rate'), '50')

    // Check subtotal
    await waitFor(() => {
      expect(screen.getByText('Subtotal:')).toBeInTheDocument()
      expect(screen.getByText('$500.00')).toBeInTheDocument()
    })

    // Add second line item
    await user.click(screen.getByText('Add Line Item'))
    const updatedLineItems = screen.getAllByRole('group', { name: /line item/i })
    
    await user.type(within(updatedLineItems[1]).getByLabelText('Description'), 'Service 2')
    await user.type(within(updatedLineItems[1]).getByLabelText('Quantity'), '5')
    await user.type(within(updatedLineItems[1]).getByLabelText('Rate'), '100')

    // Check updated totals
    await waitFor(() => {
      expect(screen.getByText('$1,000.00')).toBeInTheDocument()
    })
  })

  it('should show 0% IGST when LUT is selected', async () => {
    const user = userEvent.setup()
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLUTs}
        onSubmit={mockOnSubmit}
      />
    )

    // Select LUT
    await user.selectOptions(screen.getByLabelText('LUT (for 0% GST)'), 'lut1')

    // Check IGST is 0%
    expect(screen.getByText('IGST (0%)')).toBeInTheDocument()
    expect(screen.getByText('$0.00', { selector: '.igst-amount' })).toBeInTheDocument()
  })

  it('should submit form with valid data', async () => {
    const user = userEvent.setup()
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLUTs}
        onSubmit={mockOnSubmit}
      />
    )

    // Fill form
    await user.selectOptions(screen.getByLabelText('Client'), '1')
    await user.selectOptions(screen.getByLabelText('LUT (for 0% GST)'), 'lut1')
    
    // Add line item
    await user.click(screen.getByText('Add Line Item'))
    const lineItems = screen.getAllByRole('group', { name: /line item/i })
    
    await user.type(within(lineItems[0]).getByLabelText('Description'), 'Backend Development')
    await user.type(within(lineItems[0]).getByLabelText('Quantity'), '80')
    await user.type(within(lineItems[0]).getByLabelText('Rate'), '50')
    await user.type(within(lineItems[0]).getByLabelText('Service Code'), '99831400')

    // Additional fields
    await user.type(screen.getByLabelText('Description'), 'Software development services for Q4 2024')
    await user.type(screen.getByLabelText('Payment Terms'), 'Net 30 days')
    await user.type(screen.getByLabelText('Bank Details'), 'HDFC Bank\nAccount: 1234567890')

    // Submit
    await user.click(screen.getByText('Create Invoice'))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: '1',
          lutId: 'lut1',
          lineItems: expect.arrayContaining([
            expect.objectContaining({
              description: 'Backend Development',
              quantity: 80,
              rate: 50,
              serviceCode: '99831400',
            }),
          ]),
        })
      )
    })
  })
})