'use client'

import React, { useState, useEffect } from 'react'
import {
  TextField,
  InputAdornment,
  CircularProgress,
  IconButton,
  Tooltip,
  Box,
  Typography,
} from '@mui/material'
import {
  CheckCircleOutline,
  ErrorOutline,
  InfoOutlined,
} from '@mui/icons-material'
import { validateGSTIN, getStateCodeFromGSTIN, INDIAN_STATES } from '@/lib/gst'
import { api } from '@/lib/trpc/client'

interface GSTINInputProps {
  value: string
  onChange: (value: string) => void
  onValidation?: (isValid: boolean, stateCode?: string) => void
  disabled?: boolean
  label?: string
  required?: boolean
  fullWidth?: boolean
  size?: 'small' | 'medium'
  helperText?: string
  showStateInfo?: boolean
  validateOnServer?: boolean
}

export function GSTINInput({
  value,
  onChange,
  onValidation,
  disabled = false,
  label = 'GSTIN',
  required = false,
  fullWidth = true,
  size = 'medium',
  helperText,
  showStateInfo = true,
  validateOnServer = false,
}: GSTINInputProps) {
  const [error, setError] = useState<string>('')
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [stateInfo, setStateInfo] = useState<string>('')

  // Server-side validation (optional)
  const validateGSTINMutation = api.invoices.validateGSTIN.useQuery(
    { gstin: value },
    {
      enabled: false, // Manual trigger
    }
  )

  useEffect(() => {
    if (!value || value.length < 15) {
      setError('')
      setIsValid(null)
      setStateInfo('')
      return
    }

    // Client-side validation
    const validation = validateGSTIN(value)
    
    if (validation.valid) {
      setIsValid(true)
      setError('')
      
      // Extract state information
      const stateCode = getStateCodeFromGSTIN(value)
      if (stateCode && showStateInfo) {
        const stateName = INDIAN_STATES[stateCode]
        setStateInfo(`State: ${stateName} (${stateCode})`)
      }
      
      // Trigger server validation if enabled
      if (validateOnServer) {
        setIsValidating(true)
        validateGSTINMutation.refetch().then((result) => {
          setIsValidating(false)
          if (result.data && !result.data.valid) {
            setError(result.data.error || 'Invalid GSTIN')
            setIsValid(false)
          }
        })
      }
      
      onValidation?.(true, stateCode || undefined)
    } else {
      setIsValid(false)
      setError(validation.error || 'Invalid GSTIN')
      setStateInfo('')
      onValidation?.(false)
    }
  }, [value, showStateInfo, validateOnServer, onValidation, validateGSTINMutation])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (newValue.length <= 15) {
      onChange(newValue)
    }
  }

  const getEndAdornment = () => {
    if (isValidating) {
      return (
        <InputAdornment position="end">
          <CircularProgress size={20} />
        </InputAdornment>
      )
    }

    if (value.length === 15) {
      if (isValid) {
        return (
          <InputAdornment position="end">
            <CheckCircleOutline color="success" />
          </InputAdornment>
        )
      } else {
        return (
          <InputAdornment position="end">
            <ErrorOutline color="error" />
          </InputAdornment>
        )
      }
    }

    if (value.length > 0) {
      return (
        <InputAdornment position="end">
          <Typography variant="caption" color="text.secondary">
            {15 - value.length} chars
          </Typography>
        </InputAdornment>
      )
    }

    return (
      <InputAdornment position="end">
        <Tooltip title="15-character GST Identification Number. Format: 2 digit state code + 10 char PAN + 1 digit entity + Z + 1 check digit">
          <IconButton size="small" edge="end">
            <InfoOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      </InputAdornment>
    )
  }

  const getHelperText = () => {
    if (error) return error
    if (stateInfo) return stateInfo
    if (helperText) return helperText
    return 'Enter 15-character GSTIN'
  }

  return (
    <Box>
      <TextField
        fullWidth={fullWidth}
        size={size}
        disabled={disabled}
        required={required}
        label={label}
        value={value}
        onChange={handleChange}
        error={!!error}
        helperText={getHelperText()}
        InputProps={{
          endAdornment: getEndAdornment(),
        }}
        inputProps={{
          maxLength: 15,
          style: { textTransform: 'uppercase' },
          placeholder: '22AAAAA0000A1Z5',
        }}
      />
    </Box>
  )
}

// Utility component to display GSTIN with validation status
interface GSTINDisplayProps {
  gstin: string
  showState?: boolean
}

export function GSTINDisplay({ gstin, showState = true }: GSTINDisplayProps) {
  const validation = validateGSTIN(gstin)
  const stateCode = getStateCodeFromGSTIN(gstin)
  const stateName = stateCode ? INDIAN_STATES[stateCode] : ''

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
        {gstin}
      </Typography>
      {validation.valid ? (
        <CheckCircleOutline color="success" fontSize="small" />
      ) : (
        <ErrorOutline color="error" fontSize="small" />
      )}
      {showState && stateName && (
        <Typography variant="caption" color="text.secondary">
          ({stateName})
        </Typography>
      )}
    </Box>
  )
}