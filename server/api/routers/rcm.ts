import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import {
  generateSelfInvoiceNumber,
  checkSelfInvoiceDueDate,
  validateSelfInvoiceGeneration,
  generateSelfInvoiceFromRCMTransaction,
  bulkGenerateSelfInvoices,
  getSelfInvoiceComplianceStatus,
  prepareSelfInvoiceForGSTR1,
  calculateSelfInvoicePenalty,
} from '@/lib/rcm/rcm-self-invoice'
import { detectRCM } from '@/lib/rcm/rcm-detector'
import { NOTIFIED_SERVICES_REGISTRY as NOTIFIED_RCM_SERVICES, NOTIFIED_GOODS_REGISTRY as NOTIFIED_RCM_GOODS } from '@/lib/rcm/notified-list-registry'
import { 
  calculateRCMPaymentDue,
  createRCMPaymentLiability,
  trackRCMPayment,
  getRCMPaymentSummary,
  getPendingRCMPayments,
  calculateInterestAndPenalty,
  exportRCMPaymentReport,
} from '@/lib/rcm/rcm-payment-service'
import {
  prepareGSTR3BData,
  getComplianceScore,
  generateComplianceAlerts,
  getComplianceDashboard,
} from '@/lib/rcm/compliance-service'

export const rcmRouter = createTRPCRouter({
  // Dashboard Endpoints
  getDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id
      
      // Get compliance score
      const complianceScore = await getComplianceScore(userId, new Date())
      
      // Get pending payments
      const pendingPayments = await getPendingRCMPayments(userId)
      
      // Get total liability for current month
      const currentMonth = new Date()
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      
      const liabilities = await ctx.prisma.rCMPaymentLiability.findMany({
        where: {
          userId,
          dueDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      })
      
      const totalLiability = liabilities.reduce((sum, l) => sum + Number(l.totalGST), 0)
      
      // Get ITC available
      const itcEligible = liabilities
        .filter(l => l.itcEligible && !l.itcClaimed)
        .reduce((sum, l) => sum + Number(l.totalGST), 0)
      
      // Get recent transactions
      const recentTransactions = await ctx.prisma.rCMTransaction.findMany({
        where: { userId },
        orderBy: { invoiceDate: 'desc' },
        take: 5,
        include: {
          selfInvoice: true,
        },
      })
      
      // Get upcoming due dates
      const upcomingDueDates = await ctx.prisma.rCMPaymentLiability.findMany({
        where: {
          userId,
          status: 'PENDING',
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      })
      
      // Get self-invoice compliance
      const selfInvoiceStatus = await getSelfInvoiceComplianceStatus(
        await ctx.prisma.rCMSelfInvoice.findMany({ where: { userId } }),
        await ctx.prisma.rCMTransaction.count({
          where: {
            userId,
            selfInvoiceStatus: 'PENDING',
            selfInvoiceDueDate: {
              lte: new Date(),
            },
          },
        })
      )
      
      return {
        complianceScore,
        pendingPayments: pendingPayments.length,
        nextDueDate: upcomingDueDates[0]?.dueDate,
        totalLiability,
        itcAvailable: itcEligible,
        recentTransactions,
        upcomingDueDates,
        selfInvoiceStatus,
      }
    }),

  // RCM Transaction Management
  createTransaction: protectedProcedure
    .input(z.object({
      vendorName: z.string(),
      vendorGSTIN: z.string().optional(),
      vendorCountry: z.string().optional(),
      invoiceNumber: z.string().optional(),
      invoiceDate: z.date(),
      description: z.string(),
      hsnSacCode: z.string(),
      taxableAmount: z.number(),
      gstRate: z.number(),
      cessRate: z.number().optional(),
      cessAmount: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      // Identify RCM applicability
      const rcmStatus = detectRCM({
        vendorGSTIN: input.vendorGSTIN || null,
        vendorName: input.vendorName,
        vendorCountry: input.vendorCountry || 'India',
        placeOfSupply: input.vendorCountry === 'Foreign' ? 'Outside India' : 'India',
        recipientGSTIN: null,
        recipientState: '',
        serviceType: 'SERVICE',
        hsnSacCode: input.hsnSacCode,
        taxableAmount: input.taxableAmount,
      })
      
      if (!rcmStatus.isRCMApplicable) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'RCM is not applicable for this transaction',
        })
      }
      
      // Create RCM transaction
      const transaction = await ctx.prisma.rCMTransaction.create({
        data: {
          ...input,
          userId,
          vendorName: input.vendorName,
          vendorGSTIN: input.vendorGSTIN,
          vendorCountry: input.vendorCountry,
          invoiceNumber: input.invoiceNumber || '',
          invoiceDate: input.invoiceDate,
          description: input.description,
          hsnSacCode: input.hsnSacCode,
          taxableAmount: input.taxableAmount,
          cgstAmount: rcmStatus.taxType === 'CGST_SGST' ? (input.taxableAmount * input.gstRate) / 200 : null,
          sgstAmount: rcmStatus.taxType === 'CGST_SGST' ? (input.taxableAmount * input.gstRate) / 200 : null,
          igstAmount: rcmStatus.taxType === 'IGST' ? (input.taxableAmount * input.gstRate) / 100 : null,
          cessAmount: input.cessAmount,
          totalTaxAmount: (input.taxableAmount * input.gstRate) / 100 + (input.cessAmount || 0),
          transactionType: rcmStatus.rcmType || 'UNREGISTERED',
          paymentDueDate: new Date(input.invoiceDate.getTime() + 50 * 24 * 60 * 60 * 1000), // 20th of next month
          returnPeriod: `${(input.invoiceDate.getMonth() + 1).toString().padStart(2, '0')}-${input.invoiceDate.getFullYear()}`,
          selfInvoiceStatus: 'PENDING',
          selfInvoiceDueDate: new Date(input.invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      })
      
      // Create payment liability
      const liability = await createRCMPaymentLiability({
        transactionId: transaction.id,
        vendorName: transaction.vendorName,
        vendorCountry: transaction.vendorCountry || undefined,
        taxableAmount: Number(transaction.taxableAmount),
        gstRate: input.gstRate,
        taxType: rcmStatus.taxType || 'IGST',
        rcmType: transaction.transactionType,
        transactionDate: transaction.invoiceDate,
        hsnSacCode: transaction.hsnSacCode,
        itcEligible: true,
        userId,
      })
      
      return { transaction, liability }
    }),

  // Self-Invoice Management
  generateSelfInvoice: protectedProcedure
    .input(z.object({
      transactionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      // Get RCM transaction
      const transaction = await ctx.prisma.rCMTransaction.findUnique({
        where: { id: input.transactionId },
      })
      
      if (!transaction || transaction.userId !== userId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        })
      }
      
      // Check if self-invoice already exists
      const existingSelfInvoice = await ctx.prisma.rCMSelfInvoice.findUnique({
        where: { rcmTransactionId: transaction.id },
      })
      
      if (existingSelfInvoice) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Self-invoice already generated',
        })
      }
      
      // Validate self-invoice generation
      const validation = validateSelfInvoiceGeneration(transaction)
      if (!validation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validation.errors.join(', '),
        })
      }
      
      // Get user details
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
      })
      
      // Get next invoice number
      const lastInvoice = await ctx.prisma.rCMSelfInvoice.findFirst({
        where: { userId },
        orderBy: { invoiceNumber: 'desc' },
      })
      
      const fiscalYear = getCurrentFiscalYear()
      const sequence = lastInvoice 
        ? parseInt(lastInvoice.invoiceNumber.split('/')[1]) + 1
        : 1
      
      const invoiceNumber = generateSelfInvoiceNumber(fiscalYear, sequence)
      
      // Check 30-day compliance
      const dueDateStatus = transaction.selfInvoiceDueDate
        ? checkSelfInvoiceDueDate(new Date(transaction.invoiceDate))
        : { isWithinTime: true, daysDelayed: 0 }
      
      // Create self-invoice
      const selfInvoice = await ctx.prisma.rCMSelfInvoice.create({
        data: {
          invoiceNumber,
          invoiceDate: new Date(),
          userId,
          rcmTransactionId: transaction.id,
          supplierName: transaction.vendorName || '',
          supplierAddress: '',
          supplierState: '',
          supplierStateCode: '',
          supplierGSTIN: transaction.vendorGSTIN,
          recipientGSTIN: user?.gstin || '',
          recipientName: user?.name || '',
          recipientAddress: '',
          recipientState: '',
          recipientStateCode: '',
          placeOfSupply: 'India',
          supplyType: 'SERVICES',
          rcmType: transaction.transactionType || 'UNREGISTERED',
          originalInvoiceNo: transaction.invoiceNumber,
          originalInvoiceDate: transaction.invoiceDate,
          goodsReceiptDate: new Date(transaction.invoiceDate),
          serviceReceiptDate: null,
          taxableAmount: Number(transaction.taxableAmount),
          totalTaxAmount: Number(transaction.totalTaxAmount) || 0,
          totalAmount: Number(transaction.taxableAmount) + Number(transaction.totalTaxAmount),
          issuedWithinTime: dueDateStatus.isWithinTime,
          daysDelayed: dueDateStatus.daysDelayed,
          status: 'ISSUED',
        },
      })
      
      // Update transaction with self-invoice reference
      await ctx.prisma.rCMTransaction.update({
        where: { id: transaction.id },
        data: {
          selfInvoice: {
            connect: { id: selfInvoice.id }
          },
          selfInvoiceStatus: 'GENERATED',
        },
      })
      
      // Calculate penalty if delayed
      if (!dueDateStatus.isWithinTime) {
        const penalty = calculateSelfInvoicePenalty(selfInvoice)
        // Create compliance alert
        await ctx.prisma.complianceAlert.create({
          data: {
            type: 'SELF_INVOICE_DELAYED',
            priority: 'HIGH',
            message: `Self-invoice ${invoiceNumber} issued ${penalty.daysDelayed} days late. Penalty: ₹${penalty.totalPenalty}`,
            relatedEntityId: selfInvoice.id,
            relatedEntityType: 'SELF_INVOICE',
            userId,
          },
        })
      }
      
      return selfInvoice
    }),

  bulkGenerateSelfInvoices: protectedProcedure
    .input(z.object({
      transactionIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      // Get transactions
      const transactions = await ctx.prisma.rCMTransaction.findMany({
        where: {
          id: { in: input.transactionIds },
          userId,
          selfInvoice: null,
        },
      })
      
      // Get user details
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
      })
      
      // Get next sequence number
      const lastInvoice = await ctx.prisma.rCMSelfInvoice.findFirst({
        where: { userId },
        orderBy: { invoiceNumber: 'desc' },
      })
      
      const fiscalYear = getCurrentFiscalYear()
      const startSequence = lastInvoice 
        ? parseInt(lastInvoice.invoiceNumber.split('/')[1]) + 1
        : 1
      
      // Bulk generate
      const result = bulkGenerateSelfInvoices(
        transactions,
        {
          gstin: user?.gstin || '',
          legalName: user?.name || '',
          address: '',
          state: '',
          stateCode: '',
        },
        fiscalYear,
        startSequence
      )
      
      // Save generated invoices
      const createdInvoices = await ctx.prisma.$transaction(
        result.generated.map(invoice => 
          ctx.prisma.rCMSelfInvoice.create({
            data: {
              invoiceNumber: invoice.invoiceNumber,
              invoiceDate: invoice.invoiceDate,
              rcmTransactionId: invoice.rcmTransactionId || '',
              supplierName: invoice.supplierName,
              supplierAddress: invoice.supplierAddress || '',
              supplierState: invoice.supplierState || '',
              supplierStateCode: invoice.supplierStateCode || '',
              supplierGSTIN: invoice.supplierGSTIN,
              recipientGSTIN: invoice.recipientGSTIN,
              recipientName: invoice.recipientName,
              recipientAddress: invoice.recipientAddress,
              recipientState: invoice.recipientState,
              recipientStateCode: invoice.recipientStateCode,
              placeOfSupply: invoice.placeOfSupply,
              supplyType: invoice.supplyType,
              rcmType: invoice.rcmType,
              originalInvoiceNo: invoice.originalInvoiceNo,
              originalInvoiceDate: invoice.originalInvoiceDate,
              goodsReceiptDate: invoice.goodsReceiptDate,
              serviceReceiptDate: invoice.serviceReceiptDate,
              taxableAmount: invoice.taxableAmount,
              cgstRate: invoice.cgstRate,
              cgstAmount: invoice.cgstAmount,
              sgstRate: invoice.sgstRate,
              sgstAmount: invoice.sgstAmount,
              igstRate: invoice.igstRate,
              igstAmount: invoice.igstAmount,
              cessRate: invoice.cessRate,
              cessAmount: invoice.cessAmount,
              totalTaxAmount: invoice.totalTaxAmount,
              totalAmount: invoice.totalAmount,
              issuedWithinTime: invoice.issuedWithinTime,
              daysDelayed: invoice.daysDelayed,
              userId,
              status: 'ISSUED',
            },
          })
        )
      )
      
      // Update transactions
      await ctx.prisma.$transaction(
        createdInvoices.map(invoice => 
          ctx.prisma.rCMTransaction.update({
            where: { id: invoice.rcmTransactionId },
            data: {
              selfInvoice: {
                connect: { id: invoice.id }
              },
              selfInvoiceStatus: 'GENERATED',
            },
          })
        )
      )
      
      return {
        generated: createdInvoices.length,
        failed: result.failed.length,
        details: result,
      }
    }),

  // Payment Management
  recordPayment: protectedProcedure
    .input(z.object({
      liabilityId: z.string(),
      amount: z.number(),
      paymentDate: z.date(),
      paymentReference: z.string(),
      paymentMethod: z.string().optional(),
      challanNumber: z.string().optional(),
      includesInterest: z.boolean().optional(),
      interestAmount: z.number().optional(),
      includesPenalty: z.boolean().optional(),
      penaltyAmount: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      // Get liability
      const liability = await ctx.prisma.rCMPaymentLiability.findUnique({
        where: { id: input.liabilityId },
      })
      
      if (!liability || liability.userId !== userId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Liability not found',
        })
      }
      
      // Create payment record
      const payment = await ctx.prisma.rCMPayment.create({
        data: {
          ...input,
          userId,
        },
      })
      
      // Update liability status
      const totalPaid = Number(liability.paidAmount) + input.amount
      const isFullyPaid = totalPaid >= Number(liability.totalGST)
      
      await ctx.prisma.rCMPaymentLiability.update({
        where: { id: input.liabilityId },
        data: {
          paidAmount: totalPaid,
          status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          paidDate: isFullyPaid ? input.paymentDate : undefined,
        },
      })
      
      return payment
    }),

  // Compliance Management
  getComplianceStatus: protectedProcedure
    .input(z.object({
      period: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const period = input.period || getCurrentPeriod()
      
      return getComplianceDashboard({ userId, period })
    }),

  generateGSTR3B: protectedProcedure
    .input(z.object({
      period: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      return prepareGSTR3BData(userId, input.period)
    }),

  // Notified List Management
  getNotifiedServices: protectedProcedure
    .query(async () => {
      return NOTIFIED_RCM_SERVICES
    }),

  getNotifiedGoods: protectedProcedure
    .query(async () => {
      return NOTIFIED_RCM_GOODS
    }),

  // Reports
  getPaymentReport: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      format: z.enum(['json', 'csv', 'pdf']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      return exportRCMPaymentReport({
        userId,
        startDate: input.startDate,
        endDate: input.endDate,
        format: input.format || 'json',
      })
    }),

  getSelfInvoiceReport: protectedProcedure
    .input(z.object({
      period: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      
      const selfInvoices = await ctx.prisma.rCMSelfInvoice.findMany({
        where: {
          userId,
          gstr1Period: input.period,
        },
        include: {
          items: true,
        },
      })
      
      return prepareSelfInvoiceForGSTR1(selfInvoices, input.period)
    }),
})

// Helper functions
function getCurrentFiscalYear(): string {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  
  if (currentMonth >= 4) {
    return `${currentYear}-${(currentYear + 1).toString().slice(2)}`
  } else {
    return `${currentYear - 1}-${currentYear.toString().slice(2)}`
  }
}

function getCurrentPeriod(): string {
  const now = new Date()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const year = now.getFullYear()
  return `${month}${year}`
}