import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'
import { generateInvoicePDF } from '@/lib/pdf-generator'
import Logger from '@/lib/logger'

// Helper function to generate PDF on demand
async function generatePDFOnDemand(invoiceId: string, userId: string): Promise<Buffer> {
  // Fetch full invoice data with relations
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      userId: userId,
    },
    include: {
      client: true,
      lineItems: true,
      lut: true,
    },
  })

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Generate PDF
  const pdfBuffer = await generateInvoicePDF(invoice, user)
  
  // Optionally save the generated PDF to disk and update invoice record
  // This part can be enhanced later to save to the uploads directory
  
  return pdfBuffer
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get invoice to verify ownership and get PDF URL
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      select: {
        id: true,
        invoiceNumber: true,
        pdfUrl: true,
        invoiceDate: true,
        client: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 })
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
          pdfBuffer = await generatePDFOnDemand(invoice.id, session.user.id)
        }
      } else {
        // Generate new PDF
        pdfBuffer = await generatePDFOnDemand(invoice.id, session.user.id)
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
      Logger.error('Error generating/reading PDF:', error)
      return new NextResponse('Failed to generate PDF', { status: 500 })
    }
  } catch (error) {
    Logger.error('Error downloading PDF:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}