'use client'

import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Skeleton,
  Stack,
} from '@mui/material'
import {
  Inbox as InboxIcon,
  HourglassEmpty as PendingIcon,
  AutoAwesome as ProcessingIcon,
  CheckCircle as ProcessedIcon,
  Error as FailedIcon,
  RateReview as ReviewIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number | undefined
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  loading?: boolean
}

function StatCard({ icon, label, value, color = 'primary', loading }: StatCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ py: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: `${color}.lighter`,
              color: `${color}.main`,
              display: 'flex',
            }}
          >
            {icon}
          </Box>
          <Box>
            {loading ? (
              <Skeleton variant="text" width={40} height={32} />
            ) : (
              <Typography variant="h5" fontWeight="bold">
                {value ?? 0}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function InboxStats() {
  const { data: stats, isLoading } = api.inbox.getStats.useQuery()

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<InboxIcon />}
            label="Total"
            value={stats?.total}
            color="primary"
            loading={isLoading}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<PendingIcon />}
            label="Pending"
            value={stats?.byStatus.pending}
            color="info"
            loading={isLoading}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<ProcessingIcon />}
            label="Processing"
            value={stats?.byStatus.processing}
            color="warning"
            loading={isLoading}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<ProcessedIcon />}
            label="Processed"
            value={stats?.byStatus.processed}
            color="success"
            loading={isLoading}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<FailedIcon />}
            label="Failed"
            value={stats?.byStatus.failed}
            color="error"
            loading={isLoading}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            icon={<ReviewIcon />}
            label="Needs Review"
            value={stats?.needsReview}
            color="warning"
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Classification breakdown */}
      {stats?.byClassification && Object.keys(stats.byClassification).length > 0 && (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              By Classification
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {Object.entries(stats.byClassification).map(([classification, count]) => (
                <Chip
                  key={classification}
                  label={`${classification.replace(/_/g, ' ')}: ${count}`}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
