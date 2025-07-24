'use client'

import React from 'react'
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
      return monthStr // Return original if not in expected format
    }
    const [year, month] = parts
    const yearNum = parseInt(year)
    const monthNum = parseInt(month)
    
    // Validate year and month
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
      return monthStr // Return original if invalid
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

const CustomTooltip = React.memo(function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length && payload[0]) {
    const formattedMonth = label ? formatMonth(label) : ''
    const revenue = payload[0].value || 0
    const invoiceCount = payload[0].payload?.invoiceCount || 0
    
    return (
      <div style={{
        backgroundColor: '#fff',
        padding: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', marginBottom: '4px' }}>
          {formattedMonth}
        </p>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '2px' }}>
          Revenue: {formatCurrency(revenue)}
        </p>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Invoices: {invoiceCount}
        </p>
      </div>
    )
  }
  return null
})

export default function RevenueChart({ data, loading = false }: RevenueChartProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow animate-pulse">
        <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48 mb-4"></div>
        <div className="h-64 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    )
  }

  const chartData = data.map(item => ({
    ...item,
    displayMonth: item.month ? formatMonth(item.month) : 'Invalid',
    revenue: item.revenue || 0,
    invoiceCount: item.invoiceCount || 0,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Revenue Trend
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="displayMonth"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              axisLine={{ stroke: 'currentColor' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              axisLine={{ stroke: 'currentColor' }}
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}