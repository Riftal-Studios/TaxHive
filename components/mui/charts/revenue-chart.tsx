'use client'

import React, { useMemo } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Skeleton,
  useTheme,
  Alert,
  AlertTitle,
} from '@mui/material'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { format } from 'date-fns'
import Logger from '@/lib/logger'

interface RevenueChartProps {
  data: Array<{
    month: string
    revenue: number
    invoiceCount: number
  }>
  loading?: boolean
  error?: string | null
}

// Memoize currency formatting function
const useCurrencyFormatter = () => {
  return useMemo(() => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }, [])
}

// Memoize month formatting function
const useMonthFormatter = () => {
  return useMemo(() => {
    return (monthStr: string): string => {
      try {
        if (!monthStr || typeof monthStr !== 'string') {
          return 'Invalid Date'
        }
        const parts = monthStr.split('-')
        if (parts.length !== 2) {
          return monthStr
        }
        const [year, month] = parts
        const yearNum = parseInt(year)
        const monthNum = parseInt(month)
        
        if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
          return monthStr
        }
        
        const date = new Date(yearNum, monthNum - 1)
        if (isNaN(date.getTime())) {
          return monthStr
        }
        return format(date, 'MMM yyyy')
      } catch (error) {
        Logger.error('Error formatting month:', error)
        return monthStr || 'Invalid Date'
      }
    }
  }, [])
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    payload: {
      invoiceCount: number
    }
  }>
  label?: string
}

const CustomTooltip = React.memo(({ active, payload, label }: TooltipProps) => {
  const theme = useTheme()
  const formatCurrency = useCurrencyFormatter()
  const formatMonth = useMonthFormatter()
  
  if (active && payload && payload.length && payload[0]) {
    const formattedMonth = label ? formatMonth(label) : ''
    const revenue = payload[0].value || 0
    const invoiceCount = payload[0].payload?.invoiceCount || 0
    
    return (
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          p: 2,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          boxShadow: theme.shadows[4],
        }}
        role="tooltip"
      >
        <Typography variant="body2" fontWeight={600} gutterBottom>
          {formattedMonth}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Revenue: {formatCurrency.format(revenue)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Invoices: {invoiceCount}
        </Typography>
      </Box>
    )
  }
  return null
})

CustomTooltip.displayName = 'CustomTooltip'

const MUIRevenueChartComponent = ({ data, loading = false, error = null }: RevenueChartProps) => {
  const theme = useTheme()
  const formatMonth = useMonthFormatter()
  
  // Memoize chart data transformation
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    return data.map(item => ({
      ...item,
      displayMonth: item.month ? formatMonth(item.month) : 'Invalid',
      revenue: item.revenue || 0,
      invoiceCount: item.invoiceCount || 0,
    }))
  }, [data, formatMonth])
  
  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            <AlertTitle>Error Loading Data</AlertTitle>
            {error}
          </Alert>
        </CardContent>
      </Card>
    )
  }
  
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={300} />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ color: 'text.disabled', mb: 2 }}>
              <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </Box>
            <Typography variant="h6" gutterBottom>
              No Revenue Data
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start creating invoices to see your revenue trend
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Revenue Trend
        </Typography>
        <Box sx={{ width: '100%', height: 300, mt: 2 }} role="img" aria-label="Revenue trend chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={theme.palette.divider}
                strokeOpacity={0.3}
              />
              <XAxis
                dataKey="displayMonth"
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                axisLine={{ stroke: theme.palette.divider, opacity: 0.3 }}
                tickLine={{ stroke: theme.palette.divider, opacity: 0.3 }}
              />
              <YAxis
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                axisLine={{ stroke: theme.palette.divider, opacity: 0.3 }}
                tickLine={{ stroke: theme.palette.divider, opacity: 0.3 }}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={theme.palette.primary.main}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                strokeWidth={2}
                dot={{ fill: theme.palette.primary.main, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: theme.palette.primary.main, strokeWidth: 2, fill: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const MUIRevenueChart = React.memo(MUIRevenueChartComponent, (prevProps, nextProps) => {
  return (
    prevProps.loading === nextProps.loading &&
    prevProps.error === nextProps.error &&
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
  )
})
