import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface PaymentSubmissionData {
  clientId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  paymentMethod: string;
  transactionRef?: string;
  bankName?: string;
  accountLastFour?: string;
  notes?: string;
  receiptUrls?: string[];
}

export interface PaymentHistoryFilters {
  clientId: string;
  status?: string;
  page: number;
  limit: number;
}

export interface InvoicePaymentStatusRequest {
  clientId: string;
  invoiceId: string;
}

export interface PaymentVerificationData {
  submissionId: string;
  verifiedBy: string;
  notes?: string;
}

export class ClientPortalPayments {
  
  /**
   * Submit a payment for verification
   */
  async submitPayment(data: PaymentSubmissionData) {
    // Check client permissions
    const portalAccess = await prisma.clientPortalAccess.findUnique({
      where: { clientId: data.clientId }
    });

    if (!portalAccess || !portalAccess.canRecordPayments) {
      throw new Error('Permission denied: Cannot record payments');
    }

    // Verify invoice belongs to client
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: data.invoiceId,
        clientId: data.clientId
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found or access denied');
    }

    // Validate payment amount
    if (data.amount > invoice.balanceDue.toNumber()) {
      throw new Error('Payment amount exceeds invoice balance');
    }

    // Validate currency matches invoice
    if (data.currency !== invoice.currency) {
      throw new Error('Payment currency must match invoice currency');
    }

    // Check for duplicate transaction reference
    if (data.transactionRef) {
      const existingPayment = await prisma.clientPaymentSubmission.findFirst({
        where: {
          transactionRef: data.transactionRef,
          clientId: data.clientId
        }
      });

      if (existingPayment) {
        throw new Error('Payment with this transaction reference already exists');
      }
    }

    // Validate receipt URLs
    if (data.receiptUrls) {
      if (data.receiptUrls.length > 10) {
        throw new Error('Maximum 10 receipt files allowed');
      }

      for (const url of data.receiptUrls) {
        if (!this.isValidReceiptUrl(url)) {
          throw new Error('Invalid receipt URL format');
        }
      }
    }

    // Calculate auto-matching confidence
    const matchConfidence = this.calculateMatchConfidence(data, invoice);
    const autoMatched = matchConfidence >= 0.8;

    // Create payment submission
    const submission = await prisma.clientPaymentSubmission.create({
      data: {
        clientId: data.clientId,
        invoiceId: data.invoiceId,
        amount: new Decimal(data.amount),
        currency: data.currency,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        transactionRef: data.transactionRef,
        bankName: data.bankName,
        accountLastFour: data.accountLastFour,
        notes: data.notes,
        receiptUrls: data.receiptUrls || [],
        autoMatched,
        matchConfidence: matchConfidence ? new Decimal(matchConfidence) : null,
        status: 'SUBMITTED'
      }
    });

    // Create notification for payment submission
    await this.createPaymentNotification({
      clientId: data.clientId,
      invoiceId: data.invoiceId,
      type: 'PAYMENT_SUBMITTED',
      amount: data.amount,
      currency: data.currency
    });

    return {
      id: submission.id,
      status: submission.status,
      amount: submission.amount.toNumber(),
      currency: submission.currency,
      transactionRef: submission.transactionRef,
      receiptUrls: submission.receiptUrls,
      autoMatched: submission.autoMatched,
      matchConfidence: submission.matchConfidence?.toNumber() || null
    };
  }

  /**
   * Get payment history for a client
   */
  async getPaymentHistory(filters: PaymentHistoryFilters) {
    const offset = (filters.page - 1) * filters.limit;
    
    const whereClause: any = {
      clientId: filters.clientId
    };

    if (filters.status) {
      whereClause.status = filters.status;
    }

    const [payments, total] = await Promise.all([
      prisma.clientPaymentSubmission.findMany({
        where: whereClause,
        include: {
          invoice: {
            select: {
              invoiceNumber: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: filters.limit,
        skip: offset
      }),
      prisma.clientPaymentSubmission.count({
        where: whereClause
      })
    ]);

    return {
      payments: payments.map(p => ({
        id: p.id,
        amount: p.amount.toNumber(),
        currency: p.currency,
        status: p.status,
        paymentDate: p.paymentDate,
        invoiceNumber: p.invoice.invoiceNumber,
        transactionRef: p.transactionRef,
        createdAt: p.createdAt
      })),
      total
    };
  }

  /**
   * Get payment status for a specific invoice
   */
  async getInvoicePaymentStatus(request: InvoicePaymentStatusRequest) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: request.invoiceId,
        clientId: request.clientId
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found or access denied');
    }

    const submittedPayments = await prisma.clientPaymentSubmission.findMany({
      where: {
        invoiceId: request.invoiceId,
        clientId: request.clientId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      invoiceId: request.invoiceId,
      totalAmount: invoice.totalAmount.toNumber(),
      amountPaid: invoice.amountPaid.toNumber(),
      balanceDue: invoice.balanceDue.toNumber(),
      submittedPayments: submittedPayments.map(p => ({
        id: p.id,
        amount: p.amount.toNumber(),
        currency: p.currency,
        status: p.status,
        paymentDate: p.paymentDate,
        transactionRef: p.transactionRef,
        createdAt: p.createdAt
      }))
    };
  }

  /**
   * Verify a payment submission
   */
  async verifyPayment(data: PaymentVerificationData) {
    const submission = await prisma.clientPaymentSubmission.findUnique({
      where: { id: data.submissionId },
      include: { invoice: true }
    });

    if (!submission) {
      throw new Error('Payment submission not found');
    }

    // Update submission status
    await prisma.clientPaymentSubmission.update({
      where: { id: data.submissionId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: data.verifiedBy,
        verifierNotes: data.notes
      }
    });

    // Create actual payment record
    const payment = await prisma.payment.create({
      data: {
        invoiceId: submission.invoiceId,
        amount: submission.amount,
        currency: submission.currency,
        paymentDate: submission.paymentDate,
        paymentMethod: submission.paymentMethod,
        reference: submission.transactionRef,
        notes: data.notes
      }
    });

    // Link the payment to submission
    await prisma.clientPaymentSubmission.update({
      where: { id: data.submissionId },
      data: {
        linkedPaymentId: payment.id
      }
    });

    // Update invoice payment status
    const updatedAmountPaid = submission.invoice.amountPaid.add(submission.amount);
    const updatedBalanceDue = submission.invoice.totalAmount.sub(updatedAmountPaid);
    const newPaymentStatus = updatedBalanceDue.lte(0) ? 'PAID' : 
                            updatedAmountPaid.gt(0) ? 'PARTIALLY_PAID' : 'UNPAID';

    await prisma.invoice.update({
      where: { id: submission.invoiceId },
      data: {
        amountPaid: updatedAmountPaid,
        balanceDue: updatedBalanceDue,
        paymentStatus: newPaymentStatus
      }
    });

    // Create verification notification
    await this.createPaymentNotification({
      clientId: submission.clientId,
      invoiceId: submission.invoiceId,
      type: 'PAYMENT_VERIFIED',
      amount: submission.amount.toNumber(),
      currency: submission.currency
    });

    return submission;
  }

  /**
   * Validate receipt URL format
   */
  private isValidReceiptUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Calculate auto-matching confidence score
   */
  private calculateMatchConfidence(data: PaymentSubmissionData, invoice: any): number {
    let confidence = 0;

    // Exact amount match gets high confidence
    if (Math.abs(data.amount - invoice.totalAmount.toNumber()) < 0.01) {
      confidence += 0.6;
    } else if (Math.abs(data.amount - invoice.balanceDue.toNumber()) < 0.01) {
      confidence += 0.5;
    } else {
      confidence += 0.2; // Partial payment
    }

    // Currency match
    if (data.currency === invoice.currency) {
      confidence += 0.2;
    }

    // Payment within reasonable timeframe (within 30 days of invoice date)
    const daysDiff = Math.abs(data.paymentDate.getTime() - invoice.invoiceDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 30) {
      confidence += 0.2;
    } else if (daysDiff <= 60) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Create payment notification
   */
  private async createPaymentNotification({
    clientId,
    invoiceId,
    type,
    amount,
    currency
  }: {
    clientId: string;
    invoiceId: string;
    type: string;
    amount: number;
    currency: string;
  }) {
    const titles = {
      'PAYMENT_SUBMITTED': 'Payment Submitted',
      'PAYMENT_VERIFIED': 'Payment Verified'
    };

    const messages = {
      'PAYMENT_SUBMITTED': `Your payment of ${currency === 'USD' ? '$' : currency}${amount.toLocaleString()} has been submitted for verification.`,
      'PAYMENT_VERIFIED': `Your payment of ${currency === 'USD' ? '$' : currency}${amount.toLocaleString()} has been verified and processed.`
    };

    await prisma.clientPortalNotification.create({
      data: {
        clientId,
        invoiceId,
        type,
        title: titles[type as keyof typeof titles] || 'Payment Update',
        message: messages[type as keyof typeof messages] || 'Payment status updated',
        channels: ['EMAIL', 'IN_APP'],
        priority: type === 'PAYMENT_VERIFIED' ? 'HIGH' : 'NORMAL'
      }
    });
  }
}