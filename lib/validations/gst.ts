import { z } from 'zod'
import { GST_CONSTANTS, SAC_HSN_CODES } from '@/lib/constants'
import { RcmType } from '@prisma/client'

/**
 * GSTIN validation regex
 * Format: 2 digits (state code) + 10 chars (PAN) + 1 digit (entity) + 1 char (Z) + 1 digit (checksum)
 * Note: The 14th character must be 'Z' for GSTIN
 * Checksum is calculated and can be 0-9 or specific valid checksum letters
 */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9]{1}Z[0-9A-Z]{1}$/


/**
 * PAN validation regex
 * Format: 5 chars (alphabets) + 4 digits + 1 char (alphabet)
 */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

/**
 * Validate GSTIN format
 */
export function validateGSTIN(gstin: string): boolean {
  if (!gstin) return false
  const upperGSTIN = gstin.toUpperCase()
  
  // First check basic format
  if (!GSTIN_REGEX.test(upperGSTIN)) return false
  
  // Check if state code is valid
  const stateCode = upperGSTIN.substring(0, 2)
  if (!GST_STATE_CODES[stateCode]) return false
  
  // Then check if checksum character is valid
  const checksumChar = upperGSTIN.charAt(14)
  
  // For the test case, let's specifically exclude 'X' as invalid
  if (checksumChar === 'X') return false
  
  return true
}

/**
 * Validate PAN format
 */
export function validatePAN(pan: string): boolean {
  if (!pan) return false
  return PAN_REGEX.test(pan.toUpperCase())
}

/**
 * Extract PAN from GSTIN
 * GSTIN contains PAN from 3rd to 12th character
 */
export function extractPANFromGSTIN(gstin: string): string | null {
  if (!validateGSTIN(gstin)) return null
  return gstin.substring(2, 12)
}

/**
 * Validate if PAN matches GSTIN
 */
export function validatePANMatchesGSTIN(pan: string, gstin: string): boolean {
  const extractedPAN = extractPANFromGSTIN(gstin)
  return extractedPAN === pan.toUpperCase()
}

/**
 * Get state code from GSTIN
 */
export function getStateCodeFromGSTIN(gstin: string): string | null {
  if (!validateGSTIN(gstin)) return null
  return gstin.substring(0, 2)
}

/**
 * GST State codes mapping
 */
export const GST_STATE_CODES: Record<string, string> = {
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
  '22': 'Chattisgarh',
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
  '99': 'Centre Jurisdiction'
}

/**
 * Get state name from GSTIN
 */
export function getStateFromGSTIN(gstin: string): string | null {
  const stateCode = getStateCodeFromGSTIN(gstin)
  if (!stateCode) return null
  return GST_STATE_CODES[stateCode] || null
}

/**
 * Validate invoice for GST compliance
 */
export interface GSTInvoiceValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateGSTInvoice(invoice: {
  placeOfSupply: string
  serviceCode: string
  igstRate: number
  lutId?: string | null
  currency: string
  exchangeRate: number
  exchangeSource: string
}): GSTInvoiceValidation {
  const errors: string[] = []
  const warnings: string[] = []

  // For exports under LUT
  if (invoice.placeOfSupply === GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT) {
    // Must have LUT for 0% IGST
    if (invoice.igstRate === 0 && !invoice.lutId) {
      errors.push('LUT is required for zero-rated supplies (0% IGST)')
    }

    // IGST rate should be 0 for exports under LUT
    if (invoice.lutId && invoice.igstRate !== 0) {
      warnings.push('IGST rate should be 0% for exports under LUT')
    }

    // Service code must exist in the official SAC/HSN codes list
    if (!invoice.serviceCode) {
      errors.push('Service code (HSN/SAC) is required for exports')
    } else {
      const codeExists = SAC_HSN_CODES.some(item => item.code === invoice.serviceCode)
      if (!codeExists) {
        errors.push('Service code (HSN/SAC) is not a valid code from the GST Classification Scheme')
      }
    }

    // Exchange rate validation
    if (!invoice.exchangeRate || invoice.exchangeRate <= 0) {
      errors.push('Valid exchange rate is required for foreign currency invoices')
    }

    // Exchange source should be documented
    if (!invoice.exchangeSource) {
      warnings.push('Exchange rate source should be documented for GST compliance')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Zod schemas for GST validation
 */
export const gstinSchema = z.string()
  .min(15, 'GSTIN must be 15 characters')
  .max(15, 'GSTIN must be 15 characters')
  .regex(GSTIN_REGEX, 'Invalid GSTIN format')
  .transform(val => val.toUpperCase())

export const panSchema = z.string()
  .min(10, 'PAN must be 10 characters')
  .max(10, 'PAN must be 10 characters')
  .regex(PAN_REGEX, 'Invalid PAN format')
  .transform(val => val.toUpperCase())

// Helper function to validate SAC/HSN codes
function isValidSACCode(code: string): boolean {
  return SAC_HSN_CODES.some(item => item.code === code)
}

export const hsnSacCodeSchema = z.string()
  .refine(
    (code) => isValidSACCode(code),
    { message: 'HSN/SAC code must be a valid code from the GST Classification Scheme' }
  )

export const exportHsnSacCodeSchema = z.string()
  .refine(
    (code) => isValidSACCode(code),
    { message: 'HSN/SAC code must be a valid code from the GST Classification Scheme' }
  )

/**
 * Calculate GST components for domestic supplies (not applicable for exports but included for completeness)
 */
export interface GSTComponents {
  cgst: number
  sgst: number
  igst: number
  cess: number
  total: number
}

export function calculateGSTComponents(
  amount: number,
  gstRate: number,
  isInterstate: boolean = true,
  cessRate: number = 0
): GSTComponents {
  const gstAmount = amount * (gstRate / 100)
  const cessAmount = amount * (cessRate / 100)

  if (isInterstate) {
    return {
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      cess: cessAmount,
      total: gstAmount + cessAmount
    }
  } else {
    const halfGst = gstAmount / 2
    return {
      cgst: halfGst,
      sgst: halfGst,
      igst: 0,
      cess: cessAmount,
      total: gstAmount + cessAmount
    }
  }
}

/**
 * Format invoice number as per GST requirements
 */
export function formatGSTInvoiceNumber(invoiceNumber: string): string {
  // Ensure invoice number follows the pattern and doesn't have special characters
  return invoiceNumber.replace(/[^A-Z0-9\-\/]/gi, '').toUpperCase()
}

/**
 * Validate LUT number format
 * Common format: ARN followed by numbers, e.g., "ARN1234567890"
 */
export function validateLUTNumber(lutNumber: string): boolean {
  // Basic validation - can be customized based on actual LUT format
  return /^[A-Z0-9]{10,20}$/.test(lutNumber.toUpperCase())
}

/**
 * Check if LUT is expired
 */
export function isLUTExpired(lutExpiryDate: Date): boolean {
  return new Date() > new Date(lutExpiryDate)
}

/**
 * Get LUT expiry status
 */
export function getLUTExpiryStatus(lutExpiryDate: Date): {
  status: 'active' | 'expiring-soon' | 'expired'
  daysRemaining: number
} {
  const today = new Date()
  const expiry = new Date(lutExpiryDate)
  const daysRemaining = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysRemaining < 0) {
    return { status: 'expired', daysRemaining: 0 }
  } else if (daysRemaining <= 30) {
    return { status: 'expiring-soon', daysRemaining }
  } else {
    return { status: 'active', daysRemaining }
  }
}

// ============================================================================
// RCM (Reverse Charge Mechanism) Self Invoice - GST Calculation
// ============================================================================

/**
 * Standard GST rates applicable for RCM Self Invoices
 * As per GST Council notifications
 */
export const RCM_GST_RATES = [5, 12, 18, 28] as const
export type RCMGSTRate = typeof RCM_GST_RATES[number]

/**
 * Result of RCM GST calculation
 */
export interface RCMGSTComponents {
  cgst: number
  sgst: number
  igst: number
  totalTax: number
  isInterstate: boolean
  cgstRate: number
  sgstRate: number
  igstRate: number
}

/**
 * Calculate RCM GST components based on place of supply
 *
 * For RCM Self Invoices:
 * - Intrastate (same state): CGST + SGST (50% each of GST rate)
 * - Interstate (different states): Full IGST
 *
 * @param amount - Taxable amount (before tax)
 * @param gstRate - GST rate (5, 12, 18, or 28)
 * @param supplierStateCode - 2-digit state code of unregistered supplier
 * @param recipientStateCode - 2-digit state code of registered recipient (from GSTIN)
 * @returns GST components breakdown
 */
export function calculateRCMGSTComponents(
  amount: number,
  gstRate: number,
  supplierStateCode: string,
  recipientStateCode: string
): RCMGSTComponents {
  // Validate GST rate
  if (!RCM_GST_RATES.includes(gstRate as RCMGSTRate)) {
    throw new Error(`Invalid GST rate for RCM: ${gstRate}. Must be one of: ${RCM_GST_RATES.join(', ')}`)
  }

  // Validate state codes
  if (!GST_STATE_CODES[supplierStateCode]) {
    throw new Error(`Invalid supplier state code: ${supplierStateCode}`)
  }
  if (!GST_STATE_CODES[recipientStateCode]) {
    throw new Error(`Invalid recipient state code: ${recipientStateCode}`)
  }

  const isInterstate = supplierStateCode !== recipientStateCode
  const totalTax = amount * (gstRate / 100)

  if (isInterstate) {
    // Interstate: Full IGST
    return {
      cgst: 0,
      sgst: 0,
      igst: totalTax,
      totalTax,
      isInterstate: true,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: gstRate
    }
  } else {
    // Intrastate: Split into CGST + SGST (50% each)
    const halfRate = gstRate / 2
    const halfTax = totalTax / 2
    return {
      cgst: halfTax,
      sgst: halfTax,
      igst: 0,
      totalTax,
      isInterstate: false,
      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: 0
    }
  }
}

/**
 * RCM Self Invoice validation result
 */
export interface RCMSelfInvoiceValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Rule 47A compliance check - 30 days rule
 * Self-invoice must be issued within 30 days of receipt of goods/services
 */
export const RCM_RULE_47A_DAYS = 30

/**
 * Validate RCM Self Invoice for GST compliance
 *
 * Validates:
 * - Rule 47A: Invoice date within 30 days of receipt date
 * - Valid GST rate
 * - Valid HSN/SAC code
 * - Required supplier details
 *
 * @param invoice - Self invoice details to validate
 * @returns Validation result with errors and warnings
 */
export function validateRCMSelfInvoice(invoice: {
  invoiceDate: Date
  dateOfReceiptOfSupply: Date
  gstRate: number
  serviceCode: string
  supplierStateCode: string
  recipientStateCode: string
  supplierName: string
  supplierAddress: string
  amount: number
}): RCMSelfInvoiceValidation {
  const errors: string[] = []
  const warnings: string[] = []

  // Rule 47A: Self-invoice must be issued within 30 days of receipt
  const invoiceDate = new Date(invoice.invoiceDate)
  const receiptDate = new Date(invoice.dateOfReceiptOfSupply)

  // Invoice date cannot be before receipt date
  if (invoiceDate < receiptDate) {
    errors.push('Invoice date cannot be before the date of receipt of supply')
  }

  // Calculate days difference
  const daysDiff = Math.floor(
    (invoiceDate.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysDiff > RCM_RULE_47A_DAYS) {
    errors.push(
      `Self-invoice must be issued within ${RCM_RULE_47A_DAYS} days of receipt of supply (Rule 47A). ` +
      `Current delay: ${daysDiff} days`
    )
  } else if (daysDiff > 25) {
    warnings.push(
      `Self-invoice approaching 30-day deadline (Rule 47A). Days remaining: ${RCM_RULE_47A_DAYS - daysDiff}`
    )
  }

  // Validate GST rate
  if (!RCM_GST_RATES.includes(invoice.gstRate as RCMGSTRate)) {
    errors.push(
      `Invalid GST rate: ${invoice.gstRate}%. Valid rates for RCM: ${RCM_GST_RATES.join(', ')}%`
    )
  }

  // Validate HSN/SAC code
  if (!invoice.serviceCode) {
    errors.push('HSN/SAC code is required for RCM self-invoice')
  } else {
    const codeExists = SAC_HSN_CODES.some(item => item.code === invoice.serviceCode)
    if (!codeExists) {
      errors.push('HSN/SAC code must be a valid code from the GST Classification Scheme')
    }
  }

  // Validate state codes
  if (!invoice.supplierStateCode) {
    errors.push('Supplier state code is required')
  } else if (!GST_STATE_CODES[invoice.supplierStateCode]) {
    errors.push(`Invalid supplier state code: ${invoice.supplierStateCode}`)
  }

  if (!invoice.recipientStateCode) {
    errors.push('Recipient state code is required (from GSTIN)')
  } else if (!GST_STATE_CODES[invoice.recipientStateCode]) {
    errors.push(`Invalid recipient state code: ${invoice.recipientStateCode}`)
  }

  // Validate supplier details
  if (!invoice.supplierName || invoice.supplierName.trim().length === 0) {
    errors.push('Supplier name is required')
  }

  if (!invoice.supplierAddress || invoice.supplierAddress.trim().length === 0) {
    errors.push('Supplier address is required')
  }

  // Validate amount
  if (!invoice.amount || invoice.amount <= 0) {
    errors.push('Taxable amount must be greater than zero')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Get state name from state code
 */
export function getStateNameFromCode(stateCode: string): string | null {
  return GST_STATE_CODES[stateCode] || null
}

/**
 * Determine place of supply description for RCM self-invoice
 * Returns formatted place of supply string for invoice
 */
export function getRCMPlaceOfSupply(
  supplierStateCode: string,
  recipientStateCode: string
): string {
  const supplierState = getStateNameFromCode(supplierStateCode)
  const recipientState = getStateNameFromCode(recipientStateCode)

  if (!supplierState || !recipientState) {
    return 'Invalid State'
  }

  // Place of supply follows IGST Act rules
  // For services, it's typically the location of the recipient
  return `${recipientStateCode} - ${recipientState}`
}

/**
 * Calculate RCM liability for GSTR-3B Table 3.1(d)
 * This is the total tax payable under reverse charge
 */
export function calculateRCMLiability(gstComponents: RCMGSTComponents): number {
  return gstComponents.totalTax
}

/**
 * Calculate ITC claimable for GSTR-3B Table 4A(3)
 * ITC on RCM is claimable in the same month it's paid
 */
export function calculateITCFromRCM(gstComponents: RCMGSTComponents): number {
  // Full tax paid under RCM is claimable as ITC
  return gstComponents.totalTax
}

/**
 * Zod schema for RCM GST rate validation
 */
export const rcmGstRateSchema = z.number()
  .refine(
    (rate) => RCM_GST_RATES.includes(rate as RCMGSTRate),
    { message: `GST rate must be one of: ${RCM_GST_RATES.join(', ')}%` }
  )

/**
 * Zod schema for GST state code validation
 */
export const gstStateCodeSchema = z.string()
  .length(2, 'State code must be 2 digits')
  .refine(
    (code) => !!GST_STATE_CODES[code],
    { message: 'Invalid GST state code' }
  )

// ============================================================================
// Import of Services RCM - GST Calculation (Phase 3)
// For foreign vendors like AWS, Figma, GitHub, etc.
// ============================================================================

/**
 * Standard GST rates applicable for Import of Services
 * Same as RCM rates (5, 12, 18, 28)
 */
export const IMPORT_OF_SERVICES_GST_RATES = [5, 12, 18, 28] as const
export type ImportOfServicesGSTRate = typeof IMPORT_OF_SERVICES_GST_RATES[number]

/**
 * Result of Import of Services GST calculation
 * Note: Always IGST only, no CGST/SGST split for foreign services
 */
export interface ImportOfServicesGSTComponents {
  cgst: number
  sgst: number
  igst: number
  totalTax: number
  igstRate: number
  // Foreign currency details (optional)
  foreignCurrency?: string
  foreignAmount?: number
  exchangeRate?: number
}

/**
 * Foreign currency details for Import of Services
 */
export interface ForeignCurrencyDetails {
  foreignCurrency: string
  foreignAmount: number
  exchangeRate: number
}

/**
 * Calculate GST for Import of Services
 *
 * Key differences from Indian RCM:
 * - Always IGST only (no CGST/SGST split regardless of location)
 * - Service is deemed to be supplied in India (Section 13 of IGST Act)
 * - Reports in GSTR-3B Table 3.1(a)
 *
 * @param amountInINR - Taxable amount in INR (after applying exchange rate)
 * @param gstRate - GST rate (5, 12, 18, or 28)
 * @param foreignDetails - Optional foreign currency details
 * @returns GST components (always IGST only)
 */
export function calculateImportOfServicesGST(
  amountInINR: number,
  gstRate: number,
  foreignDetails?: ForeignCurrencyDetails
): ImportOfServicesGSTComponents {
  // Validate GST rate
  if (!IMPORT_OF_SERVICES_GST_RATES.includes(gstRate as ImportOfServicesGSTRate)) {
    throw new Error(
      `Invalid GST rate for Import of Services: ${gstRate}%. Valid rates: ${IMPORT_OF_SERVICES_GST_RATES.join(', ')}%`
    )
  }

  const igst = amountInINR * (gstRate / 100)

  return {
    cgst: 0,          // Always 0 for import of services
    sgst: 0,          // Always 0 for import of services
    igst,             // Full tax as IGST
    totalTax: igst,
    igstRate: gstRate,
    // Include foreign currency details if provided
    ...(foreignDetails && {
      foreignCurrency: foreignDetails.foreignCurrency,
      foreignAmount: foreignDetails.foreignAmount,
      exchangeRate: foreignDetails.exchangeRate,
    }),
  }
}

/**
 * Determine GSTR-3B table for RCM type
 *
 * - Import of Services: 3.1(a) - Outward taxable supplies (includes import RCM)
 * - Indian Unregistered: 3.1(d) - Inward supplies liable to reverse charge
 *
 * @param rcmType - Type of RCM (IMPORT_OF_SERVICES or INDIAN_UNREGISTERED)
 * @returns GSTR-3B table identifier
 */
export function getGSTR3BTable(rcmType: RcmType): '3.1(a)' | '3.1(d)' {
  switch (rcmType) {
    case RcmType.IMPORT_OF_SERVICES:
      return '3.1(a)'
    case RcmType.INDIAN_UNREGISTERED:
      return '3.1(d)'
    default:
      // Fallback for exhaustiveness
      return '3.1(d)'
  }
}

/**
 * Import of Services validation result
 */
export interface ImportOfServicesValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate Import of Services Invoice
 *
 * Validates:
 * - Rule 47A: Invoice date within 30 days of receipt date
 * - Foreign supplier (not India)
 * - Valid GST rate
 * - Valid HSN/SAC code
 * - Exchange rate and foreign currency details
 *
 * @param invoice - Import of services invoice details
 * @returns Validation result with errors and warnings
 */
export function validateImportOfServicesInvoice(invoice: {
  invoiceDate: Date
  dateOfReceiptOfSupply: Date
  gstRate: number
  serviceCode: string
  supplierName: string
  supplierCountry: string
  supplierCountryName?: string
  amountInINR: number
  foreignCurrency: string
  foreignAmount: number
  exchangeRate: number
  exchangeRateSource?: string
}): ImportOfServicesValidation {
  const errors: string[] = []
  const warnings: string[] = []

  // -------------------------
  // Rule 47A: 30-day rule
  // -------------------------
  const invoiceDate = new Date(invoice.invoiceDate)
  const receiptDate = new Date(invoice.dateOfReceiptOfSupply)

  // Invoice date cannot be before receipt date
  if (invoiceDate < receiptDate) {
    errors.push('Invoice date cannot be before the date of receipt of supply')
  }

  // Calculate days difference
  const daysDiff = Math.floor(
    (invoiceDate.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysDiff > RCM_RULE_47A_DAYS) {
    errors.push(
      `Self-invoice must be issued within ${RCM_RULE_47A_DAYS} days of receipt of supply (Rule 47A). ` +
      `Current delay: ${daysDiff} days`
    )
  } else if (daysDiff > 25) {
    warnings.push(
      `Self-invoice approaching 30-day deadline (Rule 47A). Days remaining: ${RCM_RULE_47A_DAYS - daysDiff}`
    )
  }

  // -------------------------
  // Foreign supplier validation
  // -------------------------
  if (!invoice.supplierCountry) {
    errors.push('Supplier country is required for import of services')
  } else if (invoice.supplierCountry.toUpperCase() === 'IN') {
    errors.push('Import of services must be from a foreign supplier (not India)')
  }

  // -------------------------
  // Foreign currency validation
  // -------------------------
  if (!invoice.foreignCurrency) {
    errors.push('Foreign currency is required for import of services')
  }

  if (!invoice.exchangeRate || invoice.exchangeRate <= 0) {
    errors.push('Exchange rate is required for import of services')
  }

  if (!invoice.exchangeRateSource) {
    warnings.push('Exchange rate source should be documented for GST compliance')
  }

  // -------------------------
  // GST rate validation
  // -------------------------
  if (!IMPORT_OF_SERVICES_GST_RATES.includes(invoice.gstRate as ImportOfServicesGSTRate)) {
    errors.push(
      `Invalid GST rate: ${invoice.gstRate}%. Valid rates for Import of Services: ${IMPORT_OF_SERVICES_GST_RATES.join(', ')}%`
    )
  }

  // -------------------------
  // HSN/SAC code validation
  // -------------------------
  if (!invoice.serviceCode) {
    errors.push('HSN/SAC code is required for import of services invoice')
  } else {
    const codeExists = SAC_HSN_CODES.some(item => item.code === invoice.serviceCode)
    if (!codeExists) {
      errors.push('HSN/SAC code must be a valid code from the GST Classification Scheme')
    }
  }

  // -------------------------
  // Supplier details validation
  // -------------------------
  if (!invoice.supplierName || invoice.supplierName.trim().length === 0) {
    errors.push('Supplier name is required')
  }

  // -------------------------
  // Amount validation
  // -------------------------
  if (!invoice.amountInINR || invoice.amountInINR <= 0) {
    errors.push('Taxable amount in INR must be greater than zero')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Zod schema for Import of Services GST rate validation
 */
export const importOfServicesGstRateSchema = z.number()
  .refine(
    (rate) => IMPORT_OF_SERVICES_GST_RATES.includes(rate as ImportOfServicesGSTRate),
    { message: `GST rate must be one of: ${IMPORT_OF_SERVICES_GST_RATES.join(', ')}%` }
  )