'use client'

import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Breadcrumbs,
  Link as MuiLink,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DocumentUploadZone, InboxList, InboxStats } from '@/components/mui/inbox'

export default function InboxPage() {
  const router = useRouter()
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  const handleDocumentSelect = (documentId: string) => {
    router.push(`/inbox/review/${documentId}`)
  }

  const handleUploadComplete = () => {
    setUploadDialogOpen(false)
    // The list will auto-refresh via tRPC query invalidation
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Breadcrumbs sx={{ mb: 1 }}>
            <MuiLink component={Link} href="/dashboard" color="inherit" underline="hover">
              Dashboard
            </MuiLink>
            <Typography color="text.primary">Inbox</Typography>
          </Breadcrumbs>
          <Typography variant="h4" fontWeight="bold">
            Smart Invoice Inbox
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload documents for AI-powered classification and processing
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setUploadDialogOpen(true)}
        >
          Upload Document
        </Button>
      </Box>

      {/* Stats */}
      <Box mb={3}>
        <InboxStats />
      </Box>

      {/* Document List */}
      <InboxList onDocumentSelect={handleDocumentSelect} />

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Upload Document
          <IconButton
            aria-label="close"
            onClick={() => setUploadDialogOpen(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <DocumentUploadZone onUploadComplete={handleUploadComplete} />
        </DialogContent>
      </Dialog>
    </Box>
  )
}
