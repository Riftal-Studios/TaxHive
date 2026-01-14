'use client'

import React, { useState } from 'react'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Typography,
  Stack,
  Skeleton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
  Check as MatchIcon,
  Close as RejectIcon,
  Link as LinkIcon,
} from '@mui/icons-material'
import { formatCurrency } from '@/lib/invoice-utils'
import { format } from 'date-fns'
import { api } from '@/lib/trpc/client'

type MatchStatus = 'PENDING' | 'MATCHED' | 'AMOUNT_MISMATCH' | 'NOT_IN_2B' | 'IN_2B_ONLY' | 'REJECTED' | 'MANUALLY_RESOLVED'

interface GSTR2BEntry {
  id: string
  vendorGstin: string
  vendorName?: string | null
  invoiceNumber: string
  invoiceDate: Date | string
  invoiceValue: string | number
  taxableValue: string | number
  igst: string | number
  cgst: string | number
  sgst: string | number
  matchStatus: MatchStatus
  matchedInvoiceId?: string | null
  matchConfidence?: number | null
  mismatchDetails?: Record<string, unknown> | null
}

interface ReconciliationTableProps {
  entries?: GSTR2BEntry[]
  isLoading?: boolean
  uploadId: string
  onViewDetails?: (entry: GSTR2BEntry) => void
  onStatusChange?: () => void
}

function MatchStatusChip({ status }: { status: MatchStatus }) {
  const statusConfig: Record<MatchStatus, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
    PENDING: { label: 'Pending', color: 'default' },
    MATCHED: { label: 'Matched', color: 'success' },
    AMOUNT_MISMATCH: { label: 'Amount Mismatch', color: 'warning' },
    NOT_IN_2B: { label: 'Not in 2B', color: 'error' },
    IN_2B_ONLY: { label: 'In 2B Only', color: 'info' },
    REJECTED: { label: 'Rejected', color: 'error' },
    MANUALLY_RESOLVED: { label: 'Resolved', color: 'success' },
  }

  const config = statusConfig[status] || { label: status, color: 'default' as const }

  return (
    <Chip
      label={config.label}
      color={config.color}
      size="small"
      sx={{ fontWeight: 500 }}
    />
  )
}

function EntryRow({
  entry,
  onViewDetails,
  onStatusChange,
}: {
  entry: GSTR2BEntry
  onViewDetails?: (entry: GSTR2BEntry) => void
  onStatusChange?: () => void
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const updateStatusMutation = api.gstr2b.updateMatchStatus.useMutation({
    onSuccess: () => {
      onStatusChange?.()
    },
  })

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleStatusUpdate = (status: MatchStatus) => {
    updateStatusMutation.mutate({ entryId: entry.id, status })
    handleMenuClose()
  }

  const totalTax = Number(entry.igst) + Number(entry.cgst) + Number(entry.sgst)

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight="medium">
          {entry.vendorGstin || '-'}
        </Typography>
        {entry.vendorName && (
          <Typography variant="caption" color="text.secondary">
            {entry.vendorName}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2">{entry.invoiceNumber}</Typography>
        <Typography variant="caption" color="text.secondary">
          {format(new Date(entry.invoiceDate), 'dd MMM yyyy')}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight="medium">
          {formatCurrency(Number(entry.invoiceValue), 'INR')}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">
          {formatCurrency(Number(entry.taxableValue), 'INR')}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight="medium">
          {formatCurrency(totalTax, 'INR')}
        </Typography>
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          {Number(entry.igst) > 0 && (
            <Typography variant="caption" color="text.secondary">
              I: {formatCurrency(Number(entry.igst), 'INR')}
            </Typography>
          )}
          {Number(entry.cgst) > 0 && (
            <Typography variant="caption" color="text.secondary">
              C: {formatCurrency(Number(entry.cgst), 'INR')}
            </Typography>
          )}
          {Number(entry.sgst) > 0 && (
            <Typography variant="caption" color="text.secondary">
              S: {formatCurrency(Number(entry.sgst), 'INR')}
            </Typography>
          )}
        </Stack>
      </TableCell>
      <TableCell>
        <MatchStatusChip status={entry.matchStatus} />
        {entry.matchConfidence && entry.matchConfidence > 0 && (
          <Typography variant="caption" display="block" color="text.secondary">
            {Math.round(entry.matchConfidence * 100)}% confidence
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => onViewDetails?.(entry)}>
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          {entry.matchStatus !== 'MATCHED' && entry.matchStatus !== 'MANUALLY_RESOLVED' && (
            <MenuItem onClick={() => handleStatusUpdate('MANUALLY_RESOLVED')}>
              <ListItemIcon>
                <MatchIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>Mark as Resolved</ListItemText>
            </MenuItem>
          )}
          {entry.matchStatus !== 'REJECTED' && (
            <MenuItem onClick={() => handleStatusUpdate('REJECTED')}>
              <ListItemIcon>
                <RejectIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Reject</ListItemText>
            </MenuItem>
          )}
          {!entry.matchedInvoiceId && (
            <MenuItem onClick={handleMenuClose}>
              <ListItemIcon>
                <LinkIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Link to Invoice</ListItemText>
            </MenuItem>
          )}
        </Menu>
      </TableCell>
    </TableRow>
  )
}

export function ReconciliationTable({
  entries = [],
  isLoading,
  uploadId: _uploadId,
  onViewDetails,
  onStatusChange,
}: ReconciliationTableProps) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const paginatedEntries = entries.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  )

  if (isLoading) {
    return (
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vendor</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell align="right">Value</TableCell>
                <TableCell align="right">Taxable</TableCell>
                <TableCell align="right">Tax</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(7)].map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    )
  }

  if (entries.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No entries found. Upload a GSTR-2B file to see reconciliation data.
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Vendor</TableCell>
              <TableCell>Invoice</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell align="right">Taxable</TableCell>
              <TableCell align="right">Tax (I/C/S)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onViewDetails={onViewDetails}
                onStatusChange={onStatusChange}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={entries.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
      />
    </Paper>
  )
}
