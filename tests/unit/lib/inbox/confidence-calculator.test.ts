import { describe, it, expect } from 'vitest'
import {
  calculateConfidenceScore,
  getReviewStatusFromConfidence,
  type ExtractionResult,
} from '@/lib/inbox/confidence-calculator'
import { DocumentClassification, ReviewStatus } from '@prisma/client'

describe('Confidence Calculator', () => {
  describe('calculateConfidenceScore', () => {
    it('should return high confidence (90+) for complete extraction with all fields', () => {
      const extraction: ExtractionResult = {
        classification: DocumentClassification.EXPORT_WITH_LUT,
        amount: 1000,
        currency: 'USD',
        date: new Date('2024-01-15'),
        vendorName: 'Acme Corp',
        vendorCountry: 'US',
        hasGstDetails: false,
        sourceTypeMatch: true,
        dataQuality: 'high',
      }

      const score = calculateConfidenceScore(extraction)
      expect(score).toBeGreaterThanOrEqual(90)
    })

    it('should return medium confidence (70-89) for partial extraction', () => {
      const extraction: ExtractionResult = {
        classification: DocumentClassification.EXPORT_WITH_LUT,
        amount: 1000,
        currency: 'USD',
        date: new Date('2024-01-15'),
        // Missing vendor name
        hasGstDetails: false,
        sourceTypeMatch: true,
        dataQuality: 'medium',
      }

      const score = calculateConfidenceScore(extraction)
      expect(score).toBeGreaterThanOrEqual(70)
      expect(score).toBeLessThan(90)
    })

    it('should return low confidence (<70) for minimal extraction', () => {
      const extraction: ExtractionResult = {
        classification: DocumentClassification.UNKNOWN,
        amount: 1000,
        hasGstDetails: false,
        sourceTypeMatch: false,
        dataQuality: 'low',
      }

      const score = calculateConfidenceScore(extraction)
      expect(score).toBeLessThan(70)
    })

    it('should boost confidence when source type matches expected pattern', () => {
      const withMatch: ExtractionResult = {
        classification: DocumentClassification.EXPORT_WITH_LUT,
        amount: 500,
        currency: 'USD',
        hasGstDetails: false,
        sourceTypeMatch: true,
        dataQuality: 'medium',
      }

      const withoutMatch: ExtractionResult = {
        ...withMatch,
        sourceTypeMatch: false,
      }

      const scoreWithMatch = calculateConfidenceScore(withMatch)
      const scoreWithoutMatch = calculateConfidenceScore(withoutMatch)

      expect(scoreWithMatch).toBeGreaterThan(scoreWithoutMatch)
    })

    it('should boost confidence for PURCHASE_ITC when GST details present', () => {
      const withGst: ExtractionResult = {
        classification: DocumentClassification.PURCHASE_ITC,
        amount: 10000,
        currency: 'INR',
        hasGstDetails: true,
        vendorGstin: '29AABCT1234F1ZV',
        sourceTypeMatch: true,
        dataQuality: 'high',
      }

      const withoutGst: ExtractionResult = {
        ...withGst,
        hasGstDetails: false,
        vendorGstin: undefined,
      }

      const scoreWithGst = calculateConfidenceScore(withGst)
      const scoreWithoutGst = calculateConfidenceScore(withoutGst)

      expect(scoreWithGst).toBeGreaterThan(scoreWithoutGst)
    })

    it('should cap confidence at 100', () => {
      const perfectExtraction: ExtractionResult = {
        classification: DocumentClassification.EXPORT_WITH_LUT,
        amount: 5000,
        currency: 'USD',
        date: new Date('2024-01-15'),
        vendorName: 'GitHub Inc',
        vendorCountry: 'US',
        hasGstDetails: false,
        sourceTypeMatch: true,
        dataQuality: 'high',
        invoiceNumber: 'INV-001',
      }

      const score = calculateConfidenceScore(perfectExtraction)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should have minimum confidence of 0', () => {
      const emptyExtraction: ExtractionResult = {
        classification: DocumentClassification.UNKNOWN,
        hasGstDetails: false,
        sourceTypeMatch: false,
        dataQuality: 'low',
      }

      const score = calculateConfidenceScore(emptyExtraction)
      expect(score).toBeGreaterThanOrEqual(0)
    })

    it('should penalize UNKNOWN classification', () => {
      const knownClassification: ExtractionResult = {
        classification: DocumentClassification.DOMESTIC_B2B,
        amount: 1000,
        hasGstDetails: true,
        sourceTypeMatch: true,
        dataQuality: 'medium',
      }

      const unknownClassification: ExtractionResult = {
        ...knownClassification,
        classification: DocumentClassification.UNKNOWN,
      }

      const knownScore = calculateConfidenceScore(knownClassification)
      const unknownScore = calculateConfidenceScore(unknownClassification)

      expect(knownScore).toBeGreaterThan(unknownScore)
    })
  })

  describe('getReviewStatusFromConfidence', () => {
    it('should return AUTO_APPROVED for confidence >= 90', () => {
      expect(getReviewStatusFromConfidence(90)).toBe(ReviewStatus.AUTO_APPROVED)
      expect(getReviewStatusFromConfidence(95)).toBe(ReviewStatus.AUTO_APPROVED)
      expect(getReviewStatusFromConfidence(100)).toBe(ReviewStatus.AUTO_APPROVED)
    })

    it('should return REVIEW_RECOMMENDED for confidence 70-89', () => {
      expect(getReviewStatusFromConfidence(70)).toBe(ReviewStatus.REVIEW_RECOMMENDED)
      expect(getReviewStatusFromConfidence(80)).toBe(ReviewStatus.REVIEW_RECOMMENDED)
      expect(getReviewStatusFromConfidence(89)).toBe(ReviewStatus.REVIEW_RECOMMENDED)
    })

    it('should return MANUAL_REQUIRED for confidence 50-69', () => {
      expect(getReviewStatusFromConfidence(50)).toBe(ReviewStatus.MANUAL_REQUIRED)
      expect(getReviewStatusFromConfidence(60)).toBe(ReviewStatus.MANUAL_REQUIRED)
      expect(getReviewStatusFromConfidence(69)).toBe(ReviewStatus.MANUAL_REQUIRED)
    })

    it('should return MANUAL_REQUIRED for confidence < 50', () => {
      expect(getReviewStatusFromConfidence(0)).toBe(ReviewStatus.MANUAL_REQUIRED)
      expect(getReviewStatusFromConfidence(25)).toBe(ReviewStatus.MANUAL_REQUIRED)
      expect(getReviewStatusFromConfidence(49)).toBe(ReviewStatus.MANUAL_REQUIRED)
    })

    it('should handle edge cases', () => {
      expect(getReviewStatusFromConfidence(89.9)).toBe(ReviewStatus.REVIEW_RECOMMENDED)
      expect(getReviewStatusFromConfidence(90.0)).toBe(ReviewStatus.AUTO_APPROVED)
    })
  })
})
