import { Decimal } from '@prisma/client/runtime/library'

/**
 * GSTR-3B Generator - Generates monthly summary GST return
 * Compliant with GST Portal format
 */

interface Invoice {
  id: string
  invoiceDate: Date
  invoiceType: string
  taxableAmount: Decimal
  cgstAmount: Decimal
  sgstAmount: Decimal
  igstAmount: Decimal
  totalAmount: Decimal
  reverseCharge?: boolean
  client?: {
    gstin: string | null
    stateCode?: string
  }
  placeOfSupply?: string
  supplierStateCode?: string
}

interface PurchaseInvoice {
  id: string
  invoiceDate: Date
  vendorGstin: string
  taxableAmount: Decimal
  cgstAmount: Decimal
  sgstAmount: Decimal
  igstAmount: Decimal
  itcEligible: boolean
  itcCategory?: string
  itcClaimed: Decimal
  itcReversed?: Decimal
  reversalReason?: string
  reverseCharge?: boolean
  blockedCategory?: string
}

interface OutwardSupplies {
  totalTaxableValue: number
  cgstLiability: number
  sgstLiability: number
  igstLiability: number
  cessLiability?: number
  zeroRatedSupply?: number
  exemptSupply?: number
  nilRatedSupply?: number
  interStateUnregistered?: number
  reverseChargeSupply?: number
}

interface ITCAvailable {
  cgstITC: number
  sgstITC: number
  igstITC: number
  cessITC?: number
  totalITC: number
  inputsITC?: number
  capitalGoodsITC?: number
  inputServicesITC?: number
  blockedITC?: number
  reversedITC?: number
  reverseChargeITC?: number
}

interface NetTaxLiability {
  cgstPayable: number
  sgstPayable: number
  igstPayable: number
  cessPayable: number
  totalTaxPayable: number
  igstCreditUsedForCGST?: number
  igstCreditUsedForSGST?: number
}

/**
 * Calculate outward taxable supplies for the period
 */
export function calculateOutwardTaxableSupplies(invoices: Invoice[]): OutwardSupplies {
  let totalTaxableValue = 0
  let cgstLiability = 0
  let sgstLiability = 0
  let igstLiability = 0
  let zeroRatedSupply = 0
  const exemptSupply = 0
  const nilRatedSupply = 0
  let interStateUnregistered = 0
  let reverseChargeSupply = 0

  for (const invoice of invoices) {
    const taxableAmount = invoice.taxableAmount.toNumber()
    const cgst = invoice.cgstAmount.toNumber()
    const sgst = invoice.sgstAmount.toNumber()
    const igst = invoice.igstAmount.toNumber()

    if (invoice.invoiceType === 'EXPORT') {
      // Exports are zero-rated
      zeroRatedSupply += taxableAmount
    } else if (invoice.reverseCharge) {
      // Reverse charge supplies - tax liability on recipient
      reverseChargeSupply += taxableAmount
    } else {
      // All domestic supplies (including exports which are also included in total)
      totalTaxableValue += taxableAmount
      
      if (!invoice.reverseCharge) {
        cgstLiability += cgst
        sgstLiability += sgst
        igstLiability += igst
      }

      // Check for inter-state B2C large invoices
      if (invoice.invoiceType === 'DOMESTIC_B2C' && 
          !invoice.client?.gstin &&
          invoice.placeOfSupply !== invoice.supplierStateCode &&
          invoice.totalAmount.toNumber() > 250000) {
        interStateUnregistered += taxableAmount
      }
    }
  }
  
  // Include exports in the total taxable value
  totalTaxableValue += zeroRatedSupply

  return {
    totalTaxableValue,
    cgstLiability,
    sgstLiability,
    igstLiability,
    cessLiability: 0,
    zeroRatedSupply,
    exemptSupply,
    nilRatedSupply,
    interStateUnregistered,
    reverseChargeSupply
  }
}

/**
 * Calculate available Input Tax Credit
 */
export function calculateITCAvailable(purchaseInvoices: PurchaseInvoice[]): ITCAvailable {
  let cgstITC = 0
  let sgstITC = 0
  let igstITC = 0
  let totalITC = 0
  let inputsITC = 0
  let capitalGoodsITC = 0
  let inputServicesITC = 0
  let blockedITC = 0
  let reversedITC = 0
  let reverseChargeITC = 0

  for (const purchase of purchaseInvoices) {
    const cgst = purchase.cgstAmount.toNumber()
    const sgst = purchase.sgstAmount.toNumber()
    const igst = purchase.igstAmount.toNumber()
    const claimed = purchase.itcClaimed.toNumber()
    const reversed = purchase.itcReversed?.toNumber() || 0

    if (purchase.itcEligible && !purchase.blockedCategory) {
      // Eligible ITC
      cgstITC += cgst
      sgstITC += sgst
      igstITC += igst

      // Handle reversal
      if (reversed > 0) {
        reversedITC += reversed
        // Deduct reversal from ITC
        const totalTax = cgst + sgst + igst
        if (totalTax > 0) {
          const reversalRatio = reversed / totalTax
          cgstITC -= cgst * reversalRatio
          sgstITC -= sgst * reversalRatio
          igstITC -= igst * reversalRatio
        }
      }

      // Categorize ITC
      if (purchase.itcCategory === 'INPUTS') {
        inputsITC += claimed
      } else if (purchase.itcCategory === 'CAPITAL_GOODS') {
        capitalGoodsITC += claimed
      } else if (purchase.itcCategory === 'INPUT_SERVICES') {
        inputServicesITC += claimed
      }

      // Reverse charge ITC
      if (purchase.reverseCharge) {
        reverseChargeITC += claimed
      }
    } else {
      // Blocked ITC
      blockedITC += cgst + sgst + igst
    }
  }

  totalITC = cgstITC + sgstITC + igstITC

  return {
    cgstITC,
    sgstITC,
    igstITC,
    cessITC: 0,
    totalITC,
    inputsITC,
    capitalGoodsITC,
    inputServicesITC,
    blockedITC,
    reversedITC,
    reverseChargeITC
  }
}

/**
 * Calculate net tax liability after adjusting ITC
 */
export function calculateNetTaxLiability(
  outwardSupplies: OutwardSupplies,
  itcAvailable: ITCAvailable
): NetTaxLiability {
  let cgstPayable = outwardSupplies.cgstLiability - itcAvailable.cgstITC
  let sgstPayable = outwardSupplies.sgstLiability - itcAvailable.sgstITC
  let igstPayable = outwardSupplies.igstLiability - itcAvailable.igstITC
  
  let igstCreditUsedForCGST = 0
  let igstCreditUsedForSGST = 0

  // If IGST credit is available after setting off IGST liability
  if (igstPayable < 0) {
    const excessIGST = Math.abs(igstPayable)
    
    // First set off CGST liability
    if (cgstPayable > 0) {
      const cgstSetOff = Math.min(cgstPayable, excessIGST)
      cgstPayable -= cgstSetOff
      igstCreditUsedForCGST = cgstSetOff
    }
    
    // Then set off SGST liability with remaining IGST credit
    const remainingIGST = excessIGST - igstCreditUsedForCGST
    if (sgstPayable > 0 && remainingIGST > 0) {
      const sgstSetOff = Math.min(sgstPayable, remainingIGST)
      sgstPayable -= sgstSetOff
      igstCreditUsedForSGST = sgstSetOff
    }
    
    igstPayable = 0
  }

  // Ensure no negative values
  cgstPayable = Math.max(0, cgstPayable)
  sgstPayable = Math.max(0, sgstPayable)
  igstPayable = Math.max(0, igstPayable)

  const cessPayable = (outwardSupplies.cessLiability || 0) - (itcAvailable.cessITC || 0)
  const totalTaxPayable = cgstPayable + sgstPayable + igstPayable + Math.max(0, cessPayable)

  return {
    cgstPayable,
    sgstPayable,
    igstPayable,
    cessPayable: Math.max(0, cessPayable),
    totalTaxPayable,
    igstCreditUsedForCGST,
    igstCreditUsedForSGST
  }
}

/**
 * Calculate interest and late fee for delayed filing
 */
export function calculateInterestAndLateFee(
  taxPayable: number,
  daysLate: number
): { interest: number; lateFee: number } {
  // Interest calculation: 18% per annum
  const interestRate = 18
  const interest = Math.round((taxPayable * interestRate * daysLate) / (365 * 100))
  
  // Late fee: Rs 25 per day (CGST) + Rs 25 per day (SGST) = Rs 50 per day
  // Maximum Rs 5000 each = Rs 10000 total
  const lateFeePerDay = 25
  const lateFee = Math.min(daysLate * lateFeePerDay, 5000) // Cap at Rs 5000 for CGST/SGST each

  return {
    interest,
    lateFee
  }
}

/**
 * Validate GSTR-3B data
 */
export function validateGSTR3BData(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check if ITC claimed exceeds available ITC
  if (data.itcClaimed) {
    if (data.itcClaimed.cgst > (data.itcAvailable?.cgst || 0)) {
      errors.push('ITC claimed cannot exceed available ITC')
    }
    if (data.itcClaimed.sgst > (data.itcAvailable?.sgst || 0)) {
      errors.push('ITC claimed cannot exceed available ITC')
    }
    if (data.itcClaimed.igst > (data.itcAvailable?.igst || 0)) {
      errors.push('ITC claimed cannot exceed available ITC')
    }
  }

  // Check if tax payment matches liability minus ITC
  if (data.outwardLiability && data.itcClaimed && data.taxPayment) {
    const expectedCGST = data.outwardLiability.cgst - data.itcClaimed.cgst
    const expectedSGST = data.outwardLiability.sgst - data.itcClaimed.sgst
    const expectedIGST = data.outwardLiability.igst - data.itcClaimed.igst

    if (Math.abs(data.taxPayment.cgst - expectedCGST) > 0.01) {
      errors.push('Tax payment does not match calculated liability')
    }
    if (Math.abs(data.taxPayment.sgst - expectedSGST) > 0.01) {
      errors.push('Tax payment does not match calculated liability')
    }
    if (Math.abs(data.taxPayment.igst - expectedIGST) > 0.01) {
      errors.push('Tax payment does not match calculated liability')
    }
  }

  // Check mandatory fields
  if (!data.gstin) {
    errors.push('GSTIN is required')
  }
  if (!data.period) {
    errors.push('Period is required')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Generate complete GSTR-3B JSON
 */
export function generateGSTR3B(
  invoices: Invoice[],
  purchaseInvoices: PurchaseInvoice[],
  config: {
    gstin: string
    period: string
  }
): Record<string, unknown> {
  const outwardSupplies = calculateOutwardTaxableSupplies(invoices)
  const itcAvailable = calculateITCAvailable(purchaseInvoices)
  const netTaxLiability = calculateNetTaxLiability(outwardSupplies, itcAvailable)

  return {
    gstin: config.gstin,
    ret_period: config.period,
    
    // Section 3.1 - Outward supplies
    sup_details: {
      osup_det: {
        txval: outwardSupplies.totalTaxableValue,
        camt: outwardSupplies.cgstLiability,
        samt: outwardSupplies.sgstLiability,
        iamt: outwardSupplies.igstLiability,
        csamt: outwardSupplies.cessLiability || 0
      },
      osup_zero: {
        txval: outwardSupplies.zeroRatedSupply || 0,
        iamt: 0,
        csamt: 0
      },
      osup_nil_exmp: {
        txval: (outwardSupplies.exemptSupply || 0) + (outwardSupplies.nilRatedSupply || 0)
      },
      isup_rev: {
        txval: outwardSupplies.reverseChargeSupply || 0,
        camt: 0,
        samt: 0,
        iamt: 0,
        csamt: 0
      },
      osup_nongst: {
        txval: 0
      }
    },
    
    // Section 3.2 - Inter-state supplies to unregistered persons
    inter_sup: {
      unreg_details: outwardSupplies.interStateUnregistered ? [{
        pos: '00', // To be determined from actual data
        txval: outwardSupplies.interStateUnregistered,
        iamt: outwardSupplies.igstLiability
      }] : []
    },
    
    // Section 4 - Eligible ITC
    itc_elg: {
      itc_avl: [
        {
          ty: 'IMPG', // Import of goods
          camt: 0,
          samt: 0,
          iamt: 0,
          csamt: 0
        },
        {
          ty: 'IMPS', // Import of services  
          camt: 0,
          samt: 0,
          iamt: 0,
          csamt: 0
        },
        {
          ty: 'ISRC', // ISD
          camt: 0,
          samt: 0,
          iamt: 0,
          csamt: 0
        },
        {
          ty: 'ISD', // Inward supplies from ISD
          camt: 0,
          samt: 0,
          iamt: 0,
          csamt: 0
        },
        {
          ty: 'OTH', // All other ITC
          camt: itcAvailable.cgstITC,
          samt: itcAvailable.sgstITC,
          iamt: itcAvailable.igstITC,
          csamt: 0
        }
      ],
      itc_rev: [
        {
          ty: 'RUL', // As per rules
          camt: 0,
          samt: 0,
          iamt: 0,
          csamt: 0
        },
        {
          ty: 'OTH', // Others
          camt: 0,
          samt: 0,
          iamt: 0,
          csamt: 0
        }
      ],
      itc_net: {
        camt: itcAvailable.cgstITC,
        samt: itcAvailable.sgstITC,
        iamt: itcAvailable.igstITC,
        csamt: 0
      },
      itc_inelg: [
        {
          ty: 'RUL', // As per Section 17(5)
          camt: 0,
          samt: 0,
          iamt: 0,
          csamt: 0
        },
        {
          ty: 'OTH', // Others
          camt: 0,
          samt: 0,
          iamt: 0,
          csamt: 0
        }
      ]
    },
    
    // Section 5 - Tax payment
    tx_pmt: {
      tx_pay: [
        {
          ty: 'TX', // Tax payment
          camt: netTaxLiability.cgstPayable,
          samt: netTaxLiability.sgstPayable,
          iamt: netTaxLiability.igstPayable,
          csamt: netTaxLiability.cessPayable
        }
      ]
    },
    
    // Section 6.1 - Interest and late fee
    intr_ltfee: {
      intr: {
        camt: 0,
        samt: 0,
        iamt: 0,
        csamt: 0
      },
      ltfee: {
        central: 0,
        state: 0
      }
    }
  }
}