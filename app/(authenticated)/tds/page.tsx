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
} from '@mui/material'
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Description as DescriptionIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { getCurrentFinancialYear, getCurrentQuarter } from '@/lib/tds/constants'

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

export default function TDSPage() {
  const router = useRouter()
  const [tabValue, setTabValue] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const currentFY = getCurrentFinancialYear()
  const currentQ = getCurrentQuarter()

  const { data: configuration } = api.tds.getConfiguration.useQuery()
  const { data: deductionsData } = api.tds.getDeductions.useQuery({
    financialYear: currentFY,
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  })
  const { data: returns } = api.tds.getReturns.useQuery({
    financialYear: currentFY,
  })

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Chip label="Pending" color="warning" size="small" icon={<WarningIcon />} />
      case 'DEPOSITED':
        return <Chip label="Deposited" color="success" size="small" icon={<CheckIcon />} />
      case 'LATE':
        return <Chip label="Late" color="error" size="small" />
      default:
        return <Chip label={status} size="small" />
    }
  }

  // Calculate summary statistics
  const pendingDeductions = deductionsData?.deductions.filter(d => d.depositStatus === 'PENDING').length || 0
  const totalPendingAmount = deductionsData?.deductions
    .filter(d => d.depositStatus === 'PENDING')
    .reduce((sum, d) => sum + d.totalTDS.toNumber(), 0) || 0
  const depositsThisQuarter = deductionsData?.deductions
    .filter(d => d.depositStatus === 'DEPOSITED' && d.quarter === currentQ)
    .reduce((sum, d) => sum + d.totalTDS.toNumber(), 0) || 0

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              TDS Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage Tax Deducted at Source for {currentFY}, Quarter {currentQ}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => router.push('/tds/configuration')}
            >
              Configuration
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/purchase-invoices/new')}
            >
              New Purchase Invoice
            </Button>
          </Box>
        </Box>

        {/* Configuration Alert */}
        {!configuration && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              TDS configuration not set up. Please configure your TAN and deductor details first.
            </Typography>
            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() => router.push('/tds/configuration')}
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
                  Pending Deposits
                </Typography>
                <Typography variant="h4">
                  {pendingDeductions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ₹{totalPendingAmount.toLocaleString('en-IN')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  This Quarter
                </Typography>
                <Typography variant="h4">
                  ₹{depositsThisQuarter.toLocaleString('en-IN')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {currentQ} deposits
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Certificates Issued
                </Typography>
                <Typography variant="h4">
                  0
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Form 16A
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Returns Filed
                </Typography>
                <Typography variant="h4">
                  {returns?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {currentFY}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Deductions" icon={<ReceiptIcon />} iconPosition="start" />
            <Tab label="Payments" icon={<PaymentIcon />} iconPosition="start" />
            <Tab label="Certificates" icon={<DescriptionIcon />} iconPosition="start" />
            <Tab label="Returns" icon={<AssessmentIcon />} iconPosition="start" />
          </Tabs>
        </Paper>

        {/* Deductions Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">TDS Deductions</Typography>
            <Button
              variant="outlined"
              startIcon={<PaymentIcon />}
              onClick={() => router.push('/tds/payment')}
              disabled={pendingDeductions === 0}
            >
              Make Payment
            </Button>
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell align="right">Taxable Amount</TableCell>
                  <TableCell align="right">TDS Rate</TableCell>
                  <TableCell align="right">TDS Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deductionsData?.deductions.map((deduction) => (
                  <TableRow key={deduction.id}>
                    <TableCell>
                      {format(new Date(deduction.deductionDate), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{deduction.vendorName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {deduction.vendorPAN}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{deduction.section.sectionCode}</TableCell>
                    <TableCell align="right">
                      ₹{deduction.taxableAmount.toNumber().toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell align="right">{deduction.tdsRate.toNumber()}%</TableCell>
                    <TableCell align="right">
                      ₹{deduction.totalTDS.toNumber().toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>{getStatusChip(deduction.depositStatus)}</TableCell>
                    <TableCell>
                      {format(new Date(deduction.depositDueDate), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {deduction.purchaseInvoice && (
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/purchase-invoices/${deduction.purchaseInvoice.id}`)}
                            title="View Invoice"
                          >
                            <ReceiptIcon fontSize="small" />
                          </IconButton>
                        )}
                        {deduction.certificate && (
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/tds/certificates/${deduction.certificate.id}`)}
                            title="View Certificate"
                          >
                            <DescriptionIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {(!deductionsData || deductionsData.deductions.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No TDS deductions found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={deductionsData?.total || 0}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </TableContainer>
        </TabPanel>

        {/* Payments Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">TDS Payments</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => router.push('/tds/payment')}
            >
              New Payment
            </Button>
          </Box>
          
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" align="center">
              TDS payment records will appear here
            </Typography>
          </Paper>
        </TabPanel>

        {/* Certificates Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Form 16A Certificates</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => router.push('/tds/certificates/generate')}
            >
              Generate Certificates
            </Button>
          </Box>
          
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" align="center">
              Form 16A certificates will appear here
            </Typography>
          </Paper>
        </TabPanel>

        {/* Returns Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">TDS Returns</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => router.push('/tds/returns/prepare')}
            >
              Prepare Return
            </Button>
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Return Type</TableCell>
                  <TableCell>Financial Year</TableCell>
                  <TableCell>Quarter</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Total TDS</TableCell>
                  <TableCell>Filing Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {returns?.map((tdsReturn) => (
                  <TableRow key={tdsReturn.id}>
                    <TableCell>{tdsReturn.returnType}</TableCell>
                    <TableCell>{tdsReturn.financialYear}</TableCell>
                    <TableCell>{tdsReturn.quarter}</TableCell>
                    <TableCell>{getStatusChip(tdsReturn.filingStatus)}</TableCell>
                    <TableCell>₹{tdsReturn.totalTDS.toNumber().toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      {tdsReturn.filingDate 
                        ? format(new Date(tdsReturn.filingDate), 'dd MMM yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/tds/returns/${tdsReturn.id}`)}
                      >
                        <DescriptionIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {(!returns || returns.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No TDS returns found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Box>
    </Container>
  )
}