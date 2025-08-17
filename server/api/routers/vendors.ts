/**
 * Vendor Management API Router
 * Handles vendor CRUD operations and ITC tracking
 */

import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { 
  validateVendorGSTIN, 
  validateVendorPAN,
  createVendor as createVendorLib,
  updateVendor as updateVendorLib,
  getVendorITCSummary,
  classifyVendor
} from '@/lib/itc/vendor-management'
import { Decimal } from '@prisma/client/runtime/library'

// Vendor input schema
const vendorCreateSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  gstin: z.string().length(15).optional().nullable(),
  pan: z.string().length(10).optional().nullable(),
  tan: z.string().length(10).optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  stateCode: z.string().length(2).optional(),
  pincode: z.string().length(6).optional(),
  vendorType: z.enum(['REGULAR', 'COMPOSITION', 'UNREGISTERED', 'SEZ', 'IMPORT']).default('REGULAR'),
  isRegistered: z.boolean().default(true),
  compositionRate: z.number().min(0).max(100).optional(),
  msmeRegistered: z.boolean().default(false),
  msmeNumber: z.string().optional().nullable(),
  rcmApplicable: z.boolean().default(false),
  tdsApplicable: z.boolean().default(false),
  tdsSectionCode: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIFSC: z.string().optional(),
  bankBranch: z.string().optional()
})

const vendorUpdateSchema = vendorCreateSchema.partial().extend({
  id: z.string()
})

export const vendorsRouter = createTRPCRouter({
  // Create a new vendor
  create: protectedProcedure
    .input(vendorCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate GSTIN if provided
      if (input.gstin) {
        const gstinValidation = validateVendorGSTIN(input.gstin)
        if (!gstinValidation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: gstinValidation.error || 'Invalid GSTIN'
          })
        }
        
        // Check for duplicate GSTIN
        const existingVendor = await ctx.prisma.vendor.findFirst({
          where: {
            gstin: input.gstin,
            userId: ctx.session.user.id
          }
        })
        
        if (existingVendor) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A vendor with this GSTIN already exists'
          })
        }
      }
      
      // Validate PAN if provided
      if (input.pan) {
        const panValidation = validateVendorPAN(input.pan)
        if (!panValidation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: panValidation.error || 'Invalid PAN'
          })
        }
      }
      
      // Extract state from GSTIN if available
      let state = input.stateCode
      let extractedPAN = input.pan
      
      if (input.gstin) {
        const gstinInfo = validateVendorGSTIN(input.gstin)
        state = gstinInfo.stateCode
        extractedPAN = gstinInfo.pan || input.pan
      }
      
      // Create vendor in database
      const vendor = await ctx.prisma.vendor.create({
        data: {
          ...input,
          pan: extractedPAN,
          stateCode: state,
          userId: ctx.session.user.id
        }
      })
      
      return vendor
    }),
  
  // Update vendor details
  update: protectedProcedure
    .input(vendorUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input
      
      // Check if vendor exists and belongs to user
      const existingVendor = await ctx.prisma.vendor.findFirst({
        where: {
          id,
          userId: ctx.session.user.id
        }
      })
      
      if (!existingVendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found'
        })
      }
      
      // Validate GSTIN if being updated
      if (updateData.gstin) {
        const gstinValidation = validateVendorGSTIN(updateData.gstin)
        if (!gstinValidation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: gstinValidation.error || 'Invalid GSTIN'
          })
        }
        
        // Check for duplicate GSTIN (excluding current vendor)
        const duplicateVendor = await ctx.prisma.vendor.findFirst({
          where: {
            gstin: updateData.gstin,
            userId: ctx.session.user.id,
            NOT: { id }
          }
        })
        
        if (duplicateVendor) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Another vendor with this GSTIN already exists'
          })
        }
        
        // Extract state and PAN from GSTIN
        updateData.stateCode = gstinValidation.stateCode
        updateData.pan = gstinValidation.pan
      }
      
      // Update vendor
      const vendor = await ctx.prisma.vendor.update({
        where: { id },
        data: updateData
      })
      
      return vendor
    }),
  
  // Get vendor by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id
        },
        include: {
          purchaseInvoices: {
            orderBy: { invoiceDate: 'desc' },
            take: 10
          }
        }
      })
      
      if (!vendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found'
        })
      }
      
      return vendor
    }),
  
  // List all vendors
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      vendorType: z.enum(['REGULAR', 'COMPOSITION', 'UNREGISTERED', 'SEZ', 'IMPORT']).optional(),
      isRegistered: z.boolean().optional(),
      stateCode: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().default(0)
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {
        userId: ctx.session.user.id
      }
      
      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { gstin: { contains: input.search, mode: 'insensitive' } },
          { pan: { contains: input.search, mode: 'insensitive' } },
          { email: { contains: input.search, mode: 'insensitive' } }
        ]
      }
      
      if (input?.vendorType) {
        where.vendorType = input.vendorType
      }
      
      if (input?.isRegistered !== undefined) {
        where.isRegistered = input.isRegistered
      }
      
      if (input?.stateCode) {
        where.stateCode = input.stateCode
      }
      
      const [vendors, total] = await Promise.all([
        ctx.prisma.vendor.findMany({
          where,
          orderBy: { name: 'asc' },
          take: input?.limit || 50,
          skip: input?.offset || 0
        }),
        ctx.prisma.vendor.count({ where })
      ])
      
      return {
        vendors,
        total,
        hasMore: (input?.offset || 0) + vendors.length < total
      }
    }),
  
  // Delete vendor
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if vendor exists and belongs to user
      const vendor = await ctx.prisma.vendor.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id
        },
        include: {
          purchaseInvoices: {
            take: 1
          }
        }
      })
      
      if (!vendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found'
        })
      }
      
      // Check if vendor has associated invoices
      if (vendor.purchaseInvoices.length > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot delete vendor with associated purchase invoices'
        })
      }
      
      await ctx.prisma.vendor.delete({
        where: { id: input.id }
      })
      
      return { success: true }
    }),
  
  // Get vendor ITC summary
  getITCSummary: protectedProcedure
    .input(z.object({
      vendorId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
      includeInvoiceDetails: z.boolean().default(false)
    }))
    .query(async ({ ctx, input }) => {
      // Check vendor belongs to user
      const vendor = await ctx.prisma.vendor.findFirst({
        where: {
          id: input.vendorId,
          userId: ctx.session.user.id
        }
      })
      
      if (!vendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found'
        })
      }
      
      // Get purchase invoices for the period
      const invoices = await ctx.prisma.purchaseInvoice.findMany({
        where: {
          vendorId: input.vendorId,
          invoiceDate: {
            gte: input.startDate,
            lte: input.endDate
          },
          userId: ctx.session.user.id
        },
        orderBy: { invoiceDate: 'desc' }
      })
      
      // Calculate summary
      let totalPurchases = new Decimal(0)
      let totalITCEligible = new Decimal(0)
      let totalITCClaimed = new Decimal(0)
      let totalITCReversed = new Decimal(0)
      const invoiceDetails: any[] = []
      
      for (const invoice of invoices) {
        totalPurchases = totalPurchases.add(invoice.taxableAmount || 0)
        
        const gstAmount = new Decimal(0)
          .add(invoice.cgstAmount || 0)
          .add(invoice.sgstAmount || 0)
          .add(invoice.igstAmount || 0)
        
        if (invoice.itcEligible) {
          totalITCEligible = totalITCEligible.add(gstAmount)
          totalITCClaimed = totalITCClaimed.add(invoice.itcClaimed || 0)
        }
        
        if (invoice.itcReversed) {
          totalITCReversed = totalITCReversed.add(invoice.itcReversed)
        }
        
        if (input.includeInvoiceDetails) {
          invoiceDetails.push({
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            taxableAmount: invoice.taxableAmount,
            gstAmount,
            itcEligible: invoice.itcEligible,
            itcClaimed: invoice.itcClaimed,
            itcReversed: invoice.itcReversed
          })
        }
      }
      
      const netITC = totalITCClaimed.sub(totalITCReversed)
      
      // Calculate pending reconciliation
      const pendingReconciliation = invoices.filter(inv => !inv.gstr2aMatched)
      const pendingAmount = pendingReconciliation.reduce((sum, inv) => {
        const gst = new Decimal(0)
          .add(inv.cgstAmount || 0)
          .add(inv.sgstAmount || 0)
          .add(inv.igstAmount || 0)
        return sum.add(gst)
      }, new Decimal(0))
      
      // Calculate mismatched invoices
      const mismatchedInvoices = invoices.filter(inv => 
        inv.gstr2aMatched === false && inv.gstr2aTaxDifference
      )
      const taxDifference = mismatchedInvoices.reduce((sum, inv) => 
        sum.add(inv.gstr2aTaxDifference || 0), new Decimal(0)
      )
      
      return {
        vendorId: input.vendorId,
        vendorName: vendor.name,
        totalPurchases,
        totalITCEligible,
        totalITCClaimed,
        totalITCReversed,
        netITC,
        invoiceDetails: input.includeInvoiceDetails ? invoiceDetails : undefined,
        pendingReconciliation: {
          count: pendingReconciliation.length,
          amount: pendingAmount
        },
        mismatchedInvoices: {
          count: mismatchedInvoices.length,
          taxDifference
        }
      }
    }),
  
  // Classify vendor for ITC eligibility
  classifyVendor: protectedProcedure
    .input(z.object({ vendorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.findFirst({
        where: {
          id: input.vendorId,
          userId: ctx.session.user.id
        }
      })
      
      if (!vendor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Vendor not found'
        })
      }
      
      return classifyVendor(vendor)
    }),
  
  // Validate GSTIN
  validateGSTIN: protectedProcedure
    .input(z.object({ gstin: z.string() }))
    .query(async ({ input }) => {
      return validateVendorGSTIN(input.gstin)
    }),
  
  // Validate PAN
  validatePAN: protectedProcedure
    .input(z.object({ pan: z.string() }))
    .query(async ({ input }) => {
      return validateVendorPAN(input.pan)
    })
})