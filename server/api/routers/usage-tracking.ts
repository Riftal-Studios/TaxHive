import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { prisma } from '@/lib/prisma';

export const usageTrackingRouter = createTRPCRouter({
  // Create usage record for a line item
  create: protectedProcedure
    .input(
      z.object({
        lineItemId: z.string(),
        period: z.date(),
        quantity: z.number().positive(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await prisma.usageTracking.create({
        data: {
          lineItemId: input.lineItemId,
          period: input.period,
          quantity: input.quantity,
          metadata: input.metadata,
        },
      });
    }),

  // Get usage history for a specific line item
  getByLineItem: protectedProcedure
    .input(
      z.object({
        lineItemId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const where: any = {
        lineItemId: input.lineItemId,
      };

      if (input.startDate || input.endDate) {
        where.period = {};
        if (input.startDate) {
          where.period.gte = input.startDate;
        }
        if (input.endDate) {
          where.period.lte = input.endDate;
        }
      }

      return await prisma.usageTracking.findMany({
        where,
        orderBy: {
          period: 'desc',
        },
        include: {
          lineItem: {
            include: {
              recurringInvoice: {
                select: {
                  templateName: true,
                  clientId: true,
                },
              },
            },
          },
        },
      });
    }),

  // Get usage for a specific period across all line items
  getByPeriod: protectedProcedure
    .input(
      z.object({
        period: z.date(),
        userId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = input.userId || ctx.session.user.id;

      return await prisma.usageTracking.findMany({
        where: {
          period: input.period,
          lineItem: {
            recurringInvoice: {
              userId: userId,
            },
          },
        },
        include: {
          lineItem: {
            include: {
              recurringInvoice: {
                select: {
                  templateName: true,
                  clientId: true,
                  client: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }),
});