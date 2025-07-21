'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { CURRENCY_CODES } from '@/lib/constants'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'exchange-rates'>('profile')
  
  const utils = api.useUtils()
  const { data: user } = api.users.getProfile.useQuery()
  const { data: exchangeRates } = api.admin.getLatestExchangeRates.useQuery()
  
  const updateProfileMutation = api.users.updateProfile.useMutation({
    onSuccess: () => {
      utils.users.getProfile.invalidate()
    },
  })
  
  const updateExchangeRatesMutation = api.admin.updateExchangeRates.useMutation({
    onSuccess: () => {
      utils.admin.getLatestExchangeRates.invalidate()
    },
  })

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    gstin: user?.gstin || '',
    pan: user?.pan || '',
    address: user?.address || '',
  })

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateProfileMutation.mutateAsync(profileForm)
  }

  const handleUpdateExchangeRates = async () => {
    await updateExchangeRatesMutation.mutateAsync()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your profile and system settings</p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'profile'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Profile & GST Details
              </button>
              <button
                onClick={() => setActiveTab('exchange-rates')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'exchange-rates'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Exchange Rates
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'profile' ? (
              <form onSubmit={handleProfileSubmit} className="space-y-6 max-w-2xl">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="gstin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    id="gstin"
                    value={profileForm.gstin}
                    onChange={(e) => setProfileForm({ ...profileForm, gstin: e.target.value })}
                    placeholder="29ABCDE1234F1Z5"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    15-character GST Identification Number
                  </p>
                </div>

                <div>
                  <label htmlFor="pan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    PAN
                  </label>
                  <input
                    type="text"
                    id="pan"
                    value={profileForm.pan}
                    onChange={(e) => setProfileForm({ ...profileForm, pan: e.target.value })}
                    placeholder="ABCDE1234F"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    10-character Permanent Account Number
                  </p>
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Business Address
                  </label>
                  <textarea
                    id="address"
                    rows={3}
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    {updateProfileMutation.isLoading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Exchange Rates</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Daily exchange rates are automatically updated at 9:00 AM IST
                    </p>
                  </div>
                  <button
                    onClick={handleUpdateExchangeRates}
                    disabled={updateExchangeRatesMutation.isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    {updateExchangeRatesMutation.isLoading ? 'Updating...' : 'Update Now'}
                  </button>
                </div>

                {updateExchangeRatesMutation.isSuccess && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                    <p className="text-green-800 dark:text-green-300">
                      Exchange rates updated successfully!
                    </p>
                  </div>
                )}

                {updateExchangeRatesMutation.isError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                    <p className="text-red-800 dark:text-red-300">
                      Failed to update exchange rates. Please try again later.
                    </p>
                  </div>
                )}

                <div className="overflow-hidden shadow ring-1 ring-black dark:ring-gray-700 ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Currency
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Rate (1 {' '} = ₹)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Source
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Last Updated
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {exchangeRates?.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                            No exchange rates available. Click "Update Now" to fetch rates.
                          </td>
                        </tr>
                      ) : (
                        exchangeRates?.map((rate) => (
                          <tr key={rate.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {rate.currency}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              ₹{Number(rate.rate).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {rate.source}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {new Date(rate.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}