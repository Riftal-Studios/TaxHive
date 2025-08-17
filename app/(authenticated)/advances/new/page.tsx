'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { AdvanceReceiptForm } from '@/components/advances/advance-receipt-form'
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  CircularProgress,
  Container,
  Breadcrumbs,
  Link,
} from '@mui/material'
import { 
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material'
import { enqueueSnackbar } from 'notistack'
import NextLink from 'next/link'

export default function NewAdvanceReceiptPage() {
  const router = useRouter()
  const utils = api.useUtils()
  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  // Fetch clients
  const { data: clients, isLoading: clientsLoading, error: clientsError } = api.clients.list.useQuery()
  
  // Get exchange rate
  const { data: exchangeRateData } = api.invoices.getCurrentExchangeRate.useQuery({
    currency: selectedCurrency,
    date: selectedDate,
  }, {
    enabled: selectedCurrency !== 'INR',
  })
  
  // Create advance receipt mutation
  const createAdvanceReceiptMutation = api.advanceReceipts.createAdvanceReceipt.useMutation({
    onSuccess: (receipt) => {
      utils.advanceReceipts.getAdvanceReceipts.invalidate()
      utils.advanceReceipts.getAdvanceMetrics.invalidate()
      enqueueSnackbar('Advance receipt created successfully', { variant: 'success' })
      router.push('/advances')
    },
    onError: (error) => {
      console.error('Failed to create advance receipt:', error)
      enqueueSnackbar(`Failed to create advance receipt: ${error.message}`, { variant: 'error' })
    },
  })
  
  const handleSubmit = async (data: {
    clientId: string
    receiptDate: Date
    currency: string
    amount: number
    exchangeRate: number
    paymentMode: 'WIRE' | 'CHEQUE' | 'UPI' | 'CASH'
    bankReference?: string
    bankName?: string
    chequeNumber?: string
    chequeDate?: Date
    isGSTApplicable: boolean
    gstRate?: number
    notes?: string
  }) => {
    try {
      // Update selected currency if it changed
      if (data.currency !== selectedCurrency) {
        setSelectedCurrency(data.currency)
      }
      
      await createAdvanceReceiptMutation.mutateAsync({
        clientId: data.clientId,
        receiptDate: data.receiptDate,
        currency: data.currency,
        amount: data.amount,
        exchangeRate: data.exchangeRate,
        paymentMode: data.paymentMode,
        bankReference: data.bankReference,
        bankName: data.bankName,
        chequeNumber: data.chequeNumber,
        chequeDate: data.chequeDate,
        isGSTApplicable: data.isGSTApplicable,
        gstRate: data.gstRate,
        notes: data.notes,
      })
    } catch (error) {
      // Error is handled by mutation onError
      console.error('Error creating advance receipt:', error)
    }
  }
  
  const handleCancel = () => {
    router.push('/advances')
  }
  
  // Loading state
  if (clientsLoading) {
    return (
      <Container maxWidth="lg">
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '400px' 
          }}
        >
          <CircularProgress />
        </Box>
      </Container>
    )
  }
  
  // Error state
  if (clientsError) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error">
            Failed to load data: {clientsError.message}
          </Alert>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => router.push('/advances')}
            sx={{ mt: 2 }}
          >
            Back to Advance Receipts
          </Button>
        </Box>
      </Container>
    )
  }
  
  // No clients state
  if (!clients || clients.length === 0) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="warning">
            No clients found. Please add a client before creating an advance receipt.
          </Alert>
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              component={NextLink}
              href="/clients"
            >
              Add Client
            </Button>
            <Button 
              startIcon={<ArrowBackIcon />} 
              onClick={() => router.push('/advances')}
            >
              Back to Advance Receipts
            </Button>
          </Box>
        </Box>
      </Container>
    )
  }
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link 
            component={NextLink} 
            href="/dashboard" 
            color="inherit" 
            underline="hover"
          >
            Dashboard
          </Link>
          <Link 
            component={NextLink} 
            href="/advances" 
            color="inherit" 
            underline="hover"
          >
            Advance Receipts
          </Link>
          <Typography color="text.primary">New Receipt</Typography>
        </Breadcrumbs>
        
        {/* Page Header */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <ReceiptIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1">
              Create Advance Receipt
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Record advance payment received from client
            </Typography>
          </Box>
        </Box>
        
        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Note:</strong> For export services under LUT, GST is typically not applicable on advance receipts.
            The system will generate a receipt number automatically in the format: ADV-FY24-25/0001
          </Typography>
        </Alert>
        
        {/* Form */}
        <AdvanceReceiptForm
          clients={clients}
          exchangeRate={exchangeRateData || undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </Box>
    </Container>
  )
}