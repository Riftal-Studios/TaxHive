'use client'

import { api } from '@/lib/trpc/client'

export default function TestOnboardingPage() {
  const { data: status, isLoading, refetch } = api.users.getOnboardingStatus.useQuery()
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Onboarding Status Test</h1>
      
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
            <pre>{JSON.stringify(status, null, 2)}</pre>
          </div>
          
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refetch Status
          </button>
          
          <div>
            <p>Completed: {status?.completed ? 'Yes' : 'No'}</p>
            <p>Current Step: {status?.currentStep}</p>
            <p>Progress: {status?.progress}%</p>
          </div>
        </div>
      )}
    </div>
  )
}