'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Payment as PaymentIcon,
  Assignment as ComplianceIcon,
  Settings as ConfigIcon,
  Assessment as ReportsIcon,
  Add as AddIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material'

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
      id={`rcm-tabpanel-${index}`}
      aria-labelledby={`rcm-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function RCMManagementPage() {
  const [tabValue, setTabValue] = useState(0)

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  // Mock data for demonstration
  const complianceScore = 78
  const pendingPayments = 5
  const upcomingDueDate = '20th Dec 2024'
  const totalLiability = 245000

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        RCM Management
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Manage Reverse Charge Mechanism compliance, payments, and reporting
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mt: 1, mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ComplianceIcon color="primary" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Compliance Score
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={600}>
                {complianceScore}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={complianceScore} 
                sx={{ mt: 1, height: 8, borderRadius: 1 }}
                color={complianceScore >= 75 ? 'success' : 'warning'}
              />
              <Chip 
                label="GOOD" 
                color={complianceScore >= 75 ? 'success' : 'warning'}
                size="small"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PaymentIcon color="error" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Pending Payments
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={600}>
                {pendingPayments}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Next due: {upcomingDueDate}
              </Typography>
              {pendingPayments > 0 && (
                <Chip 
                  icon={<WarningIcon />}
                  label="Action Required" 
                  color="error"
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DashboardIcon color="primary" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Total Liability
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={600}>
                ₹{totalLiability.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                This month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SuccessIcon color="success" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  ITC Available
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={600}>
                ₹45,000
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Eligible for claim
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alert for pending actions */}
      {pendingPayments > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Action Required</AlertTitle>
          You have {pendingPayments} pending RCM payments. The next payment of ₹45,000 is due on {upcomingDueDate}.
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="RCM management tabs">
          <Tab icon={<DashboardIcon />} label="Dashboard" />
          <Tab icon={<PaymentIcon />} label="Payments" />
          <Tab icon={<ComplianceIcon />} label="Compliance" />
          <Tab icon={<ConfigIcon />} label="Configuration" />
          <Tab icon={<ReportsIcon />} label="Reports" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" gutterBottom>
              RCM Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Overview of your RCM transactions, payments, and compliance status.
            </Typography>
            
            {/* Quick Actions */}
            <Box sx={{ mt: 3, mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />}
                  onClick={() => window.location.href = '/rcm/self-invoice/new'}
                >
                  Generate Self-Invoice
                </Button>
                <Button 
                  variant="outlined"
                  onClick={() => window.location.href = '/rcm/self-invoice'}
                >
                  Manage Self-Invoices
                </Button>
                <Button 
                  variant="outlined"
                  onClick={() => window.location.href = '/purchases/new'}
                >
                  Record Purchase
                </Button>
              </Box>
            </Box>
            
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Recent RCM Transactions
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No recent transactions to display. Add purchase invoices to track RCM.
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Upcoming Due Dates
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    RCM Payment: {upcomingDueDate} - ₹45,000
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  RCM Payments
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Track and manage your RCM payment liabilities.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  startIcon={<AddIcon />}
                  onClick={() => window.location.href = '/rcm/self-invoice/new'}
                >
                  Create Self-Invoice
                </Button>
                <Button 
                  variant="outlined"
                  onClick={() => window.location.href = '/rcm/self-invoice'}
                >
                  View Self-Invoices
                </Button>
                <Button variant="contained" startIcon={<AddIcon />}>
                  Record Payment
                </Button>
              </Box>
            </Box>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No payments recorded yet. Start by adding purchase invoices with RCM applicability.
              </Typography>
            </Paper>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom>
              Compliance Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Monitor your RCM compliance status and get actionable insights.
            </Typography>
            
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Payment Compliance
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    70%
                  </Typography>
                  <LinearProgress variant="determinate" value={70} sx={{ mt: 1 }} />
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Filing Compliance
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    83%
                  </Typography>
                  <LinearProgress variant="determinate" value={83} sx={{ mt: 1 }} />
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Documentation
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    85%
                  </Typography>
                  <LinearProgress variant="determinate" value={85} sx={{ mt: 1 }} />
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Typography variant="h6" gutterBottom>
              RCM Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Configure RCM rules, notified services, and thresholds.
            </Typography>
            
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Notified Services
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure services and goods under RCM as per notification.
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 2 }}>
                    Manage Notified List
                  </Button>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Vendor Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage registered and unregistered vendors for RCM.
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 2 }}>
                    Manage Vendors
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <Typography variant="h6" gutterBottom>
              RCM Reports
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Generate RCM reports for GSTR-3B and compliance analysis.
            </Typography>
            
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    GSTR-3B RCM Section
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Generate Table 3.1(d) and Table 4(B) for GSTR-3B filing.
                  </Typography>
                  <Button variant="contained" sx={{ mt: 2 }}>
                    Generate Report
                  </Button>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    RCM Payment Report
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    View detailed RCM payment history and pending liabilities.
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 2 }}>
                    View Report
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  )
}