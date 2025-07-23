import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useRouter } from 'next/navigation'
import OnboardingPage from '@/app/(authenticated)/onboarding/page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock tRPC
vi.mock('@/lib/trpc/client', () => ({
  api: {
    users: {
      getOnboardingStatus: {
        useQuery: vi.fn(),
      },
      completeOnboarding: {
        useMutation: vi.fn(),
      },
      skipOnboarding: {
        useMutation: vi.fn(),
      },
    },
  },
}))

import { api } from '@/lib/trpc/client'

describe('Onboarding Buttons', () => {
  const mockPush = vi.fn()
  const mockMutateAsync = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    } as any)
  })

  it('should show Complete Setup button when all required steps are completed', () => {
    vi.mocked(api.users.getOnboardingStatus.useQuery).mockReturnValue({
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
    } as any)

    vi.mocked(api.users.completeOnboarding.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any)

    vi.mocked(api.users.skipOnboarding.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any)

    render(<OnboardingPage />)

    const completeButton = screen.getByText('Complete Setup')
    expect(completeButton).toBeInTheDocument()
    expect(completeButton).not.toBeDisabled()
  })

  it('should disable Complete Setup button when not all required steps are completed', () => {
    vi.mocked(api.users.getOnboardingStatus.useQuery).mockReturnValue({
      data: {
        completed: false,
        currentStep: 'client',
        progress: 25,
        steps: {
          profile: { completed: true, required: true },
          client: { completed: false, required: true },
          lut: { completed: false, required: true },
          invoice: { completed: false, required: false },
        },
      },
      isLoading: false,
    } as any)

    vi.mocked(api.users.completeOnboarding.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any)

    vi.mocked(api.users.skipOnboarding.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any)

    render(<OnboardingPage />)

    const completeButton = screen.getByText('Complete Setup')
    expect(completeButton).toBeInTheDocument()
    expect(completeButton).toBeDisabled()
  })

  it('should call completeOnboarding mutation when Complete Setup is clicked', async () => {
    const mockCompleteOnboarding = vi.fn().mockResolvedValue({})
    
    vi.mocked(api.users.getOnboardingStatus.useQuery).mockReturnValue({
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
    } as any)

    vi.mocked(api.users.completeOnboarding.useMutation).mockReturnValue({
      mutateAsync: mockCompleteOnboarding,
      isPending: false,
    } as any)

    vi.mocked(api.users.skipOnboarding.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any)

    render(<OnboardingPage />)

    const completeButton = screen.getByText('Complete Setup')
    fireEvent.click(completeButton)

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalled()
    })
  })

  it('should show Skip onboarding link', () => {
    vi.mocked(api.users.getOnboardingStatus.useQuery).mockReturnValue({
      data: {
        completed: false,
        currentStep: 'profile',
        progress: 0,
        steps: {
          profile: { completed: false, required: true },
          client: { completed: false, required: true },
          lut: { completed: false, required: true },
          invoice: { completed: false, required: false },
        },
      },
      isLoading: false,
    } as any)

    vi.mocked(api.users.completeOnboarding.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any)

    vi.mocked(api.users.skipOnboarding.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any)

    render(<OnboardingPage />)

    const skipLink = screen.getByText('Skip onboarding')
    expect(skipLink).toBeInTheDocument()
  })

  it('should show skip confirmation modal when Skip onboarding is clicked', async () => {
    vi.mocked(api.users.getOnboardingStatus.useQuery).mockReturnValue({
      data: {
        completed: false,
        currentStep: 'profile',
        progress: 0,
        steps: {
          profile: { completed: false, required: true },
          client: { completed: false, required: true },
          lut: { completed: false, required: true },
          invoice: { completed: false, required: false },
        },
      },
      isLoading: false,
    } as any)

    vi.mocked(api.users.completeOnboarding.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any)

    vi.mocked(api.users.skipOnboarding.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any)

    render(<OnboardingPage />)

    const skipLink = screen.getByText('Skip onboarding')
    fireEvent.click(skipLink)

    await waitFor(() => {
      expect(screen.getByText('Skip Onboarding?')).toBeInTheDocument()
      expect(screen.getByText('Skip for Now')).toBeInTheDocument()
    })
  })
})