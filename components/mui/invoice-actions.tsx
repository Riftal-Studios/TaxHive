'use client'

import React, { useState, useEffect } from 'react'
import {
  Button,
  ButtonGroup,
  CircularProgress,
} from '@mui/material'
import {
  PictureAsPdf as PdfIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { MUIEmailComposer } from './email-composer'
import Logger from '@/lib/logger'

interface InvoiceActionsProps {
  invoiceId: string
  invoiceNumber: string
  pdfUrl?: string | null
  clientEmail: string
  clientName: string
  pdfGenerating?: boolean
}

export function MUIInvoiceActions({ 
  invoiceId, 
  invoiceNumber,
  pdfUrl,
  clientEmail,
  clientName,
  pdfGenerating = false
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
      Logger.error('Failed to queue PDF generation:', error)
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
    : 'Generating...'

  return (
    <>
      <ButtonGroup variant="contained" aria-label="invoice actions">
        {/* Generate PDF button - only show if no PDF exists */}
        {!pdfReady && !isGenerating && (
          <Button
            onClick={handleGeneratePDF}
            startIcon={<PdfIcon />}
          >
            Generate PDF
          </Button>
        )}

        {/* Generating indicator */}
        {isGenerating && (
          <Button
            disabled
            startIcon={<CircularProgress size={16} />}
          >
            {progressText}
          </Button>
        )}

        {/* View PDF button - only show if PDF exists */}
        {pdfReady && (
          <Button
            onClick={handleViewPDF}
            startIcon={<ViewIcon />}
            variant="outlined"
            disabled={pdfGenerating}
          >
            View PDF
          </Button>
        )}

        {/* Download PDF button - only show if PDF exists */}
        {pdfReady && (
          <Button
            onClick={handleDownloadPDF}
            startIcon={<DownloadIcon />}
            disabled={pdfGenerating}
          >
            Download
          </Button>
        )}
        
        {/* Send by Email button - disabled when PDF is generating */}
        <Button
          onClick={() => setShowEmailComposer(true)}
          startIcon={<EmailIcon />}
          variant="outlined"
          disabled={pdfGenerating || isGenerating}
        >
          Send by Email
        </Button>
      </ButtonGroup>

      {/* Email Composer Modal */}
      <MUIEmailComposer
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