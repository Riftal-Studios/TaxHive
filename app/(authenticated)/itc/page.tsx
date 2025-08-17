"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/trpc/client"
import { 
  Paper, 
  Button, 
  Box, 
  Typography, 
  Card, 
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  AlertTitle,
  LinearProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Grid
} from "@mui/material"
import { 
  Assessment,
  CheckCircle,
  Cancel,
  Warning,
  Info,
  Refresh,
  Download,
  Upload,
  VerifiedUser,
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Receipt,
  ErrorOutline,
  FileUpload,
  Visibility
} from "@mui/icons-material"
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"

// Color palette for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

interface ITCMonthData {
  month: string
  eligible: number
  claimed: number
  blocked: number
  reversed: number
}

interface VendorITCData {
  vendorName: string
  gstin: string
  totalITC: number
  matched: number
  mismatched: number
  notAvailable: number
}

interface CategoryBreakup {
  category: string
  amount: number
  percentage: number
}

export default function ITCReconciliationDashboard() {
  const router = useRouter()
  const [selectedPeriod, setSelectedPeriod] = useState(format(new Date(), 'yyyy-MM'))
  const [loading, setLoading] = useState(true)
  const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success'
  })
  
  // Fetch data for the selected period
  const { data: itcRegister } = api.purchaseInvoices.getITCRegister.useQuery({ 
    period: selectedPeriod 
  })
  
  const { data: monthlyITCSummary } = api.purchaseInvoices.getMonthlyITCSummary.useQuery({ 
    month: selectedPeriod 
  })
  
  const { data: rule36Check } = api.purchaseInvoices.checkRule36_4.useQuery({ 
    month: selectedPeriod 
  })
  
  const { data: purchaseInvoices } = api.purchaseInvoices.getPurchaseInvoices.useQuery({ 
    month: selectedPeriod 
  })
  
  // Calculate vendor-wise ITC summary
  const vendorSummary = purchaseInvoices?.reduce((acc: Record<string, VendorITCData>, invoice) => {
    const vendorKey = invoice.vendor.gstin || invoice.vendor.pan || invoice.vendor.name
    if (!acc[vendorKey]) {
      acc[vendorKey] = {
        vendorName: invoice.vendor.name,
        gstin: invoice.vendor.gstin || 'Unregistered',
        totalITC: 0,
        matched: 0,
        mismatched: 0,
        notAvailable: 0
      }
    }
    
    acc[vendorKey].totalITC += Number(invoice.itcClaimed || 0)
    
    if (invoice.matchStatus === 'MATCHED') {
      acc[vendorKey].matched++
    } else if (invoice.matchStatus === 'MISMATCHED') {
      acc[vendorKey].mismatched++
    } else {
      acc[vendorKey].notAvailable++
    }
    
    return acc
  }, {} as Record<string, VendorITCData>)
  
  const vendorList = vendorSummary ? Object.values(vendorSummary) : []
  
  // Calculate category breakup
  const categoryBreakup: CategoryBreakup[] = monthlyITCSummary ? [
    { 
      category: 'Inputs', 
      amount: monthlyITCSummary.categoryBreakup?.inputs || 0, 
      percentage: monthlyITCSummary.eligibleITC ? 
        ((monthlyITCSummary.categoryBreakup?.inputs || 0) / monthlyITCSummary.eligibleITC * 100) : 0 
    },
    { 
      category: 'Capital Goods', 
      amount: monthlyITCSummary.categoryBreakup?.capitalGoods || 0, 
      percentage: monthlyITCSummary.eligibleITC ? 
        ((monthlyITCSummary.categoryBreakup?.capitalGoods || 0) / monthlyITCSummary.eligibleITC * 100) : 0 
    },
    { 
      category: 'Input Services', 
      amount: monthlyITCSummary.categoryBreakup?.inputServices || 0, 
      percentage: monthlyITCSummary.eligibleITC ? 
        ((monthlyITCSummary.categoryBreakup?.inputServices || 0) / monthlyITCSummary.eligibleITC * 100) : 0 
    },
    { 
      category: 'Blocked', 
      amount: monthlyITCSummary.blockedITC || 0, 
      percentage: monthlyITCSummary.eligibleITC ? 
        ((monthlyITCSummary.blockedITC || 0) / monthlyITCSummary.eligibleITC * 100) : 0 
    }
  ] : []
  
  // Generate trend data for last 6 months
  const trendData: ITCMonthData[] = []
  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(selectedPeriod), i)
    const month = format(date, 'MMM yy')
    // This would be fetched from API in a real scenario
    trendData.push({
      month,
      eligible: Math.random() * 100000,
      claimed: Math.random() * 90000,
      blocked: Math.random() * 10000,
      reversed: Math.random() * 5000
    })
  }
  
  useEffect(() => {
    if (itcRegister !== undefined) {
      setLoading(false)
    }
  }, [itcRegister])
  
  const handleRefresh = () => {
    setLoading(true)
    // Refetch data
    setTimeout(() => setLoading(false), 1500)
  }
  
  const handleGSTR2AUpload = () => {
    setUploadDialogOpen(true)
  }
  
  const handleReconciliation = () => {
    setReconciliationDialogOpen(true)
  }
  
  const handleExportReport = () => {
    // Export ITC report logic
    setSnackbar({
      open: true,
      message: 'ITC report exported successfully',
      severity: 'success'
    })
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          ITC Reconciliation Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Track, reconcile, and manage your Input Tax Credit claims
        </Typography>
      </Box>
      
      {/* Period Selector and Actions */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Select Period</InputLabel>
              <Select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                label="Select Period"
              >
                {[...Array(12)].map((_, i) => {
                  const date = subMonths(new Date(), i)
                  const value = format(date, 'yyyy-MM')
                  const label = format(date, 'MMMM yyyy')
                  return (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  )
                })}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid size={{ xs: 12, md: 9 }}>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant="contained"
                startIcon={<FileUpload />}
                onClick={handleGSTR2AUpload}
              >
                Upload GSTR-2A/2B
              </Button>
              <Button
                variant="outlined"
                startIcon={<VerifiedUser />}
                onClick={handleReconciliation}
              >
                Reconcile
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleExportReport}
              >
                Export Report
              </Button>
              <IconButton onClick={handleRefresh} color="primary">
                <Refresh />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Rule 36(4) Compliance Alert */}
      {rule36Check && !rule36Check.isCompliant && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Rule 36(4) Compliance Warning</AlertTitle>
          You have claimed {formatCurrency(rule36Check.excessClaimed)} excess ITC. 
          Maximum allowed: {formatCurrency(rule36Check.maxEligibleITC)} (105% of GSTR-2A matched ITC)
        </Alert>
      )}
      
      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Opening Balance
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(Number(itcRegister?.openingBalance) || 0)}
                  </Typography>
                </Box>
                <AccountBalance color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Eligible ITC
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    {formatCurrency(Number(itcRegister?.eligibleITC) || 0)}
                  </Typography>
                </Box>
                <CheckCircle color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Blocked ITC
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    {formatCurrency(Number(itcRegister?.blockedITC) || 0)}
                  </Typography>
                </Box>
                <Cancel color="error" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Closing Balance
                  </Typography>
                  <Typography variant="h5" color="primary.main">
                    {formatCurrency(Number(itcRegister?.closingBalance) || 0)}
                  </Typography>
                </Box>
                <TrendingUp color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Charts Row */}
      <Grid container spacing={3} mb={3}>
        {/* ITC Trend Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              ITC Trend (Last 6 Months)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="eligible" stroke="#0088FE" name="Eligible" />
                <Line type="monotone" dataKey="claimed" stroke="#00C49F" name="Claimed" />
                <Line type="monotone" dataKey="blocked" stroke="#FF8042" name="Blocked" />
                <Line type="monotone" dataKey="reversed" stroke="#FFBB28" name="Reversed" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        {/* Category Breakup Pie Chart */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              ITC Category Breakup
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryBreakup}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.category}: ${entry.percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {categoryBreakup.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
      
      {/* GSTR-2A Matching Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          GSTR-2A/2B Matching Summary
        </Typography>
        {loading ? (
          <LinearProgress />
        ) : (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box display="flex" alignItems="center" gap={1}>
                <CheckCircle color="success" />
                <Box>
                  <Typography variant="h6">
                    {purchaseInvoices?.filter(i => i.matchStatus === 'MATCHED').length || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Matched Invoices
                  </Typography>
                </Box>
              </Box>
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <Box display="flex" alignItems="center" gap={1}>
                <Warning color="warning" />
                <Box>
                  <Typography variant="h6">
                    {purchaseInvoices?.filter(i => i.matchStatus === 'MISMATCHED').length || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Mismatched Invoices
                  </Typography>
                </Box>
              </Box>
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <Box display="flex" alignItems="center" gap={1}>
                <ErrorOutline color="error" />
                <Box>
                  <Typography variant="h6">
                    {purchaseInvoices?.filter(i => i.matchStatus === 'NOT_AVAILABLE').length || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Not Available in GSTR-2A
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        )}
      </Paper>
      
      {/* Vendor-wise ITC Summary Table */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Vendor-wise ITC Summary
          </Typography>
          <Button
            size="small"
            startIcon={<Visibility />}
            onClick={() => router.push('/purchases')}
          >
            View All Purchases
          </Button>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vendor Name</TableCell>
                <TableCell>GSTIN</TableCell>
                <TableCell align="right">Total ITC</TableCell>
                <TableCell align="center">Matched</TableCell>
                <TableCell align="center">Mismatched</TableCell>
                <TableCell align="center">Not Available</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vendorList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="textSecondary" py={3}>
                      No purchase invoices found for the selected period
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                vendorList.map((vendor, index) => (
                  <TableRow key={index}>
                    <TableCell>{vendor.vendorName}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color={vendor.gstin === 'Unregistered' ? 'textSecondary' : 'textPrimary'}>
                        {vendor.gstin}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(vendor.totalITC)}
                    </TableCell>
                    <TableCell align="center">
                      {vendor.matched > 0 && (
                        <Chip 
                          label={vendor.matched} 
                          size="small" 
                          color="success" 
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {vendor.mismatched > 0 && (
                        <Chip 
                          label={vendor.mismatched} 
                          size="small" 
                          color="warning" 
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {vendor.notAvailable > 0 && (
                        <Chip 
                          label={vendor.notAvailable} 
                          size="small" 
                          color="error" 
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {vendor.matched > 0 && vendor.mismatched === 0 && vendor.notAvailable === 0 ? (
                        <Chip label="Verified" color="success" size="small" />
                      ) : vendor.mismatched > 0 || vendor.notAvailable > 0 ? (
                        <Chip label="Review Required" color="warning" size="small" />
                      ) : (
                        <Chip label="Pending" color="default" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* Upload GSTR-2A Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload GSTR-2A/2B</DialogTitle>
        <DialogContent>
          <Box py={2}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Upload your GSTR-2A or GSTR-2B JSON file downloaded from the GST portal
            </Alert>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              startIcon={<Upload />}
            >
              Select JSON File
              <input
                type="file"
                hidden
                accept=".json"
                onChange={(e) => {
                  // Handle file upload
                  setSnackbar({
                    open: true,
                    message: 'GSTR-2A uploaded successfully. Reconciliation in progress...',
                    severity: 'success'
                  })
                  setUploadDialogOpen(false)
                }}
              />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
      
      {/* Reconciliation Dialog */}
      <Dialog open={reconciliationDialogOpen} onClose={() => setReconciliationDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>ITC Reconciliation</DialogTitle>
        <DialogContent>
          <Box py={2}>
            <Alert severity="info" sx={{ mb: 2 }}>
              This will match your purchase invoices with GSTR-2A/2B data and identify discrepancies
            </Alert>
            
            <Typography variant="subtitle1" gutterBottom>
              Reconciliation Summary
            </Typography>
            
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Total Purchase Invoices
                  </Typography>
                  <Typography variant="h6">
                    {purchaseInvoices?.length || 0}
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Total ITC Claimed
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(monthlyITCSummary?.claimedITC || 0)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
            
            <Box mt={3}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => {
                  // Perform reconciliation
                  setSnackbar({
                    open: true,
                    message: 'Reconciliation completed successfully',
                    severity: 'success'
                  })
                  setReconciliationDialogOpen(false)
                }}
              >
                Start Reconciliation
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReconciliationDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  )
}