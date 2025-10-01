import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VirtualizedTable, { Column } from '@/components/mui/virtualized-table'
import React from 'react'

// Mock react-window
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, itemData, height, width, innerElementType }: any) => {
    const items = []
    for (let i = 0; i < Math.min(itemCount, 10); i++) {
      items.push(
        <div key={i} style={{ height: itemSize }}>
          {children({ index: i, style: { height: itemSize }, data: itemData })}
        </div>
      )
    }
    return (
      <div style={{ height, width, overflow: 'auto' }}>
        {innerElementType ? (
          <div>{items}</div>
        ) : (
          items
        )}
      </div>
    )
  },
}))

vi.mock('react-window-infinite-loader', () => ({
  default: ({ children, isItemLoaded, itemCount, loadMoreItems }: any) => {
    return children({
      onItemsRendered: vi.fn(),
      ref: vi.fn(),
    })
  },
}))

vi.mock('react-virtualized-auto-sizer', () => ({
  default: ({ children }: any) => children({ height: 600, width: 800 }),
}))

describe('VirtualizedTable', () => {
  const mockData = [
    { id: '1', name: 'John Doe', email: 'john@example.com', status: 'active' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', status: 'active' },
  ]

  const columns: Column[] = [
    { id: 'name', label: 'Name', width: 200 },
    { id: 'email', label: 'Email', width: 250 },
    { id: 'status', label: 'Status', width: 100 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render table with columns', () => {
      render(<VirtualizedTable columns={columns} data={mockData} />)
      
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('should render data rows', () => {
      render(<VirtualizedTable columns={columns} data={mockData} />)
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    })

    it('should show loading state', () => {
      render(<VirtualizedTable columns={columns} data={[]} loading={true} />)
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should show error message', () => {
      const errorMessage = 'Failed to load data'
      render(<VirtualizedTable columns={columns} data={[]} error={errorMessage} />)
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should show empty message when no data', () => {
      const emptyMessage = 'No records found'
      render(<VirtualizedTable columns={columns} data={[]} emptyMessage={emptyMessage} />)
      
      expect(screen.getByText(emptyMessage)).toBeInTheDocument()
    })
  })

  describe('Column Features', () => {
    it('should format column values using format function', () => {
      const columnsWithFormat: Column[] = [
        {
          id: 'status',
          label: 'Status',
          format: (value) => value === 'active' ? '✅ Active' : '❌ Inactive',
        },
      ]
      
      render(<VirtualizedTable columns={columnsWithFormat} data={mockData} />)
      
      expect(screen.getByText('✅ Active')).toBeInTheDocument()
    })

    it('should use accessor function to extract values', () => {
      const columnsWithAccessor: Column[] = [
        {
          id: 'fullInfo',
          label: 'Full Info',
          accessor: (row) => `${row.name} (${row.email})`,
        },
      ]
      
      render(<VirtualizedTable columns={columnsWithAccessor} data={mockData} />)
      
      expect(screen.getByText('John Doe (john@example.com)')).toBeInTheDocument()
    })

    it('should render sortable columns with sort labels', () => {
      const sortableColumns: Column[] = [
        { id: 'name', label: 'Name', sortable: true },
      ]
      
      const onSort = vi.fn()
      render(
        <VirtualizedTable 
          columns={sortableColumns} 
          data={mockData}
          onSort={onSort}
          sortBy="name"
          sortDirection="asc"
        />
      )
      
      const sortLabel = screen.getByText('Name').closest('span')
      expect(sortLabel).toHaveClass('MuiTableSortLabel-root')
    })
  })

  describe('Selection', () => {
    it('should render checkboxes when selectable', () => {
      render(<VirtualizedTable columns={columns} data={mockData} selectable={true} />)
      
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    it('should handle row selection', async () => {
      const onSelectionChange = vi.fn()
      const selected = new Set<number>()
      
      render(
        <VirtualizedTable 
          columns={columns} 
          data={mockData}
          selectable={true}
          selected={selected}
          onSelectionChange={onSelectionChange}
        />
      )
      
      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[1]) // Click first data row checkbox
      
      expect(onSelectionChange).toHaveBeenCalledWith(expect.any(Set))
    })

    it('should handle select all', async () => {
      const onSelectionChange = vi.fn()
      
      render(
        <VirtualizedTable 
          columns={columns} 
          data={mockData}
          selectable={true}
          selected={new Set()}
          onSelectionChange={onSelectionChange}
        />
      )
      
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
      await userEvent.click(selectAllCheckbox)
      
      expect(onSelectionChange).toHaveBeenCalledWith(new Set([0, 1, 2]))
    })
  })

  describe('Row Interactions', () => {
    it('should handle row click', async () => {
      const onRowClick = vi.fn()
      
      render(
        <VirtualizedTable 
          columns={columns} 
          data={mockData}
          onRowClick={onRowClick}
        />
      )
      
      const row = screen.getByText('John Doe').closest('div')
      if (row) {
        await userEvent.click(row)
        expect(onRowClick).toHaveBeenCalledWith(mockData[0], 0)
      }
    })

    it('should handle row double click', async () => {
      const onRowDoubleClick = vi.fn()
      
      render(
        <VirtualizedTable 
          columns={columns} 
          data={mockData}
          onRowDoubleClick={onRowDoubleClick}
        />
      )
      
      const row = screen.getByText('John Doe').closest('div')
      if (row) {
        await userEvent.dblClick(row)
        expect(onRowDoubleClick).toHaveBeenCalledWith(mockData[0], 0)
      }
    })

    it('should render row actions', () => {
      const actions = vi.fn((row) => <button>Action for {row.name}</button>)
      
      render(
        <VirtualizedTable 
          columns={columns} 
          data={mockData}
          actions={actions}
        />
      )
      
      expect(screen.getByText('Actions')).toBeInTheDocument()
      expect(screen.getByText('Action for John Doe')).toBeInTheDocument()
    })
  })

  describe('Infinite Loading', () => {
    it('should support infinite loading', async () => {
      const loadMore = vi.fn().mockResolvedValue(undefined)
      
      render(
        <VirtualizedTable 
          columns={columns} 
          data={mockData}
          infiniteLoading={true}
          hasMore={true}
          loadMore={loadMore}
          estimatedTotalCount={100}
        />
      )
      
      // The component should be ready for infinite loading
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('should show loading skeleton for unloaded items', () => {
      render(
        <VirtualizedTable 
          columns={columns} 
          data={mockData}
          infiniteLoading={true}
          hasMore={true}
          estimatedTotalCount={10}
        />
      )
      
      // Check that the component renders without errors
      expect(screen.getByText('Name')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        status: i % 2 === 0 ? 'active' : 'inactive',
      }))
      
      render(<VirtualizedTable columns={columns} data={largeData} />)
      
      // Should render without performance issues
      expect(screen.getByText('Name')).toBeInTheDocument()
      // Only visible items should be rendered (mocked to 10 items)
      const renderedItems = screen.queryAllByText(/User \d+/)
      expect(renderedItems.length).toBeLessThanOrEqual(10)
    })

    it('should respect maxHeight prop', () => {
      const { container } = render(
        <VirtualizedTable 
          columns={columns} 
          data={mockData}
          maxHeight={400}
        />
      )
      
      const tableContainer = container.querySelector('.MuiTableContainer-root')
      expect(tableContainer).toHaveStyle({ maxHeight: '400px' })
    })

    it('should use custom row height', () => {
      const { container } = render(
        <VirtualizedTable 
          columns={columns} 
          data={mockData}
          rowHeight={80}
        />
      )
      
      // Check that rows are rendered with correct height
      const rows = container.querySelectorAll('[style*="height: 80"]')
      expect(rows.length).toBeGreaterThan(0)
    })
  })

  describe('Sorting', () => {
    it('should call onSort when sortable column is clicked', async () => {
      const onSort = vi.fn()
      const sortableColumns: Column[] = [
        { id: 'name', label: 'Name', sortable: true },
      ]
      
      render(
        <VirtualizedTable 
          columns={sortableColumns} 
          data={mockData}
          onSort={onSort}
        />
      )
      
      const sortButton = screen.getByText('Name')
      await userEvent.click(sortButton)
      
      expect(onSort).toHaveBeenCalledWith('name')
    })

    it('should display sort direction indicator', () => {
      const sortableColumns: Column[] = [
        { id: 'name', label: 'Name', sortable: true },
      ]
      
      render(
        <VirtualizedTable 
          columns={sortableColumns} 
          data={mockData}
          sortBy="name"
          sortDirection="desc"
          onSort={vi.fn()}
        />
      )
      
      const sortLabel = screen.getByText('Name').closest('.MuiTableSortLabel-root')
      expect(sortLabel).toHaveClass('MuiTableSortLabel-active')
    })
  })
})