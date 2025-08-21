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
  { code: '99831100', description: 'Management consulting and management services' },
  { code: '99831200', description: 'Business consulting services including public relations' },
  { code: '99831300', description: 'Information technology (IT) consulting and support services' },
  { code: '99831400', description: 'Information technology (IT) design and development services' },
  { code: '99831500', description: 'Hosting and information technology (IT) infrastructure provisioning services' },
  { code: '99831600', description: 'IT infrastructure and network management services' },
  { code: '99831900', description: 'Other information technology services n.e.c' },
  
  // Group 99832 - Architectural services
  { code: '99832100', description: 'Architectural advisory services' },
  { code: '99832200', description: 'Architectural services for residential building projects' },
  { code: '99832300', description: 'Architectural services for non-residential building projects' },
  
  // Group 99833 - Engineering services
  { code: '99833100', description: 'Engineering advisory services' },
  { code: '99833200', description: 'Engineering services for building projects' },
  { code: '99833300', description: 'Engineering services for industrial and manufacturing projects' },
  { code: '99833900', description: 'Project management services for construction projects' },
  
  // Group 99834 - Scientific and other technical services
  { code: '99834600', description: 'Technical testing and analysis services' },
  { code: '99834900', description: 'Other technical and scientific services n.e.c.' },
  
  // Group 99836 - Advertising services
  { code: '99836100', description: 'Advertising Services' },
  { code: '99836500', description: 'Sale of Internet advertising space' },
  
  // Group 99839 - Other professional, technical and business services
  { code: '99839100', description: 'Specialty design services including interior, fashion, industrial design' },
  { code: '99839200', description: 'Design originals' },
  { code: '99839300', description: 'Scientific and technical consulting services' },
  { code: '99839500', description: 'Translation and interpretation services' },
  { code: '99839600', description: 'Trademarks and franchises' },
  { code: '99839900', description: 'Other professional, technical and business services n.e.c.' },
  
  // Group 99841 - Telecommunications services
  { code: '99841400', description: 'Private network services' },
  { code: '99841500', description: 'Data transmission services' },
  
  // Group 99842 - Internet telecommunications services
  { code: '99842200', description: 'Internet access services in wired and wireless mode' },
  { code: '99842900', description: 'Other Internet telecommunications services n.e.c.' },
  
  // Group 99843 - Online content services
  { code: '99843100', description: 'Online text based information (books, newspapers, directories)' },
  { code: '99843400', description: 'Software downloads' },
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

// Indian states for forms and dropdowns
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh (New)' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
] as const

export type IndianState = typeof INDIAN_STATES[number]