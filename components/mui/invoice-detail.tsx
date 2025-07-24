'use client'

import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Paper,
  Alert,
  Skeleton,
  Divider,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  Edit as EditIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { formatCurrency, formatINR } from '@/lib/invoice-utils'
import { MUIInvoiceActions } from './invoice-actions'
import { EnhancedPaymentModal as MUIPaymentModal } from './enhanced-payment-modal'
import { format } from 'date-fns'

interface InvoiceDetailProps {
  invoiceId: string
}

export function MUIInvoiceDetail({ invoiceId }: InvoiceDetailProps) {
  const router = useRouter()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const { data: invoice, isLoading, refetch } = api.invoices.getById.useQuery({ id: invoiceId })
  const { data: payments } = api.payments.getByInvoice.useQuery({ invoiceId })

  if (isLoading) {
    return (
      <Box>
        <Box mb={4}>
          <Skeleton variant="text" width={300} height={40} />
          <Skeleton variant="text" width={200} height={24} />
        </Box>
        <Card>
          <CardContent>
            <Skeleton variant="rectangular" height={600} />
          </CardContent>
        </Card>
      </Box>
    )
  }

  if (!invoice) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Invoice not found</Typography>
          <Button
            variant="contained"
            color="error"
            size="small"
            onClick={() => router.push('/invoices')}
            sx={{ mt: 1 }}
          >
            Back to Invoices
          </Button>
        </Alert>
      </Box>
    )
  }

  // Type assertion to include relations
  const typedInvoice = invoice as typeof invoice & {
    client: {
      id: string
      name: string
      email: string
      company: string | null
      address: string
      country: string
      taxId: string | null
    }
    lineItems: Array<{
      id: string
      description: string
      quantity: any
      rate: any
      amount: any
      serviceCode: string
    }>
    lut: {
      id: string
      lutNumber: string
      validTill: Date
    } | null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'success'
      case 'SENT':
        return 'info'
      case 'OVERDUE':
        return 'error'
      default:
        return 'default'
    }
  }

  const getPaymentStatusColor = (status: string) => {
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

  return (
    <Box>
      {/* Header */}
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
            Invoice #{typedInvoice.invoiceNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Created on {format(new Date(typedInvoice.createdAt), 'dd MMM yyyy')}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => router.push(`/invoices/${typedInvoice.id}/edit` as any)}
          >
            Edit
          </Button>
          <MUIInvoiceActions
            invoiceId={typedInvoice.id}
            invoiceNumber={typedInvoice.invoiceNumber}
            pdfUrl={typedInvoice.pdfUrl}
            clientEmail={typedInvoice.client.email}
            clientName={typedInvoice.client.name}
          />
        </Box>
      </Box>

      <Card>
        <CardContent sx={{ p: 4 }}>
          {/* Invoice Header Info */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h6" gutterBottom>Bill To</Typography>
              <Box color="text.secondary">
                <Typography variant="body1" fontWeight={500} color="text.primary">
                  {typedInvoice.client.name}
                </Typography>
                {typedInvoice.client.company && (
                  <Typography variant="body2">{typedInvoice.client.company}</Typography>
                )}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {typedInvoice.client.address}
                </Typography>
                <Typography variant="body2">{typedInvoice.client.country}</Typography>
                {typedInvoice.client.taxId && (
                  <Typography variant="body2">Tax ID: {typedInvoice.client.taxId}</Typography>
                )}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box textAlign={{ xs: 'left', md: 'right' }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, md: 8 }} textAlign="right">
                    <Typography variant="body2" fontWeight={500}>Invoice Date:</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 4 }} textAlign="right">
                    <Typography variant="body2">
                      {format(new Date(typedInvoice.invoiceDate), 'dd MMM yyyy')}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 8 }} textAlign="right">
                    <Typography variant="body2" fontWeight={500}>Due Date:</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 4 }} textAlign="right">
                    <Typography variant="body2">
                      {format(new Date(typedInvoice.dueDate), 'dd MMM yyyy')}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 8 }} textAlign="right">
                    <Typography variant="body2" fontWeight={500}>Status:</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 4 }} textAlign="right">
                    <Chip
                      label={typedInvoice.status}
                      color={getStatusColor(typedInvoice.status) as any}
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 8 }} textAlign="right">
                    <Typography variant="body2" fontWeight={500}>Payment Status:</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 4 }} textAlign="right">
                    <Chip
                      label={
                        typedInvoice.paymentStatus === 'PARTIALLY_PAID' ? 'Partially Paid' :
                        typedInvoice.paymentStatus === 'UNPAID' ? 'Unpaid' : 'Paid'
                      }
                      color={getPaymentStatusColor(typedInvoice.paymentStatus) as any}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* GST Information */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Place of Supply: <strong>{typedInvoice.placeOfSupply}</strong>
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Service Code: <strong>{typedInvoice.serviceCode}</strong>
                </Typography>
              </Grid>
              {typedInvoice.lut && (
                <Grid size={12}>
                  <Typography variant="body2" color="text.secondary">
                    LUT: <strong>{typedInvoice.lut.lutNumber}</strong> (Valid till{' '}
                    {format(new Date(typedInvoice.lut.validTill), 'dd MMM yyyy')})
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>

          {/* Exchange Rate */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Exchange Rate: 1 {typedInvoice.currency} = {formatINR(Number(typedInvoice.exchangeRate))}
              <Box component="span" sx={{ ml: 1, color: 'text.secondary' }}>
                ({typedInvoice.exchangeSource} as on{' '}
                {format(new Date(typedInvoice.invoiceDate), 'dd MMM yyyy')})
              </Box>
            </Typography>
          </Alert>

          {/* Line Items */}
          <TableContainer sx={{ mb: 4 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Amount ({typedInvoice.currency})</TableCell>
                  <TableCell align="right">Amount (INR)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {typedInvoice.lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell align="right">{item.quantity.toString()}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(Number(item.rate), typedInvoice.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(Number(item.amount), typedInvoice.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatINR(Number(item.amount) * Number(typedInvoice.exchangeRate))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Totals */}
          <Box display="flex" justifyContent="flex-end">
            <Box width={{ xs: '100%', sm: 400 }}>
              <Paper variant="outlined" sx={{ p: 3 }}>
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                  </Grid>
                  <Grid size={6} sx={{ textAlign: "right" }}>
                    <Typography variant="body2">
                      {formatCurrency(Number(typedInvoice.subtotal), typedInvoice.currency)} /{' '}
                      {formatINR(Number(typedInvoice.subtotal) * Number(typedInvoice.exchangeRate))}
                    </Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">
                      IGST @ {typedInvoice.igstRate.toString()}%:
                    </Typography>
                  </Grid>
                  <Grid size={6} sx={{ textAlign: "right" }}>
                    <Typography variant="body2">
                      {formatCurrency(Number(typedInvoice.igstAmount), typedInvoice.currency)} /{' '}
                      {formatINR(Number(typedInvoice.igstAmount) * Number(typedInvoice.exchangeRate))}
                    </Typography>
                  </Grid>
                  <Grid size={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body1" fontWeight={600}>Total:</Typography>
                  </Grid>
                  <Grid size={6} sx={{ textAlign: "right" }}>
                    <Typography variant="body1" fontWeight={600}>
                      {formatCurrency(Number(typedInvoice.totalAmount), typedInvoice.currency)} /{' '}
                      {formatINR(Number(typedInvoice.totalAmount) * Number(typedInvoice.exchangeRate))}
                    </Typography>
                  </Grid>

                  {/* Payment Information */}
                  {(typedInvoice.paymentStatus === 'PARTIALLY_PAID' || typedInvoice.paymentStatus === 'PAID') && (
                    <>
                      <Grid size={12}>
                        <Divider sx={{ my: 1 }} />
                      </Grid>
                      <Grid size={6}>
                        <Typography variant="body2" color="text.secondary">Amount Paid:</Typography>
                      </Grid>
                      <Grid size={6} sx={{ textAlign: "right" }}>
                        <Typography variant="body2" color="success.main">
                          {formatCurrency(Number(typedInvoice.amountPaid), typedInvoice.currency)}
                        </Typography>
                      </Grid>
                    </>
                  )}

                  {typedInvoice.paymentStatus !== 'PAID' && (
                    <>
                      <Grid size={6}>
                        <Typography variant="body2" fontWeight={500} color="error.main">
                          Balance Due:
                        </Typography>
                      </Grid>
                      <Grid size={6} sx={{ textAlign: "right" }}>
                        <Typography variant="body2" fontWeight={500} color="error.main">
                          {formatCurrency(Number(typedInvoice.balanceDue), typedInvoice.currency)}
                        </Typography>
                      </Grid>
                    </>
                  )}

                  {/* Record Payment Button */}
                  {typedInvoice.paymentStatus !== 'PAID' && (
                    <Grid size={12}>
                      <Button
                        fullWidth
                        variant="contained"
                        color="success"
                        onClick={() => setShowPaymentModal(true)}
                        sx={{ mt: 2 }}
                      >
                        Record Payment
                      </Button>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Box>
          </Box>

          {/* Notes */}
          {typedInvoice.notes && (
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>Notes</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                {typedInvoice.notes}
              </Typography>
            </Box>
          )}

          {/* Payment History */}
          {payments && payments.length > 0 && (
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>Payment History</Typography>
              <Grid container spacing={2}>
                {payments.map((payment) => (
                  <Grid size={12} key={payment.id}>
                    <Paper variant="outlined" sx={{ p: 3 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box flex={1}>
                          <Typography variant="body1" fontWeight={500}>
                            {formatCurrency(Number(payment.amount), payment.currency)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {format(new Date(payment.paymentDate), 'dd MMM yyyy')} via {payment.paymentMethod}
                          </Typography>
                          {payment.reference && (
                            <Typography variant="body2" color="text.secondary">
                              Ref: {payment.reference}
                            </Typography>
                          )}
                          
                          {/* Payment Flow Details */}
                          {(payment as any).amountReceivedBeforeFees && (
                            <Box mt={1} p={1.5} bgcolor="background.default" borderRadius={1}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Amount Received:</strong> {formatCurrency(Number((payment as any).amountReceivedBeforeFees), payment.currency)}
                                {(payment as any).platformFeesInCurrency && ` (Platform fees: ${payment.currency} ${Number((payment as any).platformFeesInCurrency).toFixed(2)})`}
                              </Typography>
                            </Box>
                          )}
                          
                          {/* Bank Credit Details */}
                          {(payment as any).creditedAmount && (
                            <Box mt={1} p={1.5} bgcolor="background.default" borderRadius={1}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Bank Credit:</strong> {formatINR(Number((payment as any).creditedAmount))}
                              </Typography>
                              {(payment as any).actualExchangeRate && (
                                <Typography variant="body2" color="text.secondary">
                                  <strong>Exchange Rate Applied:</strong> 1 {payment.currency} = ₹{Number((payment as any).actualExchangeRate).toFixed(4)}
                                </Typography>
                              )}
                              {(payment as any).bankChargesInr && (
                                <Typography variant="body2" color="text.secondary">
                                  <strong>Bank Charges:</strong> {formatINR(Number((payment as any).bankChargesInr))}
                                </Typography>
                              )}
                              {(payment as any).fircNumber && (
                                <Typography variant="body2" color="text.secondary">
                                  <strong>FIRC:</strong> {(payment as any).fircNumber}
                                  {(payment as any).fircDate && ` (${format(new Date((payment as any).fircDate), 'dd MMM yyyy')})`}
                                  {(payment as any).fircDocumentUrl && (
                                    <Button
                                      size="small"
                                      variant="text"
                                      href={(payment as any).fircDocumentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      sx={{ ml: 1, py: 0, minHeight: 'auto' }}
                                    >
                                      View Document
                                    </Button>
                                  )}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                          Recorded on {format(new Date(payment.createdAt), 'dd MMM yyyy')}
                        </Typography>
                      </Box>
                      {payment.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                          <strong>Notes:</strong> {payment.notes}
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <MUIPaymentModal
        invoiceId={typedInvoice.id}
        invoiceNumber={typedInvoice.invoiceNumber}
        currency={typedInvoice.currency}
        totalAmount={Number(typedInvoice.totalAmount)}
        amountPaid={Number(typedInvoice.amountPaid)}
        balanceDue={Number(typedInvoice.balanceDue)}
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          refetch()
          setShowPaymentModal(false)
        }}
      />
    </Box>
  )
}