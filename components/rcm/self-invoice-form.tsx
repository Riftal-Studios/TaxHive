'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Grid,
  Alert,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Divider,
  InputAdornment,
  Chip,
  FormHelperText,
  CircularProgress,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import {
  Save as SaveIcon,
  Calculate as CalculateIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'
// import dayjs, { Dayjs } from 'dayjs'
import { api } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
// import { toast } from 'react-hot-toast'

interface SelfInvoiceFormData {
  rcmTransactionId: any
  supplierName: any
  supplierAddress: any
  supplierState: any
  supplierStateCode: any
  supplierGSTIN: any | null
  supplierPAN: any
  placeOfSupply: any
  supplyType: 'GOODS' | 'SERVICES'
  rcmType: 'UNREGISTERED' | 'IMPORT_SERVICE' | 'NOTIFIED_SERVICE' | 'NOTIFIED_GOODS'
  originalInvoiceNo: any
  originalInvoiceDate: any | null
  goodsReceiptDate: any | null
  serviceReceiptDate: any | null
  description: any
  hsnSacCode: any
  quantity: any
  unit: any
  rate: any
  taxableAmount: any
  gstRate: any
  cgstRate: any | null
  cgstAmount: any | null
  sgstRate: any | null
  sgstAmount: any | null
  igstRate: any | null
  igstAmount: any | null
  cessRate: any | null
  cessAmount: any | null
  totalTaxAmount: any
  totalAmount: any
}

interface SelfInvoiceFormProps {
  transactionId?: string
  onSave?: (data: any) => void
  onCancel?: () => void
}

const GST_RATES = [0, 5, 12, 18, 28]
const SUPPLY_TYPES = [
  { value: 'SERVICES', label: 'Services' },
  { value: 'GOODS', label: 'Goods' },
]

const RCM_TYPES = [
  { value: 'UNREGISTERED', label: 'Unregistered Vendor' },
  { value: 'IMPORT_SERVICE', label: 'Import of Services' },
  { value: 'NOTIFIED_SERVICE', label: 'Notified Services' },
  { value: 'NOTIFIED_GOODS', label: 'Notified Goods' },
]

const INDIAN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman and Diu' },
  { code: '26', name: 'Dadra and Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh (New)' },
  { code: '38', name: 'Ladakh' },
]

export function SelfInvoiceForm({ transactionId, onSave, onCancel }: SelfInvoiceFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<SelfInvoiceFormData>({
    rcmTransactionId: any || '',
    supplierName: '',
    supplierAddress: '',
    supplierState: '',
    supplierStateCode: '',
    supplierGSTIN: any,
    supplierPAN: '',
    placeOfSupply: '',
    supplyType: 'SERVICES',
    rcmType: 'UNREGISTERED',
    originalInvoiceNo: '',
    originalInvoiceDate: any,
    goodsReceiptDate: any,
    serviceReceiptDate: any,
    description: '',
    hsnSacCode: '',
    quantity: 1,
    unit: 'NOS',
    rate: 0,
    taxableAmount: 0,
    gstRate: 18,
    cgstRate: any,
    cgstAmount: any,
    sgstRate: any,
    sgstAmount: any,
    igstRate: any,
    igstAmount: any,
    cessRate: any,
    cessAmount: any,
    totalTaxAmount: 0,
    totalAmount: 0,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [userState, setUserState] = useState<string>('')

  // Get user details for recipient information
  const { data: any } = api.user.getProfile.useQuery()

  // Get RCM transaction if editing
  const { data: any, isLoading: any } = api.rcm.getTransaction.useQuery(
    { id: any || '' },
    { enabled: !!transactionId }
  )

  // Generate self-invoice mutation
  const generateSelfInvoice = api.rcm.generateSelfInvoice.useMutation({
    onSuccess: (data: any) => {
      // toast.success('Self-invoice generated successfully!')
      if (onSave) {
        onSave(data)
      } else {
        router.push('/rcm/self-invoice')
      }
    },
    onError: (error: any) => {
      // toast.error(error.message || 'Failed to generate self-invoice')
    },
  })

  // Load transaction data when available
  useEffect(() => {
    if (rcmTransaction) {
      setFormData(prev => ({
        ...prev,
        rcmTransactionId: any.id,
        supplierName: any.vendorName || '',
        supplierGSTIN: any.vendorGSTIN,
        originalInvoiceNo: any.invoiceNumber || '',
        originalInvoiceDate: any.invoiceDate ? dayjs(rcmTransaction.invoiceDate) : null,
        goodsReceiptDate: any.invoiceDate ? dayjs(rcmTransaction.invoiceDate) : null,
        description: any.description || '',
        hsnSacCode: any.hsnSacCode || '',
        taxableAmount: any(rcmTransaction.taxableAmount),
        gstRate: (rcmTransaction as any).gstRate || 18,
        rcmType: (rcmTransaction.transactionType as any) || 'UNREGISTERED',
      }))
    }
  }, [rcmTransaction])

  // Get user's state for tax calculation
  useEffect(() => {
    if (user?.profile?.stateCode) {
      setUserState(user.profile.stateCode)
    }
  }, [user])

  // Calculate tax amounts when relevant fields change
  useEffect(() => {
    calculateTax()
  }, [formData.taxableAmount, formData.gstRate, formData.supplierStateCode, userState])

  const calculateTax = () => {
    setIsCalculating(true)
    
    const { taxableAmount, gstRate, supplierStateCode } = formData
    
    if (!taxableAmount || !gstRate) {
      setIsCalculating(false)
      return
    }

    // Determine if inter-state or intra-state
    const isInterState = supplierStateCode !== userState || supplierStateCode === '99' // 99 for foreign
    const gstAmount = (taxableAmount * gstRate) / 100
    
    let cgstRate = null, cgstAmount = null, sgstRate = null, sgstAmount = null
    let igstRate = null, igstAmount = null

    if (isInterState) {
      // Inter-state: any
      igstRate = gstRate
      igstAmount = gstAmount
    } else {
      // Intra-state: any + SGST
      cgstRate = gstRate / 2
      sgstRate = gstRate / 2
      cgstAmount = gstAmount / 2
      sgstAmount = gstAmount / 2
    }

    const cessAmount = formData.cessRate ? (taxableAmount * formData.cessRate) / 100 : 0
    const totalTaxAmount = gstAmount + cessAmount
    const totalAmount = taxableAmount + totalTaxAmount

    setFormData(prev => ({
      ...prev,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      cessAmount,
      totalTaxAmount,
      totalAmount,
    }))

    setIsCalculating(false)
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    const newWarnings: any[] = []

    // Required field validation
    if (!formData.supplierName.trim()) {
      newErrors.supplierName = 'Supplier name is required'
    }

    if (!formData.supplierStateCode) {
      newErrors.supplierStateCode = 'Supplier state is required'
    }

    if (!formData.placeOfSupply.trim()) {
      newErrors.placeOfSupply = 'Place of supply is required'
    }

    if (!formData.hsnSacCode.trim() || formData.hsnSacCode.length < 4) {
      newErrors.hsnSacCode = 'Valid HSN/SAC code required (minimum 4 digits)'
    }

    if (!formData.goodsReceiptDate) {
      newErrors.goodsReceiptDate = 'Goods/Service receipt date is required'
    }

    if (formData.taxableAmount <= 0) {
      newErrors.taxableAmount = 'Taxable amount must be greater than 0'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    // Business rule validation
    if (formData.goodsReceiptDate) {
      const daysSinceReceipt = dayjs().diff(formData.goodsReceiptDate, 'day')
      if (daysSinceReceipt > 30) {
        newWarnings.push(`30-day time limit exceeded. Self-invoice is ${daysSinceReceipt - 30} days overdue. Interest and penalty may apply.`)
      } else if (daysSinceReceipt > 25) {
        newWarnings.push(`Only ${30 - daysSinceReceipt} days remaining to generate self-invoice within time limit.`)
      }
    }

    // GSTIN validation for registered vendors
    if (formData.supplierGSTIN && formData.supplierGSTIN.length !== 15) {
      newErrors.supplierGSTIN = 'GSTIN must be 15 characters'
    }

    setErrors(newErrors)
    setWarnings(newWarnings)

    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: any.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      // toast.error('Please fix the validation errors')
      return
    }

    try {
      await generateSelfInvoice.mutateAsync({
        transactionId: any.rcmTransactionId,
      })
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleFieldChange = (field: keyof SelfInvoiceFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))

    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const getComplianceStatus = () => {
    if (!formData.goodsReceiptDate) return null

    const daysSinceReceipt = dayjs().diff(formData.goodsReceiptDate, 'day')
    
    if (daysSinceReceipt > 30) {
      return {
        severity: 'error' as const,
        message: `Self-invoice is overdue by ${daysSinceReceipt - 30} days. Interest and penalty apply.`,
        icon: <WarningIcon />,
      }
    } else if (daysSinceReceipt > 25) {
      return {
        severity: 'warning' as const,
        message: `Only ${30 - daysSinceReceipt} days remaining within compliance period.`,
        icon: <WarningIcon />,
      }
    } else {
      return {
        severity: 'success' as const,
        message: `Within compliance period. ${30 - daysSinceReceipt} days remaining.`,
        icon: <CheckCircleIcon />,
      }
    }
  }

  const complianceStatus = getComplianceStatus()

  if (isLoadingTransaction) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Compliance Status */}
          {complianceStatus && (
            <Grid size={{ xs: 12 }}>
              <Alert
                severity={complianceStatus.severity}
                icon={complianceStatus.icon}
                sx={{ mb: 2 }}
              >
                {complianceStatus.message}
              </Alert>
            </Grid>
          )}

          {/* Warnings */}
          {warnings.map((warning, index) => (
            <Grid size={{ xs: 12 }} key={index}>
              <Alert severity="warning" sx={{ mb: 1 }}>
                {warning}
              </Alert>
            </Grid>
          ))}

          {/* Supplier Details */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title="Supplier Details" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Supplier Name"
                      value={formData.supplierName}
                      onChange={(e: any) => handleFieldChange('supplierName', e.target.value)}
                      error={!!errors.supplierName}
                      helperText={errors.supplierName}
                      required
                    />
                  </Grid>
                  
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Supplier GSTIN"
                      value={formData.supplierGSTIN || ''}
                      onChange={(e: any) => handleFieldChange('supplierGSTIN', e.target.value || null)}
                      error={!!errors.supplierGSTIN}
                      helperText={errors.supplierGSTIN || 'Leave blank for unregistered vendors'}
                      placeholder="15-digit GSTIN"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Supplier PAN"
                      value={formData.supplierPAN}
                      onChange={(e: any) => handleFieldChange('supplierPAN', e.target.value)}
                      placeholder="10-character PAN"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Autocomplete
                      options={INDIAN_STATES}
                      getOptionLabel={(option: any) => `${option.name} (${option.code})`}
                      value={INDIAN_STATES.find(s => s.code === formData.supplierStateCode) || null}
                      onChange={(_, value) => {
                        handleFieldChange('supplierStateCode', value?.code || '')
                        handleFieldChange('supplierState', value?.name || '')
                      }}
                      renderInput={(params: any) => (
                        <TextField
                          {...params}
                          label="Supplier State"
                          error={!!errors.supplierStateCode}
                          helperText={errors.supplierStateCode}
                          required
                        />
                      )}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Supplier Address"
                      value={formData.supplierAddress}
                      onChange={(e: any) => handleFieldChange('supplierAddress', e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Supply Details */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title="Supply Details" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Supply Type</InputLabel>
                      <Select
                        value={formData.supplyType}
                        label="Supply Type"
                        onChange={(e: any) => handleFieldChange('supplyType', e.target.value)}
                      >
                        {SUPPLY_TYPES.map((type: any) => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>RCM Type</InputLabel>
                      <Select
                        value={formData.rcmType}
                        label="RCM Type"
                        onChange={(e: any) => handleFieldChange('rcmType', e.target.value)}
                      >
                        {RCM_TYPES.map((type: any) => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Place of Supply"
                      value={formData.placeOfSupply}
                      onChange={(e: any) => handleFieldChange('placeOfSupply', e.target.value)}
                      error={!!errors.placeOfSupply}
                      helperText={errors.placeOfSupply}
                      required
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="HSN/SAC Code"
                      value={formData.hsnSacCode}
                      onChange={(e: any) => handleFieldChange('hsnSacCode', e.target.value)}
                      error={!!errors.hsnSacCode}
                      helperText={errors.hsnSacCode}
                      required
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Description"
                      value={formData.description}
                      onChange={(e: any) => handleFieldChange('description', e.target.value)}
                      error={!!errors.description}
                      helperText={errors.description}
                      required
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Original Invoice Details */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title="Original Invoice Details" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Original Invoice Number"
                      value={formData.originalInvoiceNo}
                      onChange={(e: any) => handleFieldChange('originalInvoiceNo', e.target.value)}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <DatePicker
                      label="Original Invoice Date"
                      value={formData.originalInvoiceDate}
                      onChange={(value: any) => handleFieldChange('originalInvoiceDate', value)}
                      sx={{ width: '100%' }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <DatePicker
                      label="Goods/Service Receipt Date"
                      value={formData.goodsReceiptDate}
                      onChange={(value: any) => handleFieldChange('goodsReceiptDate', value)}
                      sx={{ width: '100%' }}
                      slotProps={{
                        textField: {
                          error: !!errors.goodsReceiptDate,
                          helperText: any.goodsReceiptDate || 'Critical for 30-day compliance',
                          required: any,
                        }
                      }}
                    />
                  </Grid>

                  {formData.supplyType === 'SERVICES' && (
                    <Grid size={{ xs: 12, md: 6 }}>
                      <DatePicker
                        label="Service Receipt Date"
                        value={formData.serviceReceiptDate}
                        onChange={(value: any) => handleFieldChange('serviceReceiptDate', value)}
                        sx={{ width: '100%' }}
                      />
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Financial Details */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title="Financial Details" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }} md={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Quantity"
                      value={formData.quantity}
                      onChange={(e: any) => handleFieldChange('quantity', Number(e.target.value))}
                      InputProps={{
                        inputProps: { min: 0, step: 0.001 }
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }} md={3}>
                    <TextField
                      fullWidth
                      label="Unit"
                      value={formData.unit}
                      onChange={(e: any) => handleFieldChange('unit', e.target.value)}
                      placeholder="e.g., NOS, KG, MTS"
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }} md={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Rate"
                      value={formData.rate}
                      onChange={(e: any) => {
                        const rate = Number(e.target.value)
                        handleFieldChange('rate', rate)
                        handleFieldChange('taxableAmount', rate * formData.quantity)
                      }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                        inputProps: { min: 0, step: 0.01 }
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }} md={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Taxable Amount"
                      value={formData.taxableAmount}
                      onChange={(e: any) => handleFieldChange('taxableAmount', Number(e.target.value))}
                      error={!!errors.taxableAmount}
                      helperText={errors.taxableAmount}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                        inputProps: { min: 0, step: 0.01 }
                      }}
                      required
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      Tax Calculation
                      {isCalculating && <CircularProgress size={20} sx={{ ml: 1 }} />}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth>
                      <InputLabel>GST Rate (%)</InputLabel>
                      <Select
                        value={formData.gstRate}
                        label="GST Rate (%)"
                        onChange={(e: any) => handleFieldChange('gstRate', Number(e.target.value))}
                      >
                        {GST_RATES.map((rate: any) => (
                          <MenuItem key={rate} value={rate}>
                            {rate}%
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="CESS Rate (%)"
                      value={formData.cessRate || ''}
                      onChange={(e: any) => handleFieldChange('cessRate', e.target.value ? Number(e.target.value) : null)}
                      InputProps={{
                        inputProps: { min: 0, step: 0.01 }
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 4 }}>
                    <Button
                      variant="outlined"
                      startIcon={<CalculateIcon />}
                      onClick={calculateTax}
                      disabled={isCalculating}
                      fullWidth
                    >
                      Recalculate Tax
                    </Button>
                  </Grid>

                  {/* Tax Breakdown */}
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Tax Breakdown
                      </Typography>
                      <Grid container spacing={2}>
                        {formData.cgstAmount !== null && (
                          <>
                            <Grid size={{ xs: 6 }} md={3}>
                              <Typography variant="body2" color="text.secondary">
                                CGST ({formData.cgstRate}%)
                              </Typography>
                              <Typography variant="h6">
                                ₹{formData.cgstAmount?.toFixed(2)}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 6 }} md={3}>
                              <Typography variant="body2" color="text.secondary">
                                SGST ({formData.sgstRate}%)
                              </Typography>
                              <Typography variant="h6">
                                ₹{formData.sgstAmount?.toFixed(2)}
                              </Typography>
                            </Grid>
                          </>
                        )}
                        
                        {formData.igstAmount !== null && (
                          <Grid size={{ xs: 6 }} md={3}>
                            <Typography variant="body2" color="text.secondary">
                              IGST ({formData.igstRate}%)
                            </Typography>
                            <Typography variant="h6">
                              ₹{formData.igstAmount?.toFixed(2)}
                            </Typography>
                          </Grid>
                        )}
                        
                        {formData.cessAmount !== null && formData.cessAmount > 0 && (
                          <Grid size={{ xs: 6 }} md={3}>
                            <Typography variant="body2" color="text.secondary">
                              CESS ({formData.cessRate}%)
                            </Typography>
                            <Typography variant="h6">
                              ₹{formData.cessAmount?.toFixed(2)}
                            </Typography>
                          </Grid>
                        )}
                        
                        <Grid size={{ xs: 6 }} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            Total Tax
                          </Typography>
                          <Typography variant="h6" color="primary">
                            ₹{formData.totalTaxAmount.toFixed(2)}
                          </Typography>
                        </Grid>
                        
                        <Grid size={{ xs: 6 }} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            Total Amount
                          </Typography>
                          <Typography variant="h6" color="primary">
                            ₹{formData.totalAmount.toFixed(2)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Action Buttons */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {onCancel && (
                <Button variant="outlined" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={(generateSelfInvoice as any).isLoading || false}
                size="large"
              >
                {(generateSelfInvoice as any).isLoading ? 'Generating...' : 'Generate Self-Invoice'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </LocalizationProvider>
  )
}