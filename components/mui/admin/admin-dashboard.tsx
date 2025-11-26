'use client'

import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Skeleton,
  Tabs,
  Tab,
  Chip,
} from '@mui/material'
import {
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Feedback as FeedbackIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import Link from 'next/link'
import { useState } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color?: string
}

function StatCard({ title, value, subtitle, icon, color = 'primary.main' }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={600}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}15`,
              borderRadius: 2,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ color }}>{icon}</Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState(0)
  const { data: userStats, isLoading: userStatsLoading } = api.admin.getUserStats.useQuery()
  const { data: systemMetrics, isLoading: metricsLoading } = api.admin.getSystemMetrics.useQuery()

  const isLoading = userStatsLoading || metricsLoading

  if (isLoading) {
    return (
      <Box>
        <Box mb={4}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="text" width={300} height={24} />
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
          Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          System overview and management
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Overview" />
          <Tab label="Users" component={Link} href="/admin/users" />
          <Tab label="Feedback" component={Link} href="/admin/feedback" />
        </Tabs>
      </Box>

      {/* User Stats */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        User Statistics
      </Typography>
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Users"
            value={userStats?.totalUsers ?? 0}
            subtitle={`${userStats?.newUsersThisMonth ?? 0} this month`}
            icon={<PeopleIcon />}
            color="primary.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Verified Users"
            value={userStats?.verifiedUsers ?? 0}
            subtitle={`${userStats?.unverifiedUsers ?? 0} unverified`}
            icon={<PeopleIcon />}
            color="success.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="New This Week"
            value={userStats?.newUsersThisWeek ?? 0}
            icon={<TrendingUpIcon />}
            color="info.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Onboarding Rate"
            value={`${(userStats?.onboardingRate ?? 0).toFixed(1)}%`}
            subtitle={`${userStats?.completedOnboarding ?? 0} completed`}
            icon={<TrendingUpIcon />}
            color="warning.main"
          />
        </Grid>
      </Grid>

      {/* System Metrics */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        System Metrics
      </Typography>
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Revenue"
            value={formatCurrency(systemMetrics?.revenue.totalINR ?? 0)}
            subtitle={`${formatCurrency(systemMetrics?.revenue.thisMonthINR ?? 0)} this month`}
            icon={<TrendingUpIcon />}
            color="success.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Invoices"
            value={systemMetrics?.invoices.total ?? 0}
            subtitle={`${systemMetrics?.invoices.thisMonth ?? 0} this month`}
            icon={<ReceiptIcon />}
            color="primary.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Active Clients"
            value={systemMetrics?.clients.active ?? 0}
            subtitle={`${systemMetrics?.clients.total ?? 0} total`}
            icon={<BusinessIcon />}
            color="info.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Invoice Status
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                    {Object.entries(systemMetrics?.invoices.byStatus ?? {}).map(([status, count]) => (
                      <Chip
                        key={status}
                        label={`${status}: ${count}`}
                        size="small"
                        color={
                          status === 'PAID' ? 'success' :
                          status === 'SENT' ? 'info' :
                          status === 'OVERDUE' ? 'error' :
                          'default'
                        }
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
                <Box
                  sx={{
                    backgroundColor: 'secondary.main15',
                    borderRadius: 2,
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FeedbackIcon color="secondary" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Links */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        Quick Actions
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            component={Link}
            href="/admin/users"
            sx={{
              textDecoration: 'none',
              '&:hover': { backgroundColor: 'action.hover' },
              cursor: 'pointer',
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <PeopleIcon color="primary" />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Manage Users
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    View and manage all user accounts
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            component={Link}
            href="/admin/feedback"
            sx={{
              textDecoration: 'none',
              '&:hover': { backgroundColor: 'action.hover' },
              cursor: 'pointer',
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <FeedbackIcon color="primary" />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Review Feedback
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage user feedback and issues
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
