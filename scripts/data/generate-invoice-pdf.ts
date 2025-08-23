import { Logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'
import { generateInvoicePDF } from '../../lib/pdf-generator'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

async function generatePDFForInvoice() {
  try {
    // Find the latest invoice
    const invoice = await prisma.invoice.findFirst({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        client: true,
        lineItems: true,
        lut: true,
      }
    })

    if (!invoice) {
      Logger.error('Invoice not found')
      process.exit(1)
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: invoice.userId },
    })

    if (!user) {
      Logger.error('User not found')
      process.exit(1)
    }

    Logger.info('Generating PDF for invoice:', invoice.invoiceNumber)

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, user)
    
    // Ensure upload directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads', 'invoices')
    await mkdir(uploadsDir, { recursive: true })
    
    // Save PDF file
    const filename = `invoice-${invoice.invoiceNumber.replace('/', '-')}.pdf`
    const filePath = path.join(uploadsDir, filename)
    await writeFile(filePath, pdfBuffer)
    
    Logger.info('PDF saved to:', filePath)
    
    // Update invoice with PDF URL
    const pdfUrl = `/uploads/invoices/${filename}`
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl }
    })
    
    Logger.info('Invoice updated with PDF URL:', pdfUrl)
    Logger.info('✅ PDF generation complete!')
    
    process.exit(0)
  } catch (error) {
    Logger.error('Error generating PDF:', error)
    process.exit(1)
  }
}

generatePDFForInvoice()