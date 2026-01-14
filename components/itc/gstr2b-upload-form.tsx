'use client'

import React, { useState, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
  LinearProgress,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Description as FileIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'

interface GSTR2BUploadFormProps {
  onUploadSuccess?: (uploadId: string, entriesCount: number) => void
}

export function GSTR2BUploadForm({ onUploadSuccess }: GSTR2BUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const uploadMutation = api.gstr2b.upload.useMutation({
    onSuccess: (data) => {
      setFile(null)
      onUploadSuccess?.(data.id, data.entriesCount)
    },
    onError: (err) => {
      setError(err.message || 'Failed to upload GSTR-2B file')
    },
  })

  const handleFileSelect = useCallback((selectedFile: File) => {
    setError(null)

    // Validate file type
    if (!selectedFile.name.endsWith('.json')) {
      setError('Please upload a JSON file downloaded from GST Portal')
      return
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setFile(selectedFile)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        handleFileSelect(droppedFile)
      }
    },
    [handleFileSelect]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        handleFileSelect(selectedFile)
      }
    },
    [handleFileSelect]
  )

  const handleUpload = async () => {
    if (!file) return

    setError(null)

    try {
      const text = await file.text()
      const jsonData = JSON.parse(text)

      uploadMutation.mutate({
        jsonData,
        fileName: file.name,
      })
    } catch {
      setError('Invalid JSON file. Please upload a valid GSTR-2B JSON from GST Portal.')
    }
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Upload GSTR-2B
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload the GSTR-2B JSON file downloaded from the GST Portal to reconcile with your purchase records.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {uploadMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<SuccessIcon />}>
          Successfully uploaded! Found {uploadMutation.data.entriesCount} entries.
          {uploadMutation.data.isUpdate && ' (Updated existing upload)'}
        </Alert>
      )}

      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          border: '2px dashed',
          borderColor: isDragOver ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          bgcolor: isDragOver ? 'action.hover' : 'background.default',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
        component="label"
      >
        <input
          type="file"
          accept=".json"
          hidden
          onChange={handleInputChange}
          disabled={uploadMutation.isPending}
        />

        {file ? (
          <Stack spacing={1} alignItems="center">
            <FileIcon sx={{ fontSize: 48, color: 'primary.main' }} />
            <Typography variant="subtitle1">{file.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {(file.size / 1024).toFixed(1)} KB
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1} alignItems="center">
            <UploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
            <Typography variant="subtitle1">
              Drag and drop your GSTR-2B JSON file here
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or click to browse
            </Typography>
          </Stack>
        )}
      </Box>

      {uploadMutation.isPending && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Processing file...
          </Typography>
        </Box>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!file || uploadMutation.isPending}
          startIcon={uploadMutation.isPending ? <CircularProgress size={20} /> : <UploadIcon />}
        >
          {uploadMutation.isPending ? 'Uploading...' : 'Upload & Process'}
        </Button>
        {file && (
          <Button
            variant="outlined"
            onClick={() => setFile(null)}
            disabled={uploadMutation.isPending}
          >
            Clear
          </Button>
        )}
      </Stack>
    </Paper>
  )
}
