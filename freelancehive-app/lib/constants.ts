export const INVOICE_STATUS = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PAID: 'PAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const

export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS]

export const GST_CONSTANTS = {
  PLACE_OF_SUPPLY_EXPORT: 'Outside India (Section 2-6)',
  IGST_RATE_EXPORT: 0,
  SERVICE_CODE_LENGTH_EXPORT: 8,
} as const

export const FISCAL_YEAR = {
  // Returns fiscal year in YYYY-YY format (e.g., 2024-25)
  getCurrent: () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1 // 0-indexed
    
    // Fiscal year in India starts on April 1st
    if (month >= 4) {
      return `${year}-${(year + 1).toString().slice(2)}`
    } else {
      return `${year - 1}-${year.toString().slice(2)}`
    }
  },
  
  // Validates fiscal year format
  validate: (fy: string) => {
    return /^\d{4}-\d{2}$/.test(fy)
  },
}

export const CURRENCY_CODES = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  CAD: 'CAD',
  AUD: 'AUD',
  SGD: 'SGD',
  AED: 'AED',
} as const

export type CurrencyCode = typeof CURRENCY_CODES[keyof typeof CURRENCY_CODES]