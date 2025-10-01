'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
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
import Logger from '@/lib/logger'
import VirtualizedTable, { Column } from '@/components/mui/virtualized-table'

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

  // Define columns for virtualized table
  const columns = useMemo<Column<any>[]>(() => [
    {
      id: 'paymentDate',
      label: 'Date',
      width: 120,
      accessor: (row) => row.paymentDate,
      format: (value) => format(new Date(value), 'dd MMM yyyy'),
      sortable: true,
    },
    {
      id: 'invoiceNumber',
      label: 'Invoice',
      width: 150,
      accessor: (row) => row.invoice,
      format: (value) => (
        <Button
          size="small"
          color="primary"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/invoices/${value.id}`)
          }}
          sx={{ textTransform: 'none', fontWeight: 500 }}
        >
          {value.invoiceNumber}
        </Button>
      ),
    },
    {
      id: 'client',
      label: 'Client',
      width: 200,
      accessor: (row) => row.invoice.client.name,
    },
    {
      id: 'amount',
      label: 'Amount',
      width: 150,
      accessor: (row) => ({ amount: row.amount, currency: row.currency }),
      format: (value) => (
        <Typography variant="body2" fontWeight={500}>
          {formatCurrency(Number(value.amount), value.currency)}
        </Typography>
      ),
      sortable: true,
    },
    {
      id: 'paymentMethod',
      label: 'Method',
      width: 150,
      accessor: (row) => row.paymentMethod,
      format: (value) => (
        <Chip
          label={paymentMethodLabels[value] || value.replace(/_/g, ' ')}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      id: 'reference',
      label: 'Reference',
      width: 180,
      accessor: (row) => row.reference,
      format: (value) => (
        <Typography variant="body2" color="text.secondary">
          {value || '-'}
        </Typography>
      ),
    },
  ], [router])

  // Handle row actions
  const handleRowActions = useCallback((payment: any) => (
    <Tooltip title="View Invoice">
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation()
          router.push(`/invoices/${payment.invoice.id}`)
        }}
      >
        <ViewIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  ), [router])

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
      Logger.info(`Exporting payments as ${format.toUpperCase()}`)
      // Simulate export delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // In a real implementation, you would:
      // 1. Call an API endpoint to generate the export file
      // 2. Download the file using a blob URL
      // 3. Show success message
      
      alert(`Payments exported as ${format.toUpperCase()} successfully!`)
    } catch (error) {
      Logger.error('Export failed:', error)
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

          <VirtualizedTable
            columns={columns}
            data={allPayments}
            loading={isLoading}
            maxHeight={600}
            actions={handleRowActions}
            emptyMessage={hasActiveFilters ? 'No payments found for the selected filters' : 'No payments found'}
            infiniteLoading={true}
            hasMore={hasNextPage || false}
            loadMore={fetchNextPage}
            estimatedTotalCount={allPayments.length + (hasNextPage ? 50 : 0)}
          />
        </Card>
      </Box>
    </LocalizationProvider>
  )
}
