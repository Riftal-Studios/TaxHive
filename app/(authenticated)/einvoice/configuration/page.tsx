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
  Chip,
  IconButton,
  InputAdornment,
} from '@mui/material'
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  Visibility,
  VisibilityOff,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const configSchema = z.object({
  gspProvider: z.enum(['CLEARTAX', 'VAYANA', 'CYGNET', 'CUSTOM']),
  gspUrl: z.string().optional(),
  environment: z.enum(['SANDBOX', 'PRODUCTION']),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  gstin: z.string().length(15, 'GSTIN must be 15 characters'),
  autoGenerate: z.boolean(),
  autoCancel: z.boolean(),
  cancelWithin: z.number().min(1).max(24),
  includeQRCode: z.boolean(),
  bulkGeneration: z.boolean(),
  ewayBillEnabled: z.boolean(),
  ewayBillThreshold: z.number(),
  transportMode: z.string().optional(),
  transporterId: z.string().optional(),
})

type ConfigFormData = z.infer<typeof configSchema>

export default function EInvoiceConfigurationPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [testingAuth, setTestingAuth] = useState(false)
  const [authStatus, setAuthStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const { data: config, isLoading: configLoading } = api.einvoice.getConfig.useQuery()
  const { data: gspProviders } = api.einvoice.getGSPProviders.useQuery()
  const { data: isAuthenticated } = api.einvoice.isAuthenticated.useQuery()
  
  const saveConfigMutation = api.einvoice.saveConfig.useMutation({
    onSuccess: () => {
      setAuthStatus('idle')
    },
  })
  
  const testAuthMutation = api.einvoice.testAuth.useMutation({
    onSuccess: () => {
      setAuthStatus('success')
      setTimeout(() => setAuthStatus('idle'), 3000)
    },
    onError: () => {
      setAuthStatus('error')
    },
  })

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      gspProvider: 'CLEARTAX',
      environment: 'SANDBOX',
      username: '',
      password: '',
      gstin: '',
      autoGenerate: false,
      autoCancel: false,
      cancelWithin: 24,
      includeQRCode: true,
      bulkGeneration: false,
      ewayBillEnabled: false,
      ewayBillThreshold: 50000,
    },
  })

  const selectedProvider = watch('gspProvider')
  const environment = watch('environment')
  const ewayBillEnabled = watch('ewayBillEnabled')

  useEffect(() => {
    if (config) {
      reset({
        ...config,
        password: '', // Don't populate password
        clientSecret: '', // Don't populate client secret
      })
    }
  }, [config, reset])

  const onSubmit = async (data: ConfigFormData) => {
    try {
      await saveConfigMutation.mutateAsync(data)
    } catch (error) {
      console.error('Error saving configuration:', error)
    }
  }

  const handleTestAuth = async () => {
    setTestingAuth(true)
    try {
      await testAuthMutation.mutateAsync()
    } finally {
      setTestingAuth(false)
    }
  }

  if (configLoading) {
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
            onClick={() => router.push('/einvoice')}
            variant="outlined"
          >
            Back
          </Button>
          <Typography variant="h4" component="h1">
            E-Invoice Configuration
          </Typography>
          {isAuthenticated && (
            <Chip
              label="Authenticated"
              color="success"
              icon={<CheckIcon />}
              size="small"
            />
          )}
        </Box>

        {saveConfigMutation.isSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Configuration saved successfully!
          </Alert>
        )}

        {saveConfigMutation.error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {saveConfigMutation.error.message}
          </Alert>
        )}

        {authStatus === 'success' && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Authentication successful! You can now generate e-invoices.
          </Alert>
        )}

        {authStatus === 'error' && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Authentication failed. Please check your credentials.
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              GSP Provider Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="gspProvider"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>GSP Provider</InputLabel>
                      <Select {...field} label="GSP Provider">
                        {gspProviders?.map((provider) => (
                          <MenuItem key={provider.value} value={provider.value}>
                            {provider.label}
                          </MenuItem>
                        ))}
                        <MenuItem value="CUSTOM">Custom GSP</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="environment"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Environment</InputLabel>
                      <Select {...field} label="Environment">
                        <MenuItem value="SANDBOX">Sandbox (Testing)</MenuItem>
                        <MenuItem value="PRODUCTION">Production</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="gstin"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="GSTIN"
                      fullWidth
                      error={!!errors.gstin}
                      helperText={errors.gstin?.message || 'Your GSTIN for e-invoicing'}
                      inputProps={{ maxLength: 15, style: { textTransform: 'uppercase' } }}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  )}
                />
              </Grid>
              {selectedProvider === 'CUSTOM' && (
                <Grid item xs={12}>
                  <Controller
                    name="gspUrl"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Custom GSP URL"
                        fullWidth
                        helperText="Full URL to your GSP API endpoint"
                      />
                    )}
                  />
                </Grid>
              )}
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Authentication Credentials
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="username"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Username"
                      fullWidth
                      error={!!errors.username}
                      helperText={errors.username?.message || 'IRP username'}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      fullWidth
                      error={!!errors.password}
                      helperText={errors.password?.message || 'IRP password'}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="clientId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Client ID (Optional)"
                      fullWidth
                      helperText="Required for some GSP providers"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="clientSecret"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Client Secret (Optional)"
                      type={showSecret ? 'text' : 'password'}
                      fullWidth
                      helperText="Required for some GSP providers"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowSecret(!showSecret)}
                              edge="end"
                            >
                              {showSecret ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              E-Invoice Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="autoGenerate"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="Auto-generate IRN on invoice creation"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="includeQRCode"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="Include QR code in invoices"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="autoCancel"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="Auto-cancel on invoice cancellation"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="bulkGeneration"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="Enable bulk IRN generation"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="cancelWithin"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Cancel Within (Hours)"
                      type="number"
                      fullWidth
                      error={!!errors.cancelWithin}
                      helperText="Maximum: 24 hours"
                      inputProps={{ min: 1, max: 24 }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              E-Way Bill Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="ewayBillEnabled"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      }
                      label="Enable E-Way Bill generation"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="ewayBillThreshold"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="E-Way Bill Threshold Amount"
                      type="number"
                      fullWidth
                      disabled={!ewayBillEnabled}
                      helperText="Minimum invoice value for E-Way Bill"
                    />
                  )}
                />
              </Grid>
              {ewayBillEnabled && (
                <>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="transportMode"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Default Transport Mode</InputLabel>
                          <Select {...field} label="Default Transport Mode">
                            <MenuItem value="">None</MenuItem>
                            <MenuItem value="1">Road</MenuItem>
                            <MenuItem value="2">Rail</MenuItem>
                            <MenuItem value="3">Air</MenuItem>
                            <MenuItem value="4">Ship</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="transporterId"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Default Transporter ID"
                          fullWidth
                          helperText="GSTIN of the transporter"
                        />
                      )}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleTestAuth}
              disabled={testingAuth || !config}
            >
              {testingAuth ? 'Testing...' : 'Test Authentication'}
            </Button>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => router.push('/einvoice')}
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
          </Box>
        </form>
      </Box>
    </Container>
  )
}