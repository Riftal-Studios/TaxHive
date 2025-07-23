'use client'

import React, { useState } from 'react'
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
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { api } from '@/lib/trpc/client'
import { enqueueSnackbar } from 'notistack'

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

const getNotesPlaceholder = (method: string) => {
  if (method === 'PAYONEER') {
    return 'e.g., Received via Payoneer balance, currency conversion details, sender company name'
  }
  return 'Any additional information about this payment'
}

export function PaymentModal({
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
  const [amount, setAmount] = useState<string>(balanceDue.toString())
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date())
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER')
  const [reference, setReference] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Please enter a valid amount'
    } else if (parsedAmount > balanceDue) {
      newErrors.amount = `Amount cannot exceed balance due (${currency} ${balanceDue.toFixed(2)})`
    }

    if (!paymentDate) {
      newErrors.paymentDate = 'Payment date is required'
    }

    if (!paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    await recordPaymentMutation.mutateAsync({
      invoiceId,
      amount: parseFloat(amount),
      currency,
      paymentDate: paymentDate!,
      paymentMethod: paymentMethod as any,
      reference: reference || undefined,
      notes: notes || undefined,
    })
  }

  const handleClose = () => {
    if (!recordPaymentMutation.isPending) {
      onClose()
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={recordPaymentMutation.isPending}
      >
        {recordPaymentMutation.isPending && <LinearProgress />}
        
        <DialogTitle>
          Record Payment
          <Typography variant="body2" color="text.secondary">
            Invoice {invoiceNumber}
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Invoice Summary */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Grid container spacing={2}>
                <Grid size={4}>
                  <Typography variant="body2" color="text.secondary">
                    Total Amount
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {currency} {totalAmount.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid size={4}>
                  <Typography variant="body2" color="text.secondary">
                    Amount Paid
                  </Typography>
                  <Typography variant="body1" fontWeight={500} color="success.main">
                    {currency} {amountPaid.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid size={4}>
                  <Typography variant="body2" color="text.secondary">
                    Balance Due
                  </Typography>
                  <Typography variant="body1" fontWeight={500} color="error.main">
                    {currency} {balanceDue.toFixed(2)}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Payment Amount */}
            <TextField
              fullWidth
              label="Payment Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={!!errors.amount}
              helperText={errors.amount || (parseFloat(amount) === balanceDue ? 'This will fully pay the invoice' : '')}
              InputProps={{
                startAdornment: <InputAdornment position="start">{currency}</InputAdornment>,
              }}
              inputProps={{
                step: '0.01',
                min: '0.01',
              }}
              required
              sx={{ mb: 3 }}
            />

            {/* Payment Date */}
            <DatePicker
              label="Payment Date"
              value={paymentDate}
              onChange={(newValue) => setPaymentDate(newValue)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  error: !!errors.paymentDate,
                  helperText: errors.paymentDate,
                  sx: { mb: 3 },
                },
              }}
            />

            {/* Payment Method */}
            <FormControl fullWidth required error={!!errors.paymentMethod} sx={{ mb: 3 }}>
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

            {/* Reference Number */}
            <TextField
              fullWidth
              label="Reference Number (Optional)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={getReferencePlaceholder(paymentMethod)}
              sx={{ mb: 3 }}
            />

            {/* Notes */}
            <TextField
              fullWidth
              label="Notes (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={getNotesPlaceholder(paymentMethod)}
              multiline
              rows={3}
              sx={{ mb: 2 }}
            />

            {/* Payoneer Information */}
            {paymentMethod === 'PAYONEER' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Payoneer Tips:
                </Typography>
                <Typography variant="body2">
                  Include the Payoneer payment ID from your transaction history. 
                  If payment was received from a marketplace (Upwork, Fiverr, etc.), mention it in notes.
                  Payments typically take 1-3 business days to process.
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button 
            onClick={handleClose}
            disabled={recordPaymentMutation.isPending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            variant="contained"
            disabled={recordPaymentMutation.isPending}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}