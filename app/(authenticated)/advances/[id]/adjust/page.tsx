'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import {
  Box,
  Container,
  Typography,
  Paper,
  Card,
  CardContent,
  CardHeader,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider,
  LinearProgress,
  Stack,
  Breadcrumbs,
  Link,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  AttachMoney as AttachMoneyIcon,
  Receipt as ReceiptIcon,
  Description as InvoiceIcon,
  SwapHoriz as SwapIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  AutoFixHigh as AutoAdjustIcon,
} from '@mui/icons-material'
import Grid from '@mui/material/Grid'
import { format } from 'date-fns'
import { enqueueSnackbar } from 'notistack'
import NextLink from 'next/link'

interface AdjustPageProps {
  params: {
    id: string
  }
}

export default function AdjustAdvanceReceiptPage({ params }: AdjustPageProps) {
  const router = useRouter()
  const utils = api.useUtils()
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [adjustmentAmounts, setAdjustmentAmounts] = useState<Record<string, string>>({})
  const [remarks, setRemarks] = useState('')

  // Fetch advance receipt details
  const { data: receipt, isLoading: receiptLoading } = api.advanceReceipts.getAdvanceReceiptById.useQuery({
    id: params.id,
  })

  // Fetch unpaid invoices for the client
  const { data: invoices, isLoading: invoicesLoading } = api.invoices.list.useQuery(
    receipt?.clientId
      ? {
          clientId: receipt.clientId,
          status: 'UNPAID' as const,
        }
      : undefined,
    {
      enabled: !!receipt?.clientId,
    }
  )

  // Adjust advance mutation
  const adjustMutation = api.advanceReceipts.adjustAdvanceToInvoice.useMutation({
    onSuccess: () => {
      utils.advanceReceipts.getAdvanceReceiptById.invalidate({ id: params.id })
      utils.advanceReceipts.getAdvanceReceipts.invalidate()
      utils.invoices.list.invalidate()
      enqueueSnackbar('Advance adjusted successfully', { variant: 'success' })
      router.push(`/advances/${params.id}`)
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to adjust advance: ${error.message}`, { variant: 'error' })
    },
  })

  // Auto-adjust mutation
  const autoAdjustMutation = api.advanceReceipts.autoAdjustAdvances.useMutation({
    onSuccess: (result) => {
      utils.advanceReceipts.getAdvanceReceiptById.invalidate({ id: params.id })
      utils.advanceReceipts.getAdvanceReceipts.invalidate()
      utils.invoices.list.invalidate()
      enqueueSnackbar(
        `Successfully auto-adjusted ${result.adjustmentsCreated} invoice(s)`,
        { variant: 'success' }
      )
      router.push(`/advances/${params.id}`)
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to auto-adjust: ${error.message}`, { variant: 'error' })
    },
  })

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const handleAdjustmentAmountChange = (invoiceId: string, value: string) => {
    setAdjustmentAmounts(prev => ({
      ...prev,
      [invoiceId]: value,
    }))
  }

  const handleApplyAdjustment = (invoiceId: string) => {
    const amount = parseFloat(adjustmentAmounts[invoiceId] || '0')
    
    if (amount <= 0) {
      enqueueSnackbar('Please enter a valid adjustment amount', { variant: 'warning' })
      return
    }

    adjustMutation.mutate({
      advanceReceiptId: params.id,
      invoiceId,
      adjustmentAmount: amount,
      remarks,
    })
  }

  const handleAutoAdjust = () => {
    if (!receipt?.clientId) return
    
    if (confirm('This will automatically adjust the remaining advance against unpaid invoices using FIFO method. Continue?')) {
      autoAdjustMutation.mutate({
        clientId: receipt.clientId,
        method: 'FIFO',
      })
    }
  }

  // Calculate suggested adjustment amounts
  const suggestedAdjustments = useMemo(() => {
    if (!receipt || !invoices) return {}
    
    const suggestions: Record<string, number> = {}
    let remainingAdvance = Number(receipt.unadjustedAmount)
    
    invoices.forEach(invoice => {
      if (remainingAdvance > 0) {
        const invoiceBalance = Number(invoice.balanceDue)
        const suggested = Math.min(remainingAdvance, invoiceBalance)
        suggestions[invoice.id] = suggested
        remainingAdvance -= suggested
      }
    })
    
    return suggestions
  }, [receipt, invoices])

  if (receiptLoading || invoicesLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (!receipt) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          Advance receipt not found
        </Alert>
      </Container>
    )
  }

  const unadjustedAmount = Number(receipt.unadjustedAmount)
  const adjustmentProgress = (Number(receipt.adjustedAmount) / Number(receipt.amount)) * 100

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link component={NextLink} href="/dashboard" color="inherit" underline="hover">
            Dashboard
          </Link>
          <Link component={NextLink} href="/advances" color="inherit" underline="hover">
            Advance Receipts
          </Link>
          <Link 
            component={NextLink} 
            href={`/advances/${params.id}`} 
            color="inherit" 
            underline="hover"
          >
            {receipt.receiptNumber}
          </Link>
          <Typography color="text.primary">Adjust</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Adjust Advance Receipt
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Apply advance payment against unpaid invoices
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push(`/advances/${params.id}`)}
            >
              Back to Receipt
            </Button>
            {unadjustedAmount > 0 && (
              <Button
                variant="contained"
                startIcon={<AutoAdjustIcon />}
                onClick={handleAutoAdjust}
                disabled={autoAdjustMutation.isPending}
              >
                Auto-Adjust All
              </Button>
            )}
          </Box>
        </Box>

        {/* Receipt Summary Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReceiptIcon color="primary" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Receipt Number
                    </Typography>
                    <Typography variant="h6">{receipt.receiptNumber}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Client
                </Typography>
                <Typography variant="body1">
                  {receipt.client.name}
                  {receipt.client.company && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {receipt.client.company}
                    </Typography>
                  )}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Total Amount
                </Typography>
                <Typography variant="h6">
                  {formatCurrency(Number(receipt.amount), receipt.currency)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Available for Adjustment
                </Typography>
                <Typography variant="h6" color={unadjustedAmount > 0 ? 'success.main' : 'text.disabled'}>
                  {formatCurrency(unadjustedAmount, receipt.currency)}
                </Typography>
              </Grid>
            </Grid>
            
            {/* Progress Bar */}
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption">Adjustment Progress</Typography>
                <Typography variant="caption">{adjustmentProgress.toFixed(0)}%</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={adjustmentProgress} 
                sx={{ height: 8, borderRadius: 1 }}
                color={adjustmentProgress === 100 ? 'success' : 'primary'}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Unpaid Invoices */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Paper>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6">
                  Unpaid Invoices
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Select invoices to apply the advance payment
                </Typography>
              </Box>
              
              {invoices && invoices.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice No.</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Total Amount</TableCell>
                        <TableCell align="right">Balance Due</TableCell>
                        <TableCell align="center">Adjustment Amount</TableCell>
                        <TableCell align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {invoices.map((invoice) => {
                        const balanceDue = Number(invoice.balanceDue)
                        const maxAdjustment = Math.min(balanceDue, unadjustedAmount)
                        const suggestedAmount = suggestedAdjustments[invoice.id] || 0
                        
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {invoice.invoiceNumber}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(Number(invoice.totalAmount), invoice.currency)}
                            </TableCell>
                            <TableCell align="right">
                              <Typography color={balanceDue > 0 ? 'error.main' : 'text.secondary'}>
                                {formatCurrency(balanceDue, invoice.currency)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={adjustmentAmounts[invoice.id] || ''}
                                  onChange={(e) => handleAdjustmentAmountChange(invoice.id, e.target.value)}
                                  placeholder={suggestedAmount.toFixed(2)}
                                  inputProps={{ 
                                    min: 0, 
                                    max: maxAdjustment,
                                    step: 0.01 
                                  }}
                                  sx={{ width: 120 }}
                                  disabled={maxAdjustment <= 0}
                                />
                                {suggestedAmount > 0 && (
                                  <Tooltip title="Suggested amount">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleAdjustmentAmountChange(
                                        invoice.id, 
                                        suggestedAmount.toString()
                                      )}
                                    >
                                      <InfoIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleApplyAdjustment(invoice.id)}
                                disabled={
                                  adjustMutation.isPending || 
                                  maxAdjustment <= 0 ||
                                  !adjustmentAmounts[invoice.id] ||
                                  parseFloat(adjustmentAmounts[invoice.id]) <= 0
                                }
                              >
                                Apply
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No unpaid invoices found for this client
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Adjustment History */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6">
                  Adjustment History
                </Typography>
              </Box>
              
              <Box sx={{ p: 2 }}>
                {receipt.adjustments && receipt.adjustments.length > 0 ? (
                  <Stack spacing={2}>
                    {receipt.adjustments.map((adjustment) => (
                      <Card key={adjustment.id} variant="outlined">
                        <CardContent sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(adjustment.adjustmentDate), 'dd MMM yyyy')}
                            </Typography>
                            <Chip
                              size="small"
                              label="Adjusted"
                              color="success"
                              icon={<CheckCircleIcon />}
                            />
                          </Box>
                          <Typography variant="body2" fontWeight="medium">
                            Invoice: {adjustment.invoice.invoiceNumber}
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            {formatCurrency(Number(adjustment.adjustedAmount), receipt.currency)}
                          </Typography>
                          {adjustment.remarks && (
                            <Typography variant="caption" color="text.secondary">
                              {adjustment.remarks}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <Alert severity="info" icon={<InfoIcon />}>
                    No adjustments made yet
                  </Alert>
                )}
              </Box>
            </Paper>

            {/* Remarks Section */}
            <Paper sx={{ mt: 2 }}>
              <Box sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Remarks (Optional)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any notes about this adjustment..."
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Status Alert */}
        {unadjustedAmount === 0 && (
          <Alert severity="success" sx={{ mt: 3 }} icon={<CheckCircleIcon />}>
            This advance receipt has been fully adjusted against invoices.
          </Alert>
        )}
      </Box>
    </Container>
  )
}