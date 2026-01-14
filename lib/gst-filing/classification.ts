/**
 * GSTR Classification Logic
 *
 * Classifies invoices into appropriate GSTR-1 tables and GSTR-3B sections
 * based on invoice type, RCM type, recipient details, and amounts.
 *
 * GSTR-1 Tables:
 * - 4A: B2B supplies to registered persons
 * - 5: B2C large (>₹2.5L inter-state supplies to unregistered)
 * - 6A: Exports with/without payment
 * - 7: B2C others (small B2C)
 * - 9B: Credit/Debit notes (not yet implemented)
 *
 * GSTR-3B Sections:
 * - 3.1(a): Outward taxable supplies + Import RCM
 * - 3.1(b): Zero-rated supplies (exports with LUT)
 * - 3.1(d): Inward supplies under RCM (Indian unregistered)
 * - 4A(3): ITC from RCM
 * - 4A(5): ITC from registered purchases (from GSTR-2B)
 */

import type { InvoiceType, RcmType } from '@prisma/client'

// GSTR-1 Table Types
export enum GSTR1Table {
  B2B = 'B2B', // Table 4A - B2B supplies
  B2C_LARGE = 'B2C_LARGE', // Table 5 - B2C Large (>₹2.5L)
  B2C_SMALL = 'B2C_SMALL', // Table 7 - B2C Others
  EXPORTS_WITH_LUT = 'EXPORTS_WITH_LUT', // Table 6A - Export with LUT
  EXPORTS_WITH_PAYMENT = 'EXPORTS_WITH_PAYMENT', // Table 6A - Export with payment
  CREDIT_DEBIT_NOTES = 'CREDIT_DEBIT_NOTES', // Table 9B
  NOT_APPLICABLE = 'NOT_APPLICABLE', // Not reported in GSTR-1 (e.g., RCM self-invoices)
}

// GSTR-3B Section Types
export enum GSTR3BSection {
  OUTWARD_TAXABLE = 'OUTWARD_TAXABLE', // 3.1(a)
  ZERO_RATED = 'ZERO_RATED', // 3.1(b)
  INWARD_RCM = 'INWARD_RCM', // 3.1(d)
}

// B2C Large threshold in INR
const B2C_LARGE_THRESHOLD = 250000 // ₹2.5 Lakhs

// Input type for classification
export interface InvoiceForClassification {
  invoiceType: InvoiceType
  isRCM: boolean
  rcmType: RcmType | null
  lutId: string | null
  clientGstin: string | null
  clientCountry: string | null
  totalInINR: number
  igstAmount: number
  cgstAmount: number
  sgstAmount: number
}

// GSTR-1 Classification Result
export interface GSTR1Classification {
  table: GSTR1Table
  tableCode: string | null // "4A", "5", "6A", "7", "9B"
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
}

// GSTR-3B Classification Result
export interface GSTR3BClassification {
  section: GSTR3BSection
  sectionCode: string // "3.1(a)", "3.1(b)", "3.1(d)"
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  // ITC entitlement for RCM
  itcSection: string | null // "4A(3)" for RCM
  itcIgst: number
  itcCgst: number
  itcSgst: number
}

/**
 * Check if a country is India
 */
function isIndianCountry(country: string | null): boolean {
  if (!country) return false
  const normalized = country.toUpperCase().trim()
  return normalized === 'IN' || normalized === 'IND' || normalized === 'INDIA'
}

/**
 * Check if invoice is an export (foreign recipient)
 */
function isExport(invoice: InvoiceForClassification): boolean {
  // RCM self-invoices are not exports even if supplier is foreign
  if (invoice.invoiceType === 'SELF_INVOICE') return false

  // If there's a client GSTIN, it's domestic
  if (invoice.clientGstin) return false

  // If country is India, it's domestic
  if (isIndianCountry(invoice.clientCountry)) return false

  // Foreign country without GSTIN = export
  return true
}

/**
 * Classify invoice for GSTR-1 filing
 */
export function classifyForGSTR1(invoice: InvoiceForClassification): GSTR1Classification {
  const baseTaxes = {
    taxableValue: invoice.totalInINR,
    igst: invoice.igstAmount,
    cgst: invoice.cgstAmount,
    sgst: invoice.sgstAmount,
  }

  // RCM Self-invoices are not reported in GSTR-1
  // They are inward supplies, not outward
  if (invoice.invoiceType === 'SELF_INVOICE' || invoice.isRCM) {
    return {
      table: GSTR1Table.NOT_APPLICABLE,
      tableCode: null,
      ...baseTaxes,
    }
  }

  // Export invoices
  if (isExport(invoice)) {
    // Exports with LUT (zero-rated)
    if (invoice.lutId) {
      return {
        table: GSTR1Table.EXPORTS_WITH_LUT,
        tableCode: '6A',
        ...baseTaxes,
      }
    }
    // Exports with IGST payment (refundable)
    return {
      table: GSTR1Table.EXPORTS_WITH_PAYMENT,
      tableCode: '6A',
      ...baseTaxes,
    }
  }

  // Domestic supplies

  // B2B - Has GSTIN
  if (invoice.clientGstin) {
    return {
      table: GSTR1Table.B2B,
      tableCode: '4A',
      ...baseTaxes,
    }
  }

  // B2C - No GSTIN, Indian recipient
  // B2C Large: > ₹2.5L and inter-state (IGST)
  if (invoice.totalInINR > B2C_LARGE_THRESHOLD && invoice.igstAmount > 0) {
    return {
      table: GSTR1Table.B2C_LARGE,
      tableCode: '5',
      ...baseTaxes,
    }
  }

  // B2C Small/Others
  return {
    table: GSTR1Table.B2C_SMALL,
    tableCode: '7',
    ...baseTaxes,
  }
}

/**
 * Classify invoice for GSTR-3B filing
 */
export function classifyForGSTR3B(invoice: InvoiceForClassification): GSTR3BClassification {
  const baseTaxes = {
    taxableValue: invoice.totalInINR,
    igst: invoice.igstAmount,
    cgst: invoice.cgstAmount,
    sgst: invoice.sgstAmount,
  }

  const noItc = {
    itcSection: null,
    itcIgst: 0,
    itcCgst: 0,
    itcSgst: 0,
  }

  // RCM Self-invoices
  if (invoice.isRCM && invoice.invoiceType === 'SELF_INVOICE') {
    // Import of Services RCM - goes to 3.1(a) as outward taxable
    // This is because import RCM liability is reported in 3.1(a)
    if (invoice.rcmType === 'IMPORT_OF_SERVICES') {
      return {
        section: GSTR3BSection.OUTWARD_TAXABLE,
        sectionCode: '3.1(a)',
        ...baseTaxes,
        // ITC available for RCM
        itcSection: '4A(3)',
        itcIgst: invoice.igstAmount,
        itcCgst: invoice.cgstAmount,
        itcSgst: invoice.sgstAmount,
      }
    }

    // Indian Unregistered Supplier RCM - goes to 3.1(d)
    if (invoice.rcmType === 'INDIAN_UNREGISTERED') {
      return {
        section: GSTR3BSection.INWARD_RCM,
        sectionCode: '3.1(d)',
        ...baseTaxes,
        // ITC available for RCM
        itcSection: '4A(3)',
        itcIgst: invoice.igstAmount,
        itcCgst: invoice.cgstAmount,
        itcSgst: invoice.sgstAmount,
      }
    }
  }

  // Export invoices - Zero-rated supplies 3.1(b)
  if (isExport(invoice)) {
    return {
      section: GSTR3BSection.ZERO_RATED,
      sectionCode: '3.1(b)',
      ...baseTaxes,
      ...noItc,
    }
  }

  // All other outward supplies - 3.1(a)
  // This includes domestic B2B, B2C, etc.
  return {
    section: GSTR3BSection.OUTWARD_TAXABLE,
    sectionCode: '3.1(a)',
    ...baseTaxes,
    ...noItc,
  }
}

/**
 * Get the GSTR-1 table description
 */
export function getGSTR1TableDescription(table: GSTR1Table): string {
  const descriptions: Record<GSTR1Table, string> = {
    [GSTR1Table.B2B]: 'B2B Supplies - Invoices to registered persons',
    [GSTR1Table.B2C_LARGE]: 'B2C Large - Inter-state supplies > ₹2.5L to unregistered',
    [GSTR1Table.B2C_SMALL]: 'B2C Others - Supplies to unregistered persons',
    [GSTR1Table.EXPORTS_WITH_LUT]: 'Exports with LUT - Zero-rated exports under bond',
    [GSTR1Table.EXPORTS_WITH_PAYMENT]: 'Exports with Payment - Exports with IGST payment',
    [GSTR1Table.CREDIT_DEBIT_NOTES]: 'Credit/Debit Notes',
    [GSTR1Table.NOT_APPLICABLE]: 'Not applicable for GSTR-1',
  }
  return descriptions[table]
}

/**
 * Get the GSTR-3B section description
 */
export function getGSTR3BSectionDescription(section: GSTR3BSection): string {
  const descriptions: Record<GSTR3BSection, string> = {
    [GSTR3BSection.OUTWARD_TAXABLE]:
      'Outward taxable supplies (including import of services)',
    [GSTR3BSection.ZERO_RATED]: 'Zero-rated supplies (exports with LUT)',
    [GSTR3BSection.INWARD_RCM]: 'Inward supplies under reverse charge',
  }
  return descriptions[section]
}
