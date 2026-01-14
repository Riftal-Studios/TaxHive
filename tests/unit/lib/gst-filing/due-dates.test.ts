import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getGSTR1DueDate,
  getGSTR3BDueDate,
  getFiscalYear,
  getFilingPeriodFromDate,
  isFilingOverdue,
  getDaysUntilDue,
  getUpcomingFilingPeriods,
} from '@/lib/gst-filing/due-dates'

describe('Due Date Calculations', () => {
  describe('getGSTR1DueDate', () => {
    it('should return 11th of following month for regular months', () => {
      // January 2024 -> Due: Feb 11, 2024
      const dueDate = getGSTR1DueDate('2024-01')
      expect(dueDate.getFullYear()).toBe(2024)
      expect(dueDate.getMonth()).toBe(1) // February (0-indexed)
      expect(dueDate.getDate()).toBe(11)
    })

    it('should handle December correctly', () => {
      // December 2024 -> Due: Jan 11, 2025
      const dueDate = getGSTR1DueDate('2024-12')
      expect(dueDate.getFullYear()).toBe(2025)
      expect(dueDate.getMonth()).toBe(0) // January
      expect(dueDate.getDate()).toBe(11)
    })

    it('should handle year transitions', () => {
      // March 2025 -> Due: Apr 11, 2025
      const dueDate = getGSTR1DueDate('2025-03')
      expect(dueDate.getFullYear()).toBe(2025)
      expect(dueDate.getMonth()).toBe(3) // April
      expect(dueDate.getDate()).toBe(11)
    })
  })

  describe('getGSTR3BDueDate', () => {
    it('should return 20th of following month for regular months', () => {
      // January 2024 -> Due: Feb 20, 2024
      const dueDate = getGSTR3BDueDate('2024-01')
      expect(dueDate.getFullYear()).toBe(2024)
      expect(dueDate.getMonth()).toBe(1) // February
      expect(dueDate.getDate()).toBe(20)
    })

    it('should handle December correctly', () => {
      // December 2024 -> Due: Jan 20, 2025
      const dueDate = getGSTR3BDueDate('2024-12')
      expect(dueDate.getFullYear()).toBe(2025)
      expect(dueDate.getMonth()).toBe(0) // January
      expect(dueDate.getDate()).toBe(20)
    })
  })

  describe('getFiscalYear', () => {
    it('should return correct fiscal year for April onwards', () => {
      // April 2024 is in FY 2024-25
      expect(getFiscalYear('2024-04')).toBe('2024-25')
      expect(getFiscalYear('2024-12')).toBe('2024-25')
      expect(getFiscalYear('2025-03')).toBe('2024-25')
    })

    it('should return correct fiscal year for January to March', () => {
      // January 2024 is in FY 2023-24
      expect(getFiscalYear('2024-01')).toBe('2023-24')
      expect(getFiscalYear('2024-02')).toBe('2023-24')
      expect(getFiscalYear('2024-03')).toBe('2023-24')
    })

    it('should handle year transitions', () => {
      expect(getFiscalYear('2025-04')).toBe('2025-26')
      expect(getFiscalYear('2026-01')).toBe('2025-26')
      expect(getFiscalYear('2026-03')).toBe('2025-26')
    })
  })

  describe('getFilingPeriodFromDate', () => {
    it('should return YYYY-MM format from date', () => {
      const date = new Date('2024-06-15')
      expect(getFilingPeriodFromDate(date)).toBe('2024-06')
    })

    it('should pad single digit months', () => {
      const date = new Date('2024-01-15')
      expect(getFilingPeriodFromDate(date)).toBe('2024-01')
    })

    it('should handle December correctly', () => {
      const date = new Date('2024-12-25')
      expect(getFilingPeriodFromDate(date)).toBe('2024-12')
    })
  })
})

describe('Filing Status Helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('isFilingOverdue', () => {
    it('should return true if due date has passed', () => {
      // Set current date to Feb 15, 2024
      vi.setSystemTime(new Date('2024-02-15'))

      // GSTR-1 for Jan 2024 was due Feb 11
      const dueDate = new Date('2024-02-11')
      expect(isFilingOverdue(dueDate)).toBe(true)
    })

    it('should return false if due date has not passed', () => {
      // Set current date to Feb 10, 2024
      vi.setSystemTime(new Date('2024-02-10'))

      // GSTR-1 for Jan 2024 is due Feb 11
      const dueDate = new Date('2024-02-11')
      expect(isFilingOverdue(dueDate)).toBe(false)
    })

    it('should return false on the due date itself', () => {
      // Set current date to Feb 11, 2024
      vi.setSystemTime(new Date('2024-02-11T10:00:00'))

      const dueDate = new Date('2024-02-11')
      expect(isFilingOverdue(dueDate)).toBe(false)
    })
  })

  describe('getDaysUntilDue', () => {
    it('should return positive days if due date is in future', () => {
      vi.setSystemTime(new Date('2024-02-01'))

      const dueDate = new Date('2024-02-11')
      expect(getDaysUntilDue(dueDate)).toBe(10)
    })

    it('should return negative days if due date has passed', () => {
      vi.setSystemTime(new Date('2024-02-15'))

      const dueDate = new Date('2024-02-11')
      expect(getDaysUntilDue(dueDate)).toBe(-4)
    })

    it('should return 0 on due date', () => {
      vi.setSystemTime(new Date('2024-02-11T10:00:00'))

      const dueDate = new Date('2024-02-11')
      expect(getDaysUntilDue(dueDate)).toBe(0)
    })
  })
})

describe('Upcoming Filing Periods', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getUpcomingFilingPeriods', () => {
    it('should return upcoming periods with due dates', () => {
      // Set current date to Jan 15, 2024
      vi.setSystemTime(new Date('2024-01-15'))

      const periods = getUpcomingFilingPeriods(3)

      expect(periods.length).toBe(3)

      // First period is December 2023 (previous month)
      expect(periods[0].period).toBe('2023-12')
      expect(periods[0].gstr1DueDate.getFullYear()).toBe(2024)
      expect(periods[0].gstr1DueDate.getMonth()).toBe(0) // January
      expect(periods[0].gstr1DueDate.getDate()).toBe(11)
      expect(periods[0].gstr3bDueDate.getDate()).toBe(20)

      // Second period is January 2024
      expect(periods[1].period).toBe('2024-01')
      expect(periods[1].gstr1DueDate.getMonth()).toBe(1) // February

      // Third period is February 2024
      expect(periods[2].period).toBe('2024-02')
    })

    it('should include fiscal year information', () => {
      vi.setSystemTime(new Date('2024-03-15'))

      const periods = getUpcomingFilingPeriods(2)

      // February 2024 is in FY 2023-24
      expect(periods[0].period).toBe('2024-02')
      expect(periods[0].fiscalYear).toBe('2023-24')

      // March 2024 is also in FY 2023-24
      expect(periods[1].period).toBe('2024-03')
      expect(periods[1].fiscalYear).toBe('2023-24')
    })

    it('should handle fiscal year transitions', () => {
      vi.setSystemTime(new Date('2024-04-15'))

      const periods = getUpcomingFilingPeriods(2)

      // March 2024 is in FY 2023-24
      expect(periods[0].period).toBe('2024-03')
      expect(periods[0].fiscalYear).toBe('2023-24')

      // April 2024 is in FY 2024-25
      expect(periods[1].period).toBe('2024-04')
      expect(periods[1].fiscalYear).toBe('2024-25')
    })

    it('should return empty array if count is 0', () => {
      vi.setSystemTime(new Date('2024-01-15'))
      expect(getUpcomingFilingPeriods(0)).toEqual([])
    })
  })
})

describe('Period Parsing', () => {
  describe('period format validation', () => {
    it('should handle valid period formats', () => {
      // These should not throw
      expect(() => getGSTR1DueDate('2024-01')).not.toThrow()
      expect(() => getGSTR1DueDate('2025-12')).not.toThrow()
    })

    it('should calculate due dates for edge months', () => {
      // February - short month
      const febDue = getGSTR1DueDate('2024-02')
      expect(febDue.getMonth()).toBe(2) // March
      expect(febDue.getDate()).toBe(11)

      // November
      const novDue = getGSTR3BDueDate('2024-11')
      expect(novDue.getMonth()).toBe(11) // December
      expect(novDue.getDate()).toBe(20)
    })
  })
})
