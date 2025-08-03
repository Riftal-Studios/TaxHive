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
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  Edit as EditIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  Cancel as CancelIcon,
  Description as DraftIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { formatCurrency, formatINR } from '@/lib/invoice-utils'
import { MUIInvoiceActions } from './invoice-actions'
import { EnhancedPaymentModal as MUIPaymentModal } from './enhanced-payment-modal'
import { EditPaymentModal } from './edit-payment-modal'
import { format } from 'date-fns'
import { toSafeNumber } from '@/lib/utils/decimal'

// Define proper types for the invoice with relations
interface InvoiceWithRelations {
  id: string
  invoiceNumber: string
  createdAt: Date
  invoiceDate: Date
  dueDate: Date
  status: string
  paymentStatus: string
  pdfUrl: string | null
  currency: string
  exchangeRate: number
  exchangeSource: string
  subtotal: number
  igstAmount: number
  totalAmount: number
  amountPaid: number
  balanceDue: number
  notes: string | null
  bankDetails: string | null
  placeOfSupply: string
  serviceCode: string
  igstRate: number
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
    quantity: {
      toNumber: () => number
    }
    rate: {
      toNumber: () => number
    }
    amount: {
      toNumber: () => number
    }
    serviceCode: string
  }>
  lut: {
    id: string
    lutNumber: string
    validTill: Date
  } | null
}


interface InvoiceDetailProps {
  invoiceId: string
}

export function MUIInvoiceDetail({ invoiceId }: InvoiceDetailProps) {
  const router = useRouter()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false)
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedPayment, setSelectedPayment] = useState<{
    id: string
    amount: number | { toNumber: () => number }
    currency: string
    paymentDate: string | Date
    paymentMethod: string
    reference?: string | null
    notes?: string | null
    amountReceivedBeforeFees?: number | { toNumber: () => number } | null
    platformFeesInCurrency?: number | { toNumber: () => number } | null
    creditedAmount?: number | { toNumber: () => number } | null
    actualExchangeRate?: number | { toNumber: () => number } | null
    bankChargesInr?: number | { toNumber: () => number } | null
    fircNumber?: string | null
    fircDate?: string | Date | null
    fircDocumentUrl?: string | null
    createdAt: string | Date
  } | null>(null)
  const { 
    data: invoice, 
    isLoading, 
    error, 
    refetch 
  } = api.invoices.getById.useQuery({ id: invoiceId, includePayments: true })
  const { data: payments } = api.payments.getByInvoice.useQuery({ invoiceId })
  
  const updateStatusMutation = api.invoices.updateStatus.useMutation({
    onSuccess: () => {
      refetch()
      setStatusMenuAnchor(null)
    },
  })

  const handlePrint = () => {
    window.print()
  }
  
  const handleStatusClick = (event: React.MouseEvent<HTMLElement>) => {
    setStatusMenuAnchor(event.currentTarget)
  }
  
  const handleStatusClose = () => {
    setStatusMenuAnchor(null)
  }
  
  const handleStatusUpdate = (newStatus: string) => {
    if (invoice) {
      updateStatusMutation.mutate({
        id: invoice.id,
        status: newStatus as 'DRAFT' | 'SENT' | 'CANCELLED',
      })
    }
  }

  const handleDownloadPDF = () => {
    if (invoice?.pdfUrl) {
      const link = document.createElement('a')
      link.href = invoice.pdfUrl
      link.download = `invoice-${invoice.invoiceNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleEditPayment = (payment: {
    id: string
    amount: number | { toNumber: () => number }
    currency: string
    paymentDate: string | Date
    paymentMethod: string
    reference?: string | null
    notes?: string | null
    amountReceivedBeforeFees?: number | { toNumber: () => number } | null
    platformFeesInCurrency?: number | { toNumber: () => number } | null
    creditedAmount?: number | { toNumber: () => number } | null
    actualExchangeRate?: number | { toNumber: () => number } | null
    bankChargesInr?: number | { toNumber: () => number } | null
    fircNumber?: string | null
    fircDate?: string | Date | null
    fircDocumentUrl?: string | null
    createdAt: string | Date
  }) => {
    setSelectedPayment(payment)
    setShowEditPaymentModal(true)
  }

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

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Error Loading Invoice</Typography>
          <Typography variant="body2">{error.message}</Typography>
          <Button
            variant="contained"
            color="error"
            size="small"
            onClick={() => router.push('/invoices')}
            sx={{ mt: 2 }}
          >
            Back to Invoices
          </Button>
        </Alert>
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

  // Type guard to check if invoice has required relations
  const isInvoiceWithRelations = (invoice: unknown): invoice is InvoiceWithRelations => {
    return (
      invoice !== null &&
      typeof invoice === 'object' &&
      'id' in invoice &&
      typeof invoice.id === 'string' &&
      'invoiceNumber' in invoice &&
      typeof invoice.invoiceNumber === 'string' &&
      'client' in invoice &&
      invoice.client !== null &&
      typeof invoice.client === 'object' &&
      'id' in invoice.client &&
      typeof invoice.client.id === 'string' &&
      'lineItems' in invoice &&
      Array.isArray(invoice.lineItems)
    )
  }

  if (!isInvoiceWithRelations(invoice)) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Invalid invoice data</Typography>
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

  const typedInvoice = invoice

  type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'

  // Invoice Status: User-controlled workflow state (DRAFT, SENT, CANCELLED)
  const getStatusColor = (status: string): ChipColor => {
    switch (status) {
      case 'SENT':
        return 'info'
      case 'CANCELLED':
        return 'error'
      case 'DRAFT':
        return 'default'
      default:
        return 'default'
    }
  }

  // Payment Status: System-managed based on actual payments (PAID, PARTIALLY_PAID, UNPAID, OVERDUE)
  const getPaymentStatusColor = (status: string): ChipColor => {
    switch (status) {
      case 'PAID':
        return 'success'
      case 'PARTIALLY_PAID':
        return 'warning'
      case 'UNPAID':
        return 'error'
      case 'OVERDUE':
        return 'error'
      default:
        return 'default'
    }
  }
  
  // Compute effective payment status including OVERDUE
  const getEffectivePaymentStatus = (paymentStatus: string, dueDate: Date): string => {
    if (paymentStatus === 'PAID') {
      return 'PAID'
    }
    
    const now = new Date()
    const due = new Date(dueDate)
    
    if (now > due && (paymentStatus === 'UNPAID' || paymentStatus === 'PARTIALLY_PAID')) {
      return 'OVERDUE'
    }
    
    return paymentStatus
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
            onClick={() => router.push(`/invoices/${typedInvoice.id}/edit`)}
            aria-label="Edit invoice"
          >
            Edit
          </Button>
          <Tooltip title="Print invoice">
            <IconButton
              onClick={handlePrint}
              aria-label="Print invoice"
            >
              <PrintIcon />
            </IconButton>
          </Tooltip>
          {typedInvoice.pdfUrl && (
            <Tooltip title="Download PDF">
              <IconButton
                onClick={handleDownloadPDF}
                aria-label="Download PDF"
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          )}
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
                    <Tooltip title="Click to update status">
                      <Chip
                        label={typedInvoice.status}
                        color={getStatusColor(typedInvoice.status)}
                        size="small"
                        onClick={handleStatusClick}
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': {
                            filter: 'brightness(0.9)',
                          }
                        }}
                      />
                    </Tooltip>
                  </Grid>
                  <Grid size={{ xs: 6, md: 8 }} textAlign="right">
                    <Typography variant="body2" fontWeight={500}>Payment Status:</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, md: 4 }} textAlign="right">
                    <Chip
                      label={
                        (() => {
                          const effectiveStatus = getEffectivePaymentStatus(typedInvoice.paymentStatus, typedInvoice.dueDate)
                          switch (effectiveStatus) {
                            case 'PARTIALLY_PAID': return 'Partially Paid'
                            case 'UNPAID': return 'Unpaid'
                            case 'OVERDUE': return 'Overdue'
                            case 'PAID': return 'Paid'
                            default: return effectiveStatus
                          }
                        })()
                      }
                      color={getPaymentStatusColor(getEffectivePaymentStatus(typedInvoice.paymentStatus, typedInvoice.dueDate))}
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
                    <TableCell align="right">{toSafeNumber(item.quantity)}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(toSafeNumber(item.rate), typedInvoice.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(toSafeNumber(item.amount), typedInvoice.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatINR(toSafeNumber(item.amount) * Number(typedInvoice.exchangeRate))}
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
                        aria-label="Record payment"
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

          {/* Bank Details */}
          {typedInvoice.bankDetails && (
            <Box mt={4}>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: 'primary.50' }}>
                <Typography variant="h6" gutterBottom color="primary.main">Bank Details</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {typedInvoice.bankDetails}
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Payment History */}
          {payments && payments.length > 0 && (
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>Payment History</Typography>
              <Grid container spacing={2}>
                {payments?.map((payment) => (
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
                          {payment.amountReceivedBeforeFees && (
                            <Box mt={1} p={1.5} bgcolor="background.default" borderRadius={1}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Amount Received:</strong> {formatCurrency(Number(payment.amountReceivedBeforeFees), payment.currency)}
                                {payment.platformFeesInCurrency && ` (Platform fees: ${payment.currency} ${Number(payment.platformFeesInCurrency).toFixed(2)})`}
                              </Typography>
                            </Box>
                          )}
                          
                          {/* Bank Credit Details */}
                          {payment.creditedAmount && (
                            <Box mt={1} p={1.5} bgcolor="background.default" borderRadius={1}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Bank Credit:</strong> {formatINR(Number(payment.creditedAmount))}
                              </Typography>
                              {payment.actualExchangeRate && (
                                <Typography variant="body2" color="text.secondary">
                                  <strong>Exchange Rate Applied:</strong> 1 {payment.currency} = ₹{Number(payment.actualExchangeRate).toFixed(4)}
                                </Typography>
                              )}
                              {payment.bankChargesInr && (
                                <Typography variant="body2" color="text.secondary">
                                  <strong>Bank Charges:</strong> {formatINR(Number(payment.bankChargesInr))}
                                </Typography>
                              )}
                              {payment.fircNumber && (
                                <Typography variant="body2" color="text.secondary">
                                  <strong>FIRC:</strong> {payment.fircNumber}
                                  {payment.fircDate && ` (${format(new Date(payment.fircDate), 'dd MMM yyyy')})`}
                                  {payment.fircDocumentUrl && (
                                    <Button
                                      size="small"
                                      variant="text"
                                      href={payment.fircDocumentUrl}
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
                        <Box display="flex" flexDirection="column" alignItems="flex-end" sx={{ ml: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Recorded on {format(new Date(payment.createdAt), 'dd MMM yyyy')}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleEditPayment(payment)}
                            sx={{ mt: 1 }}
                            aria-label="Edit payment"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
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
        totalAmount={toSafeNumber(typedInvoice.totalAmount)}
        amountPaid={toSafeNumber(typedInvoice.amountPaid)}
        balanceDue={toSafeNumber(typedInvoice.balanceDue)}
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          refetch()
          setShowPaymentModal(false)
        }}
      />

      {/* Edit Payment Modal */}
      {selectedPayment && (
        <EditPaymentModal
          payment={selectedPayment}
          invoiceNumber={typedInvoice.invoiceNumber}
          currency={typedInvoice.currency}
          open={showEditPaymentModal}
          onClose={() => {
            setShowEditPaymentModal(false)
            setSelectedPayment(null)
          }}
          onSuccess={() => {
            refetch()
            setShowEditPaymentModal(false)
            setSelectedPayment(null)
          }}
        />
      )}
      
      {/* Status Update Menu */}
      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={handleStatusClose}
      >
        <MenuItem 
          onClick={() => handleStatusUpdate('DRAFT')}
          disabled={typedInvoice.status === 'DRAFT'}
        >
          <ListItemIcon>
            <DraftIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Draft</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={() => handleStatusUpdate('SENT')}
          disabled={typedInvoice.status === 'SENT'}
        >
          <ListItemIcon>
            <SendIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sent</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={() => handleStatusUpdate('CANCELLED')}
          disabled={typedInvoice.status === 'CANCELLED'}
        >
          <ListItemIcon>
            <CancelIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Cancelled</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  )
}
