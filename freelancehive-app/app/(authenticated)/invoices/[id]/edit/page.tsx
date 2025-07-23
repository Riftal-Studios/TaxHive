'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { InvoiceForm } from '@/components/invoices/invoice-form'

export default function EditInvoicePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const utils = api.useUtils()
  
  // Fetch invoice data
  const { data: invoice, isLoading: invoiceLoading } = api.invoices.getById.useQuery({ id: params.id })
  
  // Fetch clients and LUTs
  const { data: clients, isLoading: clientsLoading } = api.clients.list.useQuery()
  const { data: luts, isLoading: lutsLoading } = api.luts.list.useQuery()
  
  // Get exchange rate query
  const [selectedCurrency, setSelectedCurrency] = useState(invoice?.currency || 'USD')
  const [manualExchangeRate, setManualExchangeRate] = useState<number | null>(null)
  const { data: exchangeRateData } = api.invoices.getCurrentExchangeRate.useQuery({
    currency: selectedCurrency,
  }, {
    enabled: !!selectedCurrency && selectedCurrency !== 'INR',
  })
  
  // Update invoice mutation
  const updateInvoiceMutation = api.invoices.update.useMutation({
    onSuccess: (updatedInvoice) => {
      utils.invoices.list.invalidate()
      utils.invoices.getById.invalidate({ id: params.id })
      router.push(`/invoices/${updatedInvoice.id}`)
    },
    onError: (error) => {
      console.error('Failed to update invoice:', error)
      alert(`Failed to update invoice: ${error.message}`)
    },
  })
  
  const handleSubmit = async (data: {
    clientId: string
    lutId: string
    issueDate: string
    dueDate: string
    currency: string
    paymentTerms: number
    lineItems: Array<{
      description: string
      sacCode: string
      quantity: number
      rate: number
    }>
    bankDetails: string
    notes: string
  }) => {
    try {
      // Get exchange rate from fetched data or manual entry
      const exchangeRate = exchangeRateData?.rate || manualExchangeRate || Number(invoice?.exchangeRate)
      const exchangeRateSource = exchangeRateData?.source || (manualExchangeRate ? 'Manual' : invoice?.exchangeSource || 'Manual')
      
      if (!exchangeRate && data.currency !== 'INR') {
        alert('Please enter an exchange rate before updating the invoice')
        return
      }
      
      await updateInvoiceMutation.mutateAsync({
        id: params.id,
        clientId: data.clientId,
        lutId: data.lutId || undefined,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        currency: data.currency,
        exchangeRate: data.currency === 'INR' ? 1 : exchangeRate,
        exchangeRateSource: data.currency === 'INR' ? 'Not applicable' : exchangeRateSource,
        paymentTerms: data.paymentTerms,
        bankDetails: data.bankDetails,
        notes: data.notes,
        lineItems: data.lineItems.map((item) => ({
          description: item.description,
          sacCode: item.sacCode,
          quantity: item.quantity,
          rate: item.rate,
        })),
      })
    } catch {
      // Error is handled by the mutation onError
    }
  }
  
  const handleCancel = () => {
    router.push(`/invoices/${params.id}`)
  }
  
  if (invoiceLoading || clientsLoading || lutsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }
  
  if (!invoice || !clients) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-900 dark:text-red-200">
              Invoice not found
            </h3>
            <button
              onClick={() => router.push('/invoices')}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
            >
              Back to Invoices
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Transform invoice data for the form
  const initialFormData = {
    clientId: invoice.clientId,
    lutId: invoice.lutId || '',
    issueDate: new Date(invoice.invoiceDate).toISOString().split('T')[0],
    dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
    currency: invoice.currency,
    paymentTerms: parseInt(invoice.paymentTerms || '30'),
    lineItems: invoice.lineItems.map(item => ({
      id: item.id,
      description: item.description,
      sacCode: item.serviceCode,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      amount: Number(item.amount),
    })),
    bankDetails: invoice.bankDetails || '',
    notes: invoice.notes || '',
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Invoice</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Invoice Number: <span className="font-medium">{invoice.invoiceNumber}</span>
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <InvoiceForm
            clients={clients}
            luts={luts || []}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onCurrencyChange={setSelectedCurrency}
            exchangeRate={exchangeRateData}
            manualExchangeRate={manualExchangeRate}
            onManualExchangeRateChange={setManualExchangeRate}
            initialData={initialFormData}
          />
        </div>
      </div>
    </div>
  )
}