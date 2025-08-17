'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Paper,
  Tab,
  Tabs,
  Alert,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Receipt as ReceiptIcon,
  QrCode as QrCodeIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { format, differenceInHours } from 'date-fns'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function EInvoicePage() {
  const router = useRouter()
  const [tabValue, setTabValue] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('1')
  const [cancelRemarks, setCancelRemarks] = useState('')

  const { data: config } = api.einvoice.getConfig.useQuery()
  const { data: statistics, refetch: refetchStats } = api.einvoice.getStatistics.useQuery()
  const { data: einvoicesData, refetch: refetchInvoices } = api.einvoice.getEInvoices.useQuery({
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  })
  const { data: cancelReasons } = api.einvoice.getCancelReasons.useQuery()

  const generateIRNMutation = api.einvoice.generateIRN.useMutation({
    onSuccess: () => {
      refetchInvoices()
      refetchStats()
    },
  })

  const cancelIRNMutation = api.einvoice.cancelIRN.useMutation({
    onSuccess: () => {
      setCancelDialogOpen(false)
      setSelectedInvoice(null)
      setCancelRemarks('')
      refetchInvoices()
      refetchStats()
    },
  })

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleGenerateIRN = async (invoiceId: string) => {
    try {
      await generateIRNMutation.mutateAsync({ invoiceId })
    } catch (error) {
      console.error('Error generating IRN:', error)
    }
  }

  const handleCancelIRN = async () => {
    if (!selectedInvoice) return
    
    try {
      await cancelIRNMutation.mutateAsync({
        invoiceId: selectedInvoice,
        reason: cancelReason as any,
        remarks: cancelRemarks,
      })
    } catch (error) {
      console.error('Error cancelling IRN:', error)
    }
  }

  const openCancelDialog = (invoiceId: string) => {
    setSelectedInvoice(invoiceId)
    setCancelDialogOpen(true)
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return <Chip label="Generated" color="success" size="small" icon={<CheckIcon />} />
      case 'CANCELLED':
        return <Chip label="Cancelled" color="error" size="small" icon={<CancelIcon />} />
      case 'FAILED':
        return <Chip label="Failed" color="error" size="small" icon={<ErrorIcon />} />
      case 'PENDING':
        return <Chip label="Pending" color="warning" size="small" icon={<WarningIcon />} />
      default:
        return <Chip label={status} size="small" />
    }
  }

  const canCancelIRN = (einvoice: any): boolean => {
    if (einvoice.status !== 'GENERATED') return false
    if (!einvoice.ackDate) return false
    const hours = differenceInHours(new Date(), new Date(einvoice.ackDate))
    return hours <= 24
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              E-Invoice Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Generate and manage IRNs for GST compliance
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => router.push('/einvoice/configuration')}
            >
              Configuration
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/invoices/new')}
            >
              New Invoice
            </Button>
          </Box>
        </Box>

        {/* Configuration Alert */}
        {!config && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              E-invoice configuration not set up. Please configure your GSP credentials first.
            </Typography>
            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() => router.push('/einvoice/configuration')}
            >
              Configure Now
            </Button>
          </Alert>
        )}

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Generated
                </Typography>
                <Typography variant="h4">
                  {statistics?.totalGenerated || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active IRNs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Cancelled
                </Typography>
                <Typography variant="h4">
                  {statistics?.totalCancelled || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cancelled IRNs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Failed
                </Typography>
                <Typography variant="h4">
                  {statistics?.totalFailed || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Failed attempts
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Pending
                </Typography>
                <Typography variant="h4">
                  {statistics?.totalPending || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Awaiting generation
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="E-Invoices" icon={<ReceiptIcon />} iconPosition="start" />
            <Tab label="Bulk Operations" icon={<AddIcon />} iconPosition="start" />
            <Tab label="E-Way Bills" icon={<QrCodeIcon />} iconPosition="start" />
          </Tabs>
        </Paper>

        {/* E-Invoices Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">E-Invoice Records</Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refetchInvoices()}
            >
              Refresh
            </Button>
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice No</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>IRN</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Generated At</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {einvoicesData?.einvoices.map((einvoice) => (
                  <TableRow key={einvoice.id}>
                    <TableCell>
                      <Typography variant="body2">{einvoice.docNo}</Typography>
                    </TableCell>
                    <TableCell>
                      {format(new Date(einvoice.docDate), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{einvoice.buyerName}</Typography>
                      {einvoice.buyerGstin && (
                        <Typography variant="caption" color="text.secondary">
                          {einvoice.buyerGstin}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {einvoice.irn ? (
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {einvoice.irn.substring(0, 20)}...
                        </Typography>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{getStatusChip(einvoice.status)}</TableCell>
                    <TableCell align="right">
                      ₹{einvoice.totalInvoiceValue.toNumber().toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      {einvoice.ackDate 
                        ? format(new Date(einvoice.ackDate), 'dd MMM yyyy HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {einvoice.status === 'PENDING' && (
                          <IconButton
                            size="small"
                            onClick={() => handleGenerateIRN(einvoice.invoiceId)}
                            disabled={generateIRNMutation.isLoading}
                            title="Generate IRN"
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        )}
                        {einvoice.status === 'GENERATED' && einvoice.qrCodeUrl && (
                          <IconButton
                            size="small"
                            onClick={() => window.open(einvoice.qrCodeUrl!, '_blank')}
                            title="View QR Code"
                          >
                            <QrCodeIcon fontSize="small" />
                          </IconButton>
                        )}
                        {canCancelIRN(einvoice) && (
                          <IconButton
                            size="small"
                            onClick={() => openCancelDialog(einvoice.invoiceId)}
                            title="Cancel IRN"
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/invoices/${einvoice.invoiceId}`)}
                          title="View Invoice"
                        >
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {(!einvoicesData || einvoicesData.einvoices.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No e-invoice records found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={einvoicesData?.total || 0}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </TableContainer>
        </TabPanel>

        {/* Bulk Operations Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6">Bulk IRN Generation</Typography>
            <Typography variant="body2" color="text.secondary">
              Select multiple invoices to generate IRNs in bulk
            </Typography>
          </Box>
          
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" align="center">
              Bulk operations will be available soon
            </Typography>
          </Paper>
        </TabPanel>

        {/* E-Way Bills Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6">E-Way Bills</Typography>
            <Typography variant="body2" color="text.secondary">
              Generate and manage e-way bills for goods transport
            </Typography>
          </Box>
          
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" align="center">
              E-Way bill functionality will be available soon
            </Typography>
          </Paper>
        </TabPanel>

        {/* Cancel IRN Dialog */}
        <Dialog
          open={cancelDialogOpen}
          onClose={() => setCancelDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Cancel IRN</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Cancel Reason</InputLabel>
                <Select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  label="Cancel Reason"
                >
                  {cancelReasons?.map((reason) => (
                    <MenuItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Cancel Remarks"
                value={cancelRemarks}
                onChange={(e) => setCancelRemarks(e.target.value)}
                fullWidth
                multiline
                rows={3}
                helperText="Provide additional details (max 100 characters)"
                inputProps={{ maxLength: 100 }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCancelIRN}
              variant="contained"
              color="error"
              disabled={!cancelRemarks || cancelIRNMutation.isLoading}
            >
              {cancelIRNMutation.isLoading ? 'Cancelling...' : 'Cancel IRN'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  )
}