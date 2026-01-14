'use client'

import React, { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Button,
  Grid,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Tooltip,
  Paper,
} from '@mui/material'
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Refresh as ReprocessIcon,
  Description as DocumentIcon,
  Image as ImageIcon,
  TableChart as CsvIcon,
  OpenInNew as OpenIcon,
  Edit as EditIcon,
  AutoAwesome as AIIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { DocumentSourceType, DocumentStatus, DocumentClassification, ReviewStatus } from '@prisma/client'
import { format } from 'date-fns'
import { enqueueSnackbar } from 'notistack'
import { api } from '@/lib/trpc/client'

interface DocumentReviewCardProps {
  documentId: string
  onActionComplete?: () => void
}

const SOURCE_TYPE_LABELS: Record<DocumentSourceType, string> = {
  [DocumentSourceType.UPWORK]: 'Upwork',
  [DocumentSourceType.TOPTAL]: 'Toptal',
  [DocumentSourceType.CLIENT_INVOICE]: 'Client Invoice',
  [DocumentSourceType.VENDOR_BILL]: 'Vendor Bill',
  [DocumentSourceType.BANK_STATEMENT]: 'Bank Statement',
  [DocumentSourceType.SCREENSHOT]: 'Screenshot',
  [DocumentSourceType.OTHER]: 'Other',
}

const CLASSIFICATION_LABELS: Record<DocumentClassification, string> = {
  [DocumentClassification.EXPORT_WITH_LUT]: 'Export with LUT (0% IGST)',
  [DocumentClassification.EXPORT_WITHOUT_LUT]: 'Export without LUT (Warning)',
  [DocumentClassification.DOMESTIC_B2B]: 'Domestic B2B (GST Invoice)',
  [DocumentClassification.DOMESTIC_B2C]: 'Domestic B2C (Consumer)',
  [DocumentClassification.PURCHASE_ITC]: 'Purchase (ITC Eligible)',
  [DocumentClassification.PURCHASE_RCM]: 'Purchase (RCM Applicable)',
  [DocumentClassification.UNKNOWN]: 'Unknown - Manual Review Required',
}

const CLASSIFICATION_COLORS: Record<DocumentClassification, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  [DocumentClassification.EXPORT_WITH_LUT]: 'success',
  [DocumentClassification.EXPORT_WITHOUT_LUT]: 'warning',
  [DocumentClassification.DOMESTIC_B2B]: 'info',
  [DocumentClassification.DOMESTIC_B2C]: 'info',
  [DocumentClassification.PURCHASE_ITC]: 'success',
  [DocumentClassification.PURCHASE_RCM]: 'warning',
  [DocumentClassification.UNKNOWN]: 'default',
}

function getFileIcon(mimeType: string) {
  if (mimeType === 'text/csv') return <CsvIcon />
  if (mimeType.startsWith('image/')) return <ImageIcon />
  return <DocumentIcon />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '-'
  const curr = currency || 'INR'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function DocumentReviewCard({ documentId, onActionComplete }: DocumentReviewCardProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [newClassification, setNewClassification] = useState<DocumentClassification | ''>('')

  const { data: document, isLoading, refetch } = api.inbox.getById.useQuery({ id: documentId })

  const approveMutation = api.inbox.approve.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Document approved', { variant: 'success' })
      refetch()
      onActionComplete?.()
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const rejectMutation = api.inbox.reject.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Document rejected', { variant: 'success' })
      setRejectDialogOpen(false)
      setRejectReason('')
      refetch()
      onActionComplete?.()
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const reprocessMutation = api.inbox.reprocess.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Document queued for reprocessing', { variant: 'success' })
      refetch()
      onActionComplete?.()
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const updateClassificationMutation = api.inbox.updateClassification.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Classification updated', { variant: 'success' })
      setEditDialogOpen(false)
      setNewClassification('')
      refetch()
      onActionComplete?.()
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">Loading document...</Typography>
        </CardContent>
      </Card>
    )
  }

  if (!document) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">Document not found</Alert>
        </CardContent>
      </Card>
    )
  }

  const isProcessed = document.status === DocumentStatus.PROCESSED
  const isFailed = document.status === DocumentStatus.FAILED
  const isPending = document.status === DocumentStatus.PENDING || document.status === DocumentStatus.PROCESSING
  const canApprove = isProcessed && document.reviewStatus !== ReviewStatus.APPROVED && document.reviewStatus !== ReviewStatus.CONVERTED
  const canReject = isProcessed && document.reviewStatus !== ReviewStatus.REJECTED
  const canReprocess = isFailed || document.status === DocumentStatus.PENDING

  // Parse extracted data
  const extractedData = document.extractedData as {
    classificationReasons?: string[]
    error?: string
  } | null

  return (
    <>
      <Card>
        <CardContent>
          {/* Header */}
          <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
            <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              {getFileIcon(document.mimeType)}
            </Box>
            <Box flex={1}>
              <Typography variant="h6" noWrap>
                {document.originalFilename}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatFileSize(document.fileSize)} &middot; {SOURCE_TYPE_LABELS[document.sourceType]}
              </Typography>
            </Box>
            <Tooltip title="Open file">
              <IconButton
                size="small"
                onClick={() => window.open(document.fileUrl, '_blank')}
              >
                <OpenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Status Alerts */}
          {isFailed && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Processing failed: {extractedData?.error || 'Unknown error'}
            </Alert>
          )}

          {isPending && (
            <Alert severity="info" sx={{ mb: 2 }} icon={<AIIcon />}>
              Document is being processed by AI...
            </Alert>
          )}

          {document.reviewStatus === ReviewStatus.REVIEW_RECOMMENDED && (
            <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
              AI recommends manual review for this document
            </Alert>
          )}

          {document.reviewStatus === ReviewStatus.MANUAL_REQUIRED && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Manual classification required - AI confidence too low
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Classification */}
          <Box mb={3}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              AI Classification
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              {document.classification ? (
                <Chip
                  label={CLASSIFICATION_LABELS[document.classification]}
                  color={CLASSIFICATION_COLORS[document.classification]}
                  size="medium"
                />
              ) : (
                <Typography color="text.secondary">Not classified</Typography>
              )}
              {document.confidenceScore != null && (
                <Chip
                  label={`${Number(document.confidenceScore)}% confidence`}
                  size="small"
                  variant="outlined"
                  color={
                    Number(document.confidenceScore) >= 90
                      ? 'success'
                      : Number(document.confidenceScore) >= 70
                      ? 'warning'
                      : 'error'
                  }
                />
              )}
              {isProcessed && (
                <Tooltip title="Edit classification">
                  <IconButton size="small" onClick={() => setEditDialogOpen(true)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {/* Classification Reasons */}
            {extractedData?.classificationReasons && extractedData.classificationReasons.length > 0 && (
              <Paper variant="outlined" sx={{ mt: 1, p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Classification reasons:
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {extractedData.classificationReasons.map((reason, index) => (
                    <Chip key={index} label={reason} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Paper>
            )}
          </Box>

          {/* Extracted Data */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Extracted Information
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Amount
              </Typography>
              <Typography variant="body1">
                {formatCurrency(
                  document.extractedAmount ? Number(document.extractedAmount) : null,
                  document.extractedCurrency
                )}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Date
              </Typography>
              <Typography variant="body1">
                {document.extractedDate
                  ? format(new Date(document.extractedDate), 'dd MMM yyyy')
                  : '-'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Vendor/Client
              </Typography>
              <Typography variant="body1" noWrap>
                {document.extractedVendorName || '-'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                GSTIN
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                {document.extractedVendorGstin || '-'}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Review Status */}
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="caption" color="text.secondary">
                Review Status
              </Typography>
              <Typography variant="body2">
                {document.reviewStatus.replace('_', ' ')}
                {document.reviewedAt && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    ({format(new Date(document.reviewedAt), 'dd MMM yyyy HH:mm')})
                  </Typography>
                )}
              </Typography>
              {document.reviewNotes && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Note: {document.reviewNotes}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Uploaded {format(new Date(document.createdAt), 'dd MMM yyyy HH:mm')}
            </Typography>
          </Box>
        </CardContent>

        <CardActions sx={{ px: 2, pb: 2 }}>
          {canApprove && (
            <Button
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              onClick={() => approveMutation.mutate({ id: documentId })}
              disabled={approveMutation.isPending}
            >
              Approve
            </Button>
          )}
          {canReject && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<RejectIcon />}
              onClick={() => setRejectDialogOpen(true)}
              disabled={rejectMutation.isPending}
            >
              Reject
            </Button>
          )}
          {canReprocess && (
            <Button
              variant="outlined"
              startIcon={<ReprocessIcon />}
              onClick={() => reprocessMutation.mutate({ id: documentId })}
              disabled={reprocessMutation.isPending}
            >
              Reprocess
            </Button>
          )}
        </CardActions>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Reason"
            fullWidth
            multiline
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => rejectMutation.mutate({ id: documentId, reason: rejectReason })}
            color="error"
            variant="contained"
            disabled={!rejectReason.trim() || rejectMutation.isPending}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Classification Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Classification</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Override AI classification with manual selection
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Classification</InputLabel>
            <Select
              value={newClassification}
              label="Classification"
              onChange={(e) => setNewClassification(e.target.value as DocumentClassification)}
            >
              {Object.values(DocumentClassification).map((classification) => (
                <MenuItem key={classification} value={classification}>
                  {CLASSIFICATION_LABELS[classification]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() =>
              updateClassificationMutation.mutate({
                id: documentId,
                classification: newClassification as DocumentClassification,
              })
            }
            color="primary"
            variant="contained"
            disabled={!newClassification || updateClassificationMutation.isPending}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
