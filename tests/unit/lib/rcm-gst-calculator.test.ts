import { describe, it, expect } from 'vitest'
import {
  calculateImportOfServicesRCM,
  calculateIndianUnregisteredRCM,
  getRCMGSTR3BTable,
  isImportOfServices,
} from '@/lib/rcm-gst-calculator'
import { RcmType } from '@prisma/client'

describe('Import of Services RCM Calculations', () => {
  describe('calculateImportOfServicesRCM', () => {
    it('should calculate IGST only for foreign services', () => {
      const result = calculateImportOfServicesRCM({
        amountInINR: 10000,
        gstRate: 18,
      })

      expect(result).toEqual({
        igst: 1800,
        cgst: 0,
        sgst: 0,
        totalTax: 1800,
        rcmLiability: 1800,
        itcClaimable: 1800,
      })
    })

    it('should handle 12% GST rate', () => {
      const result = calculateImportOfServicesRCM({
        amountInINR: 5000,
        gstRate: 12,
      })

      expect(result).toEqual({
        igst: 600,
        cgst: 0,
        sgst: 0,
        totalTax: 600,
        rcmLiability: 600,
        itcClaimable: 600,
      })
    })

    it('should round to 2 decimal places', () => {
      const result = calculateImportOfServicesRCM({
        amountInINR: 1234.56,
        gstRate: 18,
      })

      expect(result.igst).toBe(222.22)
      expect(result.totalTax).toBe(222.22)
    })

    it('should handle zero amount', () => {
      const result = calculateImportOfServicesRCM({
        amountInINR: 0,
        gstRate: 18,
      })

      expect(result).toEqual({
        igst: 0,
        cgst: 0,
        sgst: 0,
        totalTax: 0,
        rcmLiability: 0,
        itcClaimable: 0,
      })
    })

    it('should convert foreign currency to INR before calculating', () => {
      const result = calculateImportOfServicesRCM({
        foreignAmount: 100,
        foreignCurrency: 'USD',
        exchangeRate: 83.50,
        gstRate: 18,
      })

      const expectedINR = 100 * 83.50 // 8350
      const expectedIGST = Math.round(expectedINR * 0.18 * 100) / 100 // 1503

      expect(result.igst).toBe(expectedIGST)
      expect(result.totalTax).toBe(expectedIGST)
    })

    it('should throw error if neither amountInINR nor foreign details provided', () => {
      expect(() => {
        calculateImportOfServicesRCM({
          gstRate: 18,
        })
      }).toThrow('Either amountInINR or foreign currency details must be provided')
    })

    it('should throw error if foreign amount provided without exchange rate', () => {
      expect(() => {
        calculateImportOfServicesRCM({
          foreignAmount: 100,
          foreignCurrency: 'USD',
          gstRate: 18,
        })
      }).toThrow('Exchange rate is required for foreign currency conversion')
    })
  })

  describe('calculateIndianUnregisteredRCM', () => {
    it('should calculate CGST + SGST for same state supplier', () => {
      const result = calculateIndianUnregisteredRCM({
        amount: 10000,
        gstRate: 18,
        supplierStateCode: '29', // Karnataka
        recipientStateCode: '29', // Karnataka
      })

      expect(result).toEqual({
        igst: 0,
        cgst: 900, // 9%
        sgst: 900, // 9%
        totalTax: 1800,
        rcmLiability: 1800,
        itcClaimable: 1800,
      })
    })

    it('should calculate IGST for different state supplier', () => {
      const result = calculateIndianUnregisteredRCM({
        amount: 10000,
        gstRate: 18,
        supplierStateCode: '27', // Maharashtra
        recipientStateCode: '29', // Karnataka
      })

      expect(result).toEqual({
        igst: 1800,
        cgst: 0,
        sgst: 0,
        totalTax: 1800,
        rcmLiability: 1800,
        itcClaimable: 1800,
      })
    })

    it('should handle 12% GST rate with same state', () => {
      const result = calculateIndianUnregisteredRCM({
        amount: 5000,
        gstRate: 12,
        supplierStateCode: '29',
        recipientStateCode: '29',
      })

      expect(result).toEqual({
        igst: 0,
        cgst: 300, // 6%
        sgst: 300, // 6%
        totalTax: 600,
        rcmLiability: 600,
        itcClaimable: 600,
      })
    })

    it('should round to 2 decimal places', () => {
      const result = calculateIndianUnregisteredRCM({
        amount: 1234.56,
        gstRate: 18,
        supplierStateCode: '29',
        recipientStateCode: '29',
      })

      expect(result.cgst).toBe(111.11)
      expect(result.sgst).toBe(111.11)
      expect(result.totalTax).toBe(222.22)
    })
  })

  describe('getRCMGSTR3BTable', () => {
    it('should return 3.1(a) for Import of Services', () => {
      const table = getRCMGSTR3BTable(RcmType.IMPORT_OF_SERVICES)
      expect(table).toBe('3.1(a)')
    })

    it('should return 3.1(d) for Indian Unregistered', () => {
      const table = getRCMGSTR3BTable(RcmType.INDIAN_UNREGISTERED)
      expect(table).toBe('3.1(d)')
    })
  })

  describe('isImportOfServices', () => {
    it('should return true for foreign supplier', () => {
      const result = isImportOfServices({
        supplierType: 'FOREIGN_SERVICE',
        country: 'US',
      })
      expect(result).toBe(true)
    })

    it('should return false for Indian supplier', () => {
      const result = isImportOfServices({
        supplierType: 'INDIAN_UNREGISTERED',
        state: 'Karnataka',
        stateCode: '29',
      })
      expect(result).toBe(false)
    })

    it('should return false if no supplier type', () => {
      const result = isImportOfServices({})
      expect(result).toBe(false)
    })
  })
})

describe('RCM Comparison Tests', () => {
  it('should calculate same tax amount but different structure for same value', () => {
    const importResult = calculateImportOfServicesRCM({
      amountInINR: 10000,
      gstRate: 18,
    })

    const indianResult = calculateIndianUnregisteredRCM({
      amount: 10000,
      gstRate: 18,
      supplierStateCode: '29',
      recipientStateCode: '29',
    })

    // Total tax should be same
    expect(importResult.totalTax).toBe(indianResult.totalTax)

    // But structure is different
    expect(importResult.igst).toBe(1800) // All IGST
    expect(importResult.cgst).toBe(0)
    expect(importResult.sgst).toBe(0)

    expect(indianResult.igst).toBe(0)
    expect(indianResult.cgst).toBe(900) // Split CGST/SGST
    expect(indianResult.sgst).toBe(900)
  })
})
