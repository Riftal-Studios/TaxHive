// TDS Section Configurations for India
export const TDS_SECTIONS = {
  '194C': {
    code: '194C',
    description: 'Payment to Contractors',
    individualRate: 1,
    companyRate: 2,
    hufRate: 1,
    thresholdLimit: 30000, // Single payment limit
    aggregateLimit: 100000, // Annual aggregate limit
    applicableFor: ['SERVICES', 'CONTRACTS'],
    natureOfPayment: [
      'Work contracts',
      'Labour contracts',
      'Advertising contracts',
      'Transport contracts',
      'Broadcasting and telecasting',
    ],
  },
  '194J': {
    code: '194J',
    description: 'Professional/Technical Services',
    individualRate: 10,
    companyRate: 10,
    hufRate: 10,
    thresholdLimit: 30000, // Annual limit
    aggregateLimit: 30000,
    applicableFor: ['SERVICES'],
    natureOfPayment: [
      'Professional fees',
      'Technical services',
      'Royalty',
      'Non-compete fees',
      'Director remuneration',
      'Consultancy fees',
    ],
  },
  '194H': {
    code: '194H',
    description: 'Commission/Brokerage',
    individualRate: 5,
    companyRate: 5,
    hufRate: 5,
    thresholdLimit: 15000, // Annual limit
    aggregateLimit: 15000,
    applicableFor: ['SERVICES'],
    natureOfPayment: [
      'Commission (except insurance)',
      'Brokerage',
      'Sales commission',
      'Agency commission',
    ],
  },
  '194I': {
    code: '194I',
    description: 'Rent',
    individualRate: 10, // For plant/machinery/equipment
    companyRate: 10,
    hufRate: 10,
    landBuildingRate: 10, // For land/building/furniture
    thresholdLimit: 240000, // Annual limit
    aggregateLimit: 240000,
    applicableFor: ['RENT'],
    natureOfPayment: [
      'Rent of land',
      'Rent of building',
      'Rent of plant and machinery',
      'Rent of equipment',
      'Rent of furniture and fittings',
    ],
  },
  '194IA': {
    code: '194IA',
    description: 'Property Purchase',
    individualRate: 1,
    companyRate: 1,
    hufRate: 1,
    thresholdLimit: 5000000, // Rs. 50 lakhs
    aggregateLimit: 5000000,
    applicableFor: ['PROPERTY'],
    natureOfPayment: [
      'Transfer of immovable property',
      'Sale of property',
    ],
  },
  '194IB': {
    code: '194IB',
    description: 'Rent by Individual/HUF',
    individualRate: 5,
    companyRate: 5,
    hufRate: 5,
    thresholdLimit: 50000, // Monthly limit
    aggregateLimit: 50000,
    applicableFor: ['RENT'],
    natureOfPayment: [
      'Rent paid by individual/HUF not liable to tax audit',
    ],
  },
  '194IC': {
    code: '194IC',
    description: 'Payment under Joint Development Agreement',
    individualRate: 10,
    companyRate: 10,
    hufRate: 10,
    thresholdLimit: 0, // No threshold
    aggregateLimit: 0,
    applicableFor: ['PROPERTY'],
    natureOfPayment: [
      'Payment under joint development agreement',
    ],
  },
  '194D': {
    code: '194D',
    description: 'Insurance Commission',
    individualRate: 5,
    companyRate: 10,
    hufRate: 5,
    thresholdLimit: 15000, // Annual limit
    aggregateLimit: 15000,
    applicableFor: ['SERVICES'],
    natureOfPayment: [
      'Insurance commission',
      'Commission on insurance business',
    ],
  },
  '194DA': {
    code: '194DA',
    description: 'Life Insurance Policy Maturity',
    individualRate: 5,
    companyRate: 5,
    hufRate: 5,
    thresholdLimit: 100000, // Annual limit
    aggregateLimit: 100000,
    applicableFor: ['INSURANCE'],
    natureOfPayment: [
      'Payment under life insurance policy',
    ],
  },
  '194E': {
    code: '194E',
    description: 'Payment to Non-Resident Sportsmen',
    individualRate: 20,
    companyRate: 20,
    hufRate: 20,
    thresholdLimit: 0, // No threshold
    aggregateLimit: 0,
    applicableFor: ['SERVICES'],
    natureOfPayment: [
      'Payment to non-resident sportsmen',
      'Payment to sports associations',
    ],
  },
  '194G': {
    code: '194G',
    description: 'Commission on Lottery Tickets',
    individualRate: 5,
    companyRate: 5,
    hufRate: 5,
    thresholdLimit: 15000, // Annual limit
    aggregateLimit: 15000,
    applicableFor: ['SERVICES'],
    natureOfPayment: [
      'Commission on sale of lottery tickets',
    ],
  },
  '194Q': {
    code: '194Q',
    description: 'Purchase of Goods',
    individualRate: 0.1,
    companyRate: 0.1,
    hufRate: 0.1,
    thresholdLimit: 5000000, // Rs. 50 lakhs annual
    aggregateLimit: 5000000,
    applicableFor: ['GOODS'],
    natureOfPayment: [
      'Purchase of goods exceeding Rs. 50 lakhs',
    ],
  },
  '194O': {
    code: '194O',
    description: 'E-commerce Participants',
    individualRate: 1,
    companyRate: 1,
    hufRate: 1,
    thresholdLimit: 500000, // Rs. 5 lakhs annual
    aggregateLimit: 500000,
    applicableFor: ['SERVICES', 'GOODS'],
    natureOfPayment: [
      'Payment to e-commerce participants',
      'Sale of goods or services through e-commerce',
    ],
  },
  '194N': {
    code: '194N',
    description: 'Cash Withdrawal',
    individualRate: 2,
    companyRate: 2,
    hufRate: 2,
    thresholdLimit: 10000000, // Rs. 1 crore (2% above 1 cr)
    aggregateLimit: 10000000,
    applicableFor: ['CASH'],
    natureOfPayment: [
      'Cash withdrawal exceeding Rs. 1 crore',
    ],
  },
} as const

export type TDSSectionCode = keyof typeof TDS_SECTIONS

export const VENDOR_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'HUF', label: 'HUF (Hindu Undivided Family)' },
  { value: 'FIRM', label: 'Partnership Firm' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'AOP', label: 'Association of Persons' },
  { value: 'BOI', label: 'Body of Individuals' },
] as const

export type VendorType = typeof VENDOR_TYPES[number]['value']

// Education Cess and Surcharge rates
export const TDS_CESS_RATE = 4 // 4% (Health and Education Cess)

export const SURCHARGE_RATES = {
  INDIVIDUAL: [
    { min: 5000000, max: 10000000, rate: 10 }, // 50L to 1Cr: 10%
    { min: 10000000, max: 20000000, rate: 15 }, // 1Cr to 2Cr: 15%
    { min: 20000000, max: 50000000, rate: 25 }, // 2Cr to 5Cr: 25%
    { min: 50000000, max: Infinity, rate: 37 }, // Above 5Cr: 37%
  ],
  COMPANY: [
    { min: 10000000, max: 100000000, rate: 7 }, // 1Cr to 10Cr: 7%
    { min: 100000000, max: Infinity, rate: 12 }, // Above 10Cr: 12%
  ],
  FOREIGN_COMPANY: [
    { min: 10000000, max: 100000000, rate: 2 }, // 1Cr to 10Cr: 2%
    { min: 100000000, max: Infinity, rate: 5 }, // Above 10Cr: 5%
  ],
}

// Financial Year and Quarter helpers
export function getCurrentFinancialYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  
  if (month >= 4) {
    return `FY${year.toString().slice(2)}-${(year + 1).toString().slice(2)}`
  } else {
    return `FY${(year - 1).toString().slice(2)}-${year.toString().slice(2)}`
  }
}

export function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1
  
  if (month >= 4 && month <= 6) return 'Q1'
  if (month >= 7 && month <= 9) return 'Q2'
  if (month >= 10 && month <= 12) return 'Q3'
  return 'Q4'
}

export function getQuarterMonths(quarter: string): { start: number; end: number } {
  switch (quarter) {
    case 'Q1': return { start: 4, end: 6 }
    case 'Q2': return { start: 7, end: 9 }
    case 'Q3': return { start: 10, end: 12 }
    case 'Q4': return { start: 1, end: 3 }
    default: return { start: 4, end: 6 }
  }
}

export function getDepositDueDate(deductionDate: Date): Date {
  const dueDate = new Date(deductionDate)
  dueDate.setMonth(dueDate.getMonth() + 1)
  dueDate.setDate(7) // TDS deposit due on 7th of next month
  return dueDate
}

// PAN validation
export function validatePAN(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  return panRegex.test(pan.toUpperCase())
}

// TAN validation
export function validateTAN(tan: string): boolean {
  const tanRegex = /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/
  return tanRegex.test(tan.toUpperCase())
}