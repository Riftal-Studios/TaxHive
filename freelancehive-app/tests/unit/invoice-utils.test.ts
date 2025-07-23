import { describe, it, expect } from 'vitest'
import { 
  generateInvoiceNumber, 
  getCurrentFiscalYear,
  getFiscalYearFromDate,
  calculateDueDate,
  formatCurrency
} from '@/lib/invoice-utils'

describe('Invoice Utils', () => {
  describe('getCurrentFiscalYear', () => {
    it('should return correct fiscal year for dates after March', () => {
      // April 2024 should be FY 2024-25
      const april2024 = new Date('2024-04-15')
      expect(getCurrentFiscalYear(april2024)).toBe('2024-25')
      
      // December 2024 should be FY 2024-25
      const dec2024 = new Date('2024-12-15')
      expect(getCurrentFiscalYear(dec2024)).toBe('2024-25')
    })

    it('should return correct fiscal year for dates before April', () => {
      // March 2024 should be FY 2023-24
      const march2024 = new Date('2024-03-15')
      expect(getCurrentFiscalYear(march2024)).toBe('2023-24')
      
      // January 2024 should be FY 2023-24
      const jan2024 = new Date('2024-01-15')
      expect(getCurrentFiscalYear(jan2024)).toBe('2023-24')
    })

    it('should handle edge case of April 1st', () => {
      const april1 = new Date('2024-04-01')
      expect(getCurrentFiscalYear(april1)).toBe('2024-25')
      
      const march31 = new Date('2024-03-31')
      expect(getCurrentFiscalYear(march31)).toBe('2023-24')
    })
  })

  describe('generateInvoiceNumber', () => {
    it('should generate invoice number in correct format', () => {
      const fiscalYear = '2024-25'
      const sequenceNumber = 1
      expect(generateInvoiceNumber(fiscalYear, sequenceNumber)).toBe('FY24-25/001')
    })

    it('should pad sequence number with zeros', () => {
      expect(generateInvoiceNumber('2024-25', 1)).toBe('FY24-25/001')
      expect(generateInvoiceNumber('2024-25', 42)).toBe('FY24-25/042')
      expect(generateInvoiceNumber('2024-25', 999)).toBe('FY24-25/999')
      expect(generateInvoiceNumber('2024-25', 1234)).toBe('FY24-25/1234')
    })

    it('should handle different fiscal years correctly', () => {
      expect(generateInvoiceNumber('2023-24', 1)).toBe('FY23-24/001')
      expect(generateInvoiceNumber('2025-26', 100)).toBe('FY25-26/100')
    })
  })

  describe('calculateDueDate', () => {
    it('should calculate due date based on payment terms', () => {
      const invoiceDate = new Date('2024-01-15')
      
      // Net 30
      const dueDate30 = calculateDueDate(invoiceDate, 30)
      expect(dueDate30).toEqual(new Date('2024-02-14'))
      
      // Net 15
      const dueDate15 = calculateDueDate(invoiceDate, 15)
      expect(dueDate15).toEqual(new Date('2024-01-30'))
      
      // Net 7
      const dueDate7 = calculateDueDate(invoiceDate, 7)
      expect(dueDate7).toEqual(new Date('2024-01-22'))
    })

    it('should handle month boundaries correctly', () => {
      const invoiceDate = new Date('2024-01-31')
      const dueDate = calculateDueDate(invoiceDate, 30)
      expect(dueDate).toEqual(new Date('2024-03-01')) // Feb has 29 days in 2024
    })
  })

  describe('formatCurrency', () => {
    it('should format INR currency correctly', () => {
      expect(formatCurrency(1000, 'INR')).toBe('₹1,000.00')
      expect(formatCurrency(1234567.89, 'INR')).toBe('₹12,34,567.89')
      expect(formatCurrency(0, 'INR')).toBe('₹0.00')
    })

    it('should format USD currency correctly', () => {
      expect(formatCurrency(1000, 'USD')).toBe('$1,000.00')
      expect(formatCurrency(1234567.89, 'USD')).toBe('$1,234,567.89')
    })

    it('should format EUR currency correctly', () => {
      expect(formatCurrency(1000, 'EUR')).toBe('€1,000.00')
      expect(formatCurrency(1234567.89, 'EUR')).toBe('€1,234,567.89')
    })

    it('should format GBP currency correctly', () => {
      expect(formatCurrency(1000, 'GBP')).toBe('£1,000.00')
      expect(formatCurrency(1234567.89, 'GBP')).toBe('£1,234,567.89')
    })
  })
})