/**
 * Filing Calendar Tests
 *
 * Tests for generating filing calendar data:
 * - Upcoming filing deadlines
 * - Filed/pending status
 * - Days until due calculation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateFilingCalendar,
  getNextFilingDeadlines,
  type FilingCalendarEntry,
  type FilingPeriodData,
} from '@/lib/dashboard/filing-calendar'

describe('Filing Calendar', () => {
  beforeEach(() => {
    // Mock current date to January 15, 2026
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('generateFilingCalendar', () => {
    it('should generate calendar entries for next 3 months', () => {
      const filingData: FilingPeriodData[] = []

      const calendar = generateFilingCalendar(filingData, 3)

      // Should have entries for Jan, Feb, Mar 2026
      // Each month has GSTR-1 and GSTR-3B = 6 total
      expect(calendar.length).toBe(6)
    })

    it('should mark entries as pending when not filed', () => {
      const filingData: FilingPeriodData[] = []

      const calendar = generateFilingCalendar(filingData, 1)

      const gstr1 = calendar.find((e) => e.filingType === 'GSTR1')
      const gstr3b = calendar.find((e) => e.filingType === 'GSTR3B')

      expect(gstr1?.status).toBe('PENDING')
      expect(gstr3b?.status).toBe('PENDING')
    })

    it('should mark entries as filed when in filing data', () => {
      const filingData: FilingPeriodData[] = [
        {
          period: '2025-12',
          filingType: 'GSTR1',
          status: 'FILED',
          filedAt: new Date('2026-01-10'),
        },
      ]

      const calendar = generateFilingCalendar(filingData, 2)

      const decGstr1 = calendar.find(
        (e) => e.filingType === 'GSTR1' && e.period === '2025-12'
      )
      expect(decGstr1?.status).toBe('FILED')
    })

    it('should calculate correct due dates (GSTR-1: 11th, GSTR-3B: 20th)', () => {
      const filingData: FilingPeriodData[] = []

      // Calendar for December 2025 (returns filed in January)
      const calendar = generateFilingCalendar(filingData, 1)

      // December 2025 returns:
      // GSTR-1 due: January 11, 2026
      // GSTR-3B due: January 20, 2026
      const gstr1 = calendar.find(
        (e) => e.filingType === 'GSTR1' && e.period === '2025-12'
      )
      const gstr3b = calendar.find(
        (e) => e.filingType === 'GSTR3B' && e.period === '2025-12'
      )

      expect(gstr1?.dueDate.getDate()).toBe(11)
      expect(gstr1?.dueDate.getMonth()).toBe(0) // January
      expect(gstr3b?.dueDate.getDate()).toBe(20)
      expect(gstr3b?.dueDate.getMonth()).toBe(0) // January
    })

    it('should calculate days until due correctly', () => {
      const filingData: FilingPeriodData[] = []

      // Current date: January 15, 2026
      const calendar = generateFilingCalendar(filingData, 1)

      const gstr1 = calendar.find((e) => e.filingType === 'GSTR1')
      const gstr3b = calendar.find((e) => e.filingType === 'GSTR3B')

      // GSTR-1 due Jan 11 = -4 days (overdue)
      // GSTR-3B due Jan 20 - differenceInDays(Jan20, Jan15) = 4 or 5 depending on time
      expect(gstr1?.daysUntilDue).toBeLessThan(0)
      expect(gstr3b?.daysUntilDue).toBeGreaterThan(0)
    })

    it('should mark overdue entries correctly', () => {
      const filingData: FilingPeriodData[] = []

      const calendar = generateFilingCalendar(filingData, 1)

      const gstr1 = calendar.find((e) => e.filingType === 'GSTR1')
      const gstr3b = calendar.find((e) => e.filingType === 'GSTR3B')

      expect(gstr1?.isOverdue).toBe(true)  // Jan 11 < Jan 15
      expect(gstr3b?.isOverdue).toBe(false) // Jan 20 > Jan 15
    })
  })

  describe('getNextFilingDeadlines', () => {
    it('should return next N deadlines sorted by date', () => {
      const filingData: FilingPeriodData[] = []

      const deadlines = getNextFilingDeadlines(filingData, 4)

      expect(deadlines).toHaveLength(4)
      // Should be sorted by due date
      for (let i = 1; i < deadlines.length; i++) {
        expect(deadlines[i].dueDate.getTime()).toBeGreaterThanOrEqual(
          deadlines[i - 1].dueDate.getTime()
        )
      }
    })

    it('should exclude already filed returns', () => {
      const filingData: FilingPeriodData[] = [
        {
          period: '2025-12',
          filingType: 'GSTR1',
          status: 'FILED',
          filedAt: new Date('2026-01-10'),
        },
        {
          period: '2025-12',
          filingType: 'GSTR3B',
          status: 'FILED',
          filedAt: new Date('2026-01-18'),
        },
      ]

      const deadlines = getNextFilingDeadlines(filingData, 4)

      // December returns are filed, should not appear
      expect(deadlines.find((d) => d.period === '2025-12')).toBeUndefined()
    })

    it('should include overdue unfiled returns at the top', () => {
      const filingData: FilingPeriodData[] = []

      const deadlines = getNextFilingDeadlines(filingData, 4)

      // GSTR-1 for Dec 2025 (due Jan 11) is overdue
      const first = deadlines[0]
      expect(first.isOverdue).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle fiscal year boundary (March/April)', () => {
      // Set date to March 25, 2026
      vi.setSystemTime(new Date('2026-03-25'))

      const filingData: FilingPeriodData[] = []
      const calendar = generateFilingCalendar(filingData, 2)

      // Should include Feb and Mar 2026 returns
      const periods = calendar.map((e) => e.period)
      expect(periods).toContain('2026-02')
      expect(periods).toContain('2026-03')
    })

    it('should format period label correctly', () => {
      const filingData: FilingPeriodData[] = []
      const calendar = generateFilingCalendar(filingData, 1)

      const entry = calendar[0]
      // Should have human-readable period label
      expect(entry.periodLabel).toBeDefined()
      expect(entry.periodLabel).toContain('2025') // December 2025
    })
  })
})
