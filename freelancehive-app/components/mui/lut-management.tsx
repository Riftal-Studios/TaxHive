'use client'

import React, { useState } from 'react'
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Typography,
  Tooltip,
  LinearProgress,
  Paper,
  Skeleton,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { format, parseISO } from 'date-fns'
import { enqueueSnackbar } from 'notistack'

interface LUTFormData {
  lutNumber: string
  lutDate: Date | null
  validFrom: Date | null
  validTill: Date | null
}

export function MUILUTManagement() {
  const [showForm, setShowForm] = useState(false)
  const [editingLUT, setEditingLUT] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [lutToDelete, setLutToDelete] = useState<string | null>(null)
  const [formData, setFormData] = useState<LUTFormData>({
    lutNumber: '',
    lutDate: null,
    validFrom: null,
    validTill: null,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof LUTFormData, string>>>({})

  const utils = api.useUtils()
  const { data: luts, isLoading } = api.luts.list.useQuery()

  const createLUTMutation = api.luts.create.useMutation({
    onSuccess: () => {
      utils.luts.list.invalidate()
      setShowForm(false)
      resetForm()
      enqueueSnackbar('LUT created successfully', { variant: 'success' })
    },
    onError: (error) => {
      if (error.data?.zodError) {
        const zodErrors: Partial<Record<keyof LUTFormData, string>> = {}
        Object.entries(error.data.zodError.fieldErrors).forEach(([field, messages]) => {
          if (messages && messages.length > 0) {
            zodErrors[field as keyof LUTFormData] = messages[0]
          }
        })
        setErrors(zodErrors)
      }
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const updateLUTMutation = api.luts.update.useMutation({
    onSuccess: () => {
      utils.luts.list.invalidate()
      setEditingLUT(null)
      resetForm()
      enqueueSnackbar('LUT updated successfully', { variant: 'success' })
    },
    onError: (error) => {
      if (error.data?.zodError) {
        const zodErrors: Partial<Record<keyof LUTFormData, string>> = {}
        Object.entries(error.data.zodError.fieldErrors).forEach(([field, messages]) => {
          if (messages && messages.length > 0) {
            zodErrors[field as keyof LUTFormData] = messages[0]
          }
        })
        setErrors(zodErrors)
      }
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const deleteLUTMutation = api.luts.delete.useMutation({
    onSuccess: () => {
      utils.luts.list.invalidate()
      enqueueSnackbar('LUT deleted successfully', { variant: 'success' })
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const toggleActiveMutation = api.luts.toggleActive.useMutation({
    onSuccess: () => {
      utils.luts.list.invalidate()
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const resetForm = () => {
    setFormData({
      lutNumber: '',
      lutDate: null,
      validFrom: null,
      validTill: null,
    })
    setErrors({})
  }

  const handleEdit = (lut: any) => {
    setEditingLUT(lut.id)
    setFormData({
      lutNumber: lut.lutNumber,
      lutDate: new Date(lut.lutDate),
      validFrom: new Date(lut.validFrom),
      validTill: new Date(lut.validTill),
    })
    setShowForm(true)
  }

  const handleDeleteClick = (lutId: string) => {
    setLutToDelete(lutId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (lutToDelete) {
      await deleteLUTMutation.mutateAsync({ id: lutToDelete })
      setDeleteDialogOpen(false)
      setLutToDelete(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const localErrors: Partial<Record<keyof LUTFormData, string>> = {}
    
    if (!formData.lutNumber.trim()) {
      localErrors.lutNumber = 'LUT number is required'
    }
    if (!formData.lutDate) {
      localErrors.lutDate = 'LUT date is required'
    }
    if (!formData.validFrom) {
      localErrors.validFrom = 'Valid from date is required'
    }
    if (!formData.validTill) {
      localErrors.validTill = 'Valid till date is required'
    }
    
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors)
      return
    }

    if (editingLUT) {
      await updateLUTMutation.mutateAsync({
        id: editingLUT,
        lutNumber: formData.lutNumber,
        lutDate: formData.lutDate!,
        validFrom: formData.validFrom!,
        validTill: formData.validTill!,
      })
    } else {
      await createLUTMutation.mutateAsync({
        lutNumber: formData.lutNumber,
        lutDate: formData.lutDate!,
        validFrom: formData.validFrom!,
        validTill: formData.validTill!,
      })
    }
  }

  const isSubmitting = createLUTMutation.isPending || updateLUTMutation.isPending

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={400} />
      </Box>
    )
  }

  const getStatusColor = (lut: any) => {
    const now = new Date()
    const validFrom = new Date(lut.validFrom)
    const validTill = new Date(lut.validTill)
    
    if (now < validFrom) return 'info' // Upcoming
    if (now > validTill) return 'error' // Expired
    return 'success' // Active
  }

  const getStatusLabel = (lut: any) => {
    const now = new Date()
    const validFrom = new Date(lut.validFrom)
    const validTill = new Date(lut.validTill)
    
    if (now < validFrom) return 'Upcoming'
    if (now > validTill) return 'Expired'
    return 'Active'
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            LUT (Letter of Undertaking) Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowForm(true)}
          >
            Add LUT
          </Button>
        </Box>

        {luts?.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No LUTs added yet
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Add your Letter of Undertaking to enable zero-rated supplies for exports
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowForm(true)}
            >
              Add Your First LUT
            </Button>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>LUT Number</TableCell>
                  <TableCell>LUT Date</TableCell>
                  <TableCell>Valid From</TableCell>
                  <TableCell>Valid Till</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {luts?.map((lut) => (
                  <TableRow key={lut.id}>
                    <TableCell>{lut.lutNumber}</TableCell>
                    <TableCell>{format(new Date(lut.lutDate), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{format(new Date(lut.validFrom), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{format(new Date(lut.validTill), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(lut)}
                        size="small"
                        color={getStatusColor(lut)}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => toggleActiveMutation.mutate({ id: lut.id })}
                        disabled={toggleActiveMutation.isPending}
                      >
                        {lut.isActive ? (
                          <ActiveIcon color="success" />
                        ) : (
                          <InactiveIcon color="disabled" />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" gap={1} justifyContent="flex-end">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(lut)}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(lut.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* LUT Form Dialog */}
        <Dialog
          open={showForm}
          onClose={() => {
            setShowForm(false)
            setEditingLUT(null)
            resetForm()
          }}
          maxWidth="sm"
          fullWidth
        >
          {isSubmitting && <LinearProgress />}
          <DialogTitle>
            {editingLUT ? 'Edit LUT' : 'Add New LUT'}
          </DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="LUT Number"
                value={formData.lutNumber}
                onChange={(e) => setFormData({ ...formData, lutNumber: e.target.value })}
                error={!!errors.lutNumber}
                helperText={errors.lutNumber}
                disabled={isSubmitting}
                sx={{ mb: 3 }}
              />

              <DatePicker
                label="LUT Date"
                value={formData.lutDate}
                onChange={(newValue) => setFormData({ ...formData, lutDate: newValue })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.lutDate,
                    helperText: errors.lutDate,
                    disabled: isSubmitting,
                    sx: { mb: 3 },
                  },
                }}
              />

              <DatePicker
                label="Valid From"
                value={formData.validFrom}
                onChange={(newValue) => setFormData({ ...formData, validFrom: newValue })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.validFrom,
                    helperText: errors.validFrom,
                    disabled: isSubmitting,
                    sx: { mb: 3 },
                  },
                }}
              />

              <DatePicker
                label="Valid Till"
                value={formData.validTill}
                onChange={(newValue) => setFormData({ ...formData, validTill: newValue })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.validTill,
                    helperText: errors.validTill || 'LUTs are typically valid for one financial year',
                    disabled: isSubmitting,
                  },
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setShowForm(false)
                setEditingLUT(null)
                resetForm()
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={isSubmitting}
            >
              {editingLUT ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          {deleteLUTMutation.isPending && <LinearProgress />}
          <DialogTitle>Delete LUT</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              This action cannot be undone.
            </Alert>
            <Typography>
              Are you sure you want to delete this LUT?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLUTMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disabled={deleteLUTMutation.isPending}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  )
}