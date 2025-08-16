'use client'

import React from 'react'
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Chip,
  Box,
  Typography,
} from '@mui/material'
import { VALID_GST_RATES } from '@/lib/gst'

interface GSTRateSelectorProps {
  value: number
  onChange: (rate: number) => void
  disabled?: boolean
  label?: string
  required?: boolean
  fullWidth?: boolean
  size?: 'small' | 'medium'
}

// Map GST rates to display details using the imported rates
const gstRateDetails = VALID_GST_RATES.map(rate => {
  switch (rate) {
    case 0:
      return { rate, label: '0% (Exempt/Export)', color: 'success' as const }
    case 5:
      return { rate, label: '5%', color: 'info' as const }
    case 12:
      return { rate, label: '12%', color: 'warning' as const }
    case 18:
      return { rate, label: '18%', color: 'primary' as const }
    case 28:
      return { rate, label: '28%', color: 'error' as const }
    default:
      return { rate, label: `${rate}%`, color: 'default' as const }
  }
})

export function GSTRateSelector({
  value,
  onChange,
  disabled = false,
  label = 'GST Rate',
  required = false,
  fullWidth = true,
  size = 'medium',
}: GSTRateSelectorProps) {
  const handleChange = (event: SelectChangeEvent<number>) => {
    onChange(Number(event.target.value))
  }

  return (
    <FormControl 
      fullWidth={fullWidth} 
      size={size}
      disabled={disabled}
      required={required}
    >
      <InputLabel id="gst-rate-label">{label}</InputLabel>
      <Select
        labelId="gst-rate-label"
        value={value}
        label={label}
        onChange={handleChange}
      >
        {gstRateDetails.map((detail) => (
          <MenuItem key={detail.rate} value={detail.rate}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Typography sx={{ flexGrow: 1 }}>
                {detail.label}
              </Typography>
              <Chip
                label={`${detail.rate}%`}
                size="small"
                color={detail.color as 'success' | 'info' | 'warning' | 'primary' | 'error'}
                variant="outlined"
              />
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

interface GSTRateDisplayProps {
  rate: number
  size?: 'small' | 'medium'
}

export function GSTRateDisplay({ rate, size = 'small' }: GSTRateDisplayProps) {
  const detail = gstRateDetails.find(d => d.rate === rate) || gstRateDetails[0]
  
  return (
    <Chip
      label={detail.label}
      size={size}
      color={detail.color as 'success' | 'info' | 'warning' | 'primary' | 'error'}
      variant="filled"
    />
  )
}