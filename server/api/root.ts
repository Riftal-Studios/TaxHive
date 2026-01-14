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
import { inboxRouter } from '@/server/api/routers/inbox'
import { gstr2bRouter } from '@/server/api/routers/gstr2b'
import { itcLedgerRouter } from '@/server/api/routers/itcLedger'
import { gstFilingRouter } from '@/server/api/routers/gstFiling'

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
  inbox: inboxRouter,
  gstr2b: gstr2bRouter,
  itcLedger: itcLedgerRouter,
  gstFiling: gstFilingRouter,
})

export type AppRouter = typeof appRouter