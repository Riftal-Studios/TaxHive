import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  validateVendorGSTIN,
  validateVendorPAN,
  createVendor,
  updateVendor,
  getVendorITCSummary,
  classifyVendor,
  searchVendors,
  VendorInput,
  VendorClassification,
  VendorITCSummary,
  GSTINValidationResult,
  PANValidationResult
} from '@/lib/itc/vendor-management'

// Mock Prisma for unit testing
const mockPrisma = {
  vendor: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  purchaseInvoice: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
} as unknown as PrismaClient

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

describe('Vendor Management - TDD Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GSTIN Validation (RED Phase)', () => {
    it('should validate correct GSTIN format and extract details', () => {
      const result = validateVendorGSTIN('29AABCG1234D1ZA')
      
      expect(result.isValid).toBe(true)
      expect(result.stateCode).toBe('29')
      expect(result.stateName).toBe('Karnataka')
      expect(result.pan).toBe('AABCG1234D')
      expect(result.checksum).toBe('A')
      expect(result.entityType).toBe('COMPANY') // 'C' at index 5 indicates company
    })

    it('should reject invalid GSTIN format', () => {
      const result = validateVendorGSTIN('INVALID_GSTIN')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid GSTIN format')
      expect(result.stateCode).toBeUndefined()
      expect(result.pan).toBeUndefined()
    })

    it('should reject GSTIN with invalid state code', () => {
      const result = validateVendorGSTIN('99AABCG1234D1ZA')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid state code: 99')
    })

    it('should validate GSTIN checksum using modulo 36 algorithm', () => {
      // This GSTIN has an invalid checksum
      const result = validateVendorGSTIN('29AABCG1234D1ZZ')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid checksum')
    })

    it('should identify different entity types from GSTIN', () => {
      // Company GSTIN
      const companyResult = validateVendorGSTIN('29AABCG1234D1ZA')
      expect(companyResult.entityType).toBe('COMPANY')
      
      // Individual GSTIN  
      const individualResult = validateVendorGSTIN('29ABCDE1234F1ZA')
      expect(individualResult.entityType).toBe('INDIVIDUAL')
      
      // HUF GSTIN
      const hufResult = validateVendorGSTIN('29AABHG1234D1ZA')
      expect(hufResult.entityType).toBe('HUF')
    })

    it('should extract correct PAN from GSTIN', () => {
      const result = validateVendorGSTIN('29AABCG1234D1ZA')
      
      expect(result.pan).toBe('AABCG1234D')
      expect(result.pan).toMatch(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    })
  })

  describe('PAN Validation (RED Phase)', () => {
    it('should validate company PAN format', () => {
      const result = validateVendorPAN('AABCG1234D')
      
      expect(result.isValid).toBe(true)
      expect(result.entityType).toBe('COMPANY')
      expect(result.pan).toBe('AABCG1234D')
    })

    it('should validate individual PAN format', () => {
      const result = validateVendorPAN('ABCDE1234F')
      
      expect(result.isValid).toBe(true)
      expect(result.entityType).toBe('INDIVIDUAL')
      expect(result.pan).toBe('ABCDE1234F')
    })

    it('should validate HUF PAN format', () => {
      const result = validateVendorPAN('AABHG1234D')
      
      expect(result.isValid).toBe(true)
      expect(result.entityType).toBe('HUF')
      expect(result.pan).toBe('AABHG1234D')
    })

    it('should reject invalid PAN format', () => {
      const result = validateVendorPAN('INVALID123')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid PAN format')
    })

    it('should validate PAN checksum', () => {
      // This is a mock test - in real implementation would use actual PAN checksum algorithm
      const result = validateVendorPAN('AABCG1234X') // Invalid checksum
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid PAN checksum')
    })
  })

  describe('Vendor Creation (RED Phase)', () => {
    it('should create registered vendor with valid GSTIN', async () => {
      const vendorInput: VendorInput = {
        name: 'ABC Suppliers Pvt Ltd',
        gstin: '29AABCG1234D1ZA',
        email: 'contact@abcsuppliers.com',
        phone: '9876543210',
        address: '123 Business Park, Bangalore',
        vendorType: 'REGULAR',
        isRegistered: true,
      }

      const mockCreatedVendor = {
        id: 'vendor-1',
        ...vendorInput,
        pan: 'AABCG1234D',
        stateCode: '29',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.vendor.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.vendor.create.mockResolvedValue(mockCreatedVendor)

      const vendor = await createVendor(vendorInput, 'user-1')

      expect(vendor.name).toBe('ABC Suppliers Pvt Ltd')
      expect(vendor.gstin).toBe('29AABCG1234D1ZA')
      expect(vendor.pan).toBe('AABCG1234D')
      expect(vendor.stateCode).toBe('29')
      expect(vendor.isRegistered).toBe(true)
      expect(vendor.vendorType).toBe('REGULAR')
    })

    it('should create unregistered vendor without GSTIN', async () => {
      const vendorInput: VendorInput = {
        name: 'Local Supplier',
        pan: 'ABCDE1234F',
        email: 'local@supplier.com',
        phone: '9876543210',
        address: '456 Market Street, Delhi',
        stateCode: '07',
        vendorType: 'UNREGISTERED',
        isRegistered: false,
      }

      const mockCreatedVendor = {
        id: 'vendor-2',
        ...vendorInput,
        gstin: null,
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.vendor.create.mockResolvedValue(mockCreatedVendor)

      const vendor = await createVendor(vendorInput, 'user-1')

      expect(vendor.name).toBe('Local Supplier')
      expect(vendor.gstin).toBeNull()
      expect(vendor.pan).toBe('ABCDE1234F')
      expect(vendor.isRegistered).toBe(false)
      expect(vendor.vendorType).toBe('UNREGISTERED')
    })

    it('should create composition dealer vendor', async () => {
      const vendorInput: VendorInput = {
        name: 'Small Trader',
        gstin: '07ABCDE1234F1Z1',
        email: 'trader@example.com',
        address: 'Shop 10, Market Complex, Delhi',
        vendorType: 'COMPOSITION',
        isRegistered: true,
      }

      const mockCreatedVendor = {
        id: 'vendor-3',
        ...vendorInput,
        pan: 'ABCDE1234F',
        stateCode: '07',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.vendor.findFirst.mockResolvedValue(null)
      mockPrisma.vendor.create.mockResolvedValue(mockCreatedVendor)

      const vendor = await createVendor(vendorInput, 'user-1')

      expect(vendor.vendorType).toBe('COMPOSITION')
      expect(vendor.gstin).toBe('07ABCDE1234F1Z1')
      expect(vendor.isRegistered).toBe(true)
    })

    it('should reject vendor with duplicate GSTIN', async () => {
      const vendorInput: VendorInput = {
        name: 'Duplicate Vendor',
        gstin: '29AABCG1234D1ZA',
        email: 'duplicate@vendor.com',
        address: 'Some address',
        vendorType: 'REGULAR',
        isRegistered: true,
      }

      mockPrisma.vendor.findFirst.mockResolvedValue({ id: 'existing-vendor' })

      await expect(createVendor(vendorInput, 'user-1')).rejects.toThrow('Vendor with GSTIN 29AABCG1234D1ZA already exists')
    })

    it('should reject registered vendor without GSTIN', async () => {
      const vendorInput: VendorInput = {
        name: 'Invalid Vendor',
        email: 'invalid@vendor.com',
        address: 'Some address',
        vendorType: 'REGULAR',
        isRegistered: true,
        // Missing GSTIN
      }

      await expect(createVendor(vendorInput, 'user-1')).rejects.toThrow('GSTIN is required for registered vendors')
    })

    it('should reject unregistered vendor without PAN', async () => {
      const vendorInput: VendorInput = {
        name: 'Invalid Unregistered Vendor',
        email: 'invalid@vendor.com',
        address: 'Some address',
        vendorType: 'UNREGISTERED',
        isRegistered: false,
        // Missing PAN
      }

      await expect(createVendor(vendorInput, 'user-1')).rejects.toThrow('PAN is required for unregistered vendors')
    })

    it('should auto-derive state from GSTIN', async () => {
      const vendorInput: VendorInput = {
        name: 'Auto State Vendor',
        gstin: '19AABCG1234D1ZA', // West Bengal
        address: 'Kolkata',
        vendorType: 'REGULAR',
        isRegistered: true,
      }

      const mockCreatedVendor = {
        id: 'vendor-4',
        ...vendorInput,
        pan: 'AABCG1234D',
        stateCode: '19',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.vendor.findFirst.mockResolvedValue(null)
      mockPrisma.vendor.create.mockResolvedValue(mockCreatedVendor)

      const vendor = await createVendor(vendorInput, 'user-1')

      expect(vendor.stateCode).toBe('19')
    })
  })

  describe('Vendor Classification (RED Phase)', () => {
    it('should classify regular vendor correctly', () => {
      const vendor = {
        gstin: '29AABCG1234D1ZA',
        vendorType: 'REGULAR',
        isRegistered: true,
      }

      const classification = classifyVendor(vendor)

      expect(classification.type).toBe('REGULAR')
      expect(classification.canClaimFullITC).toBe(true)
      expect(classification.itcRestrictions).toHaveLength(0)
      expect(classification.rcmApplicable).toBe(false)
    })

    it('should classify composition dealer with ITC restrictions', () => {
      const vendor = {
        gstin: '29AABCG1234D1ZA',
        vendorType: 'COMPOSITION',
        isRegistered: true,
      }

      const classification = classifyVendor(vendor)

      expect(classification.type).toBe('COMPOSITION')
      expect(classification.canClaimFullITC).toBe(false)
      expect(classification.itcRestrictions).toContain('No ITC on purchases from composition dealers (Section 9(4))')
    })

    it('should classify unregistered vendor with ITC restrictions', () => {
      const vendor = {
        gstin: null,
        vendorType: 'UNREGISTERED',
        isRegistered: false,
      }

      const classification = classifyVendor(vendor)

      expect(classification.type).toBe('UNREGISTERED')
      expect(classification.canClaimFullITC).toBe(false)
      expect(classification.itcRestrictions).toContain('No ITC on purchases from unregistered dealers')
    })

    it('should identify RCM applicable scenarios', () => {
      const vendor = {
        gstin: null,
        vendorType: 'UNREGISTERED',
        isRegistered: false,
        rcmApplicable: true,
      }

      const classification = classifyVendor(vendor)

      expect(classification.rcmApplicable).toBe(true)
      expect(classification.itcRestrictions).toContain('Reverse Charge Mechanism (RCM) applicable')
    })

    it('should classify import vendor', () => {
      const vendor = {
        gstin: null,
        vendorType: 'IMPORT',
        isRegistered: false,
        isImporter: true,
      }

      const classification = classifyVendor(vendor)

      expect(classification.type).toBe('IMPORT')
      expect(classification.canClaimFullITC).toBe(true)
      expect(classification.specialConditions).toContain('IGST on imports eligible for ITC')
    })

    it('should classify SEZ vendor', () => {
      const vendor = {
        gstin: '29AABCG1234D1ZA',
        vendorType: 'SEZ',
        isRegistered: true,
        isSEZ: true,
      }

      const classification = classifyVendor(vendor)

      expect(classification.type).toBe('SEZ')
      expect(classification.canClaimFullITC).toBe(true)
      expect(classification.specialConditions).toContain('SEZ supplies under LUT/Bond - Zero rated')
    })
  })

  describe('Vendor ITC Summary (RED Phase)', () => {
    it('should calculate comprehensive vendor ITC summary', async () => {
      const mockPurchases = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV001',
          invoiceDate: new Date('2024-04-15'),
          taxableAmount: 100000,
          cgstAmount: 9000,
          sgstAmount: 9000,
          igstAmount: 0,
          itcEligible: true,
          itcClaimed: 18000,
          itcReversed: 0,
          itcCategory: 'INPUTS',
          matchStatus: 'MATCHED',
        },
        {
          id: 'inv-2',
          invoiceNumber: 'INV002',
          invoiceDate: new Date('2024-05-20'),
          taxableAmount: 50000,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 9000,
          itcEligible: true,
          itcClaimed: 9000,
          itcReversed: 1000,
          itcCategory: 'CAPITAL_GOODS',
          matchStatus: 'MISMATCHED',
        },
      ]

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue(mockPurchases)

      const summary = await getVendorITCSummary({
        vendorId: 'vendor-1',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-06-30'),
        userId: 'user-1',
      })

      expect(summary.vendorId).toBe('vendor-1')
      expect(summary.totalPurchases.toNumber()).toBe(150000)
      expect(summary.totalGSTAmount.toNumber()).toBe(27000)
      expect(summary.totalITCEligible.toNumber()).toBe(27000)
      expect(summary.totalITCClaimed.toNumber()).toBe(27000)
      expect(summary.totalITCReversed.toNumber()).toBe(1000)
      expect(summary.netITC.toNumber()).toBe(26000)
      
      expect(summary.categoryBreakdown.inputs.toNumber()).toBe(18000)
      expect(summary.categoryBreakdown.capitalGoods.toNumber()).toBe(9000)
      expect(summary.categoryBreakdown.inputServices.toNumber()).toBe(0)
      expect(summary.categoryBreakdown.blocked.toNumber()).toBe(0)
      
      expect(summary.reconciliationStatus.matched).toBe(1)
      expect(summary.reconciliationStatus.mismatched).toBe(1)
      expect(summary.reconciliationStatus.notAvailable).toBe(0)
    })

    it('should include detailed invoice breakdown when requested', async () => {
      const mockPurchases = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV001',
          invoiceDate: new Date('2024-04-15'),
          taxableAmount: 100000,
          cgstAmount: 9000,
          sgstAmount: 9000,
          igstAmount: 0,
          itcEligible: true,
          itcClaimed: 18000,
          itcReversed: 0,
          itcCategory: 'INPUTS',
        },
      ]

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue(mockPurchases)

      const summary = await getVendorITCSummary({
        vendorId: 'vendor-1',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-06-30'),
        userId: 'user-1',
        includeInvoiceDetails: true,
      })

      expect(summary.invoiceDetails).toBeDefined()
      expect(summary.invoiceDetails).toHaveLength(1)
      
      const invoice = summary.invoiceDetails![0]
      expect(invoice.invoiceNumber).toBe('INV001')
      expect(invoice.taxableAmount.toNumber()).toBe(100000)
      expect(invoice.gstAmount.toNumber()).toBe(18000)
      expect(invoice.itcClaimed.toNumber()).toBe(18000)
    })

    it('should calculate pending reconciliation items', async () => {
      const mockPurchases = [
        {
          id: 'inv-1',
          matchStatus: 'NOT_AVAILABLE',
          itcClaimed: 10000,
        },
        {
          id: 'inv-2',
          matchStatus: 'MISMATCHED',
          itcClaimed: 5000,
        },
      ]

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue(mockPurchases)

      const summary = await getVendorITCSummary({
        vendorId: 'vendor-1',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-06-30'),
        userId: 'user-1',
      })

      expect(summary.pendingReconciliation.count).toBe(1) // Only NOT_AVAILABLE
      expect(summary.pendingReconciliation.amount.toNumber()).toBe(10000)
      
      expect(summary.mismatchedInvoices.count).toBe(1)
      expect(summary.mismatchedInvoices.amount.toNumber()).toBe(5000)
    })
  })

  describe('Vendor Update Operations (RED Phase)', () => {
    it('should update vendor basic details', async () => {
      const updateData = {
        vendorId: 'vendor-1',
        name: 'Updated Supplier Name',
        email: 'updated@supplier.com',
        phone: '9999999999',
        address: 'New Address Line',
      }

      const mockUpdatedVendor = {
        id: 'vendor-1',
        ...updateData,
        gstin: '29AABCG1234D1ZA',
        pan: 'AABCG1234D',
        stateCode: '29',
        isRegistered: true,
        vendorType: 'REGULAR',
        userId: 'user-1',
        updatedAt: new Date(),
      }

      mockPrisma.vendor.update.mockResolvedValue(mockUpdatedVendor)

      const updated = await updateVendor(updateData, 'user-1')

      expect(updated.name).toBe('Updated Supplier Name')
      expect(updated.email).toBe('updated@supplier.com')
      expect(updated.phone).toBe('9999999999')
    })

    it('should upgrade unregistered vendor to registered', async () => {
      const updateData = {
        vendorId: 'vendor-2',
        gstin: '29AABCG5678E1ZB',
        isRegistered: true,
        vendorType: 'REGULAR',
      }

      const mockUpdatedVendor = {
        id: 'vendor-2',
        name: 'Upgraded Vendor',
        gstin: '29AABCG5678E1ZB',
        pan: 'AABCG5678E',
        stateCode: '29',
        isRegistered: true,
        vendorType: 'REGULAR',
        userId: 'user-1',
        updatedAt: new Date(),
      }

      mockPrisma.vendor.update.mockResolvedValue(mockUpdatedVendor)

      const updated = await updateVendor(updateData, 'user-1')

      expect(updated.gstin).toBe('29AABCG5678E1ZB')
      expect(updated.isRegistered).toBe(true)
      expect(updated.vendorType).toBe('REGULAR')
      expect(updated.pan).toBe('AABCG5678E')
      expect(updated.stateCode).toBe('29')
    })

    it('should reject update with duplicate GSTIN', async () => {
      const updateData = {
        vendorId: 'vendor-1',
        gstin: '29ABCDE1234F1ZA', // GSTIN that belongs to another vendor
      }

      mockPrisma.vendor.findFirst.mockResolvedValue({ id: 'other-vendor' })

      await expect(updateVendor(updateData, 'user-1')).rejects.toThrow('GSTIN already exists for another vendor')
    })
  })

  describe('Vendor Search and Filtering (RED Phase)', () => {
    it('should search vendors by name', async () => {
      const mockVendors = [
        { id: 'vendor-1', name: 'ABC Suppliers', gstin: '29AABCG1234D1ZA' },
        { id: 'vendor-2', name: 'ABC Traders', gstin: '29AABCT1234D1ZA' },
      ]

      mockPrisma.vendor.findMany.mockResolvedValue(mockVendors)

      const results = await searchVendors({
        query: 'ABC',
        userId: 'user-1',
      })

      expect(results).toHaveLength(2)
      expect(results[0].name).toContain('ABC')
      expect(results[1].name).toContain('ABC')
    })

    it('should filter vendors by state', async () => {
      const mockVendors = [
        { id: 'vendor-1', name: 'Karnataka Supplier', stateCode: '29' },
      ]

      mockPrisma.vendor.findMany.mockResolvedValue(mockVendors)

      const results = await searchVendors({
        stateCode: '29',
        userId: 'user-1',
      })

      expect(results).toHaveLength(1)
      expect(results[0].stateCode).toBe('29')
    })

    it('should filter vendors by registration status', async () => {
      const mockVendors = [
        { id: 'vendor-1', name: 'Registered Vendor', isRegistered: true },
      ]

      mockPrisma.vendor.findMany.mockResolvedValue(mockVendors)

      const results = await searchVendors({
        isRegistered: true,
        userId: 'user-1',
      })

      expect(results).toHaveLength(1)
      expect(results[0].isRegistered).toBe(true)
    })
  })
})

// Helper function declarations (these will fail initially - TDD RED phase)
declare function searchVendors(params: {
  query?: string
  stateCode?: string
  isRegistered?: boolean
  userId: string
}): Promise<any[]>