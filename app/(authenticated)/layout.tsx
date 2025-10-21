import { MUILayout } from '@/components/mui-layout'
import { FeedbackButton } from '@/components/feedback/FeedbackButton'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <MUILayout user={session?.user}>
      {children}
      <FeedbackButton />
    </MUILayout>
  )
}