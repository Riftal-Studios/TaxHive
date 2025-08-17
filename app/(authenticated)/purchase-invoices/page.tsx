'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { api } from '@/lib/trpc/client'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Stack,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Receipt as ReceiptIcon,
  Business as BusinessIcon,
  Assessment as AssessmentIcon,
  AccountBalance as AccountBalanceIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Sync as SyncIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { enqueueSnackbar } from 'notistack'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`purchase-tabpanel-${index}`}
      aria-labelledby={`purchase-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function PurchaseInvoicesPage() {
  const router = useRouter()
  const utils = api.useUtils()
  const [tabValue, setTabValue] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [filterVendor, setFilterVendor] = useState('')
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [filterMatchStatus, setFilterMatchStatus] = useState('')
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false)
  
  // Fetch purchase invoices
  const { data: invoices, isLoading: invoicesLoading } = api.purchaseInvoices.getPurchaseInvoices.useQuery({
    vendorId: filterVendor || undefined,
    month: filterMonth || undefined,
    matchStatus: filterMatchStatus as 'MATCHED' | 'MISMATCHED' | 'NOT_AVAILABLE' || undefined,
  })
  
  // Fetch vendors
  const { data: vendors, isLoading: vendorsLoading } = api.purchaseInvoices.getVendors.useQuery()
  
  // Fetch ITC register for the month
  const { data: itcRegister } = api.purchaseInvoices.getITCRegister.useQuery({
    period: filterMonth,
  })
  
  // Fetch monthly ITC summary
  const { data: itcSummary } = api.purchaseInvoices.getMonthlyITCSummary.useQuery({
    month: filterMonth,
  })
  
  // Check Rule 36(4) compliance
  const { data: rule36Status } = api.purchaseInvoices.checkRule36_4.useQuery({
    month: filterMonth,
  })
  
  // Delete invoice mutation
  const deleteInvoiceMutation = api.purchaseInvoices.delete.useMutation({
    onSuccess: () => {
      utils.purchaseInvoices.getPurchaseInvoices.invalidate()
      utils.purchaseInvoices.getITCRegister.invalidate()
      utils.purchaseInvoices.getMonthlyITCSummary.invalidate()
      enqueueSnackbar('Invoice deleted successfully', { variant: 'success' })
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to delete invoice: ${error.message}`, { variant: 'error' })
    },
  })
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, invoiceId: string) => {
    setAnchorEl(event.currentTarget)
    setSelectedInvoiceId(invoiceId)
  }
  
  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedInvoiceId(null)
  }
  
  const handleViewInvoice = () => {
    if (selectedInvoiceId) {
      router.push(`/purchase-invoices/${selectedInvoiceId}`)
    }
    handleMenuClose()
  }
  
  const handleDeleteInvoice = () => {
    if (selectedInvoiceId && confirm('Are you sure you want to delete this invoice? This will also reverse the ITC claimed.')) {
      deleteInvoiceMutation.mutate(selectedInvoiceId)
    }
    handleMenuClose()
  }
  
  const handleReconcile = () => {
    setReconcileDialogOpen(true)
    handleMenuClose()
  }
  
  const getITCCategoryColor = (category: string) => {
    switch (category) {
      case 'INPUTS':
        return 'success'
      case 'CAPITAL_GOODS':
        return 'info'
      case 'INPUT_SERVICES':
        return 'primary'
      case 'BLOCKED':
        return 'error'
      default:
        return 'default'
    }
  }
  
  const getMatchStatusIcon = (status: string) => {
    switch (status) {
      case 'MATCHED':
        return <CheckCircleIcon fontSize="small" color="success" />
      case 'MISMATCHED':
        return <WarningIcon fontSize="small" color="warning" />
      case 'NOT_AVAILABLE':
        return <InfoIcon fontSize="small" color="info" />
      default:
        return null
    }
  }
  
  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(numAmount)
  }
  
  const isLoading = invoicesLoading || vendorsLoading
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Purchase Invoices & ITC Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage purchase invoices and track Input Tax Credit
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={NextLink}
            href="/purchase-invoices/new"
          >
            New Purchase Invoice
          </Button>
        </Box>
        
        {/* ITC Summary Cards */}
        {itcSummary && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AccountBalanceIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography color="text.secondary" variant="body2">
                      Opening Balance
                    </Typography>
                  </Box>
                  <Typography variant="h5">
                    {formatCurrency(itcSummary.openingBalance)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ReceiptIcon sx={{ mr: 2, color: 'success.main' }} />
                    <Typography color="text.secondary" variant="body2">
                      Eligible ITC
                    </Typography>
                  </Box>
                  <Typography variant="h5">
                    {formatCurrency(itcSummary.eligibleITC)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {invoices?.filter(i => i.itcEligible).length || 0} invoices
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <WarningIcon sx={{ mr: 2, color: 'warning.main' }} />
                    <Typography color="text.secondary" variant="body2">
                      Blocked ITC
                    </Typography>
                  </Box>
                  <Typography variant="h5">
                    {formatCurrency(itcSummary.blockedITC)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Section 17(5)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AssessmentIcon sx={{ mr: 2, color: 'info.main' }} />
                    <Typography color="text.secondary" variant="body2">
                      Closing Balance
                    </Typography>
                  </Box>
                  <Typography variant="h5">
                    {formatCurrency(itcSummary.closingBalance)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
        
        {/* Rule 36(4) Compliance Alert */}
        {rule36Status && !rule36Status.isCompliant && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Rule 36(4) Non-Compliance Alert</strong>
            </Typography>
            <Typography variant="body2">
              ITC claimed from unmatched invoices ({formatCurrency(rule36Status.unmatchedITC)}) 
              exceeds the allowed limit of 5% ({formatCurrency(rule36Status.allowedUnmatchedITC)}).
              Excess ITC of {formatCurrency(rule36Status.excessITC)} needs to be reversed.
            </Typography>
          </Alert>
        )}
        
        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label="Purchase Invoices" icon={<ReceiptIcon />} iconPosition="start" />
            <Tab label="Vendors" icon={<BusinessIcon />} iconPosition="start" />
            <Tab label="ITC Register" icon={<AssessmentIcon />} iconPosition="start" />
          </Tabs>
        </Paper>
        
        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Vendor</InputLabel>
                <Select
                  value={filterVendor}
                  onChange={(e) => setFilterVendor(e.target.value)}
                  label="Filter by Vendor"
                >
                  <MenuItem value="">All Vendors</MenuItem>
                  {vendors?.map((vendor) => (
                    <MenuItem key={vendor.id} value={vendor.id}>
                      {vendor.name} {vendor.gstin && `(${vendor.gstin})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                type="month"
                label="Month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>GSTR-2A Status</InputLabel>
                <Select
                  value={filterMatchStatus}
                  onChange={(e) => setFilterMatchStatus(e.target.value)}
                  label="GSTR-2A Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="MATCHED">Matched</MenuItem>
                  <MenuItem value="MISMATCHED">Mismatched</MenuItem>
                  <MenuItem value="NOT_AVAILABLE">Not Available</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
        
        {/* Purchase Invoices Tab */}
        <TabPanel value={tabValue} index={0}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice No.</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell align="right">Taxable</TableCell>
                    <TableCell align="right">GST</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>ITC Category</TableCell>
                    <TableCell align="right">ITC Claimed</TableCell>
                    <TableCell>GSTR-2A</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices && invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {invoice.invoiceNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {invoice.vendor.name}
                          </Typography>
                          {invoice.vendor.gstin && (
                            <Typography variant="caption" color="text.secondary">
                              {invoice.vendor.gstin}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(invoice.taxableAmount)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(invoice.totalGSTAmount)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(invoice.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={invoice.itcCategory}
                            size="small"
                            color={getITCCategoryColor(invoice.itcCategory) as 'success' | 'info' | 'primary' | 'error' | 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {invoice.itcEligible ? (
                            <Typography color="success.main">
                              {formatCurrency(invoice.itcClaimed)}
                            </Typography>
                          ) : (
                            <Typography color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {getMatchStatusIcon(invoice.matchStatus)}
                            <Typography variant="caption">
                              {invoice.matchStatus.replace('_', ' ')}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, invoice.id)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No purchase invoices found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
        
        {/* Vendors Tab */}
        <TabPanel value={tabValue} index={1}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Vendor Name</TableCell>
                  <TableCell>GSTIN/PAN</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell align="right">Total Purchases</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vendors && vendors.length > 0 ? (
                  vendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {vendor.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {vendor.gstin || vendor.pan || '—'}
                      </TableCell>
                      <TableCell>{vendor.stateCode}</TableCell>
                      <TableCell>
                        {vendor.email && (
                          <Typography variant="caption" display="block">
                            {vendor.email}
                          </Typography>
                        )}
                        {vendor.phone && (
                          <Typography variant="caption" display="block">
                            {vendor.phone}
                          </Typography>
                        )}
                        {!vendor.email && !vendor.phone && '—'}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(0)} {/* TODO: Calculate from purchases */}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={vendor.isRegistered ? 'Registered' : 'Unregistered'}
                          size="small"
                          color={vendor.isRegistered ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No vendors found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
        
        {/* ITC Register Tab */}
        <TabPanel value={tabValue} index={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ITC Register for {format(new Date(filterMonth + '-01'), 'MMMM yyyy')}
              </Typography>
              
              {itcRegister && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography color="text.secondary">Opening Balance:</Typography>
                        <Typography fontWeight="medium">
                          {formatCurrency(itcRegister.openingBalance)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography color="text.secondary">Eligible ITC:</Typography>
                        <Typography fontWeight="medium">
                          {formatCurrency(itcRegister.eligibleITC)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography color="text.secondary">ITC Claimed:</Typography>
                        <Typography fontWeight="medium">
                          {formatCurrency(itcRegister.claimedITC)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography color="text.secondary">ITC Reversed:</Typography>
                        <Typography fontWeight="medium">
                          {formatCurrency(itcRegister.reversedITC)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography color="text.secondary">Blocked ITC:</Typography>
                        <Typography fontWeight="medium">
                          {formatCurrency(itcRegister.blockedITC)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography color="text.secondary" fontWeight="bold">
                          Closing Balance:
                        </Typography>
                        <Typography fontWeight="bold">
                          {formatCurrency(itcRegister.closingBalance)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Category-wise Breakup
                    </Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Inputs:
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(itcRegister.inputsITC)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Capital Goods:
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(itcRegister.capitalGoodsITC)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Input Services:
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(itcRegister.inputServicesITC)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </TabPanel>
        
        {/* Actions Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleViewInvoice}>
            <VisibilityIcon sx={{ mr: 1, fontSize: 20 }} />
            View Details
          </MenuItem>
          <MenuItem onClick={handleReconcile}>
            <SyncIcon sx={{ mr: 1, fontSize: 20 }} />
            Reconcile with GSTR-2A
          </MenuItem>
          <MenuItem onClick={handleDeleteInvoice}>
            <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
            Delete Invoice
          </MenuItem>
        </Menu>
        
        {/* Reconciliation Dialog */}
        <Dialog open={reconcileDialogOpen} onClose={() => setReconcileDialogOpen(false)}>
          <DialogTitle>GSTR-2A Reconciliation</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                This feature will match your purchase invoices with GSTR-2A data from the GST portal.
                Upload your GSTR-2A JSON file or enter the details manually.
              </Typography>
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReconcileDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled>
              Upload GSTR-2A
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  )
}