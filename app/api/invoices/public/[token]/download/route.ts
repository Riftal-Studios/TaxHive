import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isTokenExpired } from '@/lib/utils/token'
import { readFile } from 'fs/promises'
import path from 'path'
import { generateInvoicePDF } from '@/lib/pdf-generator'

async function generatePDFOnDemand(invoice: { id: string; userId: string }): Promise<Buffer> {
  // Get full invoice data with relations
  const fullInvoice = await prisma.invoice.findUnique({
    where: { id: invoice.id },
    include: {
      client: true,
      lineItems: true,
      lut: true,
    }
  })
  
  if (!fullInvoice) {
    throw new Error('Invoice not found')
  }
  
  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: fullInvoice.userId }
  })
  
  if (!user) {
    throw new Error('User not found')
  }
  
  // Generate PDF
  const pdfBuffer = await generateInvoicePDF(fullInvoice, user)
  
  return pdfBuffer
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    if (!token) {
      return new NextResponse('Token is required', { status: 400 })
    }

    // Find invoice by public access token
    const invoice = await prisma.invoice.findUnique({
      where: {
        publicAccessToken: token,
      },
      select: {
        id: true,
        userId: true,
        invoiceNumber: true,
        pdfUrl: true,
        invoiceDate: true,
        tokenExpiresAt: true,
        client: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!invoice) {
      return new NextResponse('Invalid or expired link', { status: 404 })
    }

    // Check if token has expired
    if (isTokenExpired(invoice.tokenExpiresAt)) {
      return new NextResponse('This link has expired', { status: 410 })
    }

    // Generate PDF on-the-fly if not cached
    try {
      let pdfBuffer: Buffer
      
      if (invoice.pdfUrl) {
        // Try to read cached PDF
        const filename = path.basename(invoice.pdfUrl)
        const filePath = path.join(process.cwd(), 'uploads', 'invoices', filename)
        try {
          pdfBuffer = await readFile(filePath)
        } catch {
          // If cached PDF not found, generate new one
          pdfBuffer = await generatePDFOnDemand(invoice)
        }
      } else {
        // Generate new PDF
        pdfBuffer = await generatePDFOnDemand(invoice)
      }
      
      // Create a safe filename
      const safeClientName = invoice.client.name.replace(/[^a-zA-Z0-9]/g, '_')
      const downloadFilename = `${invoice.invoiceNumber}_${safeClientName}_${new Date(invoice.invoiceDate).toISOString().split('T')[0]}.pdf`
      
      // Set appropriate headers for download
      const headers = new Headers()
      headers.set('Content-Type', 'application/pdf')
      headers.set('Content-Disposition', `attachment; filename="${downloadFilename}"`)
      headers.set('Content-Length', pdfBuffer.length.toString())
      
      return new NextResponse(pdfBuffer, { headers })
    } catch (error) {
      console.error('Error generating/reading PDF:', error)
      return new NextResponse('Failed to generate PDF', { status: 500 })
    }
  } catch (error) {
    console.error('Error downloading public PDF:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}