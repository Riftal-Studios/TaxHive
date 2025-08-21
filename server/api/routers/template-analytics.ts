import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { prisma } from '@/lib/prisma'

export const templateAnalyticsRouter = createTRPCRouter({
  recordMetric: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        metric: z.string(),
        value: z.number(),
        period: z.string(),
        timestamp: z.date(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx.session.user

      // Verify the template belongs to the user
      const template = await prisma.recurringInvoice.findFirst({
        where: {
          id: input.templateId,
          userId,
        },
      })

      if (!template) {
        throw new Error('Template not found')
      }

      return await prisma.templateAnalytics.create({
        data: {
          templateId: input.templateId,
          metric: input.metric,
          value: input.value,
          period: input.period,
          timestamp: input.timestamp,
          metadata: input.metadata,
        },
      })
    }),

  getMetrics: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        metric: z.string().optional(),
        period: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx.session.user

      // Verify the template belongs to the user
      const template = await prisma.recurringInvoice.findFirst({
        where: {
          id: input.templateId,
          userId,
        },
      })

      if (!template) {
        throw new Error('Template not found')
      }

      const whereClause: any = {
        templateId: input.templateId,
      }

      if (input.metric) {
        whereClause.metric = input.metric
      }

      if (input.period) {
        whereClause.period = input.period
      }

      if (input.startDate || input.endDate) {
        whereClause.timestamp = {}
        if (input.startDate) {
          whereClause.timestamp.gte = input.startDate
        }
        if (input.endDate) {
          whereClause.timestamp.lte = input.endDate
        }
      }

      return await prisma.templateAnalytics.findMany({
        where: whereClause,
        orderBy: {
          timestamp: 'desc',
        },
      })
    }),

  getInsights: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        period: z.string().optional().default('last_30_days'),
        metrics: z.array(z.string()).optional().default(['revenue', 'generation_rate', 'payment_success']),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx.session.user

      // Verify the template belongs to the user
      const template = await prisma.recurringInvoice.findFirst({
        where: {
          id: input.templateId,
          userId,
        },
      })

      if (!template) {
        throw new Error('Template not found')
      }

      // Calculate date range based on period
      const endDate = new Date()
      const startDate = new Date()
      
      switch (input.period) {
        case 'last_7_days':
          startDate.setDate(endDate.getDate() - 7)
          break
        case 'last_30_days':
          startDate.setDate(endDate.getDate() - 30)
          break
        case 'last_90_days':
          startDate.setDate(endDate.getDate() - 90)
          break
        case 'last_year':
          startDate.setFullYear(endDate.getFullYear() - 1)
          break
        default:
          startDate.setDate(endDate.getDate() - 30)
      }

      const metrics = await prisma.templateAnalytics.findMany({
        where: {
          templateId: input.templateId,
          metric: {
            in: input.metrics,
          },
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      })

      // Group metrics by type and calculate insights
      const insights: Record<string, any> = {}
      
      for (const metricName of input.metrics) {
        const metricData = metrics.filter(m => m.metric === metricName)
        
        if (metricData.length > 0) {
          const values = metricData.map(m => Number(m.value))
          const latest = values[0]
          const average = values.reduce((sum, val) => sum + val, 0) / values.length
          const max = Math.max(...values)
          const min = Math.min(...values)
          
          // Calculate trend (simple comparison of latest vs average)
          const trend = latest > average ? 'up' : latest < average ? 'down' : 'stable'
          
          insights[metricName] = {
            latest,
            average,
            max,
            min,
            trend,
            dataPoints: metricData.length,
            period: input.period,
          }
        }
      }

      return {
        templateId: input.templateId,
        period: input.period,
        insights,
        generatedAt: new Date(),
      }
    }),
})