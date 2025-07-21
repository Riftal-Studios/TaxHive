'use client'

import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/trpc/client'
import { InvoiceForm, type InvoiceFormData } from '@/components/invoices/invoice-form'
import { INVOICE_STATUS } from '@/lib/constants'

export default function InvoicesPage() {
  const [showForm, setShowForm] = useState(false)
  
  const utils = api.useUtils()
  const { data: invoices, isLoading } = api.invoices.list.useQuery()
  const { data: clients } = api.clients.list.useQuery()
  const { data: user } = api.users.getProfile.useQuery()
  
  // Get active LUTs
  const activeLUTs = user?.luts?.filter(
    (lut) => lut.isActive && new Date(lut.validTill) > new Date()
  ) || []
  
  const createMutation = api.invoices.create.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate()
      setShowForm(false)
    },
  })

  const handleSubmit = async (data: InvoiceFormData) => {
    await createMutation.mutateAsync(data)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case INVOICE_STATUS.DRAFT:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
      case INVOICE_STATUS.SENT:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
      case INVOICE_STATUS.PAID:
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      case INVOICE_STATUS.PARTIALLY_PAID:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
      case INVOICE_STATUS.OVERDUE:
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
      case INVOICE_STATUS.CANCELLED:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  if (isLoading || !clients) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400">Loading invoices...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Create and manage GST-compliant invoices</p>
        </div>

        {showForm ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Invoice</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            
            {!user?.gstin || !user?.pan ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
                <p className="text-yellow-800 dark:text-yellow-300">
                  Please update your GST details in settings before creating invoices.
                </p>
                <Link
                  href="/settings"
                  className="mt-2 inline-block text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 underline"
                >
                  Go to Settings →
                </Link>
              </div>
            ) : clients.length === 0 ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <p className="text-blue-800 dark:text-blue-300">
                  You need to add at least one client before creating invoices.
                </p>
                <Link
                  href="/clients"
                  className="mt-2 inline-block text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                >
                  Add Client →
                </Link>
              </div>
            ) : (
              <InvoiceForm
                clients={clients}
                luts={activeLUTs}
                onSubmit={handleSubmit}
              />
            )}
          </div>
        ) : (
          <>
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900"
              >
                Create Invoice
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
              {invoices?.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400 text-lg">No invoices found</p>
                  <p className="text-gray-400 dark:text-gray-500 mt-2">Create your first invoice to get started</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {invoices?.map((invoice) => (
                    <li key={invoice.id}>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="block hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-4 sm:px-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-3">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {invoice.invoiceNumber}
                                </p>
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                    invoice.status
                                  )}`}
                                >
                                  {invoice.status}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {invoice.client.name} • {invoice.currency}{' '}
                                {Number(invoice.totalAmount).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(invoice.invoiceDate).toLocaleDateString()}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}