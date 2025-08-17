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
  CardHeader,
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Tooltip,
  Stack,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  AttachMoney as AttachMoneyIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalance as AccountBalanceIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  Autorenew as AutorenewIcon,
  Undo as UndoIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { enqueueSnackbar } from 'notistack'

export default function AdvanceReceiptsPage() {
  const router = useRouter()
  const utils = api.useUtils()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null)
  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // Fetch advance receipts
  const { data: receipts, isLoading, error } = api.advanceReceipts.getAdvanceReceipts.useQuery({
    clientId: filterClient || undefined,
    status: filterStatus as any || undefined,
  })
  
  // Fetch metrics
  const { data: metrics } = api.advanceReceipts.getAdvanceMetrics.useQuery()
  
  // Fetch clients for filter
  const { data: clients } = api.clients.list.useQuery()
  
  // Auto-adjust mutation
  const autoAdjustMutation = api.advanceReceipts.autoAdjustAdvances.useMutation({
    onSuccess: (result) => {
      utils.advanceReceipts.getAdvanceReceipts.invalidate()
      utils.advanceReceipts.getAdvanceMetrics.invalidate()
      utils.invoices.list.invalidate()
      enqueueSnackbar(
        `Successfully adjusted ${result.adjustmentsCreated} advance(s) against invoices`,
        { variant: 'success' }
      )
    },
    onError: (error) => {
      enqueueSnackbar(`Failed to auto-adjust: ${error.message}`, { variant: 'error' })
    },
  })
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, receiptId: string) => {
    setAnchorEl(event.currentTarget)
    setSelectedReceiptId(receiptId)
  }
  
  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedReceiptId(null)
  }
  
  const handleViewReceipt = () => {
    if (selectedReceiptId) {
      router.push(`/advances/${selectedReceiptId}`)
    }
    handleMenuClose()
  }
  
  const handleAdjustReceipt = () => {
    if (selectedReceiptId) {
      router.push(`/advances/${selectedReceiptId}/adjust`)
    }
    handleMenuClose()
  }
  
  const handleAutoAdjust = (clientId: string) => {
    if (confirm('This will automatically adjust all unadjusted advances against unpaid invoices using FIFO method. Continue?')) {
      autoAdjustMutation.mutate({ clientId, method: 'FIFO' })
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return 'info'
      case 'PARTIALLY_ADJUSTED':
        return 'warning'
      case 'FULLY_ADJUSTED':
        return 'success'
      case 'REFUNDED':
        return 'default'
      default:
        return 'default'
    }
  }
  
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount)
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
          Failed to load advance receipts: {error.message}
        </Alert>
      </Container>
    )
  }
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Advance Receipts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage advance payments received from clients
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={NextLink}
            href="/advances/new"
          >
            New Advance Receipt
          </Button>
        </Box>
        
        {/* Metrics Cards */}
        {metrics && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AttachMoneyIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography color="text.secondary" variant="body2">
                      Total Received
                    </Typography>
                  </Box>
                  <Typography variant="h5">
                    {formatCurrency(metrics.totalReceived, 'INR')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {metrics.totalReceipts} receipts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUpIcon sx={{ mr: 2, color: 'success.main' }} />
                    <Typography color="text.secondary" variant="body2">
                      Adjusted
                    </Typography>
                  </Box>
                  <Typography variant="h5">
                    {formatCurrency(metrics.totalAdjusted, 'INR')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {metrics.byStatus.fullyAdjusted} fully adjusted
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AccountBalanceIcon sx={{ mr: 2, color: 'warning.main' }} />
                    <Typography color="text.secondary" variant="body2">
                      Unadjusted
                    </Typography>
                  </Box>
                  <Typography variant="h5">
                    {formatCurrency(metrics.totalUnadjusted, 'INR')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {metrics.byStatus.partiallyAdjusted} partially adjusted
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ScheduleIcon sx={{ mr: 2, color: 'error.main' }} />
                    <Typography color="text.secondary" variant="body2">
                      Aging (90+ days)
                    </Typography>
                  </Box>
                  <Typography variant="h5">
                    {formatCurrency(metrics.aging.ninetyDaysPlus, 'INR')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Requires attention
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
        
        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Client</InputLabel>
                <Select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  label="Filter by Client"
                >
                  <MenuItem value="">All Clients</MenuItem>
                  {clients?.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.name} {client.company && `(${client.company})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Filter by Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="RECEIVED">Received</MenuItem>
                  <MenuItem value="PARTIALLY_ADJUSTED">Partially Adjusted</MenuItem>
                  <MenuItem value="FULLY_ADJUSTED">Fully Adjusted</MenuItem>
                  <MenuItem value="REFUNDED">Refunded</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {filterClient && (
                  <Tooltip title="Auto-adjust advances for selected client">
                    <Button
                      variant="outlined"
                      startIcon={<AutorenewIcon />}
                      onClick={() => handleAutoAdjust(filterClient)}
                      disabled={autoAdjustMutation.isPending}
                      size="small"
                    >
                      Auto Adjust
                    </Button>
                  </Tooltip>
                )}
              </Box>
            </Grid>
          </Grid>
        </Paper>
        
        {/* Receipts Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Receipt No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Client</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Adjusted</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell>Payment Mode</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receipts && receipts.length > 0 ? (
                receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {receipt.receiptNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {format(new Date(receipt.receiptDate), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {receipt.client.name}
                      </Typography>
                      {receipt.client.company && (
                        <Typography variant="caption" color="text.secondary">
                          {receipt.client.company}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatCurrency(Number(receipt.amount), receipt.currency)}
                      </Typography>
                      {receipt.currency !== 'INR' && (
                        <Typography variant="caption" color="text.secondary">
                          {formatCurrency(Number(receipt.amountINR), 'INR')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(Number(receipt.adjustedAmount), receipt.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(Number(receipt.unadjustedAmount), receipt.currency)}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={receipt.paymentMode} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={receipt.status.replace('_', ' ')}
                        size="small"
                        color={getStatusColor(receipt.status) as any}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, receipt.id)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No advance receipts found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Actions Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleViewReceipt}>
            <VisibilityIcon sx={{ mr: 1, fontSize: 20 }} />
            View Details
          </MenuItem>
          <MenuItem onClick={handleAdjustReceipt}>
            <AttachMoneyIcon sx={{ mr: 1, fontSize: 20 }} />
            Adjust Against Invoice
          </MenuItem>
        </Menu>
      </Box>
    </Container>
  )
}