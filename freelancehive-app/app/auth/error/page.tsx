'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: 'You do not have permission to sign in.',
    Verification: 'The sign in link is no longer valid. It may have been used already or it may have expired.',
    Default: 'An error occurred during authentication.',
  }

  const message = errorMessages[error || 'Default'] || errorMessages.Default

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <div className="text-6xl">❌</div>
          <h1 className="text-3xl font-bold">Authentication Error</h1>
          <p className="text-gray-600">{message}</p>
          <Link
            href="/auth/signin"
            className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Try again
          </Link>
        </div>
      </div>
    </div>
  )
}