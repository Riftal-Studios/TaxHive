'use client'

import React, { useEffect } from 'react'
import { Box, CircularProgress, Alert } from '@mui/material'
import { useParams } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { SelfInvoicePreview } from '@/components/rcm/self-invoice-preview'

export default function SelfInvoicePrintPage() {
  const params = useParams()
  const invoiceId = params.id as string

  // Fetch self-invoice details
  const { data: any, isPending: any, error } = api.rcm.getSelfInvoice.useQuery({
    id: any,
  })

  // Trigger print dialog when component mounts and data is loaded
  useEffect(() => {
    if (invoice && !isLoading) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        window.print()
      }, 1000)
    }
  }, [invoice, isLoading])

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress size={40} />
      </Box>
    )
  }

  if (error || !invoice) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Alert severity="error">
          {error?.message || 'Self-invoice not found'}
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ 
      '@media print': {
        '& *': {
          visibility: 'visible !important',
        },
        '& .no-print': {
          display: 'none !important',
        },
      },
    }}>
      <SelfInvoicePreview
        invoice={invoice}
        showActions={false}
      />
    </Box>
  )
}