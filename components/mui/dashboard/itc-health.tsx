'use client'

import React from 'react'
import {
  Paper,
  Typography,
  Box,
  Skeleton,
  Stack,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import {
  Receipt as ITCIcon,
  CheckCircle as MatchedIcon,
  Warning as RiskIcon,
  ContactMail as FollowUpIcon,
  TrendingUp as TrendIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { getActionDescription, type ITCAction } from '@/lib/dashboard/itc-health'

type ITCHealthStatus = 'excellent' | 'good' | 'warning' | 'critical'

function getStatusColor(status: ITCHealthStatus): 'success' | 'info' | 'warning' | 'error' {
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

function getStatusLabel(status: ITCHealthStatus): string {
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function getActionIcon(action: ITCAction) {
  switch (action) {
    case 'followUpVendors':
      return <ContactMail fontSize="small" color="warning" />
    case 'verifyInvoices':
      return <Receipt fontSize="small" color="info" />
    case 'reconcilePending':
      return <TrendIcon fontSize="small" color="primary" />
    case 'reviewMismatches':
      return <RiskIcon fontSize="small" color="error" />
    default:
      return <ITCIcon fontSize="small" />
  }
}

// Import icons used in getActionIcon
import { ContactMail, Receipt } from '@mui/icons-material'

export function ITCHealthCard() {
  const { data, isLoading } = api.dashboard.getITCHealth.useQuery()

  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width="40%" height={32} />
          <Skeleton variant="rectangular" height={20} />
          <Skeleton variant="rectangular" height={100} />
        </Stack>
      </Paper>
    )
  }

  if (!data) return null

  const statusColor = getStatusColor(data.status)

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <ITCIcon color="primary" />
        <Typography variant="h6" fontWeight="bold">
          ITC Reconciliation
        </Typography>
      </Stack>

      {/* Match Rate Progress */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Match Rate
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h5" fontWeight="bold">
              {data.matchRate}%
            </Typography>
            <Chip
              label={getStatusLabel(data.status)}
              color={statusColor}
              size="small"
            />
          </Stack>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={data.matchRate}
          color={statusColor}
          sx={{ height: 8, borderRadius: 1 }}
        />
      </Box>

      {/* Key Metrics */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <MatchedIcon color="success" fontSize="small" />
            <Typography variant="caption" color="text.secondary">
              Matched
            </Typography>
          </Stack>
          <Typography variant="body1" fontWeight="bold">
            {formatCurrency(data.matchedAmount)}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, p: 1.5, bgcolor: 'error.lighter', borderRadius: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <RiskIcon color="error" fontSize="small" />
            <Typography variant="caption" color="text.secondary">
              At Risk
            </Typography>
          </Stack>
          <Typography variant="body1" fontWeight="bold" color="error.main">
            {formatCurrency(data.itcAtRisk)}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, p: 1.5, bgcolor: 'warning.lighter', borderRadius: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FollowUpIcon color="warning" fontSize="small" />
            <Typography variant="caption" color="text.secondary">
              Follow-up
            </Typography>
          </Stack>
          <Typography variant="body1" fontWeight="bold" color="warning.dark">
            {data.followUpNeeded} entries
          </Typography>
        </Box>
      </Stack>

      {/* Summary */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {data.summary}
      </Typography>

      {/* Actions */}
      {data.actions.length > 0 && (
        <Box>
          <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Recommended Actions
          </Typography>
          <List dense disablePadding>
            {data.actions.slice(0, 3).map((action, index) => (
              <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {getActionIcon(action)}
                </ListItemIcon>
                <ListItemText
                  primary={getActionDescription(action)}
                  primaryTypographyProps={{
                    variant: 'body2',
                    color: 'text.secondary',
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* All matched message */}
      {data.matchRate === 100 && (
        <Box
          sx={{
            py: 2,
            textAlign: 'center',
            bgcolor: 'success.lighter',
            borderRadius: 1,
          }}
        >
          <MatchedIcon color="success" sx={{ fontSize: 32, mb: 0.5 }} />
          <Typography color="success.dark" fontWeight="medium">
            All ITC entries are reconciled!
          </Typography>
        </Box>
      )}
    </Paper>
  )
}
