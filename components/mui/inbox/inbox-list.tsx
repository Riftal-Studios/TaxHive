'use client'

import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  CircularProgress,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Skeleton,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Description as DocumentIcon,
  Image as ImageIcon,
  TableChart as CsvIcon,
  CheckCircle as ApprovedIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  AutoAwesome as AIIcon,
} from '@mui/icons-material'
import { DocumentSourceType, DocumentStatus, DocumentClassification, ReviewStatus } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'
import { api } from '@/lib/trpc/client'

interface InboxListProps {
  onDocumentSelect?: (documentId: string) => void
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
  [DocumentClassification.EXPORT_WITH_LUT]: 'Export (LUT)',
  [DocumentClassification.EXPORT_WITHOUT_LUT]: 'Export (No LUT)',
  [DocumentClassification.DOMESTIC_B2B]: 'Domestic B2B',
  [DocumentClassification.DOMESTIC_B2C]: 'Domestic B2C',
  [DocumentClassification.PURCHASE_ITC]: 'Purchase (ITC)',
  [DocumentClassification.PURCHASE_RCM]: 'Purchase (RCM)',
  [DocumentClassification.UNKNOWN]: 'Unknown',
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

const STATUS_ICONS: Record<DocumentStatus, React.ReactNode> = {
  [DocumentStatus.PENDING]: <PendingIcon color="disabled" />,
  [DocumentStatus.PROCESSING]: <CircularProgress size={18} />,
  [DocumentStatus.PROCESSED]: <CheckCircle color="success" />,
  [DocumentStatus.FAILED]: <ErrorIcon color="error" />,
}

function CheckCircle(props: { color: 'success' }) {
  return <ApprovedIcon color={props.color} />
}

const REVIEW_STATUS_CHIPS: Record<ReviewStatus, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  [ReviewStatus.PENDING_REVIEW]: { label: 'Pending', color: 'default' },
  [ReviewStatus.AUTO_APPROVED]: { label: 'Auto-approved', color: 'success' },
  [ReviewStatus.REVIEW_RECOMMENDED]: { label: 'Review Recommended', color: 'warning' },
  [ReviewStatus.MANUAL_REQUIRED]: { label: 'Manual Required', color: 'error' },
  [ReviewStatus.APPROVED]: { label: 'Approved', color: 'success' },
  [ReviewStatus.REJECTED]: { label: 'Rejected', color: 'error' },
  [ReviewStatus.CONVERTED]: { label: 'Converted', color: 'info' },
}

function getFileIcon(mimeType: string) {
  if (mimeType === 'text/csv') return <CsvIcon fontSize="small" />
  if (mimeType.startsWith('image/')) return <ImageIcon fontSize="small" />
  return <DocumentIcon fontSize="small" />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function InboxList({ onDocumentSelect }: InboxListProps) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<DocumentStatus | ''>('')
  const [sourceFilter, setSourceFilter] = React.useState<DocumentSourceType | ''>('')
  const [reviewFilter, setReviewFilter] = React.useState<ReviewStatus | ''>('')

  const { data, isLoading, refetch, isFetching } = api.inbox.list.useQuery({
    query: searchQuery || undefined,
    status: statusFilter || undefined,
    sourceType: sourceFilter || undefined,
    reviewStatus: reviewFilter || undefined,
    limit: 50,
  })

  const documents = data?.documents ?? []

  return (
    <Box>
      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              size="small"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 200 }}
            />

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | '')}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(DocumentStatus).map((status) => (
                  <MenuItem key={status} value={status}>
                    {status.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Source</InputLabel>
              <Select
                value={sourceFilter}
                label="Source"
                onChange={(e) => setSourceFilter(e.target.value as DocumentSourceType | '')}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(DocumentSourceType).map((source) => (
                  <MenuItem key={source} value={source}>
                    {SOURCE_TYPE_LABELS[source]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Review Status</InputLabel>
              <Select
                value={reviewFilter}
                label="Review Status"
                onChange={(e) => setReviewFilter(e.target.value as ReviewStatus | '')}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(ReviewStatus).map((status) => (
                  <MenuItem key={status} value={status}>
                    {REVIEW_STATUS_CHIPS[status].label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ flexGrow: 1 }} />

            <Tooltip title="Refresh">
              <IconButton onClick={() => refetch()} disabled={isFetching}>
                <RefreshIcon className={isFetching ? 'animate-spin' : ''} />
              </IconButton>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      {/* Document Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Document</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Classification</TableCell>
              <TableCell align="center">Confidence</TableCell>
              <TableCell>Review Status</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Skeleton variant="circular" width={24} height={24} />
                      <Skeleton variant="text" width={150} />
                    </Stack>
                  </TableCell>
                  <TableCell><Skeleton variant="text" width={80} /></TableCell>
                  <TableCell><Skeleton variant="rounded" width={100} height={24} /></TableCell>
                  <TableCell><Skeleton variant="text" width={40} /></TableCell>
                  <TableCell><Skeleton variant="rounded" width={100} height={24} /></TableCell>
                  <TableCell><Skeleton variant="text" width={80} /></TableCell>
                  <TableCell><Skeleton variant="circular" width={32} height={32} /></TableCell>
                </TableRow>
              ))
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No documents found. Upload your first document to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow
                  key={doc.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onDocumentSelect?.(doc.id)}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {STATUS_ICONS[doc.status]}
                      {getFileIcon(doc.mimeType)}
                      <Box>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {doc.originalFilename}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(doc.fileSize)}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={SOURCE_TYPE_LABELS[doc.sourceType]}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {doc.classification ? (
                      <Chip
                        label={CLASSIFICATION_LABELS[doc.classification]}
                        size="small"
                        color={CLASSIFICATION_COLORS[doc.classification]}
                      />
                    ) : doc.status === DocumentStatus.PROCESSING ? (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <AIIcon fontSize="small" color="primary" />
                        <Typography variant="caption" color="primary">
                          Analyzing...
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {doc.confidenceScore != null ? (
                      <Tooltip title={`AI confidence: ${Number(doc.confidenceScore)}%`}>
                        <Chip
                          label={`${Number(doc.confidenceScore)}%`}
                          size="small"
                          color={
                            Number(doc.confidenceScore) >= 90
                              ? 'success'
                              : Number(doc.confidenceScore) >= 70
                              ? 'warning'
                              : 'error'
                          }
                          variant="outlined"
                        />
                      </Tooltip>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={REVIEW_STATUS_CHIPS[doc.reviewStatus].label}
                      size="small"
                      color={REVIEW_STATUS_CHIPS[doc.reviewStatus].color}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDocumentSelect?.(doc.id)
                        }}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination hint */}
      {data?.nextCursor && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Showing first {documents.length} documents. Scroll down for more.
          </Typography>
        </Box>
      )}
    </Box>
  )
}
