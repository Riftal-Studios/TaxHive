import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientsTable } from '@/components/clients/clients-table'
import type { Client } from '@prisma/client'

describe('ClientsTable', () => {
  const mockClients: Client[] = [
    {
      id: '1',
      userId: 'user1',
      name: 'Acme Corporation',
      email: 'billing@acme.com',
      company: 'Acme Corp',
      address: '123 Business Ave, New York, NY',
      country: 'United States',
      currency: 'USD',
      phone: '+1-555-0123',
      taxId: 'US123456789',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      userId: 'user1',
      name: 'TechStart Inc',
      email: 'accounts@techstart.com',
      company: 'TechStart',
      address: '456 Innovation Blvd, SF, CA',
      country: 'United States',
      currency: 'USD',
      phone: '+1-555-0456',
      taxId: null,
      isActive: true,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ]

  it('should render client list with all columns', () => {
    render(<ClientsTable clients={mockClients} />)
    
    // Check headers
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Country')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    
    // Check client data
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
    expect(screen.getByText('billing@acme.com')).toBeInTheDocument()
    expect(screen.getByText('TechStart Inc')).toBeInTheDocument()
    expect(screen.getByText('accounts@techstart.com')).toBeInTheDocument()
  })

  it('should show active/inactive status correctly', () => {
    const clientsWithInactive = [
      ...mockClients,
      {
        ...mockClients[0],
        id: '3',
        name: 'Inactive Client',
        isActive: false,
      },
    ]
    
    render(<ClientsTable clients={clientsWithInactive} />)
    
    const activeStatuses = screen.getAllByText('Active')
    expect(activeStatuses).toHaveLength(2)
    
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('should show empty state when no clients', () => {
    render(<ClientsTable clients={[]} />)
    
    expect(screen.getByText('No clients found')).toBeInTheDocument()
    expect(screen.getByText('Add your first client to get started')).toBeInTheDocument()
  })

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = vi.fn()
    render(<ClientsTable clients={mockClients} onEdit={onEdit} />)
    
    const editButtons = screen.getAllByText('Edit')
    editButtons[0].click()
    
    expect(onEdit).toHaveBeenCalledWith(mockClients[0])
  })

  it('should call onDelete when delete button is clicked', () => {
    const onDelete = vi.fn()
    render(<ClientsTable clients={mockClients} onDelete={onDelete} />)
    
    const deleteButtons = screen.getAllByText('Delete')
    deleteButtons[0].click()
    
    expect(onDelete).toHaveBeenCalledWith(mockClients[0])
  })
})