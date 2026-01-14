/**
 * GST Filing Due Date Calculations
 *
 * Indian GST Filing Due Dates:
 * - GSTR-1: 11th of the following month
 * - GSTR-3B: 20th of the following month
 *
 * Fiscal Year: April to March (e.g., FY 2024-25 is April 2024 to March 2025)
 */

/**
 * Parse period string (YYYY-MM) into year and month
 */
function parsePeriod(period: string): { year: number; month: number } {
  const [yearStr, monthStr] = period.split('-')
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10), // 1-12
  }
}

/**
 * Get the GSTR-1 due date for a given period
 * GSTR-1 is due on 11th of the following month
 *
 * @param period - Period in YYYY-MM format (e.g., "2024-01")
 * @returns Due date
 */
export function getGSTR1DueDate(period: string): Date {
  const { year, month } = parsePeriod(period)

  // Due date is 11th of the following month
  let dueYear = year
  let dueMonth = month + 1 // Following month (1-13)

  // Handle December -> January rollover
  if (dueMonth > 12) {
    dueMonth = 1
    dueYear += 1
  }

  // Create date (month is 0-indexed in JS Date)
  return new Date(dueYear, dueMonth - 1, 11)
}

/**
 * Get the GSTR-3B due date for a given period
 * GSTR-3B is due on 20th of the following month
 *
 * @param period - Period in YYYY-MM format (e.g., "2024-01")
 * @returns Due date
 */
export function getGSTR3BDueDate(period: string): Date {
  const { year, month } = parsePeriod(period)

  // Due date is 20th of the following month
  let dueYear = year
  let dueMonth = month + 1 // Following month

  // Handle December -> January rollover
  if (dueMonth > 12) {
    dueMonth = 1
    dueYear += 1
  }

  // Create date (month is 0-indexed in JS Date)
  return new Date(dueYear, dueMonth - 1, 20)
}

/**
 * Get the fiscal year for a given period
 * Indian FY runs from April to March
 *
 * @param period - Period in YYYY-MM format
 * @returns Fiscal year in "YYYY-YY" format (e.g., "2024-25")
 */
export function getFiscalYear(period: string): string {
  const { year, month } = parsePeriod(period)

  // April (4) to March (3) is one fiscal year
  // Jan-Mar belongs to previous FY
  if (month >= 4) {
    // April onwards - FY starts in current year
    const fyStart = year
    const fyEnd = (year + 1) % 100 // Get last 2 digits
    return `${fyStart}-${fyEnd.toString().padStart(2, '0')}`
  } else {
    // Jan-Mar - FY started previous year
    const fyStart = year - 1
    const fyEnd = year % 100
    return `${fyStart}-${fyEnd.toString().padStart(2, '0')}`
  }
}

/**
 * Get the filing period from a date
 *
 * @param date - Date object
 * @returns Period in YYYY-MM format
 */
export function getFilingPeriodFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12
  return `${year}-${month.toString().padStart(2, '0')}`
}

/**
 * Check if a filing is overdue
 *
 * @param dueDate - Due date
 * @param currentDate - Current date (defaults to now)
 * @returns True if overdue
 */
export function isFilingOverdue(dueDate: Date, currentDate: Date = new Date()): boolean {
  // Set both dates to start of day for fair comparison
  const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  const currentDateStart = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  )

  return currentDateStart > dueDateStart
}

/**
 * Get the number of days until a due date
 *
 * @param dueDate - Due date
 * @param currentDate - Current date (defaults to now)
 * @returns Number of days (negative if overdue)
 */
export function getDaysUntilDue(dueDate: Date, currentDate: Date = new Date()): number {
  // Set both dates to start of day
  const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  const currentDateStart = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  )

  const diffMs = dueDateStart.getTime() - currentDateStart.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Filing period information
 */
export interface FilingPeriodInfo {
  period: string // YYYY-MM
  fiscalYear: string // YYYY-YY
  gstr1DueDate: Date
  gstr3bDueDate: Date
}

/**
 * Get upcoming filing periods
 *
 * @param count - Number of periods to return
 * @param startDate - Start date (defaults to now)
 * @returns Array of filing period information
 */
export function getUpcomingFilingPeriods(
  count: number,
  startDate: Date = new Date()
): FilingPeriodInfo[] {
  if (count <= 0) return []

  const periods: FilingPeriodInfo[] = []

  // Start with the previous month (most recent filing period)
  let year = startDate.getFullYear()
  let month = startDate.getMonth() // 0-indexed

  // Go to previous month
  if (month === 0) {
    month = 12
    year -= 1
  }
  // month is now 1-12 for our purposes

  for (let i = 0; i < count; i++) {
    const period = `${year}-${month.toString().padStart(2, '0')}`

    periods.push({
      period,
      fiscalYear: getFiscalYear(period),
      gstr1DueDate: getGSTR1DueDate(period),
      gstr3bDueDate: getGSTR3BDueDate(period),
    })

    // Move to next month
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return periods
}

/**
 * Format a period string for display
 *
 * @param period - Period in YYYY-MM format
 * @returns Formatted string (e.g., "January 2024")
 */
export function formatPeriod(period: string): string {
  const { year, month } = parsePeriod(period)

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  return `${monthNames[month - 1]} ${year}`
}

/**
 * Format a fiscal year for display
 *
 * @param fiscalYear - Fiscal year in YYYY-YY format
 * @returns Formatted string (e.g., "FY 2024-25")
 */
export function formatFiscalYear(fiscalYear: string): string {
  return `FY ${fiscalYear}`
}
