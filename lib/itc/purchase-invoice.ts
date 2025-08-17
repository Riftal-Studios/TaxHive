/**
 * Purchase Invoice Management for ITC
 * Handles purchase invoice creation, GST calculation, and GSTR-2A matching
 */

import { Decimal } from '@prisma/client/runtime/library'

export interface PurchaseInvoiceInput {
  invoiceNumber: string
  invoiceDate: Date
  vendorId: string
  vendorGSTIN?: string | null
  vendorPAN?: string | null
  vendorType?: string
  placeOfSupply: string
  billToStateCode: string
  lineItems: LineItem[]
  paymentTerms?: number
  isRCM?: boolean
  rcmApplicablePercent?: number
}

export interface LineItem {
  description: string
  hsnCode?: string
  sacCode?: string
  quantity: Decimal
  rate: Decimal
  taxableAmount: Decimal
  gstRate: number
  itcCategory: string
  blockedCategory?: string
  businessUsePercent?: number
}

export interface GSTCalculationResult {
  cgst: Decimal
  sgst: Decimal
  igst: Decimal
  totalGST: Decimal
  totalAmount: Decimal
  rcmAmount: Decimal
  vendorGST: Decimal
  payableToVendor: Decimal
  payableToGovt: Decimal
}

export interface GSTR2AMatchResult {
  isMatched: boolean
  matchScore: number
  discrepancies: string[]
  cgstDifference?: number
  sgstDifference?: number
  igstDifference?: number
}

/**
 * Create a purchase invoice with ITC tracking
 */
export async function createPurchaseInvoice(input: PurchaseInvoiceInput): Promise<any> {
  const isInterState = input.placeOfSupply !== input.billToStateCode
  let totalTaxableAmount = new Decimal(0)
  let totalCGST = new Decimal(0)
  let totalSGST = new Decimal(0)
  let totalIGST = new Decimal(0)
  let totalITCEligible = new Decimal(0)
  let itcEligible = true
  let blockedReason = ''
  let itcCategory = ''
  
  // Calculate totals from line items
  for (const item of input.lineItems) {
    totalTaxableAmount = totalTaxableAmount.add(item.taxableAmount)
    
    const gstCalc = calculatePurchaseGST({
      taxableAmount: item.taxableAmount,
      gstRate: item.gstRate,
      isInterState,
      isRCM: input.isRCM || false,
      rcmPercent: input.rcmApplicablePercent
    })
    
    if (isInterState) {
      totalIGST = totalIGST.add(gstCalc.igst)
    } else {
      totalCGST = totalCGST.add(gstCalc.cgst)
      totalSGST = totalSGST.add(gstCalc.sgst)
    }
    
    // Check ITC eligibility for each item
    if (item.itcCategory === 'BLOCKED') {
      itcEligible = false
      itcCategory = 'BLOCKED'
      if (item.blockedCategory === 'MOTOR_VEHICLE') {
        blockedReason = 'Section 17(5) - Motor vehicles'
      }
    } else if (item.itcCategory === 'CAPITAL_GOODS') {
      itcCategory = 'CAPITAL_GOODS'
    } else if (item.businessUsePercent && item.businessUsePercent < 100) {
      const eligibleGST = gstCalc.totalGST.mul(item.businessUsePercent).div(100)
      totalITCEligible = totalITCEligible.add(eligibleGST)
    } else if (item.itcCategory !== 'BLOCKED') {
      totalITCEligible = totalITCEligible.add(gstCalc.totalGST)
    }
  }
  
  // Check vendor type restrictions
  if (input.vendorType === 'COMPOSITION') {
    itcEligible = false
    blockedReason = 'Composition dealer - No ITC available'
  }
  
  const totalGST = totalCGST.add(totalSGST).add(totalIGST)
  const totalAmount = totalTaxableAmount.add(totalGST)
  
  // Calculate RCM amount if applicable
  let rcmAmount = new Decimal(0)
  if (input.isRCM) {
    const rcmPercent = input.rcmApplicablePercent || 100
    rcmAmount = totalGST.mul(rcmPercent).div(100)
    
    // ITC can be claimed on RCM amount
    if (itcEligible) {
      totalITCEligible = rcmAmount
    }
  }
  
  // If ITC is eligible and not blocked, set claimed amount
  const itcClaimed = itcEligible ? totalITCEligible : new Decimal(0)
  
  // Create the invoice object
  const invoice = {
    id: `pinv-${Date.now()}`,
    invoiceNumber: input.invoiceNumber,
    invoiceDate: input.invoiceDate,
    vendorId: input.vendorId,
    vendorGSTIN: input.vendorGSTIN || null,
    vendorPAN: input.vendorPAN || null,
    vendorType: input.vendorType || 'REGULAR',
    placeOfSupply: input.placeOfSupply,
    billToStateCode: input.billToStateCode,
    taxableAmount: totalTaxableAmount,
    cgstAmount: isInterState ? null : totalCGST,
    sgstAmount: isInterState ? null : totalSGST,
    igstAmount: isInterState ? totalIGST : null,
    totalAmount,
    isRCM: input.isRCM || false,
    rcmAmount: input.isRCM ? rcmAmount : null,
    itcEligible,
    itcCategory: itcCategory || input.lineItems[0]?.itcCategory || 'INPUTS',
    itcClaimed,
    blockedReason,
    paymentTerms: input.paymentTerms,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  return invoice
}

/**
 * Update a purchase invoice
 */
export async function updatePurchaseInvoice(id: string, updates: Partial<PurchaseInvoiceInput>): Promise<any> {
  // Mock implementation for testing
  return {
    id,
    ...updates,
    updatedAt: new Date()
  }
}

/**
 * Calculate GST for purchase invoice
 */
export function calculatePurchaseGST(params: {
  taxableAmount: Decimal
  gstRate: number
  isInterState: boolean
  isRCM: boolean
  rcmPercent?: number
}): GSTCalculationResult {
  const { taxableAmount, gstRate, isInterState, isRCM, rcmPercent = 100 } = params
  
  const totalGST = taxableAmount.mul(gstRate).div(100)
  let cgst = new Decimal(0)
  let sgst = new Decimal(0)
  let igst = new Decimal(0)
  let rcmAmount = new Decimal(0)
  let vendorGST = totalGST
  let payableToVendor = taxableAmount
  let payableToGovt = new Decimal(0)
  
  if (isInterState) {
    igst = totalGST
  } else {
    cgst = totalGST.div(2)
    sgst = totalGST.div(2)
  }
  
  if (isRCM) {
    if (rcmPercent === 100) {
      // Full RCM - vendor doesn't charge GST
      rcmAmount = totalGST
      vendorGST = new Decimal(0)
      payableToVendor = taxableAmount
      payableToGovt = rcmAmount
    } else {
      // Partial RCM
      rcmAmount = totalGST.mul(rcmPercent).div(100)
      vendorGST = totalGST.sub(rcmAmount)
      payableToVendor = taxableAmount.add(vendorGST)
      payableToGovt = rcmAmount
    }
  } else {
    payableToVendor = taxableAmount.add(totalGST)
  }
  
  const totalAmount = taxableAmount.add(totalGST)
  
  return {
    cgst,
    sgst,
    igst,
    totalGST,
    totalAmount,
    rcmAmount,
    vendorGST,
    payableToVendor,
    payableToGovt
  }
}

/**
 * Check ITC eligibility for an invoice
 */
export async function checkITCEligibilityForInvoice(invoice: any): Promise<{
  totalEligibleITC: Decimal
  totalBlockedITC: Decimal
  eligibilityPercentage: number
  blockedItems: any[]
  reversalRequired: Decimal
}> {
  let totalEligibleITC = new Decimal(0)
  let totalBlockedITC = new Decimal(0)
  const blockedItems: any[] = []
  let reversalRequired = new Decimal(0)
  
  // First check base conditions
  const isValidInvoice = invoice.isValidInvoice !== false
  const goodsReceived = invoice.goodsReceived !== false
  
  // Check vendor type restrictions
  if (invoice.vendorType === 'COMPOSITION') {
    const totalGST = invoice.lineItems.reduce((sum: Decimal, item: any) => 
      sum.add(item.gstAmount), new Decimal(0))
    totalBlockedITC = totalGST
    blockedItems.push({
      description: 'All items',
      reason: 'Composition dealer - No ITC available',
      amount: totalGST
    })
  } else if (isValidInvoice && goodsReceived) {
    // Check each line item only if base conditions are met
    for (const item of invoice.lineItems || []) {
      if (item.itcCategory === 'BLOCKED') {
        totalBlockedITC = totalBlockedITC.add(item.gstAmount)
        blockedItems.push({
          description: item.description,
          reason: `Section 17(5) - ${item.blockedCategory || 'Blocked category'}`,
          amount: item.gstAmount
        })
      } else if (item.businessUsePercent && item.businessUsePercent < 100) {
        // Proportionate ITC for common expenses
        const eligiblePortion = item.gstAmount.mul(item.businessUsePercent).div(100)
        const blockedPortion = item.gstAmount.sub(eligiblePortion)
        
        totalEligibleITC = totalEligibleITC.add(eligiblePortion)
        totalBlockedITC = totalBlockedITC.add(blockedPortion)
        reversalRequired = reversalRequired.add(blockedPortion)
      } else {
        // Fully eligible
        totalEligibleITC = totalEligibleITC.add(item.gstAmount)
      }
    }
  } else {
    // If base conditions not met, block all ITC
    const totalGST = invoice.lineItems?.reduce((sum: Decimal, item: any) => 
      sum.add(item.gstAmount), new Decimal(0)) || new Decimal(0)
    
    totalBlockedITC = totalGST
    totalEligibleITC = new Decimal(0)
    
    if (!isValidInvoice) {
      blockedItems.push({
        description: 'All items',
        reason: 'Invalid invoice',
        amount: totalGST
      })
    }
    
    if (!goodsReceived) {
      blockedItems.push({
        description: 'All items',
        reason: 'Goods not yet received',
        amount: totalGST
      })
    }
  }
  
  const totalGST = totalEligibleITC.add(totalBlockedITC)
  const eligibilityPercentage = totalGST.gt(0) 
    ? parseFloat(totalEligibleITC.mul(100).div(totalGST).toFixed(2))
    : 0
  
  return {
    totalEligibleITC,
    totalBlockedITC,
    eligibilityPercentage,
    blockedItems,
    reversalRequired
  }
}

/**
 * Match purchase invoice with GSTR-2A entry
 */
export async function matchWithGSTR2A(
  purchaseInvoice: any,
  gstr2aEntry: any
): Promise<GSTR2AMatchResult> {
  const discrepancies: string[] = []
  let matchScore = 100
  
  // Check GSTIN match
  if (purchaseInvoice.vendorGSTIN !== gstr2aEntry.supplierGSTIN) {
    discrepancies.push('GSTIN mismatch')
    matchScore -= 30
  }
  
  // Check invoice number match
  if (purchaseInvoice.invoiceNumber !== gstr2aEntry.invoiceNumber) {
    discrepancies.push('Invoice number mismatch')
    matchScore -= 20
  }
  
  // Check invoice date match
  const invoiceDate = new Date(purchaseInvoice.invoiceDate).getTime()
  const gstr2aDate = new Date(gstr2aEntry.invoiceDate).getTime()
  if (invoiceDate !== gstr2aDate) {
    discrepancies.push('Invoice date mismatch')
    matchScore -= 10
  }
  
  // Check taxable amount match
  const taxableAmount = purchaseInvoice.taxableAmount?.toNumber() || 0
  if (Math.abs(taxableAmount - gstr2aEntry.taxableValue) > 0.01) {
    discrepancies.push('Taxable amount mismatch')
    matchScore -= 15
  }
  
  // Check CGST match
  const cgstAmount = purchaseInvoice.cgstAmount?.toNumber() || 0
  const cgstDiff = cgstAmount - (gstr2aEntry.cgst || 0)
  if (Math.abs(cgstDiff) > 0.01) {
    discrepancies.push('CGST mismatch')
    matchScore -= 10
  }
  
  // Check SGST match
  const sgstAmount = purchaseInvoice.sgstAmount?.toNumber() || 0
  const sgstDiff = sgstAmount - (gstr2aEntry.sgst || 0)
  if (Math.abs(sgstDiff) > 0.01) {
    discrepancies.push('SGST mismatch')
    matchScore -= 10
  }
  
  // Check IGST match
  const igstAmount = purchaseInvoice.igstAmount?.toNumber() || 0
  const igstDiff = igstAmount - (gstr2aEntry.igst || 0)
  if (Math.abs(igstDiff) > 0.01) {
    discrepancies.push('IGST mismatch')
    matchScore -= 5
  }
  
  const result: GSTR2AMatchResult = {
    isMatched: discrepancies.length === 0,
    matchScore: Math.max(0, matchScore),
    discrepancies
  }
  
  if (cgstDiff !== 0) result.cgstDifference = Math.abs(cgstDiff)
  if (sgstDiff !== 0) result.sgstDifference = Math.abs(sgstDiff)
  if (igstDiff !== 0) result.igstDifference = Math.abs(igstDiff)
  
  return result
}

/**
 * Reconcile purchase invoices with GSTR-2A entries
 */
export async function reconcileInvoices(
  purchaseInvoices: any[],
  gstr2aEntries: any[]
): Promise<{
  matched: any[]
  missingInGSTR2A: any[]
  additionalInGSTR2A: any[]
}> {
  const matched: any[] = []
  const missingInGSTR2A: any[] = []
  const additionalInGSTR2A: any[] = []
  
  // Create maps for efficient lookup
  const purchaseMap = new Map()
  const gstr2aMap = new Map()
  
  purchaseInvoices.forEach(inv => {
    const key = `${inv.vendorGSTIN}-${inv.invoiceNumber}`
    purchaseMap.set(key, inv)
  })
  
  gstr2aEntries.forEach(entry => {
    const key = `${entry.supplierGSTIN}-${entry.invoiceNumber}`
    gstr2aMap.set(key, entry)
  })
  
  // Find matched and missing in GSTR-2A
  for (const [key, invoice] of purchaseMap) {
    if (gstr2aMap.has(key)) {
      matched.push(invoice)
    } else {
      missingInGSTR2A.push(invoice)
    }
  }
  
  // Find additional in GSTR-2A
  for (const [key, entry] of gstr2aMap) {
    if (!purchaseMap.has(key)) {
      additionalInGSTR2A.push(entry)
    }
  }
  
  return {
    matched,
    missingInGSTR2A,
    additionalInGSTR2A
  }
}

/**
 * Get ITC register for a period
 */
export async function getITCRegister(params: {
  period: string
  userId: string
}): Promise<{
  period: string
  openingBalance: Decimal
  eligibleITC: Decimal
  claimedITC: Decimal
  reversedITC: Decimal
  closingBalance: Decimal
}> {
  const { period } = params
  // Mock implementation
  return {
    period,
    openingBalance: new Decimal(50000),
    eligibleITC: new Decimal(100000),
    claimedITC: new Decimal(90000),
    reversedITC: new Decimal(5000),
    closingBalance: new Decimal(55000)
  }
}

/**
 * Calculate ITC utilization
 */
export async function calculateITCUtilization(params: {
  period: string
  userId: string
}): Promise<{
  availableITC: Decimal
  utilizedForCGST: Decimal
  utilizedForSGST: Decimal
  utilizedForIGST: Decimal
  unutilizedITC: Decimal
}> {
  // Mock implementation
  return {
    availableITC: new Decimal(100000),
    utilizedForCGST: new Decimal(30000),
    utilizedForSGST: new Decimal(30000),
    utilizedForIGST: new Decimal(20000),
    unutilizedITC: new Decimal(20000)
  }
}