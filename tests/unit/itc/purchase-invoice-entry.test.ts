import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'
import {
  createPurchaseInvoice,
  updatePurchaseInvoice,
  calculateGSTAmounts,
  validateInvoiceData,
  checkDuplicateInvoice,
  linkVendor,
  determineITCEligibility,
  getInvoicesByVendor,
  getInvoicesByPeriod,
  PurchaseInvoiceInput,
  PurchaseInvoiceCreateResult,
  GSTCalculationResult,
  ValidationResult,
  ITCEligibilityResult,
  DuplicateCheckResult,
  VendorLinkResult
} from '@/lib/itc/purchase-invoice-entry'

describe('Purchase Invoice Entry - TDD Implementation', () => {
  const testUserId = 'test-user-id'
  const testVendorId = 'test-vendor-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // RED PHASE - Write failing tests first
  describe('Purchase Invoice Creation (RED Phase)', () => {
    it('should fail to create invoice without required fields', async () => {
      const invalidInput = {} as PurchaseInvoiceInput

      await expect(createPurchaseInvoice(invalidInput, testUserId))
        .rejects.toThrow('Invoice number is required')
    })

    it('should fail to create invoice with future date', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)

      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV001',
        invoiceDate: futureDate,
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '1234',
          quantity: new Decimal(1),
          rate: new Decimal(100),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      await expect(createPurchaseInvoice(input, testUserId))
        .rejects.toThrow('Invoice date cannot be in the future')
    })

    it('should fail to create invoice without line items', async () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: []
      }

      await expect(createPurchaseInvoice(input, testUserId))
        .rejects.toThrow('At least one line item is required')
    })

    it('should fail with invalid GST rate', async () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '1234',
          quantity: new Decimal(1),
          rate: new Decimal(100),
          gstRate: 13, // Invalid GST rate
          itcCategory: 'INPUTS'
        }]
      }

      await expect(createPurchaseInvoice(input, testUserId))
        .rejects.toThrow('Invalid GST rate. Must be one of: 0, 5, 12, 18, 28')
    })

    it('should fail with invalid HSN code (too short)', async () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '123', // Too short
          quantity: new Decimal(1),
          rate: new Decimal(100),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      await expect(createPurchaseInvoice(input, testUserId))
        .rejects.toThrow('HSN code must be at least 4 digits for goods')
    })
  })

  describe('GST Amount Calculation (RED Phase)', () => {
    it('should calculate CGST+SGST for intra-state transaction', () => {
      const result = calculateGSTAmounts({
        taxableAmount: new Decimal(1000),
        gstRate: 18,
        isInterState: false,
        cessRate: 0
      })

      expect(result.cgstAmount).toEqual(new Decimal(90))
      expect(result.sgstAmount).toEqual(new Decimal(90))
      expect(result.igstAmount).toEqual(new Decimal(0))
      expect(result.totalGSTAmount).toEqual(new Decimal(180))
      expect(result.totalAmount).toEqual(new Decimal(1180))
    })

    it('should calculate IGST for inter-state transaction', () => {
      const result = calculateGSTAmounts({
        taxableAmount: new Decimal(1000),
        gstRate: 18,
        isInterState: true,
        cessRate: 0
      })

      expect(result.cgstAmount).toEqual(new Decimal(0))
      expect(result.sgstAmount).toEqual(new Decimal(0))
      expect(result.igstAmount).toEqual(new Decimal(180))
      expect(result.totalGSTAmount).toEqual(new Decimal(180))
      expect(result.totalAmount).toEqual(new Decimal(1180))
    })

    it('should calculate cess amount when applicable', () => {
      const result = calculateGSTAmounts({
        taxableAmount: new Decimal(1000),
        gstRate: 28,
        isInterState: false,
        cessRate: 15 // Luxury goods cess
      })

      expect(result.cessAmount).toEqual(new Decimal(150))
      expect(result.totalGSTAmount).toEqual(new Decimal(280))
      expect(result.totalAmount).toEqual(new Decimal(1430)) // 1000 + 280 + 150
    })

    it('should handle zero GST rate correctly', () => {
      const result = calculateGSTAmounts({
        taxableAmount: new Decimal(1000),
        gstRate: 0,
        isInterState: false,
        cessRate: 0
      })

      expect(result.cgstAmount).toEqual(new Decimal(0))
      expect(result.sgstAmount).toEqual(new Decimal(0))
      expect(result.igstAmount).toEqual(new Decimal(0))
      expect(result.totalGSTAmount).toEqual(new Decimal(0))
      expect(result.totalAmount).toEqual(new Decimal(1000))
    })
  })

  describe('Invoice Data Validation (RED Phase)', () => {
    it('should validate all required fields', () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '1234',
          quantity: new Decimal(1),
          rate: new Decimal(100),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      const result = validateInvoiceData(input)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation for missing invoice number', () => {
      const input = {
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: []
      } as PurchaseInvoiceInput

      const result = validateInvoiceData(input)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invoice number is required')
    })

    it('should fail validation for invalid state codes', () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '99', // Invalid state code
        billToStateCode: '29',
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '1234',
          quantity: new Decimal(1),
          rate: new Decimal(100),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      const result = validateInvoiceData(input)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid place of supply state code')
    })

    it('should fail validation for zero or negative quantities', () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '1234',
          quantity: new Decimal(0), // Invalid quantity
          rate: new Decimal(100),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      const result = validateInvoiceData(input)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Quantity must be greater than zero')
    })
  })

  describe('Duplicate Invoice Prevention (RED Phase)', () => {
    it('should detect duplicate invoice number for same vendor', async () => {
      const result = await checkDuplicateInvoice({
        invoiceNumber: 'INV001',
        vendorId: testVendorId,
        userId: testUserId
      })

      expect(result.isDuplicate).toBe(true)
      expect(result.existingInvoiceId).toBeDefined()
      expect(result.message).toContain('Invoice number INV001 already exists for this vendor')
    })

    it('should allow same invoice number for different vendors', async () => {
      const result = await checkDuplicateInvoice({
        invoiceNumber: 'INV001',
        vendorId: 'different-vendor-id',
        userId: testUserId
      })

      expect(result.isDuplicate).toBe(false)
      expect(result.existingInvoiceId).toBeNull()
    })

    it('should allow new invoice number for same vendor', async () => {
      const result = await checkDuplicateInvoice({
        invoiceNumber: 'INV999',
        vendorId: testVendorId,
        userId: testUserId
      })

      expect(result.isDuplicate).toBe(false)
      expect(result.existingInvoiceId).toBeNull()
    })
  })

  describe('Vendor Linking and Validation (RED Phase)', () => {
    it('should successfully link valid vendor', async () => {
      const result = await linkVendor({
        vendorId: testVendorId,
        userId: testUserId
      })

      expect(result.isValid).toBe(true)
      expect(result.vendor).toBeDefined()
      expect(result.vendor?.id).toBe(testVendorId)
      expect(result.canClaimITC).toBe(true)
    })

    it('should fail to link non-existent vendor', async () => {
      const result = await linkVendor({
        vendorId: 'non-existent-vendor',
        userId: testUserId
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Vendor not found')
      expect(result.vendor).toBeNull()
    })

    it('should fail to link inactive vendor', async () => {
      const result = await linkVendor({
        vendorId: 'inactive-vendor-id',
        userId: testUserId
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Vendor is inactive')
      expect(result.canClaimITC).toBe(false)
    })

    it('should identify composition dealer restrictions', async () => {
      const result = await linkVendor({
        vendorId: 'composition-vendor-id',
        userId: testUserId
      })

      expect(result.isValid).toBe(true)
      expect(result.canClaimITC).toBe(false)
      expect(result.restrictions).toContain('No ITC on purchases from composition dealers')
    })
  })

  describe('ITC Eligibility Determination (RED Phase)', () => {
    it('should determine ITC eligibility for input purchases', () => {
      const result = determineITCEligibility({
        itcCategory: 'INPUTS',
        gstAmount: new Decimal(180),
        isBusinessUse: true,
        businessUsePercentage: 100,
        vendorType: 'REGULAR'
      })

      expect(result.isEligible).toBe(true)
      expect(result.eligibleAmount).toEqual(new Decimal(180))
      expect(result.blockedAmount).toEqual(new Decimal(0))
      expect(result.category).toBe('INPUTS')
    })

    it('should block ITC for restricted items (motor vehicles)', () => {
      const result = determineITCEligibility({
        itcCategory: 'BLOCKED',
        blockedReason: 'MOTOR_VEHICLE',
        gstAmount: new Decimal(180),
        isBusinessUse: true,
        businessUsePercentage: 100,
        vendorType: 'REGULAR'
      })

      expect(result.isEligible).toBe(false)
      expect(result.eligibleAmount).toEqual(new Decimal(0))
      expect(result.blockedAmount).toEqual(new Decimal(180))
      expect(result.blockedReason).toBe('Section 17(5) - Motor vehicles')
    })

    it('should calculate proportionate ITC for common expenses', () => {
      const result = determineITCEligibility({
        itcCategory: 'INPUT_SERVICES',
        gstAmount: new Decimal(180),
        isBusinessUse: true,
        businessUsePercentage: 60, // 60% business use
        vendorType: 'REGULAR'
      })

      expect(result.isEligible).toBe(true)
      expect(result.eligibleAmount).toEqual(new Decimal(108)) // 60% of 180
      expect(result.blockedAmount).toEqual(new Decimal(72)) // 40% blocked
      expect(result.reversalRequired).toBe(true)
    })

    it('should block all ITC for composition dealer purchases', () => {
      const result = determineITCEligibility({
        itcCategory: 'INPUTS',
        gstAmount: new Decimal(180),
        isBusinessUse: true,
        businessUsePercentage: 100,
        vendorType: 'COMPOSITION'
      })

      expect(result.isEligible).toBe(false)
      expect(result.eligibleAmount).toEqual(new Decimal(0))
      expect(result.blockedAmount).toEqual(new Decimal(180))
      expect(result.blockedReason).toBe('Composition dealer - No ITC available')
    })

    it('should handle capital goods ITC correctly', () => {
      const result = determineITCEligibility({
        itcCategory: 'CAPITAL_GOODS',
        gstAmount: new Decimal(900), // Higher amount for capital goods
        isBusinessUse: true,
        businessUsePercentage: 100,
        vendorType: 'REGULAR'
      })

      expect(result.isEligible).toBe(true)
      expect(result.eligibleAmount).toEqual(new Decimal(900))
      expect(result.category).toBe('CAPITAL_GOODS')
      expect(result.reversalConditions).toContain('Reversal required if sold within 5 years')
    })
  })

  describe('Invoice Querying (RED Phase)', () => {
    it('should get invoices by vendor', async () => {
      const result = await getInvoicesByVendor({
        vendorId: testVendorId,
        userId: testUserId,
        limit: 10,
        offset: 0
      })

      expect(result.invoices).toBeDefined()
      expect(result.total).toBeGreaterThan(0)
      expect(result.invoices).toHaveLength(result.total)
    })

    it('should get invoices by date period', async () => {
      const startDate = new Date('2024-04-01')
      const endDate = new Date('2024-04-30')

      const result = await getInvoicesByPeriod({
        startDate,
        endDate,
        userId: testUserId,
        limit: 10,
        offset: 0
      })

      expect(result.invoices).toBeDefined()
      expect(result.total).toBeGreaterThanOrEqual(0)
      
      // All invoices should be within the period
      result.invoices.forEach(invoice => {
        expect(invoice.invoiceDate).toBeInstanceOf(Date)
        expect(invoice.invoiceDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime())
        expect(invoice.invoiceDate.getTime()).toBeLessThanOrEqual(endDate.getTime())
      })
    })

    it('should filter invoices by ITC eligibility', async () => {
      const result = await getInvoicesByPeriod({
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-04-30'),
        userId: testUserId,
        filters: {
          itcEligible: true
        },
        limit: 10,
        offset: 0
      })

      expect(result.invoices).toBeDefined()
      result.invoices.forEach(invoice => {
        expect(invoice.itcEligible).toBe(true)
      })
    })
  })

  describe('Invoice Update (RED Phase)', () => {
    it('should update invoice line items', async () => {
      const updateData = {
        lineItems: [{
          description: 'Updated Item',
          hsnSacCode: '5678',
          quantity: new Decimal(2),
          rate: new Decimal(150),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      const result = await updatePurchaseInvoice('test-invoice-id', updateData, testUserId)

      expect(result.success).toBe(true)
      expect(result.invoice).toBeDefined()
      expect(result.invoice.lineItems).toHaveLength(1)
      expect(result.invoice.lineItems[0].description).toBe('Updated Item')
    })

    it('should recalculate GST amounts on update', async () => {
      const updateData = {
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '1234',
          quantity: new Decimal(1),
          rate: new Decimal(200), // Changed rate
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      const result = await updatePurchaseInvoice('test-invoice-id', updateData, testUserId)

      expect(result.success).toBe(true)
      expect(result.invoice.taxableAmount).toEqual(new Decimal(200))
      expect(result.invoice.totalGSTAmount).toEqual(new Decimal(36))
      expect(result.invoice.totalAmount).toEqual(new Decimal(236))
    })

    it('should fail to update non-existent invoice', async () => {
      const updateData = {
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '1234',
          quantity: new Decimal(1),
          rate: new Decimal(100),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      await expect(updatePurchaseInvoice('non-existent-id', updateData, testUserId))
        .rejects.toThrow('Invoice not found')
    })
  })

  describe('Total Amount Calculations (RED Phase)', () => {
    it('should calculate total amounts correctly for multiple line items', async () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV002',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [
          {
            description: 'Item 1',
            hsnSacCode: '1234',
            quantity: new Decimal(2),
            rate: new Decimal(100),
            gstRate: 18,
            itcCategory: 'INPUTS'
          },
          {
            description: 'Item 2',
            hsnSacCode: '5678',
            quantity: new Decimal(1),
            rate: new Decimal(500),
            gstRate: 12,
            itcCategory: 'CAPITAL_GOODS'
          }
        ]
      }

      const result = await createPurchaseInvoice(input, testUserId)

      expect(result.success).toBe(true)
      expect(result.invoice.taxableAmount).toEqual(new Decimal(700)) // 200 + 500
      expect(result.invoice.totalGSTAmount).toEqual(new Decimal(96)) // 36 + 60
      expect(result.invoice.totalAmount).toEqual(new Decimal(796)) // 700 + 96
    })
  })

  describe('Document Attachment Support (RED Phase)', () => {
    it('should support document attachment URLs', async () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV003',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        documentUrl: 'https://example.com/invoice.pdf',
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '1234',
          quantity: new Decimal(1),
          rate: new Decimal(100),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      const result = await createPurchaseInvoice(input, testUserId)

      expect(result.success).toBe(true)
      expect(result.invoice.documentUrl).toBe('https://example.com/invoice.pdf')
    })

    it('should validate document URL format', async () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV004',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        documentUrl: 'invalid-url',
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '1234',
          quantity: new Decimal(1),
          rate: new Decimal(100),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      await expect(createPurchaseInvoice(input, testUserId))
        .rejects.toThrow('Invalid document URL format')
    })
  })

  describe('Compliance Validation (RED Phase)', () => {
    it('should validate all required fields for GST compliance', () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV005',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '1234',
          quantity: new Decimal(1),
          rate: new Decimal(100),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      const result = validateInvoiceData(input)
      expect(result.isValid).toBe(true)
      expect(result.complianceChecks.hasRequiredFields).toBe(true)
      expect(result.complianceChecks.hasValidHSNCodes).toBe(true)
      expect(result.complianceChecks.hasValidGSTRates).toBe(true)
    })

    it('should fail compliance for missing HSN codes', () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV006',
        invoiceDate: new Date(),
        vendorId: testVendorId,
        placeOfSupply: '29',
        billToStateCode: '29',
        lineItems: [{
          description: 'Test Item',
          hsnSacCode: '', // Missing HSN
          quantity: new Decimal(1),
          rate: new Decimal(100),
          gstRate: 18,
          itcCategory: 'INPUTS'
        }]
      }

      const result = validateInvoiceData(input)
      expect(result.isValid).toBe(false)
      expect(result.complianceChecks.hasValidHSNCodes).toBe(false)
      expect(result.errors).toContain('HSN/SAC code is required for all line items')
    })
  })

  describe('Reverse Charge Mechanism (RED Phase)', () => {
    it('should handle reverse charge mechanism correctly', async () => {
      const input: PurchaseInvoiceInput = {
        invoiceNumber: 'INV007',
        invoiceDate: new Date(),
        vendorId: 'unregistered-vendor-id',
        placeOfSupply: '29',
        billToStateCode: '29',
        isReverseCharge: true,
        lineItems: [{
          description: 'Legal Services',
          hsnSacCode: '998314',
          quantity: new Decimal(1),
          rate: new Decimal(10000),
          gstRate: 18,
          itcCategory: 'INPUT_SERVICES'
        }]
      }

      const result = await createPurchaseInvoice(input, testUserId)

      expect(result.success).toBe(true)
      expect(result.invoice.isReverseCharge).toBe(true)
      expect(result.invoice.rcmAmount).toEqual(new Decimal(1800))
      expect(result.invoice.payableToVendor).toEqual(new Decimal(10000)) // No GST to vendor
      expect(result.invoice.payableToGovernment).toEqual(new Decimal(1800)) // RCM GST
    })
  })
})