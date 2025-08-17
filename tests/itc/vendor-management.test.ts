import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateVendorGSTIN,
  createVendor,
  updateVendor,
  getVendorITCSummary,
  validateVendorPAN,
  VendorInput,
  VendorITCSummary
} from '@/lib/itc/vendor-management'
import { Decimal } from '@prisma/client/runtime/library'

describe('Vendor Management', () => {
  describe('Vendor GSTIN Validation', () => {
    it('should validate correct GSTIN format', () => {
      const result = validateVendorGSTIN('29AABCG1234D1ZA')
      
      expect(result.isValid).toBe(true)
      expect(result.stateCode).toBe('29')
      expect(result.stateName).toBe('Karnataka')
      expect(result.pan).toBe('AABCG1234D')
    })
    
    it('should reject invalid GSTIN format', () => {
      const result = validateVendorGSTIN('INVALID123')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid GSTIN format')
    })
    
    it('should reject GSTIN with invalid state code', () => {
      const result = validateVendorGSTIN('99AABCG1234D1ZA')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid state code')
    })
    
    it('should validate GSTIN checksum', () => {
      const result = validateVendorGSTIN('29AABCG1234D1ZZ') // Invalid checksum
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid checksum')
    })
  })
  
  describe('Vendor PAN Validation', () => {
    it('should validate correct PAN format for company', () => {
      const result = validateVendorPAN('AABCG1234D')
      
      expect(result.isValid).toBe(true)
      expect(result.entityType).toBe('COMPANY')
    })
    
    it('should validate correct PAN format for individual', () => {
      const result = validateVendorPAN('ABCDE1234F')
      
      expect(result.isValid).toBe(true)
      expect(result.entityType).toBe('INDIVIDUAL')
    })
    
    it('should reject invalid PAN format', () => {
      const result = validateVendorPAN('INVALID')
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid PAN format')
    })
  })
  
  describe('Vendor Creation', () => {
    it('should create vendor with GSTIN', async () => {
      const vendorInput: VendorInput = {
        name: 'ABC Suppliers Pvt Ltd',
        gstin: '29AABCG1234D1ZA',
        email: 'contact@abcsuppliers.com',
        phone: '9876543210',
        address: '123 Business Park, Bangalore',
        isRegistered: true,
        vendorType: 'REGULAR',
        msmeRegistered: false
      }
      
      const vendor = await createVendor(vendorInput)
      
      expect(vendor.name).toBe('ABC Suppliers Pvt Ltd')
      expect(vendor.gstin).toBe('29AABCG1234D1ZA')
      expect(vendor.pan).toBe('AABCG1234D')
      expect(vendor.state).toBe('Karnataka')
      expect(vendor.stateCode).toBe('29')
      expect(vendor.isRegistered).toBe(true)
    })
    
    it('should create unregistered vendor without GSTIN', async () => {
      const vendorInput: VendorInput = {
        name: 'Local Supplier',
        pan: 'ABCDE1234F',
        email: 'local@supplier.com',
        phone: '9876543210',
        address: '456 Market Street, Delhi',
        state: 'Delhi',
        stateCode: '07',
        isRegistered: false,
        vendorType: 'UNREGISTERED'
      }
      
      const vendor = await createVendor(vendorInput)
      
      expect(vendor.name).toBe('Local Supplier')
      expect(vendor.gstin).toBeNull()
      expect(vendor.pan).toBe('ABCDE1234F')
      expect(vendor.isRegistered).toBe(false)
    })
    
    it('should create composition vendor', async () => {
      const vendorInput: VendorInput = {
        name: 'Small Trader',
        gstin: '07ABCDE1234F1Z1',
        email: 'trader@example.com',
        address: 'Shop 10, Market Complex, Delhi',
        isRegistered: true,
        vendorType: 'COMPOSITION',
        compositionRate: 1
      }
      
      const vendor = await createVendor(vendorInput)
      
      expect(vendor.vendorType).toBe('COMPOSITION')
      expect(vendor.compositionRate).toBe(1)
    })
    
    it('should reject vendor with duplicate GSTIN', async () => {
      const vendorInput: VendorInput = {
        name: 'Duplicate Vendor',
        gstin: '29AABCG1234D1ZA', // Already exists
        email: 'duplicate@vendor.com',
        address: 'Some address',
        isRegistered: true
      }
      
      await expect(createVendor(vendorInput)).rejects.toThrow('GSTIN already exists')
    })
  })
  
  describe('Vendor Update', () => {
    it('should update vendor details', async () => {
      const updateData = {
        vendorId: 'vendor-123',
        name: 'Updated Supplier Name',
        email: 'updated@supplier.com',
        phone: '9999999999',
        msmeRegistered: true,
        msmeNumber: 'UDYAM-KA-12-345678'
      }
      
      const updated = await updateVendor(updateData)
      
      expect(updated.name).toBe('Updated Supplier Name')
      expect(updated.email).toBe('updated@supplier.com')
      expect(updated.msmeRegistered).toBe(true)
      expect(updated.msmeNumber).toBe('UDYAM-KA-12-345678')
    })
    
    it('should update vendor from unregistered to registered', async () => {
      const updateData = {
        vendorId: 'vendor-456',
        gstin: '29AABCG5678E1ZB',
        isRegistered: true,
        vendorType: 'REGULAR'
      }
      
      const updated = await updateVendor(updateData)
      
      expect(updated.gstin).toBe('29AABCG5678E1ZB')
      expect(updated.isRegistered).toBe(true)
      expect(updated.vendorType).toBe('REGULAR')
      expect(updated.state).toBe('Karnataka')
      expect(updated.stateCode).toBe('29')
    })
  })
  
  describe('Vendor ITC Summary', () => {
    it('should calculate vendor ITC summary for a period', async () => {
      const summary = await getVendorITCSummary({
        vendorId: 'vendor-123',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-06-30')
      })
      
      expect(summary.vendorId).toBe('vendor-123')
      expect(summary.totalPurchases.toNumber()).toBeGreaterThanOrEqual(0)
      expect(summary.totalITCEligible.toNumber()).toBeGreaterThanOrEqual(0)
      expect(summary.totalITCClaimed.toNumber()).toBeGreaterThanOrEqual(0)
      expect(summary.totalITCReversed.toNumber()).toBeGreaterThanOrEqual(0)
      expect(summary.netITC.toNumber()).toBeGreaterThanOrEqual(0)
    })
    
    it('should include invoice-wise ITC breakdown', async () => {
      const summary = await getVendorITCSummary({
        vendorId: 'vendor-123',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-06-30'),
        includeInvoiceDetails: true
      })
      
      expect(summary.invoiceDetails).toBeDefined()
      expect(Array.isArray(summary.invoiceDetails)).toBe(true)
      
      if (summary.invoiceDetails && summary.invoiceDetails.length > 0) {
        const invoice = summary.invoiceDetails[0]
        expect(invoice).toHaveProperty('invoiceNumber')
        expect(invoice).toHaveProperty('invoiceDate')
        expect(invoice).toHaveProperty('taxableAmount')
        expect(invoice).toHaveProperty('gstAmount')
        expect(invoice).toHaveProperty('itcEligible')
        expect(invoice).toHaveProperty('itcClaimed')
      }
    })
    
    it('should calculate pending ITC reconciliation', async () => {
      const summary = await getVendorITCSummary({
        vendorId: 'vendor-123',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-06-30')
      })
      
      expect(summary.pendingReconciliation).toBeDefined()
      expect(summary.pendingReconciliation.count).toBeGreaterThanOrEqual(0)
      expect(summary.pendingReconciliation.amount.toNumber()).toBeGreaterThanOrEqual(0)
    })
    
    it('should identify mismatched invoices', async () => {
      const summary = await getVendorITCSummary({
        vendorId: 'vendor-123',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-06-30')
      })
      
      expect(summary.mismatchedInvoices).toBeDefined()
      expect(summary.mismatchedInvoices.count).toBeGreaterThanOrEqual(0)
      expect(summary.mismatchedInvoices.taxDifference.toNumber()).toBeGreaterThanOrEqual(0)
    })
  })
  
  describe('Vendor Classification', () => {
    it('should classify vendor as regular dealer', () => {
      const vendor = {
        gstin: '29AABCG1234D1ZA',
        vendorType: 'REGULAR',
        isRegistered: true
      }
      
      const classification = classifyVendor(vendor)
      
      expect(classification.type).toBe('REGULAR')
      expect(classification.canClaimFullITC).toBe(true)
      expect(classification.itcRestrictions).toHaveLength(0)
    })
    
    it('should classify vendor as composition dealer', () => {
      const vendor = {
        gstin: '29AABCG1234D1ZA',
        vendorType: 'COMPOSITION',
        isRegistered: true,
        compositionRate: 1
      }
      
      const classification = classifyVendor(vendor)
      
      expect(classification.type).toBe('COMPOSITION')
      expect(classification.canClaimFullITC).toBe(false)
      expect(classification.itcRestrictions).toContain('No ITC on composition dealer purchases')
    })
    
    it('should classify unregistered vendor', () => {
      const vendor = {
        gstin: null,
        vendorType: 'UNREGISTERED',
        isRegistered: false
      }
      
      const classification = classifyVendor(vendor)
      
      expect(classification.type).toBe('UNREGISTERED')
      expect(classification.canClaimFullITC).toBe(false)
      expect(classification.itcRestrictions).toContain('No ITC on unregistered dealer purchases')
    })
    
    it('should identify RCM applicable vendors', () => {
      const vendor = {
        gstin: null,
        vendorType: 'UNREGISTERED',
        isRegistered: false,
        rcmApplicable: true
      }
      
      const classification = classifyVendor(vendor)
      
      expect(classification.rcmApplicable).toBe(true)
      expect(classification.itcRestrictions).toContain('RCM - Tax to be paid by recipient')
    })
  })
})

// Helper function to classify vendor
function classifyVendor(vendor: any) {
  const classification = {
    type: vendor.vendorType || 'UNREGISTERED',
    canClaimFullITC: false,
    itcRestrictions: [] as string[],
    rcmApplicable: vendor.rcmApplicable || false
  }
  
  if (vendor.vendorType === 'REGULAR' && vendor.isRegistered) {
    classification.canClaimFullITC = true
  } else if (vendor.vendorType === 'COMPOSITION') {
    classification.itcRestrictions.push('No ITC on composition dealer purchases')
  } else if (!vendor.isRegistered) {
    classification.itcRestrictions.push('No ITC on unregistered dealer purchases')
  }
  
  if (vendor.rcmApplicable) {
    classification.itcRestrictions.push('RCM - Tax to be paid by recipient')
  }
  
  return classification
}