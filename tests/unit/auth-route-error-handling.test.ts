import { describe, it, expect, vi } from 'vitest'
import { GET, POST } from '@/app/api/auth/[...nextauth]/route'

// Mock NextAuth
vi.mock('next-auth', () => {
  return {
    default: vi.fn(() => {
      return vi.fn().mockImplementation(() => {
        throw new Error('Simulated NextAuth error')
      })
    }),
  }
})

describe('NextAuth Route Error Handling', () => {
  it('should return proper JSON error response when NextAuth throws', async () => {
    const mockRequest = new Request('http://localhost:3000/api/auth/signin/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
      }),
    })

    const response = await POST(mockRequest)

    expect(response.status).toBe(500)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const body = await response.json()
    expect(body).toEqual({
      error: 'Internal server error',
      message: 'An error occurred during authentication',
    })
  })

  it('should handle GET requests with error handling', async () => {
    const mockRequest = new Request('http://localhost:3000/api/auth/session', {
      method: 'GET',
    })

    const response = await GET(mockRequest)

    expect(response.status).toBe(500)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const body = await response.json()
    expect(body).toEqual({
      error: 'Internal server error',
      message: 'An error occurred during authentication',
    })
  })
})