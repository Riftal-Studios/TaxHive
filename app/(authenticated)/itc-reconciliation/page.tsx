'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Skeleton,
  Stack,
  Chip,
} from '@mui/material'
import {
  Upload as UploadIcon,
  Assessment as AssessmentIcon,
  CalendarMonth as CalendarIcon,
  CheckCircle as MatchedIcon,
  Warning as MismatchIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { format } from 'date-fns'

function formatPeriod(period: string): string {
  if (!period || period.length !== 6) return period
  const month = period.substring(0, 2)
  const year = period.substring(2, 6)
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  const monthIndex = parseInt(month, 10) - 1
  return `${monthNames[monthIndex]} ${year}`
}

export default function ITCReconciliationPage() {
  const router = useRouter()

  const { data: uploads, isLoading: uploadsLoading } = api.gstr2b.list.useQuery({
    limit: 12,
  })

  const { data: itcHistory, isLoading: historyLoading } = api.itcLedger.getHistory.useQuery({
    limit: 6,
  })

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            ITC Reconciliation
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Reconcile your purchase records with GSTR-2B data
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => router.push('/itc-reconciliation/upload')}
        >
          Upload GSTR-2B
        </Button>
      </Stack>

      {/* ITC Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Claimable ITC
                  </Typography>
                  {historyLoading ? (
                    <Skeleton variant="text" width={120} height={40} />
                  ) : (
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        maximumFractionDigits: 0,
                      }).format(
                        (itcHistory?.totals.rcmIgst ?? 0) +
                        (itcHistory?.totals.rcmCgst ?? 0) +
                        (itcHistory?.totals.rcmSgst ?? 0) +
                        (itcHistory?.totals.b2bIgst ?? 0) +
                        (itcHistory?.totals.b2bCgst ?? 0) +
                        (itcHistory?.totals.b2bSgst ?? 0)
                      )}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'success.lighter' }}>
                  <MatchedIcon color="success" />
                </Box>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                RCM + B2B (last 12 months)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    At Risk ITC
                  </Typography>
                  {historyLoading ? (
                    <Skeleton variant="text" width={120} height={40} />
                  ) : (
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        maximumFractionDigits: 0,
                      }).format(
                        (itcHistory?.totals.atRiskIgst ?? 0) +
                        (itcHistory?.totals.atRiskCgst ?? 0) +
                        (itcHistory?.totals.atRiskSgst ?? 0)
                      )}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'warning.lighter' }}>
                  <MismatchIcon color="warning" />
                </Box>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Mismatched or unverified
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Uploads This Year
                  </Typography>
                  {uploadsLoading ? (
                    <Skeleton variant="text" width={60} height={40} />
                  ) : (
                    <Typography variant="h4" fontWeight="bold">
                      {uploads?.uploads.length ?? 0}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'primary.lighter' }}>
                  <AssessmentIcon color="primary" />
                </Box>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                GSTR-2B files uploaded
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Uploads */}
      <Typography variant="h6" gutterBottom>
        Recent GSTR-2B Uploads
      </Typography>
      <Grid container spacing={2}>
        {uploadsLoading ? (
          [...Array(3)].map((_, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" />
                  <Skeleton variant="text" width="80%" />
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : uploads?.uploads.length === 0 ? (
          <Grid size={12}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary" gutterBottom>
                No GSTR-2B uploads yet
              </Typography>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => router.push('/itc-reconciliation/upload')}
                sx={{ mt: 1 }}
              >
                Upload Your First GSTR-2B
              </Button>
            </Paper>
          </Grid>
        ) : (
          uploads?.uploads.map((upload) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={upload.id}>
              <Card>
                <CardActionArea
                  onClick={() => router.push(`/itc-reconciliation/${upload.returnPeriod}`)}
                >
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6">
                        {formatPeriod(upload.returnPeriod)}
                      </Typography>
                      <Chip
                        label={upload.status}
                        size="small"
                        color={upload.status === 'COMPLETED' ? 'success' : 'warning'}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {upload.entriesCount} entries
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                      <Typography variant="caption" color="success.main">
                        {upload.matchedCount ?? 0} matched
                      </Typography>
                      <Typography variant="caption" color="warning.main">
                        {upload.mismatchedCount ?? 0} issues
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 1 }}>
                      Uploaded {format(new Date(upload.createdAt), 'dd MMM yyyy')}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))
        )}
      </Grid>
    </Box>
  )
}
