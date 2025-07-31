'use client'

import { useState, use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { InvoiceForm } from '@/components/invoices/invoice-form'

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
  
  // Fetch invoice data with error handling
  const { data: invoice, isLoading: invoiceLoading, error: invoiceError } = api.invoices.getById.useQuery({ id })
  
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
  
  // Update invoice mutation with better error handling
  const updateInvoiceMutation = api.invoices.update.useMutation({
    onSuccess: (updatedInvoice) => {
      utils.invoices.list.invalidate()
      utils.invoices.getById.invalidate({ id })
      router.push(`/invoices/${updatedInvoice.id}`)
    },
    onError: (error) => {
      console.error('Failed to update invoice:', error)
      alert(`Failed to update invoice: ${error.message}`)
    },
  })
  
  const handleSubmit = async (data: any) => {
    try {
      const lineItems = data.lineItems.filter((item: any) => 
        item.description && item.quantity > 0 && item.rate > 0
      )
      
      if (lineItems.length === 0) {
        alert('Please add at least one valid line item')
        return
      }
      
      // Use manual exchange rate if provided, otherwise use fetched rate
      const exchangeRate = manualExchangeRate || exchangeRateData?.rate || invoice?.exchangeRate || 1
      const exchangeRateSource = exchangeRateData?.source || (manualExchangeRate ? 'Manual' : invoice?.exchangeSource || 'Manual')
      
      if (!exchangeRate && data.currency !== 'INR') {
        alert('Please enter an exchange rate before updating the invoice')
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
  }
  
  const handleCancel = () => {
    router.push(`/invoices/${id}`)
  }
  
  // Handle loading states
  if (invoiceLoading || clientsLoading || lutsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }
  
  // Handle error states
  if (invoiceError) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">Error loading invoice: {invoiceError.message}</div>
      </div>
    )
  }
  
  if (!invoice) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">Invoice not found</div>
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
    />
  )
}
