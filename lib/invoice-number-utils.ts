/**
 * Utility to get the next invoice number by finding the highest existing number
 */
export function getNextInvoiceSequence(invoiceNumbers: string[]): number {
  if (invoiceNumbers.length === 0) {
    return 1
  }

  // Extract sequence numbers from invoice numbers (format: FY24-25/123)
  const sequences = invoiceNumbers
    .map(num => {
      const match = num.match(/\/(\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    .filter(seq => !isNaN(seq))

  if (sequences.length === 0) {
    return 1
  }

  // Find the highest sequence number and add 1
  return Math.max(...sequences) + 1
}

// ============================================================================
// Self Invoice Number Generation (SI/YYYY-YY/XXXX format)
// ============================================================================

/**
 * Generate self-invoice number in format SI/{YYYY-YY}/{NUMBER}
 * @param fiscalYear - Format: 2025-26
 * @param sequenceNumber - The sequence number (1, 2, 3, etc.)
 * @returns Self-invoice number like SI/2025-26/0001
 */
export function generateSelfInvoiceNumber(fiscalYear: string, sequenceNumber: number): string {
  const paddedNumber = sequenceNumber.toString().padStart(4, '0')
  return `SI/${fiscalYear}/${paddedNumber}`
}

/**
 * Extract sequence number from self-invoice number
 * @param invoiceNumber - Format: SI/2025-26/0001
 * @returns The sequence number or null if invalid format
 */
export function extractSelfInvoiceSequence(invoiceNumber: string): number | null {
  const match = invoiceNumber.match(/^SI\/\d{4}-\d{2}\/(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Get next self-invoice sequence from existing invoice numbers
 * @param invoiceNumbers - Array of existing self-invoice numbers
 * @returns The next sequence number
 */
export function getNextSelfInvoiceSequence(invoiceNumbers: string[]): number {
  if (invoiceNumbers.length === 0) {
    return 1
  }

  const sequences = invoiceNumbers
    .map(num => extractSelfInvoiceSequence(num))
    .filter((seq): seq is number => seq !== null)

  if (sequences.length === 0) {
    return 1
  }

  return Math.max(...sequences) + 1
}

/**
 * Check if an invoice number is a self-invoice
 * @param invoiceNumber - The invoice number to check
 * @returns True if it's a self-invoice number (SI/ prefix)
 */
export function isSelfInvoiceNumber(invoiceNumber: string): boolean {
  return invoiceNumber.startsWith('SI/')
}

// ============================================================================
// Payment Voucher Number Generation (PV/YYYY-YY/XXXX format)
// ============================================================================

/**
 * Generate payment voucher number in format PV/{YYYY-YY}/{NUMBER}
 * @param fiscalYear - Format: 2025-26
 * @param sequenceNumber - The sequence number (1, 2, 3, etc.)
 * @returns Payment voucher number like PV/2025-26/0001
 */
export function generatePaymentVoucherNumber(fiscalYear: string, sequenceNumber: number): string {
  const paddedNumber = sequenceNumber.toString().padStart(4, '0')
  return `PV/${fiscalYear}/${paddedNumber}`
}

/**
 * Extract sequence number from payment voucher number
 * @param voucherNumber - Format: PV/2025-26/0001
 * @returns The sequence number or null if invalid format
 */
export function extractPaymentVoucherSequence(voucherNumber: string): number | null {
  const match = voucherNumber.match(/^PV\/\d{4}-\d{2}\/(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Get next payment voucher sequence from existing voucher numbers
 * @param voucherNumbers - Array of existing payment voucher numbers
 * @returns The next sequence number
 */
export function getNextPaymentVoucherSequence(voucherNumbers: string[]): number {
  if (voucherNumbers.length === 0) {
    return 1
  }

  const sequences = voucherNumbers
    .map(num => extractPaymentVoucherSequence(num))
    .filter((seq): seq is number => seq !== null)

  if (sequences.length === 0) {
    return 1
  }

  return Math.max(...sequences) + 1
}