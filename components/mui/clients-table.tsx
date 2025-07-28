'use client'

import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Box,
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import type { Client } from '@/types/prisma-temp'

interface ClientsTableProps {
  clients: Client[]
  onEdit?: (client: Client) => void
  onDelete?: (client: Client) => void
}

export function ClientsTable({ clients, onEdit, onDelete }: ClientsTableProps) {
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Country</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} hover>
              <TableCell>
                <Box>
                  <Box fontWeight={500}>{client.name}</Box>
                  {client.company && (
                    <Box fontSize="0.875rem" color="text.secondary">
                      {client.company}
                    </Box>
                  )}
                </Box>
              </TableCell>
              <TableCell>{client.email}</TableCell>
              <TableCell>{client.country}</TableCell>
              <TableCell>
                <Chip
                  label={client.isActive ? 'Active' : 'Inactive'}
                  size="small"
                  color={client.isActive ? 'success' : 'default'}
                  variant={client.isActive ? 'filled' : 'outlined'}
                />
              </TableCell>
              <TableCell align="right">
                <Box display="flex" gap={1} justifyContent="flex-end">
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => onEdit?.(client)}
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => onDelete?.(client)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}