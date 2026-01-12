'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Button,
  CircularProgress,
  Grid,
  Alert,
  Menu,
  MenuItem as MenuMenuItem,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { api } from '@/lib/trpc/client'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/invoice-utils'

const paymentMethodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  UPI: 'UPI',
  PAYPAL: 'PayPal',
  PAYONEER: 'Payoneer',
  WISE: 'Wise',
  OTHER: 'Other',
}

export function MUIPayments() {
  const router = useRouter()
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [clientFilter, setClientFilter] = useState<string>('')
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  const {
    data: payments,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch
  } = api.payments.getHistory.useInfiniteQuery(
    {
      limit: 20,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      clientId: clientFilter || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  )

  const { data: clients } = api.clients.list.useQuery()
  const { data: summary } = api.payments.getSummary.useQuery({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })

  // Memoize all payments to prevent unnecessary re-renders
  const allPayments = React.useMemo(() => {
    return payments?.pages.flatMap(page => page.items) ?? []
  }, [payments?.pages])

  // Handle infinite scroll with proper cleanup
  const handleScroll = useCallback(() => {
    if (isFetchingMore || !hasNextPage || isFetchingNextPage) return

    const scrollPosition = window.innerHeight + document.documentElement.scrollTop
    const threshold = document.documentElement.offsetHeight - 1000

    if (scrollPosition >= threshold) {
      setIsFetchingMore(true)
      fetchNextPage().finally(() => setIsFetchingMore(false))
    }
  }, [isFetchingMore, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Add scroll event listener with proper cleanup
  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Refetch data when filters change
  useEffect(() => {
    refetch()
  }, [dateFrom, dateTo, clientFilter, refetch])

  const handleExport = useCallback(async (format: 'csv' | 'excel') => {
    setIsExporting(true)
    try {
      // This would typically call an API endpoint to generate the export
      console.log(`Exporting payments as ${format.toUpperCase()}`)
      // Simulate export delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // In a real implementation, you would:
      // 1. Call an API endpoint to generate the export file
      // 2. Download the file using a blob URL
      // 3. Show success message
      
      alert(`Payments exported as ${format.toUpperCase()} successfully!`)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
      setExportAnchorEl(null)
    }
  }, [])

  const clearFilters = useCallback(() => {
    setDateFrom(null)
    setDateTo(null)
    setClientFilter('')
  }, [])

  if (isLoading) {
    return (
      <Box>
        <Box mb={4}>
          <Skeleton variant="text" width={300} height={40} />
          <Skeleton variant="text" width={400} height={24} />
        </Box>
        <Card sx={{ mb: 3 }}>
          <Skeleton variant="rectangular" height={200} />
        </Card>
        <Card>
          <Skeleton variant="rectangular" height={600} />
        </Card>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Error Loading Payments</Typography>
          <Typography variant="body2">{error.message}</Typography>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={() => refetch()}
            sx={{ mt: 2 }}
          >
            Try Again
          </Button>
        </Alert>
      </Box>
    )
  }

  const hasActiveFilters = dateFrom || dateTo || clientFilter

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box mb={4} display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
              Payment History
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View and manage all payment records
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={(e) => setExportAnchorEl(e.currentTarget)}
              disabled={isExporting || allPayments.length === 0}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportAnchorEl}
              open={Boolean(exportAnchorEl)}
              onClose={() => setExportAnchorEl(null)}
            >
              <MenuMenuItem onClick={() => handleExport('csv')} disabled={isExporting}>
                Export as CSV
              </MenuMenuItem>
              <MenuMenuItem onClick={() => handleExport('excel')} disabled={isExporting}>
                Export as Excel
              </MenuMenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" gutterBottom>
                Filters
              </Typography>
              {hasActiveFilters && (
                <Button
                  size="small"
                  onClick={clearFilters}
                  startIcon={<FilterIcon />}
                >
                  Clear Filters
                </Button>
              )}
            </Box>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <DatePicker
                  label="From Date"
                  value={dateFrom}
                  onChange={(newValue) => setDateFrom(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <DatePicker
                  label="To Date"
                  value={dateTo}
                  onChange={(newValue) => setDateTo(newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Client</InputLabel>
                  <Select
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    label="Client"
                  >
                    <MenuItem value="">All Clients</MenuItem>
                    {clients?.map((client) => (
                      <MenuItem key={client.id} value={client.id}>
                        {client.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Summary */}
        {summary && summary.length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Payment Summary
            </Typography>
            <Grid container spacing={2}>
              {summary.map((item) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.currency}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Total in {item.currency}
                    </Typography>
                    <Typography variant="h5" fontWeight={600}>
                      {formatCurrency(item.total, item.currency)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      {item.count} payment{item.count !== 1 ? 's' : ''}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Payments Table */}
        <Card>
          <CardContent sx={{ pb: 0 }}>
            <Typography variant="h6" gutterBottom>
              Payments
              {hasActiveFilters && (
                <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                  (Filtered)
                </Typography>
              )}
            </Typography>
          </CardContent>

          {allPayments.length === 0 ? (
            <Box py={8} textAlign="center">
              <Box color="text.disabled" mb={2}>
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </Box>
              <Typography variant="body1" color="text.secondary">
                {hasActiveFilters ? 'No payments found for the selected filters' : 'No payments found'}
              </Typography>
              {hasActiveFilters && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={clearFilters}
                  sx={{ mt: 2 }}
                >
                  Clear Filters
                </Button>
              )}
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Invoice</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allPayments.map((payment) => (
                      <TableRow key={payment.id} hover>
                        <TableCell>
                          {format(new Date(payment.paymentDate), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            color="primary"
                            onClick={() => router.push(`/invoices/${payment.invoice.id}`)}
                            sx={{ textTransform: 'none', fontWeight: 500 }}
                          >
                            {payment.invoice.invoiceNumber}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {payment.invoice.client?.name ?? 'Self Invoice'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {formatCurrency(Number(payment.amount), payment.currency)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod.replace(/_/g, ' ')}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {payment.reference || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View Invoice">
                            <IconButton
                              size="small"
                              onClick={() => router.push(`/invoices/${payment.invoice.id}`)}
                              aria-label={`View invoice ${payment.invoice.invoiceNumber}`}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {hasNextPage && (
                <Box p={2} textAlign="center" borderTop={1} borderColor="divider">
                  <Button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    startIcon={isFetchingNextPage ? <CircularProgress size={20} /> : <ExpandMoreIcon />}
                  >
                    {isFetchingNextPage ? 'Loading...' : 'Load More'}
                  </Button>
                </Box>
              )}
            </>
          )}
        </Card>
      </Box>
    </LocalizationProvider>
  )
}
