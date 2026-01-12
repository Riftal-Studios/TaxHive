'use client'

import React, { useState, useMemo } from 'react'
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
  Alert,
} from '@mui/material'
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  MoreVert as MoreIcon,
  Download as DownloadIcon,
  Receipt as VoucherIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { formatCurrency } from '@/lib/invoice-utils'
import { format, differenceInDays } from 'date-fns'
import { toSafeNumber } from '@/lib/utils/decimal'

interface SelfInvoice {
  id: string
  invoiceNumber: string
  invoiceDate: Date | string
  dateOfReceiptOfSupply: Date | string | null
  totalAmount: string | number
  cgstAmount: string | number
  sgstAmount: string | number
  status: string
  pdfUrl?: string | null
  unregisteredSupplier: {
    name: string
    state: string
    stateCode: string
  } | null
  paymentVoucher: {
    id: string
    voucherNumber: string
    pdfUrl?: string | null
  } | null
}

interface RCMStatusChipProps {
  invoiceDate: Date | string
  dateOfReceiptOfSupply: Date | string | null
}

function RCMStatusChip({ invoiceDate, dateOfReceiptOfSupply }: RCMStatusChipProps) {
  if (!dateOfReceiptOfSupply) {
    return (
      <Chip
        label="No Receipt Date"
        color="warning"
        size="small"
        sx={{ fontWeight: 500 }}
      />
    )
  }

  const daysDiff = differenceInDays(
    new Date(invoiceDate),
    new Date(dateOfReceiptOfSupply)
  )

  if (daysDiff > 30) {
    return (
      <Chip
        label={`${daysDiff - 30}d Overdue`}
        color="error"
        size="small"
        sx={{ fontWeight: 500 }}
      />
    )
  }

  if (daysDiff > 25) {
    return (
      <Chip
        label={`${30 - daysDiff}d Left`}
        color="warning"
        size="small"
        sx={{ fontWeight: 500 }}
      />
    )
  }

  return (
    <Chip
      label="Compliant"
      color="success"
      size="small"
      sx={{ fontWeight: 500 }}
    />
  )
}

interface StatusChipProps {
  status: string
}

function StatusChip({ status }: StatusChipProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'FINALIZED':
        return 'success'
      case 'DRAFT':
        return 'default'
      case 'SENT':
        return 'info'
      default:
        return 'default'
    }
  }

  return (
    <Chip
      label={status.charAt(0) + status.slice(1).toLowerCase()}
      color={getStatusColor()}
      size="small"
      variant="outlined"
      sx={{ fontWeight: 500 }}
    />
  )
}

export function SelfInvoiceList() {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<SelfInvoice | null>(null)

  // Calculate current fiscal year dates (Apr 1 to Mar 31)
  const fiscalYearDates = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    // Fiscal year starts in April
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1
    return {
      startDate: new Date(fyStartYear, 3, 1), // April 1st
      endDate: new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999), // March 31st
    }
  }, [])

  const { data: invoices, isLoading, error } = api.selfInvoices.list.useQuery({})
  const { data: rcmSummary } = api.selfInvoices.getRCMLiabilitySummary.useQuery(fiscalYearDates)

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, invoice: SelfInvoice) => {
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
    setSelectedInvoice(invoice)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedInvoice(null)
  }

  const handleDownloadPDF = () => {
    if (selectedInvoice?.id) {
      window.open(`/api/invoices/${selectedInvoice.id}/download`, '_blank')
    }
    handleMenuClose()
  }

  const handleDownloadVoucher = () => {
    if (selectedInvoice?.paymentVoucher?.id) {
      window.open(`/api/payment-vouchers/${selectedInvoice.paymentVoucher.id}/download`, '_blank')
    }
    handleMenuClose()
  }

  // Transform invoice data for display
  const transformInvoice = (invoice: unknown): SelfInvoice => {
    const inv = invoice as Record<string, unknown>
    return {
      id: inv.id as string,
      invoiceNumber: inv.invoiceNumber as string,
      invoiceDate: inv.invoiceDate as Date | string,
      dateOfReceiptOfSupply: inv.dateOfReceiptOfSupply as Date | string | null,
      totalAmount: toSafeNumber(inv.totalAmount),
      cgstAmount: toSafeNumber(inv.cgstAmount ?? 0),
      sgstAmount: toSafeNumber(inv.sgstAmount ?? 0),
      status: inv.status as string,
      pdfUrl: inv.pdfUrl as string | null | undefined,
      unregisteredSupplier: inv.unregisteredSupplier as SelfInvoice['unregisteredSupplier'],
      paymentVoucher: inv.paymentVoucher as SelfInvoice['paymentVoucher'],
    }
  }

  const displayedInvoices = invoices
    ?.map(transformInvoice)
    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  if (isLoading) {
    return (
      <Box>
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" fontWeight={600}>
              Self Invoices (RCM)
            </Typography>
            <Skeleton variant="rectangular" width={160} height={40} />
          </Stack>
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {[...Array(7)].map((_, i) => (
                      <TableCell key={i}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
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
        </Stack>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading self-invoices: {error.message}
        </Alert>
      </Box>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Box>
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" fontWeight={600}>
              Self Invoices (RCM)
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/self-invoices/new')}
            >
              Create Self Invoice
            </Button>
          </Stack>

          {/* RCM Info Banner */}
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Reverse Charge Mechanism (RCM)</strong>: Issue self-invoices for purchases from
              unregistered suppliers under GST Section 31(3)(f). Self-invoices must be issued within
              30 days of receiving goods/services (Rule 47A).
            </Typography>
          </Alert>

          <Paper sx={{ p: 8, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No self-invoices yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first self-invoice for purchases from unregistered suppliers
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/self-invoices/new')}
            >
              Create Self Invoice
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
          <Box>
            <Typography variant="h4" fontWeight={600}>
              Self Invoices (RCM)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Reverse Charge Mechanism - Section 31(3)(f)
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/self-invoices/new')}
          >
            Create Self Invoice
          </Button>
        </Stack>

        {/* RCM Summary */}
        {rcmSummary && (
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={4} justifyContent="space-around">
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Total Self Invoices
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  {invoices.length}
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  RCM Liability (This FY)
                </Typography>
                <Typography variant="h5" fontWeight={600} color="error.main">
                  {formatCurrency(rcmSummary.totalTax ?? 0, 'INR')}
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  ITC Claimable (This FY)
                </Typography>
                <Typography variant="h5" fontWeight={600} color="success.main">
                  {formatCurrency(rcmSummary.totalTax ?? 0, 'INR')}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}

        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Invoice Date</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>GST</TableCell>
                  <TableCell>30-Day Rule</TableCell>
                  <TableCell>Status</TableCell>
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
                        router.push(`/self-invoices/${invoice.id}`)
                      }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {invoice.invoiceNumber}
                      </Typography>
                      {invoice.paymentVoucher && (
                        <Typography variant="caption" color="text.secondary">
                          PV: {invoice.paymentVoucher.voucherNumber}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {invoice.unregisteredSupplier?.name ?? 'Unknown Supplier'}
                      </Typography>
                      {invoice.unregisteredSupplier && (
                        <Typography variant="caption" color="text.secondary">
                          {invoice.unregisteredSupplier.state} ({invoice.unregisteredSupplier.stateCode})
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}
                      </Typography>
                      {invoice.dateOfReceiptOfSupply && (
                        <Typography variant="caption" color="text.secondary">
                          Received: {format(new Date(invoice.dateOfReceiptOfSupply), 'dd/MM/yyyy')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {formatCurrency(Number(invoice.totalAmount), 'INR')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary.main">
                        {Number(invoice.cgstAmount) > 0 ? (
                          <>
                            CGST: ₹{Number(invoice.cgstAmount).toFixed(2)}
                            <br />
                            SGST: ₹{Number(invoice.sgstAmount).toFixed(2)}
                          </>
                        ) : (
                          <>IGST: ₹{(Number(invoice.cgstAmount) + Number(invoice.sgstAmount)).toFixed(2)}</>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <RCMStatusChip
                        invoiceDate={invoice.invoiceDate}
                        dateOfReceiptOfSupply={invoice.dateOfReceiptOfSupply}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={invoice.status} />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="View">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/self-invoices/${invoice.id}`)}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Open in New Tab">
                          <IconButton
                            size="small"
                            component="a"
                            href={`/self-invoices/${invoice.id}`}
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
                            onClick={() => router.push(`/self-invoices/${invoice.id}/edit`)}
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
        <MenuItem onClick={handleDownloadPDF}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download Self Invoice PDF</ListItemText>
        </MenuItem>
        {selectedInvoice?.paymentVoucher && (
          <MenuItem onClick={handleDownloadVoucher}>
            <ListItemIcon>
              <VoucherIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download Payment Voucher</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  )
}
