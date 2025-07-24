'use client'

import React, { useState, useRef } from 'react'
import {
  Box,
  Typography,
  Paper,
  IconButton,
  LinearProgress,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
} from '@mui/icons-material'
import { enqueueSnackbar } from 'notistack'

interface FileUploadProps {
  label?: string
  accept?: string
  maxSize?: number // in MB
  value?: string // URL of uploaded file
  onChange: (url: string | null) => void
  disabled?: boolean
  helperText?: string
}

export function FileUpload({
  label = 'Upload File',
  accept = '.pdf,.png,.jpg,.jpeg',
  maxSize = 5, // 5MB default
  value,
  onChange,
  disabled = false,
  helperText,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileName, setFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getFileNameFromUrl = (url: string): string => {
    try {
      const urlParts = url.split('/')
      const fullName = urlParts[urlParts.length - 1]
      const nameParts = fullName.split('_')
      // Remove timestamp prefix if present
      return nameParts.length > 1 ? nameParts.slice(1).join('_') : fullName
    } catch {
      return 'Uploaded file'
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > maxSize) {
      enqueueSnackbar(`File size must be less than ${maxSize}MB`, { variant: 'error' })
      return
    }

    // Validate file type
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`
    const acceptedExtensions = accept.split(',').map(ext => ext.trim().toLowerCase())
    if (!acceptedExtensions.includes(fileExtension)) {
      enqueueSnackbar(`Invalid file type. Accepted types: ${accept}`, { variant: 'error' })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setFileName(file.name)

    try {
      // Create FormData
      const formData = new FormData()
      formData.append('file', file)

      // Upload file
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      onChange(data.url)
      enqueueSnackbar('File uploaded successfully', { variant: 'success' })
    } catch (error) {
      console.error('Upload error:', error)
      enqueueSnackbar('Failed to upload file', { variant: 'error' })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    onChange(null)
    setFileName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownload = () => {
    if (value) {
      window.open(value, '_blank')
    }
  }

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || isUploading}
      />

      {!value && !isUploading && (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            textAlign: 'center',
            cursor: disabled ? 'default' : 'pointer',
            borderStyle: 'dashed',
            borderWidth: 2,
            bgcolor: 'background.default',
            '&:hover': disabled ? {} : {
              bgcolor: 'action.hover',
              borderColor: 'primary.main',
            },
          }}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1" gutterBottom>
            {label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click to browse or drag and drop
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {helperText || `Accepted formats: ${accept} (Max ${maxSize}MB)`}
          </Typography>
        </Paper>
      )}

      {isUploading && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="body2" gutterBottom>
            Uploading {fileName}...
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 1 }} />
        </Paper>
      )}

      {value && !isUploading && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <FileIcon color="action" />
            <Box flex={1}>
              <Typography variant="body2" noWrap>
                {fileName || getFileNameFromUrl(value)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Uploaded successfully
              </Typography>
            </Box>
            <IconButton 
              size="small" 
              onClick={handleDownload}
              title="Download file"
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={handleRemove}
              disabled={disabled}
              color="error"
              title="Remove file"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      )}
    </Box>
  )
}