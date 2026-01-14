/**
 * ITC Reconciliation Matching Algorithm
 *
 * Three-way match between purchase invoices and GSTR-2B entries.
 * Supports fuzzy matching on invoice numbers and configurable tolerances.
 */

import { normalizeInvoiceNumber } from './gstr2b-parser'

/**
 * Purchase invoice from our records
 */
export interface PurchaseInvoice {
  id: string
  invoiceNumber: string
  vendorGstin: string
  invoiceDate: Date
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
}

/**
 * GSTR-2B entry from GST Portal
 */
export interface GSTR2BEntry {
  vendorGstin: string
  invoiceNumber: string
  invoiceDate: Date
  invoiceValue?: number
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  cess?: number
}

/**
 * Match status types
 */
export type MatchStatus =
  | 'MATCHED'
  | 'AMOUNT_MISMATCH'
  | 'NO_MATCH'
  | 'NOT_IN_2B'
  | 'IN_2B_ONLY'

/**
 * Mismatch details
 */
export interface MismatchDetails {
  taxableValueDiff?: number
  igstDiff?: number
  cgstDiff?: number
  sgstDiff?: number
  dateDiff?: number
}

/**
 * Match result for a single invoice
 */
export interface MatchResult {
  status: MatchStatus
  confidence: number
  mismatchDetails?: MismatchDetails
}

/**
 * Matched invoice pair
 */
export interface MatchedInvoice {
  invoice: PurchaseInvoice
  gstr2bEntry: GSTR2BEntry
  matchResult: MatchResult
}

/**
 * Invoice not found in GSTR-2B
 */
export interface NotIn2BInvoice {
  invoice: PurchaseInvoice
  status: 'NOT_IN_2B'
}

/**
 * Entry in GSTR-2B but not in our records
 */
export interface In2BOnlyEntry extends GSTR2BEntry {
  status: 'IN_2B_ONLY'
}

/**
 * Amount mismatch entry
 */
export interface AmountMismatchEntry {
  invoice: PurchaseInvoice
  gstr2bEntry: GSTR2BEntry
  mismatchDetails: MismatchDetails
}

/**
 * Reconciliation summary
 */
export interface ReconciliationSummary {
  totalMatched: number
  totalMatchedITC: number
  totalAmountMismatches: number
  totalMismatchITC: number
  totalNotIn2B: number
  totalNotIn2BITC: number
  totalIn2BOnly: number
  totalIn2BOnlyITC: number
}

/**
 * Full reconciliation result
 */
export interface ReconciliationResult {
  matched: MatchedInvoice[]
  amountMismatches: AmountMismatchEntry[]
  notIn2B: NotIn2BInvoice[]
  in2BOnly: In2BOnlyEntry[]
  summary: ReconciliationSummary
}

/**
 * Reconciliation configuration
 */
export interface ReconciliationConfig {
  dateTolerance?: number // Days tolerance for date matching (default: 3)
  amountTolerancePercent?: number // Percentage tolerance for amounts (default: 1)
  amountToleranceAbsolute?: number // Absolute tolerance in rupees (default: 1)
}

const DEFAULT_CONFIG: Required<ReconciliationConfig> = {
  dateTolerance: 3,
  amountTolerancePercent: 1,
  amountToleranceAbsolute: 1,
}

/**
 * Normalize GSTIN for comparison
 */
export function normalizeGSTIN(gstin: string): string {
  if (!gstin) return ''
  return gstin.toUpperCase().replace(/\s+/g, '')
}

/**
 * Calculate the difference between two amounts
 */
export function calculateAmountDifference(amount1: number, amount2: number): number {
  return amount1 - amount2
}

/**
 * Check if two dates are within tolerance
 */
export function isDateWithinTolerance(
  date1: Date,
  date2: Date,
  toleranceDays: number
): boolean {
  const diffMs = Math.abs(date1.getTime() - date2.getTime())
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= toleranceDays
}

/**
 * Check if amount is within tolerance (percentage or absolute)
 */
function isAmountWithinTolerance(
  baseAmount: number,
  compareAmount: number,
  percentTolerance: number,
  absoluteTolerance: number
): boolean {
  const diff = Math.abs(baseAmount - compareAmount)

  // Check absolute tolerance (e.g., ₹1)
  if (diff <= absoluteTolerance) {
    return true
  }

  // Check percentage tolerance
  if (baseAmount === 0) {
    return diff <= absoluteTolerance
  }

  const percentDiff = (diff / Math.abs(baseAmount)) * 100
  return percentDiff <= percentTolerance
}

/**
 * Match a single invoice against a GSTR-2B entry
 */
export function matchInvoiceToGSTR2B(
  invoice: PurchaseInvoice,
  gstr2bEntry: GSTR2BEntry,
  config: ReconciliationConfig = {}
): MatchResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Step 1: Check GSTIN match (exact, after normalization)
  const normalizedInvoiceGstin = normalizeGSTIN(invoice.vendorGstin)
  const normalizedEntryGstin = normalizeGSTIN(gstr2bEntry.vendorGstin)

  if (normalizedInvoiceGstin !== normalizedEntryGstin) {
    return {
      status: 'NO_MATCH',
      confidence: 0,
    }
  }

  // Step 2: Check invoice number match (fuzzy)
  const normalizedInvoiceNum = normalizeInvoiceNumber(invoice.invoiceNumber)
  const normalizedEntryNum = normalizeInvoiceNumber(gstr2bEntry.invoiceNumber)

  if (normalizedInvoiceNum !== normalizedEntryNum) {
    return {
      status: 'NO_MATCH',
      confidence: 0,
    }
  }

  // At this point, GSTIN and invoice number match
  let confidence = 100

  // Step 3: Check date match
  const dateMatches = isDateWithinTolerance(
    invoice.invoiceDate,
    gstr2bEntry.invoiceDate,
    cfg.dateTolerance
  )

  if (!dateMatches) {
    return {
      status: 'NO_MATCH',
      confidence: 0,
    }
  }

  // Reduce confidence if date is not exact
  const dateDiff = Math.abs(
    (invoice.invoiceDate.getTime() - gstr2bEntry.invoiceDate.getTime()) /
      (1000 * 60 * 60 * 24)
  )
  if (dateDiff > 0) {
    confidence -= dateDiff * 2 // Reduce 2% per day difference
  }

  // Step 4: Check amounts
  const mismatchDetails: MismatchDetails = {}
  let hasAmountMismatch = false

  // Check taxable value
  const taxableValueDiff = calculateAmountDifference(
    gstr2bEntry.taxableValue,
    invoice.taxableValue
  )
  const taxableValueMatches = isAmountWithinTolerance(
    invoice.taxableValue,
    gstr2bEntry.taxableValue,
    cfg.amountTolerancePercent,
    cfg.amountToleranceAbsolute
  )

  if (!taxableValueMatches) {
    hasAmountMismatch = true
    mismatchDetails.taxableValueDiff = taxableValueDiff
  } else if (taxableValueDiff !== 0) {
    confidence -= 2 // Small reduction for minor differences
  }

  // Check IGST
  const igstDiff = calculateAmountDifference(gstr2bEntry.igst, invoice.igst)
  const igstMatches = isAmountWithinTolerance(
    invoice.igst,
    gstr2bEntry.igst,
    cfg.amountTolerancePercent,
    cfg.amountToleranceAbsolute
  )

  if (!igstMatches) {
    hasAmountMismatch = true
    mismatchDetails.igstDiff = igstDiff
  }

  // Check CGST
  const cgstDiff = calculateAmountDifference(gstr2bEntry.cgst, invoice.cgst)
  const cgstMatches = isAmountWithinTolerance(
    invoice.cgst,
    gstr2bEntry.cgst,
    cfg.amountTolerancePercent,
    cfg.amountToleranceAbsolute
  )

  if (!cgstMatches) {
    hasAmountMismatch = true
    mismatchDetails.cgstDiff = cgstDiff
  }

  // Check SGST
  const sgstDiff = calculateAmountDifference(gstr2bEntry.sgst, invoice.sgst)
  const sgstMatches = isAmountWithinTolerance(
    invoice.sgst,
    gstr2bEntry.sgst,
    cfg.amountTolerancePercent,
    cfg.amountToleranceAbsolute
  )

  if (!sgstMatches) {
    hasAmountMismatch = true
    mismatchDetails.sgstDiff = sgstDiff
  }

  if (hasAmountMismatch) {
    return {
      status: 'AMOUNT_MISMATCH',
      confidence: Math.max(confidence - 20, 50),
      mismatchDetails,
    }
  }

  // Ensure minimum confidence of 50
  confidence = Math.max(confidence, 50)

  return {
    status: 'MATCHED',
    confidence,
  }
}

/**
 * Run full reconciliation between invoices and GSTR-2B entries
 */
export function runReconciliation(
  invoices: PurchaseInvoice[],
  gstr2bEntries: GSTR2BEntry[],
  config: ReconciliationConfig = {}
): ReconciliationResult {
  const matched: MatchedInvoice[] = []
  const amountMismatches: AmountMismatchEntry[] = []
  const notIn2B: NotIn2BInvoice[] = []
  const in2BOnly: In2BOnlyEntry[] = []

  // Track which entries have been matched
  const matchedEntryIndices = new Set<number>()

  // For each invoice, find matching GSTR-2B entry
  for (const invoice of invoices) {
    let bestMatch: { entry: GSTR2BEntry; index: number; result: MatchResult } | null = null

    for (let i = 0; i < gstr2bEntries.length; i++) {
      if (matchedEntryIndices.has(i)) continue

      const entry = gstr2bEntries[i]
      const result = matchInvoiceToGSTR2B(invoice, entry, config)

      if (result.status === 'NO_MATCH') continue

      // Found a potential match
      if (!bestMatch || result.confidence > bestMatch.result.confidence) {
        bestMatch = { entry, index: i, result }
      }
    }

    if (bestMatch) {
      matchedEntryIndices.add(bestMatch.index)

      if (bestMatch.result.status === 'MATCHED') {
        matched.push({
          invoice,
          gstr2bEntry: bestMatch.entry,
          matchResult: bestMatch.result,
        })
      } else if (bestMatch.result.status === 'AMOUNT_MISMATCH') {
        amountMismatches.push({
          invoice,
          gstr2bEntry: bestMatch.entry,
          mismatchDetails: bestMatch.result.mismatchDetails!,
        })
      }
    } else {
      // Invoice not found in GSTR-2B
      notIn2B.push({
        invoice,
        status: 'NOT_IN_2B',
      })
    }
  }

  // Find entries in GSTR-2B that weren't matched
  for (let i = 0; i < gstr2bEntries.length; i++) {
    if (!matchedEntryIndices.has(i)) {
      in2BOnly.push({
        ...gstr2bEntries[i],
        status: 'IN_2B_ONLY',
      })
    }
  }

  // Calculate summary
  const summary = calculateSummary(matched, amountMismatches, notIn2B, in2BOnly)

  return {
    matched,
    amountMismatches,
    notIn2B,
    in2BOnly,
    summary,
  }
}

/**
 * Calculate reconciliation summary
 */
function calculateSummary(
  matched: MatchedInvoice[],
  amountMismatches: AmountMismatchEntry[],
  notIn2B: NotIn2BInvoice[],
  in2BOnly: In2BOnlyEntry[]
): ReconciliationSummary {
  const totalMatchedITC = matched.reduce((sum, m) => {
    return sum + m.gstr2bEntry.igst + m.gstr2bEntry.cgst + m.gstr2bEntry.sgst
  }, 0)

  const totalMismatchITC = amountMismatches.reduce((sum, m) => {
    return sum + m.gstr2bEntry.igst + m.gstr2bEntry.cgst + m.gstr2bEntry.sgst
  }, 0)

  const totalNotIn2BITC = notIn2B.reduce((sum, m) => {
    return sum + m.invoice.igst + m.invoice.cgst + m.invoice.sgst
  }, 0)

  const totalIn2BOnlyITC = in2BOnly.reduce((sum, e) => {
    return sum + e.igst + e.cgst + e.sgst
  }, 0)

  return {
    totalMatched: matched.length,
    totalMatchedITC,
    totalAmountMismatches: amountMismatches.length,
    totalMismatchITC,
    totalNotIn2B: notIn2B.length,
    totalNotIn2BITC,
    totalIn2BOnly: in2BOnly.length,
    totalIn2BOnlyITC,
  }
}

/**
 * Find potential matches for an unmatched GSTR-2B entry
 * (For manual matching assistance)
 */
export function findPotentialMatches(
  gstr2bEntry: GSTR2BEntry,
  invoices: PurchaseInvoice[],
  maxResults: number = 5
): Array<{ invoice: PurchaseInvoice; similarity: number }> {
  const results: Array<{ invoice: PurchaseInvoice; similarity: number }> = []
  const normalizedEntryGstin = normalizeGSTIN(gstr2bEntry.vendorGstin)
  const normalizedEntryNum = normalizeInvoiceNumber(gstr2bEntry.invoiceNumber)

  for (const invoice of invoices) {
    let similarity = 0

    // GSTIN match (highest weight)
    const normalizedInvoiceGstin = normalizeGSTIN(invoice.vendorGstin)
    if (normalizedInvoiceGstin === normalizedEntryGstin) {
      similarity += 50
    } else if (
      normalizedInvoiceGstin.substring(0, 2) ===
      normalizedEntryGstin.substring(0, 2)
    ) {
      // Same state code
      similarity += 10
    }

    // Invoice number similarity
    const normalizedInvoiceNum = normalizeInvoiceNumber(invoice.invoiceNumber)
    if (normalizedInvoiceNum === normalizedEntryNum) {
      similarity += 30
    } else if (
      normalizedInvoiceNum.includes(normalizedEntryNum) ||
      normalizedEntryNum.includes(normalizedInvoiceNum)
    ) {
      similarity += 15
    }

    // Date proximity (within 30 days)
    const dateDiff = Math.abs(
      (invoice.invoiceDate.getTime() - gstr2bEntry.invoiceDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
    if (dateDiff <= 3) {
      similarity += 10
    } else if (dateDiff <= 30) {
      similarity += 5
    }

    // Amount proximity
    const amountDiffPercent =
      Math.abs(invoice.taxableValue - gstr2bEntry.taxableValue) /
      Math.max(invoice.taxableValue, gstr2bEntry.taxableValue, 1) * 100
    if (amountDiffPercent <= 1) {
      similarity += 10
    } else if (amountDiffPercent <= 5) {
      similarity += 5
    }

    if (similarity > 0) {
      results.push({ invoice, similarity })
    }
  }

  // Sort by similarity descending and take top results
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults)
}
