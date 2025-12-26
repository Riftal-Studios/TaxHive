'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Log error details to console and potentially to a remote service
 */
function logError(error: Error & { digest?: string }, errorInfo?: { componentStack?: string }) {
  // Detailed error logging
  const errorDetails = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    digest: error.digest,
    componentStack: errorInfo?.componentStack,
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    timestamp: new Date().toISOString(),
  }

  console.error('=== Application Error ===')
  console.error('Message:', errorDetails.message)
  console.error('Name:', errorDetails.name)
  console.error('Digest:', errorDetails.digest)
  console.error('URL:', errorDetails.url)
  console.error('Timestamp:', errorDetails.timestamp)
  console.error('Stack:', errorDetails.stack)
  if (errorDetails.componentStack) {
    console.error('Component Stack:', errorDetails.componentStack)
  }
  console.error('=========================')

  // TODO: Send to error reporting service (e.g., Sentry, LogRocket)
  // fetch('/api/log-error', { method: 'POST', body: JSON.stringify(errorDetails) })
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    logError(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-6xl font-bold text-red-600 dark:text-red-500 mb-4">
          Error
        </h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Something went wrong
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          An unexpected error occurred. Please try again.
        </p>

        {error.digest && (
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            Error ID: <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{error.digest}</code>
          </p>
        )}

        <div className="flex gap-4 justify-center mb-6">
          <button
            onClick={reset}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
        >
          {showDetails ? 'Hide details' : 'Show error details'}
        </button>

        {showDetails && (
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left overflow-x-auto">
            <p className="text-sm font-mono text-red-600 dark:text-red-400 mb-2">
              {error.name}: {error.message}
            </p>
            {error.stack && (
              <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
                {error.stack}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
