/**
 * GSTR-2B Parser Tests
 *
 * Tests for parsing GSTR-2B JSON downloaded from GST Portal.
 */

import { describe, it, expect } from 'vitest'
import {
  parseGSTR2B,
  parseGSTR2BEntry,
  normalizeInvoiceNumber,
  parseGSTR2BDate,
  type GSTR2BJson,
  type ParsedGSTR2BEntry,
  type GSTR2BParseResult,
} from '@/lib/gstr2b-parser'

describe('GSTR-2B Parser', () => {
  describe('parseGSTR2B', () => {
    it('should parse valid GSTR-2B JSON with B2B invoices', () => {
      const gstr2bJson: GSTR2BJson = {
        gstin: '29AABCT1234Q1ZX',
        fp: '012024',
        b2b: [
          {
            ctin: '27AABCU9603R1ZJ',
            trdnm: 'Test Vendor Pvt Ltd',
            inv: [
              {
                inum: 'INV-001',
                idt: '15-01-2024',
                val: 118000,
                txval: 100000,
                igst: 18000,
                cgst: 0,
                sgst: 0,
                cess: 0,
                itcavl: 'Y',
                rsn: '',
                diffprcnt: 1,
                srctyp: 'e-Invoice',
              },
            ],
          },
        ],
      }

      const result = parseGSTR2B(gstr2bJson)

      expect(result.success).toBe(true)
      expect(result.gstin).toBe('29AABCT1234Q1ZX')
      expect(result.returnPeriod).toBe('012024')
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0]).toMatchObject({
        vendorGstin: '27AABCU9603R1ZJ',
        vendorName: 'Test Vendor Pvt Ltd',
        invoiceNumber: 'INV-001',
        invoiceValue: 118000,
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
        cess: 0,
        itcAvailability: 'Y',
        supplyType: 'B2B',
      })
    })

    it('should parse multiple vendors and invoices', () => {
      const gstr2bJson: GSTR2BJson = {
        gstin: '29AABCT1234Q1ZX',
        fp: '022024',
        b2b: [
          {
            ctin: '27AABCU9603R1ZJ',
            trdnm: 'Vendor 1',
            inv: [
              { inum: 'INV-001', idt: '01-02-2024', val: 10000, txval: 8474.58, igst: 1525.42 },
              { inum: 'INV-002', idt: '05-02-2024', val: 20000, txval: 16949.15, igst: 3050.85 },
            ],
          },
          {
            ctin: '07AAACR5055K1Z5',
            trdnm: 'Vendor 2',
            inv: [
              { inum: 'V2/001', idt: '10-02-2024', val: 5000, txval: 4237.29, cgst: 381.36, sgst: 381.36 },
            ],
          },
        ],
      }

      const result = parseGSTR2B(gstr2bJson)

      expect(result.success).toBe(true)
      expect(result.entries).toHaveLength(3)
      expect(result.entries[0].vendorGstin).toBe('27AABCU9603R1ZJ')
      expect(result.entries[1].vendorGstin).toBe('27AABCU9603R1ZJ')
      expect(result.entries[2].vendorGstin).toBe('07AAACR5055K1Z5')
    })

    it('should handle CDNR (Credit/Debit Notes)', () => {
      const gstr2bJson: GSTR2BJson = {
        gstin: '29AABCT1234Q1ZX',
        fp: '012024',
        cdnr: [
          {
            ctin: '27AABCU9603R1ZJ',
            trdnm: 'Test Vendor',
            nt: [
              {
                ntnum: 'CN-001',
                ntdt: '20-01-2024',
                val: 5000,
                txval: 4237.29,
                igst: 762.71,
                typ: 'C', // Credit note
              },
            ],
          },
        ],
      }

      const result = parseGSTR2B(gstr2bJson)

      expect(result.success).toBe(true)
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0]).toMatchObject({
        vendorGstin: '27AABCU9603R1ZJ',
        invoiceNumber: 'CN-001',
        supplyType: 'CDNR',
      })
    })

    it('should handle empty B2B section', () => {
      const gstr2bJson: GSTR2BJson = {
        gstin: '29AABCT1234Q1ZX',
        fp: '012024',
        b2b: [],
      }

      const result = parseGSTR2B(gstr2bJson)

      expect(result.success).toBe(true)
      expect(result.entries).toHaveLength(0)
    })

    it('should handle missing optional fields', () => {
      const gstr2bJson: GSTR2BJson = {
        gstin: '29AABCT1234Q1ZX',
        fp: '012024',
        b2b: [
          {
            ctin: '27AABCU9603R1ZJ',
            inv: [
              {
                inum: 'INV-001',
                idt: '15-01-2024',
                val: 10000,
                txval: 8474.58,
              },
            ],
          },
        ],
      }

      const result = parseGSTR2B(gstr2bJson)

      expect(result.success).toBe(true)
      expect(result.entries[0]).toMatchObject({
        vendorName: undefined,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
      })
    })

    it('should return error for invalid JSON structure', () => {
      const invalidJson = {
        invalid: 'data',
      } as unknown as GSTR2BJson

      const result = parseGSTR2B(invalidJson)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle IEC section for imports', () => {
      const gstr2bJson: GSTR2BJson = {
        gstin: '29AABCT1234Q1ZX',
        fp: '012024',
        impg: [
          {
            refdt: '10-01-2024',
            portcd: 'INMAA1',
            benum: '1234567',
            bedt: '10-01-2024',
            txval: 50000,
            igst: 9000,
            cess: 0,
          },
        ],
      }

      const result = parseGSTR2B(gstr2bJson)

      expect(result.success).toBe(true)
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0]).toMatchObject({
        supplyType: 'IMPG',
        invoiceNumber: '1234567', // Bill of Entry number
        taxableValue: 50000,
        igst: 9000,
      })
    })

    it('should calculate total ITC available', () => {
      const gstr2bJson: GSTR2BJson = {
        gstin: '29AABCT1234Q1ZX',
        fp: '012024',
        b2b: [
          {
            ctin: '27AABCU9603R1ZJ',
            inv: [
              { inum: 'INV-001', idt: '15-01-2024', val: 118000, txval: 100000, igst: 18000, itcavl: 'Y' },
              { inum: 'INV-002', idt: '20-01-2024', val: 59000, txval: 50000, cgst: 4500, sgst: 4500, itcavl: 'Y' },
            ],
          },
        ],
      }

      const result = parseGSTR2B(gstr2bJson)

      expect(result.success).toBe(true)
      expect(result.summary).toMatchObject({
        totalInvoices: 2,
        totalTaxableValue: 150000,
        totalIgst: 18000,
        totalCgst: 4500,
        totalSgst: 4500,
        totalCess: 0,
        totalItcAvailable: 27000, // 18000 + 4500 + 4500
      })
    })
  })

  describe('parseGSTR2BEntry', () => {
    it('should parse a single B2B invoice entry', () => {
      const rawEntry = {
        inum: 'INV/2024/001',
        idt: '15-01-2024',
        val: 118000,
        txval: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
        cess: 0,
        itcavl: 'Y',
        rsn: '',
      }

      const entry = parseGSTR2BEntry(rawEntry, '27AABCU9603R1ZJ', 'Test Vendor', 'B2B')

      expect(entry).toMatchObject({
        vendorGstin: '27AABCU9603R1ZJ',
        vendorName: 'Test Vendor',
        invoiceNumber: 'INV/2024/001',
        invoiceValue: 118000,
        taxableValue: 100000,
        igst: 18000,
        cgst: 0,
        sgst: 0,
        cess: 0,
        itcAvailability: 'Y',
        supplyType: 'B2B',
      })
      expect(entry.invoiceDate).toBeInstanceOf(Date)
    })

    it('should handle ITC not available entries', () => {
      const rawEntry = {
        inum: 'INV-001',
        idt: '15-01-2024',
        val: 10000,
        txval: 8474.58,
        igst: 1525.42,
        itcavl: 'N',
        rsn: 'POS', // Place of Supply issue
      }

      const entry = parseGSTR2BEntry(rawEntry, '27AABCU9603R1ZJ', 'Vendor', 'B2B')

      expect(entry.itcAvailability).toBe('N')
      expect(entry.reason).toBe('POS')
    })
  })

  describe('normalizeInvoiceNumber', () => {
    it('should normalize invoice numbers by removing spaces and special characters', () => {
      expect(normalizeInvoiceNumber('INV 001')).toBe('INV001')
      expect(normalizeInvoiceNumber('INV-001')).toBe('INV001')
      expect(normalizeInvoiceNumber('INV/2024/001')).toBe('INV2024001')
      expect(normalizeInvoiceNumber('  INV 001  ')).toBe('INV001')
    })

    it('should convert to uppercase', () => {
      expect(normalizeInvoiceNumber('inv-001')).toBe('INV001')
      expect(normalizeInvoiceNumber('Invoice/abc')).toBe('INVOICEABC')
    })

    it('should handle empty or null values', () => {
      expect(normalizeInvoiceNumber('')).toBe('')
      expect(normalizeInvoiceNumber(null as unknown as string)).toBe('')
      expect(normalizeInvoiceNumber(undefined as unknown as string)).toBe('')
    })
  })

  describe('parseGSTR2BDate', () => {
    it('should parse DD-MM-YYYY format', () => {
      const date = parseGSTR2BDate('15-01-2024')
      expect(date.getFullYear()).toBe(2024)
      expect(date.getMonth()).toBe(0) // January
      expect(date.getDate()).toBe(15)
    })

    it('should parse DD/MM/YYYY format', () => {
      const date = parseGSTR2BDate('15/01/2024')
      expect(date.getFullYear()).toBe(2024)
      expect(date.getMonth()).toBe(0)
      expect(date.getDate()).toBe(15)
    })

    it('should handle invalid dates gracefully', () => {
      expect(() => parseGSTR2BDate('invalid')).toThrow()
      expect(() => parseGSTR2BDate('')).toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle very large invoice values', () => {
      const gstr2bJson: GSTR2BJson = {
        gstin: '29AABCT1234Q1ZX',
        fp: '012024',
        b2b: [
          {
            ctin: '27AABCU9603R1ZJ',
            inv: [
              {
                inum: 'INV-001',
                idt: '15-01-2024',
                val: 99999999999.99,
                txval: 84745762711.86,
                igst: 15254237288.13,
              },
            ],
          },
        ],
      }

      const result = parseGSTR2B(gstr2bJson)

      expect(result.success).toBe(true)
      expect(result.entries[0].invoiceValue).toBe(99999999999.99)
    })

    it('should handle decimal precision correctly', () => {
      const gstr2bJson: GSTR2BJson = {
        gstin: '29AABCT1234Q1ZX',
        fp: '012024',
        b2b: [
          {
            ctin: '27AABCU9603R1ZJ',
            inv: [
              {
                inum: 'INV-001',
                idt: '15-01-2024',
                val: 1000.50,
                txval: 847.88,
                igst: 152.62,
              },
            ],
          },
        ],
      }

      const result = parseGSTR2B(gstr2bJson)

      expect(result.success).toBe(true)
      expect(result.entries[0].invoiceValue).toBe(1000.50)
      expect(result.entries[0].taxableValue).toBe(847.88)
      expect(result.entries[0].igst).toBe(152.62)
    })

    it('should handle amended invoices (B2BA)', () => {
      const gstr2bJson: GSTR2BJson = {
        gstin: '29AABCT1234Q1ZX',
        fp: '012024',
        b2ba: [
          {
            ctin: '27AABCU9603R1ZJ',
            inv: [
              {
                oinum: 'INV-001', // Original invoice number
                oidt: '15-12-2023', // Original invoice date
                inum: 'INV-001-A',
                idt: '15-01-2024',
                val: 12000,
                txval: 10169.49,
                igst: 1830.51,
              },
            ],
          },
        ],
      }

      const result = parseGSTR2B(gstr2bJson)

      expect(result.success).toBe(true)
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].supplyType).toBe('B2BA')
    })
  })
})
