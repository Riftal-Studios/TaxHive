'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Typography,
  Alert,
  Paper,
  Chip,
  FormHelperText,
  LinearProgress,
  Grid,
  Tabs,
  Tab,
  Divider,
} from '@mui/material'
import { Stack } from '@mui/material'
import {
  Info as InfoIcon,
  AccountBalance as BankIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { api } from '@/lib/trpc/client'
import { enqueueSnackbar } from 'notistack'
import { FileUpload } from './file-upload'

type PaymentMethod = 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'PAYPAL' | 'PAYONEER' | 'WISE' | 'OTHER'

interface PaymentModalProps {
  invoiceId: string
  invoiceNumber: string
  currency: string
  totalAmount: number
  amountPaid: number
  balanceDue: number
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const paymentMethods = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'PAYONEER', label: 'Payoneer' },
  { value: 'WISE', label: 'Wise (TransferWise)' },
  { value: 'OTHER', label: 'Other' },
]

const getReferencePlaceholder = (method: string) => {
  switch (method) {
    case 'BANK_TRANSFER':
      return 'Wire transfer reference, IMPS/NEFT/RTGS number'
    case 'UPI':
      return 'UPI transaction ID'
    case 'PAYPAL':
      return 'PayPal transaction ID'
    case 'PAYONEER':
      return 'Payoneer payment ID or transaction ID'
    case 'WISE':
      return 'Wise transfer number'
    default:
      return 'Transaction ID, reference number, etc.'
  }
}

export function EnhancedPaymentModal({
  invoiceId,
  invoiceNumber,
  currency,
  totalAmount,
  amountPaid,
  balanceDue,
  open,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [tabValue, setTabValue] = useState(0)
  const [amount, setAmount] = useState<string>(balanceDue.toString())
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date())
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER')
  const [reference, setReference] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  
  // Payment flow details
  const [amountReceivedBeforeFees, setAmountReceivedBeforeFees] = useState<string>('')
  const [platformFeesInCurrency, setPlatformFeesInCurrency] = useState<string>('')
  
  // Bank credit details
  const [creditedAmount, setCreditedAmount] = useState<string>('')
  const [actualExchangeRate, setActualExchangeRate] = useState<string>('')
  const [bankChargesInr, setBankChargesInr] = useState<string>('')
  const [fircNumber, setFircNumber] = useState<string>('')
  const [fircDate, setFircDate] = useState<Date | null>(null)
  const [fircDocumentUrl, setFircDocumentUrl] = useState<string>('')
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const recordPaymentMutation = api.payments.create.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Payment recorded successfully', { variant: 'success' })
      onSuccess?.()
      onClose()
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  // Memoize validation function
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {}

    // Validate amount
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Please enter a valid amount'
    } else if (parsedAmount > balanceDue) {
      newErrors.amount = `Amount cannot exceed balance due (${currency} ${balanceDue.toFixed(2)})`
    }

    // Validate payment date
    if (!paymentDate) {
      newErrors.paymentDate = 'Payment date is required'
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const paymentDateCopy = new Date(paymentDate)
      paymentDateCopy.setHours(0, 0, 0, 0)
      
      if (paymentDateCopy > today) {
        newErrors.paymentDate = 'Payment date cannot be in the future'
      }
    }

    // Validate payment method
    if (!paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required'
    }

    // Validate bank credit details if provided
    if (creditedAmount) {
      const parsedCredited = parseFloat(creditedAmount)
      if (isNaN(parsedCredited) || parsedCredited <= 0) {
        newErrors.creditedAmount = 'Please enter a valid credited amount'
      }
    }

    if (actualExchangeRate) {
      const parsedRate = parseFloat(actualExchangeRate)
      if (isNaN(parsedRate) || parsedRate <= 0) {
        newErrors.actualExchangeRate = 'Please enter a valid exchange rate'
      }
    }

    if (platformFeesInCurrency) {
      const parsedFees = parseFloat(platformFeesInCurrency)
      if (isNaN(parsedFees) || parsedFees < 0) {
        newErrors.platformFeesInCurrency = 'Please enter a valid fee amount'
      } else if (amount && parseFloat(amount) > 0) {
        const parsedAmountValue = parseFloat(amount)
        if (parsedFees > parsedAmountValue) {
          newErrors.platformFeesInCurrency = 'Platform fees cannot exceed payment amount'
        }
      }
    }

    if (bankChargesInr) {
      const parsedCharges = parseFloat(bankChargesInr)
      if (isNaN(parsedCharges) || parsedCharges < 0) {
        newErrors.bankChargesInr = 'Please enter a valid charge amount'
      }
    }

    // Validate FIRC date if provided
    if (fircDate) {
      const today = new Date()
      if (fircDate > today) {
        newErrors.fircDate = 'FIRC date cannot be in the future'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [
    amount, 
    balanceDue, 
    currency, 
    paymentDate, 
    paymentMethod, 
    creditedAmount, 
    actualExchangeRate, 
    platformFeesInCurrency, 
    bankChargesInr, 
    fircDate
  ])

  // Memoize effective exchange rate calculation
  const effectiveRate = useMemo(() => {
    if (creditedAmount && amountReceivedBeforeFees && currency !== 'INR') {
      const credited = parseFloat(creditedAmount)
      const received = parseFloat(amountReceivedBeforeFees)
      if (credited > 0 && received > 0) {
        return (credited / received).toFixed(4)
      }
    }
    return null
  }, [creditedAmount, amountReceivedBeforeFees, currency])

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return

    await recordPaymentMutation.mutateAsync({
      invoiceId,
      amount: parseFloat(amount),
      currency,
      paymentDate: paymentDate!,
      paymentMethod: paymentMethod as PaymentMethod,
      reference: reference || undefined,
      notes: notes || undefined,
      amountReceivedBeforeFees: amountReceivedBeforeFees ? parseFloat(amountReceivedBeforeFees) : undefined,
      platformFeesInCurrency: platformFeesInCurrency ? parseFloat(platformFeesInCurrency) : undefined,
      creditedAmount: creditedAmount ? parseFloat(creditedAmount) : undefined,
      actualExchangeRate: actualExchangeRate ? parseFloat(actualExchangeRate) : undefined,
      bankChargesInr: bankChargesInr ? parseFloat(bankChargesInr) : undefined,
      fircNumber: fircNumber || undefined,
      fircDate: fircDate || undefined,
      fircDocumentUrl: fircDocumentUrl || undefined,
    })
  }, [
    validateForm,
    recordPaymentMutation,
    invoiceId,
    amount,
    currency,
    paymentDate,
    paymentMethod,
    reference,
    notes,
    amountReceivedBeforeFees,
    platformFeesInCurrency,
    creditedAmount,
    actualExchangeRate,
    bankChargesInr,
    fircNumber,
    fircDate,
    fircDocumentUrl
  ])

  const handleClose = useCallback(() => {
    if (!recordPaymentMutation.isPending) {
      onClose()
    }
  }, [recordPaymentMutation.isPending, onClose])

  // Auto-calculate platform fees when amount received changes
  const handleAmountReceivedChange = useCallback((value: string) => {
    setAmountReceivedBeforeFees(value)
    if (value && amount) {
      const fees = parseFloat(amount) - parseFloat(value)
      setPlatformFeesInCurrency(fees > 0 ? fees.toFixed(2) : '')
    }
  }, [amount])

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none',
          }
        }}
      >
        <DialogTitle>
          <Typography variant="h6">Record Payment</Typography>
          <Typography variant="body2" color="text.secondary">
            Invoice {invoiceNumber}
          </Typography>
        </DialogTitle>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          {/* Invoice Summary - Always visible */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              mb: 2, 
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: 2,
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid size={4}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Amount</Typography>
                <Typography variant="h6" fontWeight={600}>
                  {currency} {totalAmount.toFixed(2)}
                </Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Amount Paid</Typography>
                <Typography variant="h6" fontWeight={600}>
                  {currency} {amountPaid.toFixed(2)}
                </Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Balance Due</Typography>
                <Typography variant="h6" fontWeight={600}>
                  {currency} {balanceDue.toFixed(2)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {currency !== 'INR' && (
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} aria-label="payment tabs">
              <Tab icon={<ReceiptIcon />} label="Payment Details" />
              <Tab icon={<BankIcon />} label="Bank Credit Details" />
            </Tabs>
          )}
        </Box>

        <DialogContent>
          {recordPaymentMutation.isPending && <LinearProgress sx={{ mb: 2 }} />}

          {currency === 'INR' || tabValue === 0 ? (
            // Payment Details Tab
            <Box>
              <Stack spacing={3}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Amount Sent by Client"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      error={!!errors.amount}
                      helperText={errors.amount || 'The actual amount client sent (may differ from invoice amount)'}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">{currency}</InputAdornment>,
                      }}
                      inputProps={{ step: '0.01', min: '0.01' }}
                      required
                      size="medium"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker
                      label="Payment Date"
                      value={paymentDate}
                      onChange={(newValue) => setPaymentDate(newValue)}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.paymentDate,
                          helperText: errors.paymentDate,
                          required: true,
                          size: 'medium',
                        },
                      }}
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth error={!!errors.paymentMethod} required size="medium">
                      <InputLabel>Payment Method</InputLabel>
                      <Select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        label="Payment Method"
                      >
                        {paymentMethods.map((method) => (
                          <MenuItem key={method.value} value={method.value}>
                            {method.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.paymentMethod && (
                        <FormHelperText>{errors.paymentMethod}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Reference Number"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder={getReferencePlaceholder(paymentMethod)}
                      size="medium"
                    />
                  </Grid>
                </Grid>

                {/* Payment Flow Section - only show for foreign currency */}
                {currency !== 'INR' && (
                  <>
                    <Divider sx={{ my: 2 }}>
                      <Chip label="Platform Fees" size="small" />
                    </Divider>
                    
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="Amount Received (Before Fees)"
                          type="number"
                          value={amountReceivedBeforeFees}
                          onChange={(e) => handleAmountReceivedChange(e.target.value)}
                          helperText="Amount that reached your payment platform"
                          InputProps={{
                            startAdornment: <InputAdornment position="start">{currency}</InputAdornment>,
                          }}
                          inputProps={{ step: '0.01', min: '0' }}
                          size="medium"
                        />
                      </Grid>

                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="Platform Fees"
                          type="number"
                          value={platformFeesInCurrency}
                          onChange={(e) => setPlatformFeesInCurrency(e.target.value)}
                          error={!!errors.platformFeesInCurrency}
                          helperText={errors.platformFeesInCurrency || 'Transfer/platform fees in original currency'}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">{currency}</InputAdornment>,
                          }}
                          inputProps={{ step: '0.01', min: '0' }}
                          size="medium"
                          disabled={!!amountReceivedBeforeFees}
                        />
                      </Grid>
                    </Grid>
                  </>
                )}

                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional information about this payment"
                  size="medium"
                />

                {/* Platform-specific tips */}
                {paymentMethod === 'PAYONEER' && (
                  <Alert severity="info" icon={<InfoIcon />}>
                    <strong>Payoneer Tips:</strong> Payoneer typically charges 1-3% conversion fees. 
                    Include the Payoneer payment ID from your transaction history.
                  </Alert>
                )}

                {paymentMethod === 'WISE' && (
                  <Alert severity="info" icon={<InfoIcon />}>
                    <strong>Wise Tips:</strong> Wise provides transparent exchange rates with low fees. 
                    You can download payment confirmation from your Wise dashboard.
                  </Alert>
                )}
              </Stack>
            </Box>
          ) : (
            // Bank Credit Details Tab
            <Box>
              <Alert severity="info" sx={{ mb: 3 }} icon={<InfoIcon />}>
                Record the actual amount credited to your bank account after exchange rate conversion and fees
              </Alert>

              <Stack spacing={3}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Amount Credited to Bank"
                      type="number"
                      value={creditedAmount}
                      onChange={(e) => setCreditedAmount(e.target.value)}
                      error={!!errors.creditedAmount}
                      helperText={errors.creditedAmount || 'Actual INR amount received in your bank'}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                      inputProps={{ step: '0.01', min: '0' }}
                      size="medium"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Actual Exchange Rate"
                      type="number"
                      value={actualExchangeRate}
                      onChange={(e) => setActualExchangeRate(e.target.value)}
                      error={!!errors.actualExchangeRate}
                      helperText={
                        errors.actualExchangeRate || 
                        (effectiveRate ? `Effective rate: ${effectiveRate}` : 'Exchange rate you received')
                      }
                      InputProps={{
                        startAdornment: <InputAdornment position="start">1 {currency} =</InputAdornment>,
                        endAdornment: <InputAdornment position="end">₹</InputAdornment>,
                      }}
                      inputProps={{ step: '0.0001', min: '0' }}
                      size="medium"
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid size={12}>
                    <TextField
                      fullWidth
                      label="Bank Charges (if any)"
                      type="number"
                      value={bankChargesInr}
                      onChange={(e) => setBankChargesInr(e.target.value)}
                      error={!!errors.bankChargesInr}
                      helperText={errors.bankChargesInr || 'Additional charges deducted by your bank in INR'}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                      inputProps={{ step: '0.01', min: '0' }}
                      size="medium"
                    />
                  </Grid>
                </Grid>

                {/* Summary Box */}
                {(amount && (amountReceivedBeforeFees || !platformFeesInCurrency) && creditedAmount && actualExchangeRate) && (
                  <Paper sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
                    <Typography variant="body2" gutterBottom>
                      <strong>Payment Flow Summary:</strong>
                    </Typography>
                    <Typography variant="body2">
                      Client sent: {currency} {amount}
                    </Typography>
                    {platformFeesInCurrency && (
                      <Typography variant="body2">
                        Platform fees: {currency} {platformFeesInCurrency}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      Amount for conversion: {currency} {amountReceivedBeforeFees || amount}
                    </Typography>
                    <Typography variant="body2">
                      Exchange rate: 1 {currency} = ₹{actualExchangeRate}
                    </Typography>
                    {bankChargesInr && (
                      <Typography variant="body2">
                        Bank charges: ₹{bankChargesInr}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Final amount in bank: ₹{creditedAmount}</strong>
                    </Typography>
                  </Paper>
                )}

                <Divider sx={{ my: 2 }}>
                  <Chip label="FIRC Details" />
                </Divider>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="FIRC Number"
                      value={fircNumber}
                      onChange={(e) => setFircNumber(e.target.value)}
                      placeholder="FIRC document number"
                      size="medium"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker
                      label="FIRC Date"
                      value={fircDate}
                      onChange={(newValue) => setFircDate(newValue)}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.fircDate,
                          helperText: errors.fircDate,
                          placeholder: 'FIRC issue date',
                          size: 'medium',
                        },
                      }}
                    />
                  </Grid>

                  <Grid size={12}>
                    <FileUpload
                      label="Upload FIRC Document"
                      accept=".pdf,.png,.jpg,.jpeg"
                      value={fircDocumentUrl}
                      onChange={(url) => setFircDocumentUrl(url || '')}
                      helperText="Upload FIRC document (PDF or image format)"
                    />
                  </Grid>
                </Grid>

                <Alert severity="info" icon={<InfoIcon />}>
                  FIRC is required for GST compliance when exporting services. You can request it from your bank or payment processor.
                </Alert>
              </Stack>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={handleClose} 
            disabled={recordPaymentMutation.isPending}
            size="large"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={recordPaymentMutation.isPending}
            size="large"
            sx={{ minWidth: 150 }}
          >
            {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}
