import { createTRPCRouter } from '@/server/api/trpc'
import { clientRouter } from '@/server/api/routers/client'
import { invoiceRouter } from '@/server/api/routers/invoice'
import { userRouter } from '@/server/api/routers/user'
import { adminRouter } from '@/server/api/routers/admin'

export const appRouter = createTRPCRouter({
  clients: clientRouter,
  invoices: invoiceRouter,
  users: userRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter