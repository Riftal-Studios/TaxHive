'use client'

import React from 'react'
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  TextField,
  Autocomplete,
  Typography,
} from '@mui/material'
import { INDIAN_STATES, StateCode } from '@/lib/gst'

interface PlaceOfSupplySelectorProps {
  value: string
  onChange: (stateCode: string) => void
  disabled?: boolean
  label?: string
  required?: boolean
  fullWidth?: boolean
  size?: 'small' | 'medium'
  variant?: 'select' | 'autocomplete'
  helperText?: string
  error?: boolean
}

// Convert states object to array for easier rendering
const stateOptions = Object.entries(INDIAN_STATES).map(([code, name]) => ({
  code: code as StateCode,
  name,
  label: `${name} (${code})`,
}))

export function PlaceOfSupplySelector({
  value,
  onChange,
  disabled = false,
  label = 'Place of Supply',
  required = false,
  fullWidth = true,
  size = 'medium',
  variant = 'autocomplete',
  helperText,
  error = false,
}: PlaceOfSupplySelectorProps) {
  
  if (variant === 'autocomplete') {
    const selectedOption = stateOptions.find(opt => opt.code === value) || null
    
    return (
      <Autocomplete
        fullWidth={fullWidth}
        size={size}
        disabled={disabled}
        options={stateOptions}
        getOptionLabel={(option) => option.label}
        value={selectedOption}
        onChange={(_, newValue) => {
          if (newValue) {
            onChange(newValue.code)
          } else {
            onChange('')
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            required={required}
            error={error}
            helperText={helperText}
          />
        )}
        isOptionEqualToValue={(option, value) => option.code === value?.code}
      />
    )
  }

  // Select variant
  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value)
  }

  return (
    <FormControl 
      fullWidth={fullWidth} 
      size={size}
      disabled={disabled}
      required={required}
      error={error}
    >
      <InputLabel id="place-of-supply-label">{label}</InputLabel>
      <Select
        labelId="place-of-supply-label"
        value={value}
        label={label}
        onChange={handleChange}
      >
        <MenuItem value="">
          <em>Select State</em>
        </MenuItem>
        {stateOptions.map((state) => (
          <MenuItem key={state.code} value={state.code}>
            {state.label}
          </MenuItem>
        ))}
      </Select>
      {helperText && (
        <Typography
          variant="caption"
          color={error ? 'error' : 'text.secondary'}
          sx={{ mt: 0.5, ml: 1.5 }}
        >
          {helperText}
        </Typography>
      )}
    </FormControl>
  )
}

// Utility component to display state name from code
interface StateDisplayProps {
  stateCode: StateCode | string
  showCode?: boolean
}

export function StateDisplay({ stateCode, showCode = true }: StateDisplayProps) {
  const stateName = INDIAN_STATES[stateCode as StateCode] || 'Unknown'
  
  if (showCode) {
    return <>{stateName} ({stateCode})</>
  }
  
  return <>{stateName}</>
}