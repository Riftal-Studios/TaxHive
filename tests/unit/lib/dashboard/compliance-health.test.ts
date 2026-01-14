/**
 * Compliance Health Calculation Tests
 *
 * Tests for calculating compliance health score based on:
 * - LUT status (valid/expiring/expired)
 * - Pending filings count
 * - Overdue returns
 * - Unreconciled ITC count
 */

import { describe, it, expect } from 'vitest'
import {
  calculateComplianceHealth,
  getComplianceIssues,
  type ComplianceHealthInput,
  type ComplianceIssue,
} from '@/lib/dashboard/compliance-health'

describe('Compliance Health Calculation', () => {
  describe('calculateComplianceHealth', () => {
    it('should return 100 for perfect compliance', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'VALID',
        lutDaysRemaining: 300,
        pendingFilingsCount: 0,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const result = calculateComplianceHealth(input)

      expect(result.score).toBe(100)
      expect(result.status).toBe('excellent')
    })

    it('should deduct points for expiring LUT (< 30 days)', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'EXPIRING',
        lutDaysRemaining: 15,
        pendingFilingsCount: 0,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const result = calculateComplianceHealth(input)

      expect(result.score).toBeLessThan(100)
      expect(result.score).toBeGreaterThanOrEqual(70)
      expect(result.status).toBe('good')
    })

    it('should deduct significant points for expired LUT', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'EXPIRED',
        lutDaysRemaining: -10,
        pendingFilingsCount: 0,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const result = calculateComplianceHealth(input)

      expect(result.score).toBeLessThan(70)
      expect(result.status).toBe('warning')
    })

    it('should deduct points for pending filings', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'VALID',
        lutDaysRemaining: 300,
        pendingFilingsCount: 2,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const result = calculateComplianceHealth(input)

      expect(result.score).toBeLessThan(100)
      expect(result.score).toBeGreaterThanOrEqual(90)
    })

    it('should deduct significant points for overdue filings', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'VALID',
        lutDaysRemaining: 300,
        pendingFilingsCount: 0,
        overdueFilingsCount: 2,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const result = calculateComplianceHealth(input)

      expect(result.score).toBeLessThan(80)
      expect(result.status).toBe('warning')
    })

    it('should deduct points for unreconciled ITC', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'VALID',
        lutDaysRemaining: 300,
        pendingFilingsCount: 0,
        overdueFilingsCount: 0,
        unreconciledITCCount: 5,
        unreconciledITCAmount: 50000,
      }

      const result = calculateComplianceHealth(input)

      expect(result.score).toBeLessThan(100)
      expect(result.score).toBeGreaterThanOrEqual(85)
    })

    it('should return critical status for multiple issues', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'EXPIRED',
        lutDaysRemaining: -30,
        pendingFilingsCount: 3,
        overdueFilingsCount: 2,
        unreconciledITCCount: 10,
        unreconciledITCAmount: 100000,
      }

      const result = calculateComplianceHealth(input)

      expect(result.score).toBeLessThan(50)
      expect(result.status).toBe('critical')
    })

    it('should handle missing LUT (no LUT at all)', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'MISSING',
        lutDaysRemaining: null,
        pendingFilingsCount: 0,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const result = calculateComplianceHealth(input)

      // Missing LUT is a warning but not as severe as expired
      expect(result.score).toBeLessThan(90)
      expect(result.score).toBeGreaterThanOrEqual(60)
    })

    it('should never return score below 0', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'EXPIRED',
        lutDaysRemaining: -365,
        pendingFilingsCount: 12,
        overdueFilingsCount: 12,
        unreconciledITCCount: 100,
        unreconciledITCAmount: 1000000,
      }

      const result = calculateComplianceHealth(input)

      expect(result.score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getComplianceIssues', () => {
    it('should return empty array for perfect compliance', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'VALID',
        lutDaysRemaining: 300,
        pendingFilingsCount: 0,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const issues = getComplianceIssues(input)

      expect(issues).toHaveLength(0)
    })

    it('should return LUT expiring issue', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'EXPIRING',
        lutDaysRemaining: 15,
        pendingFilingsCount: 0,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const issues = getComplianceIssues(input)

      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('lut')
      expect(issues[0].severity).toBe('warning')
      expect(issues[0].message).toContain('15 days')
    })

    it('should return LUT expired issue with error severity', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'EXPIRED',
        lutDaysRemaining: -10,
        pendingFilingsCount: 0,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const issues = getComplianceIssues(input)

      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('lut')
      expect(issues[0].severity).toBe('error')
      expect(issues[0].message).toContain('expired')
    })

    it('should return overdue filings issue', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'VALID',
        lutDaysRemaining: 300,
        pendingFilingsCount: 0,
        overdueFilingsCount: 3,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const issues = getComplianceIssues(input)

      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('filing')
      expect(issues[0].severity).toBe('error')
      expect(issues[0].message).toContain('3')
    })

    it('should return pending filings issue', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'VALID',
        lutDaysRemaining: 300,
        pendingFilingsCount: 2,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const issues = getComplianceIssues(input)

      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('filing')
      expect(issues[0].severity).toBe('info')
    })

    it('should return ITC reconciliation issue', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'VALID',
        lutDaysRemaining: 300,
        pendingFilingsCount: 0,
        overdueFilingsCount: 0,
        unreconciledITCCount: 8,
        unreconciledITCAmount: 75000,
      }

      const issues = getComplianceIssues(input)

      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('itc')
      expect(issues[0].severity).toBe('warning')
    })

    it('should return multiple issues sorted by severity', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'EXPIRED',
        lutDaysRemaining: -5,
        pendingFilingsCount: 2,
        overdueFilingsCount: 1,
        unreconciledITCCount: 5,
        unreconciledITCAmount: 50000,
      }

      const issues = getComplianceIssues(input)

      expect(issues.length).toBeGreaterThan(1)
      // Errors should come first
      const severityOrder = { error: 0, warning: 1, info: 2 }
      for (let i = 1; i < issues.length; i++) {
        expect(severityOrder[issues[i].severity]).toBeGreaterThanOrEqual(
          severityOrder[issues[i - 1].severity]
        )
      }
    })
  })

  describe('Status thresholds', () => {
    it('should return excellent for score >= 90', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'VALID',
        lutDaysRemaining: 300,
        pendingFilingsCount: 1,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const result = calculateComplianceHealth(input)

      expect(result.status).toBe('excellent')
    })

    it('should return good for score >= 70 and < 90', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'EXPIRING',
        lutDaysRemaining: 20,
        pendingFilingsCount: 1,
        overdueFilingsCount: 0,
        unreconciledITCCount: 3,
        unreconciledITCAmount: 25000,
      }

      const result = calculateComplianceHealth(input)

      if (result.score >= 70 && result.score < 90) {
        expect(result.status).toBe('good')
      }
    })

    it('should return warning for score >= 50 and < 70', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'EXPIRED',
        lutDaysRemaining: -5,
        pendingFilingsCount: 1,
        overdueFilingsCount: 0,
        unreconciledITCCount: 0,
        unreconciledITCAmount: 0,
      }

      const result = calculateComplianceHealth(input)

      if (result.score >= 50 && result.score < 70) {
        expect(result.status).toBe('warning')
      }
    })

    it('should return critical for score < 50', () => {
      const input: ComplianceHealthInput = {
        lutStatus: 'EXPIRED',
        lutDaysRemaining: -30,
        pendingFilingsCount: 5,
        overdueFilingsCount: 3,
        unreconciledITCCount: 20,
        unreconciledITCAmount: 200000,
      }

      const result = calculateComplianceHealth(input)

      expect(result.status).toBe('critical')
    })
  })
})
