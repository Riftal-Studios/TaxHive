'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
} from '@mui/material'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Business as BusinessIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material'
import { enqueueSnackbar } from 'notistack'

// Schema for form validation
const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  hsnSacCode: z.string().min(1, 'HSN/SAC code is required'),
  quantity: z.number().positive('Quantity must be positive'),
  rate: z.number().positive('Rate must be positive'),
  amount: z.number().positive('Amount must be positive'),
  gstRate: z.number().min(0).max(28),
  cgstAmount: z.number().min(0).default(0),
  sgstAmount: z.number().min(0).default(0),
  igstAmount: z.number().min(0).default(0),
})

const purchaseInvoiceSchema = z.object({
  vendorId: z.string().min(1, 'Vendor is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.date(),
  placeOfSupply: z.string().optional(),
  itcCategory: z.enum(['INPUTS', 'CAPITAL_GOODS', 'INPUT_SERVICES', 'BLOCKED']),
  itcEligible: z.boolean(),
  description: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

type PurchaseInvoiceFormData = z.infer<typeof purchaseInvoiceSchema>

// ITC blocked items based on Section 17(5)
const BLOCKED_ITC_KEYWORDS = [
  'motor vehicle',
  'car',
  'food',
  'beverage',
  'catering',
  'cosmetic',
  'beauty',
  'health spa',
  'plastic surgery',
  'life insurance',
  'health insurance',
  'travel',
  'vacation',
  'personal',
  'gift',
  'csr',
  'construction',
  'building',
  'immovable property'
]

export default function NewPurchaseInvoicePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showVendorDialog, setShowVendorDialog] = useState(false)
  const [newVendor, setNewVendor] = useState({
    name: '',
    gstin: '',
    pan: '',
    address: '',
    stateCode: '',
    email: '',
    phone: '',
    isRegistered: true,
  })

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PurchaseInvoiceFormData>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      invoiceDate: new Date(),
      itcCategory: 'INPUTS',
      itcEligible: true,
      lineItems: [
        {
          description: '',
          hsnSacCode: '',
          quantity: 1,
          rate: 0,
          amount: 0,
          gstRate: 18,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
        },
      ],
    },
  })

  const lineItems = watch('lineItems')
  const selectedVendorId = watch('vendorId')
  const itcCategory = watch('itcCategory')
  const itcEligible = watch('itcEligible')

  // Fetch vendors
  const { data: vendors, refetch: refetchVendors } = api.purchaseInvoices.getVendors.useQuery()
  
  // Get selected vendor details
  const selectedVendor = vendors?.find(v => v.id === selectedVendorId)
  const isInterstate = selectedVendor && selectedVendor.stateCode !== '27' // Assuming Maharashtra (27)

  // Create vendor mutation
  const createVendorMutation = api.purchaseInvoices.createVendor.useMutation({
    onSuccess: (vendor) => {
      refetchVendors()
      setValue('vendorId', vendor.id)
      setShowVendorDialog(false)
      enqueueSnackbar('Vendor created successfully', { variant: 'success' })
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to create vendor: ${error.message}`, { variant: 'error' })
    },
  })

  // Create purchase invoice mutation
  const createInvoiceMutation = api.purchaseInvoices.createPurchaseInvoice.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Purchase invoice created successfully', { variant: 'success' })
      router.push('/purchase-invoices')
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to create invoice: ${error.message}`, { variant: 'error' })
    },
  })


  // Add line item
  const addLineItem = () => {
    const currentItems = lineItems || []
    setValue('lineItems', [
      ...currentItems,
      {
        description: '',
        hsnSacCode: '',
        quantity: 1,
        rate: 0,
        amount: 0,
        gstRate: 18,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      },
    ])
  }

  // Remove line item
  const removeLineItem = (index: number) => {
    const currentItems = lineItems || []
    setValue('lineItems', currentItems.filter((_, i) => i !== index))
  }

  // Calculate GST for line item
  const calculateGST = (index: number) => {
    const item = lineItems[index]
    if (!item) return

    const amount = item.quantity * item.rate
    setValue(`lineItems.${index}.amount`, amount)

    if (item.gstRate > 0) {
      const gstAmount = (amount * item.gstRate) / 100
      
      if (isInterstate) {
        // Interstate - only IGST
        setValue(`lineItems.${index}.igstAmount`, gstAmount)
        setValue(`lineItems.${index}.cgstAmount`, 0)
        setValue(`lineItems.${index}.sgstAmount`, 0)
      } else {
        // Intrastate - CGST + SGST
        setValue(`lineItems.${index}.cgstAmount`, gstAmount / 2)
        setValue(`lineItems.${index}.sgstAmount`, gstAmount / 2)
        setValue(`lineItems.${index}.igstAmount`, 0)
      }
    }

    // Check for blocked ITC based on description
    checkForBlockedITC(index)
  }

  // Check if item description indicates blocked ITC
  const checkForBlockedITC = (index: number) => {
    const item = lineItems[index]
    if (!item) return

    const description = item.description.toLowerCase()
    const isBlocked = BLOCKED_ITC_KEYWORDS.some(keyword => 
      description.includes(keyword)
    )

    if (isBlocked && itcCategory !== 'BLOCKED') {
      enqueueSnackbar('This item may be subject to blocked credit under Section 17(5)', { 
        variant: 'warning' 
      })
      setValue('itcCategory', 'BLOCKED')
      setValue('itcEligible', false)
    }
  }

  // Calculate totals
  const calculateTotals = () => {
    let taxableAmount = 0
    let cgstAmount = 0
    let sgstAmount = 0
    let igstAmount = 0

    lineItems?.forEach(item => {
      taxableAmount += item.amount || 0
      cgstAmount += item.cgstAmount || 0
      sgstAmount += item.sgstAmount || 0
      igstAmount += item.igstAmount || 0
    })

    const totalGSTAmount = cgstAmount + sgstAmount + igstAmount
    const totalAmount = taxableAmount + totalGSTAmount

    return {
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalGSTAmount,
      totalAmount,
    }
  }

  const totals = calculateTotals()

  // Handle form submission
  const onSubmit = async (data: PurchaseInvoiceFormData) => {
    setIsSubmitting(true)
    try {
      // Add calculated totals to the submission
      await createInvoiceMutation.mutateAsync({
        ...data,
        placeOfSupply: selectedVendor?.stateCode,
        taxableAmount: totals.taxableAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        cessAmount: 0,
        totalGSTAmount: totals.totalGSTAmount,
        totalAmount: totals.totalAmount,
        cgstRate: totals.cgstAmount > 0 ? (totals.cgstAmount / totals.taxableAmount) * 100 : 0,
        sgstRate: totals.sgstAmount > 0 ? (totals.sgstAmount / totals.taxableAmount) * 100 : 0,
        igstRate: totals.igstAmount > 0 ? (totals.igstAmount / totals.taxableAmount) * 100 : 0,
        itcClaimed: itcEligible ? totals.totalGSTAmount : 0,
        itcReversed: 0,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Create new vendor
  const handleCreateVendor = () => {
    createVendorMutation.mutate(newVendor)
  }

  const getITCCategoryInfo = (category: string) => {
    switch (category) {
      case 'INPUTS':
        return { label: 'Inputs', color: 'success' as const, description: 'Raw materials, consumables' }
      case 'CAPITAL_GOODS':
        return { label: 'Capital Goods', color: 'info' as const, description: 'Machinery, equipment' }
      case 'INPUT_SERVICES':
        return { label: 'Input Services', color: 'primary' as const, description: 'Professional services, rentals' }
      case 'BLOCKED':
        return { label: 'Blocked Credit', color: 'error' as const, description: 'Section 17(5) - ITC not eligible' }
      default:
        return { label: category, color: 'default' as const, description: '' }
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          {/* Page Header */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              New Purchase Invoice
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter purchase invoice details for ITC claim
            </Typography>
          </Box>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              {/* Vendor Information */}
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BusinessIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Vendor Information</Typography>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Controller
                        name="vendorId"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth error={!!errors.vendorId}>
                            <InputLabel>Vendor *</InputLabel>
                            <Select {...field} label="Vendor *">
                              <MenuItem value="">Select a vendor</MenuItem>
                              {vendors?.map((vendor) => (
                                <MenuItem key={vendor.id} value={vendor.id}>
                                  {vendor.name} {vendor.gstin && `(${vendor.gstin})`}
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.vendorId && (
                              <FormHelperText>{errors.vendorId.message}</FormHelperText>
                            )}
                          </FormControl>
                        )}
                      />
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setShowVendorDialog(true)}
                        sx={{ mt: 1 }}
                      >
                        Add New Vendor
                      </Button>
                    </Grid>
                    
                    {selectedVendor && (
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                          <Typography variant="body2" gutterBottom>
                            <strong>State Code:</strong> {selectedVendor.stateCode}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Supply Type:</strong> {isInterstate ? 'Interstate' : 'Intrastate'}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Tax Type:</strong> {isInterstate ? 'IGST' : 'CGST + SGST'}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>

              {/* Invoice Details */}
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ReceiptIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Invoice Details</Typography>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Controller
                        name="invoiceNumber"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Invoice Number *"
                            fullWidth
                            error={!!errors.invoiceNumber}
                            helperText={errors.invoiceNumber?.message}
                          />
                        )}
                      />
                    </Grid>
                    
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Controller
                        name="invoiceDate"
                        control={control}
                        render={({ field }) => (
                          <DatePicker
                            label="Invoice Date *"
                            value={field.value}
                            onChange={(date) => field.onChange(date)}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                error: !!errors.invoiceDate,
                                helperText: errors.invoiceDate?.message,
                              },
                            }}
                          />
                        )}
                      />
                    </Grid>
                    
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Description"
                            fullWidth
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Line Items */}
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Line Items</Typography>
                    <Button
                      startIcon={<AddIcon />}
                      onClick={addLineItem}
                      variant="outlined"
                      size="small"
                    >
                      Add Item
                    </Button>
                  </Box>
                  
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Description</TableCell>
                          <TableCell>HSN/SAC</TableCell>
                          <TableCell align="right">Qty</TableCell>
                          <TableCell align="right">Rate</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell align="right">GST %</TableCell>
                          <TableCell align="right">CGST</TableCell>
                          <TableCell align="right">SGST</TableCell>
                          <TableCell align="right">IGST</TableCell>
                          <TableCell align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lineItems?.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Controller
                                name={`lineItems.${index}.description`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    size="small"
                                    fullWidth
                                    onBlur={() => checkForBlockedITC(index)}
                                  />
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <Controller
                                name={`lineItems.${index}.hsnSacCode`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    size="small"
                                    style={{ width: '100px' }}
                                  />
                                )}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Controller
                                name={`lineItems.${index}.quantity`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    type="number"
                                    size="small"
                                    style={{ width: '80px' }}
                                    onChange={(e) => {
                                      field.onChange(parseFloat(e.target.value) || 0)
                                      calculateGST(index)
                                    }}
                                  />
                                )}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Controller
                                name={`lineItems.${index}.rate`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    type="number"
                                    size="small"
                                    style={{ width: '100px' }}
                                    onChange={(e) => {
                                      field.onChange(parseFloat(e.target.value) || 0)
                                      calculateGST(index)
                                    }}
                                  />
                                )}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {(item.amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              <Controller
                                name={`lineItems.${index}.gstRate`}
                                control={control}
                                render={({ field }) => (
                                  <Select
                                    {...field}
                                    size="small"
                                    style={{ width: '80px' }}
                                    onChange={(e) => {
                                      field.onChange(e.target.value)
                                      calculateGST(index)
                                    }}
                                  >
                                    <MenuItem value={0}>0%</MenuItem>
                                    <MenuItem value={5}>5%</MenuItem>
                                    <MenuItem value={12}>12%</MenuItem>
                                    <MenuItem value={18}>18%</MenuItem>
                                    <MenuItem value={28}>28%</MenuItem>
                                  </Select>
                                )}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {(item.cgstAmount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              {(item.sgstAmount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              {(item.igstAmount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => removeLineItem(index)}
                                disabled={lineItems.length === 1}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  {/* Totals */}
                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <Box sx={{ minWidth: 300 }}>
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography>Taxable Amount:</Typography>
                          <Typography fontWeight="medium">₹{totals.taxableAmount.toFixed(2)}</Typography>
                        </Box>
                        {totals.cgstAmount > 0 && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>CGST:</Typography>
                            <Typography>₹{totals.cgstAmount.toFixed(2)}</Typography>
                          </Box>
                        )}
                        {totals.sgstAmount > 0 && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>SGST:</Typography>
                            <Typography>₹{totals.sgstAmount.toFixed(2)}</Typography>
                          </Box>
                        )}
                        {totals.igstAmount > 0 && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>IGST:</Typography>
                            <Typography>₹{totals.igstAmount.toFixed(2)}</Typography>
                          </Box>
                        )}
                        <Divider />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography fontWeight="bold">Total Amount:</Typography>
                          <Typography fontWeight="bold">₹{totals.totalAmount.toFixed(2)}</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              {/* ITC Configuration */}
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Input Tax Credit (ITC) Configuration
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Controller
                        name="itcCategory"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>ITC Category *</InputLabel>
                            <Select {...field} label="ITC Category *">
                              <MenuItem value="INPUTS">Inputs (Raw materials, consumables)</MenuItem>
                              <MenuItem value="CAPITAL_GOODS">Capital Goods (Machinery, equipment)</MenuItem>
                              <MenuItem value="INPUT_SERVICES">Input Services (Professional services)</MenuItem>
                              <MenuItem value="BLOCKED">Blocked Credit (Section 17(5))</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                      <Box sx={{ mt: 1 }}>
                        {itcCategory && (
                          <Chip
                            label={getITCCategoryInfo(itcCategory).label}
                            color={getITCCategoryInfo(itcCategory).color}
                            size="small"
                          />
                        )}
                      </Box>
                    </Grid>
                    
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Controller
                        name="itcEligible"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={
                              <Checkbox
                                {...field}
                                checked={field.value && itcCategory !== 'BLOCKED'}
                                disabled={itcCategory === 'BLOCKED'}
                              />
                            }
                            label="ITC Eligible"
                          />
                        )}
                      />
                      
                      {itcEligible && itcCategory !== 'BLOCKED' && (
                        <Alert severity="success" sx={{ mt: 1 }}>
                          <Typography variant="body2">
                            Eligible ITC Amount: ₹{totals.totalGSTAmount.toFixed(2)}
                          </Typography>
                        </Alert>
                      )}
                      
                      {itcCategory === 'BLOCKED' && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          <Typography variant="body2" fontWeight="bold">
                            Blocked under Section 17(5)
                          </Typography>
                          <Typography variant="caption">
                            ITC cannot be claimed for this category
                          </Typography>
                        </Alert>
                      )}
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="info">
                      <Typography variant="body2" gutterBottom>
                        <strong>Common Blocked Credits (Section 17(5)):</strong>
                      </Typography>
                      <Typography variant="caption" component="div">
                        • Motor vehicles (unless used for specific business purposes)<br />
                        • Food, beverages, catering (unless required by law)<br />
                        • Construction of immovable property (unless for resale)<br />
                        • Personal consumption, gifts, CSR expenses
                      </Typography>
                    </Alert>
                  </Box>
                </Paper>
              </Grid>

              {/* Notes */}
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 3 }}>
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
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={() => router.push('/purchase-invoices')}
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
                    {isSubmitting ? 'Creating...' : 'Create Invoice'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Box>

        {/* Add Vendor Dialog */}
        <Dialog open={showVendorDialog} onClose={() => setShowVendorDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add New Vendor</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField
                label="Vendor Name *"
                value={newVendor.name}
                onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                fullWidth
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newVendor.isRegistered}
                    onChange={(e) => setNewVendor({ ...newVendor, isRegistered: e.target.checked })}
                  />
                }
                label="GST Registered"
              />
              
              {newVendor.isRegistered ? (
                <TextField
                  label="GSTIN *"
                  value={newVendor.gstin}
                  onChange={(e) => setNewVendor({ ...newVendor, gstin: e.target.value })}
                  placeholder="29AAAAA0000A1Z5"
                  fullWidth
                />
              ) : (
                <TextField
                  label="PAN *"
                  value={newVendor.pan}
                  onChange={(e) => setNewVendor({ ...newVendor, pan: e.target.value })}
                  placeholder="AAAAA0000A"
                  fullWidth
                />
              )}
              
              <TextField
                label="Address *"
                value={newVendor.address}
                onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                multiline
                rows={2}
                fullWidth
              />
              
              <TextField
                label="State Code *"
                value={newVendor.stateCode}
                onChange={(e) => setNewVendor({ ...newVendor, stateCode: e.target.value })}
                placeholder="27"
                helperText="2-digit state code (e.g., 27 for Maharashtra)"
                fullWidth
              />
              
              <TextField
                label="Email"
                type="email"
                value={newVendor.email}
                onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                fullWidth
              />
              
              <TextField
                label="Phone"
                value={newVendor.phone}
                onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowVendorDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateVendor}
              variant="contained"
              disabled={!newVendor.name || !newVendor.address || !newVendor.stateCode}
            >
              Create Vendor
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </LocalizationProvider>
  )
}