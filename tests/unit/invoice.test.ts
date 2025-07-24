import { describe, it, expect } from 'vitest'
import { generateInvoiceNumber, validateGSTCompliance } from '@/lib/invoice'

describe('Invoice Number Generation', () => {
  it('should generate invoice number in FY format', () => {
    const result = generateInvoiceNumber('2025-26', 42)
    expect(result).toBe('FY25-26/42')
  })

  it('should pad sequence number with zeros', () => {
    const result = generateInvoiceNumber('2025-26', 5)
    expect(result).toBe('FY25-26/005')
  })

  it('should handle different fiscal years correctly', () => {
    expect(generateInvoiceNumber('2023-24', 1)).toBe('FY23-24/001')
    expect(generateInvoiceNumber('2024-25', 999)).toBe('FY24-25/999')
  })
})

describe('GST Compliance Validation', () => {
  it('should validate required GST fields', () => {
    const validInvoice = {
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '99831400',
      igstRate: 0,
      lutNumber: 'AD290124000001',
      lutDate: new Date('2024-01-01'),
    }

    const result = validateGSTCompliance(validInvoice)
    expect(result.errors).toHaveLength(0)
    expect(result.isValid).toBe(true)
  })

  it('should reject invalid GSTIN format', () => {
    const invalidInvoice = {
      gstin: 'INVALID',
      pan: 'ABCDE1234F',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '998314',
      igstRate: 0,
    }

    const result = validateGSTCompliance(invalidInvoice)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Invalid GSTIN format')
  })

  it('should require 8-digit service code for exports', () => {
    const invalidInvoice = {
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '9983', // Only 4 digits
      igstRate: 0,
    }

    const result = validateGSTCompliance(invalidInvoice)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Service code must be 8 digits for exports')
  })

  it('should enforce 0% IGST for exports under LUT', () => {
    const invalidInvoice = {
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '99831400',
      igstRate: 18, // Should be 0
      lutNumber: 'AD290124000001',
    }

    const result = validateGSTCompliance(invalidInvoice)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('IGST must be 0% for exports under LUT')
  })
})