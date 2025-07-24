'use client'

import React, { useState } from 'react'
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
} from '@mui/material'
import {
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
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

  const { data: payments, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = 
    api.payments.getHistory.useInfiniteQuery(
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

  const allPayments = payments?.pages.flatMap(page => page.items) ?? []

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

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box mb={4}>
          <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
            Payment History
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View and manage all payment records
          </Typography>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Filters
            </Typography>
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
            </Typography>
          </CardContent>

          {allPayments.length === 0 ? (
            <Box py={8} textAlign="center">
              <Typography variant="body1" color="text.secondary">
                No payments found
              </Typography>
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
                            onClick={() => router.push(`/invoices/${payment.invoice.id}` as any)}
                            sx={{ textTransform: 'none', fontWeight: 500 }}
                          >
                            {payment.invoice.invoiceNumber}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {payment.invoice.client.name}
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
                              onClick={() => router.push(`/invoices/${payment.invoice.id}` as any)}
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