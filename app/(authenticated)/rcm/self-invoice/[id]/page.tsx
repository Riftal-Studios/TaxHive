'use client'

import React, { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Grid,
  Chip,
  Stack,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  GetApp as DownloadIcon,
  Print as PrintIcon,
  Edit as EditIcon,
  Receipt as ReceiptIcon,
  History as HistoryIcon,
  Assessment as ReportIcon,
} from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { SelfInvoicePreview } from '@/components/rcm/self-invoice-preview'
import { enqueueSnackbar } from 'notistack'
import { format } from 'date-fns'

interface TabPanelProps {
  children?: React.ReactNode
  index: any
  value: any
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function SelfInvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string
  const [currentTab, setCurrentTab] = useState(0)

  // Fetch self-invoice details
  const { data: any, isPending: any, error } = api.rcm.getSelfInvoice.useQuery({
    id: any,
  })

  // Download PDF mutation
  const downloadPDF = api.rcm.downloadSelfInvoicePDF.useMutation({
    onSuccess: (data: any) => {
      // Create blob and download
      const blob = new Blob([data.pdf], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${data.filename}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      enqueueSnackbar('PDF downloaded successfully', { variant: 'success' })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.message || 'Failed to download PDF', { variant: 'error' })
    },
  })

  // Cancel invoice mutation
  const cancelInvoice = api.rcm.cancelSelfInvoice.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Self-invoice cancelled successfully', { variant: 'success' })
      router.refresh()
    },
    onError: (error: any) => {
      enqueueSnackbar(error.message || 'Failed to cancel self-invoice', { variant: 'error' })
    },
  })

  const handleDownloadPDF = () => {
    downloadPDF.mutate({ invoiceId } as any)
  }

  const handlePrint = () => {
    // Open print view in new window
    const printWindow = window.open(`/rcm/self-invoice/${invoiceId}/print`, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel this self-invoice? This action cannot be undone.')) {
      cancelInvoice.mutate({ invoiceId } as any)
    }
  }

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
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.message || 'Self-invoice not found'}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/rcm/self-invoice')}
        >
          Back to Self-Invoices
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => router.push('/rcm')}
          sx={{ textDecoration: 'none' }}
        >
          RCM Management
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => router.push('/rcm/self-invoice')}
          sx={{ textDecoration: 'none' }}
        >
          Self-Invoices
        </Link>
        <Typography color="text.primary">{invoice.invoiceNumber}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/rcm/self-invoice')}
          sx={{ mb: 2 }}
        >
          Back to List
        </Button>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {invoice.invoiceNumber}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={invoice.status}
                color={invoice.status === 'ISSUED' ? 'success' : invoice.status === 'CANCELLED' ? 'error' : 'default'}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                Generated on {format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}
              </Typography>
            </Stack>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadPDF}
              disabled={downloadPDF.isPending}
            >
              Download PDF
            </Button>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
            >
              Print
            </Button>
            {invoice.status === 'ISSUED' && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleCancel}
                disabled={cancelInvoice.isPending}
              >
                Cancel Invoice
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
            <Tab 
              label="Invoice Details" 
              icon={<ReceiptIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Audit Trail" 
              icon={<HistoryIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Compliance Report" 
              icon={<ReportIcon />} 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={0}>
          <SelfInvoicePreview
            invoice={invoice}
            showActions={false}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Audit Trail
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom color="primary">
                      Creation Details
                    </Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Created:</Typography>
                        <Typography variant="body2">
                          {format(new Date(invoice.createdAt), 'dd/MM/yyyy HH: any:ss')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Status:</Typography>
                        <Typography variant="body2">{invoice.status}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Compliance:</Typography>
                        <Typography variant="body2">
                          {invoice.issuedWithinTime ? 'On Time' : `${invoice.daysDelayed} days delayed`}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom color="primary">
                      Financial Summary
                    </Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Taxable Amount:</Typography>
                        <Typography variant="body2">₹{Number(invoice.taxableAmount).toFixed(2)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Total Tax:</Typography>
                        <Typography variant="body2">₹{Number(invoice.totalTaxAmount).toFixed(2)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Total Amount:</Typography>
                        <Typography variant="body2" fontWeight={600}>₹{Number(invoice.totalAmount).toFixed(2)}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Compliance Report
            </Typography>
            
            {!invoice.issuedWithinTime && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Compliance Violation Detected
                </Typography>
                <Typography variant="body2">
                  This self-invoice was issued {invoice.daysDelayed} days after the 30-day deadline.
                  Interest and penalty provisions under Section 50 of CGST Act may apply.
                </Typography>
              </Alert>
            )}

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom color="primary">
                      Statutory Compliance
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Rule 47A Compliance:</Typography>
                        <Chip
                          label={invoice.issuedWithinTime ? 'Compliant' : 'Non-Compliant'}
                          color={invoice.issuedWithinTime ? 'success' : 'error'}
                          size="small"
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Receipt Date:</Typography>
                        <Typography variant="body2">
                          {format(new Date(invoice.goodsReceiptDate), 'dd/MM/yyyy')}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Invoice Date:</Typography>
                        <Typography variant="body2">
                          {format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Days Elapsed:</Typography>
                        <Typography variant="body2">
                          {Math.floor((new Date(invoice.invoiceDate).getTime() - new Date(invoice.goodsReceiptDate).getTime()) / (1000 * 60 * 60 * 24))} days
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom color="primary">
                      GSTR Filing Status
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">GSTR-1 Period:</Typography>
                        <Typography variant="body2">
                          {invoice.gstr1Period || 'Not assigned'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">GSTR-1 Included:</Typography>
                        <Chip
                          label={invoice.includedInGSTR1 ? 'Yes' : 'No'}
                          color={invoice.includedInGSTR1 ? 'success' : 'warning'}
                          size="small"
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">GSTR-3B Period:</Typography>
                        <Typography variant="body2">
                          {invoice.gstr3bPeriod || 'Not assigned'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">GSTR-3B Included:</Typography>
                        <Chip
                          label={invoice.includedInGSTR3B ? 'Yes' : 'No'}
                          color={invoice.includedInGSTR3B ? 'success' : 'warning'}
                          size="small"
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  )
}