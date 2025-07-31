'use client'

import { useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { enqueueSnackbar } from 'notistack'

// Type for the form data that matches what InvoiceForm expects
interface InvoiceFormData {
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
  exchangeRate?: number
}


function EditInvoiceContent({ id }: { id: string }) {
  const router = useRouter()
  
  // Fetch invoice data with error handling
  const { 
    data: invoice, 
    isLoading,
    error
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
  
  // Update mutation
  const updateMutation = api.invoices.update.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Invoice updated successfully', { variant: 'success' })
      router.push(`/invoices/${id}`)
    },
    onError: (error) => {
      enqueueSnackbar(error.message, { variant: 'error' })
    },
  })
  
  // Add submit handler
  const handleSubmit = useCallback((formData: InvoiceFormData) => {
    if (!invoice?.id) return
    
    updateMutation.mutate({
      id: invoice.id,
      clientId: formData.clientId,
      lutId: formData.lutId,
      issueDate: new Date(formData.issueDate),
      dueDate: new Date(formData.dueDate),
      currency: formData.currency,
      paymentTerms: formData.paymentTerms,
      lineItems: formData.lineItems,
      bankDetails: formData.bankDetails,
      notes: formData.notes,
      exchangeRate: formData.currency !== 'INR' ? (manualExchangeRate || exchangeRateData?.rate || formData.exchangeRate) : 1,
    })
  }, [invoice?.id, updateMutation, manualExchangeRate, exchangeRateData?.rate])
  
  if (isLoading || clientsLoading || lutsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Loading invoice...</div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">Error loading invoice: {error.message}</div>
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
  
  // Extract line items properly
  const lineItems = invoice.lineItems.map((item) => ({
    id: item.id,
    description: item.description,
    sacCode: item.serviceCode,
    quantity: typeof item.quantity === 'object' && 'toNumber' in item.quantity ? item.quantity.toNumber() : Number(item.quantity),
    rate: typeof item.rate === 'object' && 'toNumber' in item.rate ? item.rate.toNumber() : Number(item.rate),
    amount: typeof item.amount === 'object' && 'toNumber' in item.amount ? item.amount.toNumber() : Number(item.amount),
  }))
  
  const initialData = {
    clientId: invoice.clientId,
    lutId: invoice.lutId || '',
    issueDate: invoice.invoiceDate.toISOString().split('T')[0],
    dueDate: invoice.dueDate.toISOString().split('T')[0],
    currency: invoice.currency,
    paymentTerms: 30, // Default to 30 days
    lineItems,
    bankDetails: invoice.bankDetails || '',
    notes: invoice.notes || '',
  }
  
  const exchangeRateInfo = selectedCurrency !== 'INR' && (manualExchangeRate || exchangeRateData?.rate) ? {
    rate: manualExchangeRate || exchangeRateData?.rate || 1,
    source: manualExchangeRate ? 'manual' : exchangeRateData?.source || 'manual',
    date: exchangeRateData?.date || new Date(),
  } : null
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Edit Invoice</h1>
      <InvoiceForm
        initialData={initialData}
        clients={clients || []}
        luts={luts || []}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/invoices/${id}`)}
        onCurrencyChange={setSelectedCurrency}
        exchangeRate={exchangeRateInfo}
        manualExchangeRate={manualExchangeRate}
        onManualExchangeRateChange={setManualExchangeRate}
      />
    </div>
  )
}

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
  
  return <EditInvoiceContent id={id} />
}