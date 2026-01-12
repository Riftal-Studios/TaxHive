'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  TextField,
  Stack,
  Divider,
} from '@mui/material'
import { ArrowBack as BackIcon, Save as SaveIcon } from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/invoice-utils'
import { toSafeNumber } from '@/lib/utils/decimal'

export default function EditSelfInvoicePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: invoice, isLoading, error } = api.selfInvoices.getById.useQuery({ id })

  const [invoiceDate, setInvoiceDate] = useState('')
  const [dateOfReceiptOfSupply, setDateOfReceiptOfSupply] = useState('')
  const [notes, setNotes] = useState('')
  const [initialized, setInitialized] = useState(false)

  // Initialize form data when invoice loads
  if (invoice && !initialized) {
    setInvoiceDate(format(new Date(invoice.invoiceDate), 'yyyy-MM-dd'))
    setDateOfReceiptOfSupply(
      invoice.dateOfReceiptOfSupply
        ? format(new Date(invoice.dateOfReceiptOfSupply), 'yyyy-MM-dd')
        : ''
    )
    setNotes(invoice.notes || '')
    setInitialized(true)
  }

  const updateSelfInvoice = api.selfInvoices.update.useMutation({
    onSuccess: () => {
      router.push(`/self-invoices/${id}`)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateSelfInvoice.mutateAsync({
      id,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
      dateOfReceiptOfSupply: dateOfReceiptOfSupply ? new Date(dateOfReceiptOfSupply) : undefined,
      notes,
    })
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
          Error loading self-invoice: {error.message}
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/self-invoices')}
        >
          Back to Self Invoices
        </Button>
      </Container>
    )
  }

  if (!invoice) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Self-invoice not found
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/self-invoices')}
        >
          Back to Self Invoices
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box mb={4}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push(`/self-invoices/${id}`)}
          sx={{ mb: 2 }}
        >
          Back to Invoice
        </Button>
        <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
          Edit Self Invoice
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {invoice.invoiceNumber}
        </Typography>
      </Box>

      {updateSelfInvoice.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {updateSelfInvoice.error.message}
        </Alert>
      )}

      {/* Invoice Summary (Read-only) */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Invoice Summary
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1}>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Supplier
            </Typography>
            <Typography variant="body1">
              {invoice.unregisteredSupplier?.name || 'Unknown'}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Total Amount
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {formatCurrency(toSafeNumber(invoice.totalAmount), 'INR')}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              GST Rate
            </Typography>
            <Typography variant="body1">
              {toSafeNumber(invoice.cgstRate) * 2}%
            </Typography>
          </Box>
        </Stack>
        <Alert severity="info" sx={{ mt: 2 }}>
          To modify line items or GST rate, please create a new self-invoice.
        </Alert>
      </Paper>

      {/* Editable Fields */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Edit Details
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              label="Invoice Date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
              }}
              fullWidth
            />

            <TextField
              label="Date of Receipt of Supply"
              type="date"
              value={dateOfReceiptOfSupply}
              onChange={(e) => setDateOfReceiptOfSupply(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
              }}
              fullWidth
              helperText="RCM Rule 47A: Self-invoice must be issued within 30 days of receipt"
            />

            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={4}
              fullWidth
            />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={() => router.push(`/self-invoices/${id}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={updateSelfInvoice.isPending}
              >
                {updateSelfInvoice.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}
