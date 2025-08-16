/**
 * GSTR-1 Generation Logic
 * Generates GSTR-1 return data from invoices
 */

import { Invoice, InvoiceItem, Client } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

// Types for GSTR-1 JSON structure as per GST Portal
export interface GSTR1Json {
  gstin: string
  ret_period: string // Format: MMYYYY
  b2b?: B2BEntry[]
  b2cl?: B2CLEntry[]
  b2cs?: B2CSEntry[]
  exp?: ExportEntry[]
  hsn?: HSNData
}

// B2B Invoice Entry (Table 4A)
export interface B2BEntry {
  ctin: string // Customer GSTIN
  inv: Array<{
    inum: string // Invoice number
    idt: string // Invoice date (DD-MM-YYYY)
    val: number // Invoice value
    pos: string // Place of supply (state code)
    rchrg: 'N' | 'Y' // Reverse charge
    inv_typ: 'R' | 'DE' | 'SEWP' | 'SEWOP' | 'EXPWP' | 'EXPWOP' // Invoice type
    itms: Array<{
      num: number // Item serial number
      itm_det: {
        rt: number // Tax rate
        txval: number // Taxable value
        iamt: number // IGST amount
        camt: number // CGST amount
        samt: number // SGST amount
        csamt: number // Cess amount
      }
    }>
  }>
}

// B2C Large Invoice Entry (Table 5)
export interface B2CLEntry {
  pos: string // Place of supply (state code)
  inv: Array<{
    inum: string
    idt: string
    val: number
    itms: Array<{
      num: number
      itm_det: {
        rt: number
        txval: number
        iamt: number
        csamt: number
      }
    }>
  }>
}

// B2C Small Invoice Entry (Table 7)
export interface B2CSEntry {
  sply_ty: 'INTRA' | 'INTER' // Supply type
  pos: string // Place of supply
  typ: 'OE' | 'E' // Type
  txval: number // Taxable value
  rt: number // Tax rate
  iamt: number // IGST amount
  camt: number // CGST amount
  samt: number // SGST amount
  csamt: number // Cess amount
}

// Export Invoice Entry (Table 6)
export interface ExportEntry {
  exp_typ: 'WPAY' | 'WOPAY' // Export type
  inv: Array<{
    inum: string
    idt: string
    val: number
    sbpcode?: string // Port code
    sbnum?: string // Shipping bill number
    sbdt?: string // Shipping bill date
    itms: Array<{
      txval: number
      rt: number // 0 for exports
      iamt: number // 0 for exports
    }>
  }>
}

// HSN Summary (Table 12)
export interface HSNData {
  data: Array<{
    num: number // Serial number
    hsn_sc: string // HSN/SAC code
    desc?: string // Description
    uqc: string // Unit of quantity code
    qty: number // Quantity
    val: number // Value
    txval: number // Taxable value
    iamt: number // IGST amount
    camt: number // CGST amount
    samt: number // SGST amount
    csamt: number // Cess amount
  }>
}

type InvoiceWithRelations = Invoice & {
  client: Client
  lineItems: InvoiceItem[]
}

// Helper function to format date for GSTR-1
function formatDateForGSTR1(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

// Helper function to format return period
function formatReturnPeriod(month: number, year: number): string {
  return `${month.toString().padStart(2, '0')}${year}`
}

// Helper to convert Decimal to number
function toNumber(value: Decimal | number): number {
  if (typeof value === 'number') return value
  return Number(value.toString())
}

/**
 * Generate B2B section of GSTR-1
 */
export function generateB2BSection(invoices: InvoiceWithRelations[]): B2BEntry[] {
  const b2bMap = new Map<string, B2BEntry>()

  const b2bInvoices = invoices.filter(
    inv => inv.invoiceType === 'DOMESTIC_B2B' && inv.buyerGSTIN
  )

  for (const invoice of b2bInvoices) {
    const gstin = invoice.buyerGSTIN!
    
    if (!b2bMap.has(gstin)) {
      b2bMap.set(gstin, {
        ctin: gstin,
        inv: []
      })
    }

    const entry = b2bMap.get(gstin)!
    
    // Group line items by GST rate
    const itemsByRate = new Map<number, { txval: number; iamt: number; camt: number; samt: number }>()
    
    for (const item of invoice.lineItems) {
      const rate = toNumber(item.gstRate)
      if (!itemsByRate.has(rate)) {
        itemsByRate.set(rate, { txval: 0, iamt: 0, camt: 0, samt: 0 })
      }
      
      const rateGroup = itemsByRate.get(rate)!
      rateGroup.txval += toNumber(item.amount)
      rateGroup.iamt += toNumber(item.igstAmount)
      rateGroup.camt += toNumber(item.cgstAmount)
      rateGroup.samt += toNumber(item.sgstAmount)
    }

    entry.inv.push({
      inum: invoice.invoiceNumber,
      idt: formatDateForGSTR1(invoice.invoiceDate),
      val: toNumber(invoice.totalAmount),
      pos: invoice.placeOfSupply.substring(0, 2), // Extract state code
      rchrg: 'N',
      inv_typ: 'R', // Regular invoice
      itms: Array.from(itemsByRate.entries()).map(([rate, amounts], index) => ({
        num: index + 1,
        itm_det: {
          rt: rate,
          txval: amounts.txval,
          iamt: amounts.iamt,
          camt: amounts.camt,
          samt: amounts.samt,
          csamt: 0
        }
      }))
    })
  }

  return Array.from(b2bMap.values())
}

/**
 * Generate B2C Large section of GSTR-1
 */
export function generateB2CLSection(invoices: InvoiceWithRelations[]): B2CLEntry[] {
  const b2clMap = new Map<string, B2CLEntry>()

  const b2clInvoices = invoices.filter(
    inv => inv.invoiceType === 'DOMESTIC_B2C' && 
           toNumber(inv.totalAmount) > 250000 &&
           inv.client.stateCode // Must have state code for B2C
  )

  for (const invoice of b2clInvoices) {
    const stateCode = invoice.client.stateCode!
    
    if (!b2clMap.has(stateCode)) {
      b2clMap.set(stateCode, {
        pos: stateCode,
        inv: []
      })
    }

    const entry = b2clMap.get(stateCode)!
    
    // Group line items by GST rate
    const itemsByRate = new Map<number, { txval: number; iamt: number }>()
    
    for (const item of invoice.lineItems) {
      const rate = toNumber(item.gstRate)
      if (!itemsByRate.has(rate)) {
        itemsByRate.set(rate, { txval: 0, iamt: 0 })
      }
      
      const rateGroup = itemsByRate.get(rate)!
      rateGroup.txval += toNumber(item.amount)
      rateGroup.iamt += toNumber(item.igstAmount)
    }

    entry.inv.push({
      inum: invoice.invoiceNumber,
      idt: formatDateForGSTR1(invoice.invoiceDate),
      val: toNumber(invoice.totalAmount),
      itms: Array.from(itemsByRate.entries()).map(([rate, amounts], index) => ({
        num: index + 1,
        itm_det: {
          rt: rate,
          txval: amounts.txval,
          iamt: amounts.iamt,
          csamt: 0
        }
      }))
    })
  }

  return Array.from(b2clMap.values())
}

/**
 * Generate B2C Small section of GSTR-1
 */
export function generateB2CSSection(invoices: InvoiceWithRelations[], supplierStateCode: string): B2CSEntry[] {
  const b2csMap = new Map<string, B2CSEntry>()

  const b2csInvoices = invoices.filter(
    inv => inv.invoiceType === 'DOMESTIC_B2C' && 
           toNumber(inv.totalAmount) <= 250000 &&
           inv.client.stateCode
  )

  for (const invoice of b2csInvoices) {
    const stateCode = invoice.client.stateCode!
    const isInterState = stateCode !== supplierStateCode
    const supplyType = isInterState ? 'INTER' : 'INTRA'
    
    // Group by state code and tax rate
    const key = `${stateCode}-${toNumber(invoice.igstRate) || (toNumber(invoice.cgstRate) + toNumber(invoice.sgstRate))}`
    
    if (!b2csMap.has(key)) {
      b2csMap.set(key, {
        sply_ty: supplyType,
        pos: stateCode,
        typ: 'OE', // Other than E-commerce
        txval: 0,
        rt: toNumber(invoice.igstRate) || (toNumber(invoice.cgstRate) + toNumber(invoice.sgstRate)),
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0
      })
    }

    const entry = b2csMap.get(key)!
    entry.txval += toNumber(invoice.taxableAmount || invoice.subtotal)
    entry.iamt += toNumber(invoice.igstAmount)
    entry.camt += toNumber(invoice.cgstAmount)
    entry.samt += toNumber(invoice.sgstAmount)
  }

  return Array.from(b2csMap.values())
}

/**
 * Generate Export section of GSTR-1
 */
export function generateExportSection(invoices: InvoiceWithRelations[]): ExportEntry[] {
  const exportInvoices = invoices.filter(inv => inv.invoiceType === 'EXPORT')
  
  if (exportInvoices.length === 0) return []

  const exportEntry: ExportEntry = {
    exp_typ: 'WOPAY', // Without payment of tax (LUT)
    inv: []
  }

  for (const invoice of exportInvoices) {
    const invEntry = {
      inum: invoice.invoiceNumber,
      idt: formatDateForGSTR1(invoice.invoiceDate),
      val: toNumber(invoice.totalAmount),
      sbpcode: invoice.portCode || undefined,
      sbnum: invoice.shippingBillNo || undefined,
      sbdt: invoice.shippingBillDate ? formatDateForGSTR1(invoice.shippingBillDate) : undefined,
      itms: [{
        txval: toNumber(invoice.subtotal),
        rt: 0, // Zero-rated for exports
        iamt: 0
      }]
    }

    exportEntry.inv.push(invEntry)
  }

  return [exportEntry]
}

/**
 * Generate HSN Summary for GSTR-1
 */
export function generateHSNSummary(invoices: InvoiceWithRelations[]): HSNData {
  const hsnMap = new Map<string, {
    desc: string
    uqc: string
    qty: number
    val: number
    txval: number
    iamt: number
    camt: number
    samt: number
  }>()

  for (const invoice of invoices) {
    for (const item of invoice.lineItems) {
      const hsnCode = item.serviceCode
      
      if (!hsnMap.has(hsnCode)) {
        hsnMap.set(hsnCode, {
          desc: item.description.substring(0, 30), // First 30 chars
          uqc: item.uqc || 'NOS', // Default to Numbers
          qty: 0,
          val: 0,
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0
        })
      }

      const hsnEntry = hsnMap.get(hsnCode)!
      hsnEntry.qty += toNumber(item.quantity)
      hsnEntry.val += toNumber(item.amount) + toNumber(item.cgstAmount) + toNumber(item.sgstAmount) + toNumber(item.igstAmount)
      hsnEntry.txval += toNumber(item.amount)
      hsnEntry.iamt += toNumber(item.igstAmount)
      hsnEntry.camt += toNumber(item.cgstAmount)
      hsnEntry.samt += toNumber(item.sgstAmount)
    }
  }

  return {
    data: Array.from(hsnMap.entries()).map(([hsn, data], index) => ({
      num: index + 1,
      hsn_sc: hsn,
      desc: data.desc,
      uqc: data.uqc,
      qty: data.qty,
      val: data.val,
      txval: data.txval,
      iamt: data.iamt,
      camt: data.camt,
      samt: data.samt,
      csamt: 0
    }))
  }
}

/**
 * Main function to generate complete GSTR-1 JSON
 */
export function generateGSTR1(
  invoices: InvoiceWithRelations[],
  gstin: string,
  month: number,
  year: number,
  supplierStateCode: string
): GSTR1Json {
  const gstr1: GSTR1Json = {
    gstin,
    ret_period: formatReturnPeriod(month, year),
  }

  // Generate B2B section
  const b2b = generateB2BSection(invoices)
  if (b2b.length > 0) {
    gstr1.b2b = b2b
  }

  // Generate B2C Large section
  const b2cl = generateB2CLSection(invoices)
  if (b2cl.length > 0) {
    gstr1.b2cl = b2cl
  }

  // Generate B2C Small section
  const b2cs = generateB2CSSection(invoices, supplierStateCode)
  if (b2cs.length > 0) {
    gstr1.b2cs = b2cs
  }

  // Generate Export section
  const exp = generateExportSection(invoices)
  if (exp.length > 0) {
    gstr1.exp = exp
  }

  // Generate HSN Summary
  const hsn = generateHSNSummary(invoices)
  if (hsn.data.length > 0) {
    gstr1.hsn = hsn
  }

  return gstr1
}