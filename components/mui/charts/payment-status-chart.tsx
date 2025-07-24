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
  Chip,
} from '@mui/material'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

interface PaymentStatusChartProps {
  data: Array<{
    status: string
    count: number
    amount: number
  }>
  loading?: boolean
}

const STATUS_COLORS = {
  draft: '#9E9E9E',
  sent: '#2196F3',
  viewed: '#FF9800',
  paid: '#4CAF50',
  overdue: '#F44336',
  cancelled: '#757575',
} as const

const STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
} as const

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    payload: {
      status: string
      count: number
      amount: number
    }
  }>
}

const CustomTooltip = React.memo(({ active, payload }: TooltipProps) => {
  const theme = useTheme()
  
  if (active && payload && payload.length && payload[0]) {
    const data = payload[0].payload
    const label = STATUS_LABELS[data.status as keyof typeof STATUS_LABELS] || data.status
    
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
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Count: {data.count}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Amount: {formatCurrency(data.amount)}
        </Typography>
      </Box>
    )
  }
  return null
})

CustomTooltip.displayName = 'CustomTooltip'

interface LegendPayload {
  value: string
  type: string
  color: string
  payload?: {
    count: number
    amount: number
  }
}

const CustomLegend = (props: any) => {
  const { payload } = props
  const theme = useTheme()
  
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
      {payload?.map((entry: LegendPayload, index: number) => {
        const label = STATUS_LABELS[entry.value as keyof typeof STATUS_LABELS] || entry.value
        const count = entry.payload?.count || 0
        
        return (
          <Chip
            key={`item-${index}`}
            label={`${label} (${count})`}
            size="small"
            sx={{
              backgroundColor: alpha(entry.color, 0.1),
              color: entry.color,
              fontWeight: 500,
              '& .MuiChip-label': {
                px: 1.5,
              },
            }}
          />
        )
      })}
    </Box>
  )
}

export function MUIPaymentStatusChart({ data, loading = false }: PaymentStatusChartProps) {
  const theme = useTheme()
  
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
          <Skeleton variant="circular" width={250} height={250} sx={{ mx: 'auto' }} />
        </CardContent>
      </Card>
    )
  }

  // Filter out statuses with 0 count
  const filteredData = data.filter(item => item.count > 0)

  if (filteredData.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Payment Status Breakdown
          </Typography>
          <Box 
            sx={{ 
              height: 300, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Typography variant="body1" color="text.secondary">
              No invoice data available
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
          Payment Status Breakdown
        </Typography>
        <Box sx={{ width: '100%', height: 300, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filteredData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {filteredData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || theme.palette.grey[500]} 
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  )
}