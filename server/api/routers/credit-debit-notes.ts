/**
 * Credit and Debit Notes tRPC Router
 * Handles creation, management, and PDF generation for credit/debit notes
 */

import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { TRPCError } from "@trpc/server"
import {
  generateCreditNoteNumber,
  generateDebitNoteNumber,
  calculateCreditNoteAdjustment,
  calculateDebitNoteAdjustment,
  validateCreditNote,
  validateDebitNote,
  calculateUpdatedInvoiceBalance,
  CREDIT_NOTE_REASONS,
  DEBIT_NOTE_REASONS
} from "@/lib/credit-debit-notes"
import { getFinancialYear } from "@/lib/gst"

const creditNoteLineItemSchema = z.object({
  description: z.string(),
  serviceCode: z.string(),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  gstRate: z.number().min(0).max(28)
})

const debitNoteLineItemSchema = z.object({
  description: z.string(),
  serviceCode: z.string(),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  gstRate: z.number().min(0).max(28)
})

export const creditDebitNotesRouter = createTRPCRouter({
  /**
   * Create a credit note
   */
  createCreditNote: protectedProcedure
    .input(
      z.object({
        originalInvoiceId: z.string(),
        noteDate: z.date(),
        reason: z.enum(['RATE_CHANGE', 'QUANTITY_CHANGE', 'DISCOUNT', 'RETURN', 'OTHER']),
        reasonDescription: z.string().optional(),
        lineItems: z.array(creditNoteLineItemSchema),
        notes: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      // Fetch original invoice with line items
      const originalInvoice = await ctx.prisma.invoice.findFirst({
        where: {
          id: input.originalInvoiceId,
          userId
        },
        include: {
          lineItems: true
        }
      })

      if (!originalInvoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Original invoice not found"
        })
      }

      // Calculate GST adjustments
      const adjustment = calculateCreditNoteAdjustment(
        originalInvoice,
        input.lineItems
      )

      // Validate credit note
      const validation = validateCreditNote(
        originalInvoice,
        input.noteDate,
        adjustment.totalDiff
      )

      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.error
        })
      }

      // Generate credit note number
      const fy = getFinancialYear(input.noteDate)
      const count = await ctx.prisma.creditNote.count({
        where: {
          userId,
          noteNumber: {
            startsWith: `CN-${fy}/`
          }
        }
      })
      const noteNumber = generateCreditNoteNumber(input.noteDate, count + 1)

      // Create credit note with line items
      const creditNote = await ctx.prisma.creditNote.create({
        data: {
          userId,
          noteNumber,
          noteDate: input.noteDate,
          originalInvoiceId: input.originalInvoiceId,
          reason: input.reason,
          reasonDescription: input.reasonDescription,
          taxableAmountDiff: adjustment.taxableAmountDiff,
          cgstDiff: adjustment.cgstDiff,
          sgstDiff: adjustment.sgstDiff,
          igstDiff: adjustment.igstDiff,
          totalGSTDiff: adjustment.totalGSTDiff,
          totalDiff: adjustment.totalDiff,
          status: 'DRAFT',
          notes: input.notes,
          lineItems: {
            create: input.lineItems.map(item => ({
              description: item.description,
              serviceCode: item.serviceCode,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.quantity * item.rate,
              gstRate: item.gstRate,
              cgstAmount: originalInvoice.igstRate ? 0 : (item.quantity * item.rate * item.gstRate / 200),
              sgstAmount: originalInvoice.igstRate ? 0 : (item.quantity * item.rate * item.gstRate / 200),
              igstAmount: originalInvoice.igstRate ? (item.quantity * item.rate * item.gstRate / 100) : 0
            }))
          }
        },
        include: {
          lineItems: true,
          originalInvoice: true
        }
      })

      return creditNote
    }),

  /**
   * Create a debit note
   */
  createDebitNote: protectedProcedure
    .input(
      z.object({
        originalInvoiceId: z.string(),
        noteDate: z.date(),
        reason: z.enum(['RATE_INCREASE', 'QUANTITY_INCREASE', 'ADDITIONAL_CHARGE', 'PENALTY', 'OTHER']),
        reasonDescription: z.string().optional(),
        lineItems: z.array(debitNoteLineItemSchema),
        notes: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      // Fetch original invoice with line items
      const originalInvoice = await ctx.prisma.invoice.findFirst({
        where: {
          id: input.originalInvoiceId,
          userId
        },
        include: {
          lineItems: true
        }
      })

      if (!originalInvoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Original invoice not found"
        })
      }

      // Calculate GST adjustments
      const adjustment = calculateDebitNoteAdjustment(
        originalInvoice,
        input.lineItems
      )

      // Validate debit note
      const validation = validateDebitNote(
        originalInvoice,
        input.noteDate
      )

      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.error
        })
      }

      // Generate debit note number
      const fy = getFinancialYear(input.noteDate)
      const count = await ctx.prisma.debitNote.count({
        where: {
          userId,
          noteNumber: {
            startsWith: `DN-${fy}/`
          }
        }
      })
      const noteNumber = generateDebitNoteNumber(input.noteDate, count + 1)

      // Create debit note with line items
      const debitNote = await ctx.prisma.debitNote.create({
        data: {
          userId,
          noteNumber,
          noteDate: input.noteDate,
          originalInvoiceId: input.originalInvoiceId,
          reason: input.reason,
          reasonDescription: input.reasonDescription,
          taxableAmountDiff: adjustment.taxableAmountDiff,
          cgstDiff: adjustment.cgstDiff,
          sgstDiff: adjustment.sgstDiff,
          igstDiff: adjustment.igstDiff,
          totalGSTDiff: adjustment.totalGSTDiff,
          totalDiff: adjustment.totalDiff,
          status: 'DRAFT',
          notes: input.notes,
          lineItems: {
            create: input.lineItems.map(item => ({
              description: item.description,
              serviceCode: item.serviceCode,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.quantity * item.rate,
              gstRate: item.gstRate,
              cgstAmount: originalInvoice.igstRate ? 0 : (item.quantity * item.rate * item.gstRate / 200),
              sgstAmount: originalInvoice.igstRate ? 0 : (item.quantity * item.rate * item.gstRate / 200),
              igstAmount: originalInvoice.igstRate ? (item.quantity * item.rate * item.gstRate / 100) : 0
            }))
          }
        },
        include: {
          lineItems: true,
          originalInvoice: true
        }
      })

      return debitNote
    }),

  /**
   * Get credit notes by invoice
   */
  getCreditNotesByInvoice: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const creditNotes = await ctx.prisma.creditNote.findMany({
        where: {
          userId,
          originalInvoiceId: input
        },
        include: {
          lineItems: true,
          originalInvoice: true
        },
        orderBy: {
          noteDate: 'desc'
        }
      })

      return creditNotes
    }),

  /**
   * Get debit notes by invoice
   */
  getDebitNotesByInvoice: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const debitNotes = await ctx.prisma.debitNote.findMany({
        where: {
          userId,
          originalInvoiceId: input
        },
        include: {
          lineItems: true,
          originalInvoice: true
        },
        orderBy: {
          noteDate: 'desc'
        }
      })

      return debitNotes
    }),

  /**
   * Get all credit notes
   */
  getAllCreditNotes: protectedProcedure
    .input(
      z.object({
        status: z.enum(['DRAFT', 'ISSUED', 'CANCELLED']).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional()
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const where: any = { userId }

      if (input?.status) {
        where.status = input.status
      }

      if (input?.startDate && input?.endDate) {
        where.noteDate = {
          gte: input.startDate,
          lte: input.endDate
        }
      }

      const creditNotes = await ctx.prisma.creditNote.findMany({
        where,
        include: {
          originalInvoice: {
            include: {
              client: true
            }
          },
          lineItems: true
        },
        orderBy: {
          noteDate: 'desc'
        }
      })

      return creditNotes
    }),

  /**
   * Get all debit notes
   */
  getAllDebitNotes: protectedProcedure
    .input(
      z.object({
        status: z.enum(['DRAFT', 'ISSUED', 'CANCELLED']).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional()
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const where: any = { userId }

      if (input?.status) {
        where.status = input.status
      }

      if (input?.startDate && input?.endDate) {
        where.noteDate = {
          gte: input.startDate,
          lte: input.endDate
        }
      }

      const debitNotes = await ctx.prisma.debitNote.findMany({
        where,
        include: {
          originalInvoice: {
            include: {
              client: true
            }
          },
          lineItems: true
        },
        orderBy: {
          noteDate: 'desc'
        }
      })

      return debitNotes
    }),

  /**
   * Update credit note status
   */
  updateCreditNoteStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['DRAFT', 'ISSUED', 'CANCELLED'])
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      // Verify ownership
      const creditNote = await ctx.prisma.creditNote.findFirst({
        where: {
          id: input.id,
          userId
        }
      })

      if (!creditNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found"
        })
      }

      // Update status
      const updated = await ctx.prisma.creditNote.update({
        where: { id: input.id },
        data: { status: input.status }
      })

      // If issuing the credit note, update invoice balance
      if (input.status === 'ISSUED' && creditNote.status !== 'ISSUED') {
        // Fetch all credit and debit notes for this invoice
        const [creditNotes, debitNotes] = await Promise.all([
          ctx.prisma.creditNote.findMany({
            where: {
              originalInvoiceId: creditNote.originalInvoiceId,
              status: 'ISSUED'
            }
          }),
          ctx.prisma.debitNote.findMany({
            where: {
              originalInvoiceId: creditNote.originalInvoiceId,
              status: 'ISSUED'
            }
          })
        ])

        // Include the newly issued credit note
        creditNotes.push(updated)

        // Fetch original invoice
        const originalInvoice = await ctx.prisma.invoice.findUnique({
          where: { id: creditNote.originalInvoiceId }
        })

        if (originalInvoice) {
          // Calculate updated balance
          const balance = calculateUpdatedInvoiceBalance(
            originalInvoice,
            creditNotes,
            debitNotes
          )

          // Update invoice balance
          await ctx.prisma.invoice.update({
            where: { id: creditNote.originalInvoiceId },
            data: {
              balanceDue: balance.balanceDue,
              paymentStatus: balance.balanceDue === 0 ? 'PAID' : 
                           balance.balanceDue < balance.adjustedAmount ? 'PARTIALLY_PAID' : 'UNPAID'
            }
          })
        }
      }

      return updated
    }),

  /**
   * Update debit note status
   */
  updateDebitNoteStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['DRAFT', 'ISSUED', 'CANCELLED'])
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      // Verify ownership
      const debitNote = await ctx.prisma.debitNote.findFirst({
        where: {
          id: input.id,
          userId
        }
      })

      if (!debitNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Debit note not found"
        })
      }

      // Update status
      const updated = await ctx.prisma.debitNote.update({
        where: { id: input.id },
        data: { status: input.status }
      })

      // If issuing the debit note, update invoice balance
      if (input.status === 'ISSUED' && debitNote.status !== 'ISSUED') {
        // Fetch all credit and debit notes for this invoice
        const [creditNotes, debitNotes] = await Promise.all([
          ctx.prisma.creditNote.findMany({
            where: {
              originalInvoiceId: debitNote.originalInvoiceId,
              status: 'ISSUED'
            }
          }),
          ctx.prisma.debitNote.findMany({
            where: {
              originalInvoiceId: debitNote.originalInvoiceId,
              status: 'ISSUED'
            }
          })
        ])

        // Include the newly issued debit note
        debitNotes.push(updated)

        // Fetch original invoice
        const originalInvoice = await ctx.prisma.invoice.findUnique({
          where: { id: debitNote.originalInvoiceId }
        })

        if (originalInvoice) {
          // Calculate updated balance
          const balance = calculateUpdatedInvoiceBalance(
            originalInvoice,
            creditNotes,
            debitNotes
          )

          // Update invoice balance
          await ctx.prisma.invoice.update({
            where: { id: debitNote.originalInvoiceId },
            data: {
              balanceDue: balance.balanceDue,
              paymentStatus: balance.balanceDue === 0 ? 'PAID' : 
                           balance.balanceDue < balance.adjustedAmount ? 'PARTIALLY_PAID' : 'UNPAID'
            }
          })
        }
      }

      return updated
    }),

  /**
   * Calculate invoice adjustments
   */
  calculateInvoiceAdjustments: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      // Fetch invoice with all related notes
      const [invoice, creditNotes, debitNotes] = await Promise.all([
        ctx.prisma.invoice.findFirst({
          where: {
            id: input,
            userId
          }
        }),
        ctx.prisma.creditNote.findMany({
          where: {
            originalInvoiceId: input,
            userId
          }
        }),
        ctx.prisma.debitNote.findMany({
          where: {
            originalInvoiceId: input,
            userId
          }
        })
      ])

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found"
        })
      }

      const balance = calculateUpdatedInvoiceBalance(
        invoice,
        creditNotes,
        debitNotes
      )

      return {
        ...balance,
        creditNotes,
        debitNotes
      }
    }),

  /**
   * Get credit note by ID
   */
  getCreditNoteById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const creditNote = await ctx.prisma.creditNote.findFirst({
        where: {
          id: input,
          userId
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

      if (!creditNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found"
        })
      }

      return creditNote
    }),

  /**
   * Get debit note by ID
   */
  getDebitNoteById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const debitNote = await ctx.prisma.debitNote.findFirst({
        where: {
          id: input,
          userId
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

      if (!debitNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Debit note not found"
        })
      }

      return debitNote
    })
})