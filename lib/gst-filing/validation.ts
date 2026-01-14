/**
 * Filing Item Validation
 *
 * Validates invoices for GST filing and generates flags for issues that
 * need attention or review.
 *
 * Flag Types:
 * - ERROR: Must be resolved before filing (e.g., expired LUT)
 * - WARNING: Should be reviewed (e.g., missing payment voucher)
 * - INFO: Informational (e.g., high-value transaction)
 */

import type { InvoiceType } from '@prisma/client'

// Flag severity levels
export enum FlagSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

// Validation flag
export interface ValidationFlag {
  code: string
  message: string
  severity: FlagSeverity
}

// Input type for validation
export interface InvoiceForValidation {
  invoiceType: InvoiceType
  isRCM: boolean
  clientCountry: string | null
  clientGstin: string | null
  lutId: string | null
  lutExpiryDate: Date | null
  invoiceDate: Date
  totalInINR: number
  igstAmount: number
  paymentVoucherId: string | null
}

// Thresholds
const HIGH_VALUE_THRESHOLD = 1000000 // ₹10 Lakhs

/**
 * Check if a country is India
 */
function isIndianCountry(country: string | null): boolean {
  if (!country) return false
  const normalized = country.toUpperCase().trim()
  return normalized === 'IN' || normalized === 'IND' || normalized === 'INDIA'
}

/**
 * Check if invoice is an export
 */
function isExport(invoice: InvoiceForValidation): boolean {
  if (invoice.invoiceType === 'SELF_INVOICE') return false
  if (invoice.clientGstin) return false
  if (isIndianCountry(invoice.clientCountry)) return false
  return true
}

/**
 * Parse period string to get year and month
 */
function parsePeriod(period: string): { year: number; month: number } {
  const [yearStr, monthStr] = period.split('-')
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
  }
}

/**
 * Check if invoice date is within the filing period
 */
function isInvoiceInPeriod(invoiceDate: Date, period: string): boolean {
  const { year, month } = parsePeriod(period)
  const invoiceYear = invoiceDate.getFullYear()
  const invoiceMonth = invoiceDate.getMonth() + 1 // 1-indexed

  return invoiceYear === year && invoiceMonth === month
}

/**
 * Validate an invoice for filing and return any flags
 *
 * @param invoice - Invoice to validate
 * @param period - Filing period in YYYY-MM format
 * @returns Array of validation flags
 */
export function validateFilingItem(
  invoice: InvoiceForValidation,
  period: string
): ValidationFlag[] {
  const flags: ValidationFlag[] = []

  // LUT Validation for exports
  if (isExport(invoice)) {
    // Check if export without LUT (and no IGST paid)
    if (!invoice.lutId && invoice.igstAmount === 0) {
      flags.push({
        code: 'EXPORT_NO_LUT',
        message: 'Export invoice without LUT. Either file LUT or pay IGST.',
        severity: FlagSeverity.WARNING,
      })
    }

    // Check for expired LUT
    if (invoice.lutId && invoice.lutExpiryDate) {
      if (invoice.invoiceDate > invoice.lutExpiryDate) {
        flags.push({
          code: 'LUT_EXPIRED',
          message: 'LUT was expired at the time of invoice. Renew LUT or pay IGST.',
          severity: FlagSeverity.ERROR,
        })
      }
    }
  }

  // RCM Payment Voucher Validation
  if (invoice.isRCM && invoice.invoiceType === 'SELF_INVOICE') {
    if (!invoice.paymentVoucherId) {
      flags.push({
        code: 'RCM_NO_PAYMENT_VOUCHER',
        message: 'RCM self-invoice without payment voucher. Generate payment voucher for records.',
        severity: FlagSeverity.WARNING,
      })
    }
  }

  // Period Validation
  if (!isInvoiceInPeriod(invoice.invoiceDate, period)) {
    flags.push({
      code: 'INVOICE_OUTSIDE_PERIOD',
      message: `Invoice date is outside the filing period ${period}.`,
      severity: FlagSeverity.WARNING,
    })
  }

  // High Value Transaction
  if (invoice.totalInINR > HIGH_VALUE_THRESHOLD) {
    flags.push({
      code: 'HIGH_VALUE_TRANSACTION',
      message: `High value transaction (>₹10L). Verify details before filing.`,
      severity: FlagSeverity.INFO,
    })
  }

  return flags
}

/**
 * Calculate confidence score based on flags
 *
 * @param flags - Array of validation flags
 * @returns Confidence score (0-100)
 */
export function calculateConfidenceScore(flags: ValidationFlag[]): number {
  if (flags.length === 0) return 100

  let score = 100

  for (const flag of flags) {
    switch (flag.severity) {
      case FlagSeverity.ERROR:
        score -= 30
        break
      case FlagSeverity.WARNING:
        score -= 15
        break
      case FlagSeverity.INFO:
        score -= 5
        break
    }
  }

  return Math.max(0, score)
}

/**
 * Check if any flags are blocking (errors that must be resolved)
 *
 * @param flags - Array of validation flags
 * @returns True if there are blocking errors
 */
export function hasBlockingErrors(flags: ValidationFlag[]): boolean {
  return flags.some((f) => f.severity === FlagSeverity.ERROR)
}

/**
 * Get flags grouped by severity
 *
 * @param flags - Array of validation flags
 * @returns Flags grouped by severity
 */
export function groupFlagsBySeverity(
  flags: ValidationFlag[]
): Record<FlagSeverity, ValidationFlag[]> {
  return {
    [FlagSeverity.ERROR]: flags.filter((f) => f.severity === FlagSeverity.ERROR),
    [FlagSeverity.WARNING]: flags.filter((f) => f.severity === FlagSeverity.WARNING),
    [FlagSeverity.INFO]: flags.filter((f) => f.severity === FlagSeverity.INFO),
  }
}
