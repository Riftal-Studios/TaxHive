import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'
import Logger from '@/lib/logger'
import { withErrorHandler, createApiError } from '@/lib/api-error-handler'

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
    const { id } = await params
    
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      throw new Error('Unauthorized')
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
        client: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!invoice) {
      throw new Error('Not found: Invoice not found')
    }

    if (!invoice.pdfUrl) {
      throw new Error('Not found: PDF not generated yet')
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
      Logger.error('Error reading PDF file:', error)
      throw new Error('Not found: PDF file not found')
    }
})