import { MUIPayments } from '@/components/mui/payments'
import { ErrorBoundary } from '@/components/error-boundary'

export default function PaymentsPage() {
  return (
    <ErrorBoundary>
      <MUIPayments />
    </ErrorBoundary>
  )
}