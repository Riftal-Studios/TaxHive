import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { SAC_HSN_CODES } from '@/lib/constants'

describe('InvoiceForm SAC/HSN Dropdown', () => {
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
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  it('should show SAC/HSN dropdown when input is focused', async () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    const sacInput = screen.getByPlaceholderText('Search or enter code')
    fireEvent.focus(sacInput)

    await waitFor(() => {
      // Should show some SAC codes
      expect(screen.getByText('99831190')).toBeInTheDocument()
      expect(screen.getByText('IT design and development services')).toBeInTheDocument()
    })
  })

  it('should filter SAC codes based on search term', async () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    const sacInput = screen.getByPlaceholderText('Search or enter code')
    fireEvent.focus(sacInput)
    fireEvent.change(sacInput, { target: { value: 'cloud' } })

    await waitFor(() => {
      // Should show cloud-related codes
      expect(screen.getByText('99831310')).toBeInTheDocument()
      expect(screen.getByText('Cloud computing services')).toBeInTheDocument()
      
      // Should not show unrelated codes
      expect(screen.queryByText('99831190')).not.toBeInTheDocument()
    })
  })

  it('should select SAC code when clicked', async () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    const sacInput = screen.getByPlaceholderText('Search or enter code') as HTMLInputElement
    fireEvent.focus(sacInput)

    await waitFor(() => {
      const cloudOption = screen.getByText('Cloud computing services')
      fireEvent.mouseDown(cloudOption)
    })

    expect(sacInput.value).toBe('99831310')
  })

  it('should allow custom SAC code entry', async () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    const sacInput = screen.getByPlaceholderText('Search or enter code') as HTMLInputElement
    fireEvent.change(sacInput, { target: { value: '99999999' } })

    expect(sacInput.value).toBe('99999999')
  })

  it('should show message when no codes match search', async () => {
    render(
      <InvoiceForm
        clients={mockClients}
        luts={mockLuts}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    )

    const sacInput = screen.getByPlaceholderText('Search or enter code')
    fireEvent.focus(sacInput)
    fireEvent.change(sacInput, { target: { value: 'xyz123' } })

    await waitFor(() => {
      expect(screen.getByText('No matching codes found. You can enter a custom code.')).toBeInTheDocument()
    })
  })
})