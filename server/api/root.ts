import { createTRPCRouter } from '@/server/api/trpc'
import { clientRouter } from '@/server/api/routers/client'
import { invoiceRouter } from '@/server/api/routers/invoice'
import { userRouter } from '@/server/api/routers/user'
import { adminRouter } from '@/server/api/routers/admin'
import { lutRouter } from '@/server/api/routers/lut'
import { dashboardRouter } from '@/server/api/routers/dashboard'
import { paymentRouter } from '@/server/api/routers/payment'
import { authRouter } from '@/server/api/routers/auth'
import { gstReturnsRouter } from '@/server/api/routers/gstReturns'
import { creditDebitNotesRouter } from '@/server/api/routers/credit-debit-notes'
import { purchaseInvoicesRouter } from '@/server/api/routers/purchase-invoices'
import { recurringInvoicesRouter } from '@/server/api/routers/recurring-invoices'
import { subscriptionsRouter } from '@/server/api/routers/subscriptions'
import { advanceReceiptsRouter } from '@/server/api/routers/advance-receipts'
import { queuesRouter } from '@/server/api/routers/queues'
import { tdsRouter } from '@/server/api/routers/tds'
import { einvoiceRouter } from '@/server/api/routers/einvoice'
import { vendorsRouter } from '@/server/api/routers/vendors'
import { usageTrackingRouter } from '@/server/api/routers/usage-tracking'
import { templateAnalyticsRouter } from '@/server/api/routers/template-analytics'
import { templateVersioningRouter } from '@/server/api/routers/template-versioning'

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
  creditDebitNotes: creditDebitNotesRouter,
  purchaseInvoices: purchaseInvoicesRouter,
  recurringInvoices: recurringInvoicesRouter,
  subscriptions: subscriptionsRouter,
  advanceReceipts: advanceReceiptsRouter,
  queues: queuesRouter,
  tds: tdsRouter,
  einvoice: einvoiceRouter,
  vendors: vendorsRouter,
  usageTracking: usageTrackingRouter,
  templateAnalytics: templateAnalyticsRouter,
  templateVersioning: templateVersioningRouter,
})

export type AppRouter = typeof appRouter