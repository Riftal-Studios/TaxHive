'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  Paper,
  LinearProgress,
  Grid,
  Tabs,
  Tab,
  Divider,
} from '@mui/material'
import {
  AccountBalance as BankIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { api } from '@/lib/trpc/client'
import { enqueueSnackbar } from 'notistack'
import { toSafeNumber } from '@/lib/utils/decimal'

type PaymentMethod = 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'PAYPAL' | 'PAYONEER' | 'WISE' | 'OTHER'

interface Payment {
  id: string
  amount: number | { toNumber: () => number }
  currency: string
  paymentDate: string | Date
  paymentMethod: PaymentMethod
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
}

interface EditPaymentModalProps {
  payment: Payment | {
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
  }
  invoiceNumber: string
  currency: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`payment-tabpanel-${index}`}
      aria-labelledby={`payment-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export function EditPaymentModal({
  payment,
  invoiceNumber,
  currency,
  open,
  onClose,
  onSuccess,
}: EditPaymentModalProps) {
  const utils = api.useUtils()
  const [activeTab, setActiveTab] = useState(0)
  
  // Basic payment details
  const [amount, setAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<Date | null>(null)
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
  
  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize form with payment data
  useEffect(() => {
    if (payment && open) {
      setAmount(String(toSafeNumber(payment.amount)))
      setPaymentDate(new Date(payment.paymentDate))
      setPaymentMethod(payment.paymentMethod as string)
      setReference(payment.reference || '')
      setNotes(payment.notes || '')
      
      // Payment flow details
      if (payment.amountReceivedBeforeFees) {
        setAmountReceivedBeforeFees(String(toSafeNumber(payment.amountReceivedBeforeFees)))
      }
      if (payment.platformFeesInCurrency) {
        setPlatformFeesInCurrency(String(toSafeNumber(payment.platformFeesInCurrency)))
      }
      
      // Bank credit details
      if (payment.creditedAmount) {
        setCreditedAmount(String(toSafeNumber(payment.creditedAmount)))
      }
      if (payment.actualExchangeRate) {
        setActualExchangeRate(String(toSafeNumber(payment.actualExchangeRate)))
      }
      if (payment.bankChargesInr) {
        setBankChargesInr(String(toSafeNumber(payment.bankChargesInr)))
      }
      if (payment.fircNumber) {
        setFircNumber(payment.fircNumber)
      }
      if (payment.fircDate) {
        setFircDate(new Date(payment.fircDate))
      }
      if (payment.fircDocumentUrl) {
        setFircDocumentUrl(payment.fircDocumentUrl)
      }
      
      // Set active tab based on available data
      if (payment.creditedAmount || payment.fircNumber) {
        setActiveTab(1)
      }
    }
  }, [payment, open])

  // Update payment mutation
  const updatePaymentMutation = api.payments.update.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Payment updated successfully', { variant: 'success' })
      utils.invoices.getById.invalidate()
      utils.payments.getByInvoice.invalidate()
      onSuccess()
      handleClose()
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to update payment: ${error.message}`, { variant: 'error' })
    },
  })

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {}
    
    // Validate amount
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Please enter a valid amount'
    }
    
    // Validate payment date
    if (!paymentDate) {
      newErrors.paymentDate = 'Payment date is required'
    }
    
    // Optional field validations (only if filled)
    if (creditedAmount && parseFloat(creditedAmount) <= 0) {
      newErrors.creditedAmount = 'Credited amount must be positive'
    }
    
    if (actualExchangeRate && parseFloat(actualExchangeRate) <= 0) {
      newErrors.actualExchangeRate = 'Exchange rate must be positive'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [amount, paymentDate, creditedAmount, actualExchangeRate])

  const handleSubmit = useCallback(async () => {
    if (!validateForm() || !payment) return
    
    await updatePaymentMutation.mutateAsync({
      id: payment.id,
      amount: parseFloat(amount),
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
    payment,
    updatePaymentMutation,
    amount,
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
    fircDocumentUrl,
  ])

  const handleClose = useCallback(() => {
    if (!updatePaymentMutation.isPending) {
      onClose()
    }
  }, [updatePaymentMutation.isPending, onClose])

  // Auto-calculate platform fees when amount received changes
  const handleAmountReceivedChange = useCallback((value: string) => {
    setAmountReceivedBeforeFees(value)
    if (value && amount) {
      const fees = parseFloat(amount) - parseFloat(value)
      setPlatformFeesInCurrency(fees > 0 ? fees.toFixed(2) : '')
    }
  }, [amount])

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

  if (!payment) return null

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

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        aria-labelledby="edit-payment-dialog-title"
      >
        <DialogTitle id="edit-payment-dialog-title">
          Edit Payment for Invoice {invoiceNumber}
        </DialogTitle>
        <DialogContent>
          {updatePaymentMutation.isPending && <LinearProgress sx={{ mb: 2 }} />}
          
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab icon={<ReceiptIcon />} label="Basic Info" iconPosition="start" />
            <Tab icon={<BankIcon />} label="Bank & Platform Details" iconPosition="start" />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={3}>
              {/* Basic Payment Information */}
              <Grid size={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Payment Information
                </Typography>
              </Grid>
              
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Amount Sent by Client"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  error={!!errors.amount}
                  helperText={errors.amount || 'The amount mentioned on the invoice'}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">{currency}</InputAdornment>,
                  }}
                  inputProps={{ step: '0.01', min: '0' }}
                  required
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
                    },
                  }}
                />
              </Grid>
              
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required>
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
                </FormControl>
              </Grid>
              
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Transaction Reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  helperText="Transaction ID or reference number"
                />
              </Grid>
              
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  multiline
                  rows={3}
                  helperText="Any additional information about this payment"
                />
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Grid container spacing={3}>
              {/* Platform Fees Section */}
              {(paymentMethod === 'PAYPAL' || paymentMethod === 'PAYONEER' || paymentMethod === 'WISE') && (
                <>
                  <Grid size={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Platform Fees
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Track fees charged by the payment platform
                    </Typography>
                  </Grid>
                  
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
                      />
                    </Grid>
                    
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Platform Fees"
                        type="number"
                        value={platformFeesInCurrency}
                        onChange={(e) => setPlatformFeesInCurrency(e.target.value)}
                        helperText="Fees charged by the platform"
                        InputProps={{
                          startAdornment: <InputAdornment position="start">{currency}</InputAdornment>,
                        }}
                        inputProps={{ step: '0.01', min: '0' }}
                        disabled={!!amountReceivedBeforeFees}
                      />
                    </Grid>
                  </Grid>
                </>
              )}
              
              {/* Bank Credit Section */}
              <Grid size={12} sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Bank Credit Details
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Track the actual amount credited to your Indian bank account
                </Typography>
              </Grid>
              
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
                    helperText={errors.actualExchangeRate || 'Rate applied by your bank'}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">INR per {currency}</InputAdornment>,
                    }}
                    inputProps={{ step: '0.0001', min: '0' }}
                  />
                </Grid>
                
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Bank Charges"
                    type="number"
                    value={bankChargesInr}
                    onChange={(e) => setBankChargesInr(e.target.value)}
                    helperText="Charges deducted by your bank"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                    }}
                    inputProps={{ step: '0.01', min: '0' }}
                  />
                </Grid>
              </Grid>
              
              {/* FIRC Section */}
              <Grid size={12} sx={{ mt: 3 }}>
                <Divider />
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  FIRC Details
                </Typography>
              </Grid>
              
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="FIRC Number"
                    value={fircNumber}
                    onChange={(e) => setFircNumber(e.target.value)}
                    helperText="Foreign Inward Remittance Certificate number"
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
                        helperText: "Date of FIRC issuance",
                      },
                    }}
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
                    <strong>Net credited: ₹{creditedAmount}</strong>
                  </Typography>
                  {effectiveRate && (
                    <Typography variant="body2" color="text.secondary">
                      Effective rate: 1 {currency} = ₹{effectiveRate}
                    </Typography>
                  )}
                </Paper>
              )}
            </Grid>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={updatePaymentMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={updatePaymentMutation.isPending}
          >
            Update Payment
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}