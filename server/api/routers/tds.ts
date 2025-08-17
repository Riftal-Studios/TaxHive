import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { Decimal } from '@prisma/client/runtime/library'
import { 
  calculateTDS, 
  generateCertificateNumber,
  generateChallanNumber
} from '@/lib/tds/calculations'
import { 
  TDS_SECTIONS as TDS_CONSTANTS,
  getCurrentFinancialYear,
  getCurrentQuarter,
  getDepositDueDate,
  validatePAN,
  validateTAN
} from '@/lib/tds/constants'
import { addDays, startOfMonth, endOfMonth } from 'date-fns'

export const tdsRouter = createTRPCRouter({
  // Get TDS configuration for user
  getConfiguration: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.tDSConfiguration.findUnique({
      where: { userId: ctx.session.user.id },
    })
  }),

  // Create or update TDS configuration
  saveConfiguration: protectedProcedure
    .input(z.object({
      tanNumber: z.string().length(10),
      deductorName: z.string().min(1),
      deductorPAN: z.string().length(10),
      deductorType: z.enum(['COMPANY', 'INDIVIDUAL', 'HUF', 'FIRM', 'TRUST']),
      responsiblePerson: z.string().min(1),
      designation: z.string().min(1),
      address: z.string().min(1),
      city: z.string().min(1),
      stateCode: z.string().length(2),
      pincode: z.string().length(6),
      email: z.string().email(),
      phone: z.string().min(10),
      autoDeduct: z.boolean().optional(),
      emailCertificates: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate TAN
      if (!validateTAN(input.tanNumber)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid TAN format',
        })
      }

      // Validate PAN
      if (!validatePAN(input.deductorPAN)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid PAN format',
        })
      }

      const existing = await ctx.db.tDSConfiguration.findUnique({
        where: { userId: ctx.session.user.id },
      })

      if (existing) {
        return ctx.db.tDSConfiguration.update({
          where: { id: existing.id },
          data: input,
        })
      } else {
        return ctx.db.tDSConfiguration.create({
          data: {
            ...input,
            userId: ctx.session.user.id,
          },
        })
      }
    }),

  // Get all TDS sections
  getSections: protectedProcedure.query(async ({ ctx }) => {
    const sections = await ctx.db.tDSSection.findMany({
      where: { isActive: true },
      orderBy: { sectionCode: 'asc' },
    })

    // If no sections in DB, return constants
    if (sections.length === 0) {
      return Object.entries(TDS_CONSTANTS).map(([code, section]) => ({
        id: code,
        sectionCode: code,
        description: section.description,
        individualRate: new Decimal(section.individualRate),
        companyRate: new Decimal(section.companyRate),
        hufRate: section.hufRate ? new Decimal(section.hufRate) : null,
        thresholdLimit: new Decimal(section.thresholdLimit),
        singleLimit: section.aggregateLimit ? new Decimal(section.aggregateLimit) : null,
        applicableFor: section.applicableFor,
        natureOfPayment: section.natureOfPayment,
        surchargeRate: new Decimal(0),
        eduCessRate: new Decimal(4),
        isActive: true,
        effectiveFrom: new Date(),
        effectiveTo: null,
      }))
    }

    return sections
  }),

  // Calculate TDS for a purchase invoice
  calculateTDS: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      sectionCode: z.string(),
      vendorId: z.string(),
      previousPayments: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.db.vendor.findUnique({
        where: { id: input.vendorId },
      })

      if (!vendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found',
        })
      }

      // Get previous payments in current FY
      const currentFY = getCurrentFinancialYear()
      const previousPayments = input.previousPayments || 0

      const result = calculateTDS({
        amount: input.amount,
        sectionCode: input.sectionCode as keyof typeof TDS_CONSTANTS,
        vendorType: vendor.vendorType as 'INDIVIDUAL' | 'COMPANY' | 'HUF' | 'FIRM' | 'TRUST',
        hasLowerCertificate: vendor.lowerTDSRate !== null,
        lowerRate: vendor.lowerTDSRate?.toNumber(),
        previousPayments,
      })

      return result
    }),

  // Create TDS deduction record
  createDeduction: protectedProcedure
    .input(z.object({
      purchaseInvoiceId: z.string().optional(),
      vendorId: z.string(),
      sectionCode: z.string(),
      taxableAmount: z.number(),
      tdsRate: z.number(),
      tdsAmount: z.number(),
      surcharge: z.number().optional(),
      eduCess: z.number().optional(),
      totalTDS: z.number(),
      deductionDate: z.date(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.db.vendor.findUnique({
        where: { id: input.vendorId },
      })

      if (!vendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found',
        })
      }

      if (!vendor.pan) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Vendor PAN is required for TDS deduction',
        })
      }

      // Get or create TDS section
      let section = await ctx.db.tDSSection.findUnique({
        where: { sectionCode: input.sectionCode },
      })

      if (!section) {
        const sectionData = TDS_CONSTANTS[input.sectionCode as keyof typeof TDS_CONSTANTS]
        if (!sectionData) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid TDS section code',
          })
        }

        section = await ctx.db.tDSSection.create({
          data: {
            sectionCode: input.sectionCode,
            description: sectionData.description,
            individualRate: sectionData.individualRate,
            companyRate: sectionData.companyRate,
            hufRate: sectionData.hufRate || sectionData.individualRate,
            thresholdLimit: sectionData.thresholdLimit,
            singleLimit: sectionData.aggregateLimit,
            applicableFor: sectionData.applicableFor,
            natureOfPayment: sectionData.natureOfPayment,
            effectiveFrom: new Date(),
          },
        })
      }

      const financialYear = getCurrentFinancialYear()
      const quarter = getCurrentQuarter()
      const depositDueDate = getDepositDueDate(input.deductionDate)

      const deduction = await ctx.db.tDSDeduction.create({
        data: {
          userId: ctx.session.user.id,
          purchaseInvoiceId: input.purchaseInvoiceId,
          vendorId: input.vendorId,
          sectionId: section.id,
          taxableAmount: input.taxableAmount,
          tdsRate: input.tdsRate,
          tdsAmount: input.tdsAmount,
          surcharge: input.surcharge || 0,
          eduCess: input.eduCess || 0,
          totalTDS: input.totalTDS,
          vendorName: vendor.name,
          vendorPAN: vendor.pan,
          vendorType: vendor.vendorType,
          deductionDate: input.deductionDate,
          financialYear,
          quarter,
          depositDueDate,
          notes: input.notes,
        },
      })

      // Update purchase invoice if linked
      if (input.purchaseInvoiceId) {
        await ctx.db.purchaseInvoice.update({
          where: { id: input.purchaseInvoiceId },
          data: {
            tdsApplicable: true,
            tdsSection: input.sectionCode,
            tdsRate: input.tdsRate,
            tdsAmount: input.totalTDS,
            netPayableAmount: input.taxableAmount - input.totalTDS,
          },
        })
      }

      return deduction
    }),

  // Get TDS deductions
  getDeductions: protectedProcedure
    .input(z.object({
      financialYear: z.string().optional(),
      quarter: z.string().optional(),
      vendorId: z.string().optional(),
      depositStatus: z.enum(['PENDING', 'DEPOSITED', 'LATE']).optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        userId: ctx.session.user.id,
      }

      if (input.financialYear) {
        where.financialYear = input.financialYear
      }
      if (input.quarter) {
        where.quarter = input.quarter
      }
      if (input.vendorId) {
        where.vendorId = input.vendorId
      }
      if (input.depositStatus) {
        where.depositStatus = input.depositStatus
      }

      const [deductions, total] = await Promise.all([
        ctx.db.tDSDeduction.findMany({
          where,
          include: {
            vendor: true,
            section: true,
            purchaseInvoice: true,
            certificate: true,
            tdsPayment: true,
          },
          orderBy: { deductionDate: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.tDSDeduction.count({ where }),
      ])

      return { deductions, total }
    }),

  // Create TDS payment/challan
  createPayment: protectedProcedure
    .input(z.object({
      deductionIds: z.array(z.string()),
      challanDate: z.date(),
      bsrCode: z.string().length(7),
      bankName: z.string(),
      paymentMode: z.enum(['ONLINE', 'OFFLINE', 'NEFT', 'RTGS']),
      paymentReference: z.string().optional(),
      interest: z.number().optional(),
      penalty: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get deductions to be paid
      const deductions = await ctx.db.tDSDeduction.findMany({
        where: {
          id: { in: input.deductionIds },
          userId: ctx.session.user.id,
          depositStatus: 'PENDING',
        },
      })

      if (deductions.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No pending deductions found',
        })
      }

      // Calculate totals
      const tdsAmount = deductions.reduce((sum, d) => sum + d.tdsAmount.toNumber(), 0)
      const surcharge = deductions.reduce((sum, d) => sum + d.surcharge.toNumber(), 0)
      const eduCess = deductions.reduce((sum, d) => sum + d.eduCess.toNumber(), 0)
      const totalAmount = tdsAmount + surcharge + eduCess + (input.interest || 0) + (input.penalty || 0)

      // Generate challan number
      const challanCount = await ctx.db.tDSPayment.count({
        where: { bsrCode: input.bsrCode },
      })
      const challanNumber = generateChallanNumber(
        input.bsrCode,
        input.challanDate,
        challanCount + 1
      )

      // Get common details from first deduction
      const firstDeduction = deductions[0]
      const financialYear = firstDeduction.financialYear
      const quarter = firstDeduction.quarter

      // Create payment record
      const payment = await ctx.db.tDSPayment.create({
        data: {
          userId: ctx.session.user.id,
          challanNumber,
          challanDate: input.challanDate,
          bsrCode: input.bsrCode,
          bankName: input.bankName,
          financialYear,
          quarter,
          assessmentYear: financialYear.replace('FY', 'AY'),
          section: deductions.length === 1 ? deductions[0].sectionId : 'MULTIPLE',
          tdsAmount,
          surcharge,
          eduCess,
          interest: input.interest || 0,
          penalty: input.penalty || 0,
          totalAmount,
          deductionIds: input.deductionIds,
          deductionCount: deductions.length,
          paymentMode: input.paymentMode,
          paymentReference: input.paymentReference,
        },
      })

      // Update deduction status
      await ctx.db.tDSDeduction.updateMany({
        where: { id: { in: input.deductionIds } },
        data: {
          depositStatus: 'DEPOSITED',
          tdsPaymentId: payment.id,
        },
      })

      return payment
    }),

  // Generate Form 16A certificate
  generateCertificate: protectedProcedure
    .input(z.object({
      vendorId: z.string(),
      financialYear: z.string(),
      quarter: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.db.vendor.findUnique({
        where: { id: input.vendorId },
      })

      if (!vendor || !vendor.pan) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Valid vendor with PAN required',
        })
      }

      // Get deductions for the period
      const deductions = await ctx.db.tDSDeduction.findMany({
        where: {
          userId: ctx.session.user.id,
          vendorId: input.vendorId,
          financialYear: input.financialYear,
          quarter: input.quarter,
          depositStatus: 'DEPOSITED',
          certificateIssued: false,
        },
        include: {
          section: true,
          tdsPayment: true,
        },
      })

      if (deductions.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No deposited deductions found for certificate generation',
        })
      }

      // Calculate totals
      const totalTDS = deductions.reduce((sum, d) => sum + d.totalTDS.toNumber(), 0)
      const totalPaid = deductions.reduce((sum, d) => sum + d.taxableAmount.toNumber(), 0)

      // Generate certificate number
      const config = await ctx.db.tDSConfiguration.findUnique({
        where: { userId: ctx.session.user.id },
      })

      if (!config) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'TDS configuration not found',
        })
      }

      const certificateCount = await ctx.db.tDSCertificate.count({
        where: {
          userId: ctx.session.user.id,
          financialYear: input.financialYear,
          quarter: input.quarter,
        },
      })

      const certificateNumber = generateCertificateNumber(
        config.tanNumber,
        input.financialYear,
        input.quarter,
        certificateCount + 1
      )

      // Create certificate
      const certificate = await ctx.db.tDSCertificate.create({
        data: {
          userId: ctx.session.user.id,
          certificateNumber,
          form: '16A',
          financialYear: input.financialYear,
          quarter: input.quarter,
          vendorId: input.vendorId,
          vendorName: vendor.name,
          vendorPAN: vendor.pan!,
          vendorAddress: vendor.address,
          totalTDS,
          totalPaid,
          deductionDetails: deductions,
          generatedDate: new Date(),
          status: 'DRAFT',
        },
      })

      // Mark deductions as certificate issued
      await ctx.db.tDSDeduction.updateMany({
        where: {
          id: { in: deductions.map(d => d.id) },
        },
        data: {
          certificateIssued: true,
          certificateId: certificate.id,
        },
      })

      return certificate
    }),

  // Get TDS returns
  getReturns: protectedProcedure
    .input(z.object({
      financialYear: z.string().optional(),
      returnType: z.enum(['24Q', '26Q', '27Q']).optional(),
      filingStatus: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        userId: ctx.session.user.id,
      }

      if (input.financialYear) {
        where.financialYear = input.financialYear
      }
      if (input.returnType) {
        where.returnType = input.returnType
      }
      if (input.filingStatus) {
        where.filingStatus = input.filingStatus
      }

      return ctx.db.tDSReturn.findMany({
        where,
        orderBy: [
          { financialYear: 'desc' },
          { quarter: 'desc' },
        ],
      })
    }),

  // Prepare quarterly return
  prepareReturn: protectedProcedure
    .input(z.object({
      financialYear: z.string(),
      quarter: z.string(),
      returnType: z.enum(['24Q', '26Q', '27Q']),
    }))
    .mutation(async ({ ctx, input }) => {
      const config = await ctx.db.tDSConfiguration.findUnique({
        where: { userId: ctx.session.user.id },
      })

      if (!config) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'TDS configuration required',
        })
      }

      // Check if return already exists
      const existing = await ctx.db.tDSReturn.findUnique({
        where: {
          userId_returnType_financialYear_quarter: {
            userId: ctx.session.user.id,
            returnType: input.returnType,
            financialYear: input.financialYear,
            quarter: input.quarter,
          },
        },
      })

      if (existing && existing.filingStatus !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Return already prepared',
        })
      }

      // Get deductions for the period
      const deductions = await ctx.db.tDSDeduction.findMany({
        where: {
          userId: ctx.session.user.id,
          financialYear: input.financialYear,
          quarter: input.quarter,
          depositStatus: 'DEPOSITED',
        },
        include: {
          section: true,
          tdsPayment: true,
          vendor: true,
        },
      })

      // Get payments for the period
      const payments = await ctx.db.tDSPayment.findMany({
        where: {
          userId: ctx.session.user.id,
          financialYear: input.financialYear,
          quarter: input.quarter,
        },
      })

      // Get certificates issued
      const certificates = await ctx.db.tDSCertificate.findMany({
        where: {
          userId: ctx.session.user.id,
          financialYear: input.financialYear,
          quarter: input.quarter,
          status: 'ISSUED',
        },
      })

      // Calculate summaries
      const totalTDS = deductions.reduce((sum, d) => sum + d.totalTDS.toNumber(), 0)
      const totalDeposited = payments.reduce((sum, p) => sum + p.totalAmount.toNumber(), 0)

      // Section-wise summary
      const sectionWiseSummary: Record<string, { count: number; totalTDS: number; totalPaid: number }> = {}
      for (const deduction of deductions) {
        const sectionCode = deduction.section.sectionCode
        if (!sectionWiseSummary[sectionCode]) {
          sectionWiseSummary[sectionCode] = {
            count: 0,
            totalTDS: 0,
            totalPaid: 0,
          }
        }
        sectionWiseSummary[sectionCode].count++
        sectionWiseSummary[sectionCode].totalTDS += deduction.totalTDS.toNumber()
        sectionWiseSummary[sectionCode].totalPaid += deduction.taxableAmount.toNumber()
      }

      // Challan details
      const challanDetails = payments.map(p => ({
        challanNumber: p.challanNumber,
        challanDate: p.challanDate,
        amount: p.totalAmount.toNumber(),
        bsrCode: p.bsrCode,
        bankName: p.bankName,
      }))

      const returnData = {
        userId: ctx.session.user.id,
        returnType: input.returnType,
        financialYear: input.financialYear,
        quarter: input.quarter,
        formType: 'ORIGINAL',
        tanNumber: config.tanNumber,
        assessmentYear: input.financialYear.replace('FY', 'AY'),
        totalDeductions: deductions.length,
        totalTDS,
        totalDeposited,
        totalCertificates: certificates.length,
        sectionWiseSummary,
        challanCount: payments.length,
        challanDetails,
        filingStatus: 'DRAFT',
      }

      if (existing) {
        return ctx.db.tDSReturn.update({
          where: { id: existing.id },
          data: returnData,
        })
      } else {
        return ctx.db.tDSReturn.create({
          data: returnData,
        })
      }
    }),
})