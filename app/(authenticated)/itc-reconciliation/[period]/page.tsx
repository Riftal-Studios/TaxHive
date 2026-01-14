'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  Stack,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Refresh as ReconcileIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material'
import NextLink from 'next/link'
import { api } from '@/lib/trpc/client'
import {
  ReconciliationDashboard,
  ReconciliationTable,
  MatchDetailModal,
} from '@/components/itc'

type MatchStatus = 'PENDING' | 'MATCHED' | 'AMOUNT_MISMATCH' | 'NOT_IN_2B' | 'IN_2B_ONLY' | 'REJECTED' | 'MANUALLY_RESOLVED'
type FilterStatus = 'ALL' | MatchStatus

interface GSTR2BEntry {
  id: string
  vendorGstin: string
  vendorName?: string | null
  invoiceNumber: string
  invoiceDate: Date | string
  invoiceValue: string | number
  taxableValue: string | number
  igst: string | number
  cgst: string | number
  sgst: string | number
  matchStatus: MatchStatus
  matchedInvoiceId?: string | null
  matchConfidence?: number | null
  mismatchDetails?: Record<string, unknown> | null
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

export default function PeriodReconciliationPage() {
  const params = useParams()
  const router = useRouter()
  const period = params.period as string

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [selectedEntry, setSelectedEntry] = useState<GSTR2BEntry | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  const utils = api.useUtils()

  // Get upload for this period
  const { data: uploadData, isLoading: uploadLoading, error: uploadError } = api.gstr2b.getByPeriod.useQuery(
    { returnPeriod: period },
    { enabled: Boolean(period) }
  )

  // Get entries for this upload
  const { data: entriesData, isLoading: entriesLoading } = api.gstr2b.getEntries.useQuery(
    {
      uploadId: uploadData?.upload?.id || '',
      matchStatus: statusFilter === 'ALL' ? undefined : statusFilter,
    },
    { enabled: Boolean(uploadData?.upload?.id) }
  )

  // Get summary for this upload
  const { data: summaryData, isLoading: summaryLoading } = api.gstr2b.getSummary.useQuery(
    { uploadId: uploadData?.upload?.id || '' },
    { enabled: Boolean(uploadData?.upload?.id) }
  )

  // Run reconciliation mutation
  const reconcileMutation = api.gstr2b.runReconciliation.useMutation({
    onSuccess: () => {
      utils.gstr2b.getEntries.invalidate()
      utils.gstr2b.getSummary.invalidate()
      utils.gstr2b.getByPeriod.invalidate()
    },
  })

  const handleRunReconciliation = () => {
    if (uploadData?.upload?.id) {
      reconcileMutation.mutate({ uploadId: uploadData.upload.id })
    }
  }

  const handleViewDetails = (entry: GSTR2BEntry) => {
    setSelectedEntry(entry)
    setDetailModalOpen(true)
  }

  const handleCloseDetail = () => {
    setDetailModalOpen(false)
    setSelectedEntry(null)
  }

  const handleStatusChange = () => {
    utils.gstr2b.getEntries.invalidate()
    utils.gstr2b.getSummary.invalidate()
  }

  const handleFilterChange = (_: React.MouseEvent<HTMLElement>, newFilter: FilterStatus | null) => {
    if (newFilter !== null) {
      setStatusFilter(newFilter)
    }
  }

  if (uploadLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (uploadError || !uploadData?.upload) {
    return (
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={NextLink} href="/itc-reconciliation" underline="hover" color="inherit">
            ITC Reconciliation
          </Link>
          <Typography color="text.primary">{formatPeriod(period)}</Typography>
        </Breadcrumbs>

        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/itc-reconciliation')}
          sx={{ mb: 3 }}
        >
          Back
        </Button>

        <Alert severity="warning">
          No GSTR-2B upload found for {formatPeriod(period)}.
          <Button
            size="small"
            onClick={() => router.push('/itc-reconciliation/upload')}
            sx={{ ml: 2 }}
          >
            Upload GSTR-2B
          </Button>
        </Alert>
      </Box>
    )
  }

  const upload = uploadData.upload
  // Transform entries to convert Decimal to number and handle JSON types
  const entries: GSTR2BEntry[] = (entriesData?.entries || []).map((entry) => ({
    id: entry.id,
    vendorGstin: entry.vendorGstin,
    vendorName: entry.vendorName,
    invoiceNumber: entry.invoiceNumber,
    invoiceDate: entry.invoiceDate,
    invoiceValue: Number(entry.invoiceValue),
    taxableValue: Number(entry.taxableValue),
    igst: Number(entry.igst),
    cgst: Number(entry.cgst),
    sgst: Number(entry.sgst),
    matchStatus: entry.matchStatus,
    matchedInvoiceId: entry.matchedInvoiceId,
    matchConfidence: entry.matchConfidence,
    mismatchDetails: entry.mismatchDetails as Record<string, unknown> | null,
  }))
  const summary = summaryData

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={NextLink} href="/itc-reconciliation" underline="hover" color="inherit">
          ITC Reconciliation
        </Link>
        <Typography color="text.primary">{formatPeriod(period)}</Typography>
      </Breadcrumbs>

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => router.push('/itc-reconciliation')}
            variant="text"
          >
            Back
          </Button>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              {formatPeriod(period)}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {upload.entriesCount} entries uploaded
            </Typography>
          </Box>
        </Stack>

        <Button
          variant="contained"
          startIcon={reconcileMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <ReconcileIcon />}
          onClick={handleRunReconciliation}
          disabled={reconcileMutation.isPending}
        >
          {reconcileMutation.isPending ? 'Reconciling...' : 'Run Reconciliation'}
        </Button>
      </Stack>

      {reconcileMutation.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to run reconciliation. Please try again.
        </Alert>
      )}

      {reconcileMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Reconciliation completed successfully!
        </Alert>
      )}

      {/* Summary Dashboard */}
      <ReconciliationDashboard
        summary={summary}
        isLoading={summaryLoading}
      />

      {/* Filter Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <FilterIcon color="action" />
          <Typography variant="body2" color="text.secondary">
            Filter by status:
          </Typography>
          <ToggleButtonGroup
            value={statusFilter}
            exclusive
            onChange={handleFilterChange}
            size="small"
          >
            <ToggleButton value="ALL">
              All ({upload.entriesCount})
            </ToggleButton>
            <ToggleButton value="MATCHED" color="success">
              Matched ({upload.matchedCount || 0})
            </ToggleButton>
            <ToggleButton value="AMOUNT_MISMATCH" color="warning">
              Mismatch ({upload.mismatchedCount || 0})
            </ToggleButton>
            <ToggleButton value="PENDING">
              Pending
            </ToggleButton>
            <ToggleButton value="IN_2B_ONLY" color="info">
              In 2B Only
            </ToggleButton>
            <ToggleButton value="REJECTED" color="error">
              Rejected
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* Entries Table */}
      <ReconciliationTable
        entries={entries}
        isLoading={entriesLoading}
        uploadId={upload.id}
        onViewDetails={handleViewDetails}
        onStatusChange={handleStatusChange}
      />

      {/* Detail Modal */}
      <MatchDetailModal
        open={detailModalOpen}
        onClose={handleCloseDetail}
        entry={selectedEntry}
        onStatusChange={handleStatusChange}
      />
    </Box>
  )
}
