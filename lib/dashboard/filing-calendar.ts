/**
 * Filing Calendar Utilities
 *
 * Generates filing calendar data for dashboard display:
 * - Upcoming GSTR-1 and GSTR-3B deadlines
 * - Filed/pending status
 * - Overdue alerts
 */

import { format, subMonths, differenceInDays } from 'date-fns'
import { FilingType, FilingStatus } from '@prisma/client'

export interface FilingPeriodData {
  period: string      // YYYY-MM format
  filingType: FilingType | 'GSTR1' | 'GSTR3B'
  status: FilingStatus | 'FILED' | 'PENDING'
  filedAt?: Date | null
}

export interface FilingCalendarEntry {
  period: string          // YYYY-MM
  periodLabel: string     // "December 2025"
  filingType: 'GSTR1' | 'GSTR3B'
  filingLabel: string     // "GSTR-1" or "GSTR-3B"
  dueDate: Date
  daysUntilDue: number
  isOverdue: boolean
  status: 'FILED' | 'PENDING' | 'IN_REVIEW' | 'APPROVED'
  filedAt?: Date | null
}

/**
 * Get the due date for a filing based on return period
 * GSTR-1: 11th of following month
 * GSTR-3B: 20th of following month
 */
export function getFilingDueDate(period: string, filingType: 'GSTR1' | 'GSTR3B'): Date {
  const [year, month] = period.split('-').map(Number)
  const nextMonth = month === 12 ? 1 : month + 1
  const dueYear = month === 12 ? year + 1 : year
  const dueDay = filingType === 'GSTR1' ? 11 : 20

  return new Date(dueYear, nextMonth - 1, dueDay)
}

/**
 * Generate filing calendar entries for the next N months
 */
export function generateFilingCalendar(
  filingData: FilingPeriodData[],
  monthsAhead: number = 3
): FilingCalendarEntry[] {
  const now = new Date()
  const entries: FilingCalendarEntry[] = []

  // Create a map for quick lookup of filing status
  const filingMap = new Map<string, FilingPeriodData>()
  for (const filing of filingData) {
    filingMap.set(`${filing.period}-${filing.filingType}`, filing)
  }

  // Generate entries for each month
  for (let i = 0; i < monthsAhead; i++) {
    // Actually, we need to generate for the months whose returns are due now
    // If we're in January, we need Dec returns (due in Jan)
    // and Jan returns (due in Feb)
    const returnPeriod = format(subMonths(now, 1 - i), 'yyyy-MM')
    const periodDate = subMonths(now, 1 - i)
    const periodLabel = format(periodDate, 'MMMM yyyy')

    for (const filingType of ['GSTR1', 'GSTR3B'] as const) {
      const key = `${returnPeriod}-${filingType}`
      const existing = filingMap.get(key)
      const dueDate = getFilingDueDate(returnPeriod, filingType)
      const daysUntilDue = differenceInDays(dueDate, now)

      let status: FilingCalendarEntry['status'] = 'PENDING'
      if (existing) {
        if (existing.status === 'FILED') status = 'FILED'
        else if (existing.status === 'IN_REVIEW') status = 'IN_REVIEW'
        else if (existing.status === 'APPROVED') status = 'APPROVED'
      }

      entries.push({
        period: returnPeriod,
        periodLabel,
        filingType,
        filingLabel: filingType === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B',
        dueDate,
        daysUntilDue,
        isOverdue: status !== 'FILED' && daysUntilDue < 0,
        status,
        filedAt: existing?.filedAt,
      })
    }
  }

  return entries
}

/**
 * Get the next N filing deadlines that haven't been filed
 */
export function getNextFilingDeadlines(
  filingData: FilingPeriodData[],
  count: number = 4
): FilingCalendarEntry[] {
  // Generate calendar for next 6 months to ensure we have enough entries
  const calendar = generateFilingCalendar(filingData, 6)

  // Filter out filed entries and sort by due date
  return calendar
    .filter((entry) => entry.status !== 'FILED')
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, count)
}

/**
 * Get overdue filings
 */
export function getOverdueFilings(filingData: FilingPeriodData[]): FilingCalendarEntry[] {
  const calendar = generateFilingCalendar(filingData, 6)
  return calendar.filter((entry) => entry.isOverdue)
}
