'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { format } from 'date-fns'
import { zodErrorsToFormErrors } from '@/lib/utils/zod-error-handler'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'

interface LUTFormData {
  lutNumber: string
  lutDate: string
  validFrom: string
  validTill: string
  [key: string]: unknown
}

export default function LUTManagement() {
  const [showForm, setShowForm] = useState(false)
  const [editingLUT, setEditingLUT] = useState<string | null>(null)
  const [formData, setFormData] = useState<LUTFormData>({
    lutNumber: '',
    lutDate: '',
    validFrom: '',
    validTill: '',
  })
  const [errors, setErrors] = useState<Partial<LUTFormData>>({})

  const utils = api.useUtils()
  const { data: luts, isLoading } = api.luts.list.useQuery()

  const createLUTMutation = api.luts.create.useMutation({
    onSuccess: () => {
      utils.luts.list.invalidate()
      setShowForm(false)
      resetForm()
    },
    onError: (error) => {
      if (error.data?.zodError) {
        const formErrors = zodErrorsToFormErrors<LUTFormData>(error.data.zodError)
        setErrors(formErrors)
      }
    },
  })

  const updateLUTMutation = api.luts.update.useMutation({
    onSuccess: () => {
      utils.luts.list.invalidate()
      setEditingLUT(null)
      resetForm()
    },
    onError: (error) => {
      if (error.data?.zodError) {
        const formErrors = zodErrorsToFormErrors<LUTFormData>(error.data.zodError)
        setErrors(formErrors)
      }
    },
  })

  const deleteLUTMutation = api.luts.delete.useMutation({
    onSuccess: () => {
      utils.luts.list.invalidate()
    },
  })

  const toggleActiveMutation = api.luts.toggleActive.useMutation({
    onSuccess: () => {
      utils.luts.list.invalidate()
    },
  })

  const resetForm = () => {
    setFormData({
      lutNumber: '',
      lutDate: '',
      validFrom: '',
      validTill: '',
    })
    setErrors({})
  }

  const handleEdit = (lut: {
    id: string
    lutNumber: string
    lutDate: Date
    validFrom: Date
    validTill: Date
  }) => {
    setEditingLUT(lut.id)
    setFormData({
      lutNumber: lut.lutNumber,
      lutDate: format(new Date(lut.lutDate), 'yyyy-MM-dd'),
      validFrom: format(new Date(lut.validFrom), 'yyyy-MM-dd'),
      validTill: format(new Date(lut.validTill), 'yyyy-MM-dd'),
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Parse dates consistently to avoid timezone issues
    const parseDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day, 12, 0, 0) // Set to noon to avoid timezone issues
    }

    const data = {
      lutNumber: formData.lutNumber,
      lutDate: parseDate(formData.lutDate),
      validFrom: parseDate(formData.validFrom),
      validTill: parseDate(formData.validTill),
    }

    // Client-side validation
    const validationErrors: Record<string, string> = {}
    
    if (data.validFrom > data.validTill) {
      validationErrors.validFrom = 'Valid from date must be before or on valid till date'
      validationErrors.validTill = 'Valid till date must be after or on valid from date'
    }
    
    if (data.lutDate > data.validFrom) {
      validationErrors.lutDate = 'LUT date must be before or on valid from date'
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    if (editingLUT) {
      await updateLUTMutation.mutateAsync({
        id: editingLUT,
        ...data,
      })
    } else {
      await createLUTMutation.mutateAsync(data)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this LUT? This action cannot be undone.')) {
      await deleteLUTMutation.mutateAsync({ id })
    }
  }

  const handleToggleActive = async (id: string) => {
    await toggleActiveMutation.mutateAsync({ id })
  }

  const handleFieldChange = (field: keyof LUTFormData, value: string) => {
    setFormData({ ...formData, [field]: value })
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Letter of Undertaking (LUT)</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your LUT details for zero-rated GST exports
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true)
              setEditingLUT(null)
              resetForm()
            }}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add LUT
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
            {editingLUT ? 'Edit LUT' : 'Add New LUT'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lutNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  LUT Number *
                </label>
                <input
                  type="text"
                  id="lutNumber"
                  value={formData.lutNumber}
                  onChange={(e) => handleFieldChange('lutNumber', e.target.value)}
                  placeholder="e.g., AD290320241234567"
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white ${
                    errors.lutNumber ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  required
                />
                {errors.lutNumber && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.lutNumber}</p>
                )}
              </div>

              <div>
                <label htmlFor="lutDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  LUT Date *
                </label>
                <input
                  type="date"
                  id="lutDate"
                  value={formData.lutDate}
                  onChange={(e) => handleFieldChange('lutDate', e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white ${
                    errors.lutDate ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  required
                />
                {errors.lutDate && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.lutDate}</p>
                )}
              </div>

              <div>
                <label htmlFor="validFrom" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Valid From *
                </label>
                <input
                  type="date"
                  id="validFrom"
                  value={formData.validFrom}
                  onChange={(e) => handleFieldChange('validFrom', e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white ${
                    errors.validFrom ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  required
                />
                {errors.validFrom && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.validFrom}</p>
                )}
              </div>

              <div>
                <label htmlFor="validTill" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Valid Till *
                </label>
                <input
                  type="date"
                  id="validTill"
                  value={formData.validTill}
                  onChange={(e) => handleFieldChange('validTill', e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white ${
                    errors.validTill ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  required
                />
                {errors.validTill && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.validTill}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingLUT(null)
                  resetForm()
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLUTMutation.isPending || updateLUTMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
              >
                {createLUTMutation.isPending || updateLUTMutation.isPending 
                  ? 'Saving...' 
                  : editingLUT ? 'Update LUT' : 'Add LUT'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden shadow ring-1 ring-black dark:ring-gray-700 ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                LUT Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                LUT Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Valid From
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Valid Till
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {!luts || luts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No LUTs found. Add your first LUT to get started.
                </td>
              </tr>
            ) : (
              luts.map((lut) => {
                const isExpired = new Date(lut.validTill) < new Date()
                
                return (
                  <tr key={lut.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(lut.id)}
                        className="inline-flex items-center"
                        title={lut.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {lut.isActive ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 text-gray-400" />
                        )}
                        <span className={`ml-2 text-sm ${
                          lut.isActive 
                            ? 'text-green-600 dark:text-green-400 font-medium' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {lut.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {lut.lutNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(lut.lutDate), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(lut.validFrom), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={isExpired ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>
                        {format(new Date(lut.validTill), 'dd MMM yyyy')}
                        {isExpired && ' (Expired)'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(lut)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-3"
                      >
                        <PencilIcon className="h-4 w-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(lut.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <TrashIcon className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {deleteLUTMutation.isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-red-800 dark:text-red-300">
            {deleteLUTMutation.error?.message || 'Failed to delete LUT. It may be referenced by invoices.'}
          </p>
        </div>
      )}
    </div>
  )
}