import { describe, it, expect } from 'vitest'
import {
  calculateImportOfServicesRCM,
  calculateIndianUnregisteredRCM,
  getRCMGSTR3BTable,
  isImportOfServices,
} from '@/lib/rcm-gst-calculator'
import { SupplierType, RcmType } from '@prisma/client'

/**
 * Integration tests for Import of Services RCM feature
 * These tests verify the end-to-end flow of creating RCM self-invoices
 * for foreign service providers (AWS, Figma, GitHub, etc.)
 */
describe('Import of Services RCM Integration', () => {
  describe('Real-world scenarios', () => {
    it('should handle AWS subscription from US', () => {
      // Scenario: $100 AWS monthly subscription at ₹83.50 exchange rate
      const result = calculateImportOfServicesRCM({
        foreignAmount: 100,
        foreignCurrency: 'USD',
        exchangeRate: 83.50,
        gstRate: 18,
      })

      const expectedINR = 100 * 83.50 // ₹8,350
      const expectedIGST = Math.round(expectedINR * 0.18 * 100) / 100 // ₹1,503

      expect(result).toEqual({
        igst: expectedIGST,
        cgst: 0,
        sgst: 0,
        totalTax: expectedIGST,
        rcmLiability: expectedIGST,
        itcClaimable: expectedIGST,
      })

      // Verify GSTR-3B table
      const table = getRCMGSTR3BTable(RcmType.IMPORT_OF_SERVICES)
      expect(table).toBe('3.1(a)')
    })

    it('should handle Figma subscription from US', () => {
      // Scenario: $45 Figma monthly subscription
      const result = calculateImportOfServicesRCM({
        foreignAmount: 45,
        foreignCurrency: 'USD',
        exchangeRate: 83.50,
        gstRate: 18,
      })

      const expectedINR = 45 * 83.50 // ₹3,757.50
      const expectedIGST = Math.round(expectedINR * 0.18 * 100) / 100 // ₹676.35

      expect(result.igst).toBe(expectedIGST)
      expect(result.cgst).toBe(0)
      expect(result.sgst).toBe(0)
      expect(result.totalTax).toBe(expectedIGST)
    })

    it('should handle GitHub Enterprise from US', () => {
      // Scenario: $2,100 GitHub Enterprise annual subscription
      const result = calculateImportOfServicesRCM({
        foreignAmount: 2100,
        foreignCurrency: 'USD',
        exchangeRate: 83.50,
        gstRate: 18,
      })

      const expectedINR = 2100 * 83.50 // ₹175,350
      const expectedIGST = Math.round(expectedINR * 0.18 * 100) / 100 // ₹31,563

      expect(result.igst).toBe(expectedIGST)
      expect(result.totalTax).toBe(expectedIGST)
    })

    it('should handle service from Germany with EUR', () => {
      // Scenario: €50 service from Germany at ₹90 exchange rate
      const result = calculateImportOfServicesRCM({
        foreignAmount: 50,
        foreignCurrency: 'EUR',
        exchangeRate: 90.00,
        gstRate: 18,
      })

      const expectedINR = 50 * 90 // ₹4,500
      const expectedIGST = Math.round(expectedINR * 0.18 * 100) / 100 // ₹810

      expect(result.igst).toBe(expectedIGST)
      expect(result.totalTax).toBe(expectedIGST)
    })

    it('should handle direct INR amount for foreign service', () => {
      // Scenario: Already converted to INR
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
  })

  describe('Supplier type detection', () => {
    it('should identify foreign service supplier', () => {
      const isForeign = isImportOfServices({
        supplierType: SupplierType.FOREIGN_SERVICE,
        country: 'US',
        countryName: 'United States',
      })

      expect(isForeign).toBe(true)
    })

    it('should identify Indian unregistered supplier', () => {
      const isForeign = isImportOfServices({
        supplierType: SupplierType.INDIAN_UNREGISTERED,
        state: 'Karnataka',
        stateCode: '29',
      })

      expect(isForeign).toBe(false)
    })

    it('should detect foreign supplier by country field', () => {
      const isForeign = isImportOfServices({
        country: 'US',
      })

      expect(isForeign).toBe(true)
    })
  })

  describe('GSTR-3B table classification', () => {
    it('should return 3.1(a) for Import of Services', () => {
      const table = getRCMGSTR3BTable(RcmType.IMPORT_OF_SERVICES)
      expect(table).toBe('3.1(a)')
    })

    it('should return 3.1(d) for Indian Unregistered', () => {
      const table = getRCMGSTR3BTable(RcmType.INDIAN_UNREGISTERED)
      expect(table).toBe('3.1(d)')
    })
  })

  describe('Comparison with Indian RCM', () => {
    it('should have same total tax but different structure', () => {
      const amount = 10000
      const gstRate = 18

      // Import of Services: Always IGST
      const importResult = calculateImportOfServicesRCM({
        amountInINR: amount,
        gstRate,
      })

      // Indian Unregistered (same state): CGST + SGST
      const indianResult = calculateIndianUnregisteredRCM({
        amount,
        gstRate,
        supplierStateCode: '29', // Karnataka
        recipientStateCode: '29', // Karnataka
      })

      // Total tax should be same
      expect(importResult.totalTax).toBe(indianResult.totalTax)
      expect(importResult.totalTax).toBe(1800)

      // But structure is different
      expect(importResult.igst).toBe(1800) // All IGST
      expect(importResult.cgst).toBe(0)
      expect(importResult.sgst).toBe(0)

      expect(indianResult.igst).toBe(0)
      expect(indianResult.cgst).toBe(900) // Split
      expect(indianResult.sgst).toBe(900) // Split
    })

    it('should report to different GSTR-3B tables', () => {
      const importTable = getRCMGSTR3BTable(RcmType.IMPORT_OF_SERVICES)
      const indianTable = getRCMGSTR3BTable(RcmType.INDIAN_UNREGISTERED)

      expect(importTable).toBe('3.1(a)') // Import of Services
      expect(indianTable).toBe('3.1(d)') // Inward RCM
      expect(importTable).not.toBe(indianTable)
    })
  })

  describe('Edge cases', () => {
    it('should handle very small foreign amounts', () => {
      // $0.99 charge at ₹83.50 rate
      const result = calculateImportOfServicesRCM({
        foreignAmount: 0.99,
        foreignCurrency: 'USD',
        exchangeRate: 83.50,
        gstRate: 18,
      })

      const expectedINR = 0.99 * 83.50 // ₹82.665
      const expectedIGST = Math.round(expectedINR * 0.18 * 100) / 100 // ₹14.88

      expect(result.igst).toBe(expectedIGST)
    })

    it('should handle large foreign amounts', () => {
      // $50,000 annual contract
      const result = calculateImportOfServicesRCM({
        foreignAmount: 50000,
        foreignCurrency: 'USD',
        exchangeRate: 83.50,
        gstRate: 18,
      })

      const expectedINR = 50000 * 83.50 // ₹41,75,000
      const expectedIGST = Math.round(expectedINR * 0.18 * 100) / 100 // ₹7,51,500

      expect(result.igst).toBe(expectedIGST)
    })

    it('should handle 12% GST rate', () => {
      const result = calculateImportOfServicesRCM({
        foreignAmount: 100,
        foreignCurrency: 'USD',
        exchangeRate: 83.50,
        gstRate: 12,
      })

      const expectedINR = 100 * 83.50 // ₹8,350
      const expectedIGST = Math.round(expectedINR * 0.12 * 100) / 100 // ₹1,002

      expect(result.igst).toBe(expectedIGST)
      expect(result.totalTax).toBe(expectedIGST)
    })
  })
})
