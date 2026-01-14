/**
 * ITC Health Calculation Tests
 *
 * Tests for ITC reconciliation health status:
 * - Matched vs unmatched entries
 * - ITC at risk calculation
 * - Follow-up recommendations
 */

import { describe, it, expect } from 'vitest'
import {
  calculateITCHealth,
  getITCHealthStatus,
  type ITCHealthInput,
} from '@/lib/dashboard/itc-health'

describe('ITC Health Calculation', () => {
  describe('calculateITCHealth', () => {
    it('should return excellent health for all matched', () => {
      const input: ITCHealthInput = {
        totalEntries: 100,
        matchedCount: 100,
        matchedAmount: 500000,
        amountMismatchCount: 0,
        amountMismatchAmount: 0,
        notIn2BCount: 0,
        notIn2BAmount: 0,
        in2BOnlyCount: 0,
        in2BOnlyAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      }

      const result = calculateITCHealth(input)

      expect(result.matchRate).toBe(100)
      expect(result.status).toBe('excellent')
      expect(result.itcAtRisk).toBe(0)
      expect(result.followUpNeeded).toBe(0)
    })

    it('should calculate correct match rate', () => {
      const input: ITCHealthInput = {
        totalEntries: 100,
        matchedCount: 75,
        matchedAmount: 375000,
        amountMismatchCount: 10,
        amountMismatchAmount: 50000,
        notIn2BCount: 10,
        notIn2BAmount: 50000,
        in2BOnlyCount: 5,
        in2BOnlyAmount: 25000,
        pendingCount: 0,
        pendingAmount: 0,
      }

      const result = calculateITCHealth(input)

      expect(result.matchRate).toBe(75)
    })

    it('should calculate ITC at risk (amount mismatches)', () => {
      const input: ITCHealthInput = {
        totalEntries: 50,
        matchedCount: 40,
        matchedAmount: 400000,
        amountMismatchCount: 10,
        amountMismatchAmount: 100000,
        notIn2BCount: 0,
        notIn2BAmount: 0,
        in2BOnlyCount: 0,
        in2BOnlyAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      }

      const result = calculateITCHealth(input)

      // ITC at risk = amount mismatch + not in 2B
      expect(result.itcAtRisk).toBe(100000)
    })

    it('should calculate follow-up needed (not in 2B entries)', () => {
      const input: ITCHealthInput = {
        totalEntries: 60,
        matchedCount: 50,
        matchedAmount: 250000,
        amountMismatchCount: 0,
        amountMismatchAmount: 0,
        notIn2BCount: 10,
        notIn2BAmount: 75000,
        in2BOnlyCount: 0,
        in2BOnlyAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      }

      const result = calculateITCHealth(input)

      // Follow-up needed = not in 2B + in 2B only
      expect(result.followUpNeeded).toBe(10)
      expect(result.followUpAmount).toBe(75000)
    })

    it('should handle zero entries gracefully', () => {
      const input: ITCHealthInput = {
        totalEntries: 0,
        matchedCount: 0,
        matchedAmount: 0,
        amountMismatchCount: 0,
        amountMismatchAmount: 0,
        notIn2BCount: 0,
        notIn2BAmount: 0,
        in2BOnlyCount: 0,
        in2BOnlyAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      }

      const result = calculateITCHealth(input)

      expect(result.matchRate).toBe(100) // No entries = perfect
      expect(result.status).toBe('excellent')
    })

    it('should include in 2B only entries in follow-up', () => {
      const input: ITCHealthInput = {
        totalEntries: 30,
        matchedCount: 25,
        matchedAmount: 125000,
        amountMismatchCount: 0,
        amountMismatchAmount: 0,
        notIn2BCount: 0,
        notIn2BAmount: 0,
        in2BOnlyCount: 5,
        in2BOnlyAmount: 25000,
        pendingCount: 0,
        pendingAmount: 0,
      }

      const result = calculateITCHealth(input)

      expect(result.followUpNeeded).toBe(5)
      expect(result.followUpAmount).toBe(25000)
    })

    it('should combine all risk factors', () => {
      const input: ITCHealthInput = {
        totalEntries: 100,
        matchedCount: 60,
        matchedAmount: 300000,
        amountMismatchCount: 15,
        amountMismatchAmount: 75000,
        notIn2BCount: 15,
        notIn2BAmount: 75000,
        in2BOnlyCount: 10,
        in2BOnlyAmount: 50000,
        pendingCount: 0,
        pendingAmount: 0,
      }

      const result = calculateITCHealth(input)

      expect(result.matchRate).toBe(60)
      // ITC at risk = mismatch + not in 2B = 150000
      expect(result.itcAtRisk).toBe(150000)
      // Follow-up = not in 2B + in 2B only = 25 entries
      expect(result.followUpNeeded).toBe(25)
    })
  })

  describe('getITCHealthStatus', () => {
    it('should return excellent for match rate >= 95%', () => {
      expect(getITCHealthStatus(100)).toBe('excellent')
      expect(getITCHealthStatus(95)).toBe('excellent')
    })

    it('should return good for match rate >= 80%', () => {
      expect(getITCHealthStatus(94)).toBe('good')
      expect(getITCHealthStatus(80)).toBe('good')
    })

    it('should return warning for match rate >= 60%', () => {
      expect(getITCHealthStatus(79)).toBe('warning')
      expect(getITCHealthStatus(60)).toBe('warning')
    })

    it('should return critical for match rate < 60%', () => {
      expect(getITCHealthStatus(59)).toBe('critical')
      expect(getITCHealthStatus(0)).toBe('critical')
    })
  })

  describe('ITC Health - Summary Generation', () => {
    it('should provide actionable summary for warning status', () => {
      const input: ITCHealthInput = {
        totalEntries: 100,
        matchedCount: 70,
        matchedAmount: 350000,
        amountMismatchCount: 20,
        amountMismatchAmount: 100000,
        notIn2BCount: 10,
        notIn2BAmount: 50000,
        in2BOnlyCount: 0,
        in2BOnlyAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      }

      const result = calculateITCHealth(input)

      expect(result.status).toBe('warning')
      expect(result.summary).toBeDefined()
      expect(result.summary.length).toBeGreaterThan(0)
    })

    it('should suggest vendor follow-up for not in 2B entries', () => {
      const input: ITCHealthInput = {
        totalEntries: 50,
        matchedCount: 40,
        matchedAmount: 200000,
        amountMismatchCount: 0,
        amountMismatchAmount: 0,
        notIn2BCount: 10,
        notIn2BAmount: 50000,
        in2BOnlyCount: 0,
        in2BOnlyAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      }

      const result = calculateITCHealth(input)

      expect(result.actions).toBeDefined()
      expect(result.actions).toContain('followUpVendors')
    })

    it('should suggest invoice verification for mismatches', () => {
      const input: ITCHealthInput = {
        totalEntries: 50,
        matchedCount: 40,
        matchedAmount: 200000,
        amountMismatchCount: 10,
        amountMismatchAmount: 50000,
        notIn2BCount: 0,
        notIn2BAmount: 0,
        in2BOnlyCount: 0,
        in2BOnlyAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      }

      const result = calculateITCHealth(input)

      expect(result.actions).toContain('verifyInvoices')
    })
  })
})
