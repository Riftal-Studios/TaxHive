/**
 * Compliance Health Calculation
 *
 * Calculates a compliance health score (0-100) based on:
 * - LUT status (valid/expiring/expired/missing)
 * - Pending filings count
 * - Overdue returns
 * - Unreconciled ITC count
 */

export type LUTStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'MISSING'

export type ComplianceStatus = 'excellent' | 'good' | 'warning' | 'critical'

export interface ComplianceHealthInput {
  lutStatus: LUTStatus
  lutDaysRemaining: number | null
  pendingFilingsCount: number
  overdueFilingsCount: number
  unreconciledITCCount: number
  unreconciledITCAmount: number
}

export interface ComplianceHealthResult {
  score: number
  status: ComplianceStatus
}

export type IssueSeverity = 'error' | 'warning' | 'info'
export type IssueType = 'lut' | 'filing' | 'itc'

export interface ComplianceIssue {
  type: IssueType
  severity: IssueSeverity
  message: string
}

// Point deductions
const DEDUCTIONS = {
  LUT_EXPIRED: 35,
  LUT_EXPIRING: 15,
  LUT_MISSING: 25,
  OVERDUE_FILING_EACH: 16, // Severe - 2 overdue should push to warning
  PENDING_FILING_EACH: 3,
  UNRECONCILED_ITC_BASE: 5,
  UNRECONCILED_ITC_PER_ITEM: 1,
  UNRECONCILED_ITC_HIGH_VALUE: 5, // Additional for > ₹50,000
}

// Status thresholds
const STATUS_THRESHOLDS = {
  excellent: 90,
  good: 70,
  warning: 50,
}

/**
 * Calculate compliance health score and status
 */
export function calculateComplianceHealth(
  input: ComplianceHealthInput
): ComplianceHealthResult {
  let score = 100

  // LUT deductions
  if (input.lutStatus === 'EXPIRED') {
    score -= DEDUCTIONS.LUT_EXPIRED
  } else if (input.lutStatus === 'EXPIRING') {
    score -= DEDUCTIONS.LUT_EXPIRING
  } else if (input.lutStatus === 'MISSING') {
    score -= DEDUCTIONS.LUT_MISSING
  }

  // Overdue filings deduction (more severe)
  score -= input.overdueFilingsCount * DEDUCTIONS.OVERDUE_FILING_EACH

  // Pending filings deduction (less severe)
  score -= input.pendingFilingsCount * DEDUCTIONS.PENDING_FILING_EACH

  // Unreconciled ITC deduction
  if (input.unreconciledITCCount > 0) {
    score -= DEDUCTIONS.UNRECONCILED_ITC_BASE
    score -= Math.min(input.unreconciledITCCount, 10) * DEDUCTIONS.UNRECONCILED_ITC_PER_ITEM

    // Additional deduction for high-value unreconciled ITC
    if (input.unreconciledITCAmount > 50000) {
      score -= DEDUCTIONS.UNRECONCILED_ITC_HIGH_VALUE
    }
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score))

  // Determine status based on score
  const status = getStatusFromScore(score)

  return { score, status }
}

/**
 * Get status label from score
 */
function getStatusFromScore(score: number): ComplianceStatus {
  if (score >= STATUS_THRESHOLDS.excellent) return 'excellent'
  if (score >= STATUS_THRESHOLDS.good) return 'good'
  if (score >= STATUS_THRESHOLDS.warning) return 'warning'
  return 'critical'
}

/**
 * Get list of compliance issues sorted by severity
 */
export function getComplianceIssues(input: ComplianceHealthInput): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []

  // LUT issues
  if (input.lutStatus === 'EXPIRED') {
    issues.push({
      type: 'lut',
      severity: 'error',
      message: 'LUT has expired. Renew immediately to continue zero-rated exports.',
    })
  } else if (input.lutStatus === 'EXPIRING') {
    const days = input.lutDaysRemaining ?? 0
    issues.push({
      type: 'lut',
      severity: 'warning',
      message: `LUT expiring in ${days} days. Plan renewal soon.`,
    })
  } else if (input.lutStatus === 'MISSING') {
    issues.push({
      type: 'lut',
      severity: 'warning',
      message: 'No active LUT found. Apply for LUT to make zero-rated exports.',
    })
  }

  // Filing issues
  if (input.overdueFilingsCount > 0) {
    issues.push({
      type: 'filing',
      severity: 'error',
      message: `${input.overdueFilingsCount} overdue filing(s) require immediate attention.`,
    })
  }

  if (input.pendingFilingsCount > 0) {
    issues.push({
      type: 'filing',
      severity: 'info',
      message: `${input.pendingFilingsCount} pending filing(s) due soon.`,
    })
  }

  // ITC issues
  if (input.unreconciledITCCount > 0) {
    issues.push({
      type: 'itc',
      severity: 'warning',
      message: `${input.unreconciledITCCount} unreconciled ITC entries (₹${input.unreconciledITCAmount.toLocaleString('en-IN')}).`,
    })
  }

  // Sort by severity (error > warning > info)
  const severityOrder: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 }
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return issues
}
