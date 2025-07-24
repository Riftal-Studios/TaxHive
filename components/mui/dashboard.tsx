'use client'

import React from 'react'
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Skeleton,
  useTheme,
  alpha,
  Theme,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  CurrencyRupee,
  Description,
  People,
  Schedule,
  Receipt,
  Assessment,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { MUIRevenueChart } from './charts/revenue-chart'
import { MUIPaymentStatusChart } from './charts/payment-status-chart'
import { MUIRecentInvoices } from './recent-invoices'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  loading?: boolean
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'
}

function MetricCard({ title, value, subtitle, icon: Icon, loading, trend, color = 'primary' }: MetricCardProps) {
  const theme = useTheme()
  
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="rectangular" height={120} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card 
      sx={{ 
        height: '100%',
        transition: 'all 0.3s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[4],
        }
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight={600} color={`${color}.main`}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                {trend.isPositive ? (
                  <TrendingUp fontSize="small" color="success" />
                ) : (
                  <TrendingDown fontSize="small" color="error" />
                )}
                <Typography 
                  variant="body2" 
                  color={trend.isPositive ? 'success.main' : 'error.main'}
                  fontWeight={500}
                >
                  {trend.value}%
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: (theme: Theme) => theme.palette.mode === 'dark' 
                ? alpha(theme.palette[color].main, 0.2)
                : theme.palette[color].main,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sx={{ 
              color: (theme: Theme) => theme.palette.mode === 'dark'
                ? theme.palette[color].main
                : 'white',
              fontSize: 28 
            }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function MUIDashboard() {
  // Fetch all dashboard data
  const { data: metrics, isLoading: metricsLoading } = api.dashboard.getMetrics.useQuery()
  const { data: recentInvoices, isLoading: invoicesLoading } = api.dashboard.getRecentInvoices.useQuery({ limit: 5 })
  const { data: paymentStatus, isLoading: statusLoading } = api.dashboard.getPaymentStatusBreakdown.useQuery()
  const { data: revenueByMonth, isLoading: revenueLoading } = api.dashboard.getRevenueByMonth.useQuery({ months: 6 })


  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview of your freelance business performance
        </Typography>
      </Box>
      {/* Metric Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid
          size={{
            xs: 12,
            sm: 6,
            lg: 4
          }}>
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(metrics?.revenue.total || 0)}
            subtitle="All time earnings"
            icon={CurrencyRupee}
            loading={metricsLoading}
            color="success"
          />
        </Grid>
        
        <Grid
          size={{
            xs: 12,
            sm: 6,
            lg: 4
          }}>
          <MetricCard
            title="Total Invoices"
            value={metrics?.totalInvoices.allTime || 0}
            subtitle={`${metrics?.totalInvoices.thisMonth || 0} this month`}
            icon={Description}
            loading={metricsLoading}
            color="primary"
          />
        </Grid>
        
        <Grid
          size={{
            xs: 12,
            sm: 6,
            lg: 4
          }}>
          <MetricCard
            title="Active Clients"
            value={metrics?.activeClients || 0}
            subtitle="Currently active"
            icon={People}
            loading={metricsLoading}
            color="info"
          />
        </Grid>
        
        <Grid
          size={{
            xs: 12,
            sm: 6,
            lg: 4
          }}>
          <MetricCard
            title="Pending Payments"
            value={formatCurrency(metrics?.pendingPayments.amount || 0)}
            subtitle={`${metrics?.pendingPayments.count || 0} invoices`}
            icon={Schedule}
            loading={metricsLoading}
            color="warning"
          />
        </Grid>
        
        <Grid
          size={{
            xs: 12,
            sm: 6,
            lg: 4
          }}>
          <MetricCard
            title="Overdue Invoices"
            value={metrics?.overdueInvoices.count || 0}
            subtitle={formatCurrency(metrics?.overdueInvoices.amount || 0)}
            icon={Receipt}
            loading={metricsLoading}
            color="error"
            trend={metrics?.overdueInvoices.count ? { value: 0, isPositive: false } : undefined}
          />
        </Grid>
        
        <Grid
          size={{
            xs: 12,
            sm: 6,
            lg: 4
          }}>
          <MetricCard
            title="Average Invoice"
            value={formatCurrency(metrics?.averageInvoiceValue || 0)}
            subtitle="Per invoice"
            icon={Assessment}
            loading={metricsLoading}
            color="secondary"
          />
        </Grid>
      </Grid>
      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid
          size={{
            xs: 12,
            lg: 6
          }}>
          <MUIRevenueChart
            data={revenueByMonth || []}
            loading={revenueLoading}
          />
        </Grid>
        
        <Grid
          size={{
            xs: 12,
            lg: 6
          }}>
          <MUIPaymentStatusChart
            data={paymentStatus || []}
            loading={statusLoading}
          />
        </Grid>
      </Grid>
      {/* Recent Invoices */}
      <MUIRecentInvoices
        invoices={recentInvoices || []}
        loading={invoicesLoading}
      />
    </Box>
  );
}