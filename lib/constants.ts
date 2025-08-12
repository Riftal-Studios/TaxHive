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
// Based on GST Classification Scheme for Services
export const SAC_HSN_CODES = [
  // Group 99831 - Management consulting and management services; IT services
  { code: '998311', description: 'Management consulting and management services' },
  { code: '99831100', description: 'Management consulting and management services' },
  { code: '998312', description: 'Business consulting services' },
  { code: '99831200', description: 'Business consulting services including public relations' },
  { code: '998313', description: 'IT consulting and support services' },
  { code: '99831300', description: 'Information technology (IT) consulting and support services' },
  { code: '998314', description: 'IT design and development services' },
  { code: '99831400', description: 'Information technology (IT) design and development services' },
  { code: '998315', description: 'Hosting and IT infrastructure provisioning services' },
  { code: '99831500', description: 'Hosting and information technology (IT) infrastructure provisioning services' },
  { code: '998316', description: 'IT infrastructure and network management services' },
  { code: '99831600', description: 'IT infrastructure and network management services' },
  { code: '998319', description: 'Other information technology services' },
  { code: '99831900', description: 'Other information technology services n.e.c' },
  
  // Group 99832 - Architectural services
  { code: '998321', description: 'Architectural advisory services' },
  { code: '99832100', description: 'Architectural advisory services' },
  { code: '998322', description: 'Architectural services for residential buildings' },
  { code: '99832200', description: 'Architectural services for residential building projects' },
  { code: '998323', description: 'Architectural services for non-residential buildings' },
  { code: '99832300', description: 'Architectural services for non-residential building projects' },
  
  // Group 99833 - Engineering services
  { code: '998331', description: 'Engineering advisory services' },
  { code: '99833100', description: 'Engineering advisory services' },
  { code: '998332', description: 'Engineering services for building projects' },
  { code: '99833200', description: 'Engineering services for building projects' },
  { code: '998333', description: 'Engineering services for industrial projects' },
  { code: '99833300', description: 'Engineering services for industrial and manufacturing projects' },
  { code: '998339', description: 'Project management services for construction' },
  { code: '99833900', description: 'Project management services for construction projects' },
  
  // Group 99834 - Scientific and other technical services
  { code: '998346', description: 'Technical testing and analysis services' },
  { code: '99834600', description: 'Technical testing and analysis services' },
  { code: '998349', description: 'Other technical and scientific services' },
  { code: '99834900', description: 'Other technical and scientific services n.e.c.' },
  
  // Group 99836 - Advertising services
  { code: '998361', description: 'Advertising Services' },
  { code: '99836100', description: 'Advertising Services' },
  { code: '998365', description: 'Sale of Internet advertising space' },
  { code: '99836500', description: 'Sale of Internet advertising space' },
  
  // Group 99839 - Other professional, technical and business services
  { code: '998391', description: 'Specialty design services' },
  { code: '99839100', description: 'Specialty design services including interior, fashion, industrial design' },
  { code: '998392', description: 'Design originals' },
  { code: '99839200', description: 'Design originals' },
  { code: '998393', description: 'Scientific and technical consulting services' },
  { code: '99839300', description: 'Scientific and technical consulting services' },
  { code: '998395', description: 'Translation and interpretation services' },
  { code: '99839500', description: 'Translation and interpretation services' },
  { code: '998396', description: 'Trademarks and franchises' },
  { code: '99839600', description: 'Trademarks and franchises' },
  { code: '998399', description: 'Other professional services' },
  { code: '99839900', description: 'Other professional, technical and business services n.e.c.' },
  
  // Group 99841 - Telecommunications services
  { code: '998414', description: 'Private network services' },
  { code: '99841400', description: 'Private network services' },
  { code: '998415', description: 'Data transmission services' },
  { code: '99841500', description: 'Data transmission services' },
  
  // Group 99842 - Internet telecommunications services
  { code: '998422', description: 'Internet access services' },
  { code: '99842200', description: 'Internet access services in wired and wireless mode' },
  { code: '998429', description: 'Other Internet telecommunications services' },
  { code: '99842900', description: 'Other Internet telecommunications services n.e.c.' },
  
  // Group 99843 - Online content services
  { code: '998431', description: 'Online text based information' },
  { code: '99843100', description: 'Online text based information (books, newspapers, directories)' },
  { code: '998434', description: 'Software downloads' },
  { code: '99843400', description: 'Software downloads' },
  { code: '998439', description: 'Other online content' },
  { code: '99843900', description: 'Other online contents n.e.c.' },
  
  // Legacy codes for backward compatibility
  { code: '99831110', description: 'Website development services' },
  { code: '99831120', description: 'Web design services' },
  { code: '99831130', description: 'IT consulting services' },
  { code: '99831140', description: 'Software design services' },
  { code: '99831150', description: 'Software development services' },
  { code: '99831160', description: 'Software implementation services' },
  { code: '99831170', description: 'Software testing services' },
  { code: '99831180', description: 'Software maintenance services' },
  { code: '99831190', description: 'IT design and development services' },
  { code: '99831210', description: 'Data processing services' },
  { code: '99831220', description: 'Data analytics services' },
  { code: '99831230', description: 'Database management services' },
  { code: '99831240', description: 'Data warehousing services' },
  { code: '99831310', description: 'Cloud computing services' },
  { code: '99831320', description: 'Infrastructure as a service (IaaS)' },
  { code: '99831330', description: 'Platform as a service (PaaS)' },
  { code: '99831340', description: 'Software as a service (SaaS)' },
  { code: '99831410', description: 'Mobile application development' },
  { code: '99831420', description: 'Mobile app design services' },
  { code: '99831430', description: 'Mobile app testing services' },
] as const

export type SACHSNCode = typeof SAC_HSN_CODES[number]