// Export new ITC Eligibility Rules service
export * from './itc-eligibility-rules'

// Export ITC Register service
export * from './itc-register'

// ITC Categories
export const ITC_CATEGORIES = {
  INPUTS: 'INPUTS',
  CAPITAL_GOODS: 'CAPITAL_GOODS',
  INPUT_SERVICES: 'INPUT_SERVICES',
  BLOCKED: 'BLOCKED',
} as const

export type ITCCategory = keyof typeof ITC_CATEGORIES

// Blocked Credits under Section 17(5)
export const BLOCKED_ITC_CATEGORIES = [
  'MOTOR_VEHICLES',
  'HEALTH_INSURANCE',
  'LIFE_INSURANCE',
  'MEMBERSHIP_FEES',
  'PERSONAL_CONSUMPTION',
  'WORKS_CONTRACT_IMMOVABLE',
  'FOOD_BEVERAGES',
  'OUTDOOR_CATERING',
  'BEAUTY_TREATMENT',
  'RENT_A_CAB',
  'TRAVEL_BENEFITS',
] as const

export type BlockedITCCategory = typeof BLOCKED_ITC_CATEGORIES[number]

// ITC Eligibility Rules
export interface ITCEligibilityRule {
  category: string
  description: string
  isBlocked: boolean
  blockReason?: string
  partialEligibility?: number // Percentage eligible
}

export const ITC_BLOCKING_RULES: Record<BlockedITCCategory, ITCEligibilityRule> = {
  MOTOR_VEHICLES: {
    category: 'MOTOR_VEHICLES',
    description: 'Motor vehicles and conveyances',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(a) except for specific cases',
  },
  HEALTH_INSURANCE: {
    category: 'HEALTH_INSURANCE',
    description: 'Health insurance',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(b)',
  },
  LIFE_INSURANCE: {
    category: 'LIFE_INSURANCE',
    description: 'Life insurance',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(b)',
  },
  MEMBERSHIP_FEES: {
    category: 'MEMBERSHIP_FEES',
    description: 'Membership of club, health and fitness centre',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(f)',
  },
  PERSONAL_CONSUMPTION: {
    category: 'PERSONAL_CONSUMPTION',
    description: 'Goods or services for personal consumption',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(g)',
  },
  WORKS_CONTRACT_IMMOVABLE: {
    category: 'WORKS_CONTRACT_IMMOVABLE',
    description: 'Works contract for construction of immovable property',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(c) except plant and machinery',
  },
  FOOD_BEVERAGES: {
    category: 'FOOD_BEVERAGES',
    description: 'Food and beverages',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(b)',
  },
  OUTDOOR_CATERING: {
    category: 'OUTDOOR_CATERING',
    description: 'Outdoor catering',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(b)',
  },
  BEAUTY_TREATMENT: {
    category: 'BEAUTY_TREATMENT',
    description: 'Beauty treatment, health services, cosmetic surgery',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(b)',
  },
  RENT_A_CAB: {
    category: 'RENT_A_CAB',
    description: 'Rent-a-cab services',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(b) except when obligated by government',
  },
  TRAVEL_BENEFITS: {
    category: 'TRAVEL_BENEFITS',
    description: 'Travel benefits to employees on vacation',
    isBlocked: true,
    blockReason: 'Blocked under Section 17(5)(h)',
  },
}

// ITC Calculation
export interface ITCCalculationInput {
  taxableAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  cessAmount?: number
  category: ITCCategory
  isEligible: boolean
  blockingCategory?: BlockedITCCategory
  businessUsePercentage?: number // For common credits
}

export interface ITCCalculationResult {
  totalGST: number
  eligibleITC: number
  blockedITC: number
  reversedITC: number
  category: ITCCategory
  blockReason?: string
  remarks?: string
}

export function calculateITC(input: ITCCalculationInput): ITCCalculationResult {
  const totalGST = input.cgstAmount + input.sgstAmount + input.igstAmount + (input.cessAmount || 0)
  
  // Check if completely blocked
  if (!input.isEligible || input.category === 'BLOCKED') {
    return {
      totalGST,
      eligibleITC: 0,
      blockedITC: totalGST,
      reversedITC: 0,
      category: input.category,
      blockReason: input.blockingCategory 
        ? ITC_BLOCKING_RULES[input.blockingCategory]?.blockReason 
        : 'ITC not eligible',
    }
  }
  
  // Check for blocking rules
  if (input.blockingCategory && ITC_BLOCKING_RULES[input.blockingCategory]) {
    const rule = ITC_BLOCKING_RULES[input.blockingCategory]
    return {
      totalGST,
      eligibleITC: 0,
      blockedITC: totalGST,
      reversedITC: 0,
      category: 'BLOCKED',
      blockReason: rule.blockReason,
    }
  }
  
  // Calculate partial ITC for common credits
  if (input.businessUsePercentage && input.businessUsePercentage < 100) {
    const eligibleITC = (totalGST * input.businessUsePercentage) / 100
    const blockedITC = totalGST - eligibleITC
    
    return {
      totalGST,
      eligibleITC,
      blockedITC,
      reversedITC: 0,
      category: input.category,
      remarks: `Partial ITC: ${input.businessUsePercentage}% business use`,
    }
  }
  
  // Full ITC eligible
  return {
    totalGST,
    eligibleITC: totalGST,
    blockedITC: 0,
    reversedITC: 0,
    category: input.category,
  }
}

// Rule 36(4) Compliance - 105% Rule
export interface Rule36_4Check {
  totalITCAsPerGSTR2A: number
  totalITCClaimed: number
  maxEligibleITC: number
  excessClaimed: number
  isCompliant: boolean
}

export function checkRule36_4Compliance(
  itcAsPerGSTR2A: number,
  itcClaimed: number
): Rule36_4Check {
  // As per Rule 36(4), can claim ITC up to 105% of eligible ITC reflected in GSTR-2A
  const maxEligibleITC = itcAsPerGSTR2A * 1.05
  const excessClaimed = Math.max(0, itcClaimed - maxEligibleITC)
  
  return {
    totalITCAsPerGSTR2A: itcAsPerGSTR2A,
    totalITCClaimed: itcClaimed,
    maxEligibleITC,
    excessClaimed,
    isCompliant: itcClaimed <= maxEligibleITC,
  }
}

// ITC Reversal under Rule 42 (Exempt Supplies)
export interface ITCReversalInput {
  commonCredit: number
  exemptTurnover: number
  taxableTurnover: number
  totalTurnover: number
}

export function calculateITCReversal(input: ITCReversalInput): number {
  if (input.totalTurnover === 0) return 0
  
  // Rule 42: Common credit attributable to exempt supplies
  const reversalAmount = (input.commonCredit * input.exemptTurnover) / input.totalTurnover
  
  return Math.round(reversalAmount * 100) / 100 // Round to 2 decimal places
}

// GSTR-2A/2B Matching
export interface InvoiceMatchResult {
  invoiceNumber: string
  vendorGSTIN: string
  matchStatus: 'MATCHED' | 'MISMATCHED' | 'NOT_AVAILABLE'
  mismatches?: {
    field: string
    expected: any
    actual: any
  }[]
}

export function matchInvoiceWithGSTR2A(
  purchaseInvoice: {
    invoiceNumber: string
    vendorGSTIN: string
    invoiceDate: Date
    taxableAmount: number
    cgstAmount: number
    sgstAmount: number
    igstAmount: number
  },
  gstr2aEntry?: {
    invoiceNumber: string
    invoiceDate: Date
    taxableAmount: number
    cgstAmount: number
    sgstAmount: number
    igstAmount: number
  }
): InvoiceMatchResult {
  if (!gstr2aEntry) {
    return {
      invoiceNumber: purchaseInvoice.invoiceNumber,
      vendorGSTIN: purchaseInvoice.vendorGSTIN,
      matchStatus: 'NOT_AVAILABLE',
    }
  }
  
  const mismatches: InvoiceMatchResult['mismatches'] = []
  
  // Check invoice date (allow 2 days difference)
  const dateDiff = Math.abs(
    purchaseInvoice.invoiceDate.getTime() - gstr2aEntry.invoiceDate.getTime()
  )
  const daysDiff = dateDiff / (1000 * 60 * 60 * 24)
  
  if (daysDiff > 2) {
    mismatches.push({
      field: 'invoiceDate',
      expected: purchaseInvoice.invoiceDate,
      actual: gstr2aEntry.invoiceDate,
    })
  }
  
  // Check amounts (allow 1 rupee difference for rounding)
  const tolerance = 1
  
  if (Math.abs(purchaseInvoice.taxableAmount - gstr2aEntry.taxableAmount) > tolerance) {
    mismatches.push({
      field: 'taxableAmount',
      expected: purchaseInvoice.taxableAmount,
      actual: gstr2aEntry.taxableAmount,
    })
  }
  
  if (Math.abs(purchaseInvoice.cgstAmount - gstr2aEntry.cgstAmount) > tolerance) {
    mismatches.push({
      field: 'cgstAmount',
      expected: purchaseInvoice.cgstAmount,
      actual: gstr2aEntry.cgstAmount,
    })
  }
  
  if (Math.abs(purchaseInvoice.sgstAmount - gstr2aEntry.sgstAmount) > tolerance) {
    mismatches.push({
      field: 'sgstAmount',
      expected: purchaseInvoice.sgstAmount,
      actual: gstr2aEntry.sgstAmount,
    })
  }
  
  if (Math.abs(purchaseInvoice.igstAmount - gstr2aEntry.igstAmount) > tolerance) {
    mismatches.push({
      field: 'igstAmount',
      expected: purchaseInvoice.igstAmount,
      actual: gstr2aEntry.igstAmount,
    })
  }
  
  return {
    invoiceNumber: purchaseInvoice.invoiceNumber,
    vendorGSTIN: purchaseInvoice.vendorGSTIN,
    matchStatus: mismatches.length > 0 ? 'MISMATCHED' : 'MATCHED',
    mismatches: mismatches.length > 0 ? mismatches : undefined,
  }
}

// Monthly ITC Summary
export interface MonthlyITCSummary {
  period: string
  openingBalance: number
  eligibleITC: number
  claimedITC: number
  reversedITC: number
  blockedITC: number
  closingBalance: number
  categoryBreakup: {
    inputs: number
    capitalGoods: number
    inputServices: number
    blocked: number
  }
}

export function calculateMonthlyITCSummary(
  purchases: Array<{
    cgstAmount: number
    sgstAmount: number
    igstAmount: number
    itcCategory: ITCCategory
    itcEligible: boolean
    itcClaimed: number
    itcReversed: number
  }>,
  openingBalance: number
): MonthlyITCSummary {
  const summary: MonthlyITCSummary = {
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
    openingBalance,
    eligibleITC: 0,
    claimedITC: 0,
    reversedITC: 0,
    blockedITC: 0,
    closingBalance: 0,
    categoryBreakup: {
      inputs: 0,
      capitalGoods: 0,
      inputServices: 0,
      blocked: 0,
    },
  }
  
  purchases.forEach(purchase => {
    const totalGST = purchase.cgstAmount + purchase.sgstAmount + purchase.igstAmount
    
    if (purchase.itcEligible) {
      summary.eligibleITC += totalGST
      summary.claimedITC += purchase.itcClaimed
      summary.reversedITC += purchase.itcReversed
      
      // Category breakup
      switch (purchase.itcCategory) {
        case 'INPUTS':
          summary.categoryBreakup.inputs += purchase.itcClaimed
          break
        case 'CAPITAL_GOODS':
          summary.categoryBreakup.capitalGoods += purchase.itcClaimed
          break
        case 'INPUT_SERVICES':
          summary.categoryBreakup.inputServices += purchase.itcClaimed
          break
        case 'BLOCKED':
          summary.categoryBreakup.blocked += totalGST
          break
      }
    } else {
      summary.blockedITC += totalGST
      summary.categoryBreakup.blocked += totalGST
    }
  })
  
  // Calculate closing balance
  summary.closingBalance = 
    summary.openingBalance + 
    summary.claimedITC - 
    summary.reversedITC
  
  return summary
}