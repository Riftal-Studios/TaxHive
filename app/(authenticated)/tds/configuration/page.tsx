'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
} from '@mui/material'
import { Save as SaveIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { VENDOR_TYPES } from '@/lib/tds/constants'
import { INDIAN_STATES } from '@/lib/constants'

const tdsConfigSchema = z.object({
  tanNumber: z.string().length(10, 'TAN must be exactly 10 characters'),
  deductorName: z.string().min(1, 'Deductor name is required'),
  deductorPAN: z.string().length(10, 'PAN must be exactly 10 characters'),
  deductorType: z.enum(['COMPANY', 'INDIVIDUAL', 'HUF', 'FIRM', 'TRUST']),
  responsiblePerson: z.string().min(1, 'Responsible person name is required'),
  designation: z.string().min(1, 'Designation is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  stateCode: z.string().length(2, 'Please select a state'),
  pincode: z.string().length(6, 'Pincode must be 6 digits'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  autoDeduct: z.boolean(),
  emailCertificates: z.boolean(),
})

type TDSConfigFormData = z.infer<typeof tdsConfigSchema>

export default function TDSConfigurationPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')

  const { data: configuration, isLoading: configLoading } = api.tds.getConfiguration.useQuery()
  const saveConfigMutation = api.tds.saveConfiguration.useMutation({
    onSuccess: () => {
      setSuccessMessage('TDS configuration saved successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    },
  })

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TDSConfigFormData>({
    resolver: zodResolver(tdsConfigSchema),
    defaultValues: {
      tanNumber: '',
      deductorName: '',
      deductorPAN: '',
      deductorType: 'COMPANY',
      responsiblePerson: '',
      designation: '',
      address: '',
      city: '',
      stateCode: '',
      pincode: '',
      email: '',
      phone: '',
      autoDeduct: true,
      emailCertificates: true,
    },
  })

  useEffect(() => {
    if (configuration) {
      reset({
        tanNumber: configuration.tanNumber,
        deductorName: configuration.deductorName,
        deductorPAN: configuration.deductorPAN,
        deductorType: configuration.deductorType as any,
        responsiblePerson: configuration.responsiblePerson,
        designation: configuration.designation,
        address: configuration.address,
        city: configuration.city,
        stateCode: configuration.stateCode,
        pincode: configuration.pincode,
        email: configuration.email,
        phone: configuration.phone,
        autoDeduct: configuration.autoDeduct,
        emailCertificates: configuration.emailCertificates,
      })
    }
    setIsLoading(false)
  }, [configuration, reset])

  const onSubmit = async (data: TDSConfigFormData) => {
    try {
      await saveConfigMutation.mutateAsync(data)
    } catch (error) {
      console.error('Error saving configuration:', error)
    }
  }

  if (configLoading || isLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Typography>Loading...</Typography>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => router.push('/tds')}
            variant="outlined"
          >
            Back
          </Button>
          <Typography variant="h4" component="h1">
            TDS Configuration
          </Typography>
        </Box>

        {successMessage && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {successMessage}
          </Alert>
        )}

        {saveConfigMutation.error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {saveConfigMutation.error.message}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              TAN & Deductor Details
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="tanNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="TAN Number"
                      fullWidth
                      error={!!errors.tanNumber}
                      helperText={errors.tanNumber?.message || 'Tax Deduction Account Number (10 characters)'}
                      inputProps={{ maxLength: 10, style: { textTransform: 'uppercase' } }}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="deductorPAN"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Deductor PAN"
                      fullWidth
                      error={!!errors.deductorPAN}
                      helperText={errors.deductorPAN?.message || 'PAN of the deductor (10 characters)'}
                      inputProps={{ maxLength: 10, style: { textTransform: 'uppercase' } }}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="deductorType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.deductorType}>
                      <InputLabel>Deductor Type</InputLabel>
                      <Select {...field} label="Deductor Type">
                        {VENDOR_TYPES.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="deductorName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Deductor Name"
                      fullWidth
                      error={!!errors.deductorName}
                      helperText={errors.deductorName?.message || 'Legal name of the business'}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="responsiblePerson"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Responsible Person"
                      fullWidth
                      error={!!errors.responsiblePerson}
                      helperText={errors.responsiblePerson?.message || 'Person responsible for TDS'}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="designation"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Designation"
                      fullWidth
                      error={!!errors.designation}
                      helperText={errors.designation?.message}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Contact Information
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Controller
                  name="address"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Address"
                      fullWidth
                      multiline
                      rows={2}
                      error={!!errors.address}
                      helperText={errors.address?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="City"
                      fullWidth
                      error={!!errors.city}
                      helperText={errors.city?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="stateCode"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.stateCode}>
                      <InputLabel>State</InputLabel>
                      <Select {...field} label="State">
                        <MenuItem value="">Select State</MenuItem>
                        {INDIAN_STATES.map((state) => (
                          <MenuItem key={state.code} value={state.code}>
                            {state.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="pincode"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Pincode"
                      fullWidth
                      error={!!errors.pincode}
                      helperText={errors.pincode?.message}
                      inputProps={{ maxLength: 6 }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Email"
                      type="email"
                      fullWidth
                      error={!!errors.email}
                      helperText={errors.email?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Phone"
                      fullWidth
                      error={!!errors.phone}
                      helperText={errors.phone?.message}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="autoDeduct"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="Automatically calculate TDS on purchase invoices"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="emailCertificates"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="Email Form 16A certificates to vendors"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => router.push('/tds')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saveConfigMutation.isLoading}
            >
              {saveConfigMutation.isLoading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </Box>
        </form>
      </Box>
    </Container>
  )
}