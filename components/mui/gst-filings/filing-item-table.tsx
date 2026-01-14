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
  Tooltip,
  Switch,
  Box,
} from '@mui/material'
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { formatCurrency } from '@/lib/invoice-utils'
import { format } from 'date-fns'

type FlagSeverity = 'error' | 'warning' | 'info'

interface ValidationFlag {
  code: string
  message: string
  severity: FlagSeverity
}

interface FilingItem {
  id: string
  invoiceId: string | null
  invoiceNumber: string
  invoiceDate: Date | null
  gstrTable: string
  recipientGstin: string | null
  recipientName: string | null
  taxableValue: number
  igstAmount: number
  cgstAmount: number
  sgstAmount: number
  confidenceScore: number
  flags: ValidationFlag[] | null
  isIncluded: boolean
  isManuallyAdjusted: boolean
  adjustmentNotes: string | null
  invoice?: {
    id: string
    invoiceNumber: string
    status?: string
    client?: {
      name: string
      country?: string
    } | null
    unregisteredSupplier?: {
      name: string
    } | null
  } | null
}

interface FilingItemTableProps {
  items: FilingItem[]
  onToggleInclude?: (itemId: string, isIncluded: boolean) => void
  onViewInvoice?: (invoiceId: string) => void
  isUpdating?: boolean
}

function FlagIndicator({ flags }: { flags: ValidationFlag[] | null }) {
  if (!flags || flags.length === 0) return null

  const errorCount = flags.filter((f) => f.severity === 'error').length
  const warningCount = flags.filter((f) => f.severity === 'warning').length
  const infoCount = flags.filter((f) => f.severity === 'info').length

  const tooltipContent = (
    <Box>
      {flags.map((flag, i) => (
        <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
          {flag.severity === 'error' && '❌ '}
          {flag.severity === 'warning' && '⚠️ '}
          {flag.severity === 'info' && 'ℹ️ '}
          {flag.message}
        </Typography>
      ))}
    </Box>
  )

  return (
    <Tooltip title={tooltipContent} arrow>
      <Stack direction="row" spacing={0.5}>
        {errorCount > 0 && <ErrorIcon fontSize="small" color="error" />}
        {warningCount > 0 && <WarningIcon fontSize="small" color="warning" />}
        {infoCount > 0 && <InfoIcon fontSize="small" color="info" />}
      </Stack>
    </Tooltip>
  )
}

function TableCodeChip({ tableCode }: { tableCode: string }) {
  const getColor = () => {
    if (tableCode === '6A') return 'primary' // Exports
    if (tableCode === '4A') return 'secondary' // B2B
    if (tableCode === '3.1(b)') return 'success' // Zero-rated
    if (tableCode === '3.1(d)') return 'warning' // Inward RCM
    if (tableCode === '3.1(a)') return 'info' // Outward taxable
    return 'default'
  }

  return (
    <Chip
      label={tableCode}
      color={getColor() as 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info'}
      size="small"
      variant="outlined"
    />
  )
}

export function FilingItemTable({
  items,
  onToggleInclude,
  onViewInvoice,
  isUpdating,
}: FilingItemTableProps) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const paginatedItems = items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  if (items.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No items in this filing plan.</Typography>
      </Paper>
    )
  }

  return (
    <Paper>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Include</TableCell>
              <TableCell>Invoice</TableCell>
              <TableCell>Table</TableCell>
              <TableCell>Recipient</TableCell>
              <TableCell align="right">Taxable Value</TableCell>
              <TableCell align="right">IGST</TableCell>
              <TableCell align="right">CGST</TableCell>
              <TableCell align="right">SGST</TableCell>
              <TableCell>Flags</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedItems.map((item) => (
              <TableRow
                key={item.id}
                sx={{
                  opacity: item.isIncluded ? 1 : 0.5,
                  bgcolor: item.isManuallyAdjusted ? 'warning.lighter' : undefined,
                }}
              >
                <TableCell padding="checkbox">
                  <Switch
                    checked={item.isIncluded}
                    onChange={(e) => onToggleInclude?.(item.id, e.target.checked)}
                    disabled={isUpdating}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {item.invoiceNumber}
                  </Typography>
                  {item.invoiceDate && (
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(item.invoiceDate), 'dd MMM yyyy')}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <TableCodeChip tableCode={item.gstrTable} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {item.recipientName || item.invoice?.client?.name || '-'}
                  </Typography>
                  {item.recipientGstin && (
                    <Typography variant="caption" color="text.secondary">
                      {item.recipientGstin}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatCurrency(Number(item.taxableValue), 'INR')}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatCurrency(Number(item.igstAmount), 'INR')}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatCurrency(Number(item.cgstAmount), 'INR')}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatCurrency(Number(item.sgstAmount), 'INR')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <FlagIndicator flags={item.flags} />
                </TableCell>
                <TableCell align="right">
                  {item.invoiceId && (
                    <Tooltip title="View Invoice">
                      <IconButton
                        size="small"
                        onClick={() => onViewInvoice?.(item.invoiceId!)}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={items.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
      />
    </Paper>
  )
}
