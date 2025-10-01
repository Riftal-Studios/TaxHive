import { Job } from 'bullmq'
import { PDFGenerationJobData, PDFGenerationJobResult } from '../types'
import { prisma } from '@/lib/prisma'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import Logger from '@/lib/logger'

// Import actual PDF generators
import { generateInvoicePDF } from '@/lib/pdf/invoice-generator'
import { generateCreditNotePDF } from '@/lib/pdf/credit-note-generator'
import { generateDebitNotePDF } from '@/lib/pdf/debit-note-generator'
import { generateReceiptPDF } from '@/lib/pdf/receipt-generator'
// import { uploadToS3 } from '@/lib/s3' // S3 upload to be implemented separately

// Main processor function
export default async function processPDFGeneration(
  job: Job<PDFGenerationJobData>
): Promise<PDFGenerationJobResult> {
  const { type, entityId, userId, options } = job.data
  
  // Update job progress
  await job.updateProgress(10)
  
  let pdfBuffer: Buffer
  let filename: string
  
  try {
    // Generate PDF based on type
    switch (type) {
      case 'invoice': {
        const invoice = await prisma.invoice.findFirst({
          where: { id: entityId, userId },
          include: {
            client: true,
            lineItems: true,
            taxBreakdown: true,
            user: true,
          },
        })
        
        if (!invoice) {
          throw new Error(`Invoice ${entityId} not found`)
        }
        
        await job.updateProgress(30)
        
        // Generate actual invoice PDF
        pdfBuffer = await generateInvoicePDF(invoice)
        filename = `invoice-${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`
        break
      }
      
      case 'credit-note': {
        const creditNote = await prisma.creditDebitNote.findFirst({
          where: { id: entityId, userId, noteType: 'CREDIT' },
          include: {
            invoice: {
              include: {
                client: true,
                user: true,
              },
            },
            lineItems: true,
          },
        })
        
        if (!creditNote) {
          throw new Error(`Credit note ${entityId} not found`)
        }
        
        await job.updateProgress(30)
        
        // Generate actual credit note PDF
        pdfBuffer = await generateCreditNotePDF(creditNote)
        filename = `credit-note-${creditNote.noteNumber.replace(/\//g, '-')}.pdf`
        break
      }
      
      case 'debit-note': {
        const debitNote = await prisma.creditDebitNote.findFirst({
          where: { id: entityId, userId, noteType: 'DEBIT' },
          include: {
            invoice: {
              include: {
                client: true,
                user: true,
              },
            },
            lineItems: true,
          },
        })
        
        if (!debitNote) {
          throw new Error(`Debit note ${entityId} not found`)
        }
        
        await job.updateProgress(30)
        
        // Generate actual debit note PDF
        pdfBuffer = await generateDebitNotePDF(debitNote)
        filename = `debit-note-${debitNote.noteNumber.replace(/\//g, '-')}.pdf`
        break
      }
      
      case 'receipt': {
        const payment = await prisma.payment.findFirst({
          where: { id: entityId, userId },
          include: {
            invoice: {
              include: {
                client: true,
                user: true,
              },
            },
          },
        })
        
        if (!payment) {
          throw new Error(`Payment ${entityId} not found`)
        }
        
        await job.updateProgress(30)
        
        // Generate actual receipt PDF
        pdfBuffer = await generateReceiptPDF(payment)
        filename = `receipt-${payment.receiptNumber?.replace(/\//g, '-') || payment.id}.pdf`
        break
      }
      
      default:
        throw new Error(`Unknown PDF type: ${type}`)
    }
    
    await job.updateProgress(60)
    
    // Save to temporary file
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gsthive-pdf-'))
    const tempPath = path.join(tempDir, filename)
    await fs.writeFile(tempPath, pdfBuffer)
    
    await job.updateProgress(70)
    
    // Upload to S3 if configured
    let s3Key: string | undefined
    if (options?.saveToS3 && process.env.AWS_S3_BUCKET) {
      s3Key = `pdfs/${userId}/${type}/${filename}`
      // S3 upload implementation pending - will be added when S3 module is created
      // await uploadToS3({ key: s3Key, body: pdfBuffer, contentType: 'application/pdf' })
      Logger.info(`S3 upload skipped - module not yet implemented. Would upload to: ${s3Key}`)
      await job.updateProgress(90)
    }
    
    // Update entity with PDF URL
    const pdfUrl = s3Key 
      ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`
      : tempPath
      
    switch (type) {
      case 'invoice':
        await prisma.invoice.update({
          where: { id: entityId },
          data: { 
            pdfUrl,
            pdfGeneratedAt: new Date(),
          },
        })
        break
      case 'credit-note':
      case 'debit-note':
        await prisma.creditDebitNote.update({
          where: { id: entityId },
          data: { pdfUrl },
        })
        break
      case 'receipt':
        await prisma.payment.update({
          where: { id: entityId },
          data: { receiptUrl: pdfUrl },
        })
        break
    }
    
    await job.updateProgress(100)
    
    // Return result
    const result: PDFGenerationJobResult = {
      pdfUrl,
      pdfPath: tempPath,
      s3Key,
      generatedAt: new Date(),
    }
    
    // Clean up temp file after a delay if S3 upload succeeded
    if (s3Key) {
      setTimeout(async () => {
        try {
          await fs.unlink(tempPath)
          await fs.rmdir(tempDir)
        } catch (error) {
          Logger.error('Error cleaning up temp PDF:', error)
        }
      }, 5000)
    }
    
    return result
    
  } catch (error) {
    Logger.error(`Error generating PDF for ${type} ${entityId}:`, error)
    throw error
  }
}