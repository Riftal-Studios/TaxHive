'use client'

import Link from 'next/link'
import { format } from 'date-fns'

interface RecentInvoicesProps {
  invoices: Array<{
    id: string
    invoiceNumber: string
    invoiceDate: Date
    amount: number
    status: string
    clientName: string
    companyName: string | null
  }>
  loading?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  SENT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  PARTIALLY_PAID: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
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

export default function RecentInvoices({ invoices, loading = false }: RecentInvoicesProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg animate-pulse">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48"></div>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-6 py-4">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Recent Invoices
          </h3>
          <Link
            href="/invoices"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
          >
            View all
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No invoices found
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div>
                      <div>{invoice.clientName}</div>
                      {invoice.companyName && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {invoice.companyName}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatCurrency(invoice.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 text-xs leading-5 font-semibold rounded-full ${
                        STATUS_COLORS[invoice.status] || STATUS_COLORS.DRAFT
                      }`}
                    >
                      {STATUS_LABELS[invoice.status] || invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}