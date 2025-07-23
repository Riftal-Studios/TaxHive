'use client'

import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { format } from 'date-fns'

interface RevenueChartProps {
  data: Array<{
    month: string
    revenue: number
    invoiceCount: number
  }>
  loading?: boolean
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatMonth(monthStr: string): string {
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
    console.error('Error formatting month:', error)
    return monthStr || 'Invalid Date'
  }
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
      >
        <Typography variant="body2" fontWeight={600} gutterBottom>
          {formattedMonth}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Revenue: {formatCurrency(revenue)}
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

export function MUIRevenueChart({ data, loading = false }: RevenueChartProps) {
  const theme = useTheme()
  
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

  const chartData = data.map(item => ({
    ...item,
    displayMonth: item.month ? formatMonth(item.month) : 'Invalid',
    revenue: item.revenue || 0,
    invoiceCount: item.invoiceCount || 0,
  }))

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Revenue Trend
        </Typography>
        <Box sx={{ width: '100%', height: 300, mt: 2 }}>
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
              />
              <XAxis
                dataKey="displayMonth"
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                axisLine={{ stroke: theme.palette.divider }}
                tickLine={{ stroke: theme.palette.divider }}
              />
              <YAxis
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                axisLine={{ stroke: theme.palette.divider }}
                tickLine={{ stroke: theme.palette.divider }}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={theme.palette.primary.main}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  )
}