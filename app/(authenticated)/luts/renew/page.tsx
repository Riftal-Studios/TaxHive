'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  AlertTitle,
  Skeleton,
  LinearProgress,
  Breadcrumbs,
  Link as MuiLink,
  Divider,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import {
  ArrowBack as ArrowBackIcon,
  Autorenew as RenewIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { api } from '@/lib/trpc/client'
import { format } from 'date-fns'
import { zodErrorsToFormErrors } from '@/lib/utils/zod-error-handler'
import { enqueueSnackbar } from 'notistack'

interface FormData {
  lutNumber: string
  lutDate: Date | null
  validFrom: Date | null
  validTill: Date | null
  [key: string]: unknown
}

export default function LUTRenewalPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lutId = searchParams.get('lutId')

  const [formData, setFormData] = useState<FormData>({
    lutNumber: '',
    lutDate: null,
    validFrom: null,
    validTill: null,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const utils = api.useUtils()

  // Fetch renewal details if lutId is provided
  const { data: renewalDetails, isLoading: detailsLoading, error: detailsError } = api.luts.getRenewalDetails.useQuery(
    { lutId: lutId! },
    { enabled: !!lutId }
  )

  // Pre-fill form when renewal details are loaded
  useEffect(() => {
    if (renewalDetails) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: initialize form with fetched data
      setFormData({
        lutNumber: '', // User needs to enter new LUT number
        lutDate: null,
        validFrom: new Date(renewalDetails.suggestedValidFrom),
        validTill: new Date(renewalDetails.suggestedValidTill),
      })
    }
  }, [renewalDetails])

  const renewMutation = api.luts.renew.useMutation({
    onSuccess: () => {
      utils.luts.list.invalidate()
      utils.luts.getActiveStatus.invalidate()
      enqueueSnackbar('LUT renewed successfully', { variant: 'success' })
      router.push('/luts')
    },
    onError: (error) => {
      if (error.data?.zodError) {
        const formErrors = zodErrorsToFormErrors<FormData>(error.data.zodError)
        setErrors(formErrors)
      }
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const localErrors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.lutNumber.trim()) {
      localErrors.lutNumber = 'LUT number is required'
    }
    if (!formData.lutDate) {
      localErrors.lutDate = 'LUT date is required'
    }
    if (!formData.validFrom) {
      localErrors.validFrom = 'Valid from date is required'
    }
    if (!formData.validTill) {
      localErrors.validTill = 'Valid till date is required'
    }

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors)
      return
    }

    if (!lutId) {
      enqueueSnackbar('Previous LUT ID is required', { variant: 'error' })
      return
    }

    await renewMutation.mutateAsync({
      previousLutId: lutId,
      lutNumber: formData.lutNumber,
      lutDate: formData.lutDate!,
      validFrom: formData.validFrom!,
      validTill: formData.validTill!,
    })
  }

  const isSubmitting = renewMutation.isPending

  // No lutId provided
  if (!lutId) {
    return (
      <Box>
        <Alert severity="error">
          <AlertTitle>Missing LUT ID</AlertTitle>
          Please select an LUT to renew from the LUT management page.
        </Alert>
        <Box mt={2}>
          <Button
            component={Link}
            href="/luts"
            startIcon={<ArrowBackIcon />}
          >
            Back to LUT Management
          </Button>
        </Box>
      </Box>
    )
  }

  // Loading state
  if (detailsLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
      </Box>
    )
  }

  // Error state
  if (detailsError) {
    return (
      <Box>
        <Alert severity="error">
          <AlertTitle>Error Loading LUT</AlertTitle>
          {detailsError.message}
        </Alert>
        <Box mt={2}>
          <Button
            component={Link}
            href="/luts"
            startIcon={<ArrowBackIcon />}
          >
            Back to LUT Management
          </Button>
        </Box>
      </Box>
    )
  }

  const previousLut = renewalDetails?.previousLut

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <MuiLink component={Link} href="/dashboard" underline="hover" color="inherit">
            Dashboard
          </MuiLink>
          <MuiLink component={Link} href="/luts" underline="hover" color="inherit">
            LUT Management
          </MuiLink>
          <Typography color="text.primary">Renew LUT</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Button
            component={Link}
            href="/luts"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
          >
            Back
          </Button>
          <Typography variant="h4" component="h1" fontWeight={600}>
            Renew LUT
          </Typography>
        </Box>

        {/* Previous LUT Info */}
        {previousLut && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Renewing from Previous LUT</AlertTitle>
            <Box>
              <Typography variant="body2">
                <strong>LUT Number:</strong> {previousLut.lutNumber}
              </Typography>
              <Typography variant="body2">
                <strong>Valid:</strong> {format(new Date(previousLut.validFrom), 'dd MMM yyyy')} - {format(new Date(previousLut.validTill), 'dd MMM yyyy')}
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Renewal Form */}
        <Card>
          {isSubmitting && <LinearProgress />}
          <CardContent>
            <Typography variant="h6" gutterBottom>
              New LUT Details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter the details of your renewed Letter of Undertaking
            </Typography>

            <Divider sx={{ mb: 3 }} />

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="New LUT Number"
                value={formData.lutNumber}
                onChange={(e) => setFormData({ ...formData, lutNumber: e.target.value })}
                error={!!errors.lutNumber}
                helperText={errors.lutNumber || 'Enter the LUT number from your new filing'}
                disabled={isSubmitting}
                sx={{ mb: 3 }}
              />

              <DatePicker
                label="LUT Date"
                value={formData.lutDate}
                onChange={(newValue) => setFormData({ ...formData, lutDate: newValue })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.lutDate,
                    helperText: errors.lutDate || 'Date when LUT was filed',
                    disabled: isSubmitting,
                    sx: { mb: 3 },
                  },
                }}
              />

              <DatePicker
                label="Valid From"
                value={formData.validFrom}
                onChange={(newValue) => setFormData({ ...formData, validFrom: newValue })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.validFrom,
                    helperText: errors.validFrom || 'Start date of the validity period (typically April 1st)',
                    disabled: isSubmitting,
                    sx: { mb: 3 },
                  },
                }}
              />

              <DatePicker
                label="Valid Till"
                value={formData.validTill}
                onChange={(newValue) => setFormData({ ...formData, validTill: newValue })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.validTill,
                    helperText: errors.validTill || 'End date of the validity period (typically March 31st of next year)',
                    disabled: isSubmitting,
                  },
                }}
              />

              <Box display="flex" gap={2} mt={4}>
                <Button
                  component={Link}
                  href="/luts"
                  variant="outlined"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<RenewIcon />}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Renewing...' : 'Renew LUT'}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </LocalizationProvider>
  )
}
