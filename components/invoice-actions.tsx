'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { EmailComposer } from './email-composer'
import Logger from '@/lib/logger'

interface InvoiceActionsProps {
  invoiceId: string
  invoiceNumber: string
  pdfUrl?: string | null
  clientEmail: string
  clientName: string
}

export function InvoiceActions({ 
  invoiceId, 
  invoiceNumber,
  pdfUrl,
  clientEmail,
  clientName 
}: InvoiceActionsProps) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [pdfReady, setPdfReady] = useState(!!pdfUrl)
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  
  // Queue PDF generation
  const queuePDFMutation = api.invoices.queuePDFGeneration.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId)
      setIsGenerating(true)
    },
  })

  // Poll for PDF generation status
  const { data: jobStatus } = api.invoices.getPDFGenerationStatus.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId && isGenerating,
      refetchInterval: 1000, // Poll every second
    }
  )

  useEffect(() => {
    if (jobStatus?.status === 'completed') {
      setIsGenerating(false)
      setPdfReady(true)
      setJobId(null)
      // Refresh the page to show the updated PDF URL
      router.refresh()
    } else if (jobStatus?.status === 'failed') {
      setIsGenerating(false)
      setJobId(null)
      alert('PDF generation failed. Please try again.')
    }
  }, [jobStatus, router])

  const handleGeneratePDF = async () => {
    try {
      await queuePDFMutation.mutateAsync({ id: invoiceId })
    } catch (error) {
      Logger.error('Failed to queue PDF generation', { error, invoiceId })
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const handleViewPDF = () => {
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')
  }

  const handleDownloadPDF = () => {
    window.location.href = `/api/invoices/${invoiceId}/download`
  }

  const handleEmailSuccess = () => {
    router.refresh()
  }

  // Show progress percentage if available
  const progressText = jobStatus?.progress 
    ? `Generating... ${jobStatus.progress}%`
    : 'Generating...';

  return (
    <>
      <div className="flex space-x-3">
        {/* Generate PDF button - only show if no PDF exists */}
        {!pdfReady && !isGenerating && (
          <button
            onClick={handleGeneratePDF}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
            Generate PDF
          </button>
        )}

        {/* Generating indicator */}
        {isGenerating && (
          <button
            disabled
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md opacity-50 cursor-not-allowed"
          >
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
            {progressText}
          </button>
        )}

        {/* View PDF button - only show if PDF exists */}
        {pdfReady && (
          <button
            onClick={handleViewPDF}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
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
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
              />
            </svg>
            View PDF
          </button>
        )}

        {/* Download PDF button - only show if PDF exists */}
        {pdfReady && (
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
            Download
          </button>
        )}
        
        {/* Send by Email button */}
        <button
          onClick={() => setShowEmailComposer(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
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
              d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" 
            />
          </svg>
          Send by Email
        </button>
      </div>

      {/* Email Composer Modal */}
      <EmailComposer
        invoiceId={invoiceId}
        invoiceNumber={invoiceNumber}
        clientEmail={clientEmail}
        clientName={clientName}
        isOpen={showEmailComposer}
        onClose={() => setShowEmailComposer(false)}
        onSuccess={handleEmailSuccess}
        type="invoice"
      />
    </>
  )
}