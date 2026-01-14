'use client'

import React, { useState } from 'react'
import {
  Box,
  Typography,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  CircularProgress,
  Paper,
  Stack,
  Tabs,
  Tab,
} from '@mui/material'
import { FilingPeriodCard } from '@/components/mui/gst-filings/filing-period-card'
import { api } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { FilingType } from '@prisma/client'
import { format, parseISO } from 'date-fns'

function formatPeriod(period: string): string {
  // period is in YYYY-MM format
  const date = parseISO(`${period}-01`)
  return format(date, 'MMMM yyyy')
}

export default function GSTFilingsPage() {
  const router = useRouter()
  const [filingType, setFilingType] = useState<FilingType | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<number>(0) // 0 = All, 1 = Pending, 2 = Filed

  const { data: filingPeriods, isLoading, refetch } = api.gstFiling.listFilingPeriods.useQuery({
    filingType: filingType === 'ALL' ? undefined : filingType,
  })

  const { data: upcomingDueDates } = api.gstFiling.getUpcomingDueDates.useQuery({ count: 3 })

  const generateGSTR1 = api.gstFiling.generateGSTR1Plan.useMutation({
    onSuccess: () => refetch(),
  })

  const generateGSTR3B = api.gstFiling.generateGSTR3BPlan.useMutation({
    onSuccess: () => refetch(),
  })

  const handleGenerate = (periodId: string, type: FilingType) => {
    if (type === 'GSTR1') {
      generateGSTR1.mutate({ period: periodId })
    } else {
      generateGSTR3B.mutate({ period: periodId })
    }
  }

  const handleView = (periodId: string) => {
    router.push(`/gst-filings/${periodId}`)
  }

  const filteredPeriods = filingPeriods?.filter((period) => {
    if (statusFilter === 1) {
      // Pending - not filed
      return period.status !== 'FILED'
    }
    if (statusFilter === 2) {
      // Filed
      return period.status === 'FILED'
    }
    return true
  })

  // Flatten the upcoming due dates to check for overdue filings
  const overdueFilings: { filingType: string; period: string }[] = []
  upcomingDueDates?.forEach((d) => {
    if (d.gstr1.isOverdue && d.gstr1.status !== 'FILED') {
      overdueFilings.push({ filingType: 'GSTR-1', period: d.period })
    }
    if (d.gstr3b.isOverdue && d.gstr3b.status !== 'FILED') {
      overdueFilings.push({ filingType: 'GSTR-3B', period: d.period })
    }
  })

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        GST Filings
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Generate and manage your GSTR-1 and GSTR-3B filing plans.
      </Typography>

      {overdueFilings.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          You have {overdueFilings.length} overdue filing(s):{' '}
          {overdueFilings.map((f) => `${f.filingType} for ${formatPeriod(f.period)}`).join(', ')}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={2}
          sx={{ p: 2 }}
        >
          <ToggleButtonGroup
            value={filingType}
            exclusive
            onChange={(_, value) => value && setFilingType(value)}
            size="small"
          >
            <ToggleButton value="ALL">All</ToggleButton>
            <ToggleButton value="GSTR1">GSTR-1</ToggleButton>
            <ToggleButton value="GSTR3B">GSTR-3B</ToggleButton>
          </ToggleButtonGroup>

          <Tabs
            value={statusFilter}
            onChange={(_, value) => setStatusFilter(value)}
            sx={{ minHeight: 'auto' }}
          >
            <Tab label="All" sx={{ minHeight: 'auto', py: 1 }} />
            <Tab label="Pending" sx={{ minHeight: 'auto', py: 1 }} />
            <Tab label="Filed" sx={{ minHeight: 'auto', py: 1 }} />
          </Tabs>
        </Stack>
      </Paper>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : filteredPeriods && filteredPeriods.length > 0 ? (
        <Grid container spacing={3}>
          {filteredPeriods.map((period) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={period.id}>
              <FilingPeriodCard
                id={period.id}
                filingType={period.filingType}
                period={period.period}
                formattedPeriod={formatPeriod(period.period)}
                fiscalYear={period.fiscalYear}
                status={period.status}
                dueDate={new Date(period.dueDate)}
                daysUntilDue={period.daysUntilDue}
                isOverdue={period.isOverdue}
                totalTaxableValue={period.totalTaxableValue ? Number(period.totalTaxableValue) : null}
                totalTaxAmount={period.totalTaxAmount ? Number(period.totalTaxAmount) : null}
                itemsCount={period._count.planItems}
                onGenerate={() => handleGenerate(period.period, period.filingType)}
                onView={() => handleView(period.id)}
                isGenerating={
                  (generateGSTR1.isPending && period.filingType === 'GSTR1') ||
                  (generateGSTR3B.isPending && period.filingType === 'GSTR3B')
                }
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No filing periods found. Filing periods are created automatically based on your invoices.
          </Typography>
        </Paper>
      )}
    </Box>
  )
}
