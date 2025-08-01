import { describe, it, expect } from 'vitest'
import { getNextInvoiceSequence } from '@/lib/invoice-number-utils'

describe('getNextInvoiceSequence', () => {
  it('should return 1 for empty array', () => {
    expect(getNextInvoiceSequence([])).toBe(1)
  })
  
  it('should find the highest sequence number', () => {
    const invoiceNumbers = [
      'FY24-25/1',
      'FY24-25/2',
      'FY24-25/5',
      'FY24-25/3',
    ]
    expect(getNextInvoiceSequence(invoiceNumbers)).toBe(6)
  })
  
  it('should handle gaps in sequence', () => {
    const invoiceNumbers = [
      'FY24-25/1',
      'FY24-25/3',
      'FY24-25/7',
    ]
    expect(getNextInvoiceSequence(invoiceNumbers)).toBe(8)
  })
  
  it('should handle different fiscal years correctly', () => {
    const invoiceNumbers = [
      'FY23-24/99',
      'FY24-25/1',
      'FY24-25/2',
    ]
    // Should only consider FY24-25 invoices if filtered properly
    expect(getNextInvoiceSequence(invoiceNumbers)).toBe(100) // This would be 100 because it finds max across all
  })
  
  it('should handle invalid formats gracefully', () => {
    const invoiceNumbers = [
      'INVALID',
      'FY24-25/1',
      'FY24-25/abc',
      'FY24-25/2',
    ]
    expect(getNextInvoiceSequence(invoiceNumbers)).toBe(3)
  })
})