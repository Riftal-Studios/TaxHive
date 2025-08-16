'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Snackbar,
  Stack,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as ClockIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'

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
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function GSTReturnsPage() {
  const [selectedReturnType, setSelectedReturnType] = useState(0) // 0 for GSTR1, 1 for GSTR3B
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [generatingReturn, setGeneratingReturn] = useState<string | null>(null)
  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState<'GSTR1' | 'GSTR3B'>('GSTR1')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // Fetch returns with filters
  const { data: returns, isLoading, refetch } = api.gstReturns.getReturns.useQuery({
    returnType: selectedReturnType === 0 ? 'GSTR1' : 'GSTR3B',
    year: selectedYear,
  })

  // Fetch return summary for dashboard
  const { data: summary } = api.gstReturns.getReturnSummary.useQuery()

  // Generate GSTR-1 mutation
  const generateGSTR1 = api.gstReturns.generateGSTR1.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'GSTR-1 generated successfully',
        severity: 'success',
      })
      refetch()
      setGeneratingReturn(null)
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error',
      })
      setGeneratingReturn(null)
    },
  })

  // Generate GSTR-3B mutation
  const generateGSTR3B = api.gstReturns.generateGSTR3B.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'GSTR-3B generated successfully',
        severity: 'success',
      })
      refetch()
      setGeneratingReturn(null)
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error',
      })
      setGeneratingReturn(null)
    },
  })

  // Update filing status mutation
  const updateFilingStatus = api.gstReturns.updateFilingStatus.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Filing status updated',
        severity: 'success',
      })
      refetch()
    },
  })

  const handleGenerateReturn = async () => {
    setOpenDialog(false)
    const key = `${selectedMonth}-${selectedYear}-${dialogType}`
    setGeneratingReturn(key)
    
    if (dialogType === 'GSTR1') {
      await generateGSTR1.mutateAsync({ month: selectedMonth, year: selectedYear })
    } else {
      await generateGSTR3B.mutateAsync({ month: selectedMonth, year: selectedYear })
    }
  }

  const handleDownloadJSON = (returnItem: { jsonOutput: any; returnType: string; period: string }) => {
    try {
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(returnItem.jsonOutput, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${returnItem.returnType}_${returnItem.period.replace('-', '')}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setSnackbar({
        open: true,
        message: 'Return JSON downloaded',
        severity: 'success',
      })
    } catch {
      setSnackbar({
        open: true,
        message: 'Failed to download return',
        severity: 'error',
      })
    }
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Chip label="Draft" size="small" icon={<ClockIcon />} />
      case 'READY':
        return <Chip label="Ready to File" size="small" color="primary" icon={<WarningIcon />} />
      case 'FILED':
        return <Chip label="Filed" size="small" color="success" icon={<CheckCircleIcon />} />
      case 'AMENDED':
        return <Chip label="Amended" size="small" color="warning" />
      default:
        return <Chip label={status} size="small" />
    }
  }

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ]

  const currentYear = new Date().getFullYear()

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          GST Returns
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage and file your GST returns
        </Typography>
      </Box>

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Period
                  </Typography>
                </Box>
                <Typography variant="h5">{summary.currentPeriod}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Tax period
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ClockIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    GSTR-1 Due
                  </Typography>
                </Box>
                <Typography variant="h5">
                  {format(new Date(summary.dueDates.gstr1), 'dd MMM yyyy')}
                </Typography>
                <Typography variant="caption" color={summary.pendingReturns.gstr1 > 0 ? 'error' : 'success.main'}>
                  {summary.pendingReturns.gstr1 > 0 
                    ? `${summary.pendingReturns.gstr1} pending`
                    : 'All filed'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ClockIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    GSTR-3B Due
                  </Typography>
                </Box>
                <Typography variant="h5">
                  {format(new Date(summary.dueDates.gstr3b), 'dd MMM yyyy')}
                </Typography>
                <Typography variant="caption" color={summary.pendingReturns.gstr3b > 0 ? 'error' : 'success.main'}>
                  {summary.pendingReturns.gstr3b > 0 
                    ? `${summary.pendingReturns.gstr3b} pending`
                    : 'All filed'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Generate Return Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Generate Return
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Generate GST returns for a specific period
          </Typography>
          
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Month</InputLabel>
              <Select
                value={selectedMonth}
                label="Month"
                onChange={(e) => setSelectedMonth(e.target.value as number)}
                size="small"
              >
                {months.map((month) => (
                  <MenuItem key={month.value} value={month.value}>
                    {month.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl sx={{ minWidth: 100 }}>
              <InputLabel>Year</InputLabel>
              <Select
                value={selectedYear}
                label="Year"
                onChange={(e) => setSelectedYear(e.target.value as number)}
                size="small"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={generatingReturn !== null}
              onClick={() => {
                setDialogType('GSTR1')
                setOpenDialog(true)
              }}
            >
              Generate GSTR-1
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={generatingReturn !== null}
              onClick={() => {
                setDialogType('GSTR3B')
                setOpenDialog(true)
              }}
            >
              Generate GSTR-3B
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Returns List */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Returns History
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Year</InputLabel>
                <Select
                  value={selectedYear}
                  label="Year"
                  onChange={(e) => setSelectedYear(e.target.value as number)}
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton onClick={() => refetch()}>
                <RefreshIcon />
              </IconButton>
            </Box>
          </Box>
          
          <Tabs value={selectedReturnType} onChange={(_, value) => setSelectedReturnType(value)}>
            <Tab label="GSTR-1" />
            <Tab label="GSTR-3B" />
          </Tabs>
          
          <TabPanel value={selectedReturnType} index={0}>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Generated On</TableCell>
                    <TableCell>Filing Date</TableCell>
                    <TableCell>ARN</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : returns?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">
                          No returns found for this period
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    returns?.map((returnItem: any) => (
                      <TableRow key={returnItem.id}>
                        <TableCell>{returnItem.period}</TableCell>
                        <TableCell>{getStatusChip(returnItem.filingStatus)}</TableCell>
                        <TableCell>{format(new Date(returnItem.createdAt), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          {returnItem.filingDate ? format(new Date(returnItem.filingDate), 'dd MMM yyyy') : '-'}
                        </TableCell>
                        <TableCell>{returnItem.arn || '-'}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => handleDownloadJSON(returnItem)}>
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                            {returnItem.filingStatus === 'DRAFT' && (
                              <Button
                                size="small"
                                onClick={() => updateFilingStatus.mutate({
                                  returnId: returnItem.id,
                                  filingStatus: 'READY'
                                })}
                              >
                                Mark Ready
                              </Button>
                            )}
                            {returnItem.filingStatus === 'READY' && (
                              <Button
                                size="small"
                                onClick={() => updateFilingStatus.mutate({
                                  returnId: returnItem.id,
                                  filingStatus: 'FILED',
                                  filingDate: new Date()
                                })}
                              >
                                Mark Filed
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
          
          <TabPanel value={selectedReturnType} index={1}>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Output Tax</TableCell>
                    <TableCell>ITC Claimed</TableCell>
                    <TableCell>Net Payable</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : returns?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">
                          No returns found for this period
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    returns?.map((returnItem: any) => (
                      <TableRow key={returnItem.id}>
                        <TableCell>{returnItem.period}</TableCell>
                        <TableCell>{getStatusChip(returnItem.filingStatus)}</TableCell>
                        <TableCell>₹{returnItem.outputTax?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>₹{returnItem.inputTaxClaim?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>₹{returnItem.netTaxPayable?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => handleDownloadJSON(returnItem)}>
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                            {returnItem.filingStatus === 'DRAFT' && (
                              <Button
                                size="small"
                                onClick={() => updateFilingStatus.mutate({
                                  returnId: returnItem.id,
                                  filingStatus: 'READY'
                                })}
                              >
                                Mark Ready
                              </Button>
                            )}
                            {returnItem.filingStatus === 'READY' && (
                              <Button
                                size="small"
                                onClick={() => updateFilingStatus.mutate({
                                  returnId: returnItem.id,
                                  filingStatus: 'FILED',
                                  filingDate: new Date()
                                })}
                              >
                                Mark Filed
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Generate Return Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>
          Generate {dialogType === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B'}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {dialogType === 'GSTR1' 
              ? 'This will generate GSTR-1 for the selected period. All non-draft invoices will be included.'
              : 'This will generate GSTR-3B for the selected period. Tax liability and ITC will be calculated.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleGenerateReturn} variant="contained">
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}