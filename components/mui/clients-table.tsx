'use client'

import React, { useMemo, useCallback } from 'react'
import {
  Chip,
  IconButton,
  Tooltip,
  Box,
  Typography,
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import type { Client } from '@prisma/client'
import VirtualizedTable, { Column } from '@/components/mui/virtualized-table'

interface ClientsTableProps {
  clients: Client[]
  onEdit?: (client: Client) => void
  onDelete?: (client: Client) => void
  loading?: boolean
  maxHeight?: number
}

export function ClientsTable({ 
  clients, 
  onEdit, 
  onDelete, 
  loading = false,
  maxHeight = 600 
}: ClientsTableProps) {
  // Define columns for virtualized table
  const columns = useMemo<Column<Client>[]>(() => [
    {
      id: 'name',
      label: 'Name',
      width: 250,
      accessor: (row) => ({ name: row.name, company: row.company }),
      format: (value) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {value.name}
          </Typography>
          {value.company && (
            <Typography variant="caption" color="text.secondary">
              {value.company}
            </Typography>
          )}
        </Box>
      ),
      sortable: true,
    },
    {
      id: 'email',
      label: 'Email',
      width: 250,
      accessor: (row) => row.email,
      sortable: true,
    },
    {
      id: 'country',
      label: 'Country',
      width: 150,
      accessor: (row) => row.country,
      sortable: true,
    },
    {
      id: 'status',
      label: 'Status',
      width: 120,
      accessor: (row) => row.isActive,
      format: (value) => (
        <Chip
          label={value ? 'Active' : 'Inactive'}
          size="small"
          color={value ? 'success' : 'default'}
          variant={value ? 'filled' : 'outlined'}
        />
      ),
    },
  ], [])

  // Handle row actions
  const handleRowActions = useCallback((client: Client) => (
    <Box display="flex" gap={1} justifyContent="flex-end">
      <Tooltip title="Edit">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            onEdit?.(client)
          }}
          color="primary"
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.(client)
          }}
          color="error"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  ), [onEdit, onDelete])

  return (
    <VirtualizedTable
      columns={columns}
      data={clients}
      loading={loading}
      maxHeight={maxHeight}
      actions={handleRowActions}
      emptyMessage="No clients found"
      rowHeight={60}
    />
  )
}