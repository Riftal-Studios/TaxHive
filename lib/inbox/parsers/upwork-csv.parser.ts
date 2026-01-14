/**
 * Upwork CSV Parser
 *
 * Parses Upwork earnings CSV exports and aggregates transactions
 * for invoice generation.
 */

/**
 * Upwork transaction record
 */
export interface UpworkTransaction {
  date: Date
  type: string
  description: string
  amount: number
  clientName?: string
  isEarning: boolean
}

/**
 * Parse result
 */
export interface UpworkParseResult {
  success: boolean
  transactions?: UpworkTransaction[]
  error?: string
  warnings?: string[]
}

/**
 * Aggregated earnings summary
 */
export interface UpworkEarningsSummary {
  totalEarnings: number
  totalFees: number
  netAmount: number
  byClient: Record<string, number>
  byType: Record<string, number>
  startDate?: Date
  endDate?: Date
  transactionCount: number
}

// Transaction types that count as earnings
const EARNING_TYPES = [
  'hourly',
  'fixed price',
  'bonus',
  'milestone',
  'refund', // Refunds can be positive (client refund) or negative
]

// Transaction types that are fees
const FEE_TYPES = [
  'service fee',
  'withdrawal fee',
  'payment method fee',
  'processing fee',
  'membership fee',
]

/**
 * Parse Upwork CSV content
 */
export function parseUpworkCSV(csvContent: string): UpworkParseResult {
  if (!csvContent || csvContent.trim().length === 0) {
    return {
      success: false,
      error: 'Empty CSV content',
    }
  }

  const lines = csvContent.trim().split('\n')
  if (lines.length === 0) {
    return {
      success: false,
      error: 'No data in CSV',
    }
  }

  // Parse header
  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine)

  if (!hasRequiredHeaders(headers)) {
    return {
      success: false,
      error: 'Required columns (Date, Amount) not found in CSV',
    }
  }

  // Parse data rows
  const transactions: UpworkTransaction[] = []
  const warnings: string[] = []
  let skippedRows = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const rowData = mapRowToObject(values, headers)
    const transaction = parseUpworkRow(rowData)

    if (transaction) {
      transactions.push(transaction)
    } else {
      skippedRows++
    }
  }

  if (skippedRows > 0) {
    warnings.push(`Skipped ${skippedRows} invalid row(s)`)
  }

  return {
    success: true,
    transactions,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

/**
 * Check if required headers are present
 */
function hasRequiredHeaders(headers: string[]): boolean {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim())
  const hasDate = lowerHeaders.some(h => h.includes('date'))
  const hasAmount = lowerHeaders.some(h => h.includes('amount'))
  return hasDate && hasAmount
}

/**
 * Map row values to object using headers
 */
function mapRowToObject(values: string[], headers: string[]): Record<string, string> {
  const obj: Record<string, string> = {}

  headers.forEach((header, index) => {
    if (index < values.length) {
      obj[header] = values[index]
    }
  })

  return obj
}

/**
 * Parse a single Upwork row into a transaction
 */
export function parseUpworkRow(row: Record<string, string>): UpworkTransaction | null {
  // Find column values (case-insensitive)
  const dateStr = findValue(row, ['Date', 'date'])
  const typeStr = findValue(row, ['Type', 'type'])
  const descStr = findValue(row, ['Description', 'description'])
  const amountStr = findValue(row, ['Amount', 'amount'])

  if (!dateStr || !amountStr) {
    return null
  }

  // Parse date
  const date = parseDate(dateStr)
  if (!date) {
    return null
  }

  // Parse amount
  const amount = parseAmount(amountStr)
  if (isNaN(amount)) {
    return null
  }

  // Determine if this is an earning
  const type = typeStr || 'Unknown'
  const isEarning = isEarningType(type)

  // Extract client name from description
  const clientName = extractClientName(descStr || '')

  return {
    date,
    type,
    description: descStr || '',
    amount,
    clientName,
    isEarning,
  }
}

/**
 * Find value in object with multiple possible keys
 */
function findValue(obj: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (obj[key] !== undefined) {
      return obj[key]
    }
  }
  return undefined
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): Date | null {
  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10) - 1
    const day = parseInt(isoMatch[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  // Try slash-separated formats (MM/DD/YYYY or DD/MM/YYYY)
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const first = parseInt(slashMatch[1], 10)
    const second = parseInt(slashMatch[2], 10)
    const year = parseInt(slashMatch[3], 10)

    // If first number > 12, it must be DD/MM/YYYY format
    if (first > 12) {
      const date = new Date(year, second - 1, first)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
    // If second number > 12, it must be MM/DD/YYYY format
    else if (second > 12) {
      const date = new Date(year, first - 1, second)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
    // Ambiguous case (both <= 12): default to MM/DD/YYYY (US format, common in Upwork)
    else {
      const date = new Date(year, first - 1, second)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }

  // Try Month DD, YYYY format
  const monthNames: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  }

  const longFormat = dateStr.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (longFormat) {
    const monthName = longFormat[1].toLowerCase()
    const month = monthNames[monthName]
    if (month !== undefined) {
      const day = parseInt(longFormat[2], 10)
      const year = parseInt(longFormat[3], 10)
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }

  // Fallback to native Date parsing
  const nativeDate = new Date(dateStr)
  if (!isNaN(nativeDate.getTime())) {
    return nativeDate
  }

  return null
}

/**
 * Parse amount from string (handles currency symbols and commas)
 */
function parseAmount(amountStr: string): number {
  // Remove currency symbols, commas, and whitespace
  const cleaned = amountStr
    .replace(/[$€£¥₹]/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim()

  return parseFloat(cleaned)
}

/**
 * Check if transaction type is an earning
 */
function isEarningType(type: string): boolean {
  const lowerType = type.toLowerCase()

  // Check if it's a fee type (not earning)
  for (const feeType of FEE_TYPES) {
    if (lowerType.includes(feeType)) {
      return false
    }
  }

  // Check if it's an earning type
  for (const earningType of EARNING_TYPES) {
    if (lowerType.includes(earningType)) {
      return true
    }
  }

  // Default: consider positive amounts as earnings
  return true
}

/**
 * Extract client name from description
 */
function extractClientName(description: string): string | undefined {
  // Common patterns:
  // "Payment from ClientName - Fixed Price"
  // "Payment from ClientName - Hourly"
  // "ClientName - Project Name"

  const patterns = [
    /Payment from (.+?) - /i,
    /from (.+?) - /i,
    /^(.+?) - /,
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return undefined
}

/**
 * Aggregate Upwork earnings from transactions
 */
export function aggregateUpworkEarnings(transactions: UpworkTransaction[]): UpworkEarningsSummary {
  const byClient: Record<string, number> = {}
  const byType: Record<string, number> = {}

  let totalEarnings = 0
  let totalFees = 0
  let minDate: Date | undefined
  let maxDate: Date | undefined

  for (const tx of transactions) {
    // Update date range
    if (!minDate || tx.date < minDate) minDate = tx.date
    if (!maxDate || tx.date > maxDate) maxDate = tx.date

    if (tx.isEarning && tx.amount > 0) {
      // Earnings
      totalEarnings += tx.amount

      // By client
      if (tx.clientName) {
        byClient[tx.clientName] = (byClient[tx.clientName] || 0) + tx.amount
      }

      // By type
      byType[tx.type] = (byType[tx.type] || 0) + tx.amount
    } else if (tx.amount < 0) {
      // Fees (negative amounts)
      totalFees += Math.abs(tx.amount)
    }
  }

  return {
    totalEarnings,
    totalFees,
    netAmount: totalEarnings - totalFees,
    byClient,
    byType,
    startDate: minDate,
    endDate: maxDate,
    transactionCount: transactions.length,
  }
}
