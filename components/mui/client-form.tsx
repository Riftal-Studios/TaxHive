'use client'

import React, { useState } from 'react'
import {
  Box,
  TextField,
  Button,
  Grid,
  CircularProgress,
} from '@mui/material'
import type { Client } from '@/types/prisma-temp'

interface ClientFormProps {
  client?: Partial<Client>
  onSubmit: (data: ClientFormData) => void | Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export interface ClientFormData {
  name: string
  email: string
  company: string
  address: string
  country: string
  phone: string
  taxId: string
}

interface FormErrors {
  name?: string
  email?: string
  address?: string
  country?: string
}

export function ClientForm({ client, onSubmit, onCancel, isSubmitting = false }: ClientFormProps) {
  const [formData, setFormData] = useState<ClientFormData>({
    name: client?.name || '',
    email: client?.email || '',
    company: client?.company || '',
    address: client?.address || '',
    country: client?.country || '',
    phone: client?.phone || '',
    taxId: client?.taxId || '',
  })
  
  const [errors, setErrors] = useState<FormErrors>({})

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address'
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required'
    }
    
    if (!formData.country.trim()) {
      newErrors.country = 'Country is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    await onSubmit(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
      <Grid container spacing={3}>
        <Grid
          size={{
            xs: 12,
            sm: 6
          }}>
          <TextField
            fullWidth
            required
            label="Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            error={!!errors.name}
            helperText={errors.name}
            disabled={isSubmitting}
          />
        </Grid>

        <Grid
          size={{
            xs: 12,
            sm: 6
          }}>
          <TextField
            fullWidth
            required
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={!!errors.email}
            helperText={errors.email}
            disabled={isSubmitting}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            label="Company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            required
            label="Address"
            name="address"
            multiline
            rows={3}
            value={formData.address}
            onChange={handleChange}
            error={!!errors.address}
            helperText={errors.address}
            disabled={isSubmitting}
          />
        </Grid>

        <Grid
          size={{
            xs: 12,
            sm: 4
          }}>
          <TextField
            fullWidth
            required
            label="Country"
            name="country"
            value={formData.country}
            onChange={handleChange}
            error={!!errors.country}
            helperText={errors.country}
            disabled={isSubmitting}
          />
        </Grid>

        <Grid
          size={{
            xs: 12,
            sm: 4
          }}>
          <TextField
            fullWidth
            label="Phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </Grid>

        <Grid
          size={{
            xs: 12,
            sm: 4
          }}>
          <TextField
            fullWidth
            label="Tax ID"
            name="taxId"
            value={formData.taxId}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="flex-end" gap={2} mt={4}>
        <Button
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
        >
          {isSubmitting ? 'Saving...' : client ? 'Update Client' : 'Create Client'}
        </Button>
      </Box>
    </Box>
  )
}