'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/trpc/client'
import { validateEmail, validateEmails } from '@/lib/email/validation'

interface EmailComposerProps {
  invoiceId: string
  invoiceNumber: string
  clientEmail: string
  clientName: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  type?: 'invoice' | 'payment-reminder'
}

export function EmailComposer({
  invoiceId,
  invoiceNumber,
  clientEmail,
  clientName,
  isOpen,
  onClose,
  onSuccess,
  type = 'invoice'
}: EmailComposerProps) {
  const [to, setTo] = useState(clientEmail)
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Send invoice email mutation
  const sendInvoiceEmailMutation = api.invoices.sendInvoiceEmail.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId)
      setIsSending(true)
    },
    onError: (error) => {
      setErrors({ general: error.message })
      setIsSending(false)
    }
  })

  // Send payment reminder mutation
  const sendPaymentReminderMutation = api.invoices.sendPaymentReminder.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId)
      setIsSending(true)
    },
    onError: (error) => {
      setErrors({ general: error.message })
      setIsSending(false)
    }
  })

  // Poll for email status
  const { data: emailStatus } = api.invoices.getEmailStatus.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId && isSending,
      refetchInterval: 1000,
    }
  )

  useEffect(() => {
    if (emailStatus?.status === 'completed') {
      setIsSending(false)
      setEmailSent(true)
      setJobId(null)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 2000)
    } else if (emailStatus?.status === 'failed') {
      setIsSending(false)
      setJobId(null)
      setErrors({ general: typeof emailStatus.error === 'string' ? emailStatus.error : 'Failed to send email' })
    }
  }, [emailStatus, onSuccess, onClose])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!validateEmail(to)) {
      newErrors.to = 'Invalid email address'
    }

    if (cc && !validateEmails(cc.split(',').map(e => e.trim()).filter(e => e))) {
      newErrors.cc = 'One or more CC email addresses are invalid'
    }

    if (bcc && !validateEmails(bcc.split(',').map(e => e.trim()).filter(e => e))) {
      newErrors.bcc = 'One or more BCC email addresses are invalid'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSend = async () => {
    if (!validateForm()) return

    const emailData = {
      id: invoiceId,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      customMessage: customMessage || undefined,
    }

    if (type === 'invoice') {
      await sendInvoiceEmailMutation.mutateAsync(emailData)
    } else {
      await sendPaymentReminderMutation.mutateAsync(emailData)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {type === 'invoice' ? 'Send Invoice' : 'Send Payment Reminder'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {type === 'invoice' 
              ? `Send invoice ${invoiceNumber} to ${clientName}`
              : `Send payment reminder for invoice ${invoiceNumber}`
            }
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {emailSent ? (
            <div className="text-center py-8">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                Email sent successfully!
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                The {type === 'invoice' ? 'invoice' : 'payment reminder'} has been sent to {to}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {errors.general && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{errors.general}</p>
                </div>
              )}

              <div>
                <label htmlFor="to" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  To
                </label>
                <input
                  type="email"
                  id="to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                    errors.to
                      ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                  } dark:bg-gray-700 dark:text-white`}
                />
                {errors.to && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.to}</p>
                )}
              </div>

              <div>
                <label htmlFor="cc" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  CC (Optional, comma-separated)
                </label>
                <input
                  type="text"
                  id="cc"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                    errors.cc
                      ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                  } dark:bg-gray-700 dark:text-white`}
                />
                {errors.cc && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.cc}</p>
                )}
              </div>

              <div>
                <label htmlFor="bcc" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  BCC (Optional, comma-separated)
                </label>
                <input
                  type="text"
                  id="bcc"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                    errors.bcc
                      ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                  } dark:bg-gray-700 dark:text-white`}
                />
                {errors.bcc && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.bcc}</p>
                )}
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Custom Message (Optional)
                </label>
                <textarea
                  id="message"
                  rows={4}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personal message to the email..."
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {type === 'invoice' 
                    ? 'The invoice PDF will be automatically attached to the email.'
                    : 'A link to view the invoice will be included in the reminder.'
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {emailSent ? 'Close' : 'Cancel'}
          </button>
          {!emailSent && (
            <button
              onClick={handleSend}
              disabled={isSending}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSending ? (
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
                  Sending...
                </>
              ) : (
                <>
                  <svg
                    className="-ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Send Email
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}