/**
 * ITC (Input Tax Credit) Eligibility Calculation
 * Based on Section 17(5) of CGST Act
 */

import { Decimal } from '@prisma/client/runtime/library'

export interface ITCEligibilityInput {
  category: string
  seatingCapacity?: number
  businessPurpose?: string
  constructionType?: string
  isStatutoryRequirement?: boolean
  insuranceType?: string
  membershipType?: string
  usageType?: string
  gstAmount: Decimal
}

export interface ITCEligibilityResult {
  isEligible: boolean
  eligibleAmount: Decimal
  blockedAmount: Decimal
  blockedCategory?: string
  blockedReason?: string
}

export type BlockedCreditCategory = 
  | 'MOTOR_VEHICLE'
  | 'CONSTRUCTION'
  | 'FOOD_BEVERAGE'
  | 'INSURANCE'
  | 'MEMBERSHIP'
  | 'PERSONAL_USE'
  | 'PERSONAL_SERVICES'
  | 'TRAVEL'

/**
 * Check ITC eligibility based on Section 17(5) blocked credits
 */
export function checkITCEligibility(input: ITCEligibilityInput): ITCEligibilityResult {
  const result: ITCEligibilityResult = {
    isEligible: true,
    eligibleAmount: input.gstAmount,
    blockedAmount: new Decimal(0)
  }

  // Section 17(5)(a) - Motor vehicles
  if (input.category === 'MOTOR_VEHICLE') {
    const seatingCapacity = input.seatingCapacity || 0
    const isTransportBusiness = [
      'PASSENGER_TRANSPORT',
      'GOODS_TRANSPORT',
      'IMPARTING_TRAINING'
    ].includes(input.businessPurpose || '')

    if (seatingCapacity <= 13 && !isTransportBusiness) {
      result.isEligible = false
      result.eligibleAmount = new Decimal(0)
      result.blockedAmount = input.gstAmount
      result.blockedCategory = 'MOTOR_VEHICLE'
      result.blockedReason = 'Section 17(5)(a) - Motor vehicles with seating capacity <= 13 (except for specific business purposes)'
    }
  }

  // Section 17(5)(c) - Construction of immovable property
  if (input.category === 'CONSTRUCTION') {
    const isDeveloper = input.businessPurpose === 'SALE_DEVELOPMENT'
    const isPlantMachinery = input.constructionType === 'PLANT_MACHINERY'

    if (!isDeveloper && !isPlantMachinery) {
      result.isEligible = false
      result.eligibleAmount = new Decimal(0)
      result.blockedAmount = input.gstAmount
      result.blockedCategory = 'CONSTRUCTION'
      result.blockedReason = 'Section 17(5)(c) - Construction of immovable property (except for developers)'
    }
  }

  // Section 17(5)(b)(i) - Food and beverages
  if (input.category === 'FOOD_BEVERAGE') {
    if (!input.isStatutoryRequirement) {
      result.isEligible = false
      result.eligibleAmount = new Decimal(0)
      result.blockedAmount = input.gstAmount
      result.blockedCategory = 'FOOD_BEVERAGE'
      result.blockedReason = 'Section 17(5)(b)(i) - Food and beverages (except when statutory requirement)'
    }
  }

  // Section 17(5)(b)(iii) - Health and life insurance
  if (input.category === 'INSURANCE') {
    const isHealthOrLife = ['HEALTH', 'LIFE'].includes(input.insuranceType || '')
    
    if (isHealthOrLife && !input.isStatutoryRequirement) {
      result.isEligible = false
      result.eligibleAmount = new Decimal(0)
      result.blockedAmount = input.gstAmount
      result.blockedCategory = 'INSURANCE'
      result.blockedReason = 'Section 17(5)(b)(iii) - Health and life insurance (except when statutory requirement)'
    }
  }

  // Section 17(5)(b)(ii) - Membership of clubs
  if (input.category === 'MEMBERSHIP') {
    if (input.membershipType === 'CLUB') {
      result.isEligible = false
      result.eligibleAmount = new Decimal(0)
      result.blockedAmount = input.gstAmount
      result.blockedCategory = 'MEMBERSHIP'
      result.blockedReason = 'Section 17(5)(b)(ii) - Membership of clubs, health and fitness centres'
    }
  }

  // Section 17(5)(g) - Personal consumption
  if (input.category === 'GENERAL' && input.usageType === 'PERSONAL') {
    result.isEligible = false
    result.eligibleAmount = new Decimal(0)
    result.blockedAmount = input.gstAmount
    result.blockedCategory = 'PERSONAL_USE'
    result.blockedReason = 'Section 17(5)(g) - Goods or services for personal consumption'
  }

  return result
}

/**
 * Calculate proportionate ITC for mixed use
 */
export function calculateProportionateITC(params: {
  totalGST: Decimal
  businessUsePercentage: number
  exemptSupplyPercentage: number
}): {
  eligibleITC: Decimal
  reversedITC: Decimal
} {
  const { totalGST, businessUsePercentage, exemptSupplyPercentage } = params
  
  // First apply business use percentage
  const businessITC = totalGST.mul(businessUsePercentage).div(100)
  
  // Then apply exempt supply reversal
  const taxableSupplyPercentage = 100 - exemptSupplyPercentage
  const eligibleITC = businessITC.mul(taxableSupplyPercentage).div(100)
  
  const reversedITC = totalGST.sub(eligibleITC)
  
  return {
    eligibleITC,
    reversedITC
  }
}

/**
 * Calculate ITC amount considering capital goods spread
 */
export function calculateITCAmount(params: {
  category: string
  gstAmount: Decimal
  assetLife?: number
  currentYear?: number
}): {
  currentYearITC: Decimal
  totalEligibleITC: Decimal
} {
  const { category, gstAmount, assetLife = 5 } = params
  
  if (category === 'CAPITAL_GOODS' && assetLife > 1) {
    // Capital goods ITC spread over asset life (typically 5 years at 20% per year)
    const annualITC = gstAmount.div(assetLife)
    return {
      currentYearITC: annualITC,
      totalEligibleITC: gstAmount
    }
  }
  
  return {
    currentYearITC: gstAmount,
    totalEligibleITC: gstAmount
  }
}

/**
 * Apply Rule 36(4) - Provisional ITC limit
 */
export function applyRule36_4(params: {
  claimedITC: Decimal
  gstr2bITC: Decimal
  ruleVersion: 'OLD' | 'NEW'
}): {
  allowedITC: Decimal
  excessITC: Decimal
  isCompliant: boolean
} {
  const { claimedITC, gstr2bITC, ruleVersion } = params
  
  let maxAllowedITC: Decimal
  
  if (ruleVersion === 'OLD') {
    // Before October 2022: 105% of GSTR-2B
    maxAllowedITC = gstr2bITC.mul(1.05)
  } else {
    // After October 2022: 100% of GSTR-2B (no provisional credit)
    maxAllowedITC = gstr2bITC
  }
  
  const allowedITC = Decimal.min(claimedITC, maxAllowedITC)
  const excessITC = Decimal.max(claimedITC.sub(maxAllowedITC), new Decimal(0))
  const isCompliant = excessITC.equals(0)
  
  return {
    allowedITC,
    excessITC,
    isCompliant
  }
}

/**
 * Get blocked credit category from expense description
 */
export function getBlockedCreditCategory(description: string): BlockedCreditCategory | null {
  const descLower = description.toLowerCase()
  
  if (descLower.includes('motor vehicle') || descLower.includes('car') || descLower.includes('bike')) {
    return 'MOTOR_VEHICLE'
  }
  
  if (descLower.includes('construction') || descLower.includes('building')) {
    return 'CONSTRUCTION'
  }
  
  if (descLower.includes('food') || descLower.includes('beverage') || descLower.includes('catering')) {
    return 'FOOD_BEVERAGE'
  }
  
  if (descLower.includes('insurance') || descLower.includes('health insurance') || descLower.includes('life insurance')) {
    return 'INSURANCE'
  }
  
  if (descLower.includes('club') || descLower.includes('membership')) {
    return 'MEMBERSHIP'
  }
  
  if (descLower.includes('beauty') || descLower.includes('cosmetic') || descLower.includes('plastic surgery')) {
    return 'PERSONAL_SERVICES'
  }
  
  if (descLower.includes('travel') || descLower.includes('holiday')) {
    return 'TRAVEL'
  }
  
  return null
}

/**
 * Calculate ITC reversal for various scenarios
 */
export function calculateITCReversal(input: {
  originalITC: Decimal
  reason: string
  invoiceDate?: Date
  currentDate?: Date
  lossPercentage?: number
  personalUsePercentage?: number
}): {
  reversalAmount: Decimal
  interestAmount: Decimal
  totalAmount: Decimal
  reversalReason: string
} {
  let reversalAmount = input.originalITC
  let interestAmount = new Decimal(0)
  let reversalReason = ''
  
  switch (input.reason) {
    case 'NON_PAYMENT_180_DAYS':
      reversalReason = 'Non-payment to supplier within 180 days'
      if (input.invoiceDate && input.currentDate) {
        const daysDiff = Math.floor((input.currentDate.getTime() - input.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysDiff > 180) {
          const monthsLate = Math.ceil((daysDiff - 180) / 30)
          // 18% annual interest rate
          interestAmount = input.originalITC.mul(0.18).mul(monthsLate).div(12)
        }
      }
      break
      
    case 'GOODS_LOST':
      if (input.lossPercentage) {
        reversalAmount = input.originalITC.mul(input.lossPercentage).div(100)
        reversalReason = `Goods lost/destroyed - ${input.lossPercentage}%`
      }
      break
      
    case 'USAGE_CHANGE':
      if (input.personalUsePercentage) {
        reversalAmount = input.originalITC.mul(input.personalUsePercentage).div(100)
        reversalReason = `Changed to personal use - ${input.personalUsePercentage}%`
      }
      break
      
    default:
      reversalReason = input.reason
  }
  
  return {
    reversalAmount,
    interestAmount,
    totalAmount: reversalAmount.add(interestAmount),
    reversalReason
  }
}

/**
 * Validate ITC claim conditions
 */
export function validateITCConditions(conditions: {
  hasValidInvoice: boolean
  goodsServicesReceived: boolean
  taxPaidBySupplier: boolean
  gstr3bFiled: boolean
  withinTimeLimit: boolean
}): {
  canClaimITC: boolean
  failedConditions: string[]
} {
  const failedConditions: string[] = []
  
  if (!conditions.hasValidInvoice) {
    failedConditions.push('Valid tax invoice required')
  }
  if (!conditions.goodsServicesReceived) {
    failedConditions.push('Goods/services must be received')
  }
  if (!conditions.taxPaidBySupplier) {
    failedConditions.push('Tax must be paid by supplier')
  }
  if (!conditions.gstr3bFiled) {
    failedConditions.push('GSTR-3B must be filed')
  }
  if (!conditions.withinTimeLimit) {
    failedConditions.push('ITC claim time limit exceeded')
  }
  
  return {
    canClaimITC: failedConditions.length === 0,
    failedConditions
  }
}