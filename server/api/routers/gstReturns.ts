import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { generateGSTR1, validateGSTR1Data } from '@/lib/gst-returns/gstr1-generator'
import { generateGSTR3B, validateGSTR3BData } from '@/lib/gst-returns/gstr3b-generator'
import { Decimal } from '@prisma/client/runtime/library'

// Helper function to get fiscal year from date
function getFiscalYear(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  
  if (month >= 4) {
    return `FY${year.toString().slice(2)}-${(year + 1).toString().slice(2)}`
  } else {
    return `FY${(year - 1).toString().slice(2)}-${year.toString().slice(2)}`
  }
}

// Helper function to generate GSTR-1 B2B invoices section
function generateB2BInvoices(invoices: any[]): any {
  const b2bData: any[] = []
  
  // Group invoices by client GSTIN
  const groupedByGSTIN = invoices.reduce((acc, invoice) => {
    if (invoice.buyerGSTIN) {
      if (!acc[invoice.buyerGSTIN]) {
        acc[invoice.buyerGSTIN] = []
      }
      acc[invoice.buyerGSTIN].push(invoice)
    }
    return acc
  }, {} as Record<string, any[]>)
  
  // Format for GSTR-1 B2B section
  Object.entries(groupedByGSTIN).forEach(([gstin, clientInvoices]) => {
    const invoiceList = clientInvoices.map(inv => ({
      inum: inv.invoiceNumber,
      idt: format(new Date(inv.invoiceDate), 'dd-MM-yyyy'),
      val: Number(inv.totalInINR),
      pos: inv.placeOfSupply?.substring(0, 2) || '96', // State code
      rchrg: 'N', // Reverse charge
      inv_typ: 'R', // Regular
      items: inv.lineItems.map((item: any) => ({
        num: 1,
        rt: Number(item.gstRate || 0),
        txval: Number(item.amount),
        iamt: Number(item.igstAmount || 0),
        camt: Number(item.cgstAmount || 0),
        samt: Number(item.sgstAmount || 0),
        csamt: 0 // Cess amount
      }))
    }))
    
    b2bData.push({
      ctin: gstin,
      inv: invoiceList
    })
  })
  
  return b2bData
}

// Helper function to generate GSTR-1 Export invoices section
function generateExportInvoices(invoices: any[]): any {
  return invoices.map(inv => ({
    inum: inv.invoiceNumber,
    idt: format(new Date(inv.invoiceDate), 'dd-MM-yyyy'),
    val: Number(inv.totalInINR),
    sbpcode: inv.portCode || '',
    sbnum: inv.shippingBillNo || '',
    sbdt: inv.shippingBillDate ? format(new Date(inv.shippingBillDate), 'dd-MM-yyyy') : '',
    items: inv.lineItems.map((item: any) => ({
      rt: 0, // Zero-rated for exports
      txval: Number(item.amount),
      iamt: 0 // No IGST for exports under LUT
    }))
  }))
}

// Helper function to generate HSN summary
function generateHSNSummary(invoices: any[]): any {
  const hsnMap = new Map<string, any>()
  
  invoices.forEach(inv => {
    inv.lineItems.forEach((item: any) => {
      const hsn = item.serviceCode
      if (!hsnMap.has(hsn)) {
        hsnMap.set(hsn, {
          hsn_sc: hsn,
          desc: item.description.substring(0, 30),
          uqc: item.uqc || 'OTH',
          qty: 0,
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0
        })
      }
      
      const existing = hsnMap.get(hsn)
      existing.qty += Number(item.quantity)
      existing.txval += Number(item.amount)
      existing.iamt += Number(item.igstAmount || 0)
      existing.camt += Number(item.cgstAmount || 0)
      existing.samt += Number(item.sgstAmount || 0)
    })
  })
  
  return Array.from(hsnMap.values())
}

export const gstReturnsRouter = createTRPCRouter({
  // Generate GSTR-1 for a period
  generateGSTR1: protectedProcedure
    .input(z.object({
      period: z.string().regex(/^\d{2}-\d{4}$/, 'Period must be in MM-YYYY format'),
      regenerate: z.boolean().optional().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      const [month, year] = input.period.split('-').map(Number)
      const startDate = startOfMonth(new Date(year, month - 1))
      const endDate = endOfMonth(new Date(year, month - 1))
      const financialYear = getFiscalYear(startDate)
      const userId = ctx.session.user.id
      
      // Get user's GSTIN
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { gstin: true }
      })

      if (!user?.gstin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'GSTIN not configured for user'
        })
      }

      // Check if return already exists
      const existingReturn = await ctx.prisma.gSTReturn.findUnique({
        where: {
          userId_returnType_period: {
            userId,
            returnType: 'GSTR1',
            period: input.period
          }
        }
      })
      
      if (existingReturn && !input.regenerate) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'GSTR-1 already exists for this period. Set regenerate=true to regenerate.'
        })
      }
      
      // Get turnover for HSN code length determination
      const yearStart = new Date(year - 1, 3, 1) // April of previous year
      const yearEnd = new Date(year, 2, 31, 23, 59, 59) // March of current year
      
      const yearInvoices = await ctx.prisma.invoice.findMany({
        where: {
          userId,
          invoiceDate: {
            gte: yearStart,
            lte: yearEnd
          },
          status: { not: 'DRAFT' }
        },
        select: {
          subtotal: true,
          taxableAmount: true
        }
      })
      
      const turnover = yearInvoices.reduce((sum, inv) => 
        sum + (inv.taxableAmount || inv.subtotal).toNumber(), 0)

      // Fetch all invoices for the period
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId,
          invoiceDate: {
            gte: startDate,
            lte: endDate
          },
          status: {
            in: ['SENT', 'PAID', 'PARTIALLY_PAID']
          }
        },
        include: {
          lineItems: true,
          client: true
        }
      })
      
      // Transform invoices to match our generator interface
      const transformedInvoices = invoices.map(inv => ({
        ...inv,
        buyerGSTIN: inv.client.gstin,
        taxableAmount: inv.taxableAmount || inv.subtotal,
        cgstAmount: inv.cgstAmount || new Decimal(0),
        sgstAmount: inv.sgstAmount || new Decimal(0),
        igstAmount: inv.igstAmount || new Decimal(0),
        placeOfSupply: inv.placeOfSupply || inv.client.stateCode || '00',
        lineItems: inv.lineItems.map(item => ({
          ...item,
          serviceCode: item.serviceCode || '998314',
          cgstAmount: item.cgstAmount || new Decimal(0),
          sgstAmount: item.sgstAmount || new Decimal(0),
          igstAmount: item.igstAmount || new Decimal(0),
          cgstRate: item.cgstRate || new Decimal(0),
          sgstRate: item.sgstRate || new Decimal(0),
          igstRate: item.igstRate || new Decimal(0),
          uqc: item.uqc || 'OTH'
        }))
      }))
      
      // Get credit and debit notes for the period
      const creditDebitNotes = await ctx.prisma.creditDebitNote.findMany({
        where: {
          userId,
          noteDate: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          invoice: {
            include: {
              client: true
            }
          },
          lineItems: true
        }
      })
      
      // Separate and transform credit and debit notes
      const creditNotes = creditDebitNotes
        .filter(note => note.noteType === 'CREDIT')
        .map(note => ({
          noteNumber: note.noteNumber,
          noteDate: note.noteDate,
          originalInvoiceNumber: note.invoice.invoiceNumber,
          originalInvoiceDate: note.invoice.invoiceDate,
          clientGSTIN: note.invoice.client.gstin || '',
          clientName: note.invoice.client.businessName,
          reason: note.reason,
          subtotal: note.subtotal.toNumber(),
          cgstAmount: note.cgstAmount.toNumber(),
          sgstAmount: note.sgstAmount.toNumber(),
          igstAmount: note.igstAmount.toNumber(),
          total: note.total.toNumber(),
          lineItems: note.lineItems.map(item => ({
            description: item.description,
            hsnSacCode: item.hsnSacCode,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate.toNumber(),
            amount: item.amount.toNumber()
          }))
        }))
      
      const debitNotes = creditDebitNotes
        .filter(note => note.noteType === 'DEBIT')
        .map(note => ({
          noteNumber: note.noteNumber,
          noteDate: note.noteDate,
          originalInvoiceNumber: note.invoice.invoiceNumber,
          originalInvoiceDate: note.invoice.invoiceDate,
          clientGSTIN: note.invoice.client.gstin || '',
          clientName: note.invoice.client.businessName,
          reason: note.reason,
          subtotal: note.subtotal.toNumber(),
          cgstAmount: note.cgstAmount.toNumber(),
          sgstAmount: note.sgstAmount.toNumber(),
          igstAmount: note.igstAmount.toNumber(),
          total: note.total.toNumber(),
          lineItems: note.lineItems.map(item => ({
            description: item.description,
            hsnSacCode: item.hsnSacCode,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate.toNumber(),
            amount: item.amount.toNumber()
          }))
        }))
      
      // Generate GSTR-1 JSON using our generator
      const gstr1Period = `${month.toString().padStart(2, '0')}${year}`
      const gstr1Json = generateGSTR1(
        transformedInvoices,
        creditNotes,
        debitNotes,
        {
          gstin: user.gstin,
          period: gstr1Period,
          turnover
        }
      )
      
      // Validate the generated data
      const validation = validateGSTR1Data(gstr1Json)
      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `GSTR-1 validation failed: ${validation.errors.join(', ')}`
        })
      }
      
      // Calculate totals from generated GSTR-1
      const totalOutwardTaxable = transformedInvoices
        .filter(inv => inv.invoiceType !== 'EXPORT')
        .reduce((sum, inv) => sum + inv.taxableAmount.toNumber(), 0)
      const totalOutwardZeroRated = transformedInvoices
        .filter(inv => inv.invoiceType === 'EXPORT')
        .reduce((sum, inv) => sum + inv.totalInINR.toNumber(), 0)
      
      // Create or update the GST return
      const gstReturn = await ctx.prisma.gSTReturn.upsert({
        where: {
          userId_returnType_period: {
            userId,
            returnType: 'GSTR1',
            period: input.period
          }
        },
        update: {
          financialYear,
          month,
          b2bInvoices: gstr1Json.b2b?.length > 0 ? gstr1Json.b2b : Prisma.JsonNull,
          exportInvoices: gstr1Json.exp?.length > 0 ? gstr1Json.exp : Prisma.JsonNull,
          b2cLargeInvoices: gstr1Json.b2cl?.length > 0 ? gstr1Json.b2cl : Prisma.JsonNull,
          b2cSmallInvoices: gstr1Json.b2cs?.length > 0 ? gstr1Json.b2cs : Prisma.JsonNull,
          creditNotes: gstr1Json.cdnr?.length > 0 ? gstr1Json.cdnr : Prisma.JsonNull,
          debitNotes: gstr1Json.cdnur?.length > 0 ? gstr1Json.cdnur : Prisma.JsonNull,
          hsnSummary: gstr1Json.hsn?.data?.length > 0 ? gstr1Json.hsn.data : Prisma.JsonNull,
          outwardTaxable: totalOutwardTaxable,
          outwardZeroRated: totalOutwardZeroRated,
          jsonOutput: gstr1Json,
          filingStatus: existingReturn?.filingStatus === 'FILED' ? 'FILED' : 'DRAFT',
          preparedBy: ctx.session.user.name || ctx.session.user.email,
          preparedAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          userId,
          returnType: 'GSTR1',
          period: input.period,
          financialYear,
          month,
          b2bInvoices: gstr1Json.b2b?.length > 0 ? gstr1Json.b2b : Prisma.JsonNull,
          exportInvoices: gstr1Json.exp?.length > 0 ? gstr1Json.exp : Prisma.JsonNull,
          b2cLargeInvoices: gstr1Json.b2cl?.length > 0 ? gstr1Json.b2cl : Prisma.JsonNull,
          b2cSmallInvoices: gstr1Json.b2cs?.length > 0 ? gstr1Json.b2cs : Prisma.JsonNull,
          creditNotes: gstr1Json.cdnr?.length > 0 ? gstr1Json.cdnr : Prisma.JsonNull,
          debitNotes: gstr1Json.cdnur?.length > 0 ? gstr1Json.cdnur : Prisma.JsonNull,
          hsnSummary: gstr1Json.hsn?.data?.length > 0 ? gstr1Json.hsn.data : Prisma.JsonNull,
          outwardTaxable: totalOutwardTaxable,
          outwardZeroRated: totalOutwardZeroRated,
          jsonOutput: gstr1Json,
          filingStatus: 'DRAFT',
          preparedBy: ctx.session.user.name || ctx.session.user.email,
          preparedAt: new Date()
        }
      })
      
      return {
        id: gstReturn.id,
        period: gstReturn.period,
        returnType: gstReturn.returnType,
        filingStatus: gstReturn.filingStatus,
        data: gstr1Json,
        summary: {
          totalInvoices: invoices.length,
          b2bInvoices: gstr1Json.b2b?.length || 0,
          exportInvoices: gstr1Json.exp?.length || 0,
          b2cLargeInvoices: gstr1Json.b2cl?.length || 0,
          b2cSmallInvoices: gstr1Json.b2cs?.length || 0,
          creditNotes: creditNotes.length,
          debitNotes: debitNotes.length,
          totalOutwardTaxable,
          totalOutwardZeroRated
        }
      }
    }),
    
  // Get GST returns list
  list: protectedProcedure
    .input(z.object({
      returnType: z.enum(['GSTR1', 'GSTR3B', 'GSTR2A', 'GSTR9']).optional(),
      financialYear: z.string().optional(),
      filingStatus: z.string().optional()
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: Prisma.GSTReturnWhereInput = {
        userId: ctx.session.user.id
      }
      
      if (input?.returnType) {
        where.returnType = input.returnType
      }
      
      if (input?.financialYear) {
        where.financialYear = input.financialYear
      }
      
      if (input?.filingStatus) {
        where.filingStatus = input.filingStatus
      }
      
      const returns = await ctx.prisma.gSTReturn.findMany({
        where,
        orderBy: {
          period: 'desc'
        }
      })
      
      return returns
    }),
    
  // Get single GST return details
  getReturn: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const gstReturn = await ctx.prisma.gSTReturn.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id
        }
      })
      
      if (!gstReturn) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'GST Return not found'
        })
      }
      
      return gstReturn
    }),
    
  // Export GSTR-1 to JSON for GST portal
  exportGSTR1: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const gstReturn = await ctx.prisma.gSTReturn.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
          returnType: 'GSTR1'
        }
      })
      
      if (!gstReturn) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'GSTR-1 Return not found'
        })
      }
      
      // Get user's GSTIN
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { gstin: true }
      })
      
      if (!user?.gstin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'GSTIN not configured for user'
        })
      }
      
      // Format for GST portal JSON structure
      const gstr1Json = {
        gstin: user.gstin,
        fp: gstReturn.period.replace('-', ''), // Convert MM-YYYY to MMYYYY
        b2b: gstReturn.b2bInvoices || [],
        b2cl: gstReturn.b2cLargeInvoices || [],
        b2cs: gstReturn.b2cSmallInvoices || [],
        exp: gstReturn.exportInvoices || [],
        cdnr: gstReturn.creditNotes || [],
        cdnur: [], // Credit notes for unregistered
        hsn: {
          data: gstReturn.hsnSummary || []
        }
      }
      
      // Update the return with the JSON output
      await ctx.prisma.gSTReturn.update({
        where: { id: input.id },
        data: {
          jsonOutput: gstr1Json
        }
      })
      
      return gstr1Json
    }),
    
  // Update filing status
  updateFilingStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      filingStatus: z.enum(['DRAFT', 'READY', 'FILED', 'AMENDED']),
      arn: z.string().optional(),
      filingDate: z.date().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const gstReturn = await ctx.prisma.gSTReturn.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id
        }
      })
      
      if (!gstReturn) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'GST Return not found'
        })
      }
      
      const updateData: Prisma.GSTReturnUpdateInput = {
        filingStatus: input.filingStatus,
        updatedAt: new Date()
      }
      
      if (input.filingStatus === 'FILED' && input.arn) {
        updateData.arn = input.arn
        updateData.filingDate = input.filingDate || new Date()
      }
      
      if (input.filingStatus === 'READY') {
        updateData.reviewedBy = ctx.session.user.name || ctx.session.user.email
        updateData.reviewedAt = new Date()
      }
      
      const updated = await ctx.prisma.gSTReturn.update({
        where: { id: input.id },
        data: updateData
      })
      
      return updated
    }),
    
  // Generate GSTR-3B for a period
  generateGSTR3B: protectedProcedure
    .input(z.object({
      period: z.string().regex(/^\d{2}-\d{4}$/, 'Period must be in MM-YYYY format'),
      regenerate: z.boolean().optional().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      const [month, year] = input.period.split('-').map(Number)
      const startDate = startOfMonth(new Date(year, month - 1))
      const endDate = endOfMonth(new Date(year, month - 1))
      const financialYear = getFiscalYear(startDate)
      const userId = ctx.session.user.id
      
      // Get user's GSTIN
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { gstin: true }
      })

      if (!user?.gstin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'GSTIN not configured for user'
        })
      }

      // Check if return already exists
      const existingReturn = await ctx.prisma.gSTReturn.findUnique({
        where: {
          userId_returnType_period: {
            userId,
            returnType: 'GSTR3B',
            period: input.period
          }
        }
      })
      
      if (existingReturn && !input.regenerate) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'GSTR-3B already exists for this period. Set regenerate=true to regenerate.'
        })
      }
      
      // Fetch all invoices for the period
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId,
          invoiceDate: {
            gte: startDate,
            lte: endDate
          },
          status: {
            in: ['SENT', 'PAID', 'PARTIALLY_PAID']
          }
        },
        include: {
          lineItems: true,
          client: true
        }
      })
      
      // Transform invoices to match our generator interface
      const transformedInvoices = invoices.map(inv => ({
        ...inv,
        taxableAmount: inv.taxableAmount || inv.subtotal,
        cgstAmount: inv.cgstAmount || new Decimal(0),
        sgstAmount: inv.sgstAmount || new Decimal(0),
        igstAmount: inv.igstAmount || new Decimal(0),
        placeOfSupply: inv.placeOfSupply || inv.client.stateCode || '00',
        supplierStateCode: '27' // Maharashtra - should be from user profile
      }))

      // Fetch purchase invoices for ITC calculation
      const purchaseInvoices = await ctx.prisma.purchaseInvoice.findMany({
        where: {
          userId,
          invoiceDate: {
            gte: startDate,
            lte: endDate
          },
          itcEligible: true
        }
      })

      // Transform purchase invoices
      const transformedPurchases = purchaseInvoices.map(purchase => ({
        ...purchase,
        cgstAmount: purchase.cgstAmount || new Decimal(0),
        sgstAmount: purchase.sgstAmount || new Decimal(0),
        igstAmount: purchase.igstAmount || new Decimal(0),
        itcClaimed: purchase.itcClaimed || new Decimal(0),
        itcReversed: purchase.itcReversed || new Decimal(0)
      }))

      // Generate GSTR-3B JSON using our generator
      const gstr3bPeriod = `${month.toString().padStart(2, '0')}${year}`
      const gstr3bJson = generateGSTR3B(
        transformedInvoices,
        transformedPurchases,
        {
          gstin: user.gstin,
          period: gstr3bPeriod
        }
      )
      
      // Validate the generated data
      const validation = validateGSTR3BData({
        ...gstr3bJson,
        gstin: user.gstin,
        period: gstr3bPeriod
      })
      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `GSTR-3B validation failed: ${validation.errors.join(', ')}`
        })
      }

      // Calculate summary totals
      const outputTax = gstr3bJson.sup_details.osup_det.iamt + 
                       gstr3bJson.sup_details.osup_det.camt + 
                       gstr3bJson.sup_details.osup_det.samt
      
      const inputTaxClaim = gstr3bJson.itc_elg.itc_net.iamt + 
                           gstr3bJson.itc_elg.itc_net.camt + 
                           gstr3bJson.itc_elg.itc_net.samt
      
      const netTaxPayable = Math.max(0, outputTax - inputTaxClaim)
      
      // Create or update the GSTR-3B return
      const gstr3b = await ctx.prisma.gSTReturn.upsert({
        where: {
          userId_returnType_period: {
            userId,
            returnType: 'GSTR3B',
            period: input.period
          }
        },
        update: {
          financialYear,
          month,
          outwardTaxable: gstr3bJson.sup_details.osup_det.txval,
          outwardZeroRated: gstr3bJson.sup_details.osup_zero.txval,
          outwardExempted: gstr3bJson.sup_details.osup_nil_exmp.txval,
          inwardReverseCharge: gstr3bJson.sup_details.isup_rev.txval,
          outwardNonGst: gstr3bJson.sup_details.osup_nongst.txval,
          cgstLiability: gstr3bJson.sup_details.osup_det.camt,
          sgstLiability: gstr3bJson.sup_details.osup_det.samt,
          igstLiability: gstr3bJson.sup_details.osup_det.iamt,
          cessLiability: gstr3bJson.sup_details.osup_det.csamt,
          itcNet: inputTaxClaim,
          totalTaxLiability: netTaxPayable,
          outputTax,
          inputTaxClaim,
          netTaxPayable,
          jsonOutput: gstr3bJson,
          filingStatus: existingReturn?.filingStatus === 'FILED' ? 'FILED' : 'DRAFT',
          preparedBy: ctx.session.user.name || ctx.session.user.email,
          preparedAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          userId,
          returnType: 'GSTR3B',
          period: input.period,
          financialYear,
          month,
          outwardTaxable: gstr3bJson.sup_details.osup_det.txval,
          outwardZeroRated: gstr3bJson.sup_details.osup_zero.txval,
          outwardExempted: gstr3bJson.sup_details.osup_nil_exmp.txval,
          inwardReverseCharge: gstr3bJson.sup_details.isup_rev.txval,
          outwardNonGst: gstr3bJson.sup_details.osup_nongst.txval,
          cgstLiability: gstr3bJson.sup_details.osup_det.camt,
          sgstLiability: gstr3bJson.sup_details.osup_det.samt,
          igstLiability: gstr3bJson.sup_details.osup_det.iamt,
          cessLiability: gstr3bJson.sup_details.osup_det.csamt,
          itcNet: inputTaxClaim,
          totalTaxLiability: netTaxPayable,
          outputTax,
          inputTaxClaim,
          netTaxPayable,
          jsonOutput: gstr3bJson,
          filingStatus: 'DRAFT',
          preparedBy: ctx.session.user.name || ctx.session.user.email,
          preparedAt: new Date()
        }
      })
      
      return {
        id: gstr3b.id,
        period: gstr3b.period,
        returnType: gstr3b.returnType,
        filingStatus: gstr3b.filingStatus,
        data: gstr3bJson,
        summary: {
          outwardSupplies: {
            taxable: gstr3bJson.sup_details.osup_det.txval,
            zeroRated: gstr3bJson.sup_details.osup_zero.txval,
            exempted: gstr3bJson.sup_details.osup_nil_exmp.txval,
            reverseCharge: gstr3bJson.sup_details.isup_rev.txval,
            nonGst: gstr3bJson.sup_details.osup_nongst.txval
          },
          eligibleITC: {
            net: inputTaxClaim
          },
          taxLiability: {
            cgst: gstr3bJson.tx_pmt.tx_pay[0].camt,
            sgst: gstr3bJson.tx_pmt.tx_pay[0].samt,
            igst: gstr3bJson.tx_pmt.tx_pay[0].iamt,
            cess: gstr3bJson.tx_pmt.tx_pay[0].csamt,
            total: netTaxPayable
          }
        }
      }
    }),
    
  // Export GSTR-3B to JSON for GST portal
  exportGSTR3B: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const gstReturn = await ctx.prisma.gSTReturn.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
          returnType: 'GSTR3B'
        }
      })
      
      if (!gstReturn) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'GSTR-3B Return not found'
        })
      }
      
      // Get user's GSTIN
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { gstin: true }
      })
      
      if (!user?.gstin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'GSTIN not configured for user'
        })
      }
      
      // Format for GST portal JSON structure (GSTR-3B)
      const gstr3bJson = {
        gstin: user.gstin,
        ret_period: gstReturn.period.replace('-', ''), // Convert MM-YYYY to MMYYYY
        sup_details: {
          osup_det: {
            txval: Number(gstReturn.outwardTaxable || 0),
            iamt: Number(gstReturn.igstLiability || 0),
            camt: Number(gstReturn.cgstLiability || 0),
            samt: Number(gstReturn.sgstLiability || 0),
            csamt: Number(gstReturn.cessLiability || 0)
          },
          osup_zero: {
            txval: Number(gstReturn.outwardZeroRated || 0),
            iamt: 0,
            csamt: 0
          },
          osup_nil_exmp: {
            txval: Number(gstReturn.outwardExempted || 0)
          },
          isup_rev: {
            txval: Number(gstReturn.inwardReverseCharge || 0),
            iamt: 0,
            camt: 0,
            samt: 0,
            csamt: 0
          },
          osup_nongst: {
            txval: Number(gstReturn.outwardNonGst || 0)
          }
        },
        itc_elg: {
          itc_avl: [
            {
              ty: 'IMPG',
              iamt: Number(gstReturn.itcImportGoods || 0),
              camt: 0,
              samt: 0,
              csamt: 0
            },
            {
              ty: 'IMPS',
              iamt: Number(gstReturn.itcImportServices || 0),
              camt: 0,
              samt: 0,
              csamt: 0
            },
            {
              ty: 'ISRC',
              iamt: Number(gstReturn.itcInwardSupplies || 0),
              camt: 0,
              samt: 0,
              csamt: 0
            },
            {
              ty: 'ISD',
              iamt: Number(gstReturn.itcInwardISD || 0),
              camt: 0,
              samt: 0,
              csamt: 0
            },
            {
              ty: 'OTH',
              iamt: Number(gstReturn.itcOther || 0),
              camt: 0,
              samt: 0,
              csamt: 0
            }
          ],
          itc_rev: [
            {
              ty: 'RUL',
              iamt: Number(gstReturn.itcReversed || 0),
              camt: 0,
              samt: 0,
              csamt: 0
            }
          ],
          itc_net: {
            iamt: Number(gstReturn.itcNet || 0),
            camt: 0,
            samt: 0,
            csamt: 0
          },
          itc_inelg: [
            {
              ty: 'RUL',
              iamt: Number(gstReturn.itcIneligible || 0),
              camt: 0,
              samt: 0,
              csamt: 0
            }
          ]
        },
        intr_ltfee: {
          intr_details: {
            iamt: Number(gstReturn.interest || 0),
            camt: 0,
            samt: 0,
            csamt: 0
          },
          ltfee_details: {
            iamt: Number(gstReturn.lateFee || 0),
            camt: Number(gstReturn.lateFee || 0),
            samt: 0,
            csamt: 0
          }
        }
      }
      
      // Update the return with the JSON output
      await ctx.prisma.gSTReturn.update({
        where: { id: input.id },
        data: {
          jsonOutput: gstr3bJson
        }
      })
      
      return gstr3bJson
    })
})