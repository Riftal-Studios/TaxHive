/**
 * Client Portal Dashboard System
 * 
 * Handles invoice listing, filtering, details, and dashboard metrics
 * for the client portal. Implements proper data isolation and 
 * permission-based access controls.
 */

import { prisma } from '@/lib/prisma';

interface InvoiceListRequest {
  clientId: string;
  page: number;
  limit: number;
  status?: string;
  paymentStatus?: string;
  startDate?: Date;
  endDate?: Date;
}

interface InvoiceListResponse {
  invoices: ClientInvoice[];
  total: number;
  totalPages: number;
}

interface ClientInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  balanceDue: number;
}

interface InvoiceDetailsRequest {
  invoiceId: string;
  clientId: string;
}

interface InvoiceDetails {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  balanceDue: number;
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoicePayment {
  id: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  reference: string;
}

interface DashboardMetricsRequest {
  clientId: string;
}

interface DashboardMetrics {
  totalInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  totalOutstanding: number;
  recentActivity: RecentActivity[];
}

interface RecentActivity {
  type: 'INVOICE_SENT' | 'PAYMENT_RECEIVED' | 'INVOICE_OVERDUE';
  description: string;
  date: Date;
  amount?: number;
}

export class ClientPortalDashboard {
  /**
   * Get paginated list of invoices for a client
   */
  async getClientInvoices(request: InvoiceListRequest): Promise<InvoiceListResponse> {
    const { clientId, page, limit, status, paymentStatus, startDate, endDate } = request;

    // Check permissions
    await this.checkInvoiceViewPermission(clientId);

    // Build filter conditions
    const where: any = {
      clientId,
    };

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) {
        where.invoiceDate.gte = startDate;
      }
      if (endDate) {
        where.invoiceDate.lte = endDate;
      }
    }

    // Get total count
    const total = await prisma.invoice.count({ where });

    // Get paginated invoices
    const skip = (page - 1) * limit;
    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        currency: true,
        status: true,
        paymentStatus: true,
        balanceDue: true,
      },
      orderBy: { invoiceDate: 'desc' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      invoices: invoices.map(invoice => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        balanceDue: Number(invoice.balanceDue),
      })),
      total,
      totalPages,
    };
  }

  /**
   * Get detailed information for a specific invoice
   */
  async getInvoiceDetails(request: InvoiceDetailsRequest): Promise<InvoiceDetails> {
    const { invoiceId, clientId } = request;

    // Check permissions
    await this.checkInvoiceViewPermission(clientId);

    // Get invoice with related data
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId,
      },
      include: {
        lineItems: {
          select: {
            description: true,
            quantity: true,
            rate: true,
            amount: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            paymentMethod: true,
            reference: true,
          },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found or access denied');
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      totalAmount: Number(invoice.totalAmount),
      currency: invoice.currency,
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
      balanceDue: Number(invoice.balanceDue),
      lineItems: invoice.lineItems.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        amount: Number(item.amount),
      })),
      payments: invoice.payments.map(payment => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        reference: payment.reference,
      })),
    };
  }

  /**
   * Calculate dashboard metrics for a client
   */
  async getDashboardMetrics(request: DashboardMetricsRequest): Promise<DashboardMetrics> {
    const { clientId } = request;

    // Check permissions
    await this.checkInvoiceViewPermission(clientId);

    // Get invoice counts and totals
    const [
      totalInvoices,
      unpaidInvoices,
      overdueInvoices,
      totalOutstanding,
    ] = await Promise.all([
      prisma.invoice.count({
        where: { clientId },
      }),
      prisma.invoice.count({
        where: {
          clientId,
          paymentStatus: 'UNPAID',
        },
      }),
      prisma.invoice.count({
        where: {
          clientId,
          paymentStatus: 'UNPAID',
          dueDate: { lt: new Date() },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          clientId,
          paymentStatus: 'UNPAID',
        },
        _sum: {
          balanceDue: true,
        },
      }),
    ]);

    // Get recent activity
    const recentActivity = await this.getRecentActivity(clientId);

    return {
      totalInvoices,
      unpaidInvoices,
      overdueInvoices,
      totalOutstanding: Number(totalOutstanding._sum.balanceDue || 0),
      recentActivity,
    };
  }

  /**
   * Get recent activity for dashboard
   */
  private async getRecentActivity(clientId: string): Promise<RecentActivity[]> {
    const activities: RecentActivity[] = [];

    // Get recent invoices
    const recentInvoices = await prisma.invoice.findMany({
      where: {
        clientId,
        status: { in: ['SENT', 'DRAFT'] },
      },
      select: {
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
        paymentStatus: true,
        dueDate: true,
      },
      orderBy: { invoiceDate: 'desc' },
      take: 5,
    });

    // Add invoice activities
    for (const invoice of recentInvoices) {
      // Check if invoice is overdue
      if (invoice.paymentStatus === 'UNPAID' && invoice.dueDate < new Date()) {
        activities.push({
          type: 'INVOICE_OVERDUE',
          description: `Invoice ${invoice.invoiceNumber} is overdue`,
          date: invoice.dueDate,
          amount: Number(invoice.totalAmount),
        });
      } else {
        activities.push({
          type: 'INVOICE_SENT',
          description: `Invoice ${invoice.invoiceNumber} was sent`,
          date: invoice.invoiceDate,
          amount: Number(invoice.totalAmount),
        });
      }
    }

    // Get recent payments
    const recentPayments = await prisma.payment.findMany({
      where: {
        invoice: { clientId },
      },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
      take: 5,
    });

    // Add payment activities
    for (const payment of recentPayments) {
      activities.push({
        type: 'PAYMENT_RECEIVED',
        description: `Payment received for invoice ${payment.invoice.invoiceNumber}`,
        date: payment.paymentDate,
        amount: Number(payment.amount),
      });
    }

    // Sort by date and return latest activities
    return activities
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
  }

  /**
   * Check if client has permission to view invoices
   */
  private async checkInvoiceViewPermission(clientId: string): Promise<void> {
    const portalAccess = await prisma.clientPortalAccess.findUnique({
      where: { clientId },
      select: {
        canViewInvoices: true,
        isEnabled: true,
        isActive: true,
      },
    });

    if (!portalAccess || !portalAccess.isEnabled || !portalAccess.isActive) {
      throw new Error('Portal access is disabled');
    }

    if (!portalAccess.canViewInvoices) {
      throw new Error('Permission denied: Cannot view invoices');
    }
  }
}