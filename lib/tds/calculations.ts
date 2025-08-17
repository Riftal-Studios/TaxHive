import { Decimal } from '@prisma/client/runtime/library'
import { TDS_SECTIONS, TDS_CESS_RATE, SURCHARGE_RATES, type TDSSectionCode, type VendorType } from './constants'

export interface TDSCalculationInput {
  amount: number
  sectionCode: TDSSectionCode
  vendorType: VendorType
  vendorIncome?: number // Annual income for surcharge calculation
  hasLowerCertificate?: boolean
  lowerRate?: number
  previousPayments?: number // Previous payments in the financial year
}

export interface TDSCalculationResult {
  taxableAmount: number
  tdsRate: number
  basicTDS: number
  surchargeRate: number
  surchargeAmount: number
  cessRate: number
  cessAmount: number
  totalTDS: number
  netPayable: number
  thresholdExceeded: boolean
  applicableThreshold: number
}

export function calculateTDS(input: TDSCalculationInput): TDSCalculationResult {
  const section = TDS_SECTIONS[input.sectionCode]
  if (!section) {
    throw new Error(`Invalid TDS section code: ${input.sectionCode}`)
  }

  // Check threshold
  const totalPayments = (input.previousPayments || 0) + input.amount
  const thresholdExceeded = totalPayments > section.aggregateLimit
  
  // If threshold not exceeded, no TDS
  if (!thresholdExceeded && section.aggregateLimit > 0) {
    return {
      taxableAmount: input.amount,
      tdsRate: 0,
      basicTDS: 0,
      surchargeRate: 0,
      surchargeAmount: 0,
      cessRate: 0,
      cessAmount: 0,
      totalTDS: 0,
      netPayable: input.amount,
      thresholdExceeded: false,
      applicableThreshold: section.aggregateLimit,
    }
  }

  // Determine TDS rate based on vendor type
  let tdsRate: number
  if (input.hasLowerCertificate && input.lowerRate !== undefined) {
    tdsRate = input.lowerRate
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
        tdsRate = section.companyRate // Default to company rate
    }
  }

  // Calculate basic TDS
  const basicTDS = (input.amount * tdsRate) / 100

  // Calculate surcharge (if applicable)
  let surchargeRate = 0
  let surchargeAmount = 0
  
  if (input.vendorIncome) {
    const surchargeSlabs = 
      input.vendorType === 'INDIVIDUAL' ? SURCHARGE_RATES.INDIVIDUAL :
      input.vendorType === 'COMPANY' ? SURCHARGE_RATES.COMPANY :
      []
    
    for (const slab of surchargeSlabs) {
      if (input.vendorIncome >= slab.min && input.vendorIncome < slab.max) {
        surchargeRate = slab.rate
        surchargeAmount = (basicTDS * surchargeRate) / 100
        break
      }
    }
  }

  // Calculate cess
  const cessRate = TDS_CESS_RATE
  const cessAmount = ((basicTDS + surchargeAmount) * cessRate) / 100

  // Total TDS
  const totalTDS = basicTDS + surchargeAmount + cessAmount
  const netPayable = input.amount - totalTDS

  return {
    taxableAmount: input.amount,
    tdsRate,
    basicTDS,
    surchargeRate,
    surchargeAmount,
    cessRate,
    cessAmount,
    totalTDS,
    netPayable,
    thresholdExceeded,
    applicableThreshold: section.aggregateLimit,
  }
}

// Calculate TDS for multiple line items
export function calculateTDSForLineItems(
  lineItems: Array<{ amount: number; sectionCode?: TDSSectionCode }>,
  defaultSectionCode: TDSSectionCode,
  vendorType: VendorType,
  vendorIncome?: number,
  hasLowerCertificate?: boolean,
  lowerRate?: number,
  previousPayments?: number
): TDSCalculationResult {
  // Group items by section code
  const sectionWiseAmounts = new Map<TDSSectionCode, number>()
  
  for (const item of lineItems) {
    const section = item.sectionCode || defaultSectionCode
    const currentAmount = sectionWiseAmounts.get(section) || 0
    sectionWiseAmounts.set(section, currentAmount + item.amount)
  }

  // Calculate TDS for each section
  let totalBasicTDS = 0
  let totalSurcharge = 0
  let totalCess = 0
  let totalAmount = 0
  let maxRate = 0

  for (const [sectionCode, amount] of sectionWiseAmounts.entries()) {
    const result = calculateTDS({
      amount,
      sectionCode,
      vendorType,
      vendorIncome,
      hasLowerCertificate,
      lowerRate,
      previousPayments,
    })
    
    totalBasicTDS += result.basicTDS
    totalSurcharge += result.surchargeAmount
    totalCess += result.cessAmount
    totalAmount += amount
    maxRate = Math.max(maxRate, result.tdsRate)
  }

  const totalTDS = totalBasicTDS + totalSurcharge + totalCess
  const netPayable = totalAmount - totalTDS

  return {
    taxableAmount: totalAmount,
    tdsRate: maxRate, // Return the highest rate applied
    basicTDS: totalBasicTDS,
    surchargeRate: totalSurcharge > 0 ? (totalSurcharge / totalBasicTDS) * 100 : 0,
    surchargeAmount: totalSurcharge,
    cessRate: TDS_CESS_RATE,
    cessAmount: totalCess,
    totalTDS,
    netPayable,
    thresholdExceeded: true, // Simplified for multiple sections
    applicableThreshold: 0, // Not applicable for multiple sections
  }
}

// Check if TDS is applicable for a given payment
export function isTDSApplicable(
  sectionCode: TDSSectionCode,
  amount: number,
  previousPayments: number = 0
): boolean {
  const section = TDS_SECTIONS[sectionCode]
  if (!section) return false
  
  // Check single payment threshold
  if (section.thresholdLimit > 0 && amount < section.thresholdLimit) {
    return false
  }
  
  // Check aggregate threshold
  const totalPayments = previousPayments + amount
  return totalPayments > section.aggregateLimit
}

// Get applicable TDS sections for a payment type
export function getApplicableTDSSections(paymentNature: string): TDSSectionCode[] {
  const applicableSections: TDSSectionCode[] = []
  
  for (const [code, section] of Object.entries(TDS_SECTIONS)) {
    if (section.natureOfPayment.some(nature => 
      nature.toLowerCase().includes(paymentNature.toLowerCase())
    )) {
      applicableSections.push(code as TDSSectionCode)
    }
  }
  
  return applicableSections
}

// Format TDS amount for display
export function formatTDSAmount(amount: number | Decimal): string {
  const value = typeof amount === 'number' ? amount : amount.toNumber()
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Generate certificate number
export function generateCertificateNumber(
  tanNumber: string,
  financialYear: string,
  quarter: string,
  sequence: number
): string {
  const fy = financialYear.replace('FY', '').replace('-', '')
  return `${tanNumber}/${fy}/${quarter}/${sequence.toString().padStart(5, '0')}`
}

// Generate challan number
export function generateChallanNumber(
  bsrCode: string,
  date: Date,
  serialNumber: number
): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
  return `${bsrCode}${dateStr}${serialNumber.toString().padStart(5, '0')}`
}