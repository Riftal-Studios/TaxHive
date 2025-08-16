import { createTRPCRouter } from '@/server/api/trpc'
import { clientRouter } from '@/server/api/routers/client'
import { invoiceRouter } from '@/server/api/routers/invoice'
import { userRouter } from '@/server/api/routers/user'
import { adminRouter } from '@/server/api/routers/admin'
import { lutRouter } from '@/server/api/routers/lut'
import { dashboardRouter } from '@/server/api/routers/dashboard'
import { paymentRouter } from '@/server/api/routers/payment'
import { authRouter } from '@/server/api/routers/auth'
import { gstReturnsRouter } from '@/server/api/routers/gst-returns'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  clients: clientRouter,
  invoices: invoiceRouter,
  users: userRouter,
  admin: adminRouter,
  luts: lutRouter,
  dashboard: dashboardRouter,
  payments: paymentRouter,
  gstReturns: gstReturnsRouter,
})

export type AppRouter = typeof appRouter