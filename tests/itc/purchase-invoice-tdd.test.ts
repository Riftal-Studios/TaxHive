import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createPurchaseInvoice,
  updatePurchaseInvoice,
  deletePurchaseInvoice,
  validatePurchaseInvoice,
  calculateITCForInvoice,
  processBulkPurchaseImport,
  matchInvoiceWithGSTR2A,
  getPurchaseInvoiceById,
  getPurchaseInvoices,
  PurchaseInvoiceInput,
  PurchaseInvoiceValidationResult,
  BulkImportResult,
  GSTR2AMatchResult
} from '@/lib/itc/purchase-invoice'

// Mock Prisma
const mockPrisma = {
  vendor: {
    findFirst: vi.fn(),
  },
  purchaseInvoice: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  purchaseLineItem: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  iTCRegister: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

describe('Purchase Invoice Management - TDD Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Purchase Invoice Validation (RED Phase)', () => {
    it('should validate complete purchase invoice data', () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-1',
        invoiceNumber: 'PUR/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 0,
        cgstAmount: 9000,
        sgstAmount: 9000,
        igstAmount: 0,
        totalGSTAmount: 18000,
        totalAmount: 118000,
        placeOfSupply: '29',
        itcCategory: 'INPUTS',
        itcEligible: true,
        lineItems: [
          {
            description: 'Raw Materials',
            hsnSacCode: '39269099',
            quantity: 100,
            rate: 1000,
            amount: 100000,
            gstRate: 18,
            cgstAmount: 9000,
            sgstAmount: 9000,
            igstAmount: 0,
          }
        ]
      }

      const validation = validatePurchaseInvoice(invoiceData)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(validation.warnings).toHaveLength(0)
    })

    it('should reject invoice with invalid vendor ID', () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: '', // Invalid empty vendor ID
        invoiceNumber: 'PUR/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        cgstAmount: 9000,
        sgstAmount: 9000,
        totalAmount: 118000,
        lineItems: []
      }

      const validation = validatePurchaseInvoice(invoiceData)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Vendor ID is required')
    })

    it('should reject invoice with future date', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)

      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-1',
        invoiceNumber: 'PUR/2024/001',
        invoiceDate: futureDate,
        taxableAmount: 100000,
        lineItems: []
      }

      const validation = validatePurchaseInvoice(invoiceData)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Invoice date cannot be in the future')
    })

    it('should reject invoice with mismatched GST calculations', () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-1',
        invoiceNumber: 'PUR/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        cgstRate: 9,
        sgstRate: 9,
        cgstAmount: 8000, // Should be 9000
        sgstAmount: 9000,
        totalGSTAmount: 17000, // Incorrect total
        totalAmount: 117000,
        lineItems: []
      }

      const validation = validatePurchaseInvoice(invoiceData)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('CGST amount does not match calculated amount')
      expect(validation.errors).toContain('Total GST amount does not match sum of tax components')
    })

    it('should validate HSN/SAC codes format', () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-1',
        invoiceNumber: 'PUR/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        lineItems: [
          {
            description: 'Invalid HSN Item',
            hsnSacCode: 'INVALID', // Invalid HSN format
            quantity: 1,
            rate: 100000,
            amount: 100000,
            gstRate: 18,
          }
        ]
      }

      const validation = validatePurchaseInvoice(invoiceData)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Invalid HSN/SAC code format: INVALID')
    })

    it('should warn about high-value transactions', () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-1',
        invoiceNumber: 'PUR/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 25000000, // 25 Lakhs - high value
        totalAmount: 29500000,
        lineItems: []
      }

      const validation = validatePurchaseInvoice(invoiceData)

      expect(validation.warnings).toContain('High value transaction (>20L) - additional verification may be required')
    })

    it('should validate line item consistency', () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-1',
        invoiceNumber: 'PUR/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        lineItems: [
          {
            description: 'Item 1',
            hsnSacCode: '39269099',
            quantity: 100,
            rate: 500, // 100 * 500 = 50000
            amount: 60000, // Inconsistent with qty * rate
            gstRate: 18,
          }
        ]
      }

      const validation = validatePurchaseInvoice(invoiceData)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Line item amount does not match quantity × rate')
    })
  })

  describe('Purchase Invoice Creation (RED Phase)', () => {
    it('should create purchase invoice with automatic ITC calculation', async () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-1',
        invoiceNumber: 'PUR/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        cgstRate: 9,
        sgstRate: 9,
        cgstAmount: 9000,
        sgstAmount: 9000,
        totalGSTAmount: 18000,
        totalAmount: 118000,
        itcCategory: 'INPUTS',
        itcEligible: true,
        lineItems: [
          {
            description: 'Raw Materials',
            hsnSacCode: '39269099',
            quantity: 100,
            rate: 1000,
            amount: 100000,
            gstRate: 18,
            cgstAmount: 9000,
            sgstAmount: 9000,
          }
        ]
      }

      const mockVendor = {
        id: 'vendor-1',
        name: 'Test Vendor',
        gstin: '29AABCG1234D1ZA',
        stateCode: '29',
        isRegistered: true,
        vendorType: 'REGULAR'
      }

      const mockCreatedInvoice = {
        id: 'invoice-1',
        ...invoiceData,
        itcClaimed: 18000, // Full ITC eligible
        itcReversed: 0,
        userId: 'user-1',
        vendor: mockVendor,
        lineItems: invoiceData.lineItems,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.vendor.findFirst.mockResolvedValue(mockVendor)
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.purchaseInvoice.create.mockResolvedValue(mockCreatedInvoice)

      const invoice = await createPurchaseInvoice(invoiceData, 'user-1')

      expect(invoice.id).toBe('invoice-1')
      expect(invoice.itcClaimed).toBe(18000)
      expect(invoice.itcEligible).toBe(true)
      expect(invoice.vendor.name).toBe('Test Vendor')
      
      // Verify ITC register update was called
      expect(mockPrisma.iTCRegister.findUnique).toHaveBeenCalled()
    })

    it('should reject duplicate invoice number for same vendor', async () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-1',
        invoiceNumber: 'PUR/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        lineItems: []
      }

      mockPrisma.vendor.findFirst.mockResolvedValue({ id: 'vendor-1' })
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({ id: 'existing-invoice' })

      await expect(createPurchaseInvoice(invoiceData, 'user-1'))
        .rejects.toThrow('Invoice PUR/2024/001 already exists for this vendor')
    })

    it('should handle inter-state purchase (IGST)', async () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-1',
        invoiceNumber: 'PUR/2024/002',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        igstRate: 18,
        igstAmount: 18000,
        totalGSTAmount: 18000,
        totalAmount: 118000,
        placeOfSupply: '07', // Different state
        itcCategory: 'INPUTS',
        itcEligible: true,
        lineItems: []
      }

      const mockVendor = {
        id: 'vendor-1',
        stateCode: '07' // Delhi vendor, different from business state
      }

      const mockCreatedInvoice = {
        id: 'invoice-2',
        ...invoiceData,
        itcClaimed: 18000,
        userId: 'user-1',
      }

      mockPrisma.vendor.findFirst.mockResolvedValue(mockVendor)
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(null)
      mockPrisma.purchaseInvoice.create.mockResolvedValue(mockCreatedInvoice)

      const invoice = await createPurchaseInvoice(invoiceData, 'user-1')

      expect(invoice.igstAmount).toBe(18000)
      expect(invoice.cgstAmount).toBe(0)
      expect(invoice.sgstAmount).toBe(0)
      expect(invoice.placeOfSupply).toBe('07')
    })

    it('should block ITC for purchases from composition dealers', async () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-composition',
        invoiceNumber: 'COMP/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        cgstAmount: 500, // Composition rate
        sgstAmount: 500,
        totalGSTAmount: 1000,
        totalAmount: 101000,
        lineItems: []
      }

      const mockCompositionVendor = {
        id: 'vendor-composition',
        vendorType: 'COMPOSITION',
        isRegistered: true,
      }

      const mockCreatedInvoice = {
        id: 'invoice-comp',
        ...invoiceData,
        itcEligible: false, // No ITC on composition purchases
        itcClaimed: 0,
        itcCategory: 'BLOCKED',
        userId: 'user-1',
      }

      mockPrisma.vendor.findFirst.mockResolvedValue(mockCompositionVendor)
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(null)
      mockPrisma.purchaseInvoice.create.mockResolvedValue(mockCreatedInvoice)

      const invoice = await createPurchaseInvoice(invoiceData, 'user-1')

      expect(invoice.itcEligible).toBe(false)
      expect(invoice.itcClaimed).toBe(0)
      expect(invoice.itcCategory).toBe('BLOCKED')
    })

    it('should handle RCM invoices for unregistered vendors', async () => {
      const invoiceData: PurchaseInvoiceInput = {
        vendorId: 'vendor-unregistered',
        invoiceNumber: 'RCM/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        cgstAmount: 9000, // RCM paid by purchaser
        sgstAmount: 9000,
        totalGSTAmount: 18000,
        totalAmount: 100000, // No GST added to invoice amount
        isRCM: true,
        lineItems: []
      }

      const mockUnregisteredVendor = {
        id: 'vendor-unregistered',
        vendorType: 'UNREGISTERED',
        isRegistered: false,
      }

      const mockCreatedInvoice = {
        id: 'invoice-rcm',
        ...invoiceData,
        itcEligible: true, // RCM allows ITC
        itcClaimed: 18000,
        userId: 'user-1',
      }

      mockPrisma.vendor.findFirst.mockResolvedValue(mockUnregisteredVendor)
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(null)
      mockPrisma.purchaseInvoice.create.mockResolvedValue(mockCreatedInvoice)

      const invoice = await createPurchaseInvoice(invoiceData, 'user-1')

      expect(invoice.isRCM).toBe(true)
      expect(invoice.itcEligible).toBe(true)
      expect(invoice.totalAmount).toBe(100000) // No GST added to invoice total
    })
  })

  describe('ITC Calculation for Purchase Invoices (RED Phase)', () => {
    it('should calculate full ITC for eligible inputs', () => {
      const invoiceData = {
        taxableAmount: 100000,
        cgstAmount: 9000,
        sgstAmount: 9000,
        igstAmount: 0,
        cessAmount: 0,
        vendor: { vendorType: 'REGULAR', isRegistered: true },
        itcCategory: 'INPUTS',
        lineItems: [
          {
            description: 'Raw Materials',
            hsnSacCode: '39269099',
            gstRate: 18
          }
        ]
      }

      const itcCalculation = calculateITCForInvoice(invoiceData)

      expect(itcCalculation.totalGST).toBe(18000)
      expect(itcCalculation.eligibleITC).toBe(18000)
      expect(itcCalculation.blockedITC).toBe(0)
      expect(itcCalculation.category).toBe('INPUTS')
      expect(itcCalculation.isEligible).toBe(true)
    })

    it('should block ITC for motor vehicle purchases', () => {
      const invoiceData = {
        taxableAmount: 500000,
        cgstAmount: 45000,
        sgstAmount: 45000,
        vendor: { vendorType: 'REGULAR', isRegistered: true },
        itcCategory: 'BLOCKED',
        lineItems: [
          {
            description: 'Company Car',
            hsnSacCode: '87032310', // Motor vehicle HSN
            gstRate: 18
          }
        ]
      }

      const itcCalculation = calculateITCForInvoice(invoiceData)

      expect(itcCalculation.totalGST).toBe(90000)
      expect(itcCalculation.eligibleITC).toBe(0)
      expect(itcCalculation.blockedITC).toBe(90000)
      expect(itcCalculation.blockReason).toContain('Motor vehicle')
      expect(itcCalculation.isEligible).toBe(false)
    })

    it('should calculate partial ITC for capital goods', () => {
      const invoiceData = {
        taxableAmount: 1000000,
        cgstAmount: 90000,
        sgstAmount: 90000,
        vendor: { vendorType: 'REGULAR', isRegistered: true },
        itcCategory: 'CAPITAL_GOODS',
        assetLife: 5,
        businessUsePercentage: 80,
        lineItems: [
          {
            description: 'Machinery',
            hsnSacCode: '84212990',
            gstRate: 18
          }
        ]
      }

      const itcCalculation = calculateITCForInvoice(invoiceData)

      expect(itcCalculation.totalGST).toBe(180000)
      expect(itcCalculation.eligibleITC).toBe(144000) // 80% of 180000
      expect(itcCalculation.blockedITC).toBe(36000) // 20% personal use
      expect(itcCalculation.category).toBe('CAPITAL_GOODS')
    })

    it('should handle mixed line items with different ITC eligibility', () => {
      const invoiceData = {
        taxableAmount: 200000,
        cgstAmount: 18000,
        sgstAmount: 18000,
        vendor: { vendorType: 'REGULAR', isRegistered: true },
        lineItems: [
          {
            description: 'Raw Materials',
            hsnSacCode: '39269099',
            amount: 100000,
            gstRate: 18,
            itcEligible: true
          },
          {
            description: 'Employee Food',
            hsnSacCode: '21069099',
            amount: 100000,
            gstRate: 18,
            itcEligible: false // Blocked under Section 17(5)
          }
        ]
      }

      const itcCalculation = calculateITCForInvoice(invoiceData)

      expect(itcCalculation.totalGST).toBe(36000)
      expect(itcCalculation.eligibleITC).toBe(18000) // Only 50% eligible
      expect(itcCalculation.blockedITC).toBe(18000)
      expect(itcCalculation.blockingDetails).toHaveLength(1)
    })
  })

  describe('GSTR-2A Matching (RED Phase)', () => {
    it('should match invoice perfectly with GSTR-2A data', () => {
      const purchaseInvoice = {
        vendorGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        cgstAmount: 9000,
        sgstAmount: 9000,
        igstAmount: 0,
        totalGSTAmount: 18000
      }

      const gstr2aEntry = {
        supplierGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV/2024/001',
        invoiceDate: new Date('2024-04-15'),
        taxableValue: 100000,
        cgstAmount: 9000,
        sgstAmount: 9000,
        igstAmount: 0,
        totalTaxAmount: 18000
      }

      const matchResult = matchInvoiceWithGSTR2A(purchaseInvoice, gstr2aEntry)

      expect(matchResult.matchStatus).toBe('MATCHED')
      expect(matchResult.mismatches).toHaveLength(0)
      expect(matchResult.confidenceScore).toBe(1.0)
    })

    it('should identify amount mismatches with tolerance', () => {
      const purchaseInvoice = {
        vendorGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV/2024/002',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        cgstAmount: 9000,
        sgstAmount: 9000,
        totalGSTAmount: 18000
      }

      const gstr2aEntry = {
        supplierGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV/2024/002',
        invoiceDate: new Date('2024-04-15'),
        taxableValue: 100500, // ₹500 difference
        cgstAmount: 9045,
        sgstAmount: 9045,
        totalTaxAmount: 18090
      }

      const matchResult = matchInvoiceWithGSTR2A(purchaseInvoice, gstr2aEntry)

      expect(matchResult.matchStatus).toBe('MISMATCHED')
      expect(matchResult.mismatches).toContainEqual({
        field: 'taxableAmount',
        ourValue: 100000,
        gstr2aValue: 100500,
        difference: 500
      })
      expect(matchResult.confidenceScore).toBeLessThan(1.0)
    })

    it('should handle date mismatches within acceptable range', () => {
      const purchaseInvoice = {
        vendorGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV/2024/003',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        cgstAmount: 9000,
        sgstAmount: 9000,
      }

      const gstr2aEntry = {
        supplierGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV/2024/003',
        invoiceDate: new Date('2024-04-16'), // 1 day difference
        taxableValue: 100000,
        cgstAmount: 9000,
        sgstAmount: 9000,
      }

      const matchResult = matchInvoiceWithGSTR2A(purchaseInvoice, gstr2aEntry)

      expect(matchResult.matchStatus).toBe('MATCHED') // Within tolerance
      expect(matchResult.warnings).toContain('Date difference within acceptable range')
    })

    it('should identify completely mismatched invoices', () => {
      const purchaseInvoice = {
        vendorGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV/2024/004',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
        cgstAmount: 9000,
        sgstAmount: 9000,
      }

      const gstr2aEntry = {
        supplierGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV/2024/999', // Different invoice number
        invoiceDate: new Date('2024-05-15'), // Different month
        taxableValue: 50000, // Different amount
        cgstAmount: 4500,
        sgstAmount: 4500,
      }

      const matchResult = matchInvoiceWithGSTR2A(purchaseInvoice, gstr2aEntry)

      expect(matchResult.matchStatus).toBe('NOT_MATCHED')
      expect(matchResult.confidenceScore).toBe(0)
    })

    it('should handle missing GSTR-2A entries', () => {
      const purchaseInvoice = {
        vendorGSTIN: '29AABCG1234D1ZA',
        invoiceNumber: 'INV/2024/005',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 100000,
      }

      const matchResult = matchInvoiceWithGSTR2A(purchaseInvoice, null)

      expect(matchResult.matchStatus).toBe('NOT_AVAILABLE')
      expect(matchResult.action).toBe('FOLLOW_UP_WITH_VENDOR')
    })
  })

  describe('Bulk Purchase Import (RED Phase)', () => {
    it('should process valid CSV import successfully', async () => {
      const csvData = `
Vendor GSTIN,Invoice Number,Invoice Date,Taxable Amount,CGST Amount,SGST Amount,IGST Amount,Description
29AABCG1234D1ZA,INV001,2024-04-15,100000,9000,9000,0,Raw Materials
29AABCG1234D1ZA,INV002,2024-04-16,50000,4500,4500,0,Office Supplies
      `.trim()

      const mockVendor = {
        id: 'vendor-1',
        gstin: '29AABCG1234D1ZA',
        vendorType: 'REGULAR',
        isRegistered: true
      }

      mockPrisma.vendor.findFirst.mockResolvedValue(mockVendor)
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(null)
      mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma))

      const result = await processBulkPurchaseImport({
        csvData,
        userId: 'user-1',
        validateOnly: false
      })

      expect(result.totalRecords).toBe(2)
      expect(result.successCount).toBe(2)
      expect(result.errorCount).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate CSV data without creating records', async () => {
      const csvData = `
Vendor GSTIN,Invoice Number,Invoice Date,Taxable Amount,CGST Amount,SGST Amount,IGST Amount,Description
INVALID_GSTIN,INV001,2024-04-15,100000,9000,9000,0,Raw Materials
29AABCG1234D1ZA,INV002,2024-13-40,50000,4500,4500,0,Office Supplies
      `.trim()

      const result = await processBulkPurchaseImport({
        csvData,
        userId: 'user-1',
        validateOnly: true
      })

      expect(result.totalRecords).toBe(2)
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBe(2)
      expect(result.errors).toContainEqual({
        row: 1,
        field: 'Vendor GSTIN',
        error: 'Invalid GSTIN format'
      })
      expect(result.errors).toContainEqual({
        row: 2,
        field: 'Invoice Date',
        error: 'Invalid date format'
      })
    })

    it('should handle duplicate invoices in bulk import', async () => {
      const csvData = `
Vendor GSTIN,Invoice Number,Invoice Date,Taxable Amount,CGST Amount,SGST Amount,IGST Amount,Description
29AABCG1234D1ZA,INV001,2024-04-15,100000,9000,9000,0,Raw Materials
29AABCG1234D1ZA,INV001,2024-04-15,100000,9000,9000,0,Duplicate Invoice
      `.trim()

      const result = await processBulkPurchaseImport({
        csvData,
        userId: 'user-1',
        validateOnly: true
      })

      expect(result.errorCount).toBe(1)
      expect(result.errors).toContainEqual({
        row: 2,
        field: 'Invoice Number',
        error: 'Duplicate invoice number INV001 in import data'
      })
    })

    it('should provide detailed progress reporting for large imports', async () => {
      const largeCsvData = Array.from({ length: 1000 }, (_, i) => 
        `29AABCG1234D1ZA,INV${String(i + 1).padStart(3, '0')},2024-04-15,100000,9000,9000,0,Item ${i + 1}`
      )

      const csvData = `Vendor GSTIN,Invoice Number,Invoice Date,Taxable Amount,CGST Amount,SGST Amount,IGST Amount,Description\n${largeCsvData.join('\n')}`

      const progressCallback = vi.fn()

      const result = await processBulkPurchaseImport({
        csvData,
        userId: 'user-1',
        validateOnly: true,
        onProgress: progressCallback
      })

      expect(progressCallback).toHaveBeenCalledWith({
        processed: expect.any(Number),
        total: 1000,
        percentage: expect.any(Number)
      })
    })
  })

  describe('Purchase Invoice Updates (RED Phase)', () => {
    it('should update invoice with ITC recalculation', async () => {
      const updateData = {
        invoiceId: 'invoice-1',
        taxableAmount: 120000, // Increased amount
        cgstAmount: 10800,
        sgstAmount: 10800,
        totalGSTAmount: 21600,
        totalAmount: 141600,
        itcCategory: 'CAPITAL_GOODS', // Changed category
      }

      const mockExistingInvoice = {
        id: 'invoice-1',
        taxableAmount: 100000,
        itcClaimed: 18000,
        userId: 'user-1',
      }

      const mockUpdatedInvoice = {
        ...mockExistingInvoice,
        ...updateData,
        itcClaimed: 21600, // Recalculated
      }

      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(mockExistingInvoice)
      mockPrisma.purchaseInvoice.update.mockResolvedValue(mockUpdatedInvoice)

      const updated = await updatePurchaseInvoice(updateData, 'user-1')

      expect(updated.taxableAmount).toBe(120000)
      expect(updated.itcClaimed).toBe(21600)
      expect(updated.itcCategory).toBe('CAPITAL_GOODS')
    })

    it('should handle ITC reversal when changing eligibility', async () => {
      const updateData = {
        invoiceId: 'invoice-1',
        itcEligible: false, // Changed from eligible to not eligible
        itcCategory: 'BLOCKED',
        reversalReason: 'Personal consumption identified'
      }

      const mockExistingInvoice = {
        id: 'invoice-1',
        itcClaimed: 18000,
        itcEligible: true,
        userId: 'user-1',
      }

      const mockUpdatedInvoice = {
        ...mockExistingInvoice,
        ...updateData,
        itcClaimed: 0,
        itcReversed: 18000,
      }

      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(mockExistingInvoice)
      mockPrisma.purchaseInvoice.update.mockResolvedValue(mockUpdatedInvoice)

      const updated = await updatePurchaseInvoice(updateData, 'user-1')

      expect(updated.itcEligible).toBe(false)
      expect(updated.itcClaimed).toBe(0)
      expect(updated.itcReversed).toBe(18000)
      expect(updated.reversalReason).toBe('Personal consumption identified')
    })
  })

  describe('Purchase Invoice Deletion (RED Phase)', () => {
    it('should delete invoice with ITC register adjustment', async () => {
      const invoiceId = 'invoice-1'

      const mockInvoice = {
        id: 'invoice-1',
        itcClaimed: 18000,
        invoiceDate: new Date('2024-04-15'),
        userId: 'user-1',
      }

      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(mockInvoice)
      mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma))

      const result = await deletePurchaseInvoice(invoiceId, 'user-1')

      expect(result.success).toBe(true)
      expect(result.reversedITC).toBe(18000)
      
      // Verify ITC register was updated
      expect(mockPrisma.iTCRegister.update).toHaveBeenCalled()
    })

    it('should prevent deletion of matched invoice', async () => {
      const invoiceId = 'invoice-matched'

      const mockMatchedInvoice = {
        id: 'invoice-matched',
        itcClaimed: 18000,
        matchStatus: 'MATCHED',
        gstr2aMatched: true,
        userId: 'user-1',
      }

      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(mockMatchedInvoice)

      await expect(deletePurchaseInvoice(invoiceId, 'user-1'))
        .rejects.toThrow('Cannot delete invoice that has been matched with GSTR-2A')
    })

    it('should require confirmation for high-value invoice deletion', async () => {
      const invoiceId = 'invoice-high-value'

      const mockHighValueInvoice = {
        id: 'invoice-high-value',
        taxableAmount: 1000000, // 10 Lakhs
        itcClaimed: 180000,
        userId: 'user-1',
      }

      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(mockHighValueInvoice)

      await expect(deletePurchaseInvoice(invoiceId, 'user-1', false)) // No confirmation
        .rejects.toThrow('High value invoice deletion requires confirmation')
    })
  })
})

// Type declarations for TDD - these will fail initially (RED phase)
declare function searchVendors(params: any): Promise<any[]>