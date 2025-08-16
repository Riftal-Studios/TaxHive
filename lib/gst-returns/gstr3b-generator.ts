/**
 * GSTR-3B Generation Logic
 * Generates GSTR-3B return data from invoices and purchase invoices
 */

import { Invoice, PurchaseInvoice } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

// Types for GSTR-3B JSON structure as per GST Portal
export interface GSTR3BJson {
  gstin: string
  ret_period: string // Format: MMYYYY
  sup_details: SupplyDetails
  inter_sup: InterStateSupplies
  itc_elg: ITCEligible
  inward_sup: InwardSupplies
  intr_ltfee: InterestLateFee
}

// 3.1 Details of Outward Supplies and inward supplies liable to reverse charge
export interface SupplyDetails {
  osup_det: OutwardSupplies
  osup_zero: ZeroRatedSupplies
  osup_nil_exmp: NilExemptSupplies
  isup_rev: InwardReverseCharge
  osup_nongst: NonGSTSupplies
}

export interface OutwardSupplies {
  txval: number // Taxable value
  iamt: number // IGST amount
  camt: number // CGST amount
  samt: number // SGST amount
  csamt: number // Cess amount
}

export interface ZeroRatedSupplies {
  txval: number
  iamt: number
  csamt: number
}

export interface NilExemptSupplies {
  txval: number
}

export interface InwardReverseCharge {
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

export interface NonGSTSupplies {
  txval: number
}

// 3.2 Inter-State supplies to unregistered persons
export interface InterStateSupplies {
  unreg_details?: Array<{
    pos: string // Place of supply (state code)
    txval: number
    iamt: number
  }>
  comp_details?: Array<{
    pos: string
    txval: number
    iamt: number
  }>
  uin_details?: Array<{
    pos: string
    txval: number
    iamt: number
  }>
}

// 4. Eligible ITC
export interface ITCEligible {
  itc_avl: Array<{
    ty: string // Type of ITC
    iamt: number
    camt: number
    samt: number
    csamt: number
  }>
  itc_rev: Array<{
    ty: string
    iamt: number
    camt: number
    samt: number
    csamt: number
  }>
  itc_net: {
    iamt: number
    camt: number
    samt: number
    csamt: number
  }
  itc_inelg: Array<{
    ty: string
    iamt: number
    camt: number
    samt: number
    csamt: number
  }>
}

// 5. Values of exempt, nil rated and non-GST inward supplies
export interface InwardSupplies {
  isup_details: Array<{
    ty: string
    inter: number // Inter-state
    intra: number // Intra-state
  }>
}

// 6.1 Interest and late fee
export interface InterestLateFee {
  intr: {
    iamt: number
    camt: number
    samt: number
    csamt: number
  }
  ltfee: {
    central: number
    state: number
  }
}

// Helper to convert Decimal to number
function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  return Number(value.toString())
}

// Helper function to format return period
function formatReturnPeriod(month: number, year: number): string {
  return `${month.toString().padStart(2, '0')}${year}`
}

/**
 * Calculate outward supplies (sales) for GSTR-3B
 */
export function calculateOutwardSupplies(invoices: Invoice[]): OutwardSupplies {
  let txval = 0
  let iamt = 0
  let camt = 0
  let samt = 0

  const domesticInvoices = invoices.filter(inv => 
    inv.invoiceType === 'DOMESTIC_B2B' || inv.invoiceType === 'DOMESTIC_B2C'
  )

  for (const invoice of domesticInvoices) {
    txval += toNumber(invoice.taxableAmount || invoice.subtotal)
    iamt += toNumber(invoice.igstAmount)
    camt += toNumber(invoice.cgstAmount)
    samt += toNumber(invoice.sgstAmount)
  }

  return {
    txval,
    iamt,
    camt,
    samt,
    csamt: 0 // Cess not implemented yet
  }
}

/**
 * Calculate zero-rated supplies (exports) for GSTR-3B
 */
export function calculateZeroRatedSupplies(invoices: Invoice[]): ZeroRatedSupplies {
  let txval = 0

  const exportInvoices = invoices.filter(inv => inv.invoiceType === 'EXPORT')

  for (const invoice of exportInvoices) {
    txval += toNumber(invoice.subtotal)
  }

  return {
    txval,
    iamt: 0, // Zero-rated
    csamt: 0
  }
}

/**
 * Calculate eligible ITC from purchase invoices
 */
export function calculateEligibleITC(purchaseInvoices: PurchaseInvoice[]): ITCEligible {
  // Calculate available ITC
  let availableIGST = 0
  let availableCGST = 0
  let availableSGST = 0

  const eligiblePurchases = purchaseInvoices.filter(p => p.itcEligible)

  for (const purchase of eligiblePurchases) {
    availableIGST += toNumber(purchase.igstAmount)
    availableCGST += toNumber(purchase.cgstAmount)
    availableSGST += toNumber(purchase.sgstAmount)
  }

  // Calculate reversed ITC
  let reversedIGST = 0
  let reversedCGST = 0
  let reversedSGST = 0

  for (const purchase of purchaseInvoices) {
    if (toNumber(purchase.itcReversed) > 0) {
      // Proportionally allocate reversed amount
      const totalTax = toNumber(purchase.igstAmount) + toNumber(purchase.cgstAmount) + toNumber(purchase.sgstAmount)
      if (totalTax > 0) {
        const reversalRatio = toNumber(purchase.itcReversed) / totalTax
        reversedIGST += toNumber(purchase.igstAmount) * reversalRatio
        reversedCGST += toNumber(purchase.cgstAmount) * reversalRatio
        reversedSGST += toNumber(purchase.sgstAmount) * reversalRatio
      }
    }
  }

  return {
    itc_avl: [
      {
        ty: 'IMPG', // Import of goods
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0
      },
      {
        ty: 'IMPS', // Import of services
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0
      },
      {
        ty: 'ISRC', // ISD
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0
      },
      {
        ty: 'ISD', // Inward supplies from ISD
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0
      },
      {
        ty: 'OTH', // All other ITC
        iamt: availableIGST,
        camt: availableCGST,
        samt: availableSGST,
        csamt: 0
      }
    ],
    itc_rev: [
      {
        ty: 'RUL', // As per rules
        iamt: reversedIGST,
        camt: reversedCGST,
        samt: reversedSGST,
        csamt: 0
      },
      {
        ty: 'OTH', // Others
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0
      }
    ],
    itc_net: {
      iamt: availableIGST - reversedIGST,
      camt: availableCGST - reversedCGST,
      samt: availableSGST - reversedSGST,
      csamt: 0
    },
    itc_inelg: [
      {
        ty: 'RUL', // As per rules
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0
      },
      {
        ty: 'OTH', // Others
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0
      }
    ]
  }
}

/**
 * Calculate net tax payable
 */
export function calculateNetTaxPayable(
  outputTax: OutwardSupplies,
  eligibleITC: ITCEligible
): {
  igst: number
  cgst: number
  sgst: number
  cess: number
  total: number
} {
  const igstPayable = Math.max(0, outputTax.iamt - eligibleITC.itc_net.iamt)
  const cgstPayable = Math.max(0, outputTax.camt - eligibleITC.itc_net.camt)
  const sgstPayable = Math.max(0, outputTax.samt - eligibleITC.itc_net.samt)
  const cessPayable = Math.max(0, outputTax.csamt - eligibleITC.itc_net.csamt)

  return {
    igst: igstPayable,
    cgst: cgstPayable,
    sgst: sgstPayable,
    cess: cessPayable,
    total: igstPayable + cgstPayable + sgstPayable + cessPayable
  }
}

/**
 * Calculate late fee based on due date
 */
export function calculateLateFee(
  filingDate: Date,
  dueDate: Date,
  isNilReturn: boolean = false
): { central: number; state: number; total: number } {
  if (filingDate <= dueDate) {
    return { central: 0, state: 0, total: 0 }
  }

  const daysLate = Math.floor((filingDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
  
  // Late fee rates (as per GST rules)
  // Normal return: Rs 50 per day (Rs 25 CGST + Rs 25 SGST) max Rs 5000 each
  // Nil return: Rs 20 per day (Rs 10 CGST + Rs 10 SGST) max Rs 5000 each
  const dailyRateCentral = isNilReturn ? 10 : 25
  const dailyRateState = isNilReturn ? 10 : 25
  const maxFee = 5000

  const centralFee = Math.min(daysLate * dailyRateCentral, maxFee)
  const stateFee = Math.min(daysLate * dailyRateState, maxFee)

  return {
    central: centralFee,
    state: stateFee,
    total: centralFee + stateFee
  }
}

/**
 * Main function to generate complete GSTR-3B JSON
 */
export function generateGSTR3B(
  invoices: Invoice[],
  purchaseInvoices: PurchaseInvoice[],
  gstin: string,
  month: number,
  year: number,
  filingDate?: Date
): GSTR3BJson {
  // Calculate outward supplies
  const outwardSupplies = calculateOutwardSupplies(invoices)
  const zeroRatedSupplies = calculateZeroRatedSupplies(invoices)
  
  // Calculate ITC
  const eligibleITC = calculateEligibleITC(purchaseInvoices)
  
  // Calculate net tax payable
  const netTax = calculateNetTaxPayable(outwardSupplies, eligibleITC)
  
  // Calculate late fee if filing date provided
  let lateFee = { central: 0, state: 0 }
  if (filingDate) {
    // Due date is 20th of next month
    const dueDate = new Date(year, month, 20) // Note: month is 0-indexed in JS
    const isNilReturn = netTax.total === 0
    const lateFeeCalc = calculateLateFee(filingDate, dueDate, isNilReturn)
    lateFee = { central: lateFeeCalc.central, state: lateFeeCalc.state }
  }

  return {
    gstin,
    ret_period: formatReturnPeriod(month, year),
    sup_details: {
      osup_det: outwardSupplies,
      osup_zero: zeroRatedSupplies,
      osup_nil_exmp: {
        txval: 0 // Nil/Exempt supplies not implemented
      },
      isup_rev: {
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0
      },
      osup_nongst: {
        txval: 0
      }
    },
    inter_sup: {
      unreg_details: [], // To be implemented based on B2C inter-state
      comp_details: [],
      uin_details: []
    },
    itc_elg: eligibleITC,
    inward_sup: {
      isup_details: [
        {
          ty: 'GST',
          inter: 0,
          intra: 0
        },
        {
          ty: 'NONGST',
          inter: 0,
          intra: 0
        }
      ]
    },
    intr_ltfee: {
      intr: {
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0
      },
      ltfee: lateFee
    }
  }
}