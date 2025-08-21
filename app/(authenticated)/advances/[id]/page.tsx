'use client'

import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  Breadcrumbs,
  Link,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  AttachMoney as AttachMoneyIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { enqueueSnackbar } from 'notistack'
import NextLink from 'next/link'
import { useState } from 'react'

export default function AdvanceReceiptDetailPage() {
  const params = useParams() as { id: string }
  const router = useRouter()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  // Fetch advance receipt details
  const { data: receipt, isLoading, error } = api.advanceReceipts.getAdvanceReceiptById.useQuery({
    id: params.id,
  })

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return 'info'
      case 'PARTIALLY_ADJUSTED':
        return 'warning'
      case 'FULLY_ADJUSTED':
        return 'success'
      case 'REFUNDED':
        return 'default'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return <AccountBalanceIcon />
      case 'PARTIALLY_ADJUSTED':
        return <WarningIcon />
      case 'FULLY_ADJUSTED':
        return <CheckCircleIcon />
      case 'REFUNDED':
        return <ScheduleIcon />
      default:
        return null
    }
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  // Generate PDF mutation
  const generatePDFMutation = api.advanceReceipts.generatePDF.useMutation({
    onSuccess: (data) => {
      if (data.pdfUrl) {
        // Open PDF in new tab
        window.open(data.pdfUrl, '_blank')
        enqueueSnackbar('PDF generated successfully', { variant: 'success' })
      }
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to generate PDF: ${error.message}`, { variant: 'error' })
    },
  })

  const handleDownloadPDF = () => {
    generatePDFMutation.mutate({ id: params.id })
    handleMenuClose()
  }

  const handlePrint = () => {
    window.print()
    handleMenuClose()
  }

  if (isLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (error || !receipt) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          {error?.message || 'Advance receipt not found'}
        </Alert>
      </Container>
    )
  }

  const unadjustedAmount = Number(receipt.unadjustedAmount)
  const adjustedAmount = Number(receipt.adjustedAmount)

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link component={NextLink} href="/dashboard" color="inherit" underline="hover">
            Dashboard
          </Link>
          <Link component={NextLink} href="/advances" color="inherit" underline="hover">
            Advance Receipts
          </Link>
          <Typography color="text.primary">{receipt.receiptNumber}</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => router.push('/advances')}>
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h4" gutterBottom>
                {receipt.receiptNumber}
              </Typography>
              <Chip
                label={receipt.status.replace('_', ' ')}
                color={getStatusColor(receipt.status) as any}
                icon={getStatusIcon(receipt.status) as any}
                size="small"
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {unadjustedAmount > 0 && (
              <Button
                variant="contained"
                startIcon={<AttachMoneyIcon />}
                onClick={() => router.push(`/advances/${params.id}/adjust`)}
              >
                Adjust Against Invoice
              </Button>
            )}
            <IconButton onClick={handleMenuOpen}>
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleDownloadPDF}>
                <DownloadIcon sx={{ mr: 1 }} fontSize="small" />
                Download PDF
              </MenuItem>
              <MenuItem onClick={handlePrint}>
                <PrintIcon sx={{ mr: 1 }} fontSize="small" />
                Print
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Receipt Details */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Receipt Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Receipt Date
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(receipt.receiptDate), 'dd MMM yyyy')}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Payment Mode
                  </Typography>
                  <Typography variant="body1">
                    {receipt.paymentMode}
                  </Typography>
                </Grid>
                
                {receipt.bankReference && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Bank Reference
                    </Typography>
                    <Typography variant="body1">
                      {receipt.bankReference}
                    </Typography>
                  </Grid>
                )}
                
                {receipt.bankName && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Bank Name
                    </Typography>
                    <Typography variant="body1">
                      {receipt.bankName}
                    </Typography>
                  </Grid>
                )}
                
                {receipt.chequeNumber && (
                  <>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Cheque Number
                      </Typography>
                      <Typography variant="body1">
                        {receipt.chequeNumber}
                      </Typography>
                    </Grid>
                    {receipt.chequeDate && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Cheque Date
                        </Typography>
                        <Typography variant="body1">
                          {format(new Date(receipt.chequeDate), 'dd MMM yyyy')}
                        </Typography>
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            </Paper>

            {/* Client Information */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Client Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Client Name
                  </Typography>
                  <Typography variant="body1">
                    {receipt.client.name}
                  </Typography>
                </Grid>
                {receipt.client.company && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Company
                    </Typography>
                    <Typography variant="body1">
                      {receipt.client.company}
                    </Typography>
                  </Grid>
                )}
                <Grid size={12}>
                  <Typography variant="caption" color="text.secondary">
                    Address
                  </Typography>
                  <Typography variant="body1">
                    {receipt.client.address}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Adjustment History */}
            {receipt.adjustments && receipt.adjustments.length > 0 && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Adjustment History
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <TableContainer>
                  <Table>
                    <TableBody>
                      {receipt.adjustments.map((adjustment) => (
                        <TableRow key={adjustment.id}>
                          <TableCell>
                            <Typography variant="body2">
                              {format(new Date(adjustment.adjustmentDate), 'dd MMM yyyy')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              Invoice: {adjustment.invoice.invoiceNumber}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(Number(adjustment.adjustedAmount), receipt.currency)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}
          </Grid>

          {/* Amount Summary */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Amount Summary
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Original Amount
                    </Typography>
                    <Typography variant="h5">
                      {formatCurrency(Number(receipt.amount), receipt.currency)}
                    </Typography>
                    {receipt.currency !== 'INR' && (
                      <Typography variant="caption" color="text.secondary">
                        {formatCurrency(Number(receipt.amountINR), 'INR')} @ {Number(receipt.exchangeRate).toFixed(4)}
                      </Typography>
                    )}
                  </Box>
                  
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Adjusted Amount
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {formatCurrency(adjustedAmount, receipt.currency)}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Unadjusted Balance
                    </Typography>
                    <Typography variant="h6" color={unadjustedAmount > 0 ? 'warning.main' : 'text.disabled'}>
                      {formatCurrency(unadjustedAmount, receipt.currency)}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* GST Information (if applicable) */}
            {receipt.isGSTApplicable && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    GST Details
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">
                        GST Rate
                      </Typography>
                      <Typography variant="body2">
                        {Number(receipt.gstRate)}%
                      </Typography>
                    </Box>
                    
                    {receipt.igstAmount && Number(receipt.igstAmount) > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          IGST
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(Number(receipt.igstAmount), 'INR')}
                        </Typography>
                      </Box>
                    )}
                    
                    {receipt.cgstAmount && Number(receipt.cgstAmount) > 0 && (
                      <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            CGST
                          </Typography>
                          <Typography variant="body2">
                            {formatCurrency(Number(receipt.cgstAmount), 'INR')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            SGST
                          </Typography>
                          <Typography variant="body2">
                            {formatCurrency(Number(receipt.sgstAmount || 0), 'INR')}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {receipt.notes && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Notes
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    {receipt.notes}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </Box>
    </Container>
  )
}