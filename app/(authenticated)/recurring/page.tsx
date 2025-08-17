"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/trpc/client"
import {
  Box,
  Paper,
  Typography,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tooltip,
  LinearProgress,
  Avatar,
  Badge
} from "@mui/material"
import {
  Add,
  MoreVert,
  PlayArrow,
  Pause,
  Stop,
  Edit,
  Delete,
  Visibility,
  CalendarMonth,
  AttachMoney,
  Schedule,
  Email,
  TrendingUp,
  Receipt,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Send,
  History,
  ContentCopy,
  Refresh
} from "@mui/icons-material"
import { format, formatDistance, addDays, isAfter, isBefore } from "date-fns"

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
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

export default function RecurringInvoicesPage() {
  const router = useRouter()
  const [tabValue, setTabValue] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedRecurring, setSelectedRecurring] = useState<any>(null)
  const [previewDialog, setPreviewDialog] = useState(false)
  const [historyDialog, setHistoryDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as any })
  
  // Fetch data
  const { data: recurringInvoices, refetch } = api.recurringInvoices.getRecurringInvoices.useQuery({
    status: tabValue === 0 ? "ACTIVE" : tabValue === 1 ? "PAUSED" : tabValue === 2 ? "COMPLETED" : "CANCELLED"
  })
  
  const { data: upcomingInvoices } = api.recurringInvoices.getUpcomingRecurringInvoices.useQuery({
    days: 30
  })
  
  const { data: subscriptions } = api.recurringInvoices.getSubscriptions.useQuery()
  
  // Mutations
  const pauseRecurring = api.recurringInvoices.pauseRecurring.useMutation({
    onSuccess: () => {
      setSnackbar({ open: true, message: "Recurring invoice paused", severity: "success" })
      refetch()
      handleCloseMenu()
    }
  })
  
  const resumeRecurring = api.recurringInvoices.resumeRecurring.useMutation({
    onSuccess: () => {
      setSnackbar({ open: true, message: "Recurring invoice resumed", severity: "success" })
      refetch()
      handleCloseMenu()
    }
  })
  
  const cancelRecurring = api.recurringInvoices.cancelRecurring.useMutation({
    onSuccess: () => {
      setSnackbar({ open: true, message: "Recurring invoice cancelled", severity: "success" })
      refetch()
      setDeleteDialog(false)
    }
  })
  
  const generateNow = api.recurringInvoices.generateInvoiceNow.useMutation({
    onSuccess: (invoice) => {
      setSnackbar({ open: true, message: `Invoice ${invoice.invoiceNumber} generated`, severity: "success" })
      refetch()
      handleCloseMenu()
    }
  })
  
  const { data: previewData } = api.recurringInvoices.previewNextInvoices.useQuery(
    { id: selectedRecurring?.id || "", count: 5 },
    { enabled: !!selectedRecurring && previewDialog }
  )
  
  const { data: historyData } = api.recurringInvoices.getRecurringHistory.useQuery(
    { id: selectedRecurring?.id || "" },
    { enabled: !!selectedRecurring && historyDialog }
  )
  
  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, recurring: any) => {
    setAnchorEl(event.currentTarget)
    setSelectedRecurring(recurring)
  }
  
  const handleCloseMenu = () => {
    setAnchorEl(null)
    setSelectedRecurring(null)
  }
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "success"
      case "PAUSED":
        return "warning"
      case "COMPLETED":
        return "info"
      case "CANCELLED":
        return "error"
      default:
        return "default"
    }
  }
  
  const getFrequencyLabel = (frequency: string, interval: number) => {
    const freq = frequency.toLowerCase()
    if (interval === 1) {
      return freq
    }
    return `Every ${interval} ${freq}`
  }
  
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }
  
  // Calculate stats
  const activeCount = recurringInvoices?.filter(r => r.status === "ACTIVE").length || 0
  const totalMonthlyValue = recurringInvoices?.reduce((sum, r) => {
    if (r.status !== "ACTIVE") return sum
    const amount = r.lineItems.reduce((total, item) => 
      total + Number(item.quantity) * Number(item.rate), 0
    )
    // Convert to monthly value
    let monthlyMultiplier = 1
    switch (r.frequency) {
      case "DAILY": monthlyMultiplier = 30 / r.interval; break
      case "WEEKLY": monthlyMultiplier = 4.33 / r.interval; break
      case "MONTHLY": monthlyMultiplier = 1 / r.interval; break
      case "QUARTERLY": monthlyMultiplier = 0.33 / r.interval; break
      case "YEARLY": monthlyMultiplier = 0.083 / r.interval; break
    }
    return sum + (amount * monthlyMultiplier)
  }, 0) || 0
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Recurring Invoices
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Manage your recurring invoice templates and subscriptions
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => router.push("/recurring/new")}
          >
            New Template
          </Button>
        </Box>
      </Box>
      
      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Active Templates
                  </Typography>
                  <Typography variant="h4">
                    {activeCount}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: "success.light" }}>
                  <CheckCircle color="success" />
                </Avatar>
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
                    Monthly Recurring Value
                  </Typography>
                  <Typography variant="h4">
                    ₹{totalMonthlyValue.toFixed(0)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: "primary.light" }}>
                  <TrendingUp color="primary" />
                </Avatar>
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
                    Next 7 Days
                  </Typography>
                  <Typography variant="h4">
                    {upcomingInvoices?.filter(u => 
                      isBefore(new Date(u.nextRunDate), addDays(new Date(), 7))
                    ).length || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: "info.light" }}>
                  <CalendarMonth color="info" />
                </Avatar>
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
                    Active Subscriptions
                  </Typography>
                  <Typography variant="h4">
                    {subscriptions?.filter(s => s.status === "ACTIVE").length || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: "secondary.light" }}>
                  <Receipt color="secondary" />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Upcoming Invoices Alert */}
      {upcomingInvoices && upcomingInvoices.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            {upcomingInvoices.length} invoices scheduled in the next 30 days
          </Typography>
          <Box display="flex" gap={2} mt={1} flexWrap="wrap">
            {upcomingInvoices.slice(0, 3).map(upcoming => (
              <Chip
                key={upcoming.id}
                label={`${upcoming.clientName} - ${format(new Date(upcoming.nextRunDate), "dd MMM")} - ${formatCurrency(upcoming.amount, upcoming.currency)}`}
                size="small"
              />
            ))}
            {upcomingInvoices.length > 3 && (
              <Chip
                label={`+${upcomingInvoices.length - 3} more`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Alert>
      )}
      
      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Active" />
          <Tab label="Paused" />
          <Tab label="Completed" />
          <Tab label="Cancelled" />
        </Tabs>
      </Paper>
      
      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Template Name</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Next Run</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="center">Generated</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!recurringInvoices || recurringInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Box py={4}>
                    <Typography variant="body1" color="textSecondary" gutterBottom>
                      No recurring invoices found
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => router.push("/recurring/new")}
                      sx={{ mt: 2 }}
                    >
                      Create First Template
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              recurringInvoices.map((recurring) => {
                const amount = recurring.lineItems.reduce((sum, item) => 
                  sum + Number(item.quantity) * Number(item.rate), 0
                )
                
                return (
                  <TableRow key={recurring.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {recurring.templateName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {recurring.invoiceType}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {recurring.client.name}
                      </Typography>
                      {recurring.client.company && (
                        <Typography variant="caption" color="textSecondary">
                          {recurring.client.company}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Schedule fontSize="small" color="action" />
                        <Typography variant="body2">
                          {getFrequencyLabel(recurring.frequency, recurring.interval)}
                        </Typography>
                      </Box>
                      {recurring.endDate && (
                        <Typography variant="caption" color="textSecondary">
                          Until {format(new Date(recurring.endDate), "dd MMM yyyy")}
                        </Typography>
                      )}
                      {recurring.occurrences && (
                        <Typography variant="caption" color="textSecondary">
                          {recurring.occurrences - recurring.generatedCount} remaining
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {recurring.status === "ACTIVE" ? (
                        <Box>
                          <Typography variant="body2">
                            {format(new Date(recurring.nextRunDate), "dd MMM yyyy")}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatDistance(new Date(recurring.nextRunDate), new Date(), { addSuffix: true })}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatCurrency(amount, recurring.currency)}
                      </Typography>
                      {recurring.currency !== "INR" && (
                        <Typography variant="caption" color="textSecondary">
                          per invoice
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Badge badgeContent={recurring._count.generatedInvoices} color="primary">
                        <Receipt />
                      </Badge>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={recurring.status}
                        color={getStatusColor(recurring.status)}
                        size="small"
                      />
                      {recurring.sendAutomatically && (
                        <Tooltip title="Auto-send enabled">
                          <Email fontSize="small" color="primary" sx={{ ml: 1 }} />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenMenu(e, recurring)}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
      >
        {selectedRecurring?.status === "ACTIVE" && (
          <>
            <MenuItem onClick={() => generateNow.mutate({ id: selectedRecurring.id })}>
              <Send fontSize="small" sx={{ mr: 1 }} />
              Generate Now
            </MenuItem>
            <MenuItem onClick={() => pauseRecurring.mutate({ id: selectedRecurring.id })}>
              <Pause fontSize="small" sx={{ mr: 1 }} />
              Pause
            </MenuItem>
          </>
        )}
        {selectedRecurring?.status === "PAUSED" && (
          <MenuItem onClick={() => resumeRecurring.mutate({ id: selectedRecurring.id })}>
            <PlayArrow fontSize="small" sx={{ mr: 1 }} />
            Resume
          </MenuItem>
        )}
        <MenuItem onClick={() => { setPreviewDialog(true); handleCloseMenu() }}>
          <Visibility fontSize="small" sx={{ mr: 1 }} />
          Preview Next
        </MenuItem>
        <MenuItem onClick={() => { setHistoryDialog(true); handleCloseMenu() }}>
          <History fontSize="small" sx={{ mr: 1 }} />
          View History
        </MenuItem>
        <MenuItem onClick={() => router.push(`/recurring/${selectedRecurring?.id}/edit`)}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => router.push(`/recurring/new?clone=${selectedRecurring?.id}`)}>
          <ContentCopy fontSize="small" sx={{ mr: 1 }} />
          Duplicate
        </MenuItem>
        {selectedRecurring?.status !== "CANCELLED" && (
          <MenuItem onClick={() => { setDeleteDialog(true); handleCloseMenu() }} sx={{ color: "error.main" }}>
            <Stop fontSize="small" sx={{ mr: 1 }} />
            Cancel
          </MenuItem>
        )}
      </Menu>
      
      {/* Preview Dialog */}
      <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Preview Upcoming Invoices</DialogTitle>
        <DialogContent>
          {previewData && previewData.length > 0 ? (
            <Box>
              {previewData.map((preview, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2 }} variant="outlined">
                  <Box display="flex" justifyContent="space-between">
                    <Box>
                      <Typography variant="subtitle2">
                        Invoice #{index + 1}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {format(new Date(preview.invoiceDate), "dd MMM yyyy")}
                      </Typography>
                    </Box>
                    <Typography variant="h6">
                      {formatCurrency(preview.amount, preview.currency)}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="textSecondary">
              No upcoming invoices to preview
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* History Dialog */}
      <Dialog open={historyDialog} onClose={() => setHistoryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Invoice Generation History</DialogTitle>
        <DialogContent>
          {historyData && historyData.invoices.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice Number</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Payment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historyData.invoices.map(invoice => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={() => router.push(`/invoices/${invoice.id}`)}
                        >
                          {invoice.invoiceNumber}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(Number(invoice.totalAmount), invoice.currency)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.status}
                          size="small"
                          color={invoice.status === "PAID" ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.paymentStatus}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="textSecondary">
              No invoices generated yet
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Cancel Recurring Invoice</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will stop all future invoice generation for this template.
          </Alert>
          <Typography>
            Are you sure you want to cancel "{selectedRecurring?.templateName}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Keep Active</Button>
          <Button
            onClick={() => cancelRecurring.mutate({ id: selectedRecurring?.id })}
            color="error"
            variant="contained"
          >
            Cancel Template
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}