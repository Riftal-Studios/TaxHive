import { DocumentClassification, ReviewStatus } from '@prisma/client'

/**
 * Result of document extraction with quality indicators
 */
export interface ExtractionResult {
  classification: DocumentClassification
  amount?: number
  currency?: string
  date?: Date
  vendorName?: string
  vendorCountry?: string
  vendorGstin?: string
  clientName?: string
  clientCountry?: string
  clientGstin?: string
  invoiceNumber?: string
  hasGstDetails: boolean
  sourceTypeMatch: boolean
  dataQuality: 'high' | 'medium' | 'low'
}

/**
 * Confidence score weights for different factors
 */
const WEIGHTS = {
  // Base classification confidence
  knownClassification: 20,
  unknownClassificationPenalty: -15,

  // Data completeness
  hasAmount: 15,
  hasCurrency: 10,
  hasDate: 10,
  hasVendorName: 10,
  hasClientName: 10,
  hasInvoiceNumber: 5,

  // Context matching
  sourceTypeMatch: 10,
  gstDetailsForPurchase: 10,
  foreignCurrencyForExport: 5,

  // Data quality
  highQuality: 10,
  mediumQuality: 5,
  lowQuality: 0,
}

/**
 * Calculate confidence score for document extraction
 *
 * @param extraction - The extraction result from AI processing
 * @returns Confidence score (0-100)
 */
export function calculateConfidenceScore(extraction: ExtractionResult): number {
  let score = 0

  // Classification confidence
  if (extraction.classification === DocumentClassification.UNKNOWN) {
    score += WEIGHTS.unknownClassificationPenalty
  } else {
    score += WEIGHTS.knownClassification
  }

  // Data completeness
  if (extraction.amount !== undefined && extraction.amount > 0) {
    score += WEIGHTS.hasAmount
  }
  if (extraction.currency) {
    score += WEIGHTS.hasCurrency
  }
  if (extraction.date) {
    score += WEIGHTS.hasDate
  }
  if (extraction.vendorName) {
    score += WEIGHTS.hasVendorName
  }
  if (extraction.clientName) {
    score += WEIGHTS.hasClientName
  }
  if (extraction.invoiceNumber) {
    score += WEIGHTS.hasInvoiceNumber
  }

  // Context matching
  if (extraction.sourceTypeMatch) {
    score += WEIGHTS.sourceTypeMatch
  }

  // GST details boost for purchase classifications
  if (
    extraction.hasGstDetails &&
    (extraction.classification === DocumentClassification.PURCHASE_ITC ||
      extraction.classification === DocumentClassification.DOMESTIC_B2B)
  ) {
    score += WEIGHTS.gstDetailsForPurchase
  }

  // Foreign currency boost for export classifications
  if (
    extraction.currency &&
    extraction.currency !== 'INR' &&
    (extraction.classification === DocumentClassification.EXPORT_WITH_LUT ||
      extraction.classification === DocumentClassification.EXPORT_WITHOUT_LUT)
  ) {
    score += WEIGHTS.foreignCurrencyForExport
  }

  // Data quality factor
  switch (extraction.dataQuality) {
    case 'high':
      score += WEIGHTS.highQuality
      break
    case 'medium':
      score += WEIGHTS.mediumQuality
      break
    case 'low':
      score += WEIGHTS.lowQuality
      break
  }

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, score))
}

/**
 * Determine review status based on confidence score
 *
 * Thresholds:
 * - 90-100%: Auto-approve (high confidence)
 * - 70-89%: Review recommended (medium confidence)
 * - 50-69%: Manual verification required
 * - <50%: Manual classification required
 *
 * @param confidence - Confidence score (0-100)
 * @returns Review status
 */
export function getReviewStatusFromConfidence(confidence: number): ReviewStatus {
  if (confidence >= 90) {
    return ReviewStatus.AUTO_APPROVED
  } else if (confidence >= 70) {
    return ReviewStatus.REVIEW_RECOMMENDED
  } else {
    return ReviewStatus.MANUAL_REQUIRED
  }
}

/**
 * Calculate confidence adjustment factors for specific scenarios
 */
export function getConfidenceAdjustments(extraction: ExtractionResult): {
  reason: string
  adjustment: number
}[] {
  const adjustments: { reason: string; adjustment: number }[] = []

  // High-value transaction warning
  if (extraction.amount && extraction.amount > 1000000) {
    adjustments.push({
      reason: 'High-value transaction (>10L INR)',
      adjustment: -5,
    })
  }

  // Missing critical fields
  if (!extraction.date) {
    adjustments.push({
      reason: 'Missing invoice/transaction date',
      adjustment: -10,
    })
  }

  // Inconsistent classification signals
  if (
    extraction.classification === DocumentClassification.EXPORT_WITH_LUT &&
    extraction.currency === 'INR'
  ) {
    adjustments.push({
      reason: 'Export classification with INR currency - verify',
      adjustment: -15,
    })
  }

  // Purchase without GST details
  if (
    extraction.classification === DocumentClassification.PURCHASE_ITC &&
    !extraction.hasGstDetails
  ) {
    adjustments.push({
      reason: 'Purchase ITC classification without GST details',
      adjustment: -10,
    })
  }

  return adjustments
}
