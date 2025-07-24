'use client'

import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Skeleton,
  Box,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  Visibility,
  Payment,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: Date | string
  amount: number
  status: string
  clientName: string
  companyName: string | null
}

interface RecentInvoicesProps {
  invoices: Invoice[]
  loading?: boolean
}

const statusColors = {
  draft: 'default',
  sent: 'info',
  viewed: 'warning',
  paid: 'success',
  overdue: 'error',
  cancelled: 'default',
} as const

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function MUIRecentInvoices({ invoices, loading = false }: RecentInvoicesProps) {
  const router = useRouter()

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Recent Invoices
          </Typography>
          <Box>
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} variant="rectangular" height={60} sx={{ mb: 1 }} />
            ))}
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Recent Invoices
          </Typography>
          <Box 
            sx={{ 
              py: 8, 
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body1">
              No invoices found
            </Typography>
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={() => router.push('/invoices/new' as any)}
            >
              Create First Invoice
            </Button>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={600}>
            Recent Invoices
          </Typography>
          <Button
            size="small"
            onClick={() => router.push('/invoices' as any)}
          >
            View All
          </Button>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Invoice #</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Invoice Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {invoice.invoiceNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {invoice.clientName}
                    </Typography>
                    {invoice.companyName && (
                      <Typography variant="caption" color="text.secondary">
                        {invoice.companyName}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {formatCurrency(invoice.amount, 'INR')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      size="small"
                      color={statusColors[invoice.status as keyof typeof statusColors] || 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" gap={0.5} justifyContent="flex-end">
                      <Tooltip title="View Invoice">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/invoices/${invoice.id}` as any)}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                        <Tooltip title="Record Payment">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/invoices/${invoice.id}#payment` as any)}
                          >
                            <Payment fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}