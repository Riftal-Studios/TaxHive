import { describe, it, expect } from 'vitest'
import {
  validateFilingItem,
  ValidationFlag,
  FlagSeverity,
  type InvoiceForValidation,
} from '@/lib/gst-filing/validation'

describe('Filing Item Validation', () => {
  describe('LUT Validation', () => {
    it('should flag export invoice without LUT', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'EXPORT',
        isRCM: false,
        clientCountry: 'US',
        clientGstin: null,
        lutId: null,
        lutExpiryDate: null,
        invoiceDate: new Date('2024-06-15'),
        totalInINR: 100000,
        igstAmount: 0, // No IGST means should have LUT
        paymentVoucherId: null,
      }

      const flags = validateFilingItem(invoice, '2024-06')
      const lutFlag = flags.find((f) => f.code === 'EXPORT_NO_LUT')

      expect(lutFlag).toBeDefined()
      expect(lutFlag?.severity).toBe(FlagSeverity.WARNING)
    })

    it('should flag export invoice with expired LUT', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'EXPORT',
        isRCM: false,
        clientCountry: 'US',
        clientGstin: null,
        lutId: 'lut-123',
        lutExpiryDate: new Date('2024-03-31'), // FY ended
        invoiceDate: new Date('2024-06-15'), // After LUT expiry
        totalInINR: 100000,
        igstAmount: 0,
        paymentVoucherId: null,
      }

      const flags = validateFilingItem(invoice, '2024-06')
      const lutFlag = flags.find((f) => f.code === 'LUT_EXPIRED')

      expect(lutFlag).toBeDefined()
      expect(lutFlag?.severity).toBe(FlagSeverity.ERROR)
    })

    it('should not flag export with valid LUT', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'EXPORT',
        isRCM: false,
        clientCountry: 'US',
        clientGstin: null,
        lutId: 'lut-123',
        lutExpiryDate: new Date('2025-03-31'), // Valid
        invoiceDate: new Date('2024-06-15'),
        totalInINR: 100000,
        igstAmount: 0,
        paymentVoucherId: null,
      }

      const flags = validateFilingItem(invoice, '2024-06')
      const lutFlags = flags.filter(
        (f) => f.code === 'EXPORT_NO_LUT' || f.code === 'LUT_EXPIRED'
      )

      expect(lutFlags).toHaveLength(0)
    })

    it('should not flag export with IGST payment (no LUT needed)', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'EXPORT',
        isRCM: false,
        clientCountry: 'US',
        clientGstin: null,
        lutId: null, // No LUT
        lutExpiryDate: null,
        invoiceDate: new Date('2024-06-15'),
        totalInINR: 118000,
        igstAmount: 18000, // IGST paid - LUT not required
        paymentVoucherId: null,
      }

      const flags = validateFilingItem(invoice, '2024-06')
      const lutFlag = flags.find((f) => f.code === 'EXPORT_NO_LUT')

      expect(lutFlag).toBeUndefined()
    })
  })

  describe('High Value Transaction', () => {
    it('should flag transaction above ₹10L', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'EXPORT',
        isRCM: false,
        clientCountry: 'US',
        clientGstin: null,
        lutId: 'lut-123',
        lutExpiryDate: new Date('2025-03-31'),
        invoiceDate: new Date('2024-06-15'),
        totalInINR: 1500000, // ₹15L
        igstAmount: 0,
        paymentVoucherId: null,
      }

      const flags = validateFilingItem(invoice, '2024-06')
      const highValueFlag = flags.find((f) => f.code === 'HIGH_VALUE_TRANSACTION')

      expect(highValueFlag).toBeDefined()
      expect(highValueFlag?.severity).toBe(FlagSeverity.INFO)
    })

    it('should not flag transaction below ₹10L', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'EXPORT',
        isRCM: false,
        clientCountry: 'US',
        clientGstin: null,
        lutId: 'lut-123',
        lutExpiryDate: new Date('2025-03-31'),
        invoiceDate: new Date('2024-06-15'),
        totalInINR: 500000, // ₹5L
        igstAmount: 0,
        paymentVoucherId: null,
      }

      const flags = validateFilingItem(invoice, '2024-06')
      const highValueFlag = flags.find((f) => f.code === 'HIGH_VALUE_TRANSACTION')

      expect(highValueFlag).toBeUndefined()
    })
  })

  describe('Period Validation', () => {
    it('should flag invoice outside filing period', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'EXPORT',
        isRCM: false,
        clientCountry: 'US',
        clientGstin: null,
        lutId: 'lut-123',
        lutExpiryDate: new Date('2025-03-31'),
        invoiceDate: new Date('2024-05-15'), // May invoice
        totalInINR: 100000,
        igstAmount: 0,
        paymentVoucherId: null,
      }

      const flags = validateFilingItem(invoice, '2024-06') // Filing for June
      const periodFlag = flags.find((f) => f.code === 'INVOICE_OUTSIDE_PERIOD')

      expect(periodFlag).toBeDefined()
      expect(periodFlag?.severity).toBe(FlagSeverity.WARNING)
    })

    it('should not flag invoice within filing period', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'EXPORT',
        isRCM: false,
        clientCountry: 'US',
        clientGstin: null,
        lutId: 'lut-123',
        lutExpiryDate: new Date('2025-03-31'),
        invoiceDate: new Date('2024-06-15'), // June invoice
        totalInINR: 100000,
        igstAmount: 0,
        paymentVoucherId: null,
      }

      const flags = validateFilingItem(invoice, '2024-06') // Filing for June
      const periodFlag = flags.find((f) => f.code === 'INVOICE_OUTSIDE_PERIOD')

      expect(periodFlag).toBeUndefined()
    })
  })

  describe('RCM Validation', () => {
    it('should flag RCM self-invoice without payment voucher', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'SELF_INVOICE',
        isRCM: true,
        clientCountry: 'IN',
        clientGstin: null,
        lutId: null,
        lutExpiryDate: null,
        invoiceDate: new Date('2024-06-15'),
        totalInINR: 50000,
        igstAmount: 0,
        paymentVoucherId: null, // No payment voucher
      }

      const flags = validateFilingItem(invoice, '2024-06')
      const rcmFlag = flags.find((f) => f.code === 'RCM_NO_PAYMENT_VOUCHER')

      expect(rcmFlag).toBeDefined()
      expect(rcmFlag?.severity).toBe(FlagSeverity.WARNING)
    })

    it('should not flag RCM with payment voucher', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'SELF_INVOICE',
        isRCM: true,
        clientCountry: 'IN',
        clientGstin: null,
        lutId: null,
        lutExpiryDate: null,
        invoiceDate: new Date('2024-06-15'),
        totalInINR: 50000,
        igstAmount: 0,
        paymentVoucherId: 'pv-123', // Has payment voucher
      }

      const flags = validateFilingItem(invoice, '2024-06')
      const rcmFlag = flags.find((f) => f.code === 'RCM_NO_PAYMENT_VOUCHER')

      expect(rcmFlag).toBeUndefined()
    })
  })

  describe('Confidence Score Calculation', () => {
    it('should return 100% confidence for invoice with no flags', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'EXPORT',
        isRCM: false,
        clientCountry: 'US',
        clientGstin: null,
        lutId: 'lut-123',
        lutExpiryDate: new Date('2025-03-31'),
        invoiceDate: new Date('2024-06-15'),
        totalInINR: 100000,
        igstAmount: 0,
        paymentVoucherId: null,
      }

      const flags = validateFilingItem(invoice, '2024-06')
      expect(flags).toHaveLength(0)
    })

    it('should accumulate multiple flags', () => {
      const invoice: InvoiceForValidation = {
        invoiceType: 'EXPORT',
        isRCM: false,
        clientCountry: 'US',
        clientGstin: null,
        lutId: 'lut-123',
        lutExpiryDate: new Date('2024-03-31'), // Expired LUT
        invoiceDate: new Date('2024-05-15'), // Wrong period
        totalInINR: 1500000, // High value
        igstAmount: 0,
        paymentVoucherId: null,
      }

      const flags = validateFilingItem(invoice, '2024-06')

      // Should have: LUT_EXPIRED, INVOICE_OUTSIDE_PERIOD, HIGH_VALUE_TRANSACTION
      expect(flags.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Flag Severity Levels', () => {
    it('should have correct severity for each flag type', () => {
      expect(FlagSeverity.ERROR).toBe('error')
      expect(FlagSeverity.WARNING).toBe('warning')
      expect(FlagSeverity.INFO).toBe('info')
    })
  })
})

describe('Validation Flag Messages', () => {
  it('should provide meaningful messages for each flag', () => {
    const invoice: InvoiceForValidation = {
      invoiceType: 'EXPORT',
      isRCM: false,
      clientCountry: 'US',
      clientGstin: null,
      lutId: null,
      lutExpiryDate: null,
      invoiceDate: new Date('2024-06-15'),
      totalInINR: 100000,
      igstAmount: 0,
      paymentVoucherId: null,
    }

    const flags = validateFilingItem(invoice, '2024-06')
    const lutFlag = flags.find((f) => f.code === 'EXPORT_NO_LUT')

    expect(lutFlag?.message).toContain('LUT')
    expect(lutFlag?.message.length).toBeGreaterThan(10)
  })
})
