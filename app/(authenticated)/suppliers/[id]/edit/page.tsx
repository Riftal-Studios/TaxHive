'use client'

import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material'
import { ArrowBack as BackIcon } from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { UnregisteredSupplierForm } from '@/components/self-invoices'
import type { UnregisteredSupplierFormData } from '@/components/self-invoices'

export default function EditSupplierPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: supplier, isLoading, error } = api.unregisteredSuppliers.getById.useQuery({ id })

  const updateSupplier = api.unregisteredSuppliers.update.useMutation({
    onSuccess: () => {
      router.push(`/suppliers/${id}`)
    },
  })

  const handleSubmit = async (data: UnregisteredSupplierFormData) => {
    await updateSupplier.mutateAsync({ id, ...data })
  }

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading supplier: {error.message}
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/suppliers')}
        >
          Back to Suppliers
        </Button>
      </Container>
    )
  }

  if (!supplier) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Supplier not found
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/suppliers')}
        >
          Back to Suppliers
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box mb={4}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push(`/suppliers/${id}`)}
          sx={{ mb: 2 }}
        >
          Back to Supplier
        </Button>
        <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
          Edit Supplier
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {supplier.name}
        </Typography>
      </Box>

      {updateSupplier.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {updateSupplier.error.message}
        </Alert>
      )}

      <Paper sx={{ p: 4 }}>
        <UnregisteredSupplierForm
          supplier={supplier}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/suppliers/${id}`)}
        />
      </Paper>
    </Container>
  )
}
