'use client'

import { useState } from 'react'
import type { UnregisteredSupplier } from '@prisma/client'

interface ForeignVendorFormProps {
  supplier?: Partial<UnregisteredSupplier>
  onSubmit: (data: ForeignVendorFormData) => void | Promise<void>
  onCancel: () => void
}

export interface ForeignVendorFormData {
  name: string
  address: string
  country: string
  countryName: string
  phone: string
  email: string
}

interface FormErrors {
  name?: string
  address?: string
  country?: string
  email?: string
}

// Common countries for foreign service providers (ISO codes)
// This matches the COMMON_COUNTRIES in the unregisteredSupplier router
const COUNTRY_OPTIONS = [
  { code: 'US', name: 'United States' },
  { code: 'DE', name: 'Germany' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
].sort((a, b) => a.name.localeCompare(b.name))

export function ForeignVendorForm({ supplier, onSubmit, onCancel }: ForeignVendorFormProps) {
  const [formData, setFormData] = useState<ForeignVendorFormData>({
    name: supplier?.name || '',
    address: supplier?.address || '',
    country: supplier?.country || '',
    countryName: supplier?.countryName || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateEmail = (email: string): boolean => {
    if (!email) return true // Email is optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Vendor name is required'
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required'
    }

    if (!formData.country) {
      newErrors.country = 'Country is required for Import of Services'
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
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    // Special handling for country dropdown - also set countryName
    if (name === 'country') {
      const selectedCountry = COUNTRY_OPTIONS.find(c => c.code === value)
      setFormData(prev => ({
        ...prev,
        country: value,
        countryName: selectedCountry?.name || '',
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }

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
      {/* Vendor Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Vendor Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., Amazon Web Services, Figma, GitHub"
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
          placeholder="Enter vendor's registered address"
          className={inputClassName(!!errors.address)}
        />
        {errors.address && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.address}</p>
        )}
      </div>

      {/* Country */}
      <div>
        <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Country <span className="text-red-500">*</span>
        </label>
        <select
          id="country"
          name="country"
          value={formData.country}
          onChange={handleChange}
          className={inputClassName(!!errors.country)}
        >
          <option value="">Select Country</option>
          {COUNTRY_OPTIONS.map(({ code, name }) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
        </select>
        {errors.country && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.country}</p>
        )}
        {formData.countryName && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            ISO Code: {formData.country}
          </p>
        )}
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
            placeholder="Enter phone number (optional)"
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
            placeholder="Enter email address (optional)"
            className={inputClassName(!!errors.email)}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
          )}
        </div>
      </div>

      {/* Info box about Import of Services */}
      <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Import of Services - RCM Applicable
            </h3>
            <div className="mt-2 text-sm text-amber-700 dark:text-amber-400">
              <p>
                Purchases from foreign service providers are subject to GST under Reverse Charge Mechanism
                (Section 5(3) of IGST Act). You must pay IGST on the service value and can claim ITC in the same return.
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Always IGST (no CGST/SGST split)</li>
                <li>Reports to GSTR-3B Table 3.1(a)</li>
                <li>Exchange rate as per RBI reference rate</li>
              </ul>
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
          {isSubmitting ? 'Saving...' : 'Save Foreign Vendor'}
        </button>
      </div>
    </form>
  )
}
