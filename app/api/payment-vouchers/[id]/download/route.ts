import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePaymentVoucherPDF } from '@/lib/pdf-generator'

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

    // Get payment voucher with related self-invoice
    const voucher = await prisma.paymentVoucher.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        selfInvoice: {
          include: {
            lineItems: true,
            unregisteredSupplier: true,
          },
        },
      },
    })

    if (!voucher) {
      return new NextResponse('Payment voucher not found', { status: 404 })
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return new NextResponse('User not found', { status: 404 })
    }

    // Generate PDF
    try {
      const pdfBuffer = await generatePaymentVoucherPDF(voucher, voucher.selfInvoice, user)

      // Create a safe filename
      const safeVoucherNumber = voucher.voucherNumber.replace(/\//g, '-')
      const downloadFilename = `${safeVoucherNumber}_Payment_Voucher_${new Date(voucher.voucherDate).toISOString().split('T')[0]}.pdf`

      // Set appropriate headers for download
      const headers = new Headers()
      headers.set('Content-Type', 'application/pdf')
      headers.set('Content-Disposition', `attachment; filename="${downloadFilename}"`)
      headers.set('Content-Length', pdfBuffer.length.toString())

      // Convert Buffer to Uint8Array for NextResponse
      return new NextResponse(new Uint8Array(pdfBuffer), { headers })
    } catch (error) {
      console.error('Error generating payment voucher PDF:', error)
      return new NextResponse('Failed to generate PDF', { status: 500 })
    }
  } catch (error) {
    console.error('Error downloading payment voucher PDF:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
