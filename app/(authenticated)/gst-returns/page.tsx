'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import {
  Box,
  Button,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Tabs,
  Tab
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  FileDownload as FileDownloadIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  Receipt as ReceiptIcon,
  CloudUpload as CloudUploadIcon,
  Calculate as CalculateIcon,
  FileCopy as FileCopyIcon
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
      id={`gst-tabpanel-${index}`}
      aria-labelledby={`gst-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function GSTReturnsPage() {
  const router = useRouter()
  const utils = api.useUtils()
  const [tabValue, setTabValue] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null)
  const [filterFY, setFilterFY] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [generateType, setGenerateType] = useState<'GSTR1' | 'GSTR3B'>('GSTR1')
  const [generatePeriod, setGeneratePeriod] = useState('')
  
  // Fetch GST returns
  const { data: returns, isLoading, error } = api.gstReturns.list.useQuery({
    returnType: tabValue === 0 ? 'GSTR1' : 'GSTR3B',
    financialYear: filterFY || undefined,
    filingStatus: filterStatus || undefined
  })
  
  // Generate GSTR-1 mutation
  const generateGSTR1 = api.gstReturns.generateGSTR1.useMutation({
    onSuccess: (result) => {
      utils.gstReturns.list.invalidate()
      enqueueSnackbar(`GSTR-1 generated successfully for ${result.period}`, { variant: 'success' })
      setGenerateDialogOpen(false)
      router.push(`/gst-returns/${result.id}`)
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to generate GSTR-1: ${error.message}`, { variant: 'error' })
    }
  })
  
  // Generate GSTR-3B mutation
  const generateGSTR3B = api.gstReturns.generateGSTR3B.useMutation({
    onSuccess: (result) => {
      utils.gstReturns.list.invalidate()
      enqueueSnackbar(`GSTR-3B generated successfully for ${result.period}`, { variant: 'success' })
      setGenerateDialogOpen(false)
      router.push(`/gst-returns/${result.id}`)
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to generate GSTR-3B: ${error.message}`, { variant: 'error' })
    }
  })
  
  // Update filing status mutation
  const updateFilingStatus = api.gstReturns.updateFilingStatus.useMutation({
    onSuccess: () => {
      utils.gstReturns.list.invalidate()
      enqueueSnackbar('Filing status updated successfully', { variant: 'success' })
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to update status: ${error.message}`, { variant: 'error' })
    }
  })
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, returnId: string) => {
    setAnchorEl(event.currentTarget)
    setSelectedReturnId(returnId)
  }
  
  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedReturnId(null)
  }
  
  const handleViewReturn = () => {
    if (selectedReturnId) {
      router.push(`/gst-returns/${selectedReturnId}`)
    }
    handleMenuClose()
  }
  
  const handleExportJSON = async () => {
    if (!selectedReturnId) return
    
    const selectedReturn = returns?.find((r: any) => r.id === selectedReturnId)
    if (!selectedReturn) return
    
    // For now, just navigate to the details page where export can be done
    router.push(`/gst-returns/${selectedReturnId}`)
    enqueueSnackbar('Navigate to details page to export JSON', { variant: 'info' })
    
    handleMenuClose()
  }
  
  const handleMarkReady = () => {
    if (selectedReturnId) {
      updateFilingStatus.mutate({
        id: selectedReturnId,
        filingStatus: 'READY'
      })
    }
    handleMenuClose()
  }
  
  const handleMarkFiled = () => {
    if (selectedReturnId) {
      const arn = prompt('Enter ARN (Acknowledgment Reference Number):')
      if (arn) {
        updateFilingStatus.mutate({
          id: selectedReturnId,
          filingStatus: 'FILED',
          arn,
          filingDate: new Date()
        })
      }
    }
    handleMenuClose()
  }
  
  const handleGenerate = () => {
    if (!generatePeriod || !generatePeriod.match(/^\d{2}-\d{4}$/)) {
      enqueueSnackbar('Please enter period in MM-YYYY format', { variant: 'error' })
      return
    }
    
    if (generateType === 'GSTR1') {
      generateGSTR1.mutate({ period: generatePeriod })
    } else {
      generateGSTR3B.mutate({ period: generatePeriod })
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
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <ScheduleIcon fontSize="small" />
      case 'READY':
        return <CheckCircleIcon fontSize="small" />
      case 'FILED':
        return <CloudUploadIcon fontSize="small" />
      case 'AMENDED':
        return <FileCopyIcon fontSize="small" />
      default:
        return null
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
  
  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          Failed to load GST returns: {error.message}
        </Alert>
      </Container>
    )
  }
  
  const currentFY = new Date().getFullYear() + (new Date().getMonth() >= 3 ? 1 : 0)
  const financialYears = Array.from({ length: 3 }, (_, i) => {
    const year = currentFY - i
    return `FY${(year - 1).toString().slice(2)}-${year.toString().slice(2)}`
  })
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              GST Returns
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage and file your GST returns
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setGenerateDialogOpen(true)}
          >
            Generate Return
          </Button>
        </Box>
        
        {/* Return Type Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab 
              label="GSTR-1 (Outward Supplies)" 
              icon={<ReceiptIcon />}
              iconPosition="start"
            />
            <Tab 
              label="GSTR-3B (Summary Return)" 
              icon={<AssessmentIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Paper>
        
        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Financial Year</InputLabel>
                <Select
                  value={filterFY}
                  onChange={(e) => setFilterFY(e.target.value)}
                  label="Financial Year"
                >
                  <MenuItem value="">All Years</MenuItem>
                  {financialYears.map((fy) => (
                    <MenuItem key={fy} value={fy}>{fy}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Filing Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Filing Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="READY">Ready to File</MenuItem>
                  <MenuItem value="FILED">Filed</MenuItem>
                  <MenuItem value="AMENDED">Amended</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
        
        {/* Returns Table */}
        <TabPanel value={tabValue} index={0}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell>Financial Year</TableCell>
                  <TableCell align="right">Outward Taxable</TableCell>
                  <TableCell align="right">Zero Rated</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Filing Date</TableCell>
                  <TableCell>ARN</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {returns && returns.length > 0 ? (
                  returns.map((ret: any) => (
                    <TableRow key={ret.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {ret.period}
                        </Typography>
                      </TableCell>
                      <TableCell>{ret.financialYear}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(ret.outwardTaxable)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(ret.outwardZeroRated)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(ret.filingStatus)}
                          label={ret.filingStatus}
                          size="small"
                          color={getStatusColor(ret.filingStatus) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                        />
                      </TableCell>
                      <TableCell>
                        {ret.filingDate ? format(new Date(ret.filingDate), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {ret.arn || '-'}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, ret.id)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No GSTR-1 returns found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell>Financial Year</TableCell>
                  <TableCell align="right">Tax Liability</TableCell>
                  <TableCell align="right">ITC Available</TableCell>
                  <TableCell align="right">Net Payable</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Filing Date</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {returns && returns.length > 0 ? (
                  returns.map((ret: any) => (
                    <TableRow key={ret.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {ret.period}
                        </Typography>
                      </TableCell>
                      <TableCell>{ret.financialYear}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(ret.totalTaxLiability)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(ret.itcNet)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency((Number(ret.totalTaxLiability || 0) - Number(ret.itcNet || 0)))}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(ret.filingStatus)}
                          label={ret.filingStatus}
                          size="small"
                          color={getStatusColor(ret.filingStatus) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                        />
                      </TableCell>
                      <TableCell>
                        {ret.filingDate ? format(new Date(ret.filingDate), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, ret.id)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No GSTR-3B returns found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
        
        {/* Actions Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleViewReturn}>
            <VisibilityIcon sx={{ mr: 1, fontSize: 20 }} />
            View Details
          </MenuItem>
          <MenuItem onClick={handleExportJSON}>
            <FileDownloadIcon sx={{ mr: 1, fontSize: 20 }} />
            Export JSON
          </MenuItem>
          <MenuItem onClick={handleMarkReady}>
            <CheckCircleIcon sx={{ mr: 1, fontSize: 20 }} />
            Mark as Ready
          </MenuItem>
          <MenuItem onClick={handleMarkFiled}>
            <CloudUploadIcon sx={{ mr: 1, fontSize: 20 }} />
            Mark as Filed
          </MenuItem>
        </Menu>
        
        {/* Generate Return Dialog */}
        <Dialog open={generateDialogOpen} onClose={() => setGenerateDialogOpen(false)}>
          <DialogTitle>Generate GST Return</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 2, minWidth: 400 }}>
              <FormControl fullWidth>
                <InputLabel>Return Type</InputLabel>
                <Select
                  value={generateType}
                  onChange={(e) => setGenerateType(e.target.value as 'GSTR1' | 'GSTR3B')}
                  label="Return Type"
                >
                  <MenuItem value="GSTR1">GSTR-1 (Outward Supplies)</MenuItem>
                  <MenuItem value="GSTR3B">GSTR-3B (Summary Return)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Period (MM-YYYY)"
                value={generatePeriod}
                onChange={(e) => setGeneratePeriod(e.target.value)}
                placeholder="e.g., 11-2024"
                helperText="Enter the month and year for the return"
                fullWidth
              />
              <Alert severity="info">
                {generateType === 'GSTR1' 
                  ? 'GSTR-1 will be generated from all invoices for the selected period'
                  : 'GSTR-3B will be generated from invoices and purchase data for the selected period'
                }
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleGenerate} 
              variant="contained"
              disabled={generateGSTR1.isPending || generateGSTR3B.isPending}
              startIcon={<CalculateIcon />}
            >
              {generateGSTR1.isPending || generateGSTR3B.isPending ? 'Generating...' : 'Generate'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  )
}