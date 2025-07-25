'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Box,
  Tabs,
  Tab,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Grid,
} from '@mui/material'
import {
  Person as PersonIcon,
  Description as LUTIcon,
  CurrencyExchange as ExchangeIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { isValidGSTIN, isValidPAN, getStateFromGSTIN, getPANFromGSTIN } from '@/lib/validations/indian-tax'
import { zodErrorsToFormErrors } from '@/lib/utils/zod-error-handler'
import { MUILUTManagement } from './lut-management'
import { MUIExchangeRates } from './exchange-rates'
import { enqueueSnackbar } from 'notistack'

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
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  )
}

export function MUISettings() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as 'profile' | 'lut' | 'exchange-rates' | null
  const [activeTab, setActiveTab] = useState(0)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  const utils = api.useUtils()
  const { data: user } = api.users.getProfile.useQuery()
  
  const updateProfileMutation = api.users.updateProfile.useMutation({
    onSuccess: () => {
      utils.users.getProfile.invalidate()
      enqueueSnackbar('Profile updated successfully!', { variant: 'success' })
    },
    onError: (error) => {
      // Handle validation errors from server
      if (error.data?.zodError) {
        const formErrors = zodErrorsToFormErrors<typeof profileForm>(error.data.zodError)
        setValidationErrors(formErrors)
      }
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const [profileForm, setProfileForm] = useState({
    name: '',
    gstin: '',
    pan: '',
    address: '',
  })

  // Set initial tab based on URL
  useEffect(() => {
    if (tabFromUrl === 'lut') {
      setActiveTab(1)
    } else if (tabFromUrl === 'exchange-rates') {
      setActiveTab(2)
    }
  }, [tabFromUrl])

  // Update form when user data loads
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        gstin: user.gstin || '',
        pan: user.pan || '',
        address: user.address || '',
      })
    }
  }, [user])

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationErrors({})
    
    // Client-side validation
    const errors: Record<string, string> = {}
    
    if (profileForm.gstin && !isValidGSTIN(profileForm.gstin)) {
      errors.gstin = 'Invalid GSTIN format'
    }
    
    if (profileForm.pan && !isValidPAN(profileForm.pan)) {
      errors.pan = 'Invalid PAN format'
    }
    
    if (profileForm.gstin && profileForm.pan) {
      const gstinPAN = getPANFromGSTIN(profileForm.gstin)
      if (gstinPAN && gstinPAN !== profileForm.pan.toUpperCase()) {
        errors.pan = 'PAN does not match the PAN in GSTIN'
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    
    await updateProfileMutation.mutateAsync(profileForm)
  }

  const handleFieldChange = (field: keyof typeof profileForm, value: string) => {
    setProfileForm({ ...profileForm, [field]: value })
    // Clear validation error for this field when user types
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: '' })
    }
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your profile and system settings
        </Typography>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="settings tabs">
            <Tab 
              icon={<PersonIcon />} 
              iconPosition="start" 
              label="Profile & GST Details" 
              id="settings-tab-0"
              aria-controls="settings-tabpanel-0"
            />
            <Tab 
              icon={<LUTIcon />} 
              iconPosition="start" 
              label="LUT Management" 
              id="settings-tab-1"
              aria-controls="settings-tabpanel-1"
            />
            <Tab 
              icon={<ExchangeIcon />} 
              iconPosition="start" 
              label="Exchange Rates" 
              id="settings-tab-2"
              aria-controls="settings-tabpanel-2"
            />
          </Tabs>
        </Box>

        <CardContent>
          <TabPanel value={activeTab} index={0}>
            <Box component="form" onSubmit={handleProfileSubmit} maxWidth={600}>
              <Grid container spacing={3}>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={profileForm.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    disabled={updateProfileMutation.isPending}
                  />
                </Grid>

                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="GSTIN"
                    value={profileForm.gstin}
                    onChange={(e) => handleFieldChange('gstin', e.target.value.toUpperCase())}
                    placeholder="29ABCDE1234F1Z5"
                    inputProps={{ maxLength: 15 }}
                    error={!!validationErrors.gstin}
                    helperText={
                      validationErrors.gstin || 
                      (profileForm.gstin && isValidGSTIN(profileForm.gstin) && getStateFromGSTIN(profileForm.gstin) 
                        ? `State: ${getStateFromGSTIN(profileForm.gstin)}` 
                        : '15-character GST Identification Number')
                    }
                    disabled={updateProfileMutation.isPending}
                  />
                </Grid>

                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="PAN"
                    value={profileForm.pan}
                    onChange={(e) => handleFieldChange('pan', e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    inputProps={{ maxLength: 10 }}
                    error={!!validationErrors.pan}
                    helperText={validationErrors.pan || '10-character Permanent Account Number'}
                    disabled={updateProfileMutation.isPending}
                  />
                </Grid>

                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Business Address"
                    value={profileForm.address}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    multiline
                    rows={3}
                    disabled={updateProfileMutation.isPending}
                  />
                </Grid>

                <Grid size={12}>
                  <Box display="flex" justifyContent="flex-end">
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={updateProfileMutation.isPending}
                      startIcon={updateProfileMutation.isPending ? <CircularProgress size={20} /> : <SaveIcon />}
                    >
                      {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <MUILUTManagement />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <MUIExchangeRates />
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  )
}