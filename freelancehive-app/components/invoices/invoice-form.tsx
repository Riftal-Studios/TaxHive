'use client'

import { useState } from 'react'
import type { Client } from '@prisma/client'
import { CURRENCY_CODES } from '@/lib/constants'

interface InvoiceFormProps {
  clients: Client[]
  luts: Array<{ id: string; lutNumber: string; validTill: Date }>
  onSubmit: (data: InvoiceFormData) => void | Promise<void>
}

export interface InvoiceFormData {
  clientId: string
  invoiceDate: Date
  dueDate: Date
  currency: string
  lutId?: string
  description?: string
  paymentTerms?: string
  bankDetails?: string
  notes?: string
  lineItems: Array<{
    description: string
    quantity: number
    rate: number
    serviceCode: string
  }>
}

interface LineItem {
  id: string
  description: string
  quantity: string
  rate: string
  serviceCode: string
  amount: number
}

interface FormErrors {
  clientId?: string
  lineItems?: string
  [key: string]: string | undefined
}

export function InvoiceForm({ clients, luts, onSubmit }: InvoiceFormProps) {
  const [formData, setFormData] = useState<Partial<InvoiceFormData>>({
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    currency: 'USD',
    paymentTerms: 'Net 30 days',
  })
  
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        description: '',
        quantity: '',
        rate: '',
        serviceCode: '',
        amount: 0,
      },
    ])
  }

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id))
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          
          // Calculate amount
          const quantity = parseFloat(updated.quantity) || 0
          const rate = parseFloat(updated.rate) || 0
          updated.amount = quantity * rate
          
          return updated
        }
        return item
      })
    )
    
    // Clear line item errors
    if (errors[`lineItem_${id}_${field}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[`lineItem_${id}_${field}`]
        return newErrors
      })
    }
  }

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const igstRate = formData.lutId ? 0 : 0 // For now, always 0% for exports
    const igstAmount = (subtotal * igstRate) / 100
    const total = subtotal + igstAmount
    
    return { subtotal, igstRate, igstAmount, total }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    
    if (!formData.clientId) {
      newErrors.clientId = 'Client is required'
    }
    
    if (lineItems.length === 0) {
      newErrors.lineItems = 'At least one line item is required'
    }
    
    // Validate line items
    lineItems.forEach((item) => {
      if (!item.description) {
        newErrors[`lineItem_${item.id}_description`] = 'Description is required'
      }
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        newErrors[`lineItem_${item.id}_quantity`] = 'Valid quantity is required'
      }
      if (!item.rate || parseFloat(item.rate) <= 0) {
        newErrors[`lineItem_${item.id}_rate`] = 'Valid rate is required'
      }
      if (!item.serviceCode || !/^\d{8}$/.test(item.serviceCode)) {
        newErrors[`lineItem_${item.id}_serviceCode`] = 'Service code must be 8 digits'
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)
    try {
      await onSubmit({
        ...formData as InvoiceFormData,
        lineItems: lineItems.map((item) => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          rate: parseFloat(item.rate),
          serviceCode: item.serviceCode,
        })),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const { subtotal, igstRate, igstAmount, total } = calculateTotals()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
            Client
          </label>
          <select
            id="clientId"
            value={formData.clientId || ''}
            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            className={`mt-1 block w-full rounded-md shadow-sm ${
              errors.clientId
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
            }`}
          >
            <option value="">Select a client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} ({client.company})
              </option>
            ))}
          </select>
          {errors.clientId && (
            <p className="mt-1 text-sm text-red-600">{errors.clientId}</p>
          )}
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
            Currency
          </label>
          <select
            id="currency"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            {Object.entries(CURRENCY_CODES).map(([key, value]) => (
              <option key={key} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="invoiceDate" className="block text-sm font-medium text-gray-700">
            Invoice Date
          </label>
          <input
            type="date"
            id="invoiceDate"
            value={formData.invoiceDate?.toISOString().split('T')[0]}
            onChange={(e) =>
              setFormData({ ...formData, invoiceDate: new Date(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">
            Due Date
          </label>
          <input
            type="date"
            id="dueDate"
            value={formData.dueDate?.toISOString().split('T')[0]}
            onChange={(e) => setFormData({ ...formData, dueDate: new Date(e.target.value) })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="lutId" className="block text-sm font-medium text-gray-700">
            LUT (for 0% GST)
          </label>
          <select
            id="lutId"
            value={formData.lutId || ''}
            onChange={(e) => setFormData({ ...formData, lutId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">No LUT (Regular GST applies)</option>
            {luts.map((lut) => (
              <option key={lut.id} value={lut.id}>
                {lut.lutNumber} (Valid till {new Date(lut.validTill).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Line Items</h3>
          <button
            type="button"
            onClick={addLineItem}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Add Line Item
          </button>
        </div>
        
        {errors.lineItems && (
          <p className="mb-2 text-sm text-red-600">{errors.lineItems}</p>
        )}

        {lineItems.map((item, index) => (
          <div
            key={item.id}
            className="mb-4 p-4 border rounded-lg"
            role="group"
            aria-label={`Line item ${index + 1}`}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label
                  htmlFor={`description_${item.id}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <input
                  type="text"
                  id={`description_${item.id}`}
                  value={item.description}
                  onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm ${
                    errors[`lineItem_${item.id}_description`]
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                />
                {errors[`lineItem_${item.id}_description`] && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors[`lineItem_${item.id}_description`]}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor={`quantity_${item.id}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  Quantity
                </label>
                <input
                  type="number"
                  id={`quantity_${item.id}`}
                  value={item.quantity}
                  onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm ${
                    errors[`lineItem_${item.id}_quantity`]
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                />
                {errors[`lineItem_${item.id}_quantity`] && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors[`lineItem_${item.id}_quantity`]}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor={`rate_${item.id}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  Rate
                </label>
                <input
                  type="number"
                  id={`rate_${item.id}`}
                  value={item.rate}
                  onChange={(e) => updateLineItem(item.id, 'rate', e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm ${
                    errors[`lineItem_${item.id}_rate`]
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                />
                {errors[`lineItem_${item.id}_rate`] && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors[`lineItem_${item.id}_rate`]}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor={`serviceCode_${item.id}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  Service Code
                </label>
                <input
                  type="text"
                  id={`serviceCode_${item.id}`}
                  value={item.serviceCode}
                  onChange={(e) => updateLineItem(item.id, 'serviceCode', e.target.value)}
                  placeholder="99831400"
                  className={`mt-1 block w-full rounded-md shadow-sm ${
                    errors[`lineItem_${item.id}_serviceCode`]
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                />
                {errors[`lineItem_${item.id}_serviceCode`] && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors[`lineItem_${item.id}_serviceCode`]}
                  </p>
                )}
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeLineItem(item.id)}
                  className="mb-1 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-900"
                >
                  Remove
                </button>
              </div>
            </div>
            
            <div className="mt-2 text-right text-sm text-gray-600">
              Amount: ${item.amount.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="paymentTerms" className="block text-sm font-medium text-gray-700">
            Payment Terms
          </label>
          <input
            type="text"
            id="paymentTerms"
            value={formData.paymentTerms || ''}
            onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="bankDetails" className="block text-sm font-medium text-gray-700">
            Bank Details
          </label>
          <textarea
            id="bankDetails"
            rows={3}
            value={formData.bankDetails || ''}
            onChange={(e) => setFormData({ ...formData, bankDetails: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="space-y-2 text-right">
          <div className="flex justify-end">
            <span className="w-32 text-sm font-medium">Subtotal:</span>
            <span className="w-32 text-sm">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-end">
            <span className="w-32 text-sm font-medium">
              IGST ({igstRate}%):
            </span>
            <span className="w-32 text-sm igst-amount">${igstAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-end border-t pt-2">
            <span className="w-32 text-lg font-medium">Total:</span>
            <span className="w-32 text-lg font-bold">
              ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  )
}