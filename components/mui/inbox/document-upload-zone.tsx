'use client'

import React, { useState, useRef, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Alert,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Description as DocumentIcon,
  Image as ImageIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material'
import { enqueueSnackbar } from 'notistack'
import { DocumentSourceType } from '@prisma/client'

interface UploadedDocument {
  id: string
  filename: string
  originalFilename: string
  mimeType: string
  fileSize: number
  sourceType: DocumentSourceType
  status: string
}

interface DocumentUploadZoneProps {
  onUploadComplete?: (document: UploadedDocument) => void
  onUploadError?: (error: string) => void
  disabled?: boolean
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

const SOURCE_TYPE_HINTS: Record<DocumentSourceType, string> = {
  [DocumentSourceType.UPWORK]: 'Upload Upwork CSV transaction history or receipt',
  [DocumentSourceType.TOPTAL]: 'Upload Toptal payment receipt PDF',
  [DocumentSourceType.CLIENT_INVOICE]: 'Upload invoice sent to client',
  [DocumentSourceType.VENDOR_BILL]: 'Upload bill/invoice from vendor',
  [DocumentSourceType.BANK_STATEMENT]: 'Upload bank statement for reconciliation',
  [DocumentSourceType.SCREENSHOT]: 'Upload screenshot of payment/transaction',
  [DocumentSourceType.OTHER]: 'Other document type',
}

const ALLOWED_EXTENSIONS = '.pdf,.csv,.png,.jpg,.jpeg,.webp,.txt'
const MAX_FILE_SIZE_MB = 10

export function DocumentUploadZone({
  onUploadComplete,
  onUploadError,
  disabled = false,
}: DocumentUploadZoneProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [sourceType, setSourceType] = useState<DocumentSourceType>(DocumentSourceType.OTHER)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'text/csv') return <CsvIcon />
    if (mimeType.startsWith('image/')) return <ImageIcon />
    return <DocumentIcon />
  }

  const uploadFile = useCallback(
    async (file: File) => {
      // Validate file size
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        const errorMsg = `File size must be less than ${MAX_FILE_SIZE_MB}MB`
        enqueueSnackbar(errorMsg, { variant: 'error' })
        onUploadError?.(errorMsg)
        return
      }

      // Validate file type
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`
      const acceptedExtensions = ALLOWED_EXTENSIONS.split(',').map((ext) => ext.trim().toLowerCase())
      if (!acceptedExtensions.includes(fileExtension)) {
        const errorMsg = `Invalid file type. Accepted types: ${ALLOWED_EXTENSIONS}`
        enqueueSnackbar(errorMsg, { variant: 'error' })
        onUploadError?.(errorMsg)
        return
      }

      setIsUploading(true)
      setUploadProgress(0)
      setFileName(file.name)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('sourceType', sourceType)

        // Upload with progress tracking
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100
            setUploadProgress(percentComplete)
          }
        })

        const result = await new Promise<UploadedDocument>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status === 200) {
              try {
                const data = JSON.parse(xhr.responseText)
                if (data.success && data.document) {
                  resolve(data.document)
                } else {
                  reject(new Error(data.error || 'Upload failed'))
                }
              } catch {
                reject(new Error('Invalid response'))
              }
            } else {
              try {
                const errorData = JSON.parse(xhr.responseText)
                reject(new Error(errorData.error || 'Upload failed'))
              } catch {
                reject(new Error('Upload failed'))
              }
            }
          }

          xhr.onerror = () => reject(new Error('Network error'))

          xhr.open('POST', '/api/inbox/upload')
          xhr.send(formData)
        })

        enqueueSnackbar('Document uploaded and queued for processing', { variant: 'success' })
        onUploadComplete?.(result)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to upload document'
        console.error('Upload error:', error)
        enqueueSnackbar(errorMsg, { variant: 'error' })
        onUploadError?.(errorMsg)
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
        setFileName('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [sourceType, onUploadComplete, onUploadError]
  )

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      await uploadFile(file)
    },
    [uploadFile]
  )

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled || isUploading) return

      dragCounter.current++
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true)
      }
    },
    [disabled, isUploading]
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled || isUploading) return

      dragCounter.current--
      if (dragCounter.current === 0) {
        setIsDragging(false)
      }
    },
    [disabled, isUploading]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      dragCounter.current = 0

      if (disabled || isUploading) return

      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        const file = files[0]
        await uploadFile(file)
      }
    },
    [disabled, isUploading, uploadFile]
  )

  return (
    <Box>
      {/* Source Type Selection */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="source-type-label">Document Source</InputLabel>
        <Select
          labelId="source-type-label"
          value={sourceType}
          label="Document Source"
          onChange={(e) => setSourceType(e.target.value as DocumentSourceType)}
          disabled={disabled || isUploading}
        >
          {Object.values(DocumentSourceType).map((type) => (
            <MenuItem key={type} value={type}>
              {SOURCE_TYPE_LABELS[type]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {sourceType && sourceType !== DocumentSourceType.OTHER && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {SOURCE_TYPE_HINTS[sourceType]}
        </Alert>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || isUploading}
      />

      {!isUploading && (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: 'center',
            cursor: disabled ? 'default' : 'pointer',
            borderStyle: 'dashed',
            borderWidth: 2,
            bgcolor: isDragging ? 'action.hover' : 'background.default',
            borderColor: isDragging ? 'primary.main' : 'divider',
            transition: 'all 0.2s ease',
            '&:hover': disabled
              ? {}
              : {
                  bgcolor: 'action.hover',
                  borderColor: 'primary.main',
                },
          }}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <UploadIcon
            sx={{
              fontSize: 56,
              color: isDragging ? 'primary.main' : 'text.secondary',
              mb: 2,
              transition: 'color 0.2s ease',
            }}
          />
          <Typography variant="h6" gutterBottom>
            {isDragging ? 'Drop your document here' : 'Upload Document'}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {isDragging ? 'Release to upload' : 'Click to browse or drag and drop'}
          </Typography>

          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
            <Chip label="PDF" size="small" variant="outlined" />
            <Chip label="CSV" size="small" variant="outlined" />
            <Chip label="PNG/JPEG" size="small" variant="outlined" />
          </Stack>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            Maximum file size: {MAX_FILE_SIZE_MB}MB
          </Typography>
        </Paper>
      )}

      {isUploading && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            {getFileIcon(fileName.endsWith('.csv') ? 'text/csv' : 'application/pdf')}
            <Box flex={1}>
              <Typography variant="body2" noWrap>
                {fileName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Uploading to {SOURCE_TYPE_LABELS[sourceType]}...
              </Typography>
            </Box>
          </Box>
          <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {Math.round(uploadProgress)}% complete
          </Typography>
        </Paper>
      )}
    </Box>
  )
}
