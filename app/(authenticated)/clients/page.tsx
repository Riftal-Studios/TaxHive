import { MUIClients } from '@/components/mui/clients'
import { ErrorBoundary } from '@/components/error-boundary'

export default function ClientsPage() {
  return (
    <ErrorBoundary>
      <MUIClients />
    </ErrorBoundary>
  )
}