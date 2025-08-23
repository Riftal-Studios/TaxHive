import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isTokenExpired } from '@/lib/utils/token'
import Logger from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Find invoice by public access token
    const invoice = await prisma.invoice.findUnique({
      where: {
        publicAccessToken: token,
      },
      include: {
        client: true,
        lineItems: true,
        lut: true,
        user: {
          select: {
            name: true,
            email: true,
            gstin: true,
            pan: true,
            address: true,
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        { status: 404 }
      )
    }

    // Check if token has expired
    if (isTokenExpired(invoice.tokenExpiresAt)) {
      return NextResponse.json(
        { error: 'This link has expired. Please contact the sender for a new link.' },
        { status: 410 } // 410 Gone
      )
    }

    // Return invoice data for public viewing
    return NextResponse.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        exchangeSource: invoice.exchangeSource,
        subtotal: invoice.subtotal,
        igstRate: invoice.igstRate,
        igstAmount: invoice.igstAmount,
        totalAmount: invoice.totalAmount,
        totalInINR: invoice.totalInINR,
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        placeOfSupply: invoice.placeOfSupply,
        serviceCode: invoice.serviceCode,
        notes: invoice.notes,
        bankDetails: invoice.bankDetails,
        pdfUrl: invoice.pdfUrl,
        client: invoice.client,
        lineItems: invoice.lineItems,
        lut: invoice.lut,
        supplier: {
          name: invoice.user.name,
          email: invoice.user.email,
          gstin: invoice.user.gstin,
          pan: invoice.user.pan,
          address: invoice.user.address,
        }
      }
    })
  } catch (error) {
    Logger.error('Error fetching public invoice:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}