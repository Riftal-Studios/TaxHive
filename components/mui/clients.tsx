'use client'

import React, { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  Skeleton,
} from '@mui/material'
import {
  Add as AddIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { ClientsTable } from './clients-table'
import { ClientForm, type ClientFormData } from './client-form'
import type { Client } from '@/types/prisma-temp'
import { enqueueSnackbar } from 'notistack'

export function MUIClients() {
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
  
  const utils = api.useUtils()
  const { data: clients, isLoading } = api.clients.list.useQuery()
  
  const createMutation = api.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate()
      setShowForm(false)
      enqueueSnackbar('Client created successfully', { variant: 'success' })
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })
  
  const updateMutation = api.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate()
      setShowForm(false)
      setEditingClient(null)
      enqueueSnackbar('Client updated successfully', { variant: 'success' })
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })
  
  const deleteMutation = api.clients.delete.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate()
      enqueueSnackbar('Client deleted successfully', { variant: 'success' })
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })

  const handleSubmit = async (data: ClientFormData) => {
    if (editingClient) {
      await updateMutation.mutateAsync({
        id: editingClient.id,
        ...data,
        isActive: editingClient.isActive,
      })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setShowForm(true)
  }

  const handleDeleteClick = (client: Client) => {
    setClientToDelete(client)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (clientToDelete) {
      await deleteMutation.mutateAsync({ id: clientToDelete.id })
      setDeleteDialogOpen(false)
      setClientToDelete(null)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingClient(null)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  if (isLoading) {
    return (
      <Box>
        <Box mb={4}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="text" width={300} height={24} />
        </Box>
        <Card>
          <CardContent>
            <Skeleton variant="rectangular" height={400} />
          </CardContent>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
            Clients
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your client information
          </Typography>
        </Box>
        {!showForm && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowForm(true)}
          >
            Add Client
          </Button>
        )}
      </Box>

      {showForm ? (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </Typography>
            <ClientForm
              client={editingClient || undefined}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          {clients && clients.length > 0 ? (
            <ClientsTable
              clients={clients}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ) : (
            <CardContent>
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                py={8}
              >
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No clients found
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Add your first client to get started
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowForm(true)}
                >
                  Add Your First Client
                </Button>
              </Box>
            </CardContent>
          )}
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {deleteMutation.isPending && <LinearProgress />}
        <DialogTitle>Delete Client</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone.
          </Alert>
          <Typography>
            Are you sure you want to delete <strong>{clientToDelete?.name}</strong>?
          </Typography>
          {clientToDelete?.company && (
            <Typography variant="body2" color="text.secondary" mt={1}>
              Company: {clientToDelete.company}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}