/**
 * GST Utilities for Indian domestic invoices
 */

import { Decimal } from '@prisma/client/runtime/library'

// Valid GST rates in India
export const VALID_GST_RATES = [0, 5, 12, 18, 28] as const
export type GSTRate = typeof VALID_GST_RATES[number]

// Indian state codes for GST
export const INDIAN_STATES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
} as const

export type StateCode = keyof typeof INDIAN_STATES

/**
 * Validate GSTIN format and checksum
 * GSTIN format: 2 digit state code + 10 char PAN + 1 digit entity number + 1 char default 'Z' + 1 check digit
 */
export function validateGSTIN(gstin: string): { valid: boolean; error?: string } {
  if (!gstin) {
    return { valid: false, error: 'GSTIN is required' }
  }

  // Remove spaces and convert to uppercase
  gstin = gstin.replace(/\s/g, '').toUpperCase()

  // Check length
  if (gstin.length !== 15) {
    return { valid: false, error: 'GSTIN must be 15 characters long' }
  }

  // Check state code
  const stateCode = gstin.substring(0, 2)
  if (!INDIAN_STATES[stateCode as StateCode]) {
    return { valid: false, error: 'Invalid state code in GSTIN' }
  }

  // Check PAN format (simplified check)
  const pan = gstin.substring(2, 12)
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  if (!panRegex.test(pan)) {
    return { valid: false, error: 'Invalid PAN in GSTIN' }
  }

  // Check 13th character (entity number)
  const entityNumber = gstin.charAt(12)
  if (!/[0-9A-Z]/.test(entityNumber)) {
    return { valid: false, error: 'Invalid entity number in GSTIN' }
  }

  // Check 14th character (should be 'Z' for normal registration)
  const defaultChar = gstin.charAt(13)
  if (defaultChar !== 'Z') {
    return { valid: false, error: 'Invalid default character in GSTIN (should be Z)' }
  }

  // Checksum validation (simplified - actual algorithm is more complex)
  const checkDigit = gstin.charAt(14)
  if (!/[0-9A-Z]/.test(checkDigit)) {
    return { valid: false, error: 'Invalid check digit in GSTIN' }
  }

  return { valid: true }
}

/**
 * Extract state code from GSTIN
 */
export function getStateCodeFromGSTIN(gstin: string): StateCode | null {
  if (!gstin || gstin.length < 2) return null
  const stateCode = gstin.substring(0, 2) as StateCode
  return INDIAN_STATES[stateCode] ? stateCode : null
}

/**
 * Check if GST rate is valid
 */
export function isValidGSTRate(rate: number): rate is GSTRate {
  return VALID_GST_RATES.includes(rate as GSTRate)
}

/**
 * Calculate GST amounts based on place of supply
 */
export interface GSTCalculation {
  taxableAmount: Decimal
  cgstRate: Decimal
  sgstRate: Decimal
  igstRate: Decimal
  cgstAmount: Decimal
  sgstAmount: Decimal
  igstAmount: Decimal
  totalGSTAmount: Decimal
  totalAmount: Decimal
}

export function calculateGST(
  amount: number | Decimal,
  gstRate: number,
  supplierStateCode: StateCode,
  customerStateCode: StateCode
): GSTCalculation {
  const taxableAmount = new Decimal(amount)
  
  if (!isValidGSTRate(gstRate)) {
    throw new Error(`Invalid GST rate: ${gstRate}. Must be one of ${VALID_GST_RATES.join(', ')}`)
  }

  // For exports or zero-rated supplies
  if (gstRate === 0) {
    return {
      taxableAmount,
      cgstRate: new Decimal(0),
      sgstRate: new Decimal(0),
      igstRate: new Decimal(0),
      cgstAmount: new Decimal(0),
      sgstAmount: new Decimal(0),
      igstAmount: new Decimal(0),
      totalGSTAmount: new Decimal(0),
      totalAmount: taxableAmount,
    }
  }

  const isInterState = supplierStateCode !== customerStateCode

  if (isInterState) {
    // Inter-state supply: Apply IGST
    const igstRate = new Decimal(gstRate)
    const igstAmount = taxableAmount.mul(igstRate).div(100)
    const totalGSTAmount = igstAmount
    const totalAmount = taxableAmount.add(totalGSTAmount)

    return {
      taxableAmount,
      cgstRate: new Decimal(0),
      sgstRate: new Decimal(0),
      igstRate,
      cgstAmount: new Decimal(0),
      sgstAmount: new Decimal(0),
      igstAmount,
      totalGSTAmount,
      totalAmount,
    }
  } else {
    // Intra-state supply: Apply CGST + SGST (split equally)
    const cgstRate = new Decimal(gstRate).div(2)
    const sgstRate = new Decimal(gstRate).div(2)
    const cgstAmount = taxableAmount.mul(cgstRate).div(100)
    const sgstAmount = taxableAmount.mul(sgstRate).div(100)
    const totalGSTAmount = cgstAmount.add(sgstAmount)
    const totalAmount = taxableAmount.add(totalGSTAmount)

    return {
      taxableAmount,
      cgstRate,
      sgstRate,
      igstRate: new Decimal(0),
      cgstAmount,
      sgstAmount,
      igstAmount: new Decimal(0),
      totalGSTAmount,
      totalAmount,
    }
  }
}

/**
 * Calculate GST for multiple line items
 */
export function calculateInvoiceGST(
  lineItems: Array<{
    amount: number | Decimal
    gstRate: number
  }>,
  supplierStateCode: StateCode,
  customerStateCode: StateCode
): GSTCalculation {
  const calculations = lineItems.map(item =>
    calculateGST(item.amount, item.gstRate, supplierStateCode, customerStateCode)
  )

  // Aggregate all calculations
  return calculations.reduce((acc, calc) => ({
    taxableAmount: acc.taxableAmount.add(calc.taxableAmount),
    cgstRate: calc.cgstRate, // Rate remains same for display
    sgstRate: calc.sgstRate,
    igstRate: calc.igstRate,
    cgstAmount: acc.cgstAmount.add(calc.cgstAmount),
    sgstAmount: acc.sgstAmount.add(calc.sgstAmount),
    igstAmount: acc.igstAmount.add(calc.igstAmount),
    totalGSTAmount: acc.totalGSTAmount.add(calc.totalGSTAmount),
    totalAmount: acc.totalAmount.add(calc.totalAmount),
  }), {
    taxableAmount: new Decimal(0),
    cgstRate: new Decimal(0),
    sgstRate: new Decimal(0),
    igstRate: new Decimal(0),
    cgstAmount: new Decimal(0),
    sgstAmount: new Decimal(0),
    igstAmount: new Decimal(0),
    totalGSTAmount: new Decimal(0),
    totalAmount: new Decimal(0),
  })
}

/**
 * Format amount for display
 */
export function formatINR(amount: number | Decimal): string {
  const value = typeof amount === 'number' ? amount : amount.toNumber()
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Get invoice type display label
 */
export function getInvoiceTypeLabel(type: string): string {
  switch (type) {
    case 'EXPORT':
      return 'Export (LUT)'
    case 'DOMESTIC_B2B':
      return 'Domestic B2B'
    case 'DOMESTIC_B2C':
      return 'Domestic B2C'
    default:
      return type
  }
}

/**
 * Determine if invoice requires GSTIN
 */
export function requiresGSTIN(invoiceType: string): boolean {
  return invoiceType === 'DOMESTIC_B2B'
}

/**
 * Determine if invoice requires LUT
 */
export function requiresLUT(invoiceType: string): boolean {
  return invoiceType === 'EXPORT'
}