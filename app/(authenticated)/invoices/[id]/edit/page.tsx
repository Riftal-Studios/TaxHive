'use client'

import { useState, use, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { enqueueSnackbar } from 'notistack'

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  // Properly unwrap params with error handling
  let id: string
  try {
    const resolvedParams = use(params)
    id = resolvedParams.id
  } catch (error) {
    console.error('Error resolving params:', error)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">Invalid invoice ID</div>
      </div>
    )
  }

  const router = useRouter()
  const utils = api.useUtils()
  const [autoSaveData, setAutoSaveData] = useState<any>(null)
  
  // Fetch invoice data with error handling
  const { 
    data: invoice, 
    isLoading: invoiceLoading, 
    error: invoiceError,
    refetch: refetchInvoice
  } = api.invoices.getById.useQuery({ id })
  
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
  
  // Auto-save mutation
  const autoSaveMutation = api.invoices.autoSave.useMutation({
    onSuccess: (data) => {
      enqueueSnackbar('Draft auto-saved', { variant: 'success' })
      utils.invoices.getById.invalidate({ id })
    },
    onError: (error) => {
      console.error('Auto-save failed:', error)
      enqueueSnackbar('Failed to auto-save draft', { variant: 'error' })
    },
  })
  
  // Update invoice mutation with better error handling
  const updateInvoiceMutation = api.invoices.update.useMutation({
    onSuccess: (updatedInvoice) => {
      enqueueSnackbar('Invoice updated successfully', { variant: 'success' })
      utils.invoices.list.invalidate()
      utils.invoices.getById.invalidate({ id })
      router.push(`/invoices/${updatedInvoice.id}`)
    },
    onError: (error) => {
      console.error('Failed to update invoice:', error)
      enqueueSnackbar(`Failed to update invoice: ${error.message}`, { variant: 'error' })
    },
  })
  
  const handleSubmit = useCallback(async (data: any) => {
    try {
      const lineItems = data.lineItems.filter((item: any) => 
        item.description && item.quantity > 0 && item.rate > 0
      )
      
      if (lineItems.length === 0) {
        enqueueSnackbar('Please add at least one valid line item', { variant: 'error' })
        return
      }
      
      // Use manual exchange rate if provided, otherwise use fetched rate
      const exchangeRate = manualExchangeRate || exchangeRateData?.rate || invoice?.exchangeRate || 1
      const exchangeRateSource = exchangeRateData?.source || (manualExchangeRate ? 'Manual' : invoice?.exchangeSource || 'Manual')
      
      if (!exchangeRate && data.currency !== 'INR') {
        enqueueSnackbar('Please enter an exchange rate before updating the invoice', { variant: 'error' })
        return
      }
      
      await updateInvoiceMutation.mutateAsync({
        id: id,
        clientId: data.clientId,
        lutId: data.lutId || undefined,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        currency: data.currency,
        exchangeRate: data.currency === 'INR' ? 1 : Number(exchangeRate),
        exchangeRateSource: data.currency === 'INR' ? 'Not applicable' : exchangeRateSource,
        paymentTerms: data.paymentTerms,
        notes: data.notes || undefined,
        lineItems: lineItems.map((item: any) => ({
          description: item.description,
          hsn: item.hsn || '99719000',
          quantity: parseInt(item.quantity),
          rate: parseFloat(item.rate),
          amount: parseFloat(item.amount),
        })),
      })
    } catch (error) {
      console.error('Error in handleSubmit:', error)
      // Error is handled by the mutation onError
    }
  }, [id, invoice, exchangeRateData, manualExchangeRate, updateInvoiceMutation, enqueueSnackbar])
  
  const handleCancel = () => {
    router.push(`/invoices/${id}`)
  }

  const handleAutoSave = useCallback(async (data: any) => {
    try {
      // Only auto-save if there's meaningful data
      if (!data.clientId || data.lineItems.length === 0) {
        return
      }

      const lineItems = data.lineItems.filter((item: any) => 
        item.description && item.quantity > 0 && item.rate > 0
      )
      
      if (lineItems.length === 0) {
        return
      }
      
      await autoSaveMutation.mutateAsync({
        id: id,
        clientId: data.clientId,
        lutId: data.lutId || undefined,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        currency: data.currency,
        exchangeRate: data.currency === 'INR' ? 1 : (manualExchangeRate || exchangeRateData?.rate || 1),
        exchangeRateSource: data.currency === 'INR' ? 'Not applicable' : (exchangeRateData?.source || 'Manual'),
        paymentTerms: data.paymentTerms,
        notes: data.notes || undefined,
        lineItems: lineItems.map((item: any) => ({
          description: item.description,
          hsn: item.hsn || '99719000',
          quantity: parseInt(item.quantity),
          rate: parseFloat(item.rate),
          amount: parseFloat(item.amount),
        })),
      })
    } catch (error) {
      console.error('Auto-save error:', error)
      // Error is handled by the mutation onError
    }
  }, [id, manualExchangeRate, exchangeRateData, autoSaveMutation])
  
  // Handle loading states
  if (invoiceLoading || clientsLoading || lutsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" aria-label="Loading"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading invoice data...</p>
        </div>
      </div>
    )
  }
  
  // Handle error states
  if (invoiceError) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Error Loading Invoice
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {invoiceError.message}
          </p>
          <div className="space-x-3">
            <button
              onClick={() => refetchInvoice()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/invoices')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Back to Invoices
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  if (!invoice) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invoice Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The invoice you're looking for doesn't exist or may have been deleted.
          </p>
          <button
            onClick={() => router.push('/invoices')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Invoices
          </button>
        </div>
      </div>
    )
  }
  
  // Initialize form data with proper type checking
  const formData = {
    clientId: invoice.clientId,
    lutId: invoice.lutId || '',
    issueDate: invoice.invoiceDate.toISOString().split('T')[0],
    dueDate: invoice.dueDate.toISOString().split('T')[0],
    currency: invoice.currency,
    paymentTerms: parseInt(invoice.paymentTerms || '30'),
    notes: invoice.notes || '',
    bankDetails: '',
    lineItems: invoice.lineItems.map((item, index) => ({
      id: item.id || `item-${index}`,
      description: item.description,
      sacCode: item.serviceCode,
      hsn: item.serviceCode,
      quantity: item.quantity.toNumber(),
      rate: item.rate.toNumber(),
      amount: item.amount.toNumber(),
    })),
  }
  
  return (
    <InvoiceForm
      initialData={formData}
      clients={clients || []}
      luts={luts || []}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      onCurrencyChange={setSelectedCurrency}
      exchangeRate={exchangeRateData}
      manualExchangeRate={manualExchangeRate}
      onManualExchangeRateChange={setManualExchangeRate}
      autoSave={true}
      onAutoSave={handleAutoSave}
    />
  )
}
