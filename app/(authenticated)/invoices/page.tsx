import { InvoiceList } from '@/components/mui/invoice-list'
import { ErrorBoundary } from '@/components/error-boundary'

export default function InvoicesPage() {
  return (
    <ErrorBoundary>
      <InvoiceList />
    </ErrorBoundary>
  )
}