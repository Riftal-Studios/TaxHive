'use client'

import React, { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  CircularProgress,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import { SelfInvoiceForm } from '@/components/rcm/self-invoice-form'
import { api } from '@/lib/trpc/client'
import { format, differenceInDays } from 'date-fns'

export default function NewSelfInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const transactionId = searchParams.get('transactionId')
  
  const [showTransactionSelector, setShowTransactionSelector] = useState(!transactionId)

  // Get pending RCM transactions for self-invoice generation
  const { data: any = [], isPending: any } = api.rcm.getPendingTransactions.useQuery({
    selfInvoiceStatus: 'PENDING',
  }, {
    enabled: any,
  })

  const handleTransactionSelect = (transaction: any) => {
    setShowTransactionSelector(false)
    router.push(`/rcm/self-invoice/new?transactionId=${transaction.id}`)
  }

  const handleFormSave = (data: any) => {
    router.push('/rcm/self-invoice')
  }

  const handleFormCancel = () => {
    if (transactionId) {
      setShowTransactionSelector(true)
      router.push('/rcm/self-invoice/new')
    } else {
      router.push('/rcm/self-invoice')
    }
  }

  const getComplianceWarning = (transaction: any) => {
    if (!transaction.selfInvoiceDueDate) return null
    
    const daysRemaining = differenceInDays(new Date(transaction.selfInvoiceDueDate), new Date())
    
    if (daysRemaining < 0) {
      return {
        severity: 'error' as const,
        message: `Overdue by ${Math.abs(daysRemaining)} days`,
      }
    } else if (daysRemaining <= 5) {
      return {
        severity: 'warning' as const,
        message: `Due in ${daysRemaining} days`,
      }
    }
    
    return null
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/rcm/self-invoice')}
          sx={{ mb: 2 }}
        >
          Back to Self-Invoices
        </Button>
        
        <Typography variant="h4" component="h1" gutterBottom>
          Generate Self-Invoice
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          Self-invoices must be generated within 30 days of goods/service receipt as per GST Rule 47A.
          Failure to comply may result in interest and penalty.
        </Alert>
      </Box>

      {/* Transaction Selector Dialog */}
      <Dialog
        open={showTransactionSelector}
        onClose={() => setShowTransactionSelector(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon color="primary" />
            Select RCM Transaction
          </Box>
        </DialogTitle>
        <DialogContent>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : pendingTransactions.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Pending Transactions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All RCM transactions have self-invoices generated or no transactions found.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => router.push('/rcm')}
                sx={{ mt: 2 }}
              >
                Go to RCM Management
              </Button>
            </Box>
          ) : (
            <List>
              {pendingTransactions.map((transaction: any) => {
                const complianceWarning = getComplianceWarning(transaction)
                
                return (
                  <ListItem key={transaction.id} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" fontWeight={500}>
                            {transaction.vendorName}
                          </Typography>
                          {complianceWarning && (
                            <Chip
                              icon={<WarningIcon />}
                              label={complianceWarning.message}
                              size="small"
                              color={complianceWarning.severity}
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Invoice: {transaction.invoiceNumber || 'N/A'} | 
                            Date: {format(new Date(transaction.invoiceDate), 'dd/MM/yyyy')} |
                            Amount: ₹{Number(transaction.taxableAmount).toFixed(2)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            HSN/SAC: {transaction.hsnSacCode} | 
                            GST Rate: {transaction.gstRate}% |
                            Type: {transaction.transactionType}
                          </Typography>
                          {transaction.description && (
                            <Typography variant="body2" color="text.secondary">
                              {transaction.description}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleTransactionSelect(transaction)}
                      >
                        Generate
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                )
              })}
            </List>
          )}
        </DialogContent>
      </Dialog>

      {/* Form */}
      {transactionId && !showTransactionSelector && (
        <Card>
          <CardContent>
            <SelfInvoiceForm
              transactionId={transactionId}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  )
}