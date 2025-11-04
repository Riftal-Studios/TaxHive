import type { Job, PdfGenerationJobData } from '../types'
import { generateInvoicePDF } from '@/lib/pdf-generator'
import { uploadPDF } from '@/lib/pdf-uploader'
import { cleanupOldPDF } from '@/lib/pdf-cleanup'
import { db } from '@/lib/prisma'

interface PdfGenerationResult {
  success: boolean
  pdfUrl: string
  invoiceId: string
}

export async function pdfGenerationHandler(job: Job<PdfGenerationJobData>): Promise<PdfGenerationResult> {
  const { invoiceId, userId } = job.data
  const maxRetries = 3
  let lastError: Error | unknown

  // Retry logic for transient failures
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Update progress if available
      const updateProgress = (job as { updateProgress?: (progress: number) => Promise<void> }).updateProgress
      if (updateProgress) {
        await updateProgress(25)
      }

      // Fetch invoice with all related data
      const invoice = await db.invoice.findUniqueOrThrow({
        where: { 
          id: invoiceId,
          userId: userId 
        },
        include: {
          user: true,
          client: true,
          lineItems: true,
          lut: true,
          payments: {
            orderBy: {
              paymentDate: 'asc'
            }
          },
        },
      })

      // Store old PDF URL for cleanup
      const oldPdfUrl = invoice.pdfUrl

      if (updateProgress) {
        await updateProgress(50)
      }

      // Generate PDF
      const pdfBuffer = await generateInvoicePDF(invoice, invoice.user)

      if (updateProgress) {
        await updateProgress(75)
      }

      // Upload PDF with timestamp to bust cache
      const timestamp = Date.now()
      const pdfUrl = await uploadPDF(pdfBuffer, `${invoiceId}-${timestamp}.pdf`)

      // Update invoice with PDF URL and status - wrap in try-catch for safety
      try {
        await db.invoice.update({
          where: { id: invoiceId },
          data: {
            pdfUrl,
            pdfStatus: 'completed',
            pdfGeneratedAt: new Date(),
            pdfError: null,
          },
        })
      } catch (dbError) {
        console.error(`Failed to update invoice ${invoiceId} with PDF URL:`, dbError)
        // PDF was generated but database update failed
        // The healthcheck will detect this as an orphaned job and reset it
        throw new Error(`PDF generated but database update failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
      }

      // Cleanup old PDF file if it exists (best effort, don't fail job if cleanup fails)
      if (oldPdfUrl && oldPdfUrl !== pdfUrl) {
        try {
          await cleanupOldPDF(oldPdfUrl)
        } catch (cleanupError) {
          console.warn(`Failed to cleanup old PDF ${oldPdfUrl}:`, cleanupError)
          // Don't fail the job because of cleanup error
        }
      }

      if (updateProgress) {
        await updateProgress(100)
      }

      return {
        success: true,
        pdfUrl,
        invoiceId,
      }
    } catch (error) {
      lastError = error
      console.error(`PDF generation attempt ${attempt} failed for invoice ${invoiceId}:`, error)
      
      // Check if error is retryable
      const isRetryable = error instanceof Error && (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('Network') ||
        error.message.includes('timeout')
      )
      
      // If this is not the last attempt and the error is retryable, wait and retry
      if (attempt < maxRetries && isRetryable) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // If this is the last attempt or error is not retryable, break
      break
    }
  }
  
  // All attempts failed, mark as failed
  const errorMessage = lastError instanceof Error ? lastError.message : 'PDF generation failed'

  // Use try-catch to ensure we don't lose the error if database update fails
  try {
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        pdfStatus: 'failed',
        pdfError: `Failed after ${maxRetries} attempts: ${errorMessage}`,
      }
    })
  } catch (dbError) {
    console.error(`Failed to update invoice ${invoiceId} status to failed:`, dbError)
    // Continue to throw the original error even if database update fails
    // The healthcheck script will clean this up later
  }

  // Re-throw the error so the job is marked as failed
  throw lastError
}