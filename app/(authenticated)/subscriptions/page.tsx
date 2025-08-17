"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/trpc/client"
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip,
  FormControlLabel,
  Switch,
  InputAdornment,
} from "@mui/material"
import {
  Add,
  MoreVert,
  PlayArrow,
  Pause,
  Cancel,
  Edit,
  TrendingUp,
  Group,
  Timer,
  AttachMoney,
  CalendarMonth,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Refresh,
  Download,
  CreditCard,
  Schedule,
} from "@mui/icons-material"
import { format, formatDistanceToNow, isPast, addDays } from "date-fns"

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
      id={`subscription-tabpanel-${index}`}
      aria-labelledby={`subscription-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function SubscriptionsPage() {
  const router = useRouter()
  const [tabValue, setTabValue] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })
  
  // Form state for new subscription
  const [formData, setFormData] = useState({
    clientId: '',
    planId: '',
    billingCycle: undefined as 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | undefined,
    customPrice: undefined as number | undefined,
    discountPercentage: 0,
    startDate: new Date(),
    autoRenew: true,
    sendInvoiceAutomatically: true,
    notes: '',
  })
  
  const [cancelData, setCancelData] = useState({
    reason: '',
    immediate: false,
  })
  
  const [pauseData, setPauseData] = useState({
    resumeDate: undefined as Date | undefined,
  })
  
  // Fetch data
  const { data: subscriptions, refetch: refetchSubscriptions } = api.subscriptions.getSubscriptions.useQuery()
  const { data: plans } = api.subscriptions.getPlans.useQuery()
  const { data: clients } = api.clients.list.useQuery()
  const { data: metrics } = api.subscriptions.getSubscriptionMetrics.useQuery()
  
  // Mutations
  const createSubscription = api.subscriptions.createSubscription.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Subscription created successfully',
        severity: 'success'
      })
      setCreateDialogOpen(false)
      resetForm()
      refetchSubscriptions()
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error'
      })
    }
  })
  
  const cancelSubscription = api.subscriptions.cancelSubscription.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Subscription cancelled successfully',
        severity: 'success'
      })
      setCancelDialogOpen(false)
      setSelectedSubscription(null)
      refetchSubscriptions()
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error'
      })
    }
  })
  
  const pauseSubscription = api.subscriptions.pauseSubscription.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Subscription paused successfully',
        severity: 'success'
      })
      setPauseDialogOpen(false)
      setSelectedSubscription(null)
      refetchSubscriptions()
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error'
      })
    }
  })
  
  const resumeSubscription = api.subscriptions.resumeSubscription.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Subscription resumed successfully',
        severity: 'success'
      })
      refetchSubscriptions()
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error'
      })
    }
  })
  
  const resetForm = () => {
    setFormData({
      clientId: '',
      planId: '',
      billingCycle: undefined,
      customPrice: undefined,
      discountPercentage: 0,
      startDate: new Date(),
      autoRenew: true,
      sendInvoiceAutomatically: true,
      notes: '',
    })
    setCancelData({
      reason: '',
      immediate: false,
    })
    setPauseData({
      resumeDate: undefined,
    })
  }
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, subscription: any) => {
    setAnchorEl(event.currentTarget)
    setSelectedSubscription(subscription)
  }
  
  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedSubscription(null)
  }
  
  const handleCreateSubscription = () => {
    createSubscription.mutate({
      clientId: formData.clientId,
      planId: formData.planId,
      billingCycle: formData.billingCycle,
      customPrice: formData.customPrice,
      discountPercentage: formData.discountPercentage,
      startDate: formData.startDate,
      autoRenew: formData.autoRenew,
      sendInvoiceAutomatically: formData.sendInvoiceAutomatically,
      notes: formData.notes || undefined,
    })
  }
  
  const handleCancelSubscription = () => {
    if (selectedSubscription) {
      cancelSubscription.mutate({
        id: selectedSubscription.id,
        reason: cancelData.reason || undefined,
        immediate: cancelData.immediate,
      })
    }
  }
  
  const handlePauseSubscription = () => {
    if (selectedSubscription) {
      pauseSubscription.mutate({
        id: selectedSubscription.id,
        resumeDate: pauseData.resumeDate,
      })
    }
  }
  
  const handleResumeSubscription = (subscription: any) => {
    resumeSubscription.mutate({ id: subscription.id })
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TRIAL':
        return 'info'
      case 'ACTIVE':
        return 'success'
      case 'PAUSED':
        return 'warning'
      case 'CANCELLED':
        return 'error'
      case 'EXPIRED':
        return 'default'
      default:
        return 'default'
    }
  }
  
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  
  const activeSubscriptions = subscriptions?.filter(s => s.status === 'ACTIVE') || []
  const trialSubscriptions = subscriptions?.filter(s => s.status === 'TRIAL') || []
  const pausedSubscriptions = subscriptions?.filter(s => s.status === 'PAUSED') || []
  const cancelledSubscriptions = subscriptions?.filter(s => s.status === 'CANCELLED' || s.status === 'EXPIRED') || []
  
  const SubscriptionTable = ({ subscriptions }: { subscriptions: any[] }) => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Client</TableCell>
            <TableCell>Plan</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Billing Cycle</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>Next Billing</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {subscriptions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center">
                <Typography variant="body2" color="textSecondary" py={3}>
                  No subscriptions found
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            subscriptions.map((subscription) => (
              <TableRow key={subscription.id}>
                <TableCell>
                  <Typography variant="body2">
                    {subscription.client.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {subscription.client.company}
                  </Typography>
                </TableCell>
                <TableCell>{subscription.plan.name}</TableCell>
                <TableCell>
                  <Chip
                    label={subscription.status}
                    size="small"
                    color={getStatusColor(subscription.status) as any}
                  />
                  {subscription.status === 'TRIAL' && subscription.trialEndDate && (
                    <Typography variant="caption" display="block" color="textSecondary" mt={0.5}>
                      Ends {formatDistanceToNow(new Date(subscription.trialEndDate), { addSuffix: true })}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{subscription.billingCycle}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {formatCurrency(subscription.currentPrice, subscription.plan.currency)}
                  </Typography>
                  {subscription.discountPercentage > 0 && (
                    <Chip
                      label={`-${subscription.discountPercentage}%`}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {subscription.nextBillingDate ? (
                    <Box>
                      <Typography variant="body2">
                        {format(new Date(subscription.nextBillingDate), 'MMM dd, yyyy')}
                      </Typography>
                      {isPast(new Date(subscription.nextBillingDate)) && (
                        <Chip
                          label="Due"
                          size="small"
                          color="error"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </Box>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {subscription.status === 'PAUSED' ? (
                    <Button
                      size="small"
                      startIcon={<PlayArrow />}
                      onClick={() => handleResumeSubscription(subscription)}
                    >
                      Resume
                    </Button>
                  ) : (
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, subscription)}
                    >
                      <MoreVert />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Subscriptions
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Manage client subscriptions and recurring billing
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => router.push('/subscriptions/plans')}
          >
            Manage Plans
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Subscription
          </Button>
        </Box>
      </Box>
      
      {/* Metrics Cards */}
      {metrics && (
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Active Subscriptions
                    </Typography>
                    <Typography variant="h5">
                      {metrics.activeSubscriptions}
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
                      Trial Users
                    </Typography>
                    <Typography variant="h5">
                      {metrics.trialSubscriptions}
                    </Typography>
                  </Box>
                  <Timer color="info" />
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
                      Monthly Recurring Revenue
                    </Typography>
                    <Typography variant="h5">
                      {formatCurrency(metrics.monthlyRecurringRevenue)}
                    </Typography>
                  </Box>
                  <TrendingUp color="primary" />
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
                      Churn Rate
                    </Typography>
                    <Typography variant="h5">
                      {metrics.churnRate.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {metrics.churnedLastMonth} churned last month
                    </Typography>
                  </Box>
                  <Warning color="warning" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      
      {/* Subscriptions Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label={`Active (${activeSubscriptions.length})`} />
          <Tab label={`Trial (${trialSubscriptions.length})`} />
          <Tab label={`Paused (${pausedSubscriptions.length})`} />
          <Tab label={`Cancelled (${cancelledSubscriptions.length})`} />
        </Tabs>
      </Paper>
      
      {/* Subscription Tables */}
      <TabPanel value={tabValue} index={0}>
        <SubscriptionTable subscriptions={activeSubscriptions} />
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <SubscriptionTable subscriptions={trialSubscriptions} />
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <SubscriptionTable subscriptions={pausedSubscriptions} />
      </TabPanel>
      
      <TabPanel value={tabValue} index={3}>
        <SubscriptionTable subscriptions={cancelledSubscriptions} />
      </TabPanel>
      
      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          router.push(`/subscriptions/${selectedSubscription?.id}`)
          handleMenuClose()
        }}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        {selectedSubscription?.status === 'ACTIVE' && (
          <MenuItem onClick={() => {
            setPauseDialogOpen(true)
            handleMenuClose()
          }}>
            <Pause fontSize="small" sx={{ mr: 1 }} />
            Pause Subscription
          </MenuItem>
        )}
        <MenuItem onClick={() => {
          setCancelDialogOpen(true)
          handleMenuClose()
        }}>
          <Cancel fontSize="small" sx={{ mr: 1 }} />
          Cancel Subscription
        </MenuItem>
      </Menu>
      
      {/* Create Subscription Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Subscription</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Client</InputLabel>
                <Select
                  value={formData.clientId}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                  label="Client"
                >
                  {clients?.map((client: any) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.name} - {client.company}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Subscription Plan</InputLabel>
                <Select
                  value={formData.planId}
                  onChange={(e) => setFormData(prev => ({ ...prev, planId: e.target.value }))}
                  label="Subscription Plan"
                >
                  {plans?.map((plan: any) => (
                    <MenuItem key={plan.id} value={plan.id}>
                      {plan.name} - {formatCurrency(plan.monthlyPrice, plan.currency)}/mo
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {formData.planId && (
              <>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Billing Cycle</InputLabel>
                    <Select
                      value={formData.billingCycle || plans?.find(p => p.id === formData.planId)?.billingCycle}
                      onChange={(e) => setFormData(prev => ({ ...prev, billingCycle: e.target.value as any }))}
                      label="Billing Cycle"
                    >
                      <MenuItem value="MONTHLY">Monthly</MenuItem>
                      <MenuItem value="QUARTERLY">Quarterly</MenuItem>
                      <MenuItem value="YEARLY">Yearly</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Discount %"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountPercentage: parseFloat(e.target.value) || 0 }))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      inputProps: { min: 0, max: 100 }
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Custom Price (Optional)"
                    value={formData.customPrice || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, customPrice: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">
                        {plans?.find(p => p.id === formData.planId)?.currency || 'USD'}
                      </InputAdornment>,
                    }}
                    helperText="Leave blank to use plan pricing"
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Start Date"
                    value={format(formData.startDate, 'yyyy-MM-dd')}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: new Date(e.target.value) }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Notes (Optional)"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.autoRenew}
                        onChange={(e) => setFormData(prev => ({ ...prev, autoRenew: e.target.checked }))}
                      />
                    }
                    label="Auto-renew subscription"
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.sendInvoiceAutomatically}
                        onChange={(e) => setFormData(prev => ({ ...prev, sendInvoiceAutomatically: e.target.checked }))}
                      />
                    }
                    label="Send invoices automatically"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateSubscription} 
            variant="contained"
            disabled={!formData.clientId || !formData.planId}
          >
            Create Subscription
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will stop all future billing for this subscription.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Cancellation Reason (Optional)"
            value={cancelData.reason}
            onChange={(e) => setCancelData(prev => ({ ...prev, reason: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={cancelData.immediate}
                onChange={(e) => setCancelData(prev => ({ ...prev, immediate: e.target.checked }))}
              />
            }
            label="Cancel immediately (otherwise cancels at end of billing period)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Close</Button>
          <Button onClick={handleCancelSubscription} color="error" variant="contained">
            Cancel Subscription
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Pause Subscription Dialog */}
      <Dialog open={pauseDialogOpen} onClose={() => setPauseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Pause Subscription</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Pausing will temporarily stop billing. You can resume anytime.
          </Alert>
          <TextField
            fullWidth
            type="date"
            label="Resume Date (Optional)"
            value={pauseData.resumeDate ? format(pauseData.resumeDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => setPauseData(prev => ({ 
              ...prev, 
              resumeDate: e.target.value ? new Date(e.target.value) : undefined 
            }))}
            InputLabelProps={{ shrink: true }}
            helperText="Leave blank to resume manually"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPauseDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePauseSubscription} color="warning" variant="contained">
            Pause Subscription
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