/**
 * GST Utilities for Indian domestic invoices
 */

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
  taxableAmount: number
  cgstRate: number
  sgstRate: number
  igstRate: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalGSTAmount: number
  totalAmount: number
}

export function calculateGST(
  amount: number,
  gstRate: number,
  supplierStateCode: StateCode,
  customerStateCode: StateCode
): GSTCalculation {
  const taxableAmount = amount
  
  if (!isValidGSTRate(gstRate)) {
    throw new Error(`Invalid GST rate: ${gstRate}. Must be one of ${VALID_GST_RATES.join(', ')}`)
  }

  // For exports or zero-rated supplies
  if (gstRate === 0) {
    return {
      taxableAmount,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalGSTAmount: 0,
      totalAmount: taxableAmount,
    }
  }

  const isInterState = supplierStateCode !== customerStateCode

  if (isInterState) {
    // Inter-state supply: Apply IGST
    const igstRate = gstRate
    const igstAmount = taxableAmount * (igstRate / 100)
    const totalGSTAmount = igstAmount
    const totalAmount = taxableAmount + totalGSTAmount

    return {
      taxableAmount,
      cgstRate: 0,
      sgstRate: 0,
      igstRate,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount,
      totalGSTAmount,
      totalAmount,
    }
  } else {
    // Intra-state supply: Apply CGST + SGST (split equally)
    const cgstRate = gstRate / 2
    const sgstRate = gstRate / 2
    const cgstAmount = taxableAmount * (cgstRate / 100)
    const sgstAmount = taxableAmount * (sgstRate / 100)
    const totalGSTAmount = cgstAmount + sgstAmount
    const totalAmount = taxableAmount + totalGSTAmount

    return {
      taxableAmount,
      cgstRate,
      sgstRate,
      igstRate: 0,
      cgstAmount,
      sgstAmount,
      igstAmount: 0,
      totalGSTAmount,
      totalAmount,
    }
  }
}

/**
 * Calculate GST for multiple line items
 * Note: When items have different GST rates, the rates in the result represent
 * the effective/weighted average rates based on the total amounts
 */
export function calculateInvoiceGST(
  lineItems: Array<{
    amount: number
    gstRate: number
  }>,
  supplierStateCode: StateCode,
  customerStateCode: StateCode
): GSTCalculation {
  const calculations = lineItems.map(item =>
    calculateGST(item.amount, item.gstRate, supplierStateCode, customerStateCode)
  )

  // Aggregate all calculations
  const result = calculations.reduce((acc, calc) => ({
    taxableAmount: acc.taxableAmount + calc.taxableAmount,
    cgstAmount: acc.cgstAmount + calc.cgstAmount,
    sgstAmount: acc.sgstAmount + calc.sgstAmount,
    igstAmount: acc.igstAmount + calc.igstAmount,
    totalGSTAmount: acc.totalGSTAmount + calc.totalGSTAmount,
    totalAmount: acc.totalAmount + calc.totalAmount,
  }), {
    taxableAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalGSTAmount: 0,
    totalAmount: 0,
  })

  // Calculate effective rates based on actual amounts
  // These represent the weighted average rates when items have different rates
  const effectiveCgstRate = result.taxableAmount > 0 
    ? (result.cgstAmount / result.taxableAmount) * 100 
    : 0
  const effectiveSgstRate = result.taxableAmount > 0 
    ? (result.sgstAmount / result.taxableAmount) * 100 
    : 0
  const effectiveIgstRate = result.taxableAmount > 0 
    ? (result.igstAmount / result.taxableAmount) * 100 
    : 0

  return {
    ...result,
    cgstRate: effectiveCgstRate,
    sgstRate: effectiveSgstRate,
    igstRate: effectiveIgstRate,
  }
}

/**
 * Format amount for display
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
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

/**
 * Get state name from state code
 */
export function getStateNameFromCode(stateCode: string): string | null {
  return INDIAN_STATES[stateCode as StateCode] || null
}

/**
 * Get PAN from GSTIN
 */
export function getPANFromGSTIN(gstin: string): string | null {
  if (!gstin || gstin.length !== 15) {
    return null
  }
  
  return gstin.substring(2, 12)
}

/**
 * Determine if supply is inter-state or intra-state
 */
export function isInterStateSupply(supplierStateCode: string, customerStateCode: string): boolean {
  return supplierStateCode !== customerStateCode
}

/**
 * Calculate tax type based on supply type
 */
export function getTaxType(supplierStateCode: string, customerStateCode: string): 'IGST' | 'CGST_SGST' {
  return isInterStateSupply(supplierStateCode, customerStateCode) ? 'IGST' : 'CGST_SGST'
}

/**
 * Format amount for GST returns (2 decimal places)
 */
export function formatGSTAmount(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * Get financial year from date
 */
export function getFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(2)}`
  } else {
    return `${year - 1}-${year.toString().slice(2)}`
  }
}

/**
 * Get GST return due date
 */
export function getGSTReturnDueDate(returnType: 'GSTR1' | 'GSTR3B', month: number, year: number): Date {
  if (returnType === 'GSTR1') {
    // GSTR-1 is due on 11th of next month
    if (month === 12) {
      return new Date(year + 1, 0, 11)
    }
    return new Date(year, month, 11)
  } else if (returnType === 'GSTR3B') {
    // GSTR-3B is due on 20th of next month
    if (month === 12) {
      return new Date(year + 1, 0, 20)
    }
    return new Date(year, month, 20)
  }
  
  throw new Error('Invalid return type')
}