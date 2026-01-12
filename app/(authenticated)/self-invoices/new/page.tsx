'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { SelfInvoiceForm, UnregisteredSupplierForm } from '@/components/self-invoices'
import type { SelfInvoiceFormData, UnregisteredSupplierFormData } from '@/components/self-invoices'
import { getStateCodeFromGSTIN } from '@/lib/validations/gst'
import { PaymentMode } from '@prisma/client'

export default function NewSelfInvoicePage() {
  const router = useRouter()
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)

  const { data: suppliers, isLoading: suppliersLoading } = api.unregisteredSuppliers.list.useQuery()
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery()

  const utils = api.useUtils()

  const createSelfInvoice = api.selfInvoices.create.useMutation({
    onSuccess: (data) => {
      router.push(`/self-invoices/${data.invoice.id}`)
    },
  })

  const createSupplier = api.unregisteredSuppliers.create.useMutation({
    onSuccess: () => {
      utils.unregisteredSuppliers.list.invalidate()
      setSupplierDialogOpen(false)
    },
  })

  const handleSubmit = async (data: SelfInvoiceFormData) => {
    // Transform form data to match API input
    await createSelfInvoice.mutateAsync({
      unregisteredSupplierId: data.supplierId,
      invoiceDate: new Date(data.invoiceDate),
      dateOfReceiptOfSupply: new Date(data.dateOfReceiptOfSupply),
      gstRate: data.gstRate,
      lineItems: data.lineItems,
      notes: data.notes,
      paymentMode: data.paymentMode as PaymentMode,
      paymentReference: data.paymentReference,
    })
  }

  const handleCreateSupplier = async (data: UnregisteredSupplierFormData) => {
    await createSupplier.mutateAsync(data)
  }

  const isLoading = suppliersLoading || profileLoading

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  // Derive state code from GSTIN
  const userStateCode = userProfile?.gstin ? getStateCodeFromGSTIN(userProfile.gstin) : null

  if (!userProfile?.gstin || !userStateCode) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            <strong>Business Profile Incomplete</strong>
          </Typography>
          <Typography variant="body2">
            You need to complete your business profile with GSTIN before creating self-invoices.
            Self-invoices require your GSTIN for RCM compliance.
          </Typography>
          <Button
            variant="outlined"
            color="warning"
            size="small"
            sx={{ mt: 2 }}
            onClick={() => router.push('/settings')}
          >
            Complete Business Profile
          </Button>
        </Alert>
      </Container>
    )
  }

  if (!suppliers || suppliers.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            No Unregistered Suppliers
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You need to add at least one unregistered supplier before creating a self-invoice.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setSupplierDialogOpen(true)}
          >
            Add Unregistered Supplier
          </Button>
        </Paper>

        <Dialog
          open={supplierDialogOpen}
          onClose={() => setSupplierDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Add Unregistered Supplier
            <IconButton
              aria-label="close"
              onClick={() => setSupplierDialogOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <UnregisteredSupplierForm
                onSubmit={handleCreateSupplier}
                onCancel={() => setSupplierDialogOpen(false)}
              />
            </Box>
          </DialogContent>
        </Dialog>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
          Create Self Invoice
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Issue a self-invoice under RCM for purchases from unregistered suppliers
        </Typography>
      </Box>

      {createSelfInvoice.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {createSelfInvoice.error.message}
        </Alert>
      )}

      <Paper sx={{ p: 4 }}>
        <SelfInvoiceForm
          suppliers={suppliers}
          userStateCode={userStateCode}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/self-invoices')}
          onAddSupplier={() => setSupplierDialogOpen(true)}
        />
      </Paper>

      <Dialog
        open={supplierDialogOpen}
        onClose={() => setSupplierDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Add Unregistered Supplier
          <IconButton
            aria-label="close"
            onClick={() => setSupplierDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <UnregisteredSupplierForm
              onSubmit={handleCreateSupplier}
              onCancel={() => setSupplierDialogOpen(false)}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Container>
  )
}
