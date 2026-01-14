/**
 * GST Summary Calculation Tests
 *
 * Tests for calculating GST summary:
 * - Output GST liability
 * - ITC available (RCM + B2B)
 * - Net payable
 * - Period-wise breakdown
 */

import { describe, it, expect } from 'vitest'
import {
  calculateGSTSummary,
  calculateNetPayable,
  type GSTSummaryInput,
} from '@/lib/dashboard/gst-summary'

describe('GST Summary Calculation', () => {
  describe('calculateGSTSummary', () => {
    it('should return zero values for no transactions', () => {
      const input: GSTSummaryInput = {
        outputIGST: 0,
        outputCGST: 0,
        outputSGST: 0,
        itcIGST: 0,
        itcCGST: 0,
        itcSGST: 0,
        rcmIGST: 0,
        rcmCGST: 0,
        rcmSGST: 0,
      }

      const result = calculateGSTSummary(input)

      expect(result.outputLiability.total).toBe(0)
      expect(result.itcAvailable.total).toBe(0)
      expect(result.netPayable.total).toBe(0)
    })

    it('should calculate output liability correctly', () => {
      const input: GSTSummaryInput = {
        outputIGST: 10000,
        outputCGST: 5000,
        outputSGST: 5000,
        itcIGST: 0,
        itcCGST: 0,
        itcSGST: 0,
        rcmIGST: 0,
        rcmCGST: 0,
        rcmSGST: 0,
      }

      const result = calculateGSTSummary(input)

      expect(result.outputLiability.igst).toBe(10000)
      expect(result.outputLiability.cgst).toBe(5000)
      expect(result.outputLiability.sgst).toBe(5000)
      expect(result.outputLiability.total).toBe(20000)
    })

    it('should calculate ITC available correctly (including RCM credit)', () => {
      const input: GSTSummaryInput = {
        outputIGST: 0,
        outputCGST: 0,
        outputSGST: 0,
        itcIGST: 8000,
        itcCGST: 2000,
        itcSGST: 2000,
        rcmIGST: 3000,
        rcmCGST: 1000,
        rcmSGST: 1000,
      }

      const result = calculateGSTSummary(input)

      // ITC = B2B ITC + RCM ITC (tax paid under RCM becomes ITC)
      expect(result.itcAvailable.igst).toBe(11000) // 8000 + 3000
      expect(result.itcAvailable.cgst).toBe(3000)  // 2000 + 1000
      expect(result.itcAvailable.sgst).toBe(3000)  // 2000 + 1000
      expect(result.itcAvailable.total).toBe(17000)
    })

    it('should calculate net payable correctly', () => {
      const input: GSTSummaryInput = {
        outputIGST: 15000,
        outputCGST: 5000,
        outputSGST: 5000,
        itcIGST: 5000,
        itcCGST: 2000,
        itcSGST: 2000,
        rcmIGST: 2000,
        rcmCGST: 1000,
        rcmSGST: 1000,
      }

      const result = calculateGSTSummary(input)

      // Output: 25000
      // ITC: 5000 + 2000 + 2000 + 2000 + 1000 + 1000 = 13000
      // Net: 25000 - 13000 = 12000
      expect(result.outputLiability.total).toBe(25000)
      expect(result.itcAvailable.total).toBe(13000)
      expect(result.netPayable.total).toBe(12000)
    })

    it('should handle ITC excess (refundable scenario)', () => {
      const input: GSTSummaryInput = {
        outputIGST: 0,  // Zero-rated exports - no output tax
        outputCGST: 0,
        outputSGST: 0,
        itcIGST: 10000,
        itcCGST: 3000,
        itcSGST: 3000,
        rcmIGST: 5000,
        rcmCGST: 0,
        rcmSGST: 0,
      }

      const result = calculateGSTSummary(input)

      // ITC exceeds output - accumulated ITC for refund
      expect(result.netPayable.total).toBe(-21000) // Negative means refundable
      expect(result.accumulatedITC).toBe(21000)
    })

    it('should track RCM liability separately', () => {
      const input: GSTSummaryInput = {
        outputIGST: 0,
        outputCGST: 0,
        outputSGST: 0,
        itcIGST: 0,
        itcCGST: 0,
        itcSGST: 0,
        rcmIGST: 8000,
        rcmCGST: 2000,
        rcmSGST: 2000,
      }

      const result = calculateGSTSummary(input)

      // RCM is both liability and credit - net effect is zero
      expect(result.rcmLiability.igst).toBe(8000)
      expect(result.rcmLiability.cgst).toBe(2000)
      expect(result.rcmLiability.sgst).toBe(2000)
      expect(result.rcmLiability.total).toBe(12000)
    })

    it('should handle mixed domestic and export scenario', () => {
      const input: GSTSummaryInput = {
        outputIGST: 18000,  // Domestic B2B
        outputCGST: 0,
        outputSGST: 0,
        itcIGST: 25000,     // Higher ITC from purchases
        itcCGST: 0,
        itcSGST: 0,
        rcmIGST: 3600,      // Import of services RCM
        rcmCGST: 0,
        rcmSGST: 0,
      }

      const result = calculateGSTSummary(input)

      // Output: 18000
      // ITC: 25000 + 3600 = 28600
      // Net: 18000 - 28600 = -10600 (refundable)
      expect(result.outputLiability.total).toBe(18000)
      expect(result.itcAvailable.total).toBe(28600)
      expect(result.netPayable.total).toBe(-10600)
      expect(result.accumulatedITC).toBe(10600)
    })
  })

  describe('calculateNetPayable', () => {
    it('should calculate net payable with IGST cross-utilization', () => {
      // IGST can be used to pay CGST/SGST
      const result = calculateNetPayable({
        outputIGST: 0,
        outputCGST: 10000,
        outputSGST: 10000,
        itcIGST: 15000,
        itcCGST: 0,
        itcSGST: 0,
      })

      // IGST ITC of 15000 can offset CGST and SGST
      // Net payable should be 20000 - 15000 = 5000
      expect(result.total).toBe(5000)
    })

    it('should not allow CGST to pay SGST or vice versa', () => {
      const result = calculateNetPayable({
        outputIGST: 0,
        outputCGST: 10000,
        outputSGST: 0,
        itcIGST: 0,
        itcCGST: 0,
        itcSGST: 8000,  // SGST ITC cannot pay CGST
      })

      // CGST liability remains, SGST ITC becomes accumulated
      expect(result.cgst).toBe(10000)
      expect(result.sgst).toBe(-8000)  // Accumulated
      expect(result.total).toBe(2000)
    })

    it('should handle all zero inputs', () => {
      const result = calculateNetPayable({
        outputIGST: 0,
        outputCGST: 0,
        outputSGST: 0,
        itcIGST: 0,
        itcCGST: 0,
        itcSGST: 0,
      })

      expect(result.igst).toBe(0)
      expect(result.cgst).toBe(0)
      expect(result.sgst).toBe(0)
      expect(result.total).toBe(0)
    })
  })

  describe('GST Summary - Edge Cases', () => {
    it('should handle very small amounts (paisa precision)', () => {
      const input: GSTSummaryInput = {
        outputIGST: 100.50,
        outputCGST: 50.25,
        outputSGST: 50.25,
        itcIGST: 0,
        itcCGST: 0,
        itcSGST: 0,
        rcmIGST: 0,
        rcmCGST: 0,
        rcmSGST: 0,
      }

      const result = calculateGSTSummary(input)

      expect(result.outputLiability.total).toBe(201)
    })

    it('should handle large amounts without precision loss', () => {
      const input: GSTSummaryInput = {
        outputIGST: 10000000,  // 1 crore
        outputCGST: 5000000,
        outputSGST: 5000000,
        itcIGST: 8000000,
        itcCGST: 4000000,
        itcSGST: 4000000,
        rcmIGST: 1000000,
        rcmCGST: 500000,
        rcmSGST: 500000,
      }

      const result = calculateGSTSummary(input)

      expect(result.outputLiability.total).toBe(20000000)
      expect(result.itcAvailable.total).toBe(18000000)
      expect(result.netPayable.total).toBe(2000000)
    })
  })
})
