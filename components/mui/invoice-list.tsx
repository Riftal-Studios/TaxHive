'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  IconButton,
  Chip,
  Typography,
  Button,
  Stack,
  Skeleton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  MoreVert as MoreIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Payment as PaymentIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { formatCurrency } from '@/lib/invoice-utils'
import { format } from 'date-fns'
import { enqueueSnackbar } from 'notistack'
import { toSafeNumber } from '@/lib/utils/decimal'
import VirtualizedTable, { Column } from '@/components/mui/virtualized-table'

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: Date | string
  dueDate: Date | string
  status: string
  paymentStatus: string
  totalAmount: string | number
  totalInINR?: string | number
  currency: string
  pdfUrl?: string | null
  client: {
    name: string
    company?: string | null
  }
}

interface StatusChipProps {
  status: string
}

function StatusChip({ status }: StatusChipProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'PAID':
        return 'success'
      case 'SENT':
        return 'info'
      case 'DRAFT':
        return 'default'
      case 'OVERDUE':
        return 'error'
      case 'PARTIALLY_PAID':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusLabel = () => {
    switch (status) {
      case 'PARTIALLY_PAID':
        return 'Partially Paid'
      default:
        return status.charAt(0) + status.slice(1).toLowerCase()
    }
  }

  return (
    <Chip
      label={getStatusLabel()}
      color={getStatusColor()}
      size="small"
      sx={{ fontWeight: 500 }}
    />
  )
}

interface PaymentStatusChipProps {
  status: string
}

function PaymentStatusChip({ status }: PaymentStatusChipProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'PAID':
        return 'success'
      case 'PARTIALLY_PAID':
        return 'warning'
      case 'UNPAID':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusLabel = () => {
    switch (status) {
      case 'PARTIALLY_PAID':
        return 'Partial'
      case 'UNPAID':
        return 'Unpaid'
      case 'PAID':
        return 'Paid'
      default:
        return status
    }
  }

  return (
    <Chip
      label={getStatusLabel()}
      color={getStatusColor()}
      size="small"
      variant="outlined"
      sx={{ fontWeight: 500 }}
    />
  )
}

export function InvoiceList() {
  const router = useRouter()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  const { data: invoices, isLoading } = api.invoices.list.useQuery()

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, invoice: { 
    id: string
    invoiceNumber: string
    invoiceDate: Date | string
    dueDate: Date | string
    status: string
    paymentStatus: string
    totalAmount: { toNumber?: () => number } | string | number
    totalInINR?: { toNumber?: () => number } | string | number
    currency: string
    pdfUrl?: string | null
    client: {
      name: string
      company?: string | null
    }
  }) => {
    setAnchorEl(event.currentTarget)
    // Convert invoice data to match the Invoice interface
    const formattedInvoice: Invoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
      totalAmount: toSafeNumber(invoice.totalAmount),
      totalInINR: invoice.totalInINR ? toSafeNumber(invoice.totalInINR) : undefined,
      currency: invoice.currency,
      pdfUrl: invoice.pdfUrl,
      client: {
        name: invoice.client.name,
        company: invoice.client.company,
      }
    }
    setSelectedInvoice(formattedInvoice)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedInvoice(null)
  }

  const handleDuplicate = () => {
    if (selectedInvoice) {
      // Navigate to new invoice form with pre-filled data from selected invoice
      const duplicateData = {
        clientId: selectedInvoice.client.id,
        currency: selectedInvoice.currency,
        placeOfSupply: selectedInvoice.placeOfSupply,
        supplyType: selectedInvoice.supplyType,
        reverseCharge: selectedInvoice.reverseCharge,
        notes: selectedInvoice.notes,
        termsAndConditions: selectedInvoice.termsAndConditions,
        // Note: Line items would need to be added in the form
      }
      // Store in sessionStorage for the form to pick up
      sessionStorage.setItem('duplicateInvoiceData', JSON.stringify(duplicateData))
      router.push('/invoices/new?duplicate=true')
    }
    handleMenuClose()
  }

  const handleDownloadPDF = () => {
    if (selectedInvoice?.pdfUrl) {
      window.open(`/api/invoices/${selectedInvoice.id}/download`, '_blank')
    }
    handleMenuClose()
  }

  const handleSendEmail = () => {
    if (selectedInvoice) {
      // Navigate to invoice detail page with email action
      // The invoice detail page will handle opening the email modal
      router.push(`/invoices/${selectedInvoice.id}?action=email`)
    }
    handleMenuClose()
  }

  // Define columns for virtualized table
  const columns = useMemo<Column<any>[]>(() => [
    {
      id: 'invoiceNumber',
      label: 'Invoice #',
      width: 150,
      accessor: (row) => row.invoiceNumber,
      format: (value) => (
        <Typography variant="body2" fontWeight={500}>
          {value}
        </Typography>
      ),
    },
    {
      id: 'client',
      label: 'Client',
      width: 200,
      accessor: (row) => row.client,
      format: (value) => (
        <Box>
          <Typography variant="body2">
            {value.name}
          </Typography>
          {value.company && (
            <Typography variant="caption" color="text.secondary">
              {value.company}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: 'invoiceDate',
      label: 'Date',
      width: 120,
      accessor: (row) => row.invoiceDate,
      format: (value) => format(new Date(value), 'dd/MM/yyyy'),
      sortable: true,
    },
    {
      id: 'dueDate',
      label: 'Due Date',
      width: 120,
      accessor: (row) => row.dueDate,
      format: (value) => format(new Date(value), 'dd/MM/yyyy'),
      sortable: true,
    },
    {
      id: 'amount',
      label: 'Amount',
      width: 150,
      accessor: (row) => ({ amount: row.totalAmount, currency: row.currency, inr: row.totalInINR }),
      format: (value) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {formatCurrency(Number(value.amount), value.currency)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ₹{Number(value.inr).toFixed(2)}
          </Typography>
        </Box>
      ),
      sortable: true,
    },
    {
      id: 'status',
      label: 'Status',
      width: 120,
      accessor: (row) => row.status,
      format: (value) => <StatusChip status={value} />,
    },
    {
      id: 'paymentStatus',
      label: 'Payment',
      width: 120,
      accessor: (row) => row.paymentStatus,
      format: (value) => <PaymentStatusChip status={value} />,
    },
  ], [])

  // Format invoices for virtualized table
  const formattedInvoices = useMemo(() => {
    if (!invoices) return []
    return invoices.map(invoice => ({
      ...invoice,
      totalAmount: toSafeNumber(invoice.totalAmount),
      totalInINR: invoice.totalInINR ? toSafeNumber(invoice.totalInINR) : 0,
    }))
  }, [invoices])

  // Handle row actions
  const handleRowActions = useCallback((row: any, index: number) => (
    <Stack direction="row" spacing={1} justifyContent="center">
      <Tooltip title="View">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/invoices/${row.id}`)
          }}
        >
          <ViewIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/invoices/${row.id}/edit`)
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation()
          handleMenuOpen(e, row)
        }}
      >
        <MoreIcon fontSize="small" />
      </IconButton>
    </Stack>
  ), [router])

  const handleRowClick = useCallback((row: any, index: number) => {
    router.push(`/invoices/${row.id}`)
  }, [router])

  const handleSelectionChange = useCallback((selected: Set<number>) => {
    setSelectedRows(selected)
  }, [])

  if (isLoading) {
    return (
      <Box>
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" fontWeight={600}>
              Invoices
            </Typography>
            <Skeleton variant="rectangular" width={120} height={40} />
          </Stack>
          <VirtualizedTable
            columns={columns}
            data={[]}
            loading={true}
            maxHeight={600}
          />
        </Stack>
      </Box>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Box>
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" fontWeight={600}>
              Invoices
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/invoices/new')}
            >
              Create Invoice
            </Button>
          </Stack>
          <Paper sx={{ p: 8, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No invoices yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first invoice to get started
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/invoices/new')}
            >
              Create Invoice
            </Button>
          </Paper>
        </Stack>
      </Box>
    )
  }

  return (
    <Box>
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" fontWeight={600}>
            Invoices
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/invoices/new')}
          >
            Create Invoice
          </Button>
        </Stack>

        <VirtualizedTable
          columns={columns}
          data={formattedInvoices}
          loading={false}
          maxHeight={600}
          onRowClick={handleRowClick}
          selectable={true}
          selected={selectedRows}
          onSelectionChange={handleSelectionChange}
          actions={handleRowActions}
          emptyMessage="No invoices found"
        />
      </Stack>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {selectedInvoice?.pdfUrl && (
          <MenuItem onClick={handleDownloadPDF}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download PDF</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handleSendEmail}>
          <ListItemIcon>
            <EmailIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Send Email</ListItemText>
        </MenuItem>
        {selectedInvoice?.paymentStatus !== 'PAID' && (
          <MenuItem onClick={() => {
            router.push(`/invoices/${selectedInvoice?.id}?action=payment`)
            handleMenuClose()
          }}>
            <ListItemIcon>
              <PaymentIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Record Payment</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  )
}