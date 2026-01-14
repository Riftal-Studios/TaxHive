import { RcmType, SupplierType } from '@prisma/client'

/**
 * Result of RCM GST calculation
 */
export interface RCMCalculationResult {
  igst: number
  cgst: number
  sgst: number
  totalTax: number
  rcmLiability: number
  itcClaimable: number
}

/**
 * Input for Import of Services RCM calculation
 */
export interface ImportOfServicesInput {
  /** Amount in INR (if already converted) */
  amountInINR?: number
  /** Foreign amount (e.g., $100) */
  foreignAmount?: number
  /** Foreign currency code (e.g., 'USD') */
  foreignCurrency?: string
  /** Exchange rate (INR per foreign currency unit) */
  exchangeRate?: number
  /** GST rate percentage (e.g., 18) */
  gstRate: number
}

/**
 * Input for Indian Unregistered Supplier RCM calculation
 */
export interface IndianUnregisteredInput {
  /** Amount in INR */
  amount: number
  /** GST rate percentage (e.g., 18) */
  gstRate: number
  /** Supplier's state code (e.g., '29' for Karnataka) */
  supplierStateCode: string
  /** Recipient's state code (e.g., '29' for Karnataka) */
  recipientStateCode: string
}

/**
 * Calculate RCM for Import of Services (Section 9(3) - GSTR-3B Table 3.1(a))
 *
 * Key characteristics:
 * - Always IGST only (no CGST/SGST)
 * - Reported in GSTR-3B Table 3.1(a)
 * - Requires foreign currency conversion if applicable
 * - ITC is fully claimable (same as liability)
 *
 * @param input - Import of services calculation input
 * @returns RCM calculation result with only IGST
 */
export function calculateImportOfServicesRCM(
  input: ImportOfServicesInput
): RCMCalculationResult {
  let amountInINR: number

  // Determine the INR amount
  if (input.amountInINR !== undefined) {
    amountInINR = input.amountInINR
  } else if (input.foreignAmount !== undefined && input.foreignCurrency) {
    if (!input.exchangeRate) {
      throw new Error('Exchange rate is required for foreign currency conversion')
    }
    amountInINR = input.foreignAmount * input.exchangeRate
  } else {
    throw new Error('Either amountInINR or foreign currency details must be provided')
  }

  // Calculate IGST (always IGST for import of services)
  const igst = roundTo2Decimals(amountInINR * (input.gstRate / 100))

  return {
    igst,
    cgst: 0,
    sgst: 0,
    totalTax: igst,
    rcmLiability: igst,
    itcClaimable: igst, // Fully claimable
  }
}

/**
 * Calculate RCM for Indian Unregistered Supplier (Section 9(4) - GSTR-3B Table 3.1(d))
 *
 * Key characteristics:
 * - CGST + SGST if same state
 * - IGST if different state
 * - Reported in GSTR-3B Table 3.1(d)
 * - ITC is fully claimable (same as liability)
 *
 * @param input - Indian unregistered supplier calculation input
 * @returns RCM calculation result with appropriate tax split
 */
export function calculateIndianUnregisteredRCM(
  input: IndianUnregisteredInput
): RCMCalculationResult {
  const totalTaxRate = input.gstRate / 100
  const isSameState = input.supplierStateCode === input.recipientStateCode

  if (isSameState) {
    // Same state: Split into CGST + SGST
    const halfRate = totalTaxRate / 2
    const cgst = roundTo2Decimals(input.amount * halfRate)
    const sgst = roundTo2Decimals(input.amount * halfRate)
    const totalTax = cgst + sgst

    return {
      igst: 0,
      cgst,
      sgst,
      totalTax,
      rcmLiability: totalTax,
      itcClaimable: totalTax, // Fully claimable
    }
  } else {
    // Different state: IGST only
    const igst = roundTo2Decimals(input.amount * totalTaxRate)

    return {
      igst,
      cgst: 0,
      sgst: 0,
      totalTax: igst,
      rcmLiability: igst,
      itcClaimable: igst, // Fully claimable
    }
  }
}

/**
 * Get the GSTR-3B table for a given RCM type
 *
 * @param rcmType - The RCM type
 * @returns The GSTR-3B table reference
 */
export function getRCMGSTR3BTable(rcmType: RcmType): '3.1(a)' | '3.1(d)' {
  switch (rcmType) {
    case RcmType.IMPORT_OF_SERVICES:
      return '3.1(a)'
    case RcmType.INDIAN_UNREGISTERED:
      return '3.1(d)'
    default:
      throw new Error(`Unknown RCM type: ${rcmType}`)
  }
}

/**
 * Determine if a supplier qualifies for Import of Services RCM
 *
 * @param supplier - Supplier information
 * @returns True if this is import of services
 */
export function isImportOfServices(supplier: {
  supplierType?: string
  country?: string | null
  countryName?: string | null
  state?: string | null
  stateCode?: string | null
}): boolean {
  return supplier.supplierType === SupplierType.FOREIGN_SERVICE ||
         (!!supplier.country && !supplier.state && !supplier.stateCode)
}

/**
 * Round a number to 2 decimal places
 */
function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100
}
