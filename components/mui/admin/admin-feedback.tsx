'use client'

import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Skeleton,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link as MuiLink,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material'
import {
  Visibility as VisibilityIcon,
  BugReport as BugIcon,
  Lightbulb as FeatureIcon,
  Help as QuestionIcon,
  MoreHoriz as OtherIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import Link from 'next/link'
import { format } from 'date-fns'
import { enqueueSnackbar } from 'notistack'

type FeedbackStatus = 'NEW' | 'REVIEWED' | 'RESOLVED'
type FeedbackType = 'BUG' | 'FEATURE' | 'QUESTION' | 'OTHER'

const typeIcons: Record<FeedbackType, React.ReactNode> = {
  BUG: <BugIcon color="error" />,
  FEATURE: <FeatureIcon color="info" />,
  QUESTION: <QuestionIcon color="warning" />,
  OTHER: <OtherIcon />,
}

const statusColors: Record<FeedbackStatus, 'default' | 'warning' | 'success'> = {
  NEW: 'default',
  REVIEWED: 'warning',
  RESOLVED: 'success',
}

interface FeedbackItem {
  id: string
  type: FeedbackType
  message: string
  pageUrl: string
  status: FeedbackStatus
  createdAt: Date
  user: {
    id: string
    email: string
    name: string | null
  }
}

export function AdminFeedback() {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<FeedbackType | ''>('')
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null)

  const utils = api.useUtils()

  const { data, isLoading } = api.admin.getAllFeedback.useQuery({
    page: page + 1,
    limit: rowsPerPage,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  })

  const updateStatusMutation = api.admin.updateFeedbackStatus.useMutation({
    onSuccess: () => {
      utils.admin.getAllFeedback.invalidate()
      enqueueSnackbar('Feedback status updated', { variant: 'success' })
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleStatusChange = (id: string, status: FeedbackStatus) => {
    updateStatusMutation.mutate({ id, status })
  }

  if (isLoading) {
    return (
      <Box>
        <Box mb={4}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="text" width={300} height={24} />
        </Box>
        <Card>
          <CardContent>
            <Skeleton variant="rectangular" height={400} />
          </CardContent>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink component={Link} href="/admin" underline="hover" color="inherit">
          Admin
        </MuiLink>
        <Typography color="text.primary">Feedback</Typography>
      </Breadcrumbs>

      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
            Feedback
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {data?.pagination.total ?? 0} feedback items
          </Typography>
        </Box>
      </Box>

      <Card>
        <CardContent>
          <Box display="flex" gap={2} mb={3}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value as FeedbackStatus | '')
                  setPage(0)
                }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="NEW">New</MenuItem>
                <MenuItem value="REVIEWED">Reviewed</MenuItem>
                <MenuItem value="RESOLVED">Resolved</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => {
                  setTypeFilter(e.target.value as FeedbackType | '')
                  setPage(0)
                }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="BUG">Bug</MenuItem>
                <MenuItem value="FEATURE">Feature</MenuItem>
                <MenuItem value="QUESTION">Question</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={50}>Type</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.feedback.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Tooltip title={item.type}>
                        <Box component="span" sx={{ display: 'flex' }}>
                          {typeIcons[item.type as FeedbackType]}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {item.user.name || 'No name'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.user.email}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.message}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" variant="standard">
                        <Select
                          value={item.status}
                          onChange={(e) =>
                            handleStatusChange(item.id, e.target.value as FeedbackStatus)
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          <MenuItem value="NEW">
                            <Chip label="New" size="small" color="default" />
                          </MenuItem>
                          <MenuItem value="REVIEWED">
                            <Chip label="Reviewed" size="small" color="warning" />
                          </MenuItem>
                          <MenuItem value="RESOLVED">
                            <Chip label="Resolved" size="small" color="success" />
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(item.createdAt), 'MMM d, yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => setSelectedFeedback(item as FeedbackItem)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.feedback.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No feedback found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={data?.pagination.total ?? 0}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </CardContent>
      </Card>

      {/* Feedback Detail Dialog */}
      <Dialog
        open={!!selectedFeedback}
        onClose={() => setSelectedFeedback(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {selectedFeedback && typeIcons[selectedFeedback.type]}
            <Typography variant="h6">Feedback Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedFeedback && (
            <Box>
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary">
                  From
                </Typography>
                <Typography variant="body1">
                  {selectedFeedback.user.name || 'No name'} ({selectedFeedback.user.email})
                </Typography>
              </Box>
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary">
                  Type
                </Typography>
                <Box>
                  <Chip label={selectedFeedback.type} size="small" />
                </Box>
              </Box>
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box>
                  <Chip
                    label={selectedFeedback.status}
                    size="small"
                    color={statusColors[selectedFeedback.status]}
                  />
                </Box>
              </Box>
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary">
                  Page URL
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {selectedFeedback.pageUrl}
                </Typography>
              </Box>
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary">
                  Message
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedFeedback.message}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Submitted
                </Typography>
                <Typography variant="body2">
                  {format(new Date(selectedFeedback.createdAt), 'PPpp')}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedFeedback(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
