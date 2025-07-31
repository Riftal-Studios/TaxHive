'use client'

import React, { useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { format } from 'date-fns'

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

const CustomTooltip = React.memo(function CustomTooltip({ active, payload, label }: TooltipProps) {
  const formatCurrency = useCurrencyFormatter()
  const formatMonth = useMonthFormatter()
  
  if (active && payload && payload.length && payload[0]) {
    const formattedMonth = label ? formatMonth(label) : ''
    const revenue = payload[0].value || 0
    const invoiceCount = payload[0].payload?.invoiceCount || 0
    
    return (
      <div 
        style={{
          backgroundColor: '#fff',
          padding: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}
        role="tooltip"
      >
        <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', marginBottom: '4px' }}>
          {formattedMonth}
        </p>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '2px' }}>
          Revenue: {formatCurrency.format(revenue)}
        </p>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Invoices: {invoiceCount}
        </p>
      </div>
    )
  }
  return null
})

CustomTooltip.displayName = 'CustomTooltip'

export default function RevenueChart({ data, loading = false, error = null }: RevenueChartProps) {
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="text-center py-8">
          <div className="text-red-500 dark:text-red-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            Error Loading Data
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {error}
          </p>
        </div>
      </div>
    )
  }
  
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow animate-pulse">
        <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48 mb-4"></div>
        <div className="h-64 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No Revenue Data
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Start creating invoices to see your revenue trend
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Revenue Trend
      </h3>
      <div className="h-64" role="img" aria-label="Revenue trend chart">
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
            <CartesianGrid 
              strokeDasharray="3 3" 
              className="stroke-gray-200 dark:stroke-gray-700" 
              strokeOpacity={0.3}
            />
            <XAxis
              dataKey="displayMonth"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              axisLine={{ stroke: 'currentColor', opacity: 0.3 }}
              tickLine={{ stroke: 'currentColor', opacity: 0.3 }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              axisLine={{ stroke: 'currentColor', opacity: 0.3 }}
              tickLine={{ stroke: 'currentColor', opacity: 0.3 }}
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              fillOpacity={1}
              fill="url(#colorRevenue)"
              strokeWidth={2}
              dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
