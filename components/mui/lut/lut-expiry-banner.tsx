'use client'

import React from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Skeleton,
} from '@mui/material'
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Add as AddIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'

export function LUTExpiryBanner() {
  const router = useRouter()
  const { data, isLoading } = api.luts.getActiveStatus.useQuery()

  if (isLoading) {
    return (
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
      </Box>
    )
  }

  // No active LUT - show info banner to create one
  if (!data?.hasActiveLut) {
    return (
      <Alert
        severity="info"
        sx={{ mb: 3 }}
        action={
          <Button
            color="inherit"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => router.push('/luts')}
          >
            Add LUT
          </Button>
        }
      >
        <AlertTitle>No Active LUT</AlertTitle>
        You need an active Letter of Undertaking (LUT) to create export invoices without GST.
      </Alert>
    )
  }

  const { status, daysRemaining, warning, lut } = data

  // LUT is expired
  if (status === 'expired') {
    return (
      <Alert
        severity="error"
        icon={<ErrorIcon />}
        sx={{ mb: 3 }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => router.push('/luts/renew?lutId=' + lut?.id)}
          >
            Renew Now
          </Button>
        }
      >
        <AlertTitle>LUT Expired</AlertTitle>
        Your LUT ({lut?.lutNumber}) has expired. You cannot create new export invoices until you renew your LUT.
      </Alert>
    )
  }

  // LUT is expiring soon (within 30 days)
  if (warning && status === 'expiring') {
    const severity = warning.type === 'error' ? 'error' : 'warning'
    return (
      <Alert
        severity={severity}
        icon={<WarningIcon />}
        sx={{ mb: 3 }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => router.push('/luts/renew?lutId=' + lut?.id)}
          >
            Renew LUT
          </Button>
        }
      >
        <AlertTitle>
          LUT Expiring {daysRemaining === 1 ? 'Tomorrow' : `in ${daysRemaining} Days`}
        </AlertTitle>
        {warning.message}
      </Alert>
    )
  }

  // LUT is valid - don't show any banner
  return null
}
