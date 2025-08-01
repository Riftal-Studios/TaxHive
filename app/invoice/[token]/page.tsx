'use client'

import { useEffect, useState, use } from 'react'
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Container,
  useTheme
} from '@mui/material'
import Grid from '@mui/material/Grid'
import { Download as DownloadIcon, Print as PrintIcon } from '@mui/icons-material'
import { format } from 'date-fns'

interface PublicInvoicePageProps {
  params: Promise<{ token: string }>
}

export default function PublicInvoicePage({ params }: PublicInvoicePageProps) {
  const { token } = use(params)
  const [invoice, setInvoice] = useState<{
    id: string
    invoiceNumber: string
    invoiceDate: string
    dueDate: string
    status: string
    paymentStatus: string
    currency: string
    exchangeRate: string
    exchangeSource: string
    subtotal: string
    igstRate: string
    igstAmount: string
    totalAmount: string
    totalInINR: string
    balanceDue: string
    placeOfSupply: string
    serviceCode: string
    notes: string | null
    bankDetails: string | null
    publicAccessToken: string
    client: {
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
      quantity: string
      rate: string
      amount: string
    }>
    lut: {
      lutNumber: string
      validTill: string
    } | null
    supplier: {
      name: string | null
      email: string
      gstin: string | null
      pan: string | null
      address: string | null
    }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const theme = useTheme()

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await fetch(`/api/invoices/public/${token}`)
        const data = await response.json()
        
        if (!response.ok) {
          setError(data.error || 'Failed to load invoice')
          return
        }
        
        setInvoice(data.invoice)
      } catch {
        setError('Failed to load invoice')
      } finally {
        setLoading(false)
      }
    }

    fetchInvoice()
  }, [token])

  const handleDownload = () => {
    window.location.href = `/api/invoices/public/${token}/download`
  }

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount)
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>Error</Typography>
          <Typography>{error}</Typography>
        </Alert>
      </Container>
    )
  }

  if (!invoice) {
    return null
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header with actions */}
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="center" className="no-print">
        <Typography variant="h4" component="h1">
          Invoice #{invoice.invoiceNumber}
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
          >
            Print
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
          >
            Download PDF
          </Button>
        </Box>
      </Box>

      <Card>
        <CardContent sx={{ p: 4 }}>
          {/* Invoice Header */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h6" gutterBottom color="primary">From</Typography>
              <Typography variant="h6" fontWeight={600}>
                {invoice.supplier.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                GSTIN: {invoice.supplier.gstin}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                PAN: {invoice.supplier.pan}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mt: 1 }}>
                {invoice.supplier.address}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {invoice.supplier.email}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box textAlign={{ xs: 'left', md: 'right' }}>
                <Typography variant="h3" gutterBottom sx={{ color: theme.palette.primary.main }}>
                  INVOICE
                </Typography>
                <Typography variant="h6" gutterBottom>
                  {invoice.invoiceNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Date: {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Due Date: {format(new Date(invoice.dueDate), 'dd MMM yyyy')}
                </Typography>
                <Box mt={2}>
                  <Chip 
                    label={invoice.paymentStatus === 'PAID' ? 'Paid' : 
                           invoice.paymentStatus === 'PARTIALLY_PAID' ? 'Partially Paid' : 'Unpaid'}
                    color={invoice.paymentStatus === 'PAID' ? 'success' : 
                           invoice.paymentStatus === 'PARTIALLY_PAID' ? 'warning' : 'error'}
                    size="small"
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Bill To */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h6" gutterBottom color="primary">Bill To</Typography>
              <Typography variant="h6" fontWeight={600}>
                {invoice.client.name}
              </Typography>
              {invoice.client.company && (
                <Typography variant="body2">{invoice.client.company}</Typography>
              )}
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mt: 1 }}>
                {invoice.client.address}
              </Typography>
              <Typography variant="body2">{invoice.client.country}</Typography>
              {invoice.client.taxId && (
                <Typography variant="body2" color="text.secondary">
                  Tax ID: {invoice.client.taxId}
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h6" gutterBottom color="primary">Invoice Details</Typography>
              <Typography variant="body2">
                <strong>Place of Supply:</strong> {invoice.placeOfSupply}
              </Typography>
              <Typography variant="body2">
                <strong>Service Code:</strong> {invoice.serviceCode}
              </Typography>
              {invoice.lut && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    LUT: {invoice.lut.lutNumber} (Valid till {format(new Date(invoice.lut.validTill), 'dd MMM yyyy')})
                  </Typography>
                </Alert>
              )}
            </Grid>
          </Grid>

          {/* Exchange Rate Info */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Exchange Rate: 1 {invoice.currency} = {formatINR(Number(invoice.exchangeRate))}
              {' '}({invoice.exchangeSource} as on {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')})
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
                  <TableCell align="right">Amount ({invoice.currency})</TableCell>
                  <TableCell align="right">Amount (INR)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell align="right">{Number(item.quantity)}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(Number(item.rate), invoice.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(Number(item.amount), invoice.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatINR(Number(item.amount) * Number(invoice.exchangeRate))}
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
                      {formatCurrency(Number(invoice.subtotal), invoice.currency)} /{' '}
                      {formatINR(Number(invoice.subtotal) * Number(invoice.exchangeRate))}
                    </Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">
                      IGST @ {Number(invoice.igstRate)}%:
                    </Typography>
                  </Grid>
                  <Grid size={6} sx={{ textAlign: "right" }}>
                    <Typography variant="body2">
                      {formatCurrency(Number(invoice.igstAmount), invoice.currency)} /{' '}
                      {formatINR(Number(invoice.igstAmount) * Number(invoice.exchangeRate))}
                    </Typography>
                  </Grid>
                  <Grid size={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="h6">Total:</Typography>
                  </Grid>
                  <Grid size={6} sx={{ textAlign: "right" }}>
                    <Typography variant="h6">
                      {formatCurrency(Number(invoice.totalAmount), invoice.currency)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatINR(Number(invoice.totalInINR))}
                    </Typography>
                  </Grid>
                  {Number(invoice.balanceDue) > 0 && (
                    <>
                      <Grid size={6}>
                        <Typography variant="body2" color="error">Balance Due:</Typography>
                      </Grid>
                      <Grid size={6} sx={{ textAlign: "right" }}>
                        <Typography variant="body2" color="error" fontWeight={600}>
                          {formatCurrency(Number(invoice.balanceDue), invoice.currency)}
                        </Typography>
                      </Grid>
                    </>
                  )}
                </Grid>
              </Paper>
            </Box>
          </Box>

          {/* Notes */}
          {invoice.notes && (
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>Notes</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {invoice.notes}
              </Typography>
            </Box>
          )}

          {/* Bank Details */}
          {invoice.bankDetails && (
            <Box mt={4}>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: 'primary.50' }}>
                <Typography variant="h6" gutterBottom color="primary.main">Bank Details</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {invoice.bankDetails}
                </Typography>
              </Paper>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </Container>
  )
}