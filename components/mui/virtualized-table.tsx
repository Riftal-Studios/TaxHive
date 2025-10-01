/**
 * Virtualized Table Component
 * 
 * High-performance table component using react-window for rendering
 * large datasets efficiently. Only renders visible rows in the viewport.
 */

'use client'

import React, { memo, useCallback, useMemo, useRef, useState, CSSProperties } from 'react'
import { FixedSizeList as List, ListChildComponentProps } from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'
import AutoSizer from 'react-virtualized-auto-sizer'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Typography,
  Skeleton,
  styled,
  alpha,
} from '@mui/material'
import { MoreVert as MoreVertIcon } from '@mui/icons-material'

// Styled components for better performance
const StyledTableRow = styled(TableRow)(({ theme }) => ({
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
  '&.Mui-selected': {
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
  },
}))

const StickyTableHead = styled(TableHead)(({ theme }) => ({
  position: 'sticky',
  top: 0,
  backgroundColor: theme.palette.background.paper,
  zIndex: 10,
  borderBottom: `2px solid ${theme.palette.divider}`,
}))

// Types
export interface Column<T = any> {
  id: string
  label: string
  width?: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  format?: (value: any, row: T) => React.ReactNode
  sortable?: boolean
  accessor?: (row: T) => any
}

export interface VirtualizedTableProps<T = any> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  error?: string | null
  rowHeight?: number
  headerHeight?: number
  maxHeight?: number
  onRowClick?: (row: T, index: number) => void
  onRowDoubleClick?: (row: T, index: number) => void
  selectable?: boolean
  selected?: Set<number>
  onSelectionChange?: (selected: Set<number>) => void
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (columnId: string) => void
  actions?: (row: T, index: number) => React.ReactNode
  emptyMessage?: string
  infiniteLoading?: boolean
  hasMore?: boolean
  loadMore?: () => Promise<void>
  estimatedTotalCount?: number
}

// Row renderer component
const Row = memo(<T,>({
  index,
  style,
  data,
}: ListChildComponentProps<{
  items: T[]
  columns: Column<T>[]
  onRowClick?: (row: T, index: number) => void
  onRowDoubleClick?: (row: T, index: number) => void
  selectable?: boolean
  selected?: Set<number>
  onSelectionChange?: (selected: Set<number>) => void
  actions?: (row: T, index: number) => React.ReactNode
  isItemLoaded: (index: number) => boolean
}>) => {
  const {
    items,
    columns,
    onRowClick,
    onRowDoubleClick,
    selectable,
    selected,
    onSelectionChange,
    actions,
    isItemLoaded,
  } = data

  const isLoaded = isItemLoaded(index)
  const row = items[index]
  const isSelected = selected?.has(index) || false

  const handleClick = useCallback(() => {
    if (onRowClick && isLoaded) {
      onRowClick(row, index)
    }
  }, [row, index, onRowClick, isLoaded])

  const handleDoubleClick = useCallback(() => {
    if (onRowDoubleClick && isLoaded) {
      onRowDoubleClick(row, index)
    }
  }, [row, index, onRowDoubleClick, isLoaded])

  const handleCheckboxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      event.stopPropagation()
      if (!onSelectionChange || !selected) return

      const newSelected = new Set(selected)
      if (event.target.checked) {
        newSelected.add(index)
      } else {
        newSelected.delete(index)
      }
      onSelectionChange(newSelected)
    },
    [index, selected, onSelectionChange]
  )

  if (!isLoaded) {
    // Render loading skeleton
    return (
      <div style={style}>
        <StyledTableRow>
          {selectable && (
            <TableCell padding="checkbox">
              <Skeleton variant="rectangular" width={20} height={20} />
            </TableCell>
          )}
          {columns.map((column) => (
            <TableCell key={column.id} align={column.align || 'left'}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
          {actions && (
            <TableCell align="right">
              <Skeleton variant="circular" width={24} height={24} />
            </TableCell>
          )}
        </StyledTableRow>
      </div>
    )
  }

  return (
    <div style={style}>
      <StyledTableRow
        hover
        selected={isSelected}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {selectable && (
          <TableCell padding="checkbox">
            <Checkbox
              checked={isSelected}
              onChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
            />
          </TableCell>
        )}
        {columns.map((column) => {
          const value = column.accessor ? column.accessor(row) : (row as any)[column.id]
          const formatted = column.format ? column.format(value, row) : value

          return (
            <TableCell
              key={column.id}
              align={column.align || 'left'}
              style={{
                width: column.width,
                minWidth: column.minWidth,
              }}
            >
              {formatted}
            </TableCell>
          )
        })}
        {actions && (
          <TableCell align="right" style={{ width: 48 }}>
            {actions(row, index)}
          </TableCell>
        )}
      </StyledTableRow>
    </div>
  )
})

Row.displayName = 'VirtualizedTableRow'

// Main virtualized table component
export const VirtualizedTable = <T,>({
  columns,
  data,
  loading = false,
  error = null,
  rowHeight = 52,
  headerHeight = 56,
  maxHeight = 600,
  onRowClick,
  onRowDoubleClick,
  selectable = false,
  selected = new Set(),
  onSelectionChange,
  sortBy,
  sortDirection = 'asc',
  onSort,
  actions,
  emptyMessage = 'No data available',
  infiniteLoading = false,
  hasMore = false,
  loadMore,
  estimatedTotalCount,
}: VirtualizedTableProps<T>) => {
  const listRef = useRef<List>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Calculate item count for infinite loading
  const itemCount = infiniteLoading
    ? hasMore
      ? estimatedTotalCount || data.length + 1
      : data.length
    : data.length

  // Check if item is loaded
  const isItemLoaded = useCallback(
    (index: number) => !hasMore || index < data.length,
    [data.length, hasMore]
  )

  // Load more items
  const loadMoreItems = useCallback(async () => {
    if (!loadMore || isLoadingMore) return
    
    setIsLoadingMore(true)
    try {
      await loadMore()
    } finally {
      setIsLoadingMore(false)
    }
  }, [loadMore, isLoadingMore])

  // Handle select all
  const handleSelectAll = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!onSelectionChange) return

      if (event.target.checked) {
        const newSelected = new Set(Array.from({ length: data.length }, (_, i) => i))
        onSelectionChange(newSelected)
      } else {
        onSelectionChange(new Set())
      }
    },
    [data.length, onSelectionChange]
  )

  // Memoize row data to prevent unnecessary re-renders
  const rowData = useMemo(
    () => ({
      items: data,
      columns,
      onRowClick,
      onRowDoubleClick,
      selectable,
      selected,
      onSelectionChange,
      actions,
      isItemLoaded,
    }),
    [
      data,
      columns,
      onRowClick,
      onRowDoubleClick,
      selectable,
      selected,
      onSelectionChange,
      actions,
      isItemLoaded,
    ]
  )

  const allSelected = selected.size === data.length && data.length > 0
  const someSelected = selected.size > 0 && selected.size < data.length

  if (loading && data.length === 0) {
    return (
      <Paper>
        <Box display="flex" justifyContent="center" alignItems="center" height={300}>
          <CircularProgress />
        </Box>
      </Paper>
    )
  }

  if (error) {
    return (
      <Paper>
        <Box display="flex" justifyContent="center" alignItems="center" height={300}>
          <Typography color="error">{error}</Typography>
        </Box>
      </Paper>
    )
  }

  if (data.length === 0 && !loading) {
    return (
      <Paper>
        <Box display="flex" justifyContent="center" alignItems="center" height={300}>
          <Typography color="textSecondary">{emptyMessage}</Typography>
        </Box>
      </Paper>
    )
  }

  const innerElement = React.forwardRef<HTMLDivElement, { style: CSSProperties }>(
    ({ style, ...rest }, ref) => (
      <div
        ref={ref}
        style={{
          ...style,
          height: `${parseFloat(style.height as string) + headerHeight}px`,
        }}
        {...rest}
      />
    )
  )

  innerElement.displayName = 'VirtualizedTableInner'

  const ListContent = ({ height, width }: { height: number; width: number }) => {
    if (infiniteLoading && loadMore) {
      return (
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={(list) => {
                ref(list)
                ;(listRef as any).current = list
              }}
              height={height}
              width={width}
              itemCount={itemCount}
              itemSize={rowHeight}
              itemData={rowData}
              innerElementType={innerElement}
              onItemsRendered={onItemsRendered}
            >
              {Row}
            </List>
          )}
        </InfiniteLoader>
      )
    }

    return (
      <List
        ref={listRef}
        height={height}
        width={width}
        itemCount={itemCount}
        itemSize={rowHeight}
        itemData={rowData}
        innerElementType={innerElement}
      >
        {Row}
      </List>
    )
  }

  return (
    <TableContainer component={Paper} style={{ maxHeight, overflow: 'hidden' }}>
      <Table stickyHeader>
        <StickyTableHead>
          <TableRow>
            {selectable && (
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={someSelected}
                  checked={allSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
            )}
            {columns.map((column) => (
              <TableCell
                key={column.id}
                align={column.align || 'left'}
                style={{
                  width: column.width,
                  minWidth: column.minWidth,
                }}
              >
                {column.sortable && onSort ? (
                  <TableSortLabel
                    active={sortBy === column.id}
                    direction={sortBy === column.id ? sortDirection : 'asc'}
                    onClick={() => onSort(column.id)}
                  >
                    {column.label}
                  </TableSortLabel>
                ) : (
                  column.label
                )}
              </TableCell>
            ))}
            {actions && <TableCell align="right" style={{ width: 48 }}>Actions</TableCell>}
          </TableRow>
        </StickyTableHead>
        <TableBody>
          <tr>
            <td colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)} style={{ padding: 0 }}>
              <AutoSizer disableHeight>
                {({ width }) => (
                  <ListContent height={Math.min(maxHeight - headerHeight, itemCount * rowHeight)} width={width} />
                )}
              </AutoSizer>
            </td>
          </tr>
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// Export memoized version
export default memo(VirtualizedTable) as typeof VirtualizedTable