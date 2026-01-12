'use client'

import { useState, useEffect } from 'react'
import type { UnregisteredSupplier } from '@prisma/client'
import { GST_STATE_CODES } from '@/lib/validations/gst'

interface UnregisteredSupplierFormProps {
  supplier?: Partial<UnregisteredSupplier>
  onSubmit: (data: UnregisteredSupplierFormData) => void | Promise<void>
  onCancel: () => void
}

export interface UnregisteredSupplierFormData {
  name: string
  address: string
  state: string
  stateCode: string
  pan: string
  pincode: string
  phone: string
  email: string
}

interface FormErrors {
  name?: string
  address?: string
  state?: string
  pan?: string
  email?: string
}

// Convert GST_STATE_CODES to sorted array for dropdown
const stateOptions = Object.entries(GST_STATE_CODES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function UnregisteredSupplierForm({ supplier, onSubmit, onCancel }: UnregisteredSupplierFormProps) {
  const [formData, setFormData] = useState<UnregisteredSupplierFormData>({
    name: supplier?.name || '',
    address: supplier?.address || '',
    state: supplier?.state || '',
    stateCode: supplier?.stateCode || '',
    pan: supplier?.pan || '',
    pincode: supplier?.pincode || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-update stateCode when state changes
  useEffect(() => {
    const selectedState = stateOptions.find(s => s.name === formData.state)
    if (selectedState) {
      setFormData(prev => ({ ...prev, stateCode: selectedState.code }))
    }
  }, [formData.state])

  const validatePAN = (pan: string): boolean => {
    if (!pan) return true // PAN is optional
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())
  }

  const validateEmail = (email: string): boolean => {
    if (!email) return true // Email is optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Supplier name is required'
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required'
    }

    if (!formData.state) {
      newErrors.state = 'State is required for GST compliance'
    }

    if (formData.pan && !validatePAN(formData.pan)) {
      newErrors.pan = 'Invalid PAN format (e.g., ABCDE1234F)'
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Invalid email address'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      // Ensure PAN is uppercase
      const submissionData = {
        ...formData,
        pan: formData.pan.toUpperCase(),
      }
      await onSubmit(submissionData)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const inputClassName = (hasError: boolean) => `
    mt-1 block w-full rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white
    ${hasError
      ? 'border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'}
  `

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Supplier Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Supplier Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter supplier name"
          className={inputClassName(!!errors.name)}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
        )}
      </div>

      {/* Address */}
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Address <span className="text-red-500">*</span>
        </label>
        <textarea
          id="address"
          name="address"
          rows={3}
          value={formData.address}
          onChange={handleChange}
          placeholder="Enter complete address"
          className={inputClassName(!!errors.address)}
        />
        {errors.address && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.address}</p>
        )}
      </div>

      {/* State and Pincode Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            State <span className="text-red-500">*</span>
          </label>
          <select
            id="state"
            name="state"
            value={formData.state}
            onChange={handleChange}
            className={inputClassName(!!errors.state)}
          >
            <option value="">Select State</option>
            {stateOptions.map(({ code, name }) => (
              <option key={code} value={name}>
                {name} ({code})
              </option>
            ))}
          </select>
          {errors.state && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.state}</p>
          )}
          {formData.stateCode && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              State Code: {formData.stateCode}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="pincode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Pincode
          </label>
          <input
            type="text"
            id="pincode"
            name="pincode"
            value={formData.pincode}
            onChange={handleChange}
            placeholder="Enter pincode"
            maxLength={6}
            className={inputClassName(false)}
          />
        </div>
      </div>

      {/* PAN */}
      <div>
        <label htmlFor="pan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          PAN
        </label>
        <input
          type="text"
          id="pan"
          name="pan"
          value={formData.pan}
          onChange={handleChange}
          placeholder="Enter PAN (optional)"
          maxLength={10}
          className={`${inputClassName(!!errors.pan)} uppercase`}
        />
        {errors.pan && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.pan}</p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Optional: PAN of the unregistered supplier
        </p>
      </div>

      {/* Phone and Email Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="Enter phone number"
            className={inputClassName(false)}
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter email address"
            className={inputClassName(!!errors.email)}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
          )}
        </div>
      </div>

      {/* Info box about unregistered suppliers */}
      <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Unregistered Supplier
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
              <p>
                This supplier is not registered under GST. For purchases from unregistered suppliers,
                you must issue a Self Invoice under RCM (Reverse Charge Mechanism) as per Section 31(3)(f)
                of the CGST Act, 2017.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Supplier'}
        </button>
      </div>
    </form>
  )
}
