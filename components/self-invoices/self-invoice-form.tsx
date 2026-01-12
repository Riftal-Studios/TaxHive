'use client'

import { useState, useMemo, useCallback } from 'react'
import type { UnregisteredSupplier } from '@prisma/client'
import { formatCurrency, validateHSNCode, calculateLineAmount, calculateSubtotal } from '@/lib/invoice-utils'
import { SAC_HSN_CODES } from '@/lib/constants'
import {
  RCM_GST_RATES,
  calculateRCMGSTComponents,
  validateRCMSelfInvoice,
  RCM_RULE_47A_DAYS,
  GST_STATE_CODES
} from '@/lib/validations/gst'
import { generateUUID } from '@/lib/utils/uuid'
import {
  getInputClassName,
  selectClassName,
  textareaClassName,
  buttonClassName,
  getDropdownButtonClassName,
  dropdownContainerClassName,
  dropdownItemClassName
} from '@/lib/ui-utils'

interface LineItem {
  id: string
  description: string
  sacCode: string
  quantity: number
  rate: number
  amount: number
}

export interface SelfInvoiceFormData {
  supplierId: string
  dateOfReceiptOfSupply: string
  invoiceDate: string
  gstRate: number
  lineItems: Array<{
    description: string
    sacCode: string
    quantity: number
    rate: number
  }>
  notes: string
  paymentMode: string
  paymentReference: string
}

interface SelfInvoiceFormProps {
  suppliers: UnregisteredSupplier[]
  userStateCode: string // Derived from user's GSTIN
  onSubmit: (data: SelfInvoiceFormData) => void | Promise<void>
  onCancel: () => void
  onAddSupplier?: () => void
  initialData?: Partial<SelfInvoiceFormData & { lineItems: LineItem[] }>
}

interface FormErrors {
  supplierId?: string
  dateOfReceiptOfSupply?: string
  invoiceDate?: string
  gstRate?: string
  paymentMode?: string
  lineItems?: Record<string, Record<string, string>>
}

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'UPI', label: 'UPI' },
]

export function SelfInvoiceForm({
  suppliers,
  userStateCode,
  onSubmit,
  onCancel,
  onAddSupplier,
  initialData
}: SelfInvoiceFormProps) {
  const [formData, setFormData] = useState<{
    supplierId: string
    dateOfReceiptOfSupply: string
    invoiceDate: string
    gstRate: number
    lineItems: LineItem[]
    notes: string
    paymentMode: string
    paymentReference: string
  }>({
    supplierId: initialData?.supplierId || '',
    dateOfReceiptOfSupply: initialData?.dateOfReceiptOfSupply || '',
    invoiceDate: initialData?.invoiceDate || new Date().toISOString().split('T')[0],
    gstRate: initialData?.gstRate || 18,
    lineItems: initialData?.lineItems || [
      {
        id: generateUUID(),
        description: '',
        sacCode: '',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ],
    notes: initialData?.notes || '',
    paymentMode: initialData?.paymentMode || 'BANK_TRANSFER',
    paymentReference: initialData?.paymentReference || '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [showSacDropdown, setShowSacDropdown] = useState<Record<string, boolean>>({})
  const [sacSearchTerm, setSacSearchTerm] = useState<Record<string, string>>({})

  // Selected supplier
  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === formData.supplierId),
    [suppliers, formData.supplierId]
  )

  // Calculate subtotal
  const subtotal = useMemo(() => calculateSubtotal(formData.lineItems), [formData.lineItems])

  // Calculate GST components
  const gstComponents = useMemo(() => {
    if (!selectedSupplier || subtotal === 0) return null
    try {
      return calculateRCMGSTComponents(
        subtotal,
        formData.gstRate,
        selectedSupplier.stateCode,
        userStateCode
      )
    } catch {
      return null
    }
  }, [subtotal, formData.gstRate, selectedSupplier, userStateCode])

  // Total amount
  const total = useMemo(() => {
    if (!gstComponents) return subtotal
    return subtotal + gstComponents.totalTax
  }, [subtotal, gstComponents])

  // RCM validation
  const rcmValidation = useMemo(() => {
    if (!selectedSupplier || !formData.dateOfReceiptOfSupply || formData.lineItems.length === 0) {
      return null
    }
    return validateRCMSelfInvoice({
      invoiceDate: new Date(formData.invoiceDate),
      dateOfReceiptOfSupply: new Date(formData.dateOfReceiptOfSupply),
      gstRate: formData.gstRate,
      serviceCode: formData.lineItems[0].sacCode || '',
      supplierStateCode: selectedSupplier.stateCode,
      recipientStateCode: userStateCode,
      supplierName: selectedSupplier.name,
      supplierAddress: selectedSupplier.address,
      amount: subtotal,
    })
  }, [selectedSupplier, formData, userStateCode, subtotal])

  // Days until 30-day deadline
  const daysUntilDeadline = useMemo(() => {
    if (!formData.dateOfReceiptOfSupply) return null
    const receiptDate = new Date(formData.dateOfReceiptOfSupply)
    const today = new Date()
    const daysSinceReceipt = Math.floor((today.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24))
    return RCM_RULE_47A_DAYS - daysSinceReceipt
  }, [formData.dateOfReceiptOfSupply])

  // Get supplier state name
  const supplierStateName = useMemo(() => {
    if (!selectedSupplier) return ''
    return GST_STATE_CODES[selectedSupplier.stateCode] || ''
  }, [selectedSupplier])

  // Get user state name
  const userStateName = useMemo(() => {
    return GST_STATE_CODES[userStateCode] || ''
  }, [userStateCode])

  // Filter SAC codes
  const getFilteredSacCodes = useCallback((itemId: string) => {
    const searchTerm = sacSearchTerm[itemId]?.toLowerCase() || ''
    if (!searchTerm) return SAC_HSN_CODES
    return SAC_HSN_CODES.filter(
      sac =>
        sac.code.toLowerCase().includes(searchTerm) ||
        sac.description.toLowerCase().includes(searchTerm)
    )
  }, [sacSearchTerm])

  const handleAddLineItem = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          id: generateUUID(),
          description: '',
          sacCode: '',
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ],
    }))
  }, [])

  const handleRemoveLineItem = useCallback((id: string) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(item => item.id !== id),
    }))
  }, [])

  const handleLineItemChange = useCallback((id: string, field: keyof LineItem, value: string | number) => {
    setFormData(prev => {
      const updatedItems = prev.lineItems.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          if (field === 'quantity' || field === 'rate') {
            updated.amount = calculateLineAmount(
              field === 'quantity' ? Number(value) : updated.quantity,
              field === 'rate' ? Number(value) : updated.rate
            )
          }
          return updated
        }
        return item
      })
      return { ...prev, lineItems: updatedItems }
    })

    // Clear field-specific error
    if (errors.lineItems?.[id]?.[field]) {
      setErrors(prev => {
        const updatedLineItems = { ...prev.lineItems }
        if (updatedLineItems[id]) {
          delete updatedLineItems[id][field]
          if (Object.keys(updatedLineItems[id]).length === 0) {
            delete updatedLineItems[id]
          }
        }
        return { ...prev, lineItems: updatedLineItems }
      })
    }
  }, [errors])

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.supplierId) {
      newErrors.supplierId = 'Supplier is required'
    }

    if (!formData.dateOfReceiptOfSupply) {
      newErrors.dateOfReceiptOfSupply = 'Date of receipt of supply is required for RCM compliance'
    }

    if (!formData.invoiceDate) {
      newErrors.invoiceDate = 'Invoice date is required'
    }

    if (!formData.gstRate || !RCM_GST_RATES.includes(formData.gstRate as 5 | 12 | 18 | 28)) {
      newErrors.gstRate = 'Valid GST rate is required'
    }

    if (!formData.paymentMode) {
      newErrors.paymentMode = 'Payment mode is required for payment voucher'
    }

    // Validate line items
    const lineItemErrors: Record<string, Record<string, string>> = {}
    formData.lineItems.forEach(item => {
      const itemErrors: Record<string, string> = {}

      if (!item.description.trim()) {
        itemErrors.description = 'Description is required'
      }

      if (!item.sacCode) {
        itemErrors.sacCode = 'SAC/HSN code is required'
      } else if (!validateHSNCode(item.sacCode)) {
        itemErrors.sacCode = 'Invalid SAC/HSN code'
      }

      if (item.quantity <= 0) {
        itemErrors.quantity = 'Quantity must be greater than 0'
      }

      if (item.rate <= 0) {
        itemErrors.rate = 'Rate must be greater than 0'
      }

      if (Object.keys(itemErrors).length > 0) {
        lineItemErrors[item.id] = itemErrors
      }
    })

    if (Object.keys(lineItemErrors).length > 0) {
      newErrors.lineItems = lineItemErrors
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        supplierId: formData.supplierId,
        dateOfReceiptOfSupply: formData.dateOfReceiptOfSupply,
        invoiceDate: formData.invoiceDate,
        gstRate: formData.gstRate,
        lineItems: formData.lineItems.map(item => ({
          description: item.description,
          sacCode: item.sacCode,
          quantity: Number(item.quantity),
          rate: Number(item.rate),
        })),
        notes: formData.notes,
        paymentMode: formData.paymentMode,
        paymentReference: formData.paymentReference,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, onSubmit, validateForm])

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* RCM Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
              RCM Self Invoice - Section 31(3)(f)
            </h3>
            <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              <p>
                This self-invoice is issued under Reverse Charge Mechanism for purchases from unregistered suppliers.
                GST will be payable by you (the recipient) and ITC can be claimed in the same period.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Warning */}
      {daysUntilDeadline !== null && daysUntilDeadline <= 5 && daysUntilDeadline >= 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Rule 47A Deadline Warning
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {daysUntilDeadline === 0
                  ? 'Today is the last day to issue this self-invoice!'
                  : `Only ${daysUntilDeadline} day${daysUntilDeadline !== 1 ? 's' : ''} remaining to issue this self-invoice.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {daysUntilDeadline !== null && daysUntilDeadline < 0 && (
        <div className="bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                30-Day Rule Violation (Rule 47A)
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                This self-invoice is {Math.abs(daysUntilDeadline)} days overdue.
                Self-invoices must be issued within 30 days of receiving goods/services.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Unregistered Supplier <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              id="supplier"
              onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
              className={getDropdownButtonClassName(!!errors.supplierId)}
            >
              {selectedSupplier ? selectedSupplier.name : 'Select a supplier'}
            </button>
            {showSupplierDropdown && (
              <div className={dropdownContainerClassName}>
                {suppliers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    No suppliers found.
                    {onAddSupplier && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSupplierDropdown(false)
                          onAddSupplier()
                        }}
                        className="block mt-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        + Add New Supplier
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {suppliers.map(supplier => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, supplierId: supplier.id }))
                          setShowSupplierDropdown(false)
                        }}
                        className={dropdownItemClassName}
                      >
                        <div className="font-medium">{supplier.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {supplier.state} ({supplier.stateCode})
                        </div>
                      </button>
                    ))}
                    {onAddSupplier && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSupplierDropdown(false)
                          onAddSupplier()
                        }}
                        className={`${dropdownItemClassName} text-indigo-600 dark:text-indigo-400 border-t border-gray-200 dark:border-gray-600`}
                      >
                        + Add New Supplier
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          {errors.supplierId && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.supplierId}</p>
          )}
          {selectedSupplier && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {selectedSupplier.address}, {supplierStateName}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="gstRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            GST Rate <span className="text-red-500">*</span>
          </label>
          <select
            id="gstRate"
            value={formData.gstRate}
            onChange={(e) => setFormData(prev => ({ ...prev, gstRate: Number(e.target.value) }))}
            className={selectClassName}
          >
            {RCM_GST_RATES.map(rate => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </select>
          {errors.gstRate && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.gstRate}</p>
          )}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="dateOfReceiptOfSupply" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date of Receipt of Supply <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="dateOfReceiptOfSupply"
            value={formData.dateOfReceiptOfSupply}
            onChange={(e) => setFormData(prev => ({ ...prev, dateOfReceiptOfSupply: e.target.value }))}
            className={getInputClassName(!!errors.dateOfReceiptOfSupply)}
            max={new Date().toISOString().split('T')[0]}
          />
          {errors.dateOfReceiptOfSupply && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.dateOfReceiptOfSupply}</p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            When you received the goods or services
          </p>
        </div>

        <div>
          <label htmlFor="invoiceDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Invoice Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="invoiceDate"
            value={formData.invoiceDate}
            onChange={(e) => setFormData(prev => ({ ...prev, invoiceDate: e.target.value }))}
            className={getInputClassName(!!errors.invoiceDate)}
          />
          {errors.invoiceDate && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.invoiceDate}</p>
          )}
        </div>
      </div>

      {/* Place of Supply Info */}
      {selectedSupplier && gstComponents && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Place of Supply</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Supplier Location:</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {supplierStateName} ({selectedSupplier.stateCode})
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Recipient Location:</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {userStateName} ({userStateCode})
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Supply Type:</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {gstComponents.isInterstate ? 'Interstate (IGST)' : 'Intrastate (CGST + SGST)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Line Items */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Line Items <span className="text-red-500">*</span>
        </h3>
        <div className="space-y-4">
          {formData.lineItems.map((item) => (
            <div key={item.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor={`description-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id={`description-${item.id}`}
                    value={item.description}
                    onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                    className={getInputClassName(!!errors.lineItems?.[item.id]?.description)}
                    placeholder="Description of goods/services"
                  />
                  {errors.lineItems?.[item.id]?.description && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.lineItems[item.id].description}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`sacCode-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    SAC/HSN Code <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      id={`sacCode-${item.id}`}
                      value={item.sacCode}
                      onChange={(e) => {
                        handleLineItemChange(item.id, 'sacCode', e.target.value)
                        setSacSearchTerm(prev => ({ ...prev, [item.id]: e.target.value }))
                      }}
                      onFocus={() => setShowSacDropdown(prev => ({ ...prev, [item.id]: true }))}
                      onBlur={() => setTimeout(() => setShowSacDropdown(prev => ({ ...prev, [item.id]: false })), 200)}
                      placeholder="Search code"
                      className={getInputClassName(!!errors.lineItems?.[item.id]?.sacCode)}
                    />
                    {showSacDropdown[item.id] && (
                      <div className={`${dropdownContainerClassName} max-h-60 overflow-auto`}>
                        {getFilteredSacCodes(item.id).slice(0, 20).map(sac => (
                          <button
                            key={sac.code}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleLineItemChange(item.id, 'sacCode', sac.code)
                              setSacSearchTerm(prev => ({ ...prev, [item.id]: sac.code }))
                              setShowSacDropdown(prev => ({ ...prev, [item.id]: false }))
                            }}
                            className={`${dropdownItemClassName} text-sm`}
                          >
                            <div className="font-medium text-gray-900 dark:text-white">{sac.code}</div>
                            <div className="text-gray-500 dark:text-gray-400 text-xs truncate">{sac.description}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.lineItems?.[item.id]?.sacCode && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.lineItems[item.id].sacCode}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`quantity-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id={`quantity-${item.id}`}
                    value={item.quantity}
                    onChange={(e) => handleLineItemChange(item.id, 'quantity', e.target.value)}
                    className={getInputClassName(!!errors.lineItems?.[item.id]?.quantity)}
                    min="1"
                    step="1"
                  />
                  {errors.lineItems?.[item.id]?.quantity && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.lineItems[item.id].quantity}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`rate-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Rate (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id={`rate-${item.id}`}
                    value={item.rate}
                    onChange={(e) => handleLineItemChange(item.id, 'rate', e.target.value)}
                    className={getInputClassName(!!errors.lineItems?.[item.id]?.rate)}
                    min="0.01"
                    step="0.01"
                  />
                  {errors.lineItems?.[item.id]?.rate && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.lineItems[item.id].rate}
                    </p>
                  )}
                </div>

                <div className="flex items-end justify-between">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Amount
                    </label>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      ₹{item.amount.toFixed(2)}
                    </div>
                  </div>
                  {formData.lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(item.id)}
                      className="ml-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddLineItem}
          className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
        >
          + Add Line Item
        </button>
      </div>

      {/* Totals */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal, 'INR')}</span>
          </div>
          {gstComponents && (
            <>
              {gstComponents.isInterstate ? (
                <div className="flex justify-between text-blue-600 dark:text-blue-400">
                  <span>IGST ({formData.gstRate}%):</span>
                  <span>{formatCurrency(gstComponents.igst, 'INR')}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-blue-600 dark:text-blue-400">
                    <span>CGST ({gstComponents.cgstRate}%):</span>
                    <span>{formatCurrency(gstComponents.cgst, 'INR')}</span>
                  </div>
                  <div className="flex justify-between text-blue-600 dark:text-blue-400">
                    <span>SGST ({gstComponents.sgstRate}%):</span>
                    <span>{formatCurrency(gstComponents.sgst, 'INR')}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>Total Tax (RCM):</span>
                <span className="font-medium">{formatCurrency(gstComponents.totalTax, 'INR')}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-medium text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
            <span>Total Amount:</span>
            <span>{formatCurrency(total, 'INR')}</span>
          </div>
        </div>
      </div>

      {/* Payment Voucher Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-3">
          Payment Voucher Details
        </h4>
        <p className="text-xs text-blue-700 dark:text-blue-300 mb-4">
          A payment voucher will be automatically generated with this self-invoice.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="paymentMode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Payment Mode <span className="text-red-500">*</span>
            </label>
            <select
              id="paymentMode"
              value={formData.paymentMode}
              onChange={(e) => setFormData(prev => ({ ...prev, paymentMode: e.target.value }))}
              className={selectClassName}
            >
              {PAYMENT_MODES.map(mode => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
            {errors.paymentMode && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.paymentMode}</p>
            )}
          </div>
          <div>
            <label htmlFor="paymentReference" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Payment Reference
            </label>
            <input
              type="text"
              id="paymentReference"
              value={formData.paymentReference}
              onChange={(e) => setFormData(prev => ({ ...prev, paymentReference: e.target.value }))}
              placeholder="e.g., Transaction ID, Cheque No."
              className={getInputClassName()}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          className={textareaClassName}
          placeholder="Additional notes (optional)"
        />
      </div>

      {/* RCM Validation Errors */}
      {rcmValidation && !rcmValidation.isValid && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
            RCM Compliance Issues:
          </h4>
          <ul className="list-disc list-inside space-y-1">
            {rcmValidation.errors.map((error, index) => (
              <li key={index} className="text-sm text-red-700 dark:text-red-300">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* RCM Validation Warnings */}
      {rcmValidation && rcmValidation.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
            Warnings:
          </h4>
          <ul className="list-disc list-inside space-y-1">
            {rcmValidation.warnings.map((warning, index) => (
              <li key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* GSTR-3B Info */}
      {gstComponents && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-green-900 dark:text-green-200 mb-2">
            GSTR-3B Reporting
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-700 dark:text-green-300">
            <div>
              <span className="font-medium">Table 3.1(d) - RCM Liability:</span>
              <p>{formatCurrency(gstComponents.totalTax, 'INR')}</p>
            </div>
            <div>
              <span className="font-medium">Table 4A(3) - ITC Claimable:</span>
              <p>{formatCurrency(gstComponents.totalTax, 'INR')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className={buttonClassName.secondary}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={buttonClassName.primary}
        >
          {isSubmitting ? 'Creating...' : 'Create Self Invoice'}
        </button>
      </div>
    </form>
  )
}
