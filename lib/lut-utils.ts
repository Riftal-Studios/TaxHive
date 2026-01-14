import type { LUT } from '@prisma/client'

/**
 * LUT Status types
 */
export type LUTStatus = 'valid' | 'expiring' | 'expired' | 'not_started'

/**
 * LUT Expiry Warning
 */
export interface LUTExpiryWarning {
  type: 'warning' | 'error'
  message: string
}

/**
 * Check if a LUT is valid for a given invoice date
 * LUT must be active and invoice date must be within validFrom and validTill range
 */
export function isLUTValid(lut: LUT, invoiceDate: Date): boolean {
  if (!lut.isActive) {
    return false
  }

  const invoiceTime = invoiceDate.getTime()
  const validFromTime = lut.validFrom.getTime()
  const validTillTime = lut.validTill.getTime()

  return invoiceTime >= validFromTime && invoiceTime <= validTillTime
}

/**
 * Calculate days until LUT expiry from current date
 * Returns negative number if already expired
 */
export function daysUntilLUTExpiry(lut: LUT): number {
  const now = new Date()
  const validTill = lut.validTill

  // Reset time to start of day for accurate day calculation
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const validTillStart = new Date(
    validTill.getFullYear(),
    validTill.getMonth(),
    validTill.getDate()
  )

  const diffTime = validTillStart.getTime() - nowStart.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Check if a reminder should be sent for an expiring LUT
 * Conditions:
 * - LUT is active
 * - No reminder has been sent yet
 * - LUT expires within 30 days but is not yet expired
 */
export function shouldSendLUTReminder(lut: LUT): boolean {
  if (!lut.isActive) {
    return false
  }

  if (lut.reminderSentAt !== null) {
    return false
  }

  const daysUntilExpiry = daysUntilLUTExpiry(lut)

  // Only send reminder if expiring within 30 days and not already expired
  return daysUntilExpiry > 0 && daysUntilExpiry <= 30
}

/**
 * Get the current status of a LUT
 * - 'not_started': validFrom is in the future
 * - 'valid': currently valid with more than 30 days remaining
 * - 'expiring': currently valid but expires within 30 days
 * - 'expired': validTill is in the past
 */
export function getLUTStatus(lut: LUT): LUTStatus {
  const now = new Date()
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const validFromStart = new Date(
    lut.validFrom.getFullYear(),
    lut.validFrom.getMonth(),
    lut.validFrom.getDate()
  )

  const validTillStart = new Date(
    lut.validTill.getFullYear(),
    lut.validTill.getMonth(),
    lut.validTill.getDate()
  )

  // Check if LUT hasn't started yet
  if (nowStart < validFromStart) {
    return 'not_started'
  }

  // Check if LUT has expired
  if (nowStart > validTillStart) {
    return 'expired'
  }

  // LUT is currently valid - check if expiring soon
  const daysUntilExpiry = daysUntilLUTExpiry(lut)
  if (daysUntilExpiry <= 30) {
    return 'expiring'
  }

  return 'valid'
}

/**
 * Get a warning message for LUT expiry status
 * Returns null if LUT is valid with more than 30 days remaining
 */
export function getLUTExpiryWarning(lut: LUT): LUTExpiryWarning | null {
  const status = getLUTStatus(lut)

  if (status === 'valid' || status === 'not_started') {
    return null
  }

  if (status === 'expired') {
    return {
      type: 'error',
      message: `LUT ${lut.lutNumber} has expired. Please renew your LUT to continue making export invoices.`,
    }
  }

  // Status is 'expiring'
  const daysRemaining = daysUntilLUTExpiry(lut)
  return {
    type: 'warning',
    message: `LUT ${lut.lutNumber} will expire in ${daysRemaining} days. Please renew before expiry.`,
  }
}

/**
 * Find the active LUT that covers a given invoice date
 * Returns null if no valid LUT found
 */
export function getActiveLUTForInvoice(luts: LUT[], invoiceDate: Date): LUT | null {
  if (luts.length === 0) {
    return null
  }

  // Find first LUT that is valid for the invoice date
  const validLUT = luts.find((lut) => isLUTValid(lut, invoiceDate))

  return validLUT || null
}
