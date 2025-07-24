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

// Common SAC/HSN codes for software exports
export const SAC_HSN_CODES = [
  // IT and Software Development Services
  { code: '99831190', description: 'IT design and development services' },
  { code: '99831140', description: 'Software design services' },
  { code: '99831150', description: 'Software development services' },
  { code: '99831160', description: 'Software implementation services' },
  { code: '99831170', description: 'Software testing services' },
  { code: '99831180', description: 'Software maintenance services' },
  { code: '99831130', description: 'IT consulting services' },
  { code: '99831400', description: 'Other IT support services' },
  
  // Web and Digital Services
  { code: '99831120', description: 'Web design services' },
  { code: '99831110', description: 'Website development services' },
  { code: '99832100', description: 'Digital content development' },
  { code: '99832200', description: 'E-commerce platform services' },
  
  // Cloud and Infrastructure
  { code: '99831310', description: 'Cloud computing services' },
  { code: '99831320', description: 'Infrastructure as a service (IaaS)' },
  { code: '99831330', description: 'Platform as a service (PaaS)' },
  { code: '99831340', description: 'Software as a service (SaaS)' },
  
  // Data and Analytics
  { code: '99831210', description: 'Data processing services' },
  { code: '99831220', description: 'Data analytics services' },
  { code: '99831230', description: 'Database management services' },
  { code: '99831240', description: 'Data warehousing services' },
  
  // Mobile App Development
  { code: '99831410', description: 'Mobile application development' },
  { code: '99831420', description: 'Mobile app design services' },
  { code: '99831430', description: 'Mobile app testing services' },
  
  // Other Professional Services
  { code: '99832110', description: 'Business consulting services' },
  { code: '99832120', description: 'Management consulting services' },
  { code: '99832130', description: 'Technical consulting services' },
  { code: '99833100', description: 'Engineering design services' },
  { code: '99833200', description: 'Architectural design services' },
  { code: '99834100', description: 'Marketing services' },
  { code: '99834200', description: 'Advertising services' },
] as const

export type SACHSNCode = typeof SAC_HSN_CODES[number]