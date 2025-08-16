/**
 * Credit and Debit Notes Library
 * Handles GST adjustments and invoice corrections
 */

import { Invoice, InvoiceItem, CreditNote, DebitNote } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { getFinancialYear } from '@/lib/gst'

// Reason types for credit notes
export const CREDIT_NOTE_REASONS = {
  RATE_CHANGE: 'Rate Change',
  QUANTITY_CHANGE: 'Quantity Change',
  DISCOUNT: 'Discount',
  RETURN: 'Goods/Service Return',
  OTHER: 'Other'
} as const

// Reason types for debit notes
export const DEBIT_NOTE_REASONS = {
  RATE_INCREASE: 'Rate Increase',
  QUANTITY_INCREASE: 'Quantity Increase',
  ADDITIONAL_CHARGE: 'Additional Charge',
  PENALTY: 'Penalty',
  OTHER: 'Other'
} as const

export type CreditNoteReason = keyof typeof CREDIT_NOTE_REASONS
export type DebitNoteReason = keyof typeof DEBIT_NOTE_REASONS

// Helper to convert Decimal to number
function toNumber(value: Decimal | number): number {
  if (typeof value === 'number') return value
  return Number(value.toString())
}

/**
 * Generate credit note number in format CN-FY24-25/001
 */
export function generateCreditNoteNumber(date: Date, sequenceNumber: number): string {
  const fy = getFinancialYear(date)
  const sequence = sequenceNumber.toString().padStart(3, '0')
  return `CN-${fy}/${sequence}`
}

/**
 * Generate debit note number in format DN-FY24-25/001
 */
export function generateDebitNoteNumber(date: Date, sequenceNumber: number): string {
  const fy = getFinancialYear(date)
  const sequence = sequenceNumber.toString().padStart(3, '0')
  return `DN-${fy}/${sequence}`
}

/**
 * Calculate GST adjustments for credit note
 */
export interface CreditNoteAdjustment {
  taxableAmountDiff: number
  cgstDiff: number
  sgstDiff: number
  igstDiff: number
  totalGSTDiff: number
  totalDiff: number
}

export function calculateCreditNoteAdjustment(
  originalInvoice: Invoice & { lineItems: InvoiceItem[] },
  adjustmentItems: Array<{
    serviceCode: string
    quantity: number
    rate: number
    gstRate: number
  }>
): CreditNoteAdjustment {
  let taxableAmountDiff = 0
  let cgstDiff = 0
  let sgstDiff = 0
  let igstDiff = 0

  // Calculate total adjustment amounts
  for (const item of adjustmentItems) {
    const amount = item.quantity * item.rate
    taxableAmountDiff += amount

    // Check if inter-state or intra-state
    const isInterState = toNumber(originalInvoice.igstRate) > 0

    if (isInterState) {
      // Inter-state: Apply IGST
      igstDiff += amount * (item.gstRate / 100)
    } else {
      // Intra-state: Apply CGST + SGST
      cgstDiff += amount * (item.gstRate / 200) // Half of GST rate
      sgstDiff += amount * (item.gstRate / 200) // Half of GST rate
    }
  }

  const totalGSTDiff = cgstDiff + sgstDiff + igstDiff
  const totalDiff = taxableAmountDiff + totalGSTDiff

  return {
    taxableAmountDiff,
    cgstDiff,
    sgstDiff,
    igstDiff,
    totalGSTDiff,
    totalDiff
  }
}

/**
 * Calculate GST adjustments for debit note
 */
export interface DebitNoteAdjustment {
  taxableAmountDiff: number
  cgstDiff: number
  sgstDiff: number
  igstDiff: number
  totalGSTDiff: number
  totalDiff: number
}

export function calculateDebitNoteAdjustment(
  originalInvoice: Invoice & { lineItems: InvoiceItem[] },
  adjustmentItems: Array<{
    serviceCode: string
    quantity: number
    rate: number
    gstRate: number
  }>
): DebitNoteAdjustment {
  // Same calculation as credit note (both are positive values)
  // The difference is in interpretation: credit reduces, debit increases
  return calculateCreditNoteAdjustment(originalInvoice, adjustmentItems)
}

/**
 * Validate credit note against original invoice
 */
export function validateCreditNote(
  originalInvoice: Invoice,
  creditNoteDate: Date,
  creditAmount: number
): { valid: boolean; error?: string } {
  // Credit note date must be >= original invoice date
  if (creditNoteDate < originalInvoice.invoiceDate) {
    return {
      valid: false,
      error: 'Credit note date cannot be before original invoice date'
    }
  }

  // Credit amount cannot exceed original invoice amount
  const originalAmount = toNumber(originalInvoice.totalAmount)
  if (creditAmount > originalAmount) {
    return {
      valid: false,
      error: 'Credit amount cannot exceed original invoice amount'
    }
  }

  // Check if within same financial year
  const invoiceFY = getFinancialYear(originalInvoice.invoiceDate)
  const creditNoteFY = getFinancialYear(creditNoteDate)
  if (invoiceFY !== creditNoteFY) {
    return {
      valid: false,
      error: 'Credit note must be issued within the same financial year as the original invoice (Section 34 of CGST Act)'
    }
  }

  return { valid: true }
}

/**
 * Validate debit note against original invoice
 */
export function validateDebitNote(
  originalInvoice: Invoice,
  debitNoteDate: Date
): { valid: boolean; error?: string } {
  // Debit note date must be >= original invoice date
  if (debitNoteDate < originalInvoice.invoiceDate) {
    return {
      valid: false,
      error: 'Debit note date cannot be before original invoice date'
    }
  }

  // Check if within same financial year
  const invoiceFY = getFinancialYear(originalInvoice.invoiceDate)
  const debitNoteFY = getFinancialYear(debitNoteDate)
  if (invoiceFY !== debitNoteFY) {
    return {
      valid: false,
      error: 'Debit note must be issued within the same financial year as the original invoice (Section 34 of CGST Act)'
    }
  }

  return { valid: true }
}

/**
 * Update invoice balance after credit note
 */
export function calculateUpdatedInvoiceBalance(
  originalInvoice: Invoice,
  creditNotes: CreditNote[],
  debitNotes: DebitNote[]
): {
  originalAmount: number
  totalCredits: number
  totalDebits: number
  adjustedAmount: number
  balanceDue: number
} {
  const originalAmount = toNumber(originalInvoice.totalAmount)
  const amountPaid = toNumber(originalInvoice.amountPaid)

  // Sum all credit notes
  const totalCredits = creditNotes
    .filter(cn => cn.status === 'ISSUED')
    .reduce((sum, cn) => sum + toNumber(cn.totalDiff), 0)

  // Sum all debit notes
  const totalDebits = debitNotes
    .filter(dn => dn.status === 'ISSUED')
    .reduce((sum, dn) => sum + toNumber(dn.totalDiff), 0)

  // Calculate adjusted invoice amount
  const adjustedAmount = originalAmount - totalCredits + totalDebits
  
  // Calculate balance due
  const balanceDue = adjustedAmount - amountPaid

  return {
    originalAmount,
    totalCredits,
    totalDebits,
    adjustedAmount,
    balanceDue: Math.max(0, balanceDue)
  }
}

/**
 * Format credit/debit note for GSTR-1
 */
export interface GSTR1CreditDebitNote {
  nt_num: string // Note number
  nt_dt: string // Note date (DD-MM-YYYY)
  inum: string // Original invoice number
  idt: string // Original invoice date
  val: number // Note value
  pos: string // Place of supply
  rchrg: 'N' | 'Y' // Reverse charge
  inv_typ: string // Invoice type
  itms: Array<{
    num: number
    itm_det: {
      rt: number // Tax rate
      txval: number // Taxable value
      iamt: number // IGST
      camt: number // CGST
      samt: number // SGST
      csamt: number // Cess
    }
  }>
}

export function formatCreditNoteForGSTR1(
  creditNote: CreditNote & { originalInvoice: Invoice },
  lineItems: any[]
): GSTR1CreditDebitNote {
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  // Group line items by GST rate
  const itemsByRate = new Map<number, { txval: number; iamt: number; camt: number; samt: number }>()
  
  for (const item of lineItems) {
    const rate = toNumber(item.gstRate)
    if (!itemsByRate.has(rate)) {
      itemsByRate.set(rate, { txval: 0, iamt: 0, camt: 0, samt: 0 })
    }
    
    const rateGroup = itemsByRate.get(rate)!
    rateGroup.txval += toNumber(item.amount)
    rateGroup.iamt += toNumber(item.igstAmount)
    rateGroup.camt += toNumber(item.cgstAmount)
    rateGroup.samt += toNumber(item.sgstAmount)
  }

  return {
    nt_num: creditNote.noteNumber,
    nt_dt: formatDate(creditNote.noteDate),
    inum: creditNote.originalInvoice.invoiceNumber,
    idt: formatDate(creditNote.originalInvoice.invoiceDate),
    val: toNumber(creditNote.totalDiff),
    pos: creditNote.originalInvoice.placeOfSupply.substring(0, 2),
    rchrg: 'N',
    inv_typ: creditNote.originalInvoice.invoiceType === 'EXPORT' ? 'EXPWOP' : 'R',
    itms: Array.from(itemsByRate.entries()).map(([rate, amounts], index) => ({
      num: index + 1,
      itm_det: {
        rt: rate,
        txval: amounts.txval,
        iamt: amounts.iamt,
        camt: amounts.camt,
        samt: amounts.samt,
        csamt: 0
      }
    }))
  }
}

export function formatDebitNoteForGSTR1(
  debitNote: DebitNote & { originalInvoice: Invoice },
  lineItems: any[]
): GSTR1CreditDebitNote {
  // Same format as credit note, just different interpretation
  const creditNoteFormat = formatCreditNoteForGSTR1(
    debitNote as any,
    lineItems
  )
  return creditNoteFormat
}