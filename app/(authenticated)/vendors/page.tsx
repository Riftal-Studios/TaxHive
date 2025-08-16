'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import Link from 'next/link'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Stack,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Receipt as ReceiptIcon,
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material'

interface VendorFormData {
  name: string
  gstin: string
  pan: string
  address: string
  stateCode: string
  email: string
  phone: string
  isRegistered: boolean
}

const indianStates = [
  { code: '01', name: 'Jammu & Kashmir' },
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
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
]

export default function VendorsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [formData, setFormData] = useState<VendorFormData>({
    name: '',
    gstin: '',
    pan: '',
    address: '',
    stateCode: '',
    email: '',
    phone: '',
    isRegistered: true,
  })
  const [formErrors, setFormErrors] = useState<Partial<VendorFormData>>({})

  const { data: vendors, isLoading, refetch } = api.purchaseInvoices.getVendors.useQuery()
  const createVendorMutation = api.purchaseInvoices.createVendor.useMutation({
    onSuccess: () => {
      refetch()
      setShowAddDialog(false)
      resetForm()
    },
    onError: (error) => {
      alert('Error creating vendor: ' + error.message)
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      gstin: '',
      pan: '',
      address: '',
      stateCode: '',
      email: '',
      phone: '',
      isRegistered: true,
    })
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Partial<VendorFormData> = {}

    if (!formData.name.trim()) {
      errors.name = 'Name is required'
    }

    if (formData.isRegistered) {
      if (!formData.gstin) {
        errors.gstin = 'GSTIN is required for registered vendors'
      } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstin)) {
        errors.gstin = 'Invalid GSTIN format'
      }
    } else {
      if (!formData.pan) {
        errors.pan = 'PAN is required for unregistered vendors'
      } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan)) {
        errors.pan = 'Invalid PAN format'
      }
    }

    if (!formData.address.trim()) {
      errors.address = 'Address is required'
    }

    if (!formData.stateCode) {
      errors.stateCode = 'State is required'
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = () => {
    if (validateForm()) {
      createVendorMutation.mutate({
        name: formData.name,
        gstin: formData.isRegistered && formData.gstin ? formData.gstin : null,
        pan: !formData.isRegistered && formData.pan ? formData.pan : null,
        address: formData.address,
        stateCode: formData.stateCode,
        email: formData.email || null,
        phone: formData.phone || null,
        isRegistered: formData.isRegistered,
      })
    }
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">Vendors</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your suppliers and vendors for purchase tracking
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowAddDialog(true)}
        >
          Add Vendor
        </Button>
      </Stack>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <BusinessIcon color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{vendors?.length || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Vendors
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">
                    {vendors?.filter((v: any) => v.isRegistered).length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    GST Registered
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CancelIcon color="warning" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">
                    {vendors?.filter((v: any) => !v.isRegistered).length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unregistered
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Vendors Table */}
      <Card>
        <CardContent>
          {vendors?.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No vendors added yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Add your first vendor to start tracking purchases
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowAddDialog(true)}
              >
                Add Vendor
              </Button>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>GSTIN/PAN</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vendors?.map((vendor: any) => (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {vendor.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {vendor.gstin || vendor.pan || '-'}
                      </TableCell>
                      <TableCell>
                        {indianStates.find((s: any) => s.code === vendor.stateCode)?.name || vendor.stateCode}
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          {vendor.email && (
                            <Typography variant="caption">{vendor.email}</Typography>
                          )}
                          {vendor.phone && (
                            <Typography variant="caption">{vendor.phone}</Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={vendor.isRegistered ? 'GST Registered' : 'Unregistered'}
                          color={vendor.isRegistered ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Link href={`/purchases?vendorId=${vendor.id}`} passHref legacyBehavior>
                            <IconButton size="small">
                              <ReceiptIcon fontSize="small" />
                            </IconButton>
                          </Link>
                          <IconButton size="small">
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add Vendor Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => {
          setShowAddDialog(false)
          resetForm()
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Vendor</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isRegistered}
                      onChange={(e) => setFormData({ ...formData, isRegistered: e.target.checked })}
                    />
                  }
                  label="GST Registered Vendor"
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Vendor Name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                />
              </Grid>

              {formData.isRegistered ? (
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="GSTIN"
                    required
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    error={!!formErrors.gstin}
                    helperText={formErrors.gstin || 'Format: 22AAAAA0000A1Z5'}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </Grid>
              ) : (
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="PAN"
                    required
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    error={!!formErrors.pan}
                    helperText={formErrors.pan || 'Format: AAAAA0000A'}
                    placeholder="AAAAA0000A"
                  />
                </Grid>
              )}

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Address"
                  required
                  multiline
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  error={!!formErrors.address}
                  helperText={formErrors.address}
                />
              </Grid>

              <Grid size={12}>
                <FormControl fullWidth required error={!!formErrors.stateCode}>
                  <InputLabel>State</InputLabel>
                  <Select
                    value={formData.stateCode}
                    onChange={(e) => setFormData({ ...formData, stateCode: e.target.value })}
                    label="State"
                  >
                    {indianStates.map((state) => (
                      <MenuItem key={state.code} value={state.code}>
                        {state.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.stateCode && (
                    <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                      {formErrors.stateCode}
                    </Typography>
                  )}
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAddDialog(false)
            resetForm()
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={createVendorMutation.isPending}
          >
            {createVendorMutation.isPending ? 'Adding...' : 'Add Vendor'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}