/**
 * ITC Reconciliation Matching Algorithm Tests
 *
 * Tests for matching purchase invoices with GSTR-2B entries.
 */

import { describe, it, expect } from 'vitest'
import {
  matchInvoiceToGSTR2B,
  runReconciliation,
  normalizeGSTIN,
  calculateAmountDifference,
  isDateWithinTolerance,
  type PurchaseInvoice,
  type GSTR2BEntry,
  type ReconciliationResult,
  type MatchResult,
} from '@/lib/itc-reconciliation'

describe('ITC Reconciliation', () => {
  describe('matchInvoiceToGSTR2B', () => {
    it('should return MATCHED for exact match', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('MATCHED')
      expect(result.confidence).toBeGreaterThanOrEqual(95)
    })

    it('should match with normalized invoice numbers', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV/2024/001',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'INV-2024-001', // Different format, same normalized value
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('MATCHED')
    })

    it('should return AMOUNT_MISMATCH for amount difference over 1%', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 105000, // ₹5000 difference (5% > 1% tolerance)
        igst: 18900,
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('AMOUNT_MISMATCH')
      expect(result.mismatchDetails).toBeDefined()
      expect(result.mismatchDetails?.taxableValueDiff).toBe(5000)
    })

    it('should match with date tolerance of 3 days', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-01-17'), // 2 days difference (within tolerance)
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('MATCHED')
      expect(result.confidence).toBeLessThan(100) // Slightly lower confidence due to date diff
    })

    it('should not match with different GSTIN', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '07AAACR5055K1Z5', // Different GSTIN
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('NO_MATCH')
    })

    it('should handle CGST+SGST correctly', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendorGstin: '29AABCT1234Q1ZX',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 0,
        cgst: 9000,
        sgst: 9000,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '29AABCT1234Q1ZX',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 0,
        cgst: 9000,
        sgst: 9000,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('MATCHED')
    })

    it('should detect tax component mismatch', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 12000, // Different IGST (12% vs 18%)
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('AMOUNT_MISMATCH')
      expect(result.mismatchDetails?.igstDiff).toBe(-6000)
    })

    it('should accept match within 1% tolerance', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100800, // 0.8% difference
        igst: 18144,
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('MATCHED')
      expect(result.confidence).toBeLessThan(100)
    })
  })

  describe('runReconciliation', () => {
    it('should reconcile invoices with GSTR-2B entries', () => {
      const invoices: PurchaseInvoice[] = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          vendorGstin: '27AABCU9603R1ZJ',
          invoiceDate: new Date('2024-01-15'),
          taxableValue: 100000,
          igst: 18000,
          cgst: 0,
          sgst: 0,
        },
        {
          id: 'inv-2',
          invoiceNumber: 'INV-002',
          vendorGstin: '07AAACR5055K1Z5',
          invoiceDate: new Date('2024-01-20'),
          taxableValue: 50000,
          igst: 9000,
          cgst: 0,
          sgst: 0,
        },
      ]

      const gstr2bEntries: GSTR2BEntry[] = [
        {
          vendorGstin: '27AABCU9603R1ZJ',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-01-15'),
          taxableValue: 100000,
          igst: 18000,
          cgst: 0,
          sgst: 0,
        },
        {
          vendorGstin: '07AAACR5055K1Z5',
          invoiceNumber: 'INV-002',
          invoiceDate: new Date('2024-01-20'),
          taxableValue: 50000,
          igst: 9000,
          cgst: 0,
          sgst: 0,
        },
        {
          vendorGstin: '09AABCT5678P1ZQ',
          invoiceNumber: 'INV-003', // No matching invoice
          invoiceDate: new Date('2024-01-25'),
          taxableValue: 75000,
          igst: 13500,
          cgst: 0,
          sgst: 0,
        },
      ]

      const result = runReconciliation(invoices, gstr2bEntries)

      expect(result.matched).toHaveLength(2)
      expect(result.notIn2B).toHaveLength(0)
      expect(result.in2BOnly).toHaveLength(1)
      expect(result.in2BOnly[0].vendorGstin).toBe('09AABCT5678P1ZQ')
    })

    it('should identify invoices not in GSTR-2B', () => {
      const invoices: PurchaseInvoice[] = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          vendorGstin: '27AABCU9603R1ZJ',
          invoiceDate: new Date('2024-01-15'),
          taxableValue: 100000,
          igst: 18000,
          cgst: 0,
          sgst: 0,
        },
      ]

      const gstr2bEntries: GSTR2BEntry[] = [] // Empty GSTR-2B

      const result = runReconciliation(invoices, gstr2bEntries)

      expect(result.matched).toHaveLength(0)
      expect(result.notIn2B).toHaveLength(1)
      expect(result.notIn2B[0].invoice.id).toBe('inv-1')
    })

    it('should calculate summary totals correctly', () => {
      const invoices: PurchaseInvoice[] = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          vendorGstin: '27AABCU9603R1ZJ',
          invoiceDate: new Date('2024-01-15'),
          taxableValue: 100000,
          igst: 18000,
          cgst: 0,
          sgst: 0,
        },
      ]

      const gstr2bEntries: GSTR2BEntry[] = [
        {
          vendorGstin: '27AABCU9603R1ZJ',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-01-15'),
          taxableValue: 100000,
          igst: 18000,
          cgst: 0,
          sgst: 0,
        },
      ]

      const result = runReconciliation(invoices, gstr2bEntries)

      expect(result.summary.totalMatched).toBe(1)
      expect(result.summary.totalMatchedITC).toBe(18000)
      expect(result.summary.totalNotIn2B).toBe(0)
      expect(result.summary.totalIn2BOnly).toBe(0)
    })

    it('should handle amount mismatches in reconciliation', () => {
      const invoices: PurchaseInvoice[] = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          vendorGstin: '27AABCU9603R1ZJ',
          invoiceDate: new Date('2024-01-15'),
          taxableValue: 100000,
          igst: 18000,
          cgst: 0,
          sgst: 0,
        },
      ]

      const gstr2bEntries: GSTR2BEntry[] = [
        {
          vendorGstin: '27AABCU9603R1ZJ',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-01-15'),
          taxableValue: 105000, // 5% difference
          igst: 18900,
          cgst: 0,
          sgst: 0,
        },
      ]

      const result = runReconciliation(invoices, gstr2bEntries)

      expect(result.amountMismatches).toHaveLength(1)
      expect(result.amountMismatches[0].mismatchDetails?.taxableValueDiff).toBe(5000)
    })

    it('should handle multiple invoices from same vendor', () => {
      const invoices: PurchaseInvoice[] = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          vendorGstin: '27AABCU9603R1ZJ',
          invoiceDate: new Date('2024-01-15'),
          taxableValue: 100000,
          igst: 18000,
          cgst: 0,
          sgst: 0,
        },
        {
          id: 'inv-2',
          invoiceNumber: 'INV-002',
          vendorGstin: '27AABCU9603R1ZJ', // Same vendor
          invoiceDate: new Date('2024-01-20'),
          taxableValue: 50000,
          igst: 9000,
          cgst: 0,
          sgst: 0,
        },
      ]

      const gstr2bEntries: GSTR2BEntry[] = [
        {
          vendorGstin: '27AABCU9603R1ZJ',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2024-01-15'),
          taxableValue: 100000,
          igst: 18000,
          cgst: 0,
          sgst: 0,
        },
        {
          vendorGstin: '27AABCU9603R1ZJ',
          invoiceNumber: 'INV-002',
          invoiceDate: new Date('2024-01-20'),
          taxableValue: 50000,
          igst: 9000,
          cgst: 0,
          sgst: 0,
        },
      ]

      const result = runReconciliation(invoices, gstr2bEntries)

      expect(result.matched).toHaveLength(2)
      expect(result.summary.totalMatchedITC).toBe(27000) // 18000 + 9000
    })
  })

  describe('normalizeGSTIN', () => {
    it('should uppercase GSTIN', () => {
      expect(normalizeGSTIN('27aabcu9603r1zj')).toBe('27AABCU9603R1ZJ')
    })

    it('should remove spaces', () => {
      expect(normalizeGSTIN('27 AAB CU96 03R1 ZJ')).toBe('27AABCU9603R1ZJ')
    })

    it('should handle empty strings', () => {
      expect(normalizeGSTIN('')).toBe('')
    })
  })

  describe('calculateAmountDifference', () => {
    it('should calculate absolute difference', () => {
      expect(calculateAmountDifference(100000, 95000)).toBe(5000)
      expect(calculateAmountDifference(95000, 100000)).toBe(-5000)
    })

    it('should return 0 for equal amounts', () => {
      expect(calculateAmountDifference(100000, 100000)).toBe(0)
    })

    it('should handle decimal amounts', () => {
      expect(calculateAmountDifference(100.50, 100.25)).toBeCloseTo(0.25, 2)
    })
  })

  describe('isDateWithinTolerance', () => {
    it('should return true for same date', () => {
      const date1 = new Date('2024-01-15')
      const date2 = new Date('2024-01-15')
      expect(isDateWithinTolerance(date1, date2, 3)).toBe(true)
    })

    it('should return true for dates within tolerance', () => {
      const date1 = new Date('2024-01-15')
      const date2 = new Date('2024-01-17') // 2 days diff
      expect(isDateWithinTolerance(date1, date2, 3)).toBe(true)
    })

    it('should return false for dates outside tolerance', () => {
      const date1 = new Date('2024-01-15')
      const date2 = new Date('2024-01-20') // 5 days diff
      expect(isDateWithinTolerance(date1, date2, 3)).toBe(false)
    })

    it('should handle dates in different order', () => {
      const date1 = new Date('2024-01-18')
      const date2 = new Date('2024-01-15')
      expect(isDateWithinTolerance(date1, date2, 3)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle very small invoice amounts', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100, // ₹100 only
        igst: 18,
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 101, // ₹1 difference
        igst: 18,
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      // ₹1 tolerance should apply
      expect(result.status).toBe('MATCHED')
    })

    it('should handle very large invoice amounts', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 10000000000, // ₹1000 crore
        igst: 1800000000,
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 10000000000,
        igst: 1800000000,
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('MATCHED')
    })

    it('should handle invoice numbers with only special characters difference', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV#001@2024',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'INV.001.2024',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('MATCHED')
    })

    it('should handle zero tax invoices', () => {
      const invoice: PurchaseInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 0, // No tax
        cgst: 0,
        sgst: 0,
      }

      const gstr2bEntry: GSTR2BEntry = {
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-01-15'),
        taxableValue: 100000,
        igst: 0,
        cgst: 0,
        sgst: 0,
      }

      const result = matchInvoiceToGSTR2B(invoice, gstr2bEntry)

      expect(result.status).toBe('MATCHED')
    })

    it('should handle empty invoice lists', () => {
      const result = runReconciliation([], [])

      expect(result.matched).toHaveLength(0)
      expect(result.notIn2B).toHaveLength(0)
      expect(result.in2BOnly).toHaveLength(0)
      expect(result.summary.totalMatched).toBe(0)
    })
  })
})
