'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
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
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
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
          </div>
        </div>
      </body>
    </html>
  )
}
