import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPurchaseInvoice,
  updatePurchaseInvoice,
  calculatePurchaseGST,
  checkITCEligibilityForInvoice,
  matchWithGSTR2A,
  reconcileInvoices,
  PurchaseInvoiceInput,
  GSTCalculationResult,
  GSTR2AMatchResult
} from '@/lib/itc/purchase-invoice'
import { Decimal } from '@prisma/client/runtime/library'

describe('Purchase Invoice Management', () => {
  describe('Purchase Invoice Creation', () => {
    it('should create purchase invoice with ITC eligibility', async () => {
      const invoiceInput: PurchaseInvoiceInput = {
        invoiceNumber: 'PINV-2024-001',
        invoiceDate: new Date('2024-06-15'),
        vendorId: 'vendor-123',
        vendorGSTIN: '29AABCG1234D1ZA',
        placeOfSupply: '29', // Karnataka
        billToStateCode: '29', // Same state
        lineItems: [
          {
            description: 'Office Supplies',
            hsnCode: '4820',
            quantity: new Decimal(100),
            rate: new Decimal(500),
            taxableAmount: new Decimal(50000),
            gstRate: 18,
            itcCategory: 'INPUTS'
          }
        ],
        paymentTerms: 30,
        isRCM: false
      }
      
      const invoice = await createPurchaseInvoice(invoiceInput)
      
      expect(invoice.invoiceNumber).toBe('PINV-2024-001')
      expect(invoice.vendorId).toBe('vendor-123')
      expect(invoice.taxableAmount.toNumber()).toBe(50000)
      expect(invoice.cgstAmount?.toNumber()).toBe(4500) // 9% CGST
      expect(invoice.sgstAmount?.toNumber()).toBe(4500) // 9% SGST
      expect(invoice.igstAmount).toBeNull() // Same state supply
      expect(invoice.totalAmount.toNumber()).toBe(59000)
      expect(invoice.itcEligible).toBe(true)
      expect(invoice.itcClaimed.toNumber()).toBe(9000)
    })
    
    it('should create inter-state purchase invoice with IGST', async () => {
      const invoiceInput: PurchaseInvoiceInput = {
        invoiceNumber: 'PINV-2024-002',
        invoiceDate: new Date('2024-06-16'),
        vendorId: 'vendor-456',
        vendorGSTIN: '07AABCG5678E1ZB', // Delhi vendor
        placeOfSupply: '07', // Delhi
        billToStateCode: '29', // Karnataka buyer
        lineItems: [
          {
            description: 'Computer Equipment',
            hsnCode: '8471',
            quantity: new Decimal(5),
            rate: new Decimal(50000),
            taxableAmount: new Decimal(250000),
            gstRate: 18,
            itcCategory: 'CAPITAL_GOODS'
          }
        ],
        paymentTerms: 45,
        isRCM: false
      }
      
      const invoice = await createPurchaseInvoice(invoiceInput)
      
      expect(invoice.placeOfSupply).toBe('07')
      expect(invoice.cgstAmount).toBeNull() // Inter-state
      expect(invoice.sgstAmount).toBeNull() // Inter-state
      expect(invoice.igstAmount?.toNumber()).toBe(45000) // 18% IGST
      expect(invoice.totalAmount.toNumber()).toBe(295000)
      expect(invoice.itcCategory).toBe('CAPITAL_GOODS')
    })
    
    it('should handle RCM purchase invoice', async () => {
      const invoiceInput: PurchaseInvoiceInput = {
        invoiceNumber: 'PINV-2024-003',
        invoiceDate: new Date('2024-06-17'),
        vendorId: 'vendor-789',
        vendorGSTIN: null, // Unregistered vendor
        vendorPAN: 'ABCDE1234F',
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [
          {
            description: 'Transportation Services',
            sacCode: '9967',
            quantity: new Decimal(1),
            rate: new Decimal(10000),
            taxableAmount: new Decimal(10000),
            gstRate: 5,
            itcCategory: 'INPUT_SERVICES'
          }
        ],
        isRCM: true,
        rcmApplicablePercent: 100
      }
      
      const invoice = await createPurchaseInvoice(invoiceInput)
      
      expect(invoice.isRCM).toBe(true)
      expect(invoice.rcmAmount?.toNumber()).toBe(500) // 5% on 10000
      expect(invoice.itcEligible).toBe(true) // Can claim ITC on RCM
      expect(invoice.vendorGSTIN).toBeNull()
    })
    
    it('should block ITC for restricted categories', async () => {
      const invoiceInput: PurchaseInvoiceInput = {
        invoiceNumber: 'PINV-2024-004',
        invoiceDate: new Date('2024-06-18'),
        vendorId: 'vendor-101',
        vendorGSTIN: '29AABCG9999D1ZC',
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [
          {
            description: 'Motor Vehicle (5 seater)',
            hsnCode: '8703',
            quantity: new Decimal(1),
            rate: new Decimal(1000000),
            taxableAmount: new Decimal(1000000),
            gstRate: 28,
            itcCategory: 'BLOCKED',
            blockedCategory: 'MOTOR_VEHICLE'
          }
        ]
      }
      
      const invoice = await createPurchaseInvoice(invoiceInput)
      
      expect(invoice.itcEligible).toBe(false)
      expect(invoice.itcCategory).toBe('BLOCKED')
      expect(invoice.itcClaimed.toNumber()).toBe(0)
      expect(invoice.blockedReason).toContain('Section 17(5)')
    })
    
    it('should handle composition dealer purchase', async () => {
      const invoiceInput: PurchaseInvoiceInput = {
        invoiceNumber: 'PINV-2024-005',
        invoiceDate: new Date('2024-06-19'),
        vendorId: 'vendor-comp',
        vendorGSTIN: '29COMP1234D1ZA',
        vendorType: 'COMPOSITION',
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [
          {
            description: 'Goods from composition dealer',
            hsnCode: '6109',
            quantity: new Decimal(100),
            rate: new Decimal(100),
            taxableAmount: new Decimal(10000),
            gstRate: 1, // Composition rate
            itcCategory: 'BLOCKED'
          }
        ]
      }
      
      const invoice = await createPurchaseInvoice(invoiceInput)
      
      expect(invoice.vendorType).toBe('COMPOSITION')
      expect(invoice.itcEligible).toBe(false)
      expect(invoice.blockedReason).toContain('Composition dealer')
    })
  })
  
  describe('GST Calculation for Purchases', () => {
    it('should calculate GST for intra-state purchase', () => {
      const result = calculatePurchaseGST({
        taxableAmount: new Decimal(100000),
        gstRate: 18,
        isInterState: false,
        isRCM: false
      })
      
      expect(result.cgst.toNumber()).toBe(9000)
      expect(result.sgst.toNumber()).toBe(9000)
      expect(result.igst.toNumber()).toBe(0)
      expect(result.totalGST.toNumber()).toBe(18000)
      expect(result.totalAmount.toNumber()).toBe(118000)
    })
    
    it('should calculate GST for inter-state purchase', () => {
      const result = calculatePurchaseGST({
        taxableAmount: new Decimal(100000),
        gstRate: 12,
        isInterState: true,
        isRCM: false
      })
      
      expect(result.cgst.toNumber()).toBe(0)
      expect(result.sgst.toNumber()).toBe(0)
      expect(result.igst.toNumber()).toBe(12000)
      expect(result.totalGST.toNumber()).toBe(12000)
      expect(result.totalAmount.toNumber()).toBe(112000)
    })
    
    it('should calculate RCM amount separately', () => {
      const result = calculatePurchaseGST({
        taxableAmount: new Decimal(50000),
        gstRate: 18,
        isInterState: false,
        isRCM: true,
        rcmPercent: 100
      })
      
      expect(result.rcmAmount.toNumber()).toBe(9000) // Full GST under RCM
      expect(result.payableToVendor.toNumber()).toBe(50000) // Only taxable amount
      expect(result.payableToGovt.toNumber()).toBe(9000) // RCM amount
    })
    
    it('should handle partial RCM', () => {
      const result = calculatePurchaseGST({
        taxableAmount: new Decimal(100000),
        gstRate: 18,
        isInterState: false,
        isRCM: true,
        rcmPercent: 50 // 50% under RCM
      })
      
      expect(result.vendorGST.toNumber()).toBe(9000) // 50% paid to vendor
      expect(result.rcmAmount.toNumber()).toBe(9000) // 50% under RCM
      expect(result.totalGST.toNumber()).toBe(18000)
      expect(result.payableToVendor.toNumber()).toBe(109000)
      expect(result.payableToGovt.toNumber()).toBe(9000)
    })
  })
  
  describe('ITC Eligibility Check for Invoice', () => {
    it('should allow full ITC for eligible purchases', async () => {
      const invoice = {
        id: 'inv-001',
        lineItems: [
          {
            description: 'Raw Materials',
            itcCategory: 'INPUTS',
            gstAmount: new Decimal(10000)
          },
          {
            description: 'Packing Materials',
            itcCategory: 'INPUTS',
            gstAmount: new Decimal(5000)
          }
        ],
        vendorType: 'REGULAR',
        isValidInvoice: true,
        goodsReceived: true
      }
      
      const eligibility = await checkITCEligibilityForInvoice(invoice)
      
      expect(eligibility.totalEligibleITC.toNumber()).toBe(15000)
      expect(eligibility.totalBlockedITC.toNumber()).toBe(0)
      expect(eligibility.eligibilityPercentage).toBe(100)
    })
    
    it('should block ITC for ineligible categories', async () => {
      const invoice = {
        id: 'inv-002',
        lineItems: [
          {
            description: 'Office Supplies',
            itcCategory: 'INPUTS',
            gstAmount: new Decimal(5000)
          },
          {
            description: 'Food & Beverages',
            itcCategory: 'BLOCKED',
            blockedCategory: 'FOOD_BEVERAGE',
            gstAmount: new Decimal(2000)
          }
        ]
      }
      
      const eligibility = await checkITCEligibilityForInvoice(invoice)
      
      expect(eligibility.totalEligibleITC.toNumber()).toBe(5000)
      expect(eligibility.totalBlockedITC.toNumber()).toBe(2000)
      expect(eligibility.eligibilityPercentage).toBe(71.43) // 5000/7000 * 100
      expect(eligibility.blockedItems).toHaveLength(1)
      expect(eligibility.blockedItems[0].reason).toContain('Section 17(5)')
    })
    
    it('should handle proportionate ITC for common expenses', async () => {
      const invoice = {
        id: 'inv-003',
        lineItems: [
          {
            description: 'Common Area Electricity',
            itcCategory: 'INPUTS',
            gstAmount: new Decimal(10000),
            businessUsePercent: 70 // 70% business use
          }
        ]
      }
      
      const eligibility = await checkITCEligibilityForInvoice(invoice)
      
      expect(eligibility.totalEligibleITC.toNumber()).toBe(7000)
      expect(eligibility.totalBlockedITC.toNumber()).toBe(3000)
      expect(eligibility.reversalRequired.toNumber()).toBe(3000)
    })
  })
  
  describe('GSTR-2A/2B Matching', () => {
    it('should match invoice with GSTR-2A entry', async () => {
      const purchaseInvoice = {
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-06-15'),
        vendorGSTIN: '29AABCG1234D1ZA',
        taxableAmount: new Decimal(100000),
        cgstAmount: new Decimal(9000),
        sgstAmount: new Decimal(9000),
        igstAmount: new Decimal(0)
      }
      
      const gstr2aEntry = {
        supplierGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-06-15'),
        taxableValue: 100000,
        cgst: 9000,
        sgst: 9000,
        igst: 0
      }
      
      const matchResult = await matchWithGSTR2A(purchaseInvoice, gstr2aEntry)
      
      expect(matchResult.isMatched).toBe(true)
      expect(matchResult.matchScore).toBe(100)
      expect(matchResult.discrepancies).toHaveLength(0)
    })
    
    it('should identify tax amount mismatch', async () => {
      const purchaseInvoice = {
        invoiceNumber: 'INV-002',
        invoiceDate: new Date('2024-06-16'),
        vendorGSTIN: '29AABCG1234D1ZA',
        taxableAmount: new Decimal(100000),
        cgstAmount: new Decimal(9000),
        sgstAmount: new Decimal(9000)
      }
      
      const gstr2aEntry = {
        supplierGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV-002',
        invoiceDate: new Date('2024-06-16'),
        taxableValue: 100000,
        cgst: 8500, // Mismatch
        sgst: 8500  // Mismatch
      }
      
      const matchResult = await matchWithGSTR2A(purchaseInvoice, gstr2aEntry)
      
      expect(matchResult.isMatched).toBe(false)
      expect(matchResult.matchScore).toBeLessThan(100)
      expect(matchResult.discrepancies).toContain('CGST mismatch')
      expect(matchResult.discrepancies).toContain('SGST mismatch')
      expect(matchResult.cgstDifference).toBe(500)
      expect(matchResult.sgstDifference).toBe(500)
    })
    
    it('should identify missing invoice in GSTR-2A', async () => {
      const purchaseInvoices = [
        { invoiceNumber: 'INV-001', vendorGSTIN: '29AABCG1234D1ZA' },
        { invoiceNumber: 'INV-002', vendorGSTIN: '29AABCG1234D1ZA' },
        { invoiceNumber: 'INV-003', vendorGSTIN: '29AABCG1234D1ZA' }
      ]
      
      const gstr2aEntries = [
        { invoiceNumber: 'INV-001', supplierGSTIN: '29AABCG1234D1ZA' },
        { invoiceNumber: 'INV-003', supplierGSTIN: '29AABCG1234D1ZA' }
      ]
      
      const reconciliation = await reconcileInvoices(purchaseInvoices, gstr2aEntries)
      
      expect(reconciliation.matched).toHaveLength(2)
      expect(reconciliation.missingInGSTR2A).toHaveLength(1)
      expect(reconciliation.missingInGSTR2A[0].invoiceNumber).toBe('INV-002')
      expect(reconciliation.additionalInGSTR2A).toHaveLength(0)
    })
    
    it('should identify additional invoices in GSTR-2A', async () => {
      const purchaseInvoices = [
        { invoiceNumber: 'INV-001', vendorGSTIN: '29AABCG1234D1ZA' }
      ]
      
      const gstr2aEntries = [
        { invoiceNumber: 'INV-001', supplierGSTIN: '29AABCG1234D1ZA' },
        { invoiceNumber: 'INV-004', supplierGSTIN: '29AABCG1234D1ZA' }
      ]
      
      const reconciliation = await reconcileInvoices(purchaseInvoices, gstr2aEntries)
      
      expect(reconciliation.matched).toHaveLength(1)
      expect(reconciliation.missingInGSTR2A).toHaveLength(0)
      expect(reconciliation.additionalInGSTR2A).toHaveLength(1)
      expect(reconciliation.additionalInGSTR2A[0].invoiceNumber).toBe('INV-004')
    })
  })
  
  describe('ITC Register Management', () => {
    it('should maintain monthly ITC register', async () => {
      const monthlyRegister = await getITCRegister({
        period: '06-2024',
        userId: 'user-123'
      })
      
      expect(monthlyRegister.period).toBe('06-2024')
      expect(monthlyRegister.openingBalance.toNumber()).toBeGreaterThanOrEqual(0)
      expect(monthlyRegister.eligibleITC.toNumber()).toBeGreaterThanOrEqual(0)
      expect(monthlyRegister.claimedITC.toNumber()).toBeGreaterThanOrEqual(0)
      expect(monthlyRegister.reversedITC.toNumber()).toBeGreaterThanOrEqual(0)
      expect(monthlyRegister.closingBalance.toNumber()).toBeGreaterThanOrEqual(0)
    })
    
    it('should calculate ITC utilization', async () => {
      const utilization = await calculateITCUtilization({
        period: '06-2024',
        userId: 'user-123'
      })
      
      expect(utilization.availableITC.toNumber()).toBeGreaterThanOrEqual(0)
      expect(utilization.utilizedForCGST.toNumber()).toBeGreaterThanOrEqual(0)
      expect(utilization.utilizedForSGST.toNumber()).toBeGreaterThanOrEqual(0)
      expect(utilization.utilizedForIGST.toNumber()).toBeGreaterThanOrEqual(0)
      expect(utilization.unutilizedITC.toNumber()).toBeGreaterThanOrEqual(0)
    })
  })
})

// Helper functions for testing
async function getITCRegister(params: { period: string; userId: string }) {
  // Mock implementation
  return {
    period: params.period,
    openingBalance: new Decimal(50000),
    eligibleITC: new Decimal(100000),
    claimedITC: new Decimal(90000),
    reversedITC: new Decimal(5000),
    closingBalance: new Decimal(55000)
  }
}

async function calculateITCUtilization(params: { period: string; userId: string }) {
  // Mock implementation
  return {
    availableITC: new Decimal(100000),
    utilizedForCGST: new Decimal(30000),
    utilizedForSGST: new Decimal(30000),
    utilizedForIGST: new Decimal(20000),
    unutilizedITC: new Decimal(20000)
  }
}