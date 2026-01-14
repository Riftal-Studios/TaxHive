'use client'

import React from 'react'
import {
  Paper,
  Typography,
  Box,
  Skeleton,
  Stack,
  Divider,
  Chip,
} from '@mui/material'
import {
  AccountBalance as TaxIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

interface GSTRowProps {
  label: string
  igst: number
  cgst: number
  sgst: number
  total: number
  variant?: 'default' | 'highlight' | 'result'
}

function GSTRow({ label, igst, cgst, sgst, total, variant = 'default' }: GSTRowProps) {
  const isHighlight = variant === 'highlight'
  const isResult = variant === 'result'

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
        gap: 1,
        py: 1,
        px: 1,
        bgcolor: isResult ? 'action.selected' : isHighlight ? 'action.hover' : 'transparent',
        borderRadius: 1,
      }}
    >
      <Typography
        variant="body2"
        fontWeight={isResult ? 'bold' : 'medium'}
        color={isResult ? 'primary' : 'text.primary'}
      >
        {label}
      </Typography>
      <Typography variant="body2" align="right" color="text.secondary">
        {formatCurrency(igst)}
      </Typography>
      <Typography variant="body2" align="right" color="text.secondary">
        {formatCurrency(cgst)}
      </Typography>
      <Typography variant="body2" align="right" color="text.secondary">
        {formatCurrency(sgst)}
      </Typography>
      <Typography
        variant="body2"
        align="right"
        fontWeight={isResult ? 'bold' : 'medium'}
        color={isResult ? (total >= 0 ? 'error.main' : 'success.main') : 'text.primary'}
      >
        {formatCurrency(total)}
      </Typography>
    </Box>
  )
}

export function GSTSummaryCard() {
  const { data, isLoading } = api.dashboard.getGSTSummary.useQuery()

  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width="40%" height={32} />
          <Skeleton variant="rectangular" height={200} />
        </Stack>
      </Paper>
    )
  }

  if (!data) return null

  const netTotal =
    data.netPayable.igst + data.netPayable.cgst + data.netPayable.sgst
  const isPayable = netTotal > 0
  const isRefundable = data.accumulatedITC > 0

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <TaxIcon color="primary" />
        <Typography variant="h6" fontWeight="bold">
          GST Summary
        </Typography>
        <Typography variant="body2" color="text.secondary">
          (Current Period)
        </Typography>
      </Stack>

      {/* Header row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          gap: 1,
          py: 1,
          px: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" fontWeight="bold" color="text.secondary">
          Description
        </Typography>
        <Typography variant="caption" fontWeight="bold" align="right" color="text.secondary">
          IGST
        </Typography>
        <Typography variant="caption" fontWeight="bold" align="right" color="text.secondary">
          CGST
        </Typography>
        <Typography variant="caption" fontWeight="bold" align="right" color="text.secondary">
          SGST
        </Typography>
        <Typography variant="caption" fontWeight="bold" align="right" color="text.secondary">
          Total
        </Typography>
      </Box>

      {/* Output Liability */}
      <GSTRow
        label="Output Tax Liability"
        igst={data.outputLiability.igst}
        cgst={data.outputLiability.cgst}
        sgst={data.outputLiability.sgst}
        total={data.outputLiability.total}
      />

      {/* RCM Liability */}
      <GSTRow
        label="RCM Liability"
        igst={data.rcmLiability.igst}
        cgst={data.rcmLiability.cgst}
        sgst={data.rcmLiability.sgst}
        total={data.rcmLiability.total}
        variant="highlight"
      />

      <Divider sx={{ my: 1 }} />

      {/* ITC Available */}
      <GSTRow
        label="ITC Available"
        igst={data.itcAvailable.igst}
        cgst={data.itcAvailable.cgst}
        sgst={data.itcAvailable.sgst}
        total={data.itcAvailable.total}
      />

      <Divider sx={{ my: 1 }} />

      {/* Net Payable */}
      <GSTRow
        label={isPayable ? 'Net Tax Payable' : 'Net ITC Balance'}
        igst={data.netPayable.igst}
        cgst={data.netPayable.cgst}
        sgst={data.netPayable.sgst}
        total={Math.abs(netTotal)}
        variant="result"
      />

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        {isPayable ? (
          <Chip
            icon={<UpIcon />}
            label={`${formatCurrency(netTotal)} payable`}
            color="error"
            size="small"
            variant="outlined"
          />
        ) : (
          <Chip
            icon={<DownIcon />}
            label={`${formatCurrency(Math.abs(netTotal))} credit`}
            color="success"
            size="small"
            variant="outlined"
          />
        )}
        {isRefundable && (
          <Chip
            label={`${formatCurrency(data.accumulatedITC)} accumulated for refund`}
            color="info"
            size="small"
            variant="outlined"
          />
        )}
      </Stack>
    </Paper>
  )
}
