'use client'

import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Alert,
  Stack,
  CircularProgress,
} from '@mui/material'
import {
  CheckCircle as MatchedIcon,
  Warning as MismatchIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import { formatCurrency } from '@/lib/invoice-utils'
import { format } from 'date-fns'
import { api } from '@/lib/trpc/client'

type MatchStatus = 'PENDING' | 'MATCHED' | 'AMOUNT_MISMATCH' | 'NOT_IN_2B' | 'IN_2B_ONLY' | 'REJECTED' | 'MANUALLY_RESOLVED'

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
  mismatchDetails?: {
    taxableValueDiff?: number
    igstDiff?: number
    cgstDiff?: number
    sgstDiff?: number
    notes?: string
  } | null
}

interface MatchDetailModalProps {
  open: boolean
  onClose: () => void
  entry: GSTR2BEntry | null
  onStatusChange?: () => void
}

function DetailRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <TableRow>
      <TableCell sx={{ color: 'text.secondary', border: 'none', py: 0.5 }}>
        {label}
      </TableCell>
      <TableCell sx={{ fontWeight: 500, border: 'none', py: 0.5, color }}>
        {value}
      </TableCell>
    </TableRow>
  )
}

export function MatchDetailModal({
  open,
  onClose,
  entry,
  onStatusChange,
}: MatchDetailModalProps) {
  const { data: potentialMatches, isLoading: loadingMatches } = api.gstr2b.findPotentialMatches.useQuery(
    { entryId: entry?.id || '', limit: 5 },
    { enabled: Boolean(entry?.id) && entry?.matchStatus !== 'MATCHED' }
  )

  const updateStatusMutation = api.gstr2b.updateMatchStatus.useMutation({
    onSuccess: () => {
      onStatusChange?.()
      onClose()
    },
  })

  const manualMatchMutation = api.gstr2b.manualMatch.useMutation({
    onSuccess: () => {
      onStatusChange?.()
      onClose()
    },
  })

  if (!entry) return null

  const totalTax = Number(entry.igst) + Number(entry.cgst) + Number(entry.sgst)
  const mismatchDetails = entry.mismatchDetails

  const handleResolve = () => {
    updateStatusMutation.mutate({
      entryId: entry.id,
      status: 'MANUALLY_RESOLVED',
    })
  }

  const handleReject = () => {
    updateStatusMutation.mutate({
      entryId: entry.id,
      status: 'REJECTED',
    })
  }

  const handleManualMatch = (invoiceId: string) => {
    manualMatchMutation.mutate({
      entryId: entry.id,
      invoiceId,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6">Entry Details</Typography>
          <Chip
            label={entry.matchStatus.replace('_', ' ')}
            color={
              entry.matchStatus === 'MATCHED' || entry.matchStatus === 'MANUALLY_RESOLVED'
                ? 'success'
                : entry.matchStatus === 'AMOUNT_MISMATCH'
                ? 'warning'
                : entry.matchStatus === 'REJECTED'
                ? 'error'
                : 'default'
            }
            size="small"
          />
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* GSTR-2B Entry Details */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              GSTR-2B Entry
            </Typography>
            <Table size="small">
              <TableBody>
                <DetailRow label="Vendor GSTIN" value={entry.vendorGstin || '-'} />
                <DetailRow label="Vendor Name" value={entry.vendorName || '-'} />
                <DetailRow label="Invoice No." value={entry.invoiceNumber} />
                <DetailRow
                  label="Invoice Date"
                  value={format(new Date(entry.invoiceDate), 'dd MMM yyyy')}
                />
                <DetailRow
                  label="Invoice Value"
                  value={formatCurrency(Number(entry.invoiceValue), 'INR')}
                />
                <DetailRow
                  label="Taxable Value"
                  value={formatCurrency(Number(entry.taxableValue), 'INR')}
                />
                <DetailRow label="IGST" value={formatCurrency(Number(entry.igst), 'INR')} />
                <DetailRow label="CGST" value={formatCurrency(Number(entry.cgst), 'INR')} />
                <DetailRow label="SGST" value={formatCurrency(Number(entry.sgst), 'INR')} />
                <DetailRow
                  label="Total Tax"
                  value={formatCurrency(totalTax, 'INR')}
                  color="primary"
                />
              </TableBody>
            </Table>
          </Grid>

          {/* Mismatch Details or Potential Matches */}
          <Grid size={{ xs: 12, md: 6 }}>
            {entry.matchStatus === 'AMOUNT_MISMATCH' && mismatchDetails && (
              <>
                <Typography variant="subtitle2" color="warning.main" gutterBottom>
                  <MismatchIcon
                    fontSize="small"
                    sx={{ verticalAlign: 'middle', mr: 1 }}
                  />
                  Mismatch Details
                </Typography>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Amount differences detected between your records and GSTR-2B
                </Alert>
                <Table size="small">
                  <TableBody>
                    {mismatchDetails.taxableValueDiff !== undefined && (
                      <DetailRow
                        label="Taxable Value Diff"
                        value={formatCurrency(mismatchDetails.taxableValueDiff, 'INR')}
                        color={mismatchDetails.taxableValueDiff !== 0 ? 'error.main' : undefined}
                      />
                    )}
                    {mismatchDetails.igstDiff !== undefined && (
                      <DetailRow
                        label="IGST Diff"
                        value={formatCurrency(mismatchDetails.igstDiff, 'INR')}
                        color={mismatchDetails.igstDiff !== 0 ? 'error.main' : undefined}
                      />
                    )}
                    {mismatchDetails.cgstDiff !== undefined && (
                      <DetailRow
                        label="CGST Diff"
                        value={formatCurrency(mismatchDetails.cgstDiff, 'INR')}
                        color={mismatchDetails.cgstDiff !== 0 ? 'error.main' : undefined}
                      />
                    )}
                    {mismatchDetails.sgstDiff !== undefined && (
                      <DetailRow
                        label="SGST Diff"
                        value={formatCurrency(mismatchDetails.sgstDiff, 'INR')}
                        color={mismatchDetails.sgstDiff !== 0 ? 'error.main' : undefined}
                      />
                    )}
                    {mismatchDetails.notes && (
                      <DetailRow label="Notes" value={mismatchDetails.notes} />
                    )}
                  </TableBody>
                </Table>
              </>
            )}

            {entry.matchStatus === 'MATCHED' && entry.matchConfidence && (
              <>
                <Typography variant="subtitle2" color="success.main" gutterBottom>
                  <MatchedIcon
                    fontSize="small"
                    sx={{ verticalAlign: 'middle', mr: 1 }}
                  />
                  Match Information
                </Typography>
                <Alert severity="success" sx={{ mb: 2 }}>
                  Successfully matched with confidence: {Math.round(entry.matchConfidence * 100)}%
                </Alert>
              </>
            )}

            {(entry.matchStatus === 'IN_2B_ONLY' || entry.matchStatus === 'PENDING') && (
              <>
                <Typography variant="subtitle2" color="info.main" gutterBottom>
                  <InfoIcon
                    fontSize="small"
                    sx={{ verticalAlign: 'middle', mr: 1 }}
                  />
                  Potential Matches
                </Typography>
                {loadingMatches ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : potentialMatches && potentialMatches.length > 0 ? (
                  <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {potentialMatches.map((match, index) => (
                      <Box
                        key={match.invoice?.id || index}
                        sx={{
                          p: 1.5,
                          mb: 1,
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {match.invoice?.invoiceNumber}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Similarity: {Math.round(match.similarity * 100)}%
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              match.invoice?.id && handleManualMatch(match.invoice.id)
                            }
                            disabled={manualMatchMutation.isPending}
                          >
                            Link
                          </Button>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info">
                    No potential matches found. You may need to create a purchase invoice for this entry.
                  </Alert>
                )}
              </>
            )}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {entry.matchStatus !== 'MATCHED' &&
          entry.matchStatus !== 'MANUALLY_RESOLVED' &&
          entry.matchStatus !== 'REJECTED' && (
            <>
              <Button
                color="error"
                onClick={handleReject}
                disabled={updateStatusMutation.isPending}
              >
                Reject ITC
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleResolve}
                disabled={updateStatusMutation.isPending}
              >
                Mark as Resolved
              </Button>
            </>
          )}
      </DialogActions>
    </Dialog>
  )
}
