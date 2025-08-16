'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { Client, LUT } from '@prisma/client'
import { formatCurrency, validateHSNCode, calculateLineAmount, calculateSubtotal, getPaymentTermOptions, getSupportedCurrencies } from '@/lib/invoice-utils'
import { SAC_HSN_CODES, GST_CONSTANTS } from '@/lib/constants'
import { validateGSTInvoice, getLUTExpiryStatus } from '@/lib/validations/gst'
import { generateUUID } from '@/lib/utils/uuid'
import { 
  getInputClassName, 
  selectClassName, 
  textareaClassName, 
  buttonClassName, 
  exchangeRateInputClassName,
  getDropdownButtonClassName,
  dropdownContainerClassName,
  dropdownItemClassName
} from '@/lib/ui-utils'
import { InvoiceTypeSelector } from '@/components/invoice-type-selector'
import { GSTINInput } from '@/components/gstin-input'
import { PlaceOfSupplySelector } from '@/components/place-of-supply-selector'
import { GSTRateSelector } from '@/components/gst-rate-selector'
import { GSTSummary } from '@/components/gst-summary'
import { calculateGST, type StateCode } from '@/lib/gst'

interface LineItem {
  id: string
  description: string
  sacCode: string
  quantity: number
  rate: number
  amount: number
  gstRate?: number
  cgstAmount?: number
  sgstAmount?: number
  igstAmount?: number
  totalAmount?: number
}

interface InvoiceFormData {
  invoiceType: 'EXPORT' | 'DOMESTIC_B2B' | 'DOMESTIC_B2C'
  clientId: string
  lutId: string
  issueDate: string
  dueDate: string
  currency: string
  paymentTerms: number
  lineItems: LineItem[]
  bankDetails: string
  notes: string
  buyerGSTIN?: string
  placeOfSupply?: string
}

interface InvoiceFormSubmitData {
  invoiceType: 'EXPORT' | 'DOMESTIC_B2B' | 'DOMESTIC_B2C'
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
    gstRate?: number
  }>
  bankDetails: string
  notes: string
  buyerGSTIN?: string
  placeOfSupply?: string
}

interface InvoiceFormProps {
  clients: Client[]
  luts: LUT[]
  onSubmit: (data: InvoiceFormSubmitData) => void | Promise<void>
  onCancel: () => void
  onCurrencyChange?: (currency: string) => void
  onIssueDateChange?: (date: string) => void
  exchangeRate?: {
    rate: number
    source: string
    date: Date
  } | null
  manualExchangeRate?: number | null
  onManualExchangeRateChange?: (rate: number | null) => void
  initialData?: Partial<InvoiceFormData>
  invoiceStatus?: string // Add status to determine button text
  autoSave?: boolean
  onAutoSave?: (data: Partial<InvoiceFormData>) => void | Promise<void>
}

interface FormErrors {
  clientId?: string
  lutId?: string
  issueDate?: string
  dueDate?: string
  lineItems?: Record<string, Record<string, string>>
  buyerGSTIN?: string
  placeOfSupply?: string
}

export function InvoiceForm({ 
  clients, 
  luts, 
  onSubmit, 
  onCancel, 
  onCurrencyChange,
  onIssueDateChange,
  exchangeRate, 
  manualExchangeRate, 
  onManualExchangeRateChange, 
  initialData,
  invoiceStatus,
  autoSave = false,
  onAutoSave
}: InvoiceFormProps) {
  // Memoize initial form data to prevent unnecessary re-renders
  const getInitialFormData = useCallback((): InvoiceFormData => {
    return {
      invoiceType: initialData?.invoiceType || 'EXPORT',
      clientId: initialData?.clientId || '',
      lutId: initialData?.lutId || '',
      issueDate: initialData?.issueDate || new Date().toISOString().split('T')[0],
      dueDate: initialData?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: initialData?.currency || 'USD',
      paymentTerms: initialData?.paymentTerms || 30,
      lineItems: initialData?.lineItems || [
        {
          id: generateUUID(),
          description: '',
          sacCode: '',
          quantity: 1,
          rate: 0,
          amount: 0,
          gstRate: 0,
        },
      ],
      bankDetails: initialData?.bankDetails || '',
      notes: initialData?.notes || '',
      buyerGSTIN: initialData?.buyerGSTIN || '',
      placeOfSupply: initialData?.placeOfSupply || '',
    }
  }, [initialData])

  const [formData, setFormData] = useState<InvoiceFormData>(getInitialFormData())
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showLutDropdown, setShowLutDropdown] = useState(false)
  const [showSacDropdown, setShowSacDropdown] = useState<Record<string, boolean>>({})
  const [sacSearchTerm, setSacSearchTerm] = useState<Record<string, string>>({})
  
  // Auto-save debounce
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Memoize derived values
  const selectedClient = useMemo(() => clients.find(c => c.id === formData.clientId), [clients, formData.clientId])
  const selectedLut = useMemo(() => luts.find(l => l.id === formData.lutId), [luts, formData.lutId])
  const paymentTermOptions = useMemo(() => getPaymentTermOptions(), [])
  const currencyOptions = useMemo(() => getSupportedCurrencies(), [])

  // Calculate totals with memoization including GST for domestic invoices
  const { subtotal, gstDetails, total } = useMemo(() => {
    const subtotal = calculateSubtotal(formData.lineItems)
    
    let cgstAmount = 0
    let sgstAmount = 0
    let igstAmount = 0
    let totalGSTAmount = 0
    
    if (formData.invoiceType !== 'EXPORT') {
      // For domestic invoices, calculate GST
      const isInterState = formData.placeOfSupply && formData.placeOfSupply !== '07' // Assuming Delhi (07) as supplier state
      
      formData.lineItems.forEach(item => {
        if (item.gstRate && item.gstRate > 0) {
          const gstCalc = calculateGST(
            item.amount,
            item.gstRate,
            '07' as StateCode, // Delhi - should be from company settings
            (formData.placeOfSupply || '07') as StateCode
          )
          
          if (isInterState) {
            item.igstAmount = Number(gstCalc.igstAmount)
            igstAmount += item.igstAmount
          } else {
            item.cgstAmount = Number(gstCalc.cgstAmount)
            item.sgstAmount = Number(gstCalc.sgstAmount)
            cgstAmount += item.cgstAmount
            sgstAmount += item.sgstAmount
          }
          
          item.totalAmount = item.amount + Number(gstCalc.totalGSTAmount)
        } else {
          item.totalAmount = item.amount
        }
      })
      
      totalGSTAmount = cgstAmount + sgstAmount + igstAmount
    }
    
    const total = subtotal + totalGSTAmount
    
    return {
      subtotal,
      gstDetails: {
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalGSTAmount,
        cgstRate: formData.lineItems[0]?.gstRate ? formData.lineItems[0].gstRate / 2 : 0,
        sgstRate: formData.lineItems[0]?.gstRate ? formData.lineItems[0].gstRate / 2 : 0,
        igstRate: formData.lineItems[0]?.gstRate || 0,
      },
      total
    }
  }, [formData.lineItems, formData.invoiceType, formData.placeOfSupply])

  // GST validation with memoization
  const gstValidation = useMemo(() => {
    if (formData.invoiceType !== 'EXPORT' || formData.lineItems.length === 0 || (!exchangeRate && !manualExchangeRate)) {
      return null
    }
    return validateGSTInvoice({
      placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
      serviceCode: formData.lineItems[0].sacCode,
      igstRate: 0,
      lutId: formData.lutId || null,
      currency: formData.currency,
      exchangeRate: manualExchangeRate || exchangeRate?.rate || 0,
      exchangeSource: exchangeRate ? exchangeRate.source : 'Manual',
    })
  }, [formData.invoiceType, formData.lineItems, formData.lutId, formData.currency, exchangeRate, manualExchangeRate])

  // LUT expiry status with memoization
  const lutExpiryStatus = useMemo(() => {
    return selectedLut ? getLUTExpiryStatus(new Date(selectedLut.validTill)) : null
  }, [selectedLut])

  // Memoize SAC code filtering
  const getFilteredSacCodes = useCallback((itemId: string) => {
    const searchTerm = sacSearchTerm[itemId]?.toLowerCase() || ''
    if (!searchTerm) return SAC_HSN_CODES
    
    return SAC_HSN_CODES.filter(
      sac => 
        sac.code.toLowerCase().includes(searchTerm) ||
        sac.description.toLowerCase().includes(searchTerm)
    )
  }, [sacSearchTerm])

  // Auto-save functionality
  const triggerAutoSave = useCallback((data: InvoiceFormData) => {
    if (!autoSave || !onAutoSave) return

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsAutoSaving(true)
        await onAutoSave(data)
      } catch (error) {
        console.error('Auto-save failed:', error)
      } finally {
        setIsAutoSaving(false)
      }
    }, 2000) // 2 second debounce
  }, [autoSave, onAutoSave])

  // Update due date when payment terms change
  useEffect(() => {
    const issueDate = new Date(formData.issueDate)
    const dueDate = new Date(issueDate.getTime() + formData.paymentTerms * 24 * 60 * 60 * 1000)
    setFormData(prev => {
      const newData = {
        ...prev,
        dueDate: dueDate.toISOString().split('T')[0],
      }
      triggerAutoSave(newData)
      return newData
    })
  }, [formData.issueDate, formData.paymentTerms, triggerAutoSave])

  const handleAddLineItem = useCallback(() => {
    setFormData(prev => {
      const newData = {
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
            gstRate: prev.lineItems[0]?.gstRate || 0, // Use same GST rate as first item
          },
        ],
      }
      triggerAutoSave(newData)
      return newData
    })
  }, [triggerAutoSave])

  const handleRemoveLineItem = useCallback((id: string) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        lineItems: prev.lineItems.filter(item => item.id !== id),
      }
      triggerAutoSave(newData)
      return newData
    })
  }, [triggerAutoSave])

  const handleLineItemChange = useCallback((id: string, field: keyof LineItem, value: string | number) => {
    setFormData(prev => {
      const updatedItems = prev.lineItems.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          // Recalculate amount when quantity or rate changes
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
      const newData = { ...prev, lineItems: updatedItems }
      triggerAutoSave(newData)
      return newData
    })

    // Clear field-specific error when user starts typing
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
  }, [errors, triggerAutoSave])

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}
    
    if (!formData.clientId) {
      newErrors.clientId = 'Client is required'
    }
    
    // Validate GST fields for domestic invoices
    if (formData.invoiceType === 'DOMESTIC_B2B' && !formData.buyerGSTIN) {
      newErrors.buyerGSTIN = 'Buyer GSTIN is required for B2B invoices'
    }
    
    if (formData.invoiceType !== 'EXPORT' && !formData.placeOfSupply) {
      newErrors.placeOfSupply = 'Place of supply is required for domestic invoices'
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
        itemErrors.sacCode = 'SAC/HSN code must be a valid code from the GST Classification Scheme'
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
        ...formData,
        lineItems: formData.lineItems.map((item) => ({
          description: item.description,
          sacCode: item.sacCode,
          quantity: Number(item.quantity),
          rate: Number(item.rate),
          gstRate: item.gstRate || 0,
        })),
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, onSubmit, validateForm])

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Auto-save indicator */}
      {isAutoSaving && (
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Auto-saving...
        </div>
      )}

      {/* Invoice Type Selection */}
      <div>
        <InvoiceTypeSelector
          value={formData.invoiceType}
          onChange={(type) => {
            setFormData(prev => {
              const newData = {
                ...prev,
                invoiceType: type,
                currency: type === 'EXPORT' ? 'USD' : 'INR', // Default to INR for domestic
              }
              triggerAutoSave(newData)
              return newData
            })
            if (type !== 'EXPORT' && onCurrencyChange) {
              onCurrencyChange('INR')
            }
          }}
        />
      </div>

      {/* Client and LUT Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="client" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Client <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              id="client"
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className={getDropdownButtonClassName(!!errors.clientId)}
              aria-expanded={showClientDropdown}
              aria-haspopup="listbox"
            >
              {selectedClient ? selectedClient.name : 'Select a client'}
            </button>
            {showClientDropdown && (
              <div className={dropdownContainerClassName} role="listbox">
                {clients.map(client => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, clientId: client.id }))
                      setShowClientDropdown(false)
                    }}
                    className={dropdownItemClassName}
                    role="option"
                    aria-selected={formData.clientId === client.id}
                  >
                    {client.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {errors.clientId && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.clientId}
            </p>
          )}
        </div>

        {formData.invoiceType === 'EXPORT' ? (
          <div>
            <label htmlFor="lut" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              LUT
            </label>
            <div className="relative">
              <button
                type="button"
                id="lut"
                onClick={() => setShowLutDropdown(!showLutDropdown)}
                className={getDropdownButtonClassName(!!errors.lutId)}
                aria-expanded={showLutDropdown}
                aria-haspopup="listbox"
              >
                {selectedLut ? selectedLut.lutNumber : 'Select a LUT'}
              </button>
              {showLutDropdown && (
                <div className={dropdownContainerClassName} role="listbox">
                  {luts.map(lut => (
                    <button
                      key={lut.id}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, lutId: lut.id }))
                        setShowLutDropdown(false)
                      }}
                      className={dropdownItemClassName}
                      role="option"
                      aria-selected={formData.lutId === lut.id}
                    >
                      {lut.lutNumber}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : formData.invoiceType === 'DOMESTIC_B2B' ? (
          <div>
            <GSTINInput
              value={formData.buyerGSTIN || ''}
              onChange={(value) => {
                setFormData(prev => {
                  const newData = { ...prev, buyerGSTIN: value }
                  triggerAutoSave(newData)
                  return newData
                })
              }}
              onValidation={(isValid, stateCode) => {
                if (isValid && stateCode && !formData.placeOfSupply) {
                  setFormData(prev => ({
                    ...prev,
                    placeOfSupply: stateCode
                  }))
                }
              }}
              label="Buyer GSTIN"
              required
              showStateInfo
            />
            {errors.buyerGSTIN && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {errors.buyerGSTIN}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Customer Type
            </label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              B2C - Business to Consumer
            </p>
          </div>
        )}
      </div>

      {/* Place of Supply for Domestic Invoices */}
      {formData.invoiceType !== 'EXPORT' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <PlaceOfSupplySelector
              value={formData.placeOfSupply || ''}
              onChange={(value) => {
                setFormData(prev => {
                  const newData = { ...prev, placeOfSupply: value }
                  triggerAutoSave(newData)
                  return newData
                })
              }}
              required
              label="Place of Supply"
              helperText="Select the state where goods/services are supplied"
            />
            {errors.placeOfSupply && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {errors.placeOfSupply}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Supply Type
            </label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formData.placeOfSupply === '07' ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
            </p>
          </div>
        </div>
      )}

      {/* Date and Payment Terms */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label htmlFor="issueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Issue Date <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            type="date"
            id="issueDate"
            value={formData.issueDate}
            onChange={(e) => {
              const newDate = e.target.value
              setFormData(prev => ({ ...prev, issueDate: newDate }))
              onIssueDateChange?.(newDate)
            }}
            className={getInputClassName()}
            required
            aria-required="true"
          />
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Due Date <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            type="date"
            id="dueDate"
            value={formData.dueDate}
            onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
            className={getInputClassName()}
            required
            aria-required="true"
          />
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Currency <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            id="currency"
            value={formData.currency}
            onChange={(e) => {
              const newCurrency = e.target.value
              setFormData(prev => ({ ...prev, currency: newCurrency }))
              onCurrencyChange?.(newCurrency)
            }}
            className={selectClassName}
            required
            aria-required="true"
            disabled={formData.invoiceType !== 'EXPORT'} // Domestic invoices must be in INR
          >
            {currencyOptions.map(currency => (
              <option key={currency.code} value={currency.code}>
                {currency.code} - {currency.name}
              </option>
            ))}
          </select>
          {formData.invoiceType !== 'EXPORT' && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Domestic invoices must be in INR
            </p>
          )}
        </div>

        <div>
          <label htmlFor="paymentTerms" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Payment Terms <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            id="paymentTerms"
            value={formData.paymentTerms}
            onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: Number(e.target.value) }))}
            className={selectClassName}
            required
            aria-required="true"
          >
            {paymentTermOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Exchange Rate Display - Only for Export invoices */}
      {formData.invoiceType === 'EXPORT' && formData.currency !== 'INR' && (
        <>
          {exchangeRate ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    Exchange Rate: 1 {formData.currency} = ₹{exchangeRate.rate.toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Source: {exchangeRate.source} as on {new Date(exchangeRate.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    All amounts will be converted to INR
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    Exchange rate not available - Please enter manually
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    Current rates can be found at:{' '}
                    <a 
                      href="https://www.rbi.org.in/scripts/ReferenceRateArchive.aspx" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-yellow-800 dark:hover:text-yellow-200"
                    >
                      RBI Reference Rates
                    </a>
                    {' or '}
                    <a 
                      href="https://www.xe.com/currencyconverter/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-yellow-800 dark:hover:text-yellow-200"
                    >
                      XE Currency Converter
                    </a>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <label htmlFor="manualRate" className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    1 {formData.currency} = ₹
                  </label>
                  <input
                    type="number"
                    id="manualRate"
                    step="0.01"
                    value={manualExchangeRate || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseFloat(e.target.value) : null
                      onManualExchangeRateChange?.(value)
                    }}
                    placeholder="Enter rate"
                    className={exchangeRateInputClassName}
                    aria-label="Manual exchange rate"
                  />
                  <span className="text-xs text-yellow-600 dark:text-yellow-400">
                    (Manual entry)
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Line Items */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Line Items <span className="text-red-500" aria-hidden="true">*</span>
        </h3>
        <div className="space-y-4">
          {formData.lineItems.map((item) => (
            <div key={item.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor={`description-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    id={`description-${item.id}`}
                    value={item.description}
                    onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                    className={getInputClassName(!!errors.lineItems?.[item.id]?.description)}
                    required
                    aria-required="true"
                    aria-invalid={!!errors.lineItems?.[item.id]?.description}
                    aria-describedby={errors.lineItems?.[item.id]?.description ? `description-${item.id}-error` : undefined}
                  />
                  {errors.lineItems?.[item.id]?.description && (
                    <p 
                      id={`description-${item.id}-error`}
                      className="mt-1 text-sm text-red-600 dark:text-red-400" 
                      role="alert"
                    >
                      {errors.lineItems[item.id].description}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`sacCode-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    SAC/HSN Code <span className="text-red-500" aria-hidden="true">*</span>
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
                      placeholder="Search or enter code"
                      className={getInputClassName(!!errors.lineItems?.[item.id]?.sacCode)}
                      required
                      aria-required="true"
                      aria-invalid={!!errors.lineItems?.[item.id]?.sacCode}
                      aria-describedby={errors.lineItems?.[item.id]?.sacCode ? `sacCode-${item.id}-error` : undefined}
                      aria-autocomplete="list"
                      aria-controls={showSacDropdown[item.id] ? `sacCode-${item.id}-listbox` : undefined}
                    />
                    {showSacDropdown[item.id] && (
                      <div id={`sacCode-${item.id}-listbox`} className={`${dropdownContainerClassName} max-h-60 overflow-auto`} role="listbox">
                        {getFilteredSacCodes(item.id).map(sac => (
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
                            role="option"
                            aria-selected={item.sacCode === sac.code}
                          >
                            <div className="font-medium text-gray-900 dark:text-white">{sac.code}</div>
                            <div className="text-gray-500 dark:text-gray-400 text-xs">{sac.description}</div>
                          </button>
                        ))}
                        {getFilteredSacCodes(item.id).length === 0 && (
                          <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                            No matching codes found. You can enter a custom code.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.lineItems?.[item.id]?.sacCode && (
                    <p 
                      id={`sacCode-${item.id}-error`}
                      className="mt-1 text-sm text-red-600 dark:text-red-400" 
                      role="alert"
                    >
                      {errors.lineItems[item.id].sacCode}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`quantity-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Quantity <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="number"
                    id={`quantity-${item.id}`}
                    value={item.quantity}
                    onChange={(e) => handleLineItemChange(item.id, 'quantity', e.target.value)}
                    className={getInputClassName(!!errors.lineItems?.[item.id]?.quantity)}
                    required
                    aria-required="true"
                    min="1"
                    step="1"
                    aria-invalid={!!errors.lineItems?.[item.id]?.quantity}
                    aria-describedby={errors.lineItems?.[item.id]?.quantity ? `quantity-${item.id}-error` : undefined}
                  />
                  {errors.lineItems?.[item.id]?.quantity && (
                    <p 
                      id={`quantity-${item.id}-error`}
                      className="mt-1 text-sm text-red-600 dark:text-red-400" 
                      role="alert"
                    >
                      {errors.lineItems[item.id].quantity}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`rate-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Rate <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="number"
                    id={`rate-${item.id}`}
                    value={item.rate}
                    onChange={(e) => handleLineItemChange(item.id, 'rate', e.target.value)}
                    className={getInputClassName(!!errors.lineItems?.[item.id]?.rate)}
                    required
                    aria-required="true"
                    min="0.01"
                    step="0.01"
                    aria-invalid={!!errors.lineItems?.[item.id]?.rate}
                    aria-describedby={errors.lineItems?.[item.id]?.rate ? `rate-${item.id}-error` : undefined}
                  />
                  {errors.lineItems?.[item.id]?.rate && (
                    <p 
                      id={`rate-${item.id}-error`}
                      className="mt-1 text-sm text-red-600 dark:text-red-400" 
                      role="alert"
                    >
                      {errors.lineItems[item.id].rate}
                    </p>
                  )}
                </div>

                {/* GST Rate Selector for Domestic Invoices */}
                {formData.invoiceType !== 'EXPORT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      GST Rate
                    </label>
                    <GSTRateSelector
                      value={item.gstRate || 0}
                      onChange={(rate) => handleLineItemChange(item.id, 'gstRate', rate)}
                      size="small"
                      fullWidth
                    />
                  </div>
                )}

                <div className="flex items-end justify-between">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Amount
                    </label>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(item.totalAmount || item.amount, formData.invoiceType === 'EXPORT' ? formData.currency : 'INR').replace(/[^\d,.-]/g, '')}
                    </div>
                  </div>
                  {formData.lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(item.id)}
                      aria-label={`Remove line item ${item.id}`}
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
      {formData.invoiceType === 'EXPORT' ? (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal, formData.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>IGST (0%):</span>
              <span>{formatCurrency(0, formData.currency)}</span>
            </div>
            <div className="flex justify-between font-medium text-lg">
              <span>Total:</span>
              <span>{formatCurrency(total, formData.currency)}</span>
            </div>
          </div>
        </div>
      ) : (
        <GSTSummary
          taxableAmount={subtotal}
          cgstRate={gstDetails.cgstRate}
          sgstRate={gstDetails.sgstRate}
          igstRate={gstDetails.igstRate}
          cgstAmount={gstDetails.cgstAmount}
          sgstAmount={gstDetails.sgstAmount}
          igstAmount={gstDetails.igstAmount}
          totalGSTAmount={gstDetails.totalGSTAmount}
          totalAmount={total}
          variant="compact"
        />
      )}

      {/* LUT Declaration - Only for Export invoices */}
      {formData.invoiceType === 'EXPORT' && selectedLut && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            SUPPLY MEANT FOR EXPORT UNDER LUT NO {selectedLut.lutNumber} DATED{' '}
            {new Date(selectedLut.validFrom).toLocaleDateString()} – TAX NOT PAYABLE
          </p>
          {lutExpiryStatus && lutExpiryStatus.status !== 'active' && (
            <p className={`text-sm mt-2 ${
              lutExpiryStatus.status === 'expired' 
                ? 'text-red-600 dark:text-red-400 font-semibold' 
                : 'text-yellow-600 dark:text-yellow-400'
            }`}>
              {lutExpiryStatus.status === 'expired'
                ? '⚠️ This LUT has expired. Please update your LUT before creating invoices.'
                : `⚠️ This LUT expires in ${lutExpiryStatus.daysRemaining} days. Consider renewing soon.`}
            </p>
          )}
        </div>
      )}

      {/* GST Validation Warnings */}
      {gstValidation && !gstValidation.isValid && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
            GST Compliance Issues:
          </h4>
          <ul className="list-disc list-inside space-y-1">
            {gstValidation.errors.map((error, index) => (
              <li key={index} className="text-sm text-red-700 dark:text-red-300">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* GST Warnings */}
      {gstValidation && gstValidation.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
            GST Compliance Warnings:
          </h4>
          <ul className="list-disc list-inside space-y-1">
            {gstValidation.warnings.map((warning, index) => (
              <li key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Additional Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="bankDetails" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bank Details
          </label>
          <textarea
            id="bankDetails"
            rows={3}
            value={formData.bankDetails}
            onChange={(e) => setFormData(prev => ({ ...prev, bankDetails: e.target.value }))}
            className={textareaClassName}
            aria-label="Bank details"
          />
        </div>

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
            aria-label="Additional notes"
          />
        </div>
      </div>

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
          {isSubmitting ? 'Saving...' : (invoiceStatus && invoiceStatus !== 'DRAFT' ? 'Update Invoice' : 'Save Draft')}
        </button>
      </div>
    </form>
  )
}
