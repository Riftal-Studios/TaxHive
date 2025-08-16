'use client'

import React from 'react'
import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
} from '@mui/material'
import { 
  PublicOutlined, 
  BusinessOutlined, 
  PersonOutlined 
} from '@mui/icons-material'

export type InvoiceType = 'EXPORT' | 'DOMESTIC_B2B' | 'DOMESTIC_B2C'

interface InvoiceTypeSelectorProps {
  value: InvoiceType
  onChange: (type: InvoiceType) => void
  disabled?: boolean
}

const invoiceTypes = [
  {
    value: 'EXPORT' as InvoiceType,
    label: 'Export (LUT)',
    description: 'For international clients, 0% GST under LUT',
    icon: <PublicOutlined />,
    chip: '0% GST',
    chipColor: 'success' as const,
  },
  {
    value: 'DOMESTIC_B2B' as InvoiceType,
    label: 'Domestic B2B',
    description: 'For Indian businesses with GSTIN',
    icon: <BusinessOutlined />,
    chip: 'GST Applicable',
    chipColor: 'primary' as const,
  },
  {
    value: 'DOMESTIC_B2C' as InvoiceType,
    label: 'Domestic B2C',
    description: 'For Indian individuals/unregistered entities',
    icon: <PersonOutlined />,
    chip: 'GST Applicable',
    chipColor: 'primary' as const,
  },
]

export function InvoiceTypeSelector({
  value,
  onChange,
  disabled = false,
}: InvoiceTypeSelectorProps) {
  return (
    <FormControl component="fieldset" fullWidth>
      <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
        Invoice Type
      </FormLabel>
      <RadioGroup
        value={value}
        onChange={(e) => onChange(e.target.value as InvoiceType)}
        row
      >
        {invoiceTypes.map((type) => (
          <Card
            key={type.value}
            sx={{
              flex: 1,
              mr: type.value !== 'DOMESTIC_B2C' ? 2 : 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              border: 2,
              borderColor: value === type.value ? 'primary.main' : 'divider',
              opacity: disabled ? 0.6 : 1,
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: disabled ? 'divider' : 'primary.light',
                transform: disabled ? 'none' : 'translateY(-2px)',
                boxShadow: disabled ? 'none' : 2,
              },
            }}
            onClick={() => !disabled && onChange(type.value)}
          >
            <CardContent>
              <FormControlLabel
                value={type.value}
                control={
                  <Radio
                    size="small"
                    disabled={disabled}
                    sx={{ display: 'none' }}
                  />
                }
                label={
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Box
                        sx={{
                          mr: 1,
                          color: value === type.value ? 'primary.main' : 'text.secondary',
                        }}
                      >
                        {type.icon}
                      </Box>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: value === type.value ? 600 : 500,
                          color: value === type.value ? 'primary.main' : 'text.primary',
                        }}
                      >
                        {type.label}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      {type.description}
                    </Typography>
                    <Chip
                      label={type.chip}
                      size="small"
                      color={type.chipColor}
                      variant={value === type.value ? 'filled' : 'outlined'}
                    />
                  </Box>
                }
                sx={{ m: 0, width: '100%' }}
              />
            </CardContent>
          </Card>
        ))}
      </RadioGroup>
    </FormControl>
  )
}