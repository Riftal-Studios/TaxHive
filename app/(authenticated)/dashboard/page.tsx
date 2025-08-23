import { MUIDashboard } from '@/components/mui/dashboard'
import { ErrorBoundary } from '@/components/error-boundary'

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <MUIDashboard />
    </ErrorBoundary>
  )
}