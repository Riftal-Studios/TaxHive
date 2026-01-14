'use client'

import React from 'react'
import {
  Paper,
  Typography,
  Box,
  Skeleton,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
} from '@mui/material'
import {
  CalendarMonth as CalendarIcon,
  CheckCircle as CheckIcon,
  Schedule as PendingIcon,
  Warning as OverdueIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'

// Display status for the calendar (simplified from FilingStatus)
type DisplayStatus = 'FILED' | 'PENDING' | 'OVERDUE'

function getDisplayStatus(status: string, isOverdue: boolean): DisplayStatus {
  if (status === 'FILED' || status === 'APPROVED') return 'FILED'
  if (isOverdue) return 'OVERDUE'
  return 'PENDING'
}

function getStatusColor(status: DisplayStatus): 'success' | 'warning' | 'error' {
  switch (status) {
    case 'FILED':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'OVERDUE':
      return 'error'
  }
}

function getStatusIcon(status: DisplayStatus) {
  switch (status) {
    case 'FILED':
      return <CheckIcon color="success" fontSize="small" />
    case 'PENDING':
      return <PendingIcon color="warning" fontSize="small" />
    case 'OVERDUE':
      return <OverdueIcon color="error" fontSize="small" />
  }
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getDaysLabel(days: number): string {
  if (days === 0) return 'Due today'
  if (days < 0) return `${Math.abs(days)} days overdue`
  return `${days} days left`
}

export function FilingCalendarCard() {
  const { data, isLoading } = api.dashboard.getFilingCalendar.useQuery()

  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width="40%" height={32} />
          <Skeleton variant="rectangular" height={150} />
        </Stack>
      </Paper>
    )
  }

  if (!data) return null

  const { calendar, nextDeadlines, overdueCount } = data

  // Count upcoming (non-overdue pending)
  const upcomingCount = calendar.filter(
    (f) => f.status === 'PENDING' && !f.isOverdue
  ).length

  // Use nextDeadlines from the API (already filtered to pending only)
  const upcomingDeadlines = nextDeadlines.slice(0, 4)

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <CalendarIcon color="primary" />
        <Typography variant="h6" fontWeight="bold">
          Filing Calendar
        </Typography>
      </Stack>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {overdueCount > 0 && (
          <Chip
            icon={<OverdueIcon />}
            label={`${overdueCount} overdue`}
            color="error"
            size="small"
          />
        )}
        {upcomingCount > 0 && (
          <Chip
            icon={<PendingIcon />}
            label={`${upcomingCount} upcoming`}
            color="warning"
            size="small"
            variant="outlined"
          />
        )}
        {overdueCount === 0 && upcomingCount === 0 && (
          <Chip
            icon={<CheckIcon />}
            label="All filings complete"
            color="success"
            size="small"
          />
        )}
      </Stack>

      {/* Upcoming deadlines */}
      {upcomingDeadlines.length > 0 ? (
        <List dense disablePadding>
          {upcomingDeadlines.map((filing, index) => {
            const effectiveStatus = getDisplayStatus(filing.status, filing.isOverdue)
            return (
              <ListItem
                key={index}
                disablePadding
                sx={{
                  py: 1,
                  px: 1,
                  borderRadius: 1,
                  mb: 0.5,
                  bgcolor: filing.isOverdue ? 'error.lighter' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: filing.filingType === 'GSTR1' ? 'primary.main' : 'secondary.main',
                      fontSize: '0.75rem',
                    }}
                  >
                    {filing.filingType === 'GSTR1' ? '1' : '3B'}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight="medium">
                        {filing.filingType}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {filing.periodLabel}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        Due: {formatDate(filing.dueDate)}
                      </Typography>
                      <Chip
                        label={getDaysLabel(filing.daysUntilDue)}
                        size="small"
                        color={getStatusColor(effectiveStatus)}
                        variant={filing.isOverdue ? 'filled' : 'outlined'}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Stack>
                  }
                />
                {getStatusIcon(effectiveStatus)}
              </ListItem>
            )
          })}
        </List>
      ) : (
        <Box
          sx={{
            py: 3,
            textAlign: 'center',
            bgcolor: 'success.lighter',
            borderRadius: 1,
          }}
        >
          <CheckIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
          <Typography color="text.secondary">
            No pending filings. You&apos;re all caught up!
          </Typography>
        </Box>
      )}

      {/* Quick reference */}
      <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          Due dates: GSTR-1 (11th) | GSTR-3B (20th) of following month
        </Typography>
      </Box>
    </Paper>
  )
}
