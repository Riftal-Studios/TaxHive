'use client'

import { useState, useEffect } from 'react'
import type { Client } from '@prisma/client'
import { getCurrencyFromCountry, getSupportedCurrencies } from '@/lib/invoice-utils'

interface ClientFormProps {
  client?: Partial<Client>
  onSubmit: (data: ClientFormData) => void | Promise<void>
  onCancel: () => void
}

export interface ClientFormData {
  name: string
  email: string
  company: string
  address: string
  country: string
  currency: string
  phone: string
  taxId: string
}

interface FormErrors {
  name?: string
  email?: string
  address?: string
  country?: string
}

export function ClientForm({ client, onSubmit, onCancel }: ClientFormProps) {
  const [formData, setFormData] = useState<ClientFormData>({
    name: client?.name || '',
    email: client?.email || '',
    company: client?.company || '',
    address: client?.address || '',
    country: client?.country || '',
    currency: client?.currency || 'USD',
    phone: client?.phone || '',
    taxId: client?.taxId || '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const currencyOptions = getSupportedCurrencies()

  // Auto-update currency when country changes
  useEffect(() => {
    if (formData.country && !client?.currency) {
      const detectedCurrency = getCurrencyFromCountry(formData.country)
      setFormData(prev => ({ ...prev, currency: detectedCurrency }))
    }
  }, [formData.country, client?.currency])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address'
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required'
    }
    
    if (!formData.country.trim()) {
      newErrors.country = 'Country is required'
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
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            errors.name 
              ? 'border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
        )}
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
          className={`mt-1 block w-full rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            errors.email 
              ? 'border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
          }`}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Company
        </label>
        <input
          type="text"
          id="company"
          name="company"
          value={formData.company}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Address
        </label>
        <textarea
          id="address"
          name="address"
          rows={3}
          value={formData.address}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            errors.address 
              ? 'border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
          }`}
        />
        {errors.address && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.address}</p>
        )}
      </div>

      <div>
        <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Country
        </label>
        <input
          type="text"
          id="country"
          name="country"
          value={formData.country}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            errors.country
              ? 'border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
          }`}
        />
        {errors.country && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.country}</p>
        )}
      </div>

      <div>
        <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Currency
        </label>
        <select
          id="currency"
          name="currency"
          value={formData.currency}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          {currencyOptions.map(curr => (
            <option key={curr.code} value={curr.code}>
              {curr.code} - {curr.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Auto-detected from country. You can change if needed.
        </p>
      </div>

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
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="taxId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Tax ID
        </label>
        <input
          type="text"
          id="taxId"
          name="taxId"
          value={formData.taxId}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

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
          {isSubmitting ? 'Saving...' : 'Save Client'}
        </button>
      </div>
    </form>
  )
}