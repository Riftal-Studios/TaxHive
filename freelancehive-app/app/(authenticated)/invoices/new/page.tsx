'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  CircularProgress,
  Container,
} from '@mui/material'
import { PersonAdd as PersonAddIcon } from '@mui/icons-material'
import { enqueueSnackbar } from 'notistack'

export default function NewInvoicePage() {
  const router = useRouter()
  const utils = api.useUtils()
  
  // Fetch clients and LUTs
  const { data: clients, isLoading: clientsLoading } = api.clients.list.useQuery()
  const { data: luts, isLoading: lutsLoading } = api.luts.list.useQuery()
  
  // Get next invoice number
  const { data: nextInvoiceNumber } = api.invoices.getNextInvoiceNumber.useQuery()
  
  // Get exchange rate query
  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [manualExchangeRate, setManualExchangeRate] = useState<number | null>(null)
  const { data: exchangeRateData } = api.invoices.getCurrentExchangeRate.useQuery({
    currency: selectedCurrency,
  })
  
  // Create invoice mutation
  const createInvoiceMutation = api.invoices.create.useMutation({
    onSuccess: (invoice) => {
      utils.invoices.list.invalidate()
      enqueueSnackbar('Invoice created successfully', { variant: 'success' })
      router.push(`/invoices/${invoice.id}`)
    },
    onError: (error) => {
      console.error('Failed to create invoice:', error)
      enqueueSnackbar(`Failed to create invoice: ${error.message}`, { variant: 'error' })
    },
  })
  
  const handleSubmit = async (data: {
    clientId: string
    lutId: string
    issueDate: string
    dueDate: string
    currency: string
    paymentTerms: number
    lineItems: Array<{
      description: string
      sacCode: string
      quantity: number
      rate: number
    }>
    bankDetails: string
    notes: string
  }) => {
    try {
      // Update selected currency if it changed
      if (data.currency !== selectedCurrency) {
        setSelectedCurrency(data.currency)
        // Wait a bit for the exchange rate query to update
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // Get exchange rate from fetched data or manual entry
      const exchangeRate = exchangeRateData?.rate || manualExchangeRate
      const exchangeRateSource = exchangeRateData?.source || 'Manual'
      
      if (!exchangeRate) {
        enqueueSnackbar('Please enter an exchange rate before creating the invoice', { variant: 'warning' })
        return
      }
      
      await createInvoiceMutation.mutateAsync({
        clientId: data.clientId,
        lutId: data.lutId || undefined,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        currency: data.currency,
        exchangeRate,
        exchangeRateSource,
        paymentTerms: data.paymentTerms,
        bankDetails: data.bankDetails,
        notes: data.notes,
        lineItems: data.lineItems.map((item) => ({
          description: item.description,
          sacCode: item.sacCode,
          quantity: item.quantity,
          rate: item.rate,
        })),
      })
    } catch {
      // Error is handled by the mutation onError
    }
  }
  
  const handleCancel = () => {
    router.push('/invoices')
  }
  
  if (clientsLoading || lutsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    )
  }
  
  if (!clients || clients.length === 0) {
    return (
      <Container maxWidth="md">
        <Box py={8}>
          <Alert 
            severity="warning"
            action={
              <Button 
                color="inherit" 
                size="small"
                startIcon={<PersonAddIcon />}
                onClick={() => router.push('/clients')}
              >
                Add Client
              </Button>
            }
          >
            <Typography variant="h6" component="div" gutterBottom>
              No Clients Found
            </Typography>
            <Typography variant="body2">
              You need to add at least one client before creating an invoice.
            </Typography>
          </Alert>
        </Box>
      </Container>
    )
  }
  
  return (
    <Container maxWidth="lg">
      <Box py={4}>
        <Box mb={4}>
          <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
            Create Invoice
          </Typography>
          {nextInvoiceNumber && (
            <Typography variant="body1" color="text.secondary">
              Invoice Number: <strong>{nextInvoiceNumber}</strong>
            </Typography>
          )}
        </Box>
        
        <Paper elevation={1} sx={{ p: 4 }}>
          <InvoiceForm
            clients={clients}
            luts={luts || []}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onCurrencyChange={setSelectedCurrency}
            exchangeRate={exchangeRateData}
            manualExchangeRate={manualExchangeRate}
            onManualExchangeRateChange={setManualExchangeRate}
          />
        </Paper>
      </Box>
    </Container>
  )
}