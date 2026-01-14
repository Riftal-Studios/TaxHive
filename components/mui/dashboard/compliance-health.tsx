'use client'

import React from 'react'
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Skeleton,
  Stack,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'

type ComplianceStatus = 'excellent' | 'good' | 'warning' | 'critical'
type IssueSeverity = 'error' | 'warning' | 'info'

function getStatusColor(status: ComplianceStatus): 'success' | 'info' | 'warning' | 'error' {
  switch (status) {
    case 'excellent':
      return 'success'
    case 'good':
      return 'info'
    case 'warning':
      return 'warning'
    case 'critical':
      return 'error'
  }
}

function getStatusLabel(status: ComplianceStatus): string {
  switch (status) {
    case 'excellent':
      return 'Excellent'
    case 'good':
      return 'Good'
    case 'warning':
      return 'Needs Attention'
    case 'critical':
      return 'Critical'
  }
}

function SeverityIcon({ severity }: { severity: IssueSeverity }) {
  switch (severity) {
    case 'error':
      return <ErrorIcon color="error" fontSize="small" />
    case 'warning':
      return <WarningIcon color="warning" fontSize="small" />
    case 'info':
      return <InfoIcon color="info" fontSize="small" />
  }
}

function CircularProgressWithLabel({ value, status }: { value: number; status: ComplianceStatus }) {
  const color = getStatusColor(status)

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={120}
        thickness={4}
        sx={{ color: 'action.hover', position: 'absolute' }}
      />
      <CircularProgress
        variant="determinate"
        value={value}
        size={120}
        thickness={4}
        color={color}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h4" component="div" fontWeight="bold">
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          /100
        </Typography>
      </Box>
    </Box>
  )
}

export function ComplianceHealthCard() {
  const { data, isLoading } = api.dashboard.getComplianceHealth.useQuery()

  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={3} alignItems="center">
          <Skeleton variant="circular" width={120} height={120} />
          <Box flex={1}>
            <Skeleton variant="text" width="60%" height={32} />
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
          </Box>
        </Stack>
      </Paper>
    )
  }

  if (!data) return null

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <ShieldIcon color="primary" />
        <Typography variant="h6" fontWeight="bold">
          Compliance Health
        </Typography>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
        <CircularProgressWithLabel value={data.score} status={data.status} />

        <Box flex={1}>
          <Chip
            label={getStatusLabel(data.status)}
            color={getStatusColor(data.status)}
            size="small"
            sx={{ mb: 1 }}
          />

          {data.issues.length === 0 ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
              <CheckIcon color="success" />
              <Typography color="text.secondary">
                All compliance requirements are met
              </Typography>
            </Stack>
          ) : (
            <List dense disablePadding>
              {data.issues.slice(0, 3).map((issue, index) => (
                <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <SeverityIcon severity={issue.severity as IssueSeverity} />
                  </ListItemIcon>
                  <ListItemText
                    primary={issue.message}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: 'text.secondary',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                LUT Status
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {data.details.lut.status}
                {data.details.lut.daysRemaining !== null &&
                  data.details.lut.daysRemaining > 0 &&
                  ` (${data.details.lut.daysRemaining}d remaining)`}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Pending Filings
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {data.details.filings.pending}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Overdue
              </Typography>
              <Typography
                variant="body2"
                fontWeight="medium"
                color={data.details.filings.overdue > 0 ? 'error' : 'inherit'}
              >
                {data.details.filings.overdue}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  )
}
