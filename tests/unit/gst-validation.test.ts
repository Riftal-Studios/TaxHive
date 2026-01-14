import { describe, it, expect } from 'vitest'
import {
  validateGSTIN,
  validatePAN,
  extractPANFromGSTIN,
  validatePANMatchesGSTIN,
  getStateCodeFromGSTIN,
  getStateFromGSTIN,
  validateGSTInvoice,
  calculateGSTComponents,
  formatGSTInvoiceNumber,
  validateLUTNumber,
  isLUTExpired,
  getLUTExpiryStatus,
  // Import of Services RCM
  calculateImportOfServicesGST,
  getGSTR3BTable,
  validateImportOfServicesInvoice,
  IMPORT_OF_SERVICES_GST_RATES,
} from '@/lib/validations/gst'
import { RcmType } from '@prisma/client'
import { GST_CONSTANTS } from '@/lib/constants'

describe('GST Validation Functions', () => {
  describe('validateGSTIN', () => {
    it('should validate correct GSTIN format', () => {
      expect(validateGSTIN('27AAPFU0939F1ZV')).toBe(true)
      expect(validateGSTIN('29AAGCB7383J1Z4')).toBe(true)
    })

    it('should reject invalid GSTIN format', () => {
      expect(validateGSTIN('')).toBe(false)
      expect(validateGSTIN('27AAPFU0939F1Z')).toBe(false) // Too short
      expect(validateGSTIN('27AAPFU0939F1ZVV')).toBe(false) // Too long
      expect(validateGSTIN('27AAPFU0939F1ZX')).toBe(false) // Wrong check character
      expect(validateGSTIN('00AAPFU0939F1ZV')).toBe(false) // Invalid state code (00 doesn't exist)
    })

    it('should handle lowercase GSTIN', () => {
      expect(validateGSTIN('27aapfu0939f1zv')).toBe(true)
    })
  })

  describe('validatePAN', () => {
    it('should validate correct PAN format', () => {
      expect(validatePAN('AAPFU0939F')).toBe(true)
      expect(validatePAN('AAGCB7383J')).toBe(true)
    })

    it('should reject invalid PAN format', () => {
      expect(validatePAN('')).toBe(false)
      expect(validatePAN('AAPFU0939')).toBe(false) // Too short
      expect(validatePAN('AAPFU0939FF')).toBe(false) // Too long
      expect(validatePAN('AAPFU09391')).toBe(false) // Number at end
      expect(validatePAN('1APFU0939F')).toBe(false) // Number at start
    })
  })

  describe('extractPANFromGSTIN', () => {
    it('should extract PAN from valid GSTIN', () => {
      expect(extractPANFromGSTIN('27AAPFU0939F1ZV')).toBe('AAPFU0939F')
      expect(extractPANFromGSTIN('29AAGCB7383J1Z4')).toBe('AAGCB7383J')
    })

    it('should return null for invalid GSTIN', () => {
      expect(extractPANFromGSTIN('invalid')).toBe(null)
      expect(extractPANFromGSTIN('')).toBe(null)
    })
  })

  describe('validatePANMatchesGSTIN', () => {
    it('should validate matching PAN and GSTIN', () => {
      expect(validatePANMatchesGSTIN('AAPFU0939F', '27AAPFU0939F1ZV')).toBe(true)
      expect(validatePANMatchesGSTIN('aapfu0939f', '27AAPFU0939F1ZV')).toBe(true) // Case insensitive
    })

    it('should reject non-matching PAN and GSTIN', () => {
      expect(validatePANMatchesGSTIN('AAPFU0939F', '27AAGCB7383J1Z4')).toBe(false)
      expect(validatePANMatchesGSTIN('WRONGPAN12', '27AAPFU0939F1ZV')).toBe(false)
    })
  })

  describe('getStateFromGSTIN', () => {
    it('should return correct state for valid GSTIN', () => {
      expect(getStateFromGSTIN('27AAPFU0939F1ZV')).toBe('Maharashtra')
      expect(getStateFromGSTIN('07AAPFU0939F1ZV')).toBe('Delhi')
      expect(getStateFromGSTIN('29AAPFU0939F1ZV')).toBe('Karnataka')
    })

    it('should return null for invalid GSTIN', () => {
      expect(getStateFromGSTIN('invalid')).toBe(null)
      expect(getStateFromGSTIN('')).toBe(null)
    })
  })

  describe('validateGSTInvoice', () => {
    it('should validate correct export invoice under LUT', () => {
      const invoice = {
        placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
        serviceCode: '99831130',
        igstRate: 0,
        lutId: 'lut123',
        currency: 'USD',
        exchangeRate: 83.5,
        exchangeSource: 'RBI'
      }
      const result = validateGSTInvoice(invoice)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject export invoice without LUT when IGST is 0', () => {
      const invoice = {
        placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
        serviceCode: '99831130',
        igstRate: 0,
        lutId: null,
        currency: 'USD',
        exchangeRate: 83.5,
        exchangeSource: 'RBI'
      }
      const result = validateGSTInvoice(invoice)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('LUT is required for zero-rated supplies (0% IGST)')
    })

    it('should warn when IGST is not 0 with LUT', () => {
      const invoice = {
        placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
        serviceCode: '99831130',
        igstRate: 18,
        lutId: 'lut123',
        currency: 'USD',
        exchangeRate: 83.5,
        exchangeSource: 'RBI'
      }
      const result = validateGSTInvoice(invoice)
      expect(result.warnings).toContain('IGST rate should be 0% for exports under LUT')
    })

    it('should reject export invoice with invalid service code', () => {
      const invoice = {
        placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
        serviceCode: '99999999', // Code that doesn't exist in GST Classification Scheme
        igstRate: 0,
        lutId: 'lut123',
        currency: 'USD',
        exchangeRate: 83.5,
        exchangeSource: 'RBI'
      }
      const result = validateGSTInvoice(invoice)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Service code (HSN/SAC) is not a valid code from the GST Classification Scheme')
    })

    it('should reject invoice without exchange rate', () => {
      const invoice = {
        placeOfSupply: GST_CONSTANTS.PLACE_OF_SUPPLY_EXPORT,
        serviceCode: '99831130',
        igstRate: 0,
        lutId: 'lut123',
        currency: 'USD',
        exchangeRate: 0,
        exchangeSource: 'RBI'
      }
      const result = validateGSTInvoice(invoice)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Valid exchange rate is required for foreign currency invoices')
    })
  })

  describe('calculateGSTComponents', () => {
    it('should calculate IGST for interstate supply', () => {
      const result = calculateGSTComponents(1000, 18, true)
      expect(result.igst).toBe(180)
      expect(result.cgst).toBe(0)
      expect(result.sgst).toBe(0)
      expect(result.total).toBe(180)
    })

    it('should calculate CGST/SGST for intrastate supply', () => {
      const result = calculateGSTComponents(1000, 18, false)
      expect(result.igst).toBe(0)
      expect(result.cgst).toBe(90)
      expect(result.sgst).toBe(90)
      expect(result.total).toBe(180)
    })

    it('should calculate with cess', () => {
      const result = calculateGSTComponents(1000, 18, true, 2)
      expect(result.igst).toBe(180)
      expect(result.cess).toBe(20)
      expect(result.total).toBe(200)
    })
  })

  describe('formatGSTInvoiceNumber', () => {
    it('should format invoice number correctly', () => {
      expect(formatGSTInvoiceNumber('FY24-25/001')).toBe('FY24-25/001')
      expect(formatGSTInvoiceNumber('fy24-25/001')).toBe('FY24-25/001')
      expect(formatGSTInvoiceNumber('FY24-25/001!')).toBe('FY24-25/001')
      expect(formatGSTInvoiceNumber('FY@24-25/001')).toBe('FY24-25/001')
    })
  })

  describe('LUT validation functions', () => {
    it('should validate LUT number format', () => {
      expect(validateLUTNumber('ARN1234567890')).toBe(true)
      expect(validateLUTNumber('AD2023456789012')).toBe(true)
      expect(validateLUTNumber('short')).toBe(false)
      expect(validateLUTNumber('ARN-1234567890')).toBe(false) // Has hyphen
    })

    it('should check LUT expiry', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)
      expect(isLUTExpired(futureDate)).toBe(false)

      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      expect(isLUTExpired(pastDate)).toBe(true)
    })

    it('should get LUT expiry status', () => {
      const activeDate = new Date()
      activeDate.setDate(activeDate.getDate() + 60)
      let status = getLUTExpiryStatus(activeDate)
      expect(status.status).toBe('active')
      expect(status.daysRemaining).toBeGreaterThan(30)

      const expiringSoonDate = new Date()
      expiringSoonDate.setDate(expiringSoonDate.getDate() + 15)
      status = getLUTExpiryStatus(expiringSoonDate)
      expect(status.status).toBe('expiring-soon')
      expect(status.daysRemaining).toBe(15)

      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 5)
      status = getLUTExpiryStatus(expiredDate)
      expect(status.status).toBe('expired')
      expect(status.daysRemaining).toBe(0)
    })
  })

  // ============================================================================
  // Import of Services RCM Tests (Phase 3)
  // ============================================================================

  describe('calculateImportOfServicesGST', () => {
    it('should calculate IGST only for import of services (always interstate)', () => {
      const result = calculateImportOfServicesGST(10000, 18)

      expect(result.igst).toBe(1800)
      expect(result.cgst).toBe(0)
      expect(result.sgst).toBe(0)
      expect(result.totalTax).toBe(1800)
      expect(result.igstRate).toBe(18)
    })

    it('should handle 5% GST rate', () => {
      const result = calculateImportOfServicesGST(10000, 5)

      expect(result.igst).toBe(500)
      expect(result.totalTax).toBe(500)
      expect(result.igstRate).toBe(5)
    })

    it('should handle 12% GST rate', () => {
      const result = calculateImportOfServicesGST(10000, 12)

      expect(result.igst).toBe(1200)
      expect(result.totalTax).toBe(1200)
      expect(result.igstRate).toBe(12)
    })

    it('should handle 28% GST rate', () => {
      const result = calculateImportOfServicesGST(10000, 28)

      expect(result.igst).toBeCloseTo(2800, 2)
      expect(result.totalTax).toBeCloseTo(2800, 2)
      expect(result.igstRate).toBe(28)
    })

    it('should reject invalid GST rates', () => {
      expect(() => calculateImportOfServicesGST(10000, 15)).toThrow(
        'Invalid GST rate for Import of Services'
      )
      expect(() => calculateImportOfServicesGST(10000, 0)).toThrow(
        'Invalid GST rate for Import of Services'
      )
    })

    it('should handle decimal amounts', () => {
      const result = calculateImportOfServicesGST(7325.50, 18)

      // 7325.50 * 0.18 = 1318.59
      expect(result.igst).toBeCloseTo(1318.59, 2)
      expect(result.totalTax).toBeCloseTo(1318.59, 2)
    })

    it('should return foreign currency details when provided', () => {
      const result = calculateImportOfServicesGST(83500, 18, {
        foreignCurrency: 'USD',
        foreignAmount: 1000,
        exchangeRate: 83.5
      })

      expect(result.igst).toBe(15030) // 83500 * 0.18
      expect(result.foreignCurrency).toBe('USD')
      expect(result.foreignAmount).toBe(1000)
      expect(result.exchangeRate).toBe(83.5)
    })
  })

  describe('getGSTR3BTable', () => {
    it('should return 3.1(a) for Import of Services', () => {
      expect(getGSTR3BTable(RcmType.IMPORT_OF_SERVICES)).toBe('3.1(a)')
    })

    it('should return 3.1(d) for Indian Unregistered suppliers', () => {
      expect(getGSTR3BTable(RcmType.INDIAN_UNREGISTERED)).toBe('3.1(d)')
    })
  })

  describe('validateImportOfServicesInvoice', () => {
    const validInvoice = {
      invoiceDate: new Date(),
      dateOfReceiptOfSupply: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      gstRate: 18,
      serviceCode: '99831130', // Valid SAC code
      supplierName: 'AWS Inc.',
      supplierCountry: 'US',
      supplierCountryName: 'United States',
      amountInINR: 83500,
      foreignCurrency: 'USD',
      foreignAmount: 1000,
      exchangeRate: 83.5,
      exchangeRateSource: 'RBI',
    }

    it('should validate correct import of services invoice', () => {
      const result = validateImportOfServicesInvoice(validInvoice)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invoice without exchange rate', () => {
      const result = validateImportOfServicesInvoice({
        ...validInvoice,
        exchangeRate: 0,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Exchange rate is required for import of services')
    })

    it('should reject invoice without foreign currency', () => {
      const result = validateImportOfServicesInvoice({
        ...validInvoice,
        foreignCurrency: '',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Foreign currency is required for import of services')
    })

    it('should reject invoice without supplier country', () => {
      const result = validateImportOfServicesInvoice({
        ...validInvoice,
        supplierCountry: '',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Supplier country is required for import of services')
    })

    it('should reject invoice with Indian supplier', () => {
      const result = validateImportOfServicesInvoice({
        ...validInvoice,
        supplierCountry: 'IN',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Import of services must be from a foreign supplier (not India)')
    })

    it('should reject invoice exceeding 30-day rule', () => {
      const result = validateImportOfServicesInvoice({
        ...validInvoice,
        invoiceDate: new Date(),
        dateOfReceiptOfSupply: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
      })

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Self-invoice must be issued within 30 days')
    })

    it('should warn when approaching 30-day deadline', () => {
      const result = validateImportOfServicesInvoice({
        ...validInvoice,
        invoiceDate: new Date(),
        dateOfReceiptOfSupply: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000), // 27 days ago
      })

      expect(result.isValid).toBe(true)
      expect(result.warnings[0]).toContain('approaching 30-day deadline')
    })

    it('should reject invalid GST rate', () => {
      const result = validateImportOfServicesInvoice({
        ...validInvoice,
        gstRate: 15,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Invalid GST rate')
    })

    it('should reject invalid HSN/SAC code', () => {
      const result = validateImportOfServicesInvoice({
        ...validInvoice,
        serviceCode: '99999999',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('HSN/SAC code must be a valid code from the GST Classification Scheme')
    })
  })

  describe('IMPORT_OF_SERVICES_GST_RATES', () => {
    it('should contain standard GST rates', () => {
      expect(IMPORT_OF_SERVICES_GST_RATES).toContain(5)
      expect(IMPORT_OF_SERVICES_GST_RATES).toContain(12)
      expect(IMPORT_OF_SERVICES_GST_RATES).toContain(18)
      expect(IMPORT_OF_SERVICES_GST_RATES).toContain(28)
    })

    it('should not contain 0% rate for import of services', () => {
      expect(IMPORT_OF_SERVICES_GST_RATES).not.toContain(0)
    })
  })
})