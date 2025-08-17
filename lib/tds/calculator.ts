import { Decimal } from '@prisma/client/runtime/library'

/**
 * TDS Calculator - Implements Tax Deducted at Source calculations
 * As per Indian Income Tax Act
 */

// TDS Section Configuration based on FY 2024-25 rates
export const TDS_SECTIONS = {
  '194C': {
    code: '194C',
    description: 'Payment to Contractors',
    individualRate: 1,
    companyRate: 2,
    hufRate: 1,
    thresholdLimit: 100000, // Annual aggregate limit
    singleTransactionLimit: 30000,
    applicableFor: ['CONTRACT', 'SUB_CONTRACT', 'LABOUR'],
    eduCessRate: 4
  },
  '194J': {
    code: '194J',
    description: 'Professional/Technical Services',
    individualRate: 10,
    companyRate: 10,
    hufRate: 10,
    thresholdLimit: 30000, // Annual limit (50000 from FY 2025-26)
    singleTransactionLimit: null,
    applicableFor: ['PROFESSIONAL', 'TECHNICAL', 'ROYALTY', 'NON_COMPETE'],
    eduCessRate: 4
  },
  '194H': {
    code: '194H',
    description: 'Commission or Brokerage',
    individualRate: 5,
    companyRate: 5,
    hufRate: 5,
    thresholdLimit: 15000, // Annual limit
    singleTransactionLimit: null,
    applicableFor: ['COMMISSION', 'BROKERAGE'],
    eduCessRate: 4
  },
  '194I': {
    code: '194I',
    description: 'Rent',
    individualRate: 10,
    companyRate: 10,
    hufRate: 10,
    thresholdLimit: 240000, // Annual limit
    singleTransactionLimit: null,
    applicableFor: ['RENT', 'LEASE'],
    eduCessRate: 4
  },
  '194IA': {
    code: '194IA',
    description: 'Transfer of Immovable Property',
    individualRate: 1,
    companyRate: 1,
    hufRate: 1,
    thresholdLimit: 5000000, // Property value threshold
    singleTransactionLimit: null,
    applicableFor: ['PROPERTY'],
    eduCessRate: 4
  },
  '194IB': {
    code: '194IB',
    description: 'Rent by Individual/HUF',
    individualRate: 5,
    companyRate: 5,
    hufRate: 5,
    thresholdLimit: 50000, // Monthly threshold
    singleTransactionLimit: null,
    applicableFor: ['RENT'],
    eduCessRate: 4
  },
  '194M': {
    code: '194M',
    description: 'Contract/Commission/Brokerage by Individual/HUF',
    individualRate: 5,
    companyRate: 5,
    hufRate: 5,
    thresholdLimit: 5000000, // Annual limit
    singleTransactionLimit: null,
    applicableFor: ['CONTRACT', 'COMMISSION', 'BROKERAGE'],
    eduCessRate: 4
  }
} as const

export type TDSSection = typeof TDS_SECTIONS[keyof typeof TDS_SECTIONS]
export type VendorType = 'INDIVIDUAL' | 'COMPANY' | 'HUF' | 'FIRM' | 'TRUST' | 'AOP' | 'BOI'

interface TDSCalculationInput {
  amount: Decimal
  sectionCode: string
  vendorType: VendorType
  hasPAN: boolean
}

interface TDSCalculationResult {
  tdsRate: number
  tdsAmount: Decimal
  surcharge: Decimal
  eduCess: Decimal
  totalTDS: Decimal
}

interface ThresholdCalculationInput extends TDSCalculationInput {
  currentAmount: Decimal
  cumulativeAmount: Decimal
  deductOnEntireAmount?: boolean
}

interface ThresholdCalculationResult extends TDSCalculationResult {
  tdsApplicable: boolean
  thresholdExceeded: boolean
  singleTransactionLimitExceeded: boolean
}

interface QuarterlyTDSSummary {
  totalTaxableAmount: Decimal
  totalTDSAmount: Decimal
  totalSurcharge: Decimal
  totalEducationCess: Decimal
  totalTDS: Decimal
  sectionWiseSummary: Record<string, {
    count: number
    totalTDS: Decimal
    totalTaxable: Decimal
  }>
}

/**
 * Get TDS section configuration
 */
export function getTDSSection(sectionCode: string): TDSSection {
  const section = TDS_SECTIONS[sectionCode as keyof typeof TDS_SECTIONS]
  if (!section) {
    throw new Error(`Invalid TDS section code: ${sectionCode}`)
  }
  return section
}

/**
 * Calculate basic TDS without threshold checking
 */
export function calculateTDS(input: TDSCalculationInput): TDSCalculationResult {
  const section = getTDSSection(input.sectionCode)
  
  // Determine the applicable rate based on vendor type
  let tdsRate: number
  
  if (!input.hasPAN) {
    // 20% TDS if PAN is not provided (Section 206AA)
    tdsRate = 20
  } else {
    switch (input.vendorType) {
      case 'INDIVIDUAL':
        tdsRate = section.individualRate
        break
      case 'COMPANY':
        tdsRate = section.companyRate
        break
      case 'HUF':
        tdsRate = section.hufRate || section.individualRate
        break
      default:
        tdsRate = section.companyRate // Default to company rate for firms, trusts, etc.
    }
  }
  
  // Calculate basic TDS
  const tdsAmount = input.amount.mul(tdsRate).div(100)
  
  // Calculate surcharge (for high-value transactions)
  let surcharge = new Decimal(0)
  const amountValue = input.amount.toNumber()
  
  if (input.vendorType === 'COMPANY' && amountValue > 10000000) {
    // 12% surcharge for companies if amount > 1 crore
    surcharge = tdsAmount.mul(12).div(100)
  } else if (input.vendorType === 'INDIVIDUAL' && amountValue > 5000000) {
    // 10% surcharge for individuals if amount > 50 lakh
    surcharge = tdsAmount.mul(10).div(100)
  }
  
  // Calculate education cess (4% on TDS + surcharge)
  const eduCess = tdsAmount.add(surcharge).mul(section.eduCessRate).div(100)
  
  // Calculate total TDS
  const totalTDS = tdsAmount.add(surcharge).add(eduCess)
  
  return {
    tdsRate,
    tdsAmount,
    surcharge,
    eduCess,
    totalTDS
  }
}

/**
 * Calculate TDS with threshold limit checking
 */
export function calculateTDSWithThreshold(input: ThresholdCalculationInput): ThresholdCalculationResult {
  const section = getTDSSection(input.sectionCode)
  
  // Check if single transaction limit is exceeded
  const singleTransactionLimitExceeded = section.singleTransactionLimit 
    ? input.currentAmount.toNumber() > section.singleTransactionLimit
    : false
  
  // Calculate total amount after this payment
  const totalAmount = input.cumulativeAmount.add(input.currentAmount)
  
  // Check if threshold is exceeded
  const thresholdExceeded = totalAmount.toNumber() > section.thresholdLimit
  
  // TDS is applicable if either condition is met
  const tdsApplicable = singleTransactionLimitExceeded || thresholdExceeded
  
  if (!tdsApplicable) {
    return {
      tdsApplicable: false,
      thresholdExceeded: false,
      singleTransactionLimitExceeded: false,
      tdsRate: 0,
      tdsAmount: new Decimal(0),
      surcharge: new Decimal(0),
      eduCess: new Decimal(0),
      totalTDS: new Decimal(0)
    }
  }
  
  // Calculate TDS amount based on deduction policy
  let amountForTDS = input.currentAmount
  
  if (input.deductOnEntireAmount && thresholdExceeded) {
    // Deduct TDS on entire cumulative amount after crossing threshold
    amountForTDS = totalAmount
  }
  
  const tdsResult = calculateTDS({
    ...input,
    amount: amountForTDS
  })
  
  return {
    ...tdsResult,
    tdsApplicable,
    thresholdExceeded,
    singleTransactionLimitExceeded
  }
}

/**
 * Calculate quarterly TDS summary
 */
export function calculateQuarterlyTDS(
  deductions: Array<{
    taxableAmount: Decimal
    tdsAmount: Decimal
    surcharge: Decimal
    eduCess: Decimal
    totalTDS: Decimal
    sectionCode: string
  }>
): QuarterlyTDSSummary {
  let totalTaxableAmount = new Decimal(0)
  let totalTDSAmount = new Decimal(0)
  let totalSurcharge = new Decimal(0)
  let totalEducationCess = new Decimal(0)
  let totalTDS = new Decimal(0)
  
  const sectionWiseSummary: QuarterlyTDSSummary['sectionWiseSummary'] = {}
  
  for (const deduction of deductions) {
    totalTaxableAmount = totalTaxableAmount.add(deduction.taxableAmount)
    totalTDSAmount = totalTDSAmount.add(deduction.tdsAmount)
    totalSurcharge = totalSurcharge.add(deduction.surcharge)
    totalEducationCess = totalEducationCess.add(deduction.eduCess)
    totalTDS = totalTDS.add(deduction.totalTDS)
    
    // Update section-wise summary
    if (!sectionWiseSummary[deduction.sectionCode]) {
      sectionWiseSummary[deduction.sectionCode] = {
        count: 0,
        totalTDS: new Decimal(0),
        totalTaxable: new Decimal(0)
      }
    }
    
    sectionWiseSummary[deduction.sectionCode].count++
    sectionWiseSummary[deduction.sectionCode].totalTDS = 
      sectionWiseSummary[deduction.sectionCode].totalTDS.add(deduction.totalTDS)
    sectionWiseSummary[deduction.sectionCode].totalTaxable = 
      sectionWiseSummary[deduction.sectionCode].totalTaxable.add(deduction.taxableAmount)
  }
  
  return {
    totalTaxableAmount,
    totalTDSAmount,
    totalSurcharge,
    totalEducationCess,
    totalTDS,
    sectionWiseSummary
  }
}

/**
 * Calculate TDS deposit due date
 */
export function getDepositDueDate(
  deductionDate: Date,
  isGovernmentDeductor: boolean,
  isQuarterEnd = false
): Date {
  const dueDate = new Date(deductionDate)
  
  if (isQuarterEnd) {
    // For quarter-end deductions (March, June, September, December)
    // Due date is 30th of next month after quarter end
    const month = dueDate.getMonth()
    const year = dueDate.getFullYear()
    
    // Create a new date for the next month to avoid overflow issues
    let nextMonth: number
    let nextYear: number
    
    if (month === 11) { // December
      nextMonth = 0 // January
      nextYear = year + 1
    } else {
      nextMonth = month + 1
      nextYear = year
    }
    
    // Create new date directly with the target month and day
    dueDate.setFullYear(nextYear, nextMonth, 30)
  } else if (isGovernmentDeductor) {
    // For government deductors: 30th of same month
    dueDate.setDate(30)
  } else {
    // For non-government deductors: 7th of next month
    const month = dueDate.getMonth()
    const year = dueDate.getFullYear()
    
    // Handle year transition
    if (month === 11) { // December
      dueDate.setFullYear(year + 1, 0, 7) // January 7th next year
    } else {
      dueDate.setFullYear(year, month + 1, 7) // 7th of next month
    }
  }
  
  return dueDate
}

/**
 * Get financial year and quarter from date
 */
export function getFinancialPeriod(date: Date): {
  financialYear: string
  quarter: string
  assessmentYear: string
} {
  const month = date.getMonth() + 1 // 1-12
  const year = date.getFullYear()
  
  let financialYear: string
  let quarter: string
  let assessmentYear: string
  
  // Determine financial year
  if (month >= 4) {
    // April to March of next year
    financialYear = `FY${year.toString().slice(2)}-${(year + 1).toString().slice(2)}`
    assessmentYear = `AY${(year + 1).toString().slice(2)}-${(year + 2).toString().slice(2)}`
  } else {
    // January to March
    financialYear = `FY${(year - 1).toString().slice(2)}-${year.toString().slice(2)}`
    assessmentYear = `AY${year.toString().slice(2)}-${(year + 1).toString().slice(2)}`
  }
  
  // Determine quarter
  if (month >= 4 && month <= 6) {
    quarter = 'Q1'
  } else if (month >= 7 && month <= 9) {
    quarter = 'Q2'
  } else if (month >= 10 && month <= 12) {
    quarter = 'Q3'
  } else {
    quarter = 'Q4'
  }
  
  return {
    financialYear,
    quarter,
    assessmentYear
  }
}

/**
 * Validate PAN format
 */
export function validatePAN(pan: string): boolean {
  // PAN format: AAAAA9999A
  // First 5 characters: alphabets
  // Next 4 characters: numerals
  // Last character: alphabet
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/
  return panRegex.test(pan.toUpperCase())
}

/**
 * Validate TAN format
 */
export function validateTAN(tan: string): boolean {
  // TAN format: AAAA99999A
  // First 4 characters: alphabets
  // Next 5 characters: numerals
  // Last character: alphabet
  const tanRegex = /^[A-Z]{4}[0-9]{5}[A-Z]$/
  return tanRegex.test(tan.toUpperCase())
}

/**
 * Format certificate number
 */
export function generateCertificateNumber(
  tanNumber: string,
  financialYear: string,
  quarter: string,
  serialNumber: number
): string {
  // Format: TAN/FY/Q/Serial
  // Example: DELS12345F/FY24-25/Q1/001
  return `${tanNumber}/${financialYear}/${quarter}/${serialNumber.toString().padStart(3, '0')}`
}

/**
 * Calculate late fee for delayed TDS deposit
 */
export function calculateLateFee(
  dueDate: Date,
  depositDate: Date,
  tdsAmount: Decimal
): {
  daysLate: number
  interest: Decimal
  penalty: Decimal
  totalLateFee: Decimal
} {
  const daysLate = Math.max(0, Math.floor((depositDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
  
  if (daysLate === 0) {
    return {
      daysLate: 0,
      interest: new Decimal(0),
      penalty: new Decimal(0),
      totalLateFee: new Decimal(0)
    }
  }
  
  // Interest calculation: 1.5% per month or part of month
  const monthsLate = Math.ceil(daysLate / 30)
  const interest = tdsAmount.mul(1.5).mul(monthsLate).div(100)
  
  // Penalty: Rs 200 per day (maximum Rs 10,000)
  const penalty = new Decimal(Math.min(daysLate * 200, 10000))
  
  const totalLateFee = interest.add(penalty)
  
  return {
    daysLate,
    interest,
    penalty,
    totalLateFee
  }
}