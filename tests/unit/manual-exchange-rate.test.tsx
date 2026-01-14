import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { InvoiceForm } from '@/components/invoices/invoice-form'

describe('Manual Exchange Rate Entry', () => {
  const mockClients = [
    {
      id: 'client-1',
      userId: 'user-1',
      name: 'Test Client',
      email: 'client@test.com',
      phone: null,
      company: 'Test Company',
      address: '123 Test St',
      country: 'USA',
      currency: 'USD',
      taxId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockLuts = [
    {
      id: 'lut-1',
      userId: 'user-1',
      lutNumber: 'AD290124000001',
      lutDate: new Date('2024-01-01'),
      validFrom: new Date('2024-01-01'),
      validTill: new Date('2024-12-31'),
      isActive: true,
      reminderSentAt: null,
      renewalReminderSentAt: null,
      previousLutId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()
  const mockOnCurrencyChange = vi.fn()
  const mockOnManualExchangeRateChange = vi.fn()

  it('should show manual entry form when exchange rate is not available', () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        onCurrencyChange={mockOnCurrencyChange}
        exchangeRate={null}
        manualExchangeRate={null}
        onManualExchangeRateChange={mockOnManualExchangeRateChange}
      />
    )

    // Should show manual entry message
    expect(screen.getByText('Exchange rate not available - Please enter manually')).toBeInTheDocument()
    
    // Should show links to find current rates
    expect(screen.getByText('RBI Reference Rates')).toBeInTheDocument()
    expect(screen.getByText('XE Currency Converter')).toBeInTheDocument()
    
    // Should show manual input field
    expect(screen.getByPlaceholderText('Enter rate')).toBeInTheDocument()
  })

  it('should show exchange rate when available', () => {
    const mockExchangeRate = {
      rate: 83.50,
      source: 'RBI',
      date: new Date(),
    }

    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        onCurrencyChange={mockOnCurrencyChange}
        exchangeRate={mockExchangeRate}
      />
    )

    // Should show exchange rate
    expect(screen.getByText(/Exchange Rate: 1 USD = ₹83.50/)).toBeInTheDocument()
    expect(screen.getByText(/Source: RBI/)).toBeInTheDocument()
    
    // Should not show manual entry form
    expect(screen.queryByText('Exchange rate not available - Please enter manually')).not.toBeInTheDocument()
  })

  it('should call onManualExchangeRateChange when manual rate is entered', () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        onCurrencyChange={mockOnCurrencyChange}
        exchangeRate={null}
        manualExchangeRate={null}
        onManualExchangeRateChange={mockOnManualExchangeRateChange}
      />
    )

    const input = screen.getByPlaceholderText('Enter rate') as HTMLInputElement
    fireEvent.change(input, { target: { value: '84.25' } })

    expect(mockOnManualExchangeRateChange).toHaveBeenCalledWith(84.25)
  })

  it('should have correct href for RBI link', () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        exchangeRate={null}
      />
    )

    const rbiLink = screen.getByText('RBI Reference Rates') as HTMLAnchorElement
    expect(rbiLink.href).toBe('https://www.rbi.org.in/scripts/ReferenceRateArchive.aspx')
    expect(rbiLink.target).toBe('_blank')
    expect(rbiLink.rel).toBe('noopener noreferrer')
  })

  it('should have correct href for XE link', () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        exchangeRate={null}
      />
    )

    const xeLink = screen.getByText('XE Currency Converter') as HTMLAnchorElement
    expect(xeLink.href).toBe('https://www.xe.com/currencyconverter/')
    expect(xeLink.target).toBe('_blank')
    expect(xeLink.rel).toBe('noopener noreferrer')
  })

  it('should not show exchange rate section when currency is INR', () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        exchangeRate={null}
      />
    )

    // Change currency to INR
    const currencySelect = screen.getByLabelText('Currency') as HTMLSelectElement
    fireEvent.change(currencySelect, { target: { value: 'INR' } })

    // Should not show any exchange rate section
    expect(screen.queryByText('Exchange rate not available - Please enter manually')).not.toBeInTheDocument()
    expect(screen.queryByText(/Exchange Rate:/)).not.toBeInTheDocument()
  })
})