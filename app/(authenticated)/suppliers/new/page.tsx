'use client'

import { useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  Button,
} from '@mui/material'
import { ArrowBack as BackIcon } from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { UnregisteredSupplierForm } from '@/components/self-invoices'
import type { UnregisteredSupplierFormData } from '@/components/self-invoices'

export default function NewSupplierPage() {
  const router = useRouter()

  const createSupplier = api.unregisteredSuppliers.create.useMutation({
    onSuccess: (data) => {
      router.push(`/suppliers/${data.id}`)
    },
  })

  const handleSubmit = async (data: UnregisteredSupplierFormData) => {
    await createSupplier.mutateAsync(data)
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box mb={4}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/suppliers')}
          sx={{ mb: 2 }}
        >
          Back to Suppliers
        </Button>
        <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
          Add Unregistered Supplier
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Add a new supplier who is not registered under GST
        </Typography>
      </Box>

      {createSupplier.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {createSupplier.error.message}
        </Alert>
      )}

      <Paper sx={{ p: 4 }}>
        <UnregisteredSupplierForm
          onSubmit={handleSubmit}
          onCancel={() => router.push('/suppliers')}
        />
      </Paper>
    </Container>
  )
}
