import { describe, it, expect } from 'vitest'
import {
  classifyForGSTR1,
  classifyForGSTR3B,
  GSTR1Table,
  GSTR3BSection,
  type InvoiceForClassification,
} from '@/lib/gst-filing/classification'

describe('GSTR-1 Table Classification', () => {
  describe('classifyForGSTR1', () => {
    it('should classify export invoice with LUT as Table 6A', () => {
      const invoice: InvoiceForClassification = {
        invoiceType: 'EXPORT',
        isRCM: false,
        rcmType: null,
        lutId: 'lut-123',
        clientGstin: null,
        clientCountry: 'US',
        totalInINR: 100000,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
      }

      const result = classifyForGSTR1(invoice)
      expect(result.table).toBe(GSTR1Table.EXPORTS_WITH_LUT)
      expect(result.tableCode).toBe('6A')
    })

    it('should classify RCM self-invoice as not applicable for GSTR-1', () => {
      const invoice: InvoiceForClassification = {
        invoiceType: 'SELF_INVOICE',
        isRCM: true,
        rcmType: 'INDIAN_UNREGISTERED',
        lutId: null,
        clientGstin: null,
        clientCountry: 'IN',
        totalInINR: 50000,
        igstAmount: 0,
        cgstAmount: 4500,
        sgstAmount: 4500,
      }

      const result = classifyForGSTR1(invoice)
      expect(result.table).toBe(GSTR1Table.NOT_APPLICABLE)
      expect(result.tableCode).toBeNull()
    })

    it('should classify domestic B2B invoice with GSTIN as Table 4A', () => {
      const invoice: InvoiceForClassification = {
        invoiceType: 'EXPORT', // We're using EXPORT type for regular invoices too currently
        isRCM: false,
        rcmType: null,
        lutId: null,
        clientGstin: '27AAAAA0000A1Z5',
        clientCountry: 'IN',
        totalInINR: 118000,
        igstAmount: 18000,
        cgstAmount: 0,
        sgstAmount: 0,
      }

      const result = classifyForGSTR1(invoice)
      expect(result.table).toBe(GSTR1Table.B2B)
      expect(result.tableCode).toBe('4A')
    })

    it('should classify large domestic B2C invoice (>₹2.5L) as Table 5', () => {
      const invoice: InvoiceForClassification = {
        invoiceType: 'EXPORT',
        isRCM: false,
        rcmType: null,
        lutId: null,
        clientGstin: null, // No GSTIN - unregistered Indian client
        clientCountry: 'IN',
        totalInINR: 300000, // > ₹2.5L
        igstAmount: 45762,
        cgstAmount: 0,
        sgstAmount: 0,
      }

      const result = classifyForGSTR1(invoice)
      expect(result.table).toBe(GSTR1Table.B2C_LARGE)
      expect(result.tableCode).toBe('5')
    })

    it('should classify small domestic B2C invoice (<₹2.5L) as Table 7 (B2C others)', () => {
      const invoice: InvoiceForClassification = {
        invoiceType: 'EXPORT',
        isRCM: false,
        rcmType: null,
        lutId: null,
        clientGstin: null, // No GSTIN - unregistered Indian client
        clientCountry: 'IN',
        totalInINR: 100000, // < ₹2.5L
        igstAmount: 15254,
        cgstAmount: 0,
        sgstAmount: 0,
      }

      const result = classifyForGSTR1(invoice)
      expect(result.table).toBe(GSTR1Table.B2C_SMALL)
      expect(result.tableCode).toBe('7')
    })

    it('should classify export without LUT with IGST as Table 6A exports', () => {
      // Exports without LUT should still go to 6A but with tax
      const invoice: InvoiceForClassification = {
        invoiceType: 'EXPORT',
        isRCM: false,
        rcmType: null,
        lutId: null, // No LUT
        clientGstin: null,
        clientCountry: 'US',
        totalInINR: 100000,
        igstAmount: 18000, // IGST charged
        cgstAmount: 0,
        sgstAmount: 0,
      }

      const result = classifyForGSTR1(invoice)
      expect(result.table).toBe(GSTR1Table.EXPORTS_WITH_PAYMENT)
      expect(result.tableCode).toBe('6A')
    })
  })
})

describe('GSTR-3B Section Classification', () => {
  describe('classifyForGSTR3B', () => {
    it('should classify export invoice with LUT as Section 3.1(b) zero-rated', () => {
      const invoice: InvoiceForClassification = {
        invoiceType: 'EXPORT',
        isRCM: false,
        rcmType: null,
        lutId: 'lut-123',
        clientGstin: null,
        clientCountry: 'US',
        totalInINR: 100000,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
      }

      const result = classifyForGSTR3B(invoice)
      expect(result.section).toBe(GSTR3BSection.ZERO_RATED)
      expect(result.sectionCode).toBe('3.1(b)')
      expect(result.taxableValue).toBe(100000)
      expect(result.igst).toBe(0)
    })

    it('should classify Indian unregistered RCM as Section 3.1(d) inward RCM', () => {
      const invoice: InvoiceForClassification = {
        invoiceType: 'SELF_INVOICE',
        isRCM: true,
        rcmType: 'INDIAN_UNREGISTERED',
        lutId: null,
        clientGstin: null,
        clientCountry: 'IN',
        totalInINR: 50000,
        igstAmount: 0,
        cgstAmount: 4500,
        sgstAmount: 4500,
      }

      const result = classifyForGSTR3B(invoice)
      expect(result.section).toBe(GSTR3BSection.INWARD_RCM)
      expect(result.sectionCode).toBe('3.1(d)')
      expect(result.taxableValue).toBe(50000)
      expect(result.cgst).toBe(4500)
      expect(result.sgst).toBe(4500)
    })

    it('should classify import of services RCM as Section 3.1(a) outward taxable', () => {
      // Import of services goes to 3.1(a) along with regular outward supplies
      const invoice: InvoiceForClassification = {
        invoiceType: 'SELF_INVOICE',
        isRCM: true,
        rcmType: 'IMPORT_OF_SERVICES',
        lutId: null,
        clientGstin: null,
        clientCountry: 'US',
        totalInINR: 85000, // Converted to INR
        igstAmount: 15300, // 18% IGST on import of services
        cgstAmount: 0,
        sgstAmount: 0,
      }

      const result = classifyForGSTR3B(invoice)
      expect(result.section).toBe(GSTR3BSection.OUTWARD_TAXABLE)
      expect(result.sectionCode).toBe('3.1(a)')
      expect(result.igst).toBe(15300)
    })

    it('should classify domestic B2B invoice as Section 3.1(a) outward taxable', () => {
      const invoice: InvoiceForClassification = {
        invoiceType: 'EXPORT',
        isRCM: false,
        rcmType: null,
        lutId: null,
        clientGstin: '27AAAAA0000A1Z5',
        clientCountry: 'IN',
        totalInINR: 118000,
        igstAmount: 18000,
        cgstAmount: 0,
        sgstAmount: 0,
      }

      const result = classifyForGSTR3B(invoice)
      expect(result.section).toBe(GSTR3BSection.OUTWARD_TAXABLE)
      expect(result.sectionCode).toBe('3.1(a)')
      expect(result.taxableValue).toBe(118000)
      expect(result.igst).toBe(18000)
    })

    it('should classify domestic B2C invoice as Section 3.1(a) outward taxable', () => {
      const invoice: InvoiceForClassification = {
        invoiceType: 'EXPORT',
        isRCM: false,
        rcmType: null,
        lutId: null,
        clientGstin: null,
        clientCountry: 'IN',
        totalInINR: 118000,
        igstAmount: 0,
        cgstAmount: 9000,
        sgstAmount: 9000,
      }

      const result = classifyForGSTR3B(invoice)
      expect(result.section).toBe(GSTR3BSection.OUTWARD_TAXABLE)
      expect(result.sectionCode).toBe('3.1(a)')
      expect(result.cgst).toBe(9000)
      expect(result.sgst).toBe(9000)
    })

    it('should classify export with IGST payment as Section 3.1(b)', () => {
      // Export with payment still goes to 3.1(b) but with tax amounts
      const invoice: InvoiceForClassification = {
        invoiceType: 'EXPORT',
        isRCM: false,
        rcmType: null,
        lutId: null,
        clientGstin: null,
        clientCountry: 'GB',
        totalInINR: 100000,
        igstAmount: 18000,
        cgstAmount: 0,
        sgstAmount: 0,
      }

      const result = classifyForGSTR3B(invoice)
      expect(result.section).toBe(GSTR3BSection.ZERO_RATED)
      expect(result.sectionCode).toBe('3.1(b)')
      expect(result.igst).toBe(18000) // Tax included for exports with payment
    })
  })
})

describe('ITC Classification for RCM', () => {
  it('should return ITC section 4A(3) for Indian unregistered RCM', () => {
    const invoice: InvoiceForClassification = {
      invoiceType: 'SELF_INVOICE',
      isRCM: true,
      rcmType: 'INDIAN_UNREGISTERED',
      lutId: null,
      clientGstin: null,
      clientCountry: 'IN',
      totalInINR: 50000,
      igstAmount: 0,
      cgstAmount: 4500,
      sgstAmount: 4500,
    }

    const result = classifyForGSTR3B(invoice)
    expect(result.itcSection).toBe('4A(3)')
    expect(result.itcIgst).toBe(0)
    expect(result.itcCgst).toBe(4500)
    expect(result.itcSgst).toBe(4500)
  })

  it('should return ITC section 4A(3) for import of services RCM', () => {
    const invoice: InvoiceForClassification = {
      invoiceType: 'SELF_INVOICE',
      isRCM: true,
      rcmType: 'IMPORT_OF_SERVICES',
      lutId: null,
      clientGstin: null,
      clientCountry: 'US',
      totalInINR: 85000,
      igstAmount: 15300,
      cgstAmount: 0,
      sgstAmount: 0,
    }

    const result = classifyForGSTR3B(invoice)
    expect(result.itcSection).toBe('4A(3)')
    expect(result.itcIgst).toBe(15300)
    expect(result.itcCgst).toBe(0)
    expect(result.itcSgst).toBe(0)
  })

  it('should not return ITC for regular invoices', () => {
    const invoice: InvoiceForClassification = {
      invoiceType: 'EXPORT',
      isRCM: false,
      rcmType: null,
      lutId: 'lut-123',
      clientGstin: null,
      clientCountry: 'US',
      totalInINR: 100000,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
    }

    const result = classifyForGSTR3B(invoice)
    expect(result.itcSection).toBeNull()
    expect(result.itcIgst).toBe(0)
    expect(result.itcCgst).toBe(0)
    expect(result.itcSgst).toBe(0)
  })
})

describe('Edge Cases', () => {
  it('should handle zero amount invoices', () => {
    const invoice: InvoiceForClassification = {
      invoiceType: 'EXPORT',
      isRCM: false,
      rcmType: null,
      lutId: 'lut-123',
      clientGstin: null,
      clientCountry: 'US',
      totalInINR: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
    }

    const gstr1Result = classifyForGSTR1(invoice)
    const gstr3bResult = classifyForGSTR3B(invoice)

    expect(gstr1Result.table).toBe(GSTR1Table.EXPORTS_WITH_LUT)
    expect(gstr3bResult.section).toBe(GSTR3BSection.ZERO_RATED)
  })

  it('should determine Indian country correctly', () => {
    const indianInvoice: InvoiceForClassification = {
      invoiceType: 'EXPORT',
      isRCM: false,
      rcmType: null,
      lutId: null,
      clientGstin: null,
      clientCountry: 'IN',
      totalInINR: 100000,
      igstAmount: 18000,
      cgstAmount: 0,
      sgstAmount: 0,
    }

    // India without GSTIN is B2C
    const result = classifyForGSTR1(indianInvoice)
    expect(result.table).toBe(GSTR1Table.B2C_SMALL) // < 2.5L
  })

  it('should handle India country code variations', () => {
    const invoice1: InvoiceForClassification = {
      invoiceType: 'EXPORT',
      isRCM: false,
      rcmType: null,
      lutId: null,
      clientGstin: null,
      clientCountry: 'India',
      totalInINR: 100000,
      igstAmount: 18000,
      cgstAmount: 0,
      sgstAmount: 0,
    }

    const invoice2: InvoiceForClassification = {
      ...invoice1,
      clientCountry: 'IND',
    }

    expect(classifyForGSTR1(invoice1).table).toBe(GSTR1Table.B2C_SMALL)
    expect(classifyForGSTR1(invoice2).table).toBe(GSTR1Table.B2C_SMALL)
  })
})
