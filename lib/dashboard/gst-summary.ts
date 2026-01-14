/**
 * GST Summary Calculation
 *
 * Calculates GST summary including:
 * - Output GST liability (from sales/services)
 * - ITC available (from B2B purchases + RCM)
 * - RCM liability (paid under reverse charge)
 * - Net payable/refundable
 */

export interface GSTSummaryInput {
  // Output tax from sales
  outputIGST: number
  outputCGST: number
  outputSGST: number
  // ITC from B2B purchases
  itcIGST: number
  itcCGST: number
  itcSGST: number
  // RCM paid (liability but also ITC)
  rcmIGST: number
  rcmCGST: number
  rcmSGST: number
}

export interface GSTComponent {
  igst: number
  cgst: number
  sgst: number
  total: number
}

export interface GSTSummaryResult {
  outputLiability: GSTComponent
  itcAvailable: GSTComponent
  rcmLiability: GSTComponent
  netPayable: GSTComponent
  accumulatedITC: number // Positive when ITC exceeds output
}

export interface NetPayableInput {
  outputIGST: number
  outputCGST: number
  outputSGST: number
  itcIGST: number
  itcCGST: number
  itcSGST: number
}

/**
 * Calculate GST summary from input data
 */
export function calculateGSTSummary(input: GSTSummaryInput): GSTSummaryResult {
  // Output liability (from sales)
  const outputLiability: GSTComponent = {
    igst: input.outputIGST,
    cgst: input.outputCGST,
    sgst: input.outputSGST,
    total: input.outputIGST + input.outputCGST + input.outputSGST,
  }

  // ITC = B2B ITC + RCM (RCM paid becomes ITC)
  const itcAvailable: GSTComponent = {
    igst: input.itcIGST + input.rcmIGST,
    cgst: input.itcCGST + input.rcmCGST,
    sgst: input.itcSGST + input.rcmSGST,
    total:
      input.itcIGST +
      input.itcCGST +
      input.itcSGST +
      input.rcmIGST +
      input.rcmCGST +
      input.rcmSGST,
  }

  // RCM liability (separate tracking for GSTR-3B)
  const rcmLiability: GSTComponent = {
    igst: input.rcmIGST,
    cgst: input.rcmCGST,
    sgst: input.rcmSGST,
    total: input.rcmIGST + input.rcmCGST + input.rcmSGST,
  }

  // Net payable
  const netPayable = calculateNetPayable({
    outputIGST: input.outputIGST,
    outputCGST: input.outputCGST,
    outputSGST: input.outputSGST,
    itcIGST: itcAvailable.igst,
    itcCGST: itcAvailable.cgst,
    itcSGST: itcAvailable.sgst,
  })

  // Accumulated ITC (when ITC exceeds output)
  const accumulatedITC = netPayable.total < 0 ? Math.abs(netPayable.total) : 0

  return {
    outputLiability,
    itcAvailable,
    rcmLiability,
    netPayable,
    accumulatedITC,
  }
}

/**
 * Calculate net payable with ITC utilization rules
 *
 * GST ITC Cross-Utilization Rules:
 * - IGST ITC can pay: IGST → CGST → SGST
 * - CGST ITC can pay: CGST → IGST (NOT SGST)
 * - SGST ITC can pay: SGST → IGST (NOT CGST)
 */
export function calculateNetPayable(input: NetPayableInput): GSTComponent {
  // Simple calculation: output - ITC for each head
  // Note: In actual GSTR-3B, cross-utilization is more complex
  // This simplified version shows net position per head

  const igst = input.outputIGST - input.itcIGST
  const cgst = input.outputCGST - input.itcCGST
  const sgst = input.outputSGST - input.itcSGST

  // Total is always simple sum of net positions
  const total = igst + cgst + sgst

  return {
    igst,
    cgst,
    sgst,
    total,
  }
}

/**
 * Round to nearest rupee (for display purposes)
 */
export function roundToRupee(amount: number): number {
  return Math.round(amount)
}
