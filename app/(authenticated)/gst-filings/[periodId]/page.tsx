'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Stack,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  CalendarMonth as CalendarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { FilingItemTable } from '@/components/mui/gst-filings/filing-item-table'
import { api } from '@/lib/trpc/client'
import { formatCurrency } from '@/lib/invoice-utils'
import { FilingStatus } from '@prisma/client'
import { format } from 'date-fns'

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

interface TabPanelProps {
  children?: React.ReactNode
  value: number
  index: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  )
}

export default function FilingPeriodDetailPage() {
  const params = useParams()
  const router = useRouter()
  const periodId = params.periodId as string

  const [tabValue, setTabValue] = useState(0)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    status: FilingStatus | null
    title: string
    message: string
  }>({ open: false, status: null, title: '', message: '' })

  const { data: period, isLoading, refetch } = api.gstFiling.getFilingPeriod.useQuery({ periodId })
  const { data: tableSummary } = api.gstFiling.getTableSummary.useQuery(
    { periodId },
    { enabled: !!period && period.status !== 'DRAFT' }
  )
  const { data: flaggedItems } = api.gstFiling.getFlaggedItems.useQuery(
    { periodId },
    { enabled: !!period && period.status !== 'DRAFT' }
  )

  const updateStatus = api.gstFiling.updateFilingStatus.useMutation({
    onSuccess: () => {
      refetch()
      setConfirmDialog({ open: false, status: null, title: '', message: '' })
    },
  })

  const updatePlanItem = api.gstFiling.updatePlanItem.useMutation({
    onSuccess: () => refetch(),
  })

  const handleToggleInclude = (itemId: string, isIncluded: boolean) => {
    updatePlanItem.mutate({ itemId, isIncluded })
  }

  const handleViewInvoice = (invoiceId: string) => {
    router.push(`/invoices/${invoiceId}`)
  }

  const handleStatusChange = (status: FilingStatus) => {
    const messages: Record<FilingStatus, { title: string; message: string }> = {
      DRAFT: { title: 'Reset to Draft', message: 'This will reset the filing to draft status.' },
      GENERATED: { title: 'Regenerate', message: 'This will regenerate the filing plan.' },
      IN_REVIEW: { title: 'Mark for Review', message: 'This will mark the filing as ready for review.' },
      APPROVED: { title: 'Approve Filing', message: 'This will approve the filing for submission.' },
      FILED: { title: 'Mark as Filed', message: 'This will mark the filing as submitted to the GST portal.' },
      AMENDED: { title: 'Mark as Amended', message: 'This will mark the filing as amended.' },
    }

    setConfirmDialog({
      open: true,
      status,
      ...messages[status],
    })
  }

  const confirmStatusChange = () => {
    if (confirmDialog.status) {
      updateStatus.mutate({ periodId, status: confirmDialog.status })
    }
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (!period) {
    return (
      <Box textAlign="center" py={4}>
        <Typography>Filing period not found.</Typography>
        <Button startIcon={<BackIcon />} onClick={() => router.push('/gst-filings')} sx={{ mt: 2 }}>
          Back to Filings
        </Button>
      </Box>
    )
  }

  const isGSTR3B = period.filingType === 'GSTR3B'

  // Type guard for flags
  type FlagType = { severity: string; code: string; message: string }
  const hasErrorFlags = (flags: unknown): boolean => {
    if (!Array.isArray(flags)) return false
    return flags.some((f: FlagType) => f.severity === 'error')
  }
  const hasWarningFlags = (flags: unknown): boolean => {
    if (!Array.isArray(flags)) return false
    return flags.some((f: FlagType) => f.severity === 'warning')
  }

  const errorFlags = flaggedItems?.filter((item) => hasErrorFlags(item.flags)) || []
  const warningFlags = flaggedItems?.filter((item) => hasWarningFlags(item.flags)) || []

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => router.push('/gst-filings')}>
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h4" fontWeight="bold">
              {period.filingType === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B'}
            </Typography>
            <StatusChip status={period.status} />
          </Stack>
          <Typography variant="body1" color="text.secondary">
            {period.formattedPeriod} (FY {period.fiscalYear})
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Due Date Alert */}
      {period.isOverdue && period.status !== 'FILED' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          This filing is overdue by {Math.abs(period.daysUntilDue)} days. The due date was{' '}
          {format(new Date(period.dueDate), 'dd MMM yyyy')}.
        </Alert>
      )}

      {/* Flagged Items Alert */}
      {errorFlags.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorFlags.length} item(s) have errors that need to be resolved before filing.
        </Alert>
      )}
      {warningFlags.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {warningFlags.length} item(s) have warnings that should be reviewed.
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Due Date
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                {period.status === 'FILED' ? (
                  <CheckIcon fontSize="small" color="success" />
                ) : period.isOverdue ? (
                  <WarningIcon fontSize="small" color="error" />
                ) : (
                  <CalendarIcon fontSize="small" />
                )}
                <Typography variant="h6">
                  {format(new Date(period.dueDate), 'dd MMM yyyy')}
                </Typography>
              </Stack>
              {period.status !== 'FILED' && (
                <Typography
                  variant="caption"
                  color={period.isOverdue ? 'error.main' : 'text.secondary'}
                >
                  {period.isOverdue
                    ? `${Math.abs(period.daysUntilDue)} days overdue`
                    : `${period.daysUntilDue} days remaining`}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Items
              </Typography>
              <Typography variant="h6">{period.planItems.length}</Typography>
              {flaggedItems && flaggedItems.length > 0 && (
                <Typography variant="caption" color="warning.main">
                  {flaggedItems.length} flagged
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Taxable Value
              </Typography>
              <Typography variant="h6">
                {formatCurrency(Number(period.totalTaxableValue), 'INR')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {isGSTR3B ? 'Net Tax Payable' : 'Total Tax'}
              </Typography>
              <Typography variant="h6" color="primary">
                {isGSTR3B
                  ? formatCurrency(Number(period.netTaxPayable), 'INR')
                  : formatCurrency(Number(period.totalTaxAmount), 'INR')}
              </Typography>
              {isGSTR3B && (
                <Typography variant="caption" color="text.secondary">
                  Tax: {formatCurrency(Number(period.totalTaxAmount), 'INR')} - ITC:{' '}
                  {formatCurrency(
                    Number(period.totalItcIgst) +
                      Number(period.totalItcCgst) +
                      Number(period.totalItcSgst),
                    'INR'
                  )}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Table Summary */}
      {tableSummary && tableSummary.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {isGSTR3B ? 'Section' : 'Table'} Summary
          </Typography>
          <Grid container spacing={2}>
            {tableSummary.map((summary) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={summary.table}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      {summary.table}
                    </Typography>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Items
                        </Typography>
                        <Typography variant="body2">{summary.count}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Taxable Value
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(summary.taxableValue, 'INR')}
                        </Typography>
                      </Stack>
                      <Divider sx={{ my: 0.5 }} />
                      {summary.igst > 0 && (
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            IGST
                          </Typography>
                          <Typography variant="body2">
                            {formatCurrency(summary.igst, 'INR')}
                          </Typography>
                        </Stack>
                      )}
                      {summary.cgst > 0 && (
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            CGST
                          </Typography>
                          <Typography variant="body2">
                            {formatCurrency(summary.cgst, 'INR')}
                          </Typography>
                        </Stack>
                      )}
                      {summary.sgst > 0 && (
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            SGST
                          </Typography>
                          <Typography variant="body2">
                            {formatCurrency(summary.sgst, 'INR')}
                          </Typography>
                        </Stack>
                      )}
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" fontWeight="medium">
                          Total Tax
                        </Typography>
                        <Typography variant="body2" fontWeight="medium" color="primary">
                          {formatCurrency(summary.totalTax, 'INR')}
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Items Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, value) => setTabValue(value)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label={`All Items (${period.planItems.length})`} />
          <Tab label={`Flagged (${flaggedItems?.length || 0})`} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <FilingItemTable
            items={period.planItems.map((item) => ({
              ...item,
              invoiceDate: item.invoiceDate ? new Date(item.invoiceDate) : null,
              taxableValue: Number(item.taxableValue),
              igstAmount: Number(item.igstAmount),
              cgstAmount: Number(item.cgstAmount),
              sgstAmount: Number(item.sgstAmount),
              flags: item.flags as { code: string; message: string; severity: 'error' | 'warning' | 'info' }[] | null,
            }))}
            onToggleInclude={handleToggleInclude}
            onViewInvoice={handleViewInvoice}
            isUpdating={updatePlanItem.isPending}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {flaggedItems && flaggedItems.length > 0 ? (
            <FilingItemTable
              items={flaggedItems.map((item) => ({
                ...item,
                invoiceDate: item.invoiceDate ? new Date(item.invoiceDate) : null,
                taxableValue: Number(item.taxableValue),
                igstAmount: Number(item.igstAmount),
                cgstAmount: Number(item.cgstAmount),
                sgstAmount: Number(item.sgstAmount),
                flags: item.flags as { code: string; message: string; severity: 'error' | 'warning' | 'info' }[] | null,
              }))}
              onToggleInclude={handleToggleInclude}
              onViewInvoice={handleViewInvoice}
              isUpdating={updatePlanItem.isPending}
            />
          ) : (
            <Box textAlign="center" py={4}>
              <CheckIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
              <Typography color="text.secondary">No flagged items. All items passed validation.</Typography>
            </Box>
          )}
        </TabPanel>
      </Paper>

      {/* Workflow Actions */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Workflow Actions
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {period.status === 'GENERATED' && (
            <>
              <Button
                variant="contained"
                color="warning"
                onClick={() => handleStatusChange('IN_REVIEW')}
              >
                Send for Review
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleStatusChange('APPROVED')}
                disabled={errorFlags.length > 0}
              >
                Approve Directly
              </Button>
            </>
          )}

          {period.status === 'IN_REVIEW' && (
            <>
              <Button
                variant="contained"
                color="info"
                onClick={() => handleStatusChange('APPROVED')}
                disabled={errorFlags.length > 0}
              >
                Approve
              </Button>
              <Button variant="outlined" onClick={() => handleStatusChange('GENERATED')}>
                Back to Generated
              </Button>
            </>
          )}

          {period.status === 'APPROVED' && (
            <>
              <Button
                variant="contained"
                color="success"
                onClick={() => handleStatusChange('FILED')}
              >
                Mark as Filed
              </Button>
              <Button variant="outlined" onClick={() => handleStatusChange('IN_REVIEW')}>
                Back to Review
              </Button>
            </>
          )}

          {period.status === 'FILED' && (
            <Button variant="outlined" color="warning" onClick={() => handleStatusChange('AMENDED')}>
              Mark as Amended
            </Button>
          )}

          {period.status === 'AMENDED' && (
            <Button variant="outlined" onClick={() => handleStatusChange('FILED')}>
              Mark as Filed
            </Button>
          )}
        </Stack>

        {errorFlags.length > 0 && (period.status === 'GENERATED' || period.status === 'IN_REVIEW') && (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
            Cannot approve: {errorFlags.length} error(s) must be resolved first.
          </Typography>
        )}
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, status: null, title: '', message: '' })}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, status: null, title: '', message: '' })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmStatusChange}
            disabled={updateStatus.isPending}
          >
            {updateStatus.isPending ? 'Updating...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
