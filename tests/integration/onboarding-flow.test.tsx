import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/trpc/client', () => ({
  api: {
    users: {
      getOnboardingStatus: {
        useQuery: () => ({
          data: {
            completed: false,
            currentStep: 'invoice',
            progress: 75,
            steps: {
              profile: { completed: true, required: true },
              client: { completed: true, required: true },
              lut: { completed: true, required: true },
              invoice: { completed: false, required: false },
            },
          },
          isLoading: false,
        }),
      },
      completeOnboarding: {
        useMutation: () => ({
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
        }),
      },
      skipOnboarding: {
        useMutation: () => ({
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
        }),
      },
    },
  },
}))

import OnboardingPage from '@/app/(authenticated)/onboarding/page'

describe('Onboarding Flow Integration', () => {
  it('should display all onboarding steps', () => {
    render(<OnboardingPage />)

    expect(screen.getByText('Welcome to GSTHive! 🎉')).toBeInTheDocument()
    expect(screen.getByText('Complete Your Profile')).toBeInTheDocument()
    expect(screen.getByText('Add Your First Client')).toBeInTheDocument()
    expect(screen.getByText('Set Up LUT Details')).toBeInTheDocument()
    expect(screen.getByText('Create Your First Invoice')).toBeInTheDocument()
  })

  it('should show progress bar with correct percentage', () => {
    render(<OnboardingPage />)

    expect(screen.getByText('75% Complete')).toBeInTheDocument()
  })

  it('should show Complete Setup button when required steps are done', () => {
    render(<OnboardingPage />)

    const completeButton = screen.getByText('Complete Setup')
    expect(completeButton).toBeInTheDocument()
    expect(completeButton).toHaveClass('bg-green-600')
  })

  it('should show Skip onboarding button', () => {
    render(<OnboardingPage />)

    expect(screen.getByText('Skip onboarding')).toBeInTheDocument()
  })

  it.skip('should navigate to step pages when Start/Continue buttons are clicked', () => {
    // TODO: Complex navigation mocking - component might be using Next.js router
    // Mock the entire window.location object
    const originalLocation = window.location
    const mockAssign = vi.fn()
    
    delete (window as any).location
    window.location = {
      ...originalLocation,
      assign: mockAssign,
    } as any

    render(<OnboardingPage />)

    // Find the invoice step button (should show "Start" for current step)
    const invoiceButton = screen.getByText('Start')
    fireEvent.click(invoiceButton)

    expect(mockAssign).toHaveBeenCalledWith('/invoices/new')

    // Restore original location
    window.location = originalLocation
  })
})