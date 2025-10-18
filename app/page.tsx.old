import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function Home() {
  const session = await getServerSession(authOptions)
  
  if (session) {
    // Check if user needs onboarding
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingCompleted: true }
    })
    
    if (user && !user.onboardingCompleted) {
      redirect('/onboarding')
    } else {
      redirect('/dashboard')
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          TaxHive
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          GST-Compliant Invoice Management for Indian Businesses
        </p>
        <div className="text-center">
          <Link
            href="/auth/signin"
            className="inline-block rounded-md bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  )
}