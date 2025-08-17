import { describe, it, expect, beforeEach } from 'vitest'
import { 
  generateGSTR3B,
  calculateOutwardTaxableSupplies,
  calculateITCAvailable,
  calculateNetTaxLiability,
  calculateInterestAndLateFee,
  validateGSTR3BData
} from '@/lib/gst-returns/gstr3b-generator'
import { Decimal } from '@prisma/client/runtime/library'

describe('GSTR-3B Generation', () => {
  describe('Outward Taxable Supplies Calculation', () => {
    it('should calculate total outward supplies for the period', () => {
      const invoices = [
        {
          id: '1',
          invoiceDate: new Date('2024-05-15'),
          invoiceType: 'DOMESTIC_B2B',
          taxableAmount: new Decimal(100000),
          cgstAmount: new Decimal(9000),
          sgstAmount: new Decimal(9000),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(118000)
        },
        {
          id: '2',
          invoiceDate: new Date('2024-05-20'),
          invoiceType: 'DOMESTIC_B2B',
          taxableAmount: new Decimal(200000),
          cgstAmount: new Decimal(0),
          sgstAmount: new Decimal(0),
          igstAmount: new Decimal(36000),
          totalAmount: new Decimal(236000)
        },
        {
          id: '3',
          invoiceDate: new Date('2024-05-25'),
          invoiceType: 'EXPORT',
          taxableAmount: new Decimal(500000),
          cgstAmount: new Decimal(0),
          sgstAmount: new Decimal(0),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(500000)
        }
      ]

      const result = calculateOutwardTaxableSupplies(invoices)

      expect(result.totalTaxableValue).toBe(800000)
      expect(result.cgstLiability).toBe(9000)
      expect(result.sgstLiability).toBe(9000)
      expect(result.igstLiability).toBe(36000)
      expect(result.zeroRatedSupply).toBe(500000)
      expect(result.exemptSupply).toBe(0)
      expect(result.nilRatedSupply).toBe(0)
    })

    it('should handle inter-state supplies to unregistered persons', () => {
      const invoices = [
        {
          id: '1',
          invoiceDate: new Date('2024-05-15'),
          invoiceType: 'DOMESTIC_B2C',
          client: {
            gstin: null,
            stateCode: '29' // Different state
          },
          placeOfSupply: '29',
          supplierStateCode: '27',
          taxableAmount: new Decimal(300000), // > 2.5L
          cgstAmount: new Decimal(0),
          sgstAmount: new Decimal(0),
          igstAmount: new Decimal(54000),
          totalAmount: new Decimal(354000)
        }
      ]

      const result = calculateOutwardTaxableSupplies(invoices)

      expect(result.interStateUnregistered).toBe(300000)
      expect(result.igstLiability).toBe(54000)
    })

    it('should calculate reverse charge supplies', () => {
      const invoices = [
        {
          id: '1',
          invoiceDate: new Date('2024-05-15'),
          invoiceType: 'DOMESTIC_B2B',
          reverseCharge: true,
          taxableAmount: new Decimal(50000),
          cgstAmount: new Decimal(4500),
          sgstAmount: new Decimal(4500),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(59000)
        }
      ]

      const result = calculateOutwardTaxableSupplies(invoices)

      expect(result.reverseChargeSupply).toBe(50000)
      // Tax liability is on recipient, not supplier
      expect(result.cgstLiability).toBe(0)
      expect(result.sgstLiability).toBe(0)
    })
  })

  describe('Input Tax Credit Calculation', () => {
    it('should calculate ITC from purchase invoices', () => {
      const purchaseInvoices = [
        {
          id: '1',
          invoiceDate: new Date('2024-05-10'),
          vendorGstin: '27AAECR2971C1Z5',
          taxableAmount: new Decimal(50000),
          cgstAmount: new Decimal(4500),
          sgstAmount: new Decimal(4500),
          igstAmount: new Decimal(0),
          itcEligible: true,
          itcCategory: 'INPUTS',
          itcClaimed: new Decimal(9000)
        },
        {
          id: '2',
          invoiceDate: new Date('2024-05-15'),
          vendorGstin: '29AAECR2971C1Z5',
          taxableAmount: new Decimal(100000),
          cgstAmount: new Decimal(0),
          sgstAmount: new Decimal(0),
          igstAmount: new Decimal(18000),
          itcEligible: true,
          itcCategory: 'CAPITAL_GOODS',
          itcClaimed: new Decimal(18000)
        }
      ]

      const result = calculateITCAvailable(purchaseInvoices)

      expect(result.cgstITC).toBe(4500)
      expect(result.sgstITC).toBe(4500)
      expect(result.igstITC).toBe(18000)
      expect(result.totalITC).toBe(27000)
      expect(result.inputsITC).toBe(9000)
      expect(result.capitalGoodsITC).toBe(18000)
      expect(result.inputServicesITC).toBe(0)
    })

    it('should exclude blocked credits', () => {
      const purchaseInvoices = [
        {
          id: '1',
          invoiceDate: new Date('2024-05-10'),
          vendorGstin: '27AAECR2971C1Z5',
          taxableAmount: new Decimal(50000),
          cgstAmount: new Decimal(4500),
          sgstAmount: new Decimal(4500),
          igstAmount: new Decimal(0),
          itcEligible: false,
          itcCategory: 'BLOCKED',
          itcClaimed: new Decimal(0),
          blockedCategory: 'Motor vehicles'
        }
      ]

      const result = calculateITCAvailable(purchaseInvoices)

      expect(result.totalITC).toBe(0)
      expect(result.blockedITC).toBe(9000)
    })

    it('should handle ITC reversal', () => {
      const purchaseInvoices = [
        {
          id: '1',
          invoiceDate: new Date('2024-05-10'),
          vendorGstin: '27AAECR2971C1Z5',
          taxableAmount: new Decimal(50000),
          cgstAmount: new Decimal(4500),
          sgstAmount: new Decimal(4500),
          igstAmount: new Decimal(0),
          itcEligible: true,
          itcCategory: 'INPUTS',
          itcClaimed: new Decimal(9000),
          itcReversed: new Decimal(1000),
          reversalReason: 'Payment not made within 180 days'
        }
      ]

      const result = calculateITCAvailable(purchaseInvoices)

      expect(result.totalITC).toBe(8000) // 9000 - 1000 reversal
      expect(result.reversedITC).toBe(1000)
    })

    it('should calculate ITC on reverse charge', () => {
      const purchaseInvoices = [
        {
          id: '1',
          invoiceDate: new Date('2024-05-10'),
          reverseCharge: true,
          taxableAmount: new Decimal(100000),
          cgstAmount: new Decimal(9000),
          sgstAmount: new Decimal(9000),
          igstAmount: new Decimal(0),
          itcEligible: true,
          itcCategory: 'INPUT_SERVICES',
          itcClaimed: new Decimal(18000)
        }
      ]

      const result = calculateITCAvailable(purchaseInvoices)

      expect(result.reverseChargeITC).toBe(18000)
      expect(result.totalITC).toBe(18000)
    })
  })

  describe('Net Tax Liability Calculation', () => {
    it('should calculate net tax payable', () => {
      const outwardSupplies = {
        totalTaxableValue: 500000,
        cgstLiability: 25000,
        sgstLiability: 25000,
        igstLiability: 40000,
        cessLiability: 0
      }

      const itcAvailable = {
        cgstITC: 15000,
        sgstITC: 15000,
        igstITC: 30000,
        cessITC: 0
      }

      const result = calculateNetTaxLiability(outwardSupplies, itcAvailable)

      expect(result.cgstPayable).toBe(10000) // 25000 - 15000
      expect(result.sgstPayable).toBe(10000) // 25000 - 15000
      expect(result.igstPayable).toBe(10000) // 40000 - 30000
      expect(result.cessPayable).toBe(0)
      expect(result.totalTaxPayable).toBe(30000)
    })

    it('should utilize IGST credit for CGST/SGST payment', () => {
      const outwardSupplies = {
        totalTaxableValue: 500000,
        cgstLiability: 25000,
        sgstLiability: 25000,
        igstLiability: 0,
        cessLiability: 0
      }

      const itcAvailable = {
        cgstITC: 10000,
        sgstITC: 10000,
        igstITC: 30000, // Excess IGST credit
        cessITC: 0
      }

      const result = calculateNetTaxLiability(outwardSupplies, itcAvailable)

      // IGST credit can be used for CGST/SGST payment
      expect(result.cgstPayable).toBe(0) // 25000 - 10000 CGST - 15000 IGST = 0
      expect(result.sgstPayable).toBe(0) // 25000 - 10000 SGST - 15000 IGST = 0
      expect(result.igstPayable).toBe(0)
      expect(result.totalTaxPayable).toBe(0)
      expect(result.igstCreditUsedForCGST).toBe(15000)
      expect(result.igstCreditUsedForSGST).toBe(15000)
    })

    it('should calculate interest and late fee', () => {
      const taxPayable = 50000
      const daysLate = 10
      const interestRate = 18 // 18% per annum

      const result = calculateInterestAndLateFee(taxPayable, daysLate)

      const expectedInterest = Math.round((taxPayable * interestRate * daysLate) / (365 * 100))
      expect(result.interest).toBe(expectedInterest)
      expect(result.lateFee).toBe(250) // 25 per day for 10 days
    })
  })

  describe('GSTR-3B Data Validation', () => {
    it('should validate ITC claimed does not exceed available ITC', () => {
      const data = {
        itcClaimed: {
          cgst: 20000,
          sgst: 20000,
          igst: 30000
        },
        itcAvailable: {
          cgst: 15000, // Less than claimed
          sgst: 15000, // Less than claimed
          igst: 30000
        }
      }

      const result = validateGSTR3BData(data)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('ITC claimed cannot exceed available ITC')
    })

    it('should validate tax payment matches liability minus ITC', () => {
      const data = {
        outwardLiability: {
          cgst: 50000,
          sgst: 50000,
          igst: 0
        },
        itcClaimed: {
          cgst: 20000,
          sgst: 20000,
          igst: 0
        },
        taxPayment: {
          cgst: 25000, // Should be 30000
          sgst: 30000, // Correct
          igst: 0
        }
      }

      const result = validateGSTR3BData(data)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Tax payment does not match calculated liability')
    })

    it('should validate all mandatory fields are present', () => {
      const data = {
        gstin: null,
        period: null
      }

      const result = validateGSTR3BData(data)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('GSTIN is required')
      expect(result.errors).toContain('Period is required')
    })
  })

  describe('Complete GSTR-3B Generation', () => {
    it('should generate complete GSTR-3B JSON', () => {
      const invoices = [
        {
          id: '1',
          invoiceDate: new Date('2024-05-15'),
          invoiceType: 'DOMESTIC_B2B',
          taxableAmount: new Decimal(100000),
          cgstAmount: new Decimal(9000),
          sgstAmount: new Decimal(9000),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(118000)
        },
        {
          id: '2',
          invoiceDate: new Date('2024-05-20'),
          invoiceType: 'EXPORT',
          taxableAmount: new Decimal(500000),
          cgstAmount: new Decimal(0),
          sgstAmount: new Decimal(0),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(500000)
        }
      ]

      const purchaseInvoices = [
        {
          id: 'p1',
          invoiceDate: new Date('2024-05-10'),
          vendorGstin: '27AAECR2971C1Z5',
          taxableAmount: new Decimal(50000),
          cgstAmount: new Decimal(4500),
          sgstAmount: new Decimal(4500),
          igstAmount: new Decimal(0),
          itcEligible: true,
          itcClaimed: new Decimal(9000)
        }
      ]

      const config = {
        gstin: '27AAECR2971C1Z0',
        period: '052024'
      }

      const result = generateGSTR3B(invoices, purchaseInvoices, config)

      expect(result.gstin).toBe('27AAECR2971C1Z0')
      expect(result.ret_period).toBe('052024')
      
      // Section 3.1 - Outward supplies
      expect(result.sup_details.osup_det.txval).toBe(600000) // Total taxable
      expect(result.sup_details.osup_det.camt).toBe(9000)
      expect(result.sup_details.osup_det.samt).toBe(9000)
      expect(result.sup_details.osup_det.iamt).toBe(0)
      
      // Section 3.1(a) - Zero rated supplies
      expect(result.sup_details.osup_zero.txval).toBe(500000)
      expect(result.sup_details.osup_zero.iamt).toBe(0)
      
      // Section 4 - ITC (OTH type is at index 4)
      expect(result.itc_elg.itc_avl[4].camt).toBe(4500) // CGST ITC
      expect(result.itc_elg.itc_avl[4].samt).toBe(4500) // SGST ITC
      
      // Section 5 - Net tax liability
      expect(result.tx_pmt.tx_pay[0].camt).toBe(4500) // 9000 - 4500
      expect(result.tx_pmt.tx_pay[0].samt).toBe(4500) // 9000 - 4500
    })

    it('should handle nil returns', () => {
      const invoices = []
      const purchaseInvoices = []
      const config = {
        gstin: '27AAECR2971C1Z0',
        period: '052024'
      }

      const result = generateGSTR3B(invoices, purchaseInvoices, config)

      expect(result.sup_details.osup_det.txval).toBe(0)
      expect(result.sup_details.osup_det.camt).toBe(0)
      expect(result.sup_details.osup_det.samt).toBe(0)
      expect(result.sup_details.osup_det.iamt).toBe(0)
      expect(result.itc_elg.itc_avl[0].camt).toBe(0)
      expect(result.itc_elg.itc_avl[0].samt).toBe(0)
      expect(result.itc_elg.itc_avl[0].iamt).toBe(0)
    })
  })
})