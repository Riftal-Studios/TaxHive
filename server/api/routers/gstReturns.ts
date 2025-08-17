import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'

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
      
      // Check if return already exists
      const existingReturn = await ctx.prisma.gSTReturn.findUnique({
        where: {
          userId_returnType_period: {
            userId: ctx.session.user.id,
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
      
      // Fetch all invoices for the period
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
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
          client: true,
          creditNotes: {
            where: {
              status: 'ISSUED'
            },
            include: {
              lineItems: true
            }
          },
          debitNotes: {
            where: {
              status: 'ISSUED'
            },
            include: {
              lineItems: true
            }
          }
        }
      })
      
      // Separate invoices by type
      const exportInvoices = invoices.filter(inv => inv.invoiceType === 'EXPORT')
      const b2bInvoices = invoices.filter(inv => inv.invoiceType === 'DOMESTIC_B2B')
      const b2cLargeInvoices = invoices.filter(
        inv => inv.invoiceType === 'DOMESTIC_B2C' && Number(inv.totalInINR) > 250000
      )
      const b2cSmallInvoices = invoices.filter(
        inv => inv.invoiceType === 'DOMESTIC_B2C' && Number(inv.totalInINR) <= 250000
      )
      
      // Get credit and debit notes for the period
      const creditNotes = await ctx.prisma.creditNote.findMany({
        where: {
          userId: ctx.session.user.id,
          noteDate: {
            gte: startDate,
            lte: endDate
          },
          status: 'ISSUED'
        },
        include: {
          lineItems: true,
          originalInvoice: {
            include: {
              client: true
            }
          }
        }
      })
      
      const debitNotes = await ctx.prisma.debitNote.findMany({
        where: {
          userId: ctx.session.user.id,
          noteDate: {
            gte: startDate,
            lte: endDate
          },
          status: 'ISSUED'
        },
        include: {
          lineItems: true,
          originalInvoice: {
            include: {
              client: true
            }
          }
        }
      })
      
      // Generate GSTR-1 sections
      const b2bData = generateB2BInvoices(b2bInvoices)
      const exportData = generateExportInvoices(exportInvoices)
      const hsnSummary = generateHSNSummary(invoices)
      
      // Calculate totals for GSTR-3B
      const totalOutwardTaxable = invoices.reduce(
        (sum, inv) => sum + Number(inv.taxableAmount || inv.subtotal), 0
      )
      const totalOutwardZeroRated = exportInvoices.reduce(
        (sum, inv) => sum + Number(inv.totalInINR), 0
      )
      
      // Create or update the GST return
      const gstReturn = await ctx.prisma.gSTReturn.upsert({
        where: {
          userId_returnType_period: {
            userId: ctx.session.user.id,
            returnType: 'GSTR1',
            period: input.period
          }
        },
        update: {
          financialYear,
          month,
          b2bInvoices: b2bData.length > 0 ? b2bData : Prisma.JsonNull,
          exportInvoices: exportData.length > 0 ? exportData : Prisma.JsonNull,
          b2cLargeInvoices: Prisma.JsonNull, // TODO: Implement B2C large
          b2cSmallInvoices: Prisma.JsonNull, // TODO: Implement B2C small
          creditNotes: creditNotes.length > 0 ? creditNotes : Prisma.JsonNull,
          debitNotes: debitNotes.length > 0 ? debitNotes : Prisma.JsonNull,
          hsnSummary: hsnSummary.length > 0 ? hsnSummary : Prisma.JsonNull,
          outwardTaxable: totalOutwardTaxable,
          outwardZeroRated: totalOutwardZeroRated,
          filingStatus: 'DRAFT',
          preparedBy: ctx.session.user.name || ctx.session.user.email,
          preparedAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          userId: ctx.session.user.id,
          returnType: 'GSTR1',
          period: input.period,
          financialYear,
          month,
          b2bInvoices: b2bData.length > 0 ? b2bData : Prisma.JsonNull,
          exportInvoices: exportData.length > 0 ? exportData : Prisma.JsonNull,
          b2cLargeInvoices: Prisma.JsonNull,
          b2cSmallInvoices: Prisma.JsonNull,
          creditNotes: creditNotes.length > 0 ? creditNotes : Prisma.JsonNull,
          debitNotes: debitNotes.length > 0 ? debitNotes : Prisma.JsonNull,
          hsnSummary: hsnSummary.length > 0 ? hsnSummary : Prisma.JsonNull,
          outwardTaxable: totalOutwardTaxable,
          outwardZeroRated: totalOutwardZeroRated,
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
        summary: {
          totalInvoices: invoices.length,
          b2bInvoices: b2bInvoices.length,
          exportInvoices: exportInvoices.length,
          b2cLargeInvoices: b2cLargeInvoices.length,
          b2cSmallInvoices: b2cSmallInvoices.length,
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
      
      // Check if return already exists
      const existingReturn = await ctx.prisma.gSTReturn.findUnique({
        where: {
          userId_returnType_period: {
            userId: ctx.session.user.id,
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
      
      // 1. Calculate outward supplies (Table 3.1)
      const invoices = await ctx.prisma.invoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceDate: {
            gte: startDate,
            lte: endDate
          },
          status: {
            in: ['SENT', 'PAID', 'PARTIALLY_PAID']
          }
        },
        include: {
          lineItems: true
        }
      })
      
      // Calculate outward supplies
      const outwardTaxable = invoices
        .filter(inv => inv.invoiceType !== 'EXPORT')
        .reduce((sum, inv) => sum + Number(inv.taxableAmount || inv.subtotal), 0)
      
      const outwardZeroRated = invoices
        .filter(inv => inv.invoiceType === 'EXPORT')
        .reduce((sum, inv) => sum + Number(inv.totalInINR), 0)
      
      const outwardExempted = 0 // No exempted supplies for now
      const inwardReverseCharge = 0 // Not applicable for service exports
      const outwardNonGst = 0 // Not applicable
      
      // 2. Calculate eligible ITC (Table 4)
      // Fetch purchase invoices for ITC calculation
      const purchaseInvoices = await ctx.prisma.purchaseInvoice.findMany({
        where: {
          userId: ctx.session.user.id,
          invoiceDate: {
            gte: startDate,
            lte: endDate
          },
          itcEligible: true
        }
      })
      
      // Calculate ITC by category
      const itcImportGoods = 0 // No goods imports for service company
      const itcImportServices = purchaseInvoices
        .filter(inv => inv.itcCategory === 'INPUT_SERVICES' && inv.vendorId.includes('IMPORT'))
        .reduce((sum, inv) => sum + Number(inv.itcClaimed), 0)
      
      const itcInwardSupplies = purchaseInvoices
        .filter(inv => inv.itcCategory === 'INPUTS')
        .reduce((sum, inv) => sum + Number(inv.itcClaimed), 0)
      
      const itcOther = purchaseInvoices
        .filter(inv => !['INPUTS', 'INPUT_SERVICES'].includes(inv.itcCategory))
        .reduce((sum, inv) => sum + Number(inv.itcClaimed), 0)
      
      const itcReversed = purchaseInvoices
        .reduce((sum, inv) => sum + Number(inv.itcReversed), 0)
      
      const itcNet = itcImportGoods + itcImportServices + itcInwardSupplies + itcOther - itcReversed
      
      // 3. Calculate tax liability (Table 6)
      const cgstLiability = invoices
        .filter(inv => inv.invoiceType === 'DOMESTIC_B2B' || inv.invoiceType === 'DOMESTIC_B2C')
        .reduce((sum, inv) => sum + Number(inv.cgstAmount), 0)
      
      const sgstLiability = invoices
        .filter(inv => inv.invoiceType === 'DOMESTIC_B2B' || inv.invoiceType === 'DOMESTIC_B2C')
        .reduce((sum, inv) => sum + Number(inv.sgstAmount), 0)
      
      const igstLiability = invoices
        .filter(inv => inv.invoiceType === 'DOMESTIC_B2B' || inv.invoiceType === 'DOMESTIC_B2C')
        .reduce((sum, inv) => sum + Number(inv.igstAmount), 0)
      
      const cessLiability = 0 // No cess for service exports
      
      const totalTaxLiability = cgstLiability + sgstLiability + igstLiability + cessLiability - itcNet
      
      // Create or update the GSTR-3B return
      const gstr3b = await ctx.prisma.gSTReturn.upsert({
        where: {
          userId_returnType_period: {
            userId: ctx.session.user.id,
            returnType: 'GSTR3B',
            period: input.period
          }
        },
        update: {
          financialYear,
          month,
          outwardTaxable,
          outwardZeroRated,
          outwardExempted,
          inwardReverseCharge,
          outwardNonGst,
          itcImportGoods,
          itcImportServices,
          itcInwardSupplies,
          itcOther,
          itcReversed,
          itcNet,
          cgstLiability,
          sgstLiability,
          igstLiability,
          cessLiability,
          totalTaxLiability,
          filingStatus: 'DRAFT',
          preparedBy: ctx.session.user.name || ctx.session.user.email,
          preparedAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          userId: ctx.session.user.id,
          returnType: 'GSTR3B',
          period: input.period,
          financialYear,
          month,
          outwardTaxable,
          outwardZeroRated,
          outwardExempted,
          inwardReverseCharge,
          outwardNonGst,
          itcImportGoods,
          itcImportServices,
          itcInwardSupplies,
          itcOther,
          itcReversed,
          itcNet,
          cgstLiability,
          sgstLiability,
          igstLiability,
          cessLiability,
          totalTaxLiability,
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
        summary: {
          outwardSupplies: {
            taxable: outwardTaxable,
            zeroRated: outwardZeroRated,
            exempted: outwardExempted,
            reverseCharge: inwardReverseCharge,
            nonGst: outwardNonGst
          },
          eligibleITC: {
            importGoods: itcImportGoods,
            importServices: itcImportServices,
            inwardSupplies: itcInwardSupplies,
            other: itcOther,
            reversed: itcReversed,
            net: itcNet
          },
          taxLiability: {
            cgst: cgstLiability,
            sgst: sgstLiability,
            igst: igstLiability,
            cess: cessLiability,
            total: totalTaxLiability
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