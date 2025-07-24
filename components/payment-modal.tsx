'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { toast } from 'sonner'

interface PaymentModalProps {
  invoiceId: string
  invoiceNumber: string
  currency: string
  totalAmount: number
  amountPaid: number
  balanceDue: number
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function PaymentModal({
  invoiceId,
  invoiceNumber,
  currency,
  totalAmount,
  amountPaid,
  balanceDue,
  isOpen,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [amount, setAmount] = useState<string>(balanceDue.toString())
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER')
  const [reference, setReference] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const recordPaymentMutation = api.payments.create.useMutation({
    onSuccess: () => {
      toast.success('Payment recorded successfully')
      onSuccess?.()
      onClose()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Please enter a valid amount'
    } else if (parsedAmount > balanceDue) {
      newErrors.amount = `Amount cannot exceed balance due (${currency} ${balanceDue.toFixed(2)})`
    }

    if (!paymentDate) {
      newErrors.paymentDate = 'Payment date is required'
    }

    if (!paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    await recordPaymentMutation.mutateAsync({
      invoiceId,
      amount: parseFloat(amount),
      currency,
      paymentDate: new Date(paymentDate),
      paymentMethod: paymentMethod as any,
      reference: reference || undefined,
      notes: notes || undefined,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Record Payment
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Invoice {invoiceNumber}
            </p>
          </div>

          <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-4">
              {/* Invoice Summary */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600 dark:text-gray-400">Total Amount:</div>
                  <div className="text-right font-medium">{currency} {totalAmount.toFixed(2)}</div>
                  
                  <div className="text-gray-600 dark:text-gray-400">Amount Paid:</div>
                  <div className="text-right font-medium">{currency} {amountPaid.toFixed(2)}</div>
                  
                  <div className="text-gray-600 dark:text-gray-400">Balance Due:</div>
                  <div className="text-right font-medium text-red-600 dark:text-red-400">
                    {currency} {balanceDue.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Payment Amount */}
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payment Amount <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">{currency}</span>
                  </div>
                  <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`block w-full pl-12 pr-3 py-2 rounded-md sm:text-sm ${
                      errors.amount
                        ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                    } dark:bg-gray-700 dark:text-white`}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                  />
                </div>
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount}</p>
                )}
                {parseFloat(amount) === balanceDue && (
                  <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                    This will fully pay the invoice
                  </p>
                )}
              </div>

              {/* Payment Date */}
              <div>
                <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="paymentDate"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                    errors.paymentDate
                      ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                  } dark:bg-gray-700 dark:text-white`}
                />
                {errors.paymentDate && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.paymentDate}</p>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                    errors.paymentMethod
                      ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                  } dark:bg-gray-700 dark:text-white`}
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="UPI">UPI</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="PAYONEER">Payoneer</option>
                  <option value="WISE">Wise (TransferWise)</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Reference Number */}
              <div>
                <label htmlFor="reference" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reference Number (Optional)
                </label>
                <input
                  type="text"
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  placeholder={
                    paymentMethod === 'BANK_TRANSFER' ? 'Wire transfer reference, IMPS/NEFT/RTGS number' :
                    paymentMethod === 'UPI' ? 'UPI transaction ID' :
                    paymentMethod === 'PAYPAL' ? 'PayPal transaction ID' :
                    paymentMethod === 'PAYONEER' ? 'Payoneer payment ID or transaction ID' :
                    paymentMethod === 'WISE' ? 'Wise transfer number' :
                    'Transaction ID, reference number, etc.'
                  }
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  placeholder={
                    paymentMethod === 'PAYONEER' 
                      ? 'e.g., Received via Payoneer balance, currency conversion details, sender company name'
                      : 'Any additional information about this payment'
                  }
                />
              </div>
              
              {/* Payoneer Information */}
              {paymentMethod === 'PAYONEER' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>Payoneer Tips:</strong> Include the Payoneer payment ID from your transaction history. 
                    If payment was received from a marketplace (Upwork, Fiverr, etc.), mention it in notes.
                    Payments typically take 1-3 business days to process.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={recordPaymentMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPaymentMutation.isPending}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {recordPaymentMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Recording...
                </>
              ) : (
                'Record Payment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}