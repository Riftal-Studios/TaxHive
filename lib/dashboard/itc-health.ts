/**
 * ITC Health Calculation
 *
 * Calculates ITC reconciliation health status:
 * - Match rate (matched vs total)
 * - ITC at risk (mismatches + not in 2B)
 * - Follow-up needed (unreconciled entries)
 */

export type ITCHealthStatus = 'excellent' | 'good' | 'warning' | 'critical'

export interface ITCHealthInput {
  totalEntries: number
  matchedCount: number
  matchedAmount: number
  amountMismatchCount: number
  amountMismatchAmount: number
  notIn2BCount: number      // In your books but not in GSTR-2B
  notIn2BAmount: number
  in2BOnlyCount: number     // In GSTR-2B but not in your books
  in2BOnlyAmount: number
  pendingCount: number
  pendingAmount: number
}

export type ITCAction =
  | 'followUpVendors'
  | 'verifyInvoices'
  | 'reconcilePending'
  | 'reviewMismatches'

export interface ITCHealthResult {
  matchRate: number          // Percentage (0-100)
  status: ITCHealthStatus
  totalAmount: number
  matchedAmount: number
  itcAtRisk: number          // Amount that may not be claimable
  followUpNeeded: number     // Number of entries needing action
  followUpAmount: number
  summary: string
  actions: ITCAction[]
}

// Status thresholds
const THRESHOLDS = {
  excellent: 95,
  good: 80,
  warning: 60,
}

/**
 * Get health status from match rate
 */
export function getITCHealthStatus(matchRate: number): ITCHealthStatus {
  if (matchRate >= THRESHOLDS.excellent) return 'excellent'
  if (matchRate >= THRESHOLDS.good) return 'good'
  if (matchRate >= THRESHOLDS.warning) return 'warning'
  return 'critical'
}

/**
 * Calculate ITC health metrics
 */
export function calculateITCHealth(input: ITCHealthInput): ITCHealthResult {
  // Calculate match rate
  const matchRate = input.totalEntries > 0
    ? Math.round((input.matchedCount / input.totalEntries) * 100)
    : 100

  // Status based on match rate
  const status = getITCHealthStatus(matchRate)

  // ITC at risk = amount mismatches + not in 2B (may not be claimable)
  const itcAtRisk = input.amountMismatchAmount + input.notIn2BAmount

  // Follow-up needed = not in 2B + in 2B only (need vendor contact or verification)
  const followUpNeeded = input.notIn2BCount + input.in2BOnlyCount
  const followUpAmount = input.notIn2BAmount + input.in2BOnlyAmount

  // Total amount
  const totalAmount =
    input.matchedAmount +
    input.amountMismatchAmount +
    input.notIn2BAmount +
    input.in2BOnlyAmount +
    input.pendingAmount

  // Generate summary and actions
  const { summary, actions } = generateSummaryAndActions(input, matchRate)

  return {
    matchRate,
    status,
    totalAmount,
    matchedAmount: input.matchedAmount,
    itcAtRisk,
    followUpNeeded,
    followUpAmount,
    summary,
    actions,
  }
}

/**
 * Generate actionable summary and recommended actions
 */
function generateSummaryAndActions(
  input: ITCHealthInput,
  matchRate: number
): { summary: string; actions: ITCAction[] } {
  const actions: ITCAction[] = []
  const summaryParts: string[] = []

  if (matchRate === 100 && input.totalEntries > 0) {
    return {
      summary: 'All entries are matched. ITC reconciliation is complete.',
      actions: [],
    }
  }

  if (input.totalEntries === 0) {
    return {
      summary: 'No ITC entries to reconcile.',
      actions: [],
    }
  }

  // Amount mismatches
  if (input.amountMismatchCount > 0) {
    summaryParts.push(
      `${input.amountMismatchCount} entries have amount mismatches (₹${input.amountMismatchAmount.toLocaleString('en-IN')})`
    )
    actions.push('verifyInvoices')
    actions.push('reviewMismatches')
  }

  // Not in 2B (vendor hasn't filed)
  if (input.notIn2BCount > 0) {
    summaryParts.push(
      `${input.notIn2BCount} entries not found in GSTR-2B (₹${input.notIn2BAmount.toLocaleString('en-IN')} at risk)`
    )
    actions.push('followUpVendors')
  }

  // In 2B only (missing in your books)
  if (input.in2BOnlyCount > 0) {
    summaryParts.push(
      `${input.in2BOnlyCount} entries in GSTR-2B not in your records`
    )
    actions.push('verifyInvoices')
  }

  // Pending
  if (input.pendingCount > 0) {
    summaryParts.push(`${input.pendingCount} entries pending reconciliation`)
    actions.push('reconcilePending')
  }

  const summary = summaryParts.length > 0
    ? summaryParts.join('. ') + '.'
    : `${matchRate}% of entries matched.`

  return { summary, actions: [...new Set(actions)] }
}

/**
 * Get human-readable action description
 */
export function getActionDescription(action: ITCAction): string {
  switch (action) {
    case 'followUpVendors':
      return 'Follow up with vendors who haven\'t filed their returns'
    case 'verifyInvoices':
      return 'Verify invoice details against your purchase records'
    case 'reconcilePending':
      return 'Complete reconciliation for pending entries'
    case 'reviewMismatches':
      return 'Review and resolve amount mismatches'
    default:
      return 'Take action on ITC entries'
  }
}
