'use client'

import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Skeleton,
  Stack,
  Chip,
} from '@mui/material'
import {
  CheckCircle as MatchedIcon,
  Warning as MismatchIcon,
  Help as PendingIcon,
  Cancel as RejectedIcon,
  Handshake as ResolvedIcon,
} from '@mui/icons-material'
import { formatCurrency } from '@/lib/invoice-utils'

interface ITCSummary {
  igst: number
  cgst: number
  sgst: number
}

interface ReconciliationSummaryData {
  total: number
  matched: number
  matchedITC: ITCSummary
  amountMismatch: number
  mismatchITC: ITCSummary
  in2BOnly: number
  in2BOnlyITC: ITCSummary
  pending: number
  pendingITC: ITCSummary
  rejected: number
  manuallyResolved: number
  resolvedITC: ITCSummary
}

interface ReconciliationDashboardProps {
  summary?: ReconciliationSummaryData
  isLoading?: boolean
  returnPeriod?: string
}

function formatPeriod(period: string): string {
  if (!period || period.length !== 6) return period
  const month = period.substring(0, 2)
  const year = period.substring(2, 6)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const monthIndex = parseInt(month, 10) - 1
  return `${monthNames[monthIndex]} ${year}`
}

function StatCard({
  title,
  count,
  itc,
  color,
  icon,
  isLoading,
}: {
  title: string
  count: number
  itc?: ITCSummary
  color: 'success' | 'warning' | 'error' | 'info' | 'default'
  icon: React.ReactNode
  isLoading?: boolean
}) {
  const colorMap = {
    success: 'success.main',
    warning: 'warning.main',
    error: 'error.main',
    info: 'info.main',
    default: 'text.secondary',
  }

  const bgColorMap = {
    success: 'success.lighter',
    warning: 'warning.lighter',
    error: 'error.lighter',
    info: 'info.lighter',
    default: 'grey.100',
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" height={40} />
          <Skeleton variant="text" width="80%" />
        </CardContent>
      </Card>
    )
  }

  const totalITC = itc ? itc.igst + itc.cgst + itc.sgst : 0

  return (
    <Card
      sx={{
        height: '100%',
        borderLeft: 4,
        borderColor: colorMap[color],
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {count}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: bgColorMap[color],
              color: colorMap[color],
            }}
          >
            {icon}
          </Box>
        </Stack>
        {itc && totalITC > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              ITC Amount
            </Typography>
            <Typography variant="subtitle1" fontWeight="medium" color={colorMap[color]}>
              {formatCurrency(totalITC, 'INR')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              {itc.igst > 0 && (
                <Chip label={`IGST: ${formatCurrency(itc.igst, 'INR')}`} size="small" variant="outlined" />
              )}
              {itc.cgst > 0 && (
                <Chip label={`CGST: ${formatCurrency(itc.cgst, 'INR')}`} size="small" variant="outlined" />
              )}
              {itc.sgst > 0 && (
                <Chip label={`SGST: ${formatCurrency(itc.sgst, 'INR')}`} size="small" variant="outlined" />
              )}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export function ReconciliationDashboard({
  summary,
  isLoading,
  returnPeriod,
}: ReconciliationDashboardProps) {
  return (
    <Box>
      {returnPeriod && (
        <Typography variant="h6" gutterBottom>
          Reconciliation Summary - {formatPeriod(returnPeriod)}
        </Typography>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Matched"
            count={summary?.matched ?? 0}
            itc={summary?.matchedITC}
            color="success"
            icon={<MatchedIcon />}
            isLoading={isLoading}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Amount Mismatch"
            count={summary?.amountMismatch ?? 0}
            itc={summary?.mismatchITC}
            color="warning"
            icon={<MismatchIcon />}
            isLoading={isLoading}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="In 2B Only"
            count={summary?.in2BOnly ?? 0}
            itc={summary?.in2BOnlyITC}
            color="info"
            icon={<PendingIcon />}
            isLoading={isLoading}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Pending Review"
            count={summary?.pending ?? 0}
            itc={summary?.pendingITC}
            color="default"
            icon={<PendingIcon />}
            isLoading={isLoading}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Manually Resolved"
            count={summary?.manuallyResolved ?? 0}
            itc={summary?.resolvedITC}
            color="success"
            icon={<ResolvedIcon />}
            isLoading={isLoading}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Rejected"
            count={summary?.rejected ?? 0}
            color="error"
            icon={<RejectedIcon />}
            isLoading={isLoading}
          />
        </Grid>
      </Grid>

      {summary && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Total ITC Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Claimable ITC (Matched + Resolved)
                </Typography>
                <Typography variant="h5" color="success.main" fontWeight="bold">
                  {formatCurrency(
                    (summary.matchedITC.igst + summary.matchedITC.cgst + summary.matchedITC.sgst) +
                    (summary.resolvedITC.igst + summary.resolvedITC.cgst + summary.resolvedITC.sgst),
                    'INR'
                  )}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  At Risk ITC (Mismatch + In 2B Only)
                </Typography>
                <Typography variant="h5" color="warning.main" fontWeight="bold">
                  {formatCurrency(
                    (summary.mismatchITC.igst + summary.mismatchITC.cgst + summary.mismatchITC.sgst) +
                    (summary.in2BOnlyITC.igst + summary.in2BOnlyITC.cgst + summary.in2BOnlyITC.sgst),
                    'INR'
                  )}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Pending Review
                </Typography>
                <Typography variant="h5" color="text.secondary" fontWeight="bold">
                  {formatCurrency(
                    summary.pendingITC.igst + summary.pendingITC.cgst + summary.pendingITC.sgst,
                    'INR'
                  )}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
