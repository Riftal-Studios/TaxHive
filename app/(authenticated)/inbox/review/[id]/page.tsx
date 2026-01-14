'use client'

import React from 'react'
import { use } from 'react'
import {
  Box,
  Typography,
  Breadcrumbs,
  Link as MuiLink,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DocumentReviewCard } from '@/components/mui/inbox'
import { api } from '@/lib/trpc/client'

interface ReviewPageProps {
  params: Promise<{ id: string }>
}

export default function DocumentReviewPage({ params }: ReviewPageProps) {
  const router = useRouter()
  const { id } = use(params)

  const { data: document, isLoading, error } = api.inbox.getById.useQuery(
    { id },
    { enabled: !!id }
  )

  const handleActionComplete = () => {
    // Stay on the page - the DocumentReviewCard handles refetching
  }

  if (error) {
    return (
      <Box>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/inbox')}
          sx={{ mb: 2 }}
        >
          Back to Inbox
        </Button>
        <Alert severity="error">
          {error.message || 'Failed to load document'}
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Breadcrumbs sx={{ mb: 1 }}>
          <MuiLink component={Link} href="/dashboard" color="inherit" underline="hover">
            Dashboard
          </MuiLink>
          <MuiLink component={Link} href="/inbox" color="inherit" underline="hover">
            Inbox
          </MuiLink>
          <Typography color="text.primary">Review Document</Typography>
        </Breadcrumbs>

        <Box display="flex" alignItems="center" gap={2}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => router.push('/inbox')}
            variant="text"
            size="small"
          >
            Back
          </Button>
          <Typography variant="h5" fontWeight="bold">
            Review Document
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Main Review Card */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <DocumentReviewCard
            documentId={id}
            onActionComplete={handleActionComplete}
          />
        </Grid>

        {/* Document Preview / Actions */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Document Preview
              </Typography>
              {isLoading ? (
                <Typography color="text.secondary">Loading...</Typography>
              ) : document?.mimeType.startsWith('image/') ? (
                <Box
                  component="img"
                  src={document.fileUrl}
                  alt={document.originalFilename}
                  sx={{
                    width: '100%',
                    maxHeight: 400,
                    objectFit: 'contain',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                />
              ) : document?.mimeType === 'application/pdf' ? (
                <Box
                  component="iframe"
                  src={document.fileUrl}
                  sx={{
                    width: '100%',
                    height: 400,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                />
              ) : (
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Preview not available for this file type.
                  </Typography>
                  {document && (
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{ mt: 1 }}
                      onClick={() => window.open(document.fileUrl, '_blank')}
                    >
                      Open File
                    </Button>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Convert this document to an invoice after approval.
              </Typography>
              <Button
                variant="outlined"
                fullWidth
                disabled={
                  !document ||
                  document.reviewStatus !== 'APPROVED' ||
                  !!document.linkedInvoiceId
                }
              >
                {document?.linkedInvoiceId
                  ? 'Already Converted'
                  : document?.reviewStatus !== 'APPROVED'
                  ? 'Approve First to Convert'
                  : 'Convert to Invoice'}
              </Button>
              {document?.linkedInvoiceId && (
                <Button
                  component={Link}
                  href={`/invoices/${document.linkedInvoiceId}`}
                  variant="text"
                  fullWidth
                  sx={{ mt: 1 }}
                >
                  View Linked Invoice
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
