import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get invoice to verify ownership and get PDF URL
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      select: {
        id: true,
        invoiceNumber: true,
        pdfUrl: true,
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

    if (!invoice.pdfUrl) {
      return new NextResponse('PDF not generated yet', { status: 404 })
    }

    // For now, we're serving from local filesystem
    // In production, this would redirect to S3/CDN URL
    const filename = path.basename(invoice.pdfUrl)
    const filePath = path.join(process.cwd(), 'uploads', 'invoices', filename)

    try {
      const pdfBuffer = await readFile(filePath)
      
      // Set appropriate headers
      const headers = new Headers()
      headers.set('Content-Type', 'application/pdf')
      headers.set('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`)
      headers.set('Cache-Control', 'private, max-age=3600')
      
      return new NextResponse(pdfBuffer, { headers })
    } catch (error) {
      console.error('Error reading PDF file:', error)
      return new NextResponse('PDF file not found', { status: 404 })
    }
  } catch (error) {
    console.error('Error serving PDF:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}