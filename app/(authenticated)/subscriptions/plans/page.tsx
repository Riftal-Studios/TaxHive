"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/trpc/client"
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Snackbar,
  Switch,
  FormControlLabel,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Paper,
  Tabs,
  Tab,
} from "@mui/material"
import {
  Add,
  Edit,
  Delete,
  Check,
  AttachMoney,
  Timer,
  Group,
  Receipt,
  TrendingUp,
  Settings,
  Visibility,
  VisibilityOff,
  Star,
  CalendarMonth,
} from "@mui/icons-material"
import { format } from "date-fns"

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
      id={`plan-tabpanel-${index}`}
      aria-labelledby={`plan-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function SubscriptionPlansPage() {
  const router = useRouter()
  const [tabValue, setTabValue] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [planToDelete, setPlanToDelete] = useState<any>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    currency: 'USD',
    monthlyPrice: 0,
    yearlyPrice: 0,
    setupFee: 0,
    billingCycle: 'MONTHLY' as 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    paymentTerms: 30,
    features: [] as string[],
    maxUsers: undefined as number | undefined,
    maxInvoices: undefined as number | undefined,
    trialPeriodDays: 14,
    isActive: true,
    isPublic: true,
    newFeature: '',
  })
  
  // Fetch plans
  const { data: plans, refetch: refetchPlans } = api.subscriptions.getPlans.useQuery({
    includeInactive: tabValue === 2
  })
  
  const { data: metrics } = api.subscriptions.getSubscriptionMetrics.useQuery()
  
  // Mutations
  const createPlan = api.subscriptions.createPlan.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Subscription plan created successfully',
        severity: 'success'
      })
      setDialogOpen(false)
      resetForm()
      refetchPlans()
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error'
      })
    }
  })
  
  const updatePlan = api.subscriptions.updatePlan.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Subscription plan updated successfully',
        severity: 'success'
      })
      setDialogOpen(false)
      setEditingPlan(null)
      resetForm()
      refetchPlans()
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error'
      })
    }
  })
  
  const deletePlan = api.subscriptions.deletePlan.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Subscription plan deleted successfully',
        severity: 'success'
      })
      setDeleteDialogOpen(false)
      setPlanToDelete(null)
      refetchPlans()
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
      name: '',
      description: '',
      currency: 'USD',
      monthlyPrice: 0,
      yearlyPrice: 0,
      setupFee: 0,
      billingCycle: 'MONTHLY',
      paymentTerms: 30,
      features: [],
      maxUsers: undefined,
      maxInvoices: undefined,
      trialPeriodDays: 14,
      isActive: true,
      isPublic: true,
      newFeature: '',
    })
  }
  
  const handleOpenDialog = (plan?: any) => {
    if (plan) {
      setEditingPlan(plan)
      setFormData({
        name: plan.name,
        description: plan.description || '',
        currency: plan.currency,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice || 0,
        setupFee: plan.setupFee || 0,
        billingCycle: plan.billingCycle,
        paymentTerms: plan.paymentTerms,
        features: plan.features || [],
        maxUsers: plan.maxUsers || undefined,
        maxInvoices: plan.maxInvoices || undefined,
        trialPeriodDays: plan.trialPeriodDays || 0,
        isActive: plan.isActive,
        isPublic: plan.isPublic,
        newFeature: '',
      })
    } else {
      resetForm()
    }
    setDialogOpen(true)
  }
  
  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingPlan(null)
    resetForm()
  }
  
  const handleAddFeature = () => {
    if (formData.newFeature) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, prev.newFeature],
        newFeature: ''
      }))
    }
  }
  
  const handleRemoveFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }))
  }
  
  const handleSubmit = () => {
    const data = {
      name: formData.name,
      description: formData.description || undefined,
      currency: formData.currency,
      monthlyPrice: formData.monthlyPrice,
      yearlyPrice: formData.yearlyPrice || undefined,
      setupFee: formData.setupFee,
      billingCycle: formData.billingCycle,
      paymentTerms: formData.paymentTerms,
      features: formData.features,
      maxUsers: formData.maxUsers || undefined,
      maxInvoices: formData.maxInvoices || undefined,
      trialPeriodDays: formData.trialPeriodDays,
      isActive: formData.isActive,
      isPublic: formData.isPublic,
    }
    
    if (editingPlan) {
      updatePlan.mutate({ ...data, id: editingPlan.id })
    } else {
      createPlan.mutate(data)
    }
  }
  
  const handleDeletePlan = (plan: any) => {
    setPlanToDelete(plan)
    setDeleteDialogOpen(true)
  }
  
  const confirmDelete = () => {
    if (planToDelete) {
      deletePlan.mutate({ id: planToDelete.id })
    }
  }
  
  const activePlans = plans?.filter(p => p.isActive && p.isPublic) || []
  const privatePlans = plans?.filter(p => p.isActive && !p.isPublic) || []
  const inactivePlans = plans?.filter(p => !p.isActive) || []
  
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  
  const PlanCard = ({ plan }: { plan: any }) => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {plan.name}
            </Typography>
            {plan.description && (
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {plan.description}
              </Typography>
            )}
          </Box>
          <Box display="flex" gap={1}>
            {!plan.isPublic && (
              <Chip label="Private" size="small" color="warning" />
            )}
            {!plan.isActive && (
              <Chip label="Inactive" size="small" color="error" />
            )}
          </Box>
        </Box>
        
        <Box mb={3}>
          <Typography variant="h4" color="primary">
            {formatCurrency(plan.monthlyPrice, plan.currency)}
            <Typography component="span" variant="body2" color="textSecondary">
              /month
            </Typography>
          </Typography>
          {plan.yearlyPrice && (
            <Typography variant="body2" color="textSecondary">
              or {formatCurrency(plan.yearlyPrice, plan.currency)}/year
            </Typography>
          )}
          {plan.setupFee > 0 && (
            <Typography variant="body2" color="textSecondary">
              + {formatCurrency(plan.setupFee, plan.currency)} setup fee
            </Typography>
          )}
        </Box>
        
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>
            Features:
          </Typography>
          <List dense>
            {plan.features.slice(0, 3).map((feature: string, index: number) => (
              <ListItem key={index} disableGutters>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <Check fontSize="small" color="success" />
                </ListItemIcon>
                <ListItemText primary={feature} />
              </ListItem>
            ))}
            {plan.features.length > 3 && (
              <ListItem disableGutters>
                <ListItemText 
                  primary={`+${plan.features.length - 3} more features`}
                  secondary="Click edit to view all"
                />
              </ListItem>
            )}
          </List>
        </Box>
        
        <Box display="flex" gap={2} flexWrap="wrap">
          {plan.trialPeriodDays > 0 && (
            <Chip
              icon={<Timer />}
              label={`${plan.trialPeriodDays} day trial`}
              size="small"
              variant="outlined"
            />
          )}
          {plan.maxUsers && (
            <Chip
              icon={<Group />}
              label={`Max ${plan.maxUsers} users`}
              size="small"
              variant="outlined"
            />
          )}
          {plan.maxInvoices && (
            <Chip
              icon={<Receipt />}
              label={`Max ${plan.maxInvoices} invoices`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
        
        {plan.activeSubscriptions > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {plan.activeSubscriptions} active subscription{plan.activeSubscriptions !== 1 ? 's' : ''}
          </Alert>
        )}
      </CardContent>
      
      <CardActions>
        <Button
          size="small"
          startIcon={<Edit />}
          onClick={() => handleOpenDialog(plan)}
        >
          Edit
        </Button>
        <Button
          size="small"
          startIcon={<Delete />}
          onClick={() => handleDeletePlan(plan)}
          color="error"
          disabled={plan.activeSubscriptions > 0}
        >
          Delete
        </Button>
      </CardActions>
    </Card>
  )
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Subscription Plans
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Create and manage subscription tiers for your clients
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Create Plan
        </Button>
      </Box>
      
      {/* Metrics Cards */}
      {metrics && (
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Plans
                  </Typography>
                  <Typography variant="h5">
                    {plans?.length || 0}
                  </Typography>
                </Box>
                <Settings color="primary" />
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Active Subscriptions
                  </Typography>
                  <Typography variant="h5">
                    {metrics.activeSubscriptions}
                  </Typography>
                </Box>
                <Group color="success" />
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
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
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Avg. Subscription Value
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(metrics.averageSubscriptionValue)}
                  </Typography>
                </Box>
                <AttachMoney color="info" />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
      
      {/* Plans Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label={`Public Plans (${activePlans.length})`} />
          <Tab label={`Private Plans (${privatePlans.length})`} />
          <Tab label={`Inactive Plans (${inactivePlans.length})`} />
        </Tabs>
      </Paper>
      
      {/* Plans Grid */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {activePlans.map((plan) => (
            <Grid item xs={12} md={6} lg={4} key={plan.id}>
              <PlanCard plan={plan} />
            </Grid>
          ))}
          {activePlans.length === 0 && (
            <Grid item xs={12}>
              <Alert severity="info">
                No public plans created yet. Click "Create Plan" to add your first subscription plan.
              </Alert>
            </Grid>
          )}
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {privatePlans.map((plan) => (
            <Grid item xs={12} md={6} lg={4} key={plan.id}>
              <PlanCard plan={plan} />
            </Grid>
          ))}
          {privatePlans.length === 0 && (
            <Grid item xs={12}>
              <Alert severity="info">
                No private plans created yet. Private plans are only visible to selected clients.
              </Alert>
            </Grid>
          )}
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          {inactivePlans.map((plan) => (
            <Grid item xs={12} md={6} lg={4} key={plan.id}>
              <PlanCard plan={plan} />
            </Grid>
          ))}
          {inactivePlans.length === 0 && (
            <Grid item xs={12}>
              <Alert severity="info">
                No inactive plans. Plans become inactive when deleted or manually deactivated.
              </Alert>
            </Grid>
          )}
        </Grid>
      </TabPanel>
      
      {/* Create/Edit Plan Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Plan Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  label="Currency"
                >
                  <MenuItem value="USD">USD - US Dollar</MenuItem>
                  <MenuItem value="EUR">EUR - Euro</MenuItem>
                  <MenuItem value="GBP">GBP - British Pound</MenuItem>
                  <MenuItem value="INR">INR - Indian Rupee</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Monthly Price"
                value={formData.monthlyPrice}
                onChange={(e) => setFormData(prev => ({ ...prev, monthlyPrice: parseFloat(e.target.value) || 0 }))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment>,
                }}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Yearly Price (Optional)"
                value={formData.yearlyPrice}
                onChange={(e) => setFormData(prev => ({ ...prev, yearlyPrice: parseFloat(e.target.value) || 0 }))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment>,
                }}
                helperText="Leave 0 for no yearly option"
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Setup Fee"
                value={formData.setupFee}
                onChange={(e) => setFormData(prev => ({ ...prev, setupFee: parseFloat(e.target.value) || 0 }))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">{formData.currency}</InputAdornment>,
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Default Billing Cycle</InputLabel>
                <Select
                  value={formData.billingCycle}
                  onChange={(e) => setFormData(prev => ({ ...prev, billingCycle: e.target.value as any }))}
                  label="Default Billing Cycle"
                >
                  <MenuItem value="MONTHLY">Monthly</MenuItem>
                  <MenuItem value="QUARTERLY">Quarterly</MenuItem>
                  <MenuItem value="YEARLY">Yearly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Payment Terms (Days)"
                value={formData.paymentTerms}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: parseInt(e.target.value) || 30 }))}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Trial Period (Days)"
                value={formData.trialPeriodDays}
                onChange={(e) => setFormData(prev => ({ ...prev, trialPeriodDays: parseInt(e.target.value) || 0 }))}
                helperText="0 for no trial"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Users (Optional)"
                value={formData.maxUsers || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, maxUsers: e.target.value ? parseInt(e.target.value) : undefined }))}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Invoices/Month (Optional)"
                value={formData.maxInvoices || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, maxInvoices: e.target.value ? parseInt(e.target.value) : undefined }))}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Features
              </Typography>
              <Box display="flex" gap={1} mb={2}>
                <TextField
                  size="small"
                  placeholder="Add a feature"
                  value={formData.newFeature}
                  onChange={(e) => setFormData(prev => ({ ...prev, newFeature: e.target.value }))}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddFeature()
                    }
                  }}
                />
                <Button onClick={handleAddFeature} variant="outlined" size="small">
                  Add
                </Button>
              </Box>
              <Box display="flex" gap={1} flexWrap="wrap">
                {formData.features.map((feature, index) => (
                  <Chip
                    key={index}
                    label={feature}
                    onDelete={() => handleRemoveFeature(index)}
                    size="small"
                  />
                ))}
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                }
                label="Active"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublic}
                    onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                  />
                }
                label="Public (Visible to all clients)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={!formData.name || formData.monthlyPrice <= 0}
          >
            {editingPlan ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Subscription Plan</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. The plan will be marked as inactive and hidden from clients.
          </Alert>
          <Typography>
            Are you sure you want to delete the plan "{planToDelete?.name}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
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