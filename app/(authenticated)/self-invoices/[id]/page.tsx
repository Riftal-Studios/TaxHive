'use client'

import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Card,
  CardContent,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  Receipt as VoucherIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { format, differenceInDays } from 'date-fns'
import { formatCurrency } from '@/lib/invoice-utils'
import { toSafeNumber } from '@/lib/utils/decimal'

export default function SelfInvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: invoice, isLoading, error } = api.selfInvoices.getById.useQuery({ id })

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading self-invoice: {error.message}
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/self-invoices')}
        >
          Back to Self Invoices
        </Button>
      </Container>
    )
  }

  if (!invoice) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Self-invoice not found
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/self-invoices')}
        >
          Back to Self Invoices
        </Button>
      </Container>
    )
  }

  const cgstAmount = toSafeNumber(invoice.cgstAmount)
  const sgstAmount = toSafeNumber(invoice.sgstAmount)
  const totalTax = cgstAmount + sgstAmount
  const isIntrastate = cgstAmount > 0

  // Calculate 30-day rule compliance
  const daysDiff = invoice.dateOfReceiptOfSupply
    ? differenceInDays(new Date(invoice.invoiceDate), new Date(invoice.dateOfReceiptOfSupply))
    : null

  const getRCMStatusColor = () => {
    if (!daysDiff) return 'warning'
    if (daysDiff > 30) return 'error'
    if (daysDiff > 25) return 'warning'
    return 'success'
  }

  const getRCMStatusLabel = () => {
    if (!daysDiff) return 'No Receipt Date'
    if (daysDiff > 30) return `${daysDiff - 30} days overdue`
    if (daysDiff > 25) return `${30 - daysDiff} days remaining`
    return 'Compliant'
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Button
            startIcon={<BackIcon />}
            onClick={() => router.push('/self-invoices')}
            sx={{ mb: 2 }}
          >
            Back to Self Invoices
          </Button>
          <Typography variant="h4" component="h1" fontWeight={600}>
            {invoice.invoiceNumber}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Self Invoice under RCM - Section 31(3)(f)
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => window.open(`/api/invoices/${invoice.id}/download`, '_blank')}
          >
            Download PDF
          </Button>
          {invoice.paymentVoucher && (
            <Button
              variant="outlined"
              startIcon={<VoucherIcon />}
              onClick={() => window.open(`/api/payment-vouchers/${invoice.paymentVoucher!.id}/download`, '_blank')}
            >
              Payment Voucher
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => router.push(`/self-invoices/${invoice.id}/edit`)}
          >
            Edit
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Status Cards */}
        <Grid size={{ xs: 12 }}>
          <Stack direction="row" spacing={2}>
            <Chip
              label={invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}
              color={invoice.status === 'FINALIZED' ? 'success' : 'default'}
              variant="outlined"
            />
            <Chip
              label={getRCMStatusLabel()}
              color={getRCMStatusColor()}
            />
            <Chip
              label="RCM Applicable"
              color="info"
              variant="outlined"
            />
          </Stack>
        </Grid>

        {/* Invoice Details */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Invoice Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Invoice Number
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {invoice.invoiceNumber}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Invoice Date
                </Typography>
                <Typography variant="body1">
                  {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Date of Receipt
                </Typography>
                <Typography variant="body1">
                  {invoice.dateOfReceiptOfSupply
                    ? format(new Date(invoice.dateOfReceiptOfSupply), 'dd MMM yyyy')
                    : 'Not specified'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  GST Rate
                </Typography>
                <Typography variant="body1">
                  {toSafeNumber(invoice.cgstRate) * 2}%
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Supplier Details */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Supplier Details (Unregistered)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {invoice.unregisteredSupplier ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="text.secondary">
                    Name
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {invoice.unregisteredSupplier.name}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="text.secondary">
                    Address
                  </Typography>
                  <Typography variant="body1">
                    {invoice.unregisteredSupplier.address}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    State
                  </Typography>
                  <Typography variant="body1">
                    {invoice.unregisteredSupplier.state} ({invoice.unregisteredSupplier.stateCode})
                  </Typography>
                </Grid>
                {invoice.unregisteredSupplier.pan && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      PAN
                    </Typography>
                    <Typography variant="body1">
                      {invoice.unregisteredSupplier.pan}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Supplier details not available
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Line Items */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Line Items
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell>SAC Code</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoice.lineItems?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.serviceCode || '-'}</TableCell>
                      <TableCell align="right">{toSafeNumber(item.quantity)}</TableCell>
                      <TableCell align="right">{formatCurrency(toSafeNumber(item.rate), 'INR')}</TableCell>
                      <TableCell align="right">{formatCurrency(toSafeNumber(item.amount), 'INR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Tax Summary */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tax Summary
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Subtotal
                  </Typography>
                  <Typography variant="body1">
                    {formatCurrency(toSafeNumber(invoice.subtotal), 'INR')}
                  </Typography>
                </Box>
                {isIntrastate ? (
                  <>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        CGST ({toSafeNumber(invoice.cgstRate)}%)
                      </Typography>
                      <Typography variant="body1">
                        {formatCurrency(cgstAmount, 'INR')}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        SGST ({toSafeNumber(invoice.sgstRate)}%)
                      </Typography>
                      <Typography variant="body1">
                        {formatCurrency(sgstAmount, 'INR')}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      IGST ({toSafeNumber(invoice.cgstRate) * 2}%)
                    </Typography>
                    <Typography variant="body1">
                      {formatCurrency(totalTax, 'INR')}
                    </Typography>
                  </Box>
                )}
                <Divider />
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body1" fontWeight={600}>
                    Total Amount
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="primary.main">
                    {formatCurrency(toSafeNumber(invoice.totalAmount), 'INR')}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* RCM & ITC Summary */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                RCM & ITC Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    RCM Liability (GSTR-3B Table 3.1(d))
                  </Typography>
                  <Typography variant="body1" color="error.main" fontWeight={500}>
                    {formatCurrency(toSafeNumber(invoice.rcmLiability), 'INR')}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    ITC Claimable (GSTR-3B Table 4A(3))
                  </Typography>
                  <Typography variant="body1" color="success.main" fontWeight={500}>
                    {formatCurrency(toSafeNumber(invoice.itcClaimable), 'INR')}
                  </Typography>
                </Box>
                <Divider />
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Net Tax Impact
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {formatCurrency(0, 'INR')}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  RCM paid equals ITC claimed, resulting in zero net tax impact
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Voucher */}
        {invoice.paymentVoucher && (
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Payment Voucher
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Voucher Number
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {invoice.paymentVoucher.voucherNumber}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Voucher Date
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(invoice.paymentVoucher.voucherDate), 'dd MMM yyyy')}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Payment Mode
                  </Typography>
                  <Typography variant="body1">
                    {invoice.paymentVoucher.paymentMode.replace(/_/g, ' ')}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {formatCurrency(toSafeNumber(invoice.paymentVoucher.amount), 'INR')}
                  </Typography>
                </Grid>
                {invoice.paymentVoucher.paymentReference && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" color="text.secondary">
                      Payment Reference
                    </Typography>
                    <Typography variant="body1">
                      {invoice.paymentVoucher.paymentReference}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Notes */}
        {invoice.notes && (
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Notes
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" whiteSpace="pre-wrap">
                {invoice.notes}
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  )
}
