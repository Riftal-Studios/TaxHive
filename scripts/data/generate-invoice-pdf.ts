import { prisma } from '../lib/prisma'
import { generateInvoicePDF } from '../lib/pdf-generator'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

async function generatePDFForInvoice() {
  try {
    // Find the invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        publicAccessToken: '_dXZSGbfnHdB31LcE5bdaI-_LPCODxMl2hHmDv0ER2I'
      },
      include: {
        client: true,
        lineItems: true,
        lut: true,
      }
    })

    if (!invoice) {
      console.error('Invoice not found')
      process.exit(1)
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: invoice.userId },
    })

    if (!user) {
      console.error('User not found')
      process.exit(1)
    }

    console.log('Generating PDF for invoice:', invoice.invoiceNumber)

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, user)
    
    // Ensure upload directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads', 'invoices')
    await mkdir(uploadsDir, { recursive: true })
    
    // Save PDF file
    const filename = `invoice-${invoice.invoiceNumber.replace('/', '-')}.pdf`
    const filePath = path.join(uploadsDir, filename)
    await writeFile(filePath, pdfBuffer)
    
    console.log('PDF saved to:', filePath)
    
    // Update invoice with PDF URL
    const pdfUrl = `/uploads/invoices/${filename}`
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl }
    })
    
    console.log('Invoice updated with PDF URL:', pdfUrl)
    console.log('✅ PDF generation complete!')
    
    process.exit(0)
  } catch (error) {
    console.error('Error generating PDF:', error)
    process.exit(1)
  }
}

generatePDFForInvoice()