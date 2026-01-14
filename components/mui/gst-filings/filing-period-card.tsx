'use client'

import React from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Stack,
  Button,
  Box,
  LinearProgress,
} from '@mui/material'
import {
  CalendarMonth as CalendarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material'
import { formatCurrency } from '@/lib/invoice-utils'
import { FilingStatus, FilingType } from '@prisma/client'

interface FilingPeriodCardProps {
  id: string
  filingType: FilingType
  period: string
  formattedPeriod: string
  fiscalYear: string
  status: FilingStatus
  dueDate: Date
  daysUntilDue: number
  isOverdue: boolean
  totalTaxableValue: number | null
  totalTaxAmount: number | null
  itemsCount: number
  onGenerate?: () => void
  onView?: () => void
  isGenerating?: boolean
}

function StatusChip({ status }: { status: FilingStatus }) {
  const statusConfig: Record<
    FilingStatus,
    { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'info' }
  > = {
    DRAFT: { label: 'Draft', color: 'default' },
    GENERATED: { label: 'Generated', color: 'primary' },
    IN_REVIEW: { label: 'In Review', color: 'warning' },
    APPROVED: { label: 'Approved', color: 'info' },
    FILED: { label: 'Filed', color: 'success' },
    AMENDED: { label: 'Amended', color: 'warning' },
  }

  const config = statusConfig[status] || { label: status, color: 'default' as const }

  return <Chip label={config.label} color={config.color} size="small" />
}

export function FilingPeriodCard({
  id: _id,
  filingType,
  period: _period,
  formattedPeriod,
  fiscalYear: _fiscalYear,
  status,
  dueDate: _dueDate,
  daysUntilDue,
  isOverdue,
  totalTaxableValue,
  totalTaxAmount,
  itemsCount,
  onGenerate,
  onView,
  isGenerating,
}: FilingPeriodCardProps) {
  const getDueDateColor = () => {
    if (isOverdue) return 'error.main'
    if (daysUntilDue <= 5) return 'warning.main'
    return 'text.secondary'
  }

  const getDueDateIcon = () => {
    if (status === 'FILED') return <CheckIcon fontSize="small" color="success" />
    if (isOverdue) return <WarningIcon fontSize="small" color="error" />
    return <CalendarIcon fontSize="small" />
  }

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: 3,
        borderColor: filingType === 'GSTR1' ? 'primary.main' : 'secondary.main',
      }}
    >
      {isGenerating && <LinearProgress />}
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {filingType === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formattedPeriod}
            </Typography>
          </Box>
          <StatusChip status={status} />
        </Stack>

        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {getDueDateIcon()}
            <Typography variant="body2" color={getDueDateColor()}>
              {status === 'FILED'
                ? 'Filed'
                : isOverdue
                  ? `Overdue by ${Math.abs(daysUntilDue)} days`
                  : `Due in ${daysUntilDue} days`}
            </Typography>
          </Stack>

          {status !== 'DRAFT' && (
            <>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Items
                </Typography>
                <Typography variant="subtitle1" fontWeight="medium">
                  {itemsCount}
                </Typography>
              </Box>

              {totalTaxableValue !== null && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Taxable Value
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="medium">
                    {formatCurrency(totalTaxableValue, 'INR')}
                  </Typography>
                </Box>
              )}

              {totalTaxAmount !== null && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Tax Amount
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="medium" color="primary">
                    {formatCurrency(totalTaxAmount, 'INR')}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Stack>
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0 }}>
        {status === 'DRAFT' ? (
          <Button
            variant="contained"
            fullWidth
            onClick={onGenerate}
            disabled={isGenerating}
          >
            Generate Plan
          </Button>
        ) : (
          <Button variant="outlined" fullWidth onClick={onView}>
            View Details
          </Button>
        )}
      </CardActions>
    </Card>
  )
}
