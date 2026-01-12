import { createTRPCRouter } from '@/server/api/trpc'
import { clientRouter } from '@/server/api/routers/client'
import { invoiceRouter } from '@/server/api/routers/invoice'
import { userRouter } from '@/server/api/routers/user'
import { adminRouter } from '@/server/api/routers/admin'
import { lutRouter } from '@/server/api/routers/lut'
import { dashboardRouter } from '@/server/api/routers/dashboard'
import { paymentRouter } from '@/server/api/routers/payment'
import { authRouter } from '@/server/api/routers/auth'
import { feedbackRouter } from '@/server/api/routers/feedback'
import { unregisteredSupplierRouter } from '@/server/api/routers/unregisteredSupplier'
import { selfInvoiceRouter } from '@/server/api/routers/selfInvoice'
import { paymentVoucherRouter } from '@/server/api/routers/paymentVoucher'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  clients: clientRouter,
  invoices: invoiceRouter,
  users: userRouter,
  admin: adminRouter,
  luts: lutRouter,
  dashboard: dashboardRouter,
  payments: paymentRouter,
  feedback: feedbackRouter,
  unregisteredSuppliers: unregisteredSupplierRouter,
  selfInvoices: selfInvoiceRouter,
  paymentVouchers: paymentVoucherRouter,
})

export type AppRouter = typeof appRouter