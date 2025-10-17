import { SAC_HSN_CODES } from '@/lib/constants'

/**
 * Get the current fiscal year in format YYYY-YY
 * Indian fiscal year runs from April 1 to March 31
 */
export function getCurrentFiscalYear(date: Date = new Date()): string {
  const month = date.getMonth() // 0-indexed (0 = January, 3 = April)
  const year = date.getFullYear()
  
  if (month >= 3) { // April (3) or later
    return `${year}-${(year + 1).toString().slice(-2)}`
  } else { // January to March
    return `${year - 1}-${year.toString().slice(-2)}`
  }
}

/**
 * Get fiscal year from a date
 */
export function getFiscalYearFromDate(date: Date): string {
  return getCurrentFiscalYear(date)
}

/**
 * Generate invoice number in format FY{YY-YY}/{NUMBER}
 * e.g., FY24-25/001
 */
export function generateInvoiceNumber(fiscalYear: string, sequenceNumber: number): string {
  // Extract YY-YY from YYYY-YY format (e.g., "2024-25" -> "24-25")
  const yearParts = fiscalYear.split('-')
  const fyShort = yearParts[0].slice(-2) + '-' + yearParts[1]
  // Pad sequence number with zeros (minimum 3 digits)
  const paddedNumber = sequenceNumber.toString().padStart(3, '0')
  return `FY${fyShort}/${paddedNumber}`
}

/**
 * Calculate due date based on payment terms (in days)
 */
export function calculateDueDate(invoiceDate: Date, paymentTerms: number): Date {
  const dueDate = new Date(invoiceDate)
  dueDate.setDate(dueDate.getDate() + paymentTerms)
  return dueDate
}

/**
 * Format currency based on currency code
 */
export function formatCurrency(amount: number, currency: string): string {
  const currencySymbols: Record<string, string> = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'CAD': 'C$',
    'AUD': 'A$',
    'JPY': '¥',
    'CNY': '¥',
    'SGD': 'S$'
  }
  
  const symbol = currencySymbols[currency] || currency + ' '
  
  // Special formatting for INR (Indian numbering system)
  if (currency === 'INR') {
    const formatter = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    return symbol + formatter.format(amount)
  }
  
  // Standard formatting for other currencies
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  
  return symbol + formatter.format(amount)
}

/**
 * Calculate line item amount
 */
export function calculateLineAmount(quantity: number, rate: number): number {
  return quantity * rate
}

/**
 * Calculate invoice subtotal from line items
 */
export function calculateSubtotal(lineItems: Array<{ quantity: number; rate: number }>): number {
  return lineItems.reduce((sum, item) => sum + calculateLineAmount(item.quantity, item.rate), 0)
}

/**
 * Calculate GST amount (0% for exports under LUT)
 */
export function calculateGST(subtotal: number, gstRate: number = 0): number {
  return subtotal * (gstRate / 100)
}

/**
 * Calculate total amount
 */
export function calculateTotal(subtotal: number, gstAmount: number = 0): number {
  return subtotal + gstAmount
}

/**
 * Convert amount from foreign currency to INR
 */
export function convertToINR(amount: number, exchangeRate: number): number {
  return amount * exchangeRate
}

/**
 * Validate HSN/SAC code against the official GST Classification Scheme
 */
export function validateHSNCode(code: string): boolean {
  return SAC_HSN_CODES.some(item => item.code === code)
}

/**
 * Get payment term options
 */
export function getPaymentTermOptions() {
  return [
    { value: 0, label: 'Due on Receipt' },
    { value: 7, label: 'Net 7' },
    { value: 15, label: 'Net 15' },
    { value: 30, label: 'Net 30' },
    { value: 45, label: 'Net 45' },
    { value: 60, label: 'Net 60' },
    { value: 90, label: 'Net 90' }
  ]
}

/**
 * Get supported currencies
 */
export function getSupportedCurrencies() {
  return [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' }
  ]
}

/**
 * Get currency code from country name
 * Returns the appropriate currency for a given country
 */
export function getCurrencyFromCountry(country: string): string {
  const normalized = country.toLowerCase().trim()

  // United States
  if (normalized.includes('united states') || normalized.includes('usa') || normalized === 'us') {
    return 'USD'
  }

  // Australia
  if (normalized.includes('australia') || normalized === 'au') {
    return 'AUD'
  }

  // United Kingdom
  if (normalized.includes('united kingdom') || normalized.includes('uk') || normalized === 'gb') {
    return 'GBP'
  }

  // Canada
  if (normalized.includes('canada') || normalized === 'ca') {
    return 'CAD'
  }

  // Singapore
  if (normalized.includes('singapore') || normalized === 'sg') {
    return 'SGD'
  }

  // UAE
  if (normalized.includes('uae') || normalized.includes('emirates') || normalized === 'ae') {
    return 'AED'
  }

  // Japan
  if (normalized.includes('japan') || normalized === 'jp') {
    return 'JPY'
  }

  // Switzerland
  if (normalized.includes('switzerland') || normalized === 'ch') {
    return 'CHF'
  }

  // New Zealand
  if (normalized.includes('new zealand') || normalized === 'nz') {
    return 'NZD'
  }

  // European Union countries
  const euroCountries = [
    'austria', 'belgium', 'cyprus', 'estonia', 'finland', 'france', 'germany',
    'greece', 'ireland', 'italy', 'latvia', 'lithuania', 'luxembourg', 'malta',
    'netherlands', 'portugal', 'slovakia', 'slovenia', 'spain',
    'at', 'be', 'cy', 'ee', 'fi', 'fr', 'de', 'gr', 'ie', 'it', 'lv', 'lt',
    'lu', 'mt', 'nl', 'pt', 'sk', 'si', 'es'
  ]

  if (euroCountries.some(c => normalized.includes(c) || normalized === c)) {
    return 'EUR'
  }

  // Default to USD
  return 'USD'
}

/**
 * Format amount in INR with Indian numbering system
 */
export function formatINR(amount: number): string {
  return formatCurrency(amount, 'INR')
}