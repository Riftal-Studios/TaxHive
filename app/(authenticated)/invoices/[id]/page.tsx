import { MUIInvoiceDetail } from '@/components/mui/invoice-detail'
import { ErrorBoundary } from '@/components/error-boundary'

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <ErrorBoundary>
      <MUIInvoiceDetail invoiceId={id} />
    </ErrorBoundary>
  )
}
