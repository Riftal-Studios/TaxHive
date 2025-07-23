'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

interface PaymentStatusChartProps {
  data: Array<{
    status: string
    count: number
    amount: number
  }>
  loading?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  PAID: '#10b981',
  SENT: '#f59e0b',
  PARTIALLY_PAID: '#3b82f6',
  DRAFT: '#6b7280',
  OVERDUE: '#ef4444',
  CANCELLED: '#9ca3af',
}

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Paid',
  SENT: 'Sent',
  PARTIALLY_PAID: 'Partially Paid',
  DRAFT: 'Draft',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
}

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
    name: string
    value: number
    payload: {
      count: number
    }
  }>
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0]
    return (
      <div className="bg-white dark:bg-gray-800 p-3 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {STATUS_LABELS[data.name] || data.name}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Count: {data.payload.count}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Amount: {formatCurrency(data.value)}
        </p>
      </div>
    )
  }
  return null
}

export default function PaymentStatusChart({ data, loading = false }: PaymentStatusChartProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow animate-pulse">
        <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48 mb-4"></div>
        <div className="h-64 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    )
  }

  const chartData = data.map(item => ({
    name: item.status,
    value: item.amount,
    count: item.count,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Payment Status Breakdown
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              formatter={(value) => STATUS_LABELS[value] || value}
              wrapperStyle={{ paddingTop: '10px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}