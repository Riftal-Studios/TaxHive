import type { Job } from '../types'
import { generateInvoicePDF } from '@/lib/pdf-generator'
import { uploadPDF } from '@/lib/pdf-uploader'
import { db } from '@/lib/prisma'

interface PdfGenerationResult {
  success: boolean
  pdfUrl: string
  invoiceId: string
}

export async function pdfGenerationHandler(job: Job): Promise<PdfGenerationResult> {
  const { invoiceId, userId } = job.data

  // Update progress if available
  const updateProgress = (job as any).updateProgress
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
    },
  })

  if (updateProgress) {
    await updateProgress(50)
  }

  // Generate PDF
  const pdfBuffer = await generateInvoicePDF(invoice, invoice.user)

  if (updateProgress) {
    await updateProgress(75)
  }

  // Upload PDF (for now, we'll save locally)
  const pdfUrl = await uploadPDF(pdfBuffer, `${invoiceId}.pdf`)

  // Update invoice with PDF URL
  await db.invoice.update({
    where: { id: invoiceId },
    data: { pdfUrl },
  })

  if (updateProgress) {
    await updateProgress(100)
  }

  return {
    success: true,
    pdfUrl,
    invoiceId,
  }
}