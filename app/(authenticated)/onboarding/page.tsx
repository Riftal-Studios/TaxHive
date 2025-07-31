'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid'
import { useSession } from 'next-auth/react'

type OnboardingStep = 'profile' | 'client' | 'lut' | 'invoice' | 'complete'
type OnboardingStepWithData = Exclude<OnboardingStep, 'complete'>

const STEP_TITLES = {
  profile: 'Complete Your Profile',
  client: 'Add Your First Client',
  lut: 'Set Up LUT Details',
  invoice: 'Create Your First Invoice',
  complete: 'All Set!',
} as const

const STEP_DESCRIPTIONS = {
  profile: 'Add your business details including GSTIN and PAN for GST compliance',
  client: 'Add details of your international client for invoicing',
  lut: 'Add your Letter of Undertaking for zero-rated GST exports',
  invoice: 'Create your first export invoice (optional)',
  complete: 'Your GSTHive account is ready to use!',
} as const

export default function OnboardingPage() {
  const router = useRouter()
  const { update } = useSession()
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  
  const { data: status, isLoading } = api.users.getOnboardingStatus.useQuery()
  const completeOnboardingMutation = api.users.completeOnboarding.useMutation({
    onSuccess: async () => {
      console.log('Complete onboarding success - updating session and navigating')
      // Force session update to refresh the JWT token
      await update()
      // Use router.refresh() to ensure middleware re-evaluates
      router.refresh()
      // Navigate to dashboard
      router.push('/dashboard')
    },
    onError: (error) => {
      console.error('Complete onboarding error:', error)
    },
  })
  const skipOnboardingMutation = api.users.skipOnboarding.useMutation({
    onSuccess: async () => {
      console.log('Skip onboarding success - updating session and navigating')
      // Force session update to refresh the JWT token
      await update()
      // Use router.refresh() to ensure middleware re-evaluates
      router.refresh()
      // Navigate to dashboard
      router.push('/dashboard')
    },
    onError: (error) => {
      console.error('Skip onboarding error:', error)
    },
  })

  useEffect(() => {
    if (status?.completed && status.currentStep !== 'complete') {
      router.push('/dashboard')
    }
  }, [status, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!status) {
    return null
  }

  const handleComplete = async () => {
    console.log('handleComplete clicked')
    try {
      await completeOnboardingMutation.mutateAsync()
    } catch (error) {
      console.error('Error completing onboarding:', error)
    }
  }

  const handleSkip = async () => {
    console.log('handleSkip clicked')
    try {
      await skipOnboardingMutation.mutateAsync()
    } catch (error) {
      console.error('Error skipping onboarding:', error)
    }
  }

  const handleNavigate = (step: OnboardingStepWithData) => {
    // Use proper Next.js router.push instead of window.location.href
    switch (step) {
      case 'profile':
        router.push('/settings')
        break
      case 'client':
        router.push('/clients')
        break
      case 'lut':
        router.push('/settings?tab=lut')
        break
      case 'invoice':
        router.push('/invoices/new')
        break
    }
  }

  const orderedSteps: OnboardingStepWithData[] = ['profile', 'client', 'lut', 'invoice']
  const currentStepIndex = status.currentStep === 'complete' 
    ? orderedSteps.length 
    : orderedSteps.indexOf(status.currentStep as OnboardingStepWithData)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to GSTHive! 🎉
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Let&apos;s set up your account for GST-compliant export invoicing
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${status.progress}%` }}
            />
          </div>
          <p className="text-center mt-2 text-sm text-gray-600 dark:text-gray-400">
            {status.progress}% Complete
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {orderedSteps.map((step, index) => {
            const stepStatus = status.steps[step]
            const isCurrentStep = step === status.currentStep
            const isPastStep = index < currentStepIndex
            const isOptional = !stepStatus.required

            return (
              <div
                key={step}
                className={`relative rounded-lg border-2 p-6 transition-all ${
                  stepStatus.completed
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : isCurrentStep
                    ? 'border-indigo-500 bg-white dark:bg-gray-800 shadow-lg'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {stepStatus.completed ? (
                      <CheckCircleSolidIcon className="h-8 w-8 text-green-500" />
                    ) : (
                      <div
                        className={`h-8 w-8 rounded-full border-2 ${
                          isCurrentStep
                            ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-900'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <span
                          className={`flex h-full w-full items-center justify-center text-sm font-medium ${
                            isCurrentStep ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4 flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {STEP_TITLES[step]}
                          {isOptional && (
                            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                              (Optional)
                            </span>
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {STEP_DESCRIPTIONS[step]}
                        </p>
                      </div>
                      
                      {!stepStatus.completed && (isPastStep || isCurrentStep) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleNavigate(step)
                          }}
                          className="ml-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                        >
                          {isCurrentStep ? 'Start' : 'Continue'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowSkipConfirm(true)}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Skip onboarding
          </button>
          
          <button
            onClick={handleComplete}
            disabled={completeOnboardingMutation.isPending || 
              (!status.steps.profile.completed || !status.steps.client.completed || !status.steps.lut.completed)}
            className={`px-6 py-3 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 ${
              status.steps.profile.completed && status.steps.client.completed && status.steps.lut.completed
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {completeOnboardingMutation.isPending ? 'Completing...' : 'Complete Setup'}
          </button>
        </div>

        {/* Skip Confirmation Modal */}
        {showSkipConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Skip Onboarding?
                </h3>
                <button
                  onClick={() => setShowSkipConfirm(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                You can complete these steps later, but you&apos;ll need to add your profile details, 
                at least one client, and LUT information before creating invoices.
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowSkipConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Continue Setup
                </button>
                <button
                  onClick={handleSkip}
                  disabled={skipOnboardingMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {skipOnboardingMutation.isPending ? 'Skipping...' : 'Skip for Now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
