/**
 * Invoice Service Layer
 * 
 * Centralizes all invoice-related business logic, separating it from the tRPC router layer.
 * This service handles invoice creation, updates, calculations, and GST compliance.
 */

import { db } from '@/lib/prisma'
import { 
  generateInvoiceNumber, 
  getCurrentFiscalYear, 
  calculateSubtotal, 
  calculateGST, 
  calculateTotal, 
  validateHSNCode 
} from '@/lib/invoice-utils'
import { generateSecureToken, getTokenExpirationDate } from '@/lib/utils/token'
import { getNextInvoiceSequence } from '@/lib/invoice-number-utils'
import { GST_CONSTANTS } from '@/lib/constants'
import { validateGSTInvoice } from '@/lib/validations/gst'
import { queueManager } from '@/lib/queue/manager'
import { JOB_PRIORITIES } from '@/lib/queue/config'
import { cache } from '@/lib/cache/redis-cache'
import Logger from '@/lib/logger'
import type { Prisma, Invoice, Client, InvoiceItem, LUT } from '@prisma/client'

// Types
export interface CreateInvoiceInput {
  userId: string
  clientId: string
  lutId?: string
  issueDate: Date
  dueDate: Date
  currency: string
  exchangeRate: number
  exchangeRateSource: string
  paymentTerms?: number
  bankDetails?: string
  notes?: string
  lineItems: Array<{
    description: string
    quantity: number
    rate: number
    sacCode: string
  }>
}

export interface UpdateInvoiceInput {
  id: string
  userId: string
  status?: string
  paymentStatus?: string
  notes?: string
  dueDate?: Date
}

export interface InvoiceFilter {
  userId: string
  clientId?: string
  status?: 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE'
  fromDate?: Date
  toDate?: Date
}

export type InvoiceWithRelations = Invoice & {
  client: Client
  lineItems?: InvoiceItem[]
  lut?: LUT | null
}

/**
 * Invoice Service Class
 */
export class InvoiceService {
  /**
   * Create a new invoice
   */
  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithRelations> {
    const { userId, lineItems, ...invoiceData } = input

    return await db.$transaction(async (tx) => {
      // Get the current fiscal year
      const currentFY = getCurrentFiscalYear(input.issueDate)
      
      // Get the next invoice number
      const existingInvoices = await tx.invoice.findMany({
        where: {
          userId,
          invoiceNumber: {
            startsWith: `FY${currentFY.slice(2, 4)}-${currentFY.slice(-2)}/`,
          },
        },
        select: { invoiceNumber: true },
      })
      
      const invoiceNumbers = existingInvoices.map(inv => inv.invoiceNumber)
      const nextSequence = getNextInvoiceSequence(invoiceNumbers)
      const invoiceNumber = generateInvoiceNumber(currentFY, nextSequence)
      
      // Calculate totals
      const subtotal = calculateSubtotal(lineItems)
      const gstAmount = 0 // Always 0 for exports under LUT
      const totalAmount = calculateTotal(subtotal, gstAmount)
      
      // Validate GST compliance
      const gstValidation = validateGSTInvoice({
        placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
        serviceCode: lineItems[0].sacCode,
        igstRate: 0,
        lutId: invoiceData.lutId,
        currency: invoiceData.currency,
        exchangeRate: invoiceData.exchangeRate,
        exchangeSource: invoiceData.exchangeRateSource,
      })
      
      if (!gstValidation.isValid) {
        throw new Error(`GST validation failed: ${gstValidation.errors.join(', ')}`)
      }
      
      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          userId,
          clientId: invoiceData.clientId,
          lutId: invoiceData.lutId,
          invoiceNumber,
          invoiceDate: invoiceData.issueDate,
          dueDate: invoiceData.dueDate,
          currency: invoiceData.currency,
          exchangeRate: invoiceData.exchangeRate,
          exchangeSource: invoiceData.exchangeRateSource,
          subtotal,
          igstRate: 0,
          igstAmount: gstAmount,
          totalAmount,
          totalInINR: totalAmount * invoiceData.exchangeRate,
          status: 'DRAFT',
          placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
          serviceCode: lineItems[0].sacCode,
          paymentTerms: invoiceData.paymentTerms?.toString(),
          bankDetails: invoiceData.bankDetails,
          notes: invoiceData.notes,
          paymentStatus: 'UNPAID',
          amountPaid: 0,
          balanceDue: totalAmount,
          publicAccessToken: generateSecureToken(),
          tokenExpiresAt: getTokenExpirationDate(90),
        },
        include: {
          client: true,
        },
      })
      
      // Create line items
      await tx.invoiceItem.createMany({
        data: lineItems.map((item) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.quantity * item.rate,
          serviceCode: item.sacCode,
        })),
      })
      
      // Clear cache for this user
      await cache.clearType('invoices', userId)
      
      // Queue PDF generation
      await this.queuePDFGeneration(invoice.id, userId)
      
      return invoice
    })
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(
    id: string, 
    userId: string, 
    includePayments = false
  ): Promise<InvoiceWithRelations | null> {
    const cacheKey = `${id}:${includePayments ? 'with-payments' : 'no-payments'}`
    
    return await cache.cached(
      'invoices',
      cacheKey,
      async () => {
        return await db.invoice.findUnique({
          where: { id, userId },
          include: {
            client: true,
            lineItems: true,
            lut: true,
            payments: includePayments || undefined,
          },
        })
      },
      {
        userId,
        ttl: 300, // Cache for 5 minutes
      }
    )
  }

  /**
   * List invoices with filters
   */
  async listInvoices(filter: InvoiceFilter): Promise<InvoiceWithRelations[]> {
    const { userId, clientId, status, fromDate, toDate } = filter
    const cacheKey = `list:${clientId || 'all'}:${status || 'all'}`
    
    return await cache.cached(
      'invoices',
      cacheKey,
      async () => {
        const where: Prisma.InvoiceWhereInput = { userId }
        
        if (clientId) {
          where.clientId = clientId
        }
        
        if (status) {
          if (status === 'UNPAID') {
            where.paymentStatus = 'UNPAID'
          } else if (status === 'PAID') {
            where.paymentStatus = 'PAID'
          } else if (status === 'PARTIALLY_PAID') {
            where.paymentStatus = 'PARTIAL'
          } else if (status === 'OVERDUE') {
            where.AND = [
              { paymentStatus: { not: 'PAID' } },
              { dueDate: { lt: new Date() } }
            ]
          }
        }
        
        if (fromDate || toDate) {
          where.invoiceDate = {}
          if (fromDate) where.invoiceDate.gte = fromDate
          if (toDate) where.invoiceDate.lte = toDate
        }
        
        return await db.invoice.findMany({
          where,
          include: { client: true },
          orderBy: { createdAt: 'desc' },
        })
      },
      {
        userId,
        ttl: 300, // Cache for 5 minutes
      }
    )
  }

  /**
   * Update invoice
   */
  async updateInvoice(input: UpdateInvoiceInput): Promise<InvoiceWithRelations> {
    const { id, userId, ...updateData } = input
    
    const invoice = await db.invoice.update({
      where: { id, userId },
      data: updateData,
      include: {
        client: true,
        lineItems: true,
      },
    })
    
    // Clear cache for this user
    await cache.clearType('invoices', userId)
    
    return invoice
  }

  /**
   * Delete invoice
   */
  async deleteInvoice(id: string, userId: string): Promise<void> {
    await db.invoice.delete({
      where: { id, userId },
    })
    
    // Clear cache for this user
    await cache.clearType('invoices', userId)
  }

  /**
   * Record payment for an invoice
   */
  async recordPayment(
    invoiceId: string,
    userId: string,
    amount: number,
    paymentDate: Date,
    paymentMethod: string,
    reference?: string
  ): Promise<void> {
    await db.$transaction(async (tx) => {
      // Get current invoice
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId, userId },
        include: { payments: true },
      })
      
      if (!invoice) {
        throw new Error('Invoice not found')
      }
      
      // Create payment record
      await tx.payment.create({
        data: {
          invoiceId,
          amount,
          currency: invoice.currency,
          paymentDate,
          paymentMethod,
          reference,
        },
      })
      
      // Update invoice payment status
      const totalPaid = invoice.payments.reduce(
        (sum, p) => sum + Number(p.amount), 
        0
      ) + amount
      
      const balanceDue = Number(invoice.totalAmount) - totalPaid
      const paymentStatus = balanceDue <= 0 ? 'PAID' : 
                           totalPaid > 0 ? 'PARTIAL' : 'UNPAID'
      
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: totalPaid,
          balanceDue,
          paymentStatus,
        },
      })
    })
    
    // Clear cache for this user
    await cache.clearType('invoices', userId)
  }

  /**
   * Recalculate balance due for an invoice
   */
  async recalculateBalance(id: string, userId: string): Promise<Invoice> {
    const invoice = await db.invoice.findUnique({
      where: { id, userId },
      include: { payments: true }
    })
    
    if (!invoice) {
      throw new Error('Invoice not found')
    }
    
    // Calculate total paid from all payments
    const totalPaid = invoice.payments.reduce((sum, payment) => 
      sum + Number(payment.amount), 0
    )
    
    const balanceDue = Number(invoice.totalAmount) - totalPaid
    const paymentStatus = balanceDue <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID'
    
    // Update invoice with correct values
    const updated = await db.invoice.update({
      where: { id },
      data: {
        amountPaid: totalPaid,
        balanceDue: balanceDue,
        paymentStatus: paymentStatus,
      }
    })
    
    // Clear cache for this user
    await cache.clearType('invoices', userId)
    
    return updated
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(userId: string): Promise<{
    totalInvoices: number
    totalAmount: number
    totalPaid: number
    totalDue: number
    overdueCount: number
  }> {
    const cacheKey = `stats:${userId}`
    
    return await cache.cached(
      'invoices',
      cacheKey,
      async () => {
        const invoices = await db.invoice.findMany({
          where: { userId },
          select: {
            totalAmount: true,
            amountPaid: true,
            balanceDue: true,
            paymentStatus: true,
            dueDate: true,
          },
        })
        
        const now = new Date()
        let totalAmount = 0
        let totalPaid = 0
        let totalDue = 0
        let overdueCount = 0
        
        for (const invoice of invoices) {
          totalAmount += Number(invoice.totalAmount)
          totalPaid += Number(invoice.amountPaid)
          totalDue += Number(invoice.balanceDue)
          
          if (invoice.paymentStatus !== 'PAID' && invoice.dueDate < now) {
            overdueCount++
          }
        }
        
        return {
          totalInvoices: invoices.length,
          totalAmount,
          totalPaid,
          totalDue,
          overdueCount,
        }
      },
      {
        userId,
        ttl: 600, // Cache for 10 minutes
      }
    )
  }

  /**
   * Queue PDF generation for an invoice
   */
  private async queuePDFGeneration(invoiceId: string, userId: string): Promise<void> {
    try {
      await queueManager.addPDFGenerationJob(
        {
          type: 'invoice',
          entityId: invoiceId,
          userId,
          options: {
            sendEmail: false,
            saveToS3: !!process.env.AWS_S3_BUCKET,
          },
        },
        {
          priority: JOB_PRIORITIES.HIGH,
        }
      )
    } catch (error) {
      Logger.error('Failed to queue PDF generation', { error, invoiceId })
      // Don't fail invoice creation for PDF generation issues
    }
  }

  /**
   * Send invoice email
   */
  async sendInvoiceEmail(
    invoiceId: string,
    userId: string,
    recipientEmail: string,
    subject?: string,
    message?: string
  ): Promise<void> {
    const invoice = await this.getInvoiceById(invoiceId, userId)
    
    if (!invoice) {
      throw new Error('Invoice not found')
    }
    
    // Queue email job
    await queueManager.addEmailNotificationJob(
      {
        type: 'invoice_sent',
        data: {
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.client.name,
          totalAmount: Number(invoice.totalAmount),
          currency: invoice.currency,
          dueDate: invoice.dueDate.toISOString(),
          recipientEmail,
          subject,
          message,
        },
        userId,
      },
      {
        priority: JOB_PRIORITIES.NORMAL,
        delay: 5000, // Delay to ensure PDF is generated
      }
    )
    
    // Update invoice status
    await this.updateInvoice({
      id: invoiceId,
      userId,
      status: 'SENT',
    })
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService()