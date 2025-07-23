'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material'
import {
  Send as SendIcon,
  Check as CheckIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { validateEmail, validateEmails } from '@/lib/email/validation'

interface EmailComposerProps {
  invoiceId: string
  invoiceNumber: string
  clientEmail: string
  clientName: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  type?: 'invoice' | 'payment-reminder'
}

export function MUIEmailComposer({
  invoiceId,
  invoiceNumber,
  clientEmail,
  clientName,
  isOpen,
  onClose,
  onSuccess,
  type = 'invoice'
}: EmailComposerProps) {
  const [to, setTo] = useState(clientEmail)
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Send invoice email mutation
  const sendInvoiceEmailMutation = api.invoices.sendInvoiceEmail.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId)
      setIsSending(true)
    },
    onError: (error) => {
      setErrors({ general: error.message })
      setIsSending(false)
    }
  })

  // Send payment reminder mutation
  const sendPaymentReminderMutation = api.invoices.sendPaymentReminder.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId)
      setIsSending(true)
    },
    onError: (error) => {
      setErrors({ general: error.message })
      setIsSending(false)
    }
  })

  // Poll for email status
  const { data: emailStatus } = api.invoices.getEmailStatus.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId && isSending,
      refetchInterval: 1000,
    }
  )

  useEffect(() => {
    if (emailStatus?.status === 'completed') {
      setIsSending(false)
      setEmailSent(true)
      setJobId(null)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 2000)
    } else if (emailStatus?.status === 'failed') {
      setIsSending(false)
      setJobId(null)
      setErrors({ general: typeof emailStatus.error === 'string' ? emailStatus.error : 'Failed to send email' })
    }
  }, [emailStatus, onSuccess, onClose])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!validateEmail(to)) {
      newErrors.to = 'Invalid email address'
    }

    if (cc && !validateEmails(cc.split(',').map(e => e.trim()).filter(e => e))) {
      newErrors.cc = 'One or more CC email addresses are invalid'
    }

    if (bcc && !validateEmails(bcc.split(',').map(e => e.trim()).filter(e => e))) {
      newErrors.bcc = 'One or more BCC email addresses are invalid'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSend = async () => {
    if (!validateForm()) return

    const emailData = {
      id: invoiceId,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      customMessage: customMessage || undefined,
    }

    if (type === 'invoice') {
      await sendInvoiceEmailMutation.mutateAsync(emailData)
    } else {
      await sendPaymentReminderMutation.mutateAsync(emailData)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {type === 'invoice' ? 'Send Invoice' : 'Send Payment Reminder'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {type === 'invoice' 
              ? `Send invoice ${invoiceNumber} to ${clientName}`
              : `Send payment reminder for invoice ${invoiceNumber}`
            }
          </Typography>

          {emailSent ? (
            <Box textAlign="center" py={8}>
              <Box
                sx={{
                  mx: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: 'success.light',
                  mb: 2,
                }}
              >
                <CheckIcon color="success" />
              </Box>
              <Typography variant="h6" gutterBottom>
                Email sent successfully!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The {type === 'invoice' ? 'invoice' : 'payment reminder'} has been sent to {to}
              </Typography>
            </Box>
          ) : (
            <Box>
              {errors.general && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errors.general}
                </Alert>
              )}

              <Grid container spacing={2}>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="To"
                    type="email"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    error={!!errors.to}
                    helperText={errors.to}
                    required
                  />
                </Grid>

                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="CC (Optional, comma-separated)"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    error={!!errors.cc}
                    helperText={errors.cc}
                    placeholder="email1@example.com, email2@example.com"
                  />
                </Grid>

                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="BCC (Optional, comma-separated)"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    error={!!errors.bcc}
                    helperText={errors.bcc}
                    placeholder="email1@example.com, email2@example.com"
                  />
                </Grid>

                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Custom Message (Optional)"
                    multiline
                    rows={4}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a personal message to the email..."
                  />
                </Grid>

                <Grid size={12}>
                  <Alert severity="info">
                    {type === 'invoice' 
                      ? 'The invoice PDF will be automatically attached to the email.'
                      : 'A link to view the invoice will be included in the reminder.'
                    }
                  </Alert>
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={isSending}
        >
          {emailSent ? 'Close' : 'Cancel'}
        </Button>
        {!emailSent && (
          <Button
            onClick={handleSend}
            disabled={isSending}
            variant="contained"
            startIcon={isSending ? <CircularProgress size={16} /> : <SendIcon />}
          >
            {isSending ? 'Sending...' : 'Send Email'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}