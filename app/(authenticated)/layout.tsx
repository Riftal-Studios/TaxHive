import { MUILayout } from '@/components/mui-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ErrorBoundary } from '@/components/error-boundary'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  
  return (
    <MUILayout user={session?.user}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </MUILayout>
  )
}