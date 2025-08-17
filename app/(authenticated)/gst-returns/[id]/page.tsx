'use client'

import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Stack,
  Divider,
  IconButton
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  ArrowBack as ArrowBackIcon,
  FileDownload as FileDownloadIcon,
  CheckCircle as CheckCircleIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material'
import { format } from 'date-fns'
import { enqueueSnackbar } from 'notistack'

export default function GSTReturnDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const returnId = params.id as string
  
  // Fetch return details
  const { data: gstReturn, isLoading, error } = api.gstReturns.getReturn.useQuery({
    id: returnId
  })
  
  // Update filing status mutation
  const updateFilingStatus = api.gstReturns.updateFilingStatus.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Filing status updated successfully', { variant: 'success' })
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to update status: ${error.message}`, { variant: 'error' })
    }
  })
  
  const handleExportJSON = async () => {
    if (!gstReturn) return
    
    try {
      // Export the return to JSON (using the jsonOutput directly)
      
      // Download the JSON file
      const blob = new Blob([JSON.stringify(gstReturn.jsonOutput, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${gstReturn.returnType}_${gstReturn.period}.json`
      link.click()
      
      enqueueSnackbar('JSON exported successfully', { variant: 'success' })
    } catch {
      enqueueSnackbar('Failed to export JSON', { variant: 'error' })
    }
  }
  
  const handleMarkReady = () => {
    updateFilingStatus.mutate({
      id: returnId,
      filingStatus: 'READY'
    })
  }
  
  const handleMarkFiled = () => {
    const arn = prompt('Enter ARN (Acknowledgment Reference Number):')
    if (arn) {
      updateFilingStatus.mutate({
        id: returnId,
        filingStatus: 'FILED',
        arn,
        filingDate: new Date()
      })
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'warning'
      case 'READY':
        return 'info'
      case 'FILED':
        return 'success'
      case 'AMENDED':
        return 'secondary'
      default:
        return 'default'
    }
  }
  
  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0.00'
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(numAmount)
  }
  
  if (isLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    )
  }
  
  if (error || !gstReturn) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          Failed to load GST return: {error?.message || 'Return not found'}
        </Alert>
      </Container>
    )
  }
  
  const isGSTR1 = gstReturn.returnType === 'GSTR1'
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton onClick={() => router.push('/gst-returns')} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" component="h1">
                {gstReturn.returnType} - {gstReturn.period}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isGSTR1 ? 'Outward Supplies Return' : 'Summary Return'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportJSON}
              >
                Export JSON
              </Button>
              {gstReturn.filingStatus === 'DRAFT' && (
                <Button
                  variant="contained"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleMarkReady}
                >
                  Mark as Ready
                </Button>
              )}
              {gstReturn.filingStatus === 'READY' && (
                <Button
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  onClick={handleMarkFiled}
                >
                  Mark as Filed
                </Button>
              )}
            </Stack>
          </Box>
        </Box>
        
        {/* Return Information */}
        <Grid container spacing={3}>
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Return Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Return Type
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {gstReturn.returnType}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Period
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {gstReturn.period}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Financial Year
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {gstReturn.financialYear}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={gstReturn.filingStatus}
                      size="small"
                      color={getStatusColor(gstReturn.filingStatus) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                    />
                  </Grid>
                </Grid>
                
                {gstReturn.filingStatus === 'FILED' && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          Filing Date
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {gstReturn.filingDate ? format(new Date(gstReturn.filingDate), 'dd MMM yyyy') : '-'}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          ARN
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {gstReturn.arn || '-'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* GSTR-1 Summary */}
          {isGSTR1 && (
            <>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Outward Supplies Summary
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>B2B Invoices</TableCell>
                            <TableCell align="right">
                              {gstReturn.b2bInvoices ? 
                                (Array.isArray(gstReturn.b2bInvoices) ? gstReturn.b2bInvoices.length : 0) : 0}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Export Invoices</TableCell>
                            <TableCell align="right">
                              {gstReturn.exportInvoices ? 
                                (Array.isArray(gstReturn.exportInvoices) ? gstReturn.exportInvoices.length : 0) : 0}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Credit Notes</TableCell>
                            <TableCell align="right">
                              {gstReturn.creditNotes ? 
                                (Array.isArray(gstReturn.creditNotes) ? gstReturn.creditNotes.length : 0) : 0}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Debit Notes</TableCell>
                            <TableCell align="right">
                              {gstReturn.debitNotes ? 
                                (Array.isArray(gstReturn.debitNotes) ? gstReturn.debitNotes.length : 0) : 0}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Tax Summary
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>Taxable Supplies</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.outwardTaxable)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Zero Rated (Exports)</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.outwardZeroRated)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Total Outward</TableCell>
                            <TableCell align="right">
                              {formatCurrency(
                                (Number(gstReturn.outwardTaxable || 0) + Number(gstReturn.outwardZeroRated || 0))
                              )}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
          
          {/* GSTR-3B Summary */}
          {!isGSTR1 && (
            <>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Outward Supplies
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>Taxable</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.outwardTaxable)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Zero Rated</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.outwardZeroRated)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Exempted</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.outwardExempted)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Input Tax Credit
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>Import Services</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.itcImportServices)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Inward Supplies</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.itcInwardSupplies)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>ITC Reversed</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.itcReversed)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell><Typography fontWeight="bold">Net ITC</Typography></TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold">{formatCurrency(gstReturn.itcNet)}</Typography>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Tax Liability
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>CGST</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.cgstLiability)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>SGST</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.sgstLiability)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>IGST</TableCell>
                            <TableCell align="right">{formatCurrency(gstReturn.igstLiability)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell><Typography fontWeight="bold">Total Payable</Typography></TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold">{formatCurrency(gstReturn.totalTaxLiability)}</Typography>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
          
          {/* Audit Trail */}
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Audit Trail
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Prepared By</TableCell>
                        <TableCell>{gstReturn.preparedBy || '-'}</TableCell>
                        <TableCell>Prepared At</TableCell>
                        <TableCell>
                          {gstReturn.preparedAt ? format(new Date(gstReturn.preparedAt), 'dd MMM yyyy HH:mm') : '-'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Reviewed By</TableCell>
                        <TableCell>{gstReturn.reviewedBy || '-'}</TableCell>
                        <TableCell>Reviewed At</TableCell>
                        <TableCell>
                          {gstReturn.reviewedAt ? format(new Date(gstReturn.reviewedAt), 'dd MMM yyyy HH:mm') : '-'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Approved By</TableCell>
                        <TableCell>{gstReturn.approvedBy || '-'}</TableCell>
                        <TableCell>Approved At</TableCell>
                        <TableCell>
                          {gstReturn.approvedAt ? format(new Date(gstReturn.approvedAt), 'dd MMM yyyy HH:mm') : '-'}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  )
}