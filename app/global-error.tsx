'use client'

import { useEffect, useState } from 'react'

/**
 * Log critical error details
 */
function logCriticalError(error: Error & { digest?: string }) {
  const errorDetails = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    digest: error.digest,
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    timestamp: new Date().toISOString(),
  }

  console.error('=== CRITICAL Global Error ===')
  console.error('Message:', errorDetails.message)
  console.error('Name:', errorDetails.name)
  console.error('Digest:', errorDetails.digest)
  console.error('URL:', errorDetails.url)
  console.error('Timestamp:', errorDetails.timestamp)
  console.error('Stack:', errorDetails.stack)
  console.error('=============================')
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    logCriticalError(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem'
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            textAlign: 'center'
          }}>
            <h1 style={{
              fontSize: '3.75rem',
              fontWeight: 'bold',
              color: '#dc2626',
              marginBottom: '1rem'
            }}>
              Error
            </h1>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '1rem'
            }}>
              Something went wrong
            </h2>
            <p style={{
              color: '#6b7280',
              marginBottom: '2rem'
            }}>
              An unexpected error occurred. Please try again.
            </p>
            {error.digest && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                Error ID: <code style={{ backgroundColor: '#e5e7eb', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>{error.digest}</code>
              </p>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontWeight: '500',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Try again
              </button>
              <a
                href="/dashboard"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#4b5563',
                  color: 'white',
                  fontWeight: '500',
                  borderRadius: '0.5rem',
                  textDecoration: 'none'
                }}
              >
                Go to Dashboard
              </a>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                background: 'none',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              {showDetails ? 'Hide details' : 'Show error details'}
            </button>

            {showDetails && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f3f4f6',
                borderRadius: '0.5rem',
                textAlign: 'left',
                overflowX: 'auto'
              }}>
                <p style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: '#dc2626', marginBottom: '0.5rem' }}>
                  {error.name}: {error.message}
                </p>
                {error.stack && (
                  <pre style={{ fontSize: '0.75rem', color: '#4b5563', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
