'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { formatCurrency } from '@/lib/invoice-utils'
import { format } from 'date-fns'
import { enqueueSnackbar } from 'notistack'
import { toSafeNumber } from '@/lib/utils/decimal'

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
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const { data: invoices, isLoading } = api.invoices.list.useQuery()

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

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
      // TODO: Implement duplicate functionality
      enqueueSnackbar('Invoice duplicated successfully', { variant: 'success' })
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
      // TODO: Open email composer
      router.push(`/invoices/${selectedInvoice.id}?action=email`)
    }
    handleMenuClose()
  }

  const displayedInvoices = invoices?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

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
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {[...Array(8)].map((_, i) => (
                      <TableCell key={i}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((_, j) => (
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

        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedInvoices?.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('.MuiIconButton-root')) {
                        router.push(`/invoices/${invoice.id}`)
                      }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {invoice.invoiceNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {invoice.client.name}
                      </Typography>
                      {invoice.client.company && (
                        <Typography variant="caption" color="text.secondary">
                          {invoice.client.company}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(invoice.dueDate), 'dd/MM/yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {formatCurrency(Number(invoice.totalAmount), invoice.currency)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ₹{Number(invoice.totalInINR).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={invoice.status} />
                    </TableCell>
                    <TableCell>
                      <PaymentStatusChip status={invoice.paymentStatus} />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="View">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/invoices/${invoice.id}`)}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Open in New Tab">
                          <IconButton
                            size="small"
                            component="a"
                            href={`/invoices/${invoice.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/invoices/${invoice.id}/edit`)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, invoice)}
                        >
                          <MoreIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={invoices.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
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