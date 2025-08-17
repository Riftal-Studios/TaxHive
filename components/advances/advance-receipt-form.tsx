'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Grid,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Switch,
  FormControlLabel,
  Collapse,
} from '@mui/material'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { format } from 'date-fns'
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'

const advanceReceiptSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  receiptDate: z.date(),
  currency: z.string().min(1, 'Currency is required'),
  amount: z.number().positive('Amount must be positive'),
  exchangeRate: z.number().positive('Exchange rate must be positive'),
  paymentMode: z.enum(['WIRE', 'CHEQUE', 'UPI', 'CASH']),
  bankReference: z.string().optional(),
  bankName: z.string().optional(),
  chequeNumber: z.string().optional(),
  chequeDate: z.date().optional(),
  isGSTApplicable: z.boolean(),
  gstRate: z.number().min(0).max(28).optional(),
  notes: z.string().optional(),
})

type AdvanceReceiptFormData = z.infer<typeof advanceReceiptSchema>

interface AdvanceReceiptFormProps {
  clients: Array<{ id: string; name: string; company?: string | null }>
  exchangeRate?: { rate: number; source: string }
  onSubmit: (data: AdvanceReceiptFormData) => Promise<void>
  onCancel: () => void
}

export function AdvanceReceiptForm({ 
  clients, 
  exchangeRate,
  onSubmit, 
  onCancel 
}: AdvanceReceiptFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showChequeDetails, setShowChequeDetails] = useState(false)
  const [showGSTDetails, setShowGSTDetails] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdvanceReceiptFormData>({
    resolver: zodResolver(advanceReceiptSchema),
    defaultValues: {
      receiptDate: new Date(),
      currency: 'USD',
      amount: 0,
      exchangeRate: exchangeRate?.rate || 1,
      paymentMode: 'WIRE',
      isGSTApplicable: false,
      notes: '',
    },
  })

  const currency = watch('currency')
  const paymentMode = watch('paymentMode')
  const isGSTApplicable = watch('isGSTApplicable')
  const amount = watch('amount')
  const currentExchangeRate = watch('exchangeRate')

  // Update exchange rate when currency changes
  const handleCurrencyChange = (newCurrency: string) => {
    setValue('currency', newCurrency)
    if (newCurrency === 'INR') {
      setValue('exchangeRate', 1)
    } else if (exchangeRate) {
      setValue('exchangeRate', exchangeRate.rate)
    }
  }

  // Show/hide cheque details based on payment mode
  const handlePaymentModeChange = (mode: string) => {
    setValue('paymentMode', mode as any)
    setShowChequeDetails(mode === 'CHEQUE')
  }

  // Handle GST toggle
  const handleGSTToggle = (checked: boolean) => {
    setValue('isGSTApplicable', checked)
    setShowGSTDetails(checked)
    if (!checked) {
      setValue('gstRate', undefined)
    }
  }

  const onFormSubmit = async (data: AdvanceReceiptFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  const amountInINR = amount * currentExchangeRate

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="clientId"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.clientId}>
                        <InputLabel>Client *</InputLabel>
                        <Select {...field} label="Client *">
                          <MenuItem value="">Select a client</MenuItem>
                          {clients.map((client) => (
                            <MenuItem key={client.id} value={client.id}>
                              {client.name} {client.company && `(${client.company})`}
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.clientId && (
                          <FormHelperText>{errors.clientId.message}</FormHelperText>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="receiptDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        label="Receipt Date *"
                        value={field.value}
                        onChange={(date) => field.onChange(date)}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            error: !!errors.receiptDate,
                            helperText: errors.receiptDate?.message,
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Amount Details */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Amount Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Controller
                    name="currency"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Currency *</InputLabel>
                        <Select
                          {...field}
                          label="Currency *"
                          onChange={(e) => handleCurrencyChange(e.target.value)}
                        >
                          <MenuItem value="USD">USD</MenuItem>
                          <MenuItem value="EUR">EUR</MenuItem>
                          <MenuItem value="GBP">GBP</MenuItem>
                          <MenuItem value="AUD">AUD</MenuItem>
                          <MenuItem value="CAD">CAD</MenuItem>
                          <MenuItem value="SGD">SGD</MenuItem>
                          <MenuItem value="AED">AED</MenuItem>
                          <MenuItem value="INR">INR</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Controller
                    name="amount"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Amount *"
                        type="number"
                        fullWidth
                        error={!!errors.amount}
                        helperText={errors.amount?.message}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        inputProps={{ step: '0.01', min: '0' }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Controller
                    name="exchangeRate"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Exchange Rate *"
                        type="number"
                        fullWidth
                        disabled={currency === 'INR'}
                        error={!!errors.exchangeRate}
                        helperText={
                          errors.exchangeRate?.message ||
                          (exchangeRate && currency !== 'INR' 
                            ? `Source: ${exchangeRate.source}` 
                            : '')
                        }
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                        inputProps={{ step: '0.0001', min: '0' }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Amount in INR"
                    value={amountInINR.toFixed(2)}
                    fullWidth
                    disabled
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Payment Details */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Payment Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Controller
                    name="paymentMode"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Payment Mode *</InputLabel>
                        <Select
                          {...field}
                          label="Payment Mode *"
                          onChange={(e) => handlePaymentModeChange(e.target.value)}
                        >
                          <MenuItem value="WIRE">Wire Transfer</MenuItem>
                          <MenuItem value="CHEQUE">Cheque</MenuItem>
                          <MenuItem value="UPI">UPI</MenuItem>
                          <MenuItem value="CASH">Cash</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                {paymentMode === 'WIRE' && (
                  <>
                    <Grid item xs={12} md={4}>
                      <Controller
                        name="bankReference"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Bank Reference"
                            fullWidth
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Controller
                        name="bankName"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Bank Name"
                            fullWidth
                          />
                        )}
                      />
                    </Grid>
                  </>
                )}
                {paymentMode === 'UPI' && (
                  <Grid item xs={12} md={8}>
                    <Controller
                      name="bankReference"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="UPI Transaction ID"
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                )}
              </Grid>

              {/* Cheque Details */}
              <Collapse in={showChequeDetails}>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={4}>
                    <Controller
                      name="chequeNumber"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Cheque Number"
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Controller
                      name="chequeDate"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          label="Cheque Date"
                          value={field.value || null}
                          onChange={(date) => field.onChange(date)}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                            },
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Controller
                      name="bankName"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Bank Name"
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Collapse>
            </Paper>
          </Grid>

          {/* GST Details (Optional) */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  GST Details (Optional)
                </Typography>
                <Controller
                  name="isGSTApplicable"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          {...field}
                          checked={field.value}
                          onChange={(e) => handleGSTToggle(e.target.checked)}
                        />
                      }
                      label="GST Applicable"
                    />
                  )}
                />
              </Box>
              <Collapse in={showGSTDetails}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Controller
                      name="gstRate"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>GST Rate (%)</InputLabel>
                          <Select
                            {...field}
                            label="GST Rate (%)"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          >
                            <MenuItem value={0}>0% (Export)</MenuItem>
                            <MenuItem value={5}>5%</MenuItem>
                            <MenuItem value={12}>12%</MenuItem>
                            <MenuItem value={18}>18%</MenuItem>
                            <MenuItem value={28}>28%</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>
                  {isGSTApplicable && (
                    <Grid item xs={12} md={8}>
                      <Typography variant="body2" color="text.secondary">
                        Note: GST on advance receipts is rarely applicable for export services under LUT.
                        GST amount will be calculated automatically based on the rate.
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Collapse>
            </Paper>
          </Grid>

          {/* Notes */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Additional Information
              </Typography>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Notes"
                    multiline
                    rows={3}
                    fullWidth
                  />
                )}
              />
            </Paper>
          </Grid>

          {/* Actions */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={onCancel}
                startIcon={<CancelIcon />}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Advance Receipt'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </LocalizationProvider>
  )
}