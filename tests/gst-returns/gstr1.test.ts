import { describe, it, expect, beforeEach } from 'vitest'
import { 
  generateGSTR1,
  aggregateB2BInvoices,
  aggregateB2CInvoices,
  generateHSNSummary,
  validateGSTR1Data
} from '@/lib/gst-returns/gstr1-generator'
import { Decimal } from '@prisma/client/runtime/library'

describe('GSTR-1 Generation', () => {
  describe('B2B Invoice Aggregation', () => {
    it('should aggregate B2B invoices by GSTIN', () => {
      const invoices = [
        {
          id: '1',
          invoiceNumber: 'FY24-25/001',
          invoiceDate: new Date('2024-05-15'),
          clientId: 'c1',
          client: {
            name: 'ABC Corp',
            gstin: '27AAECR2971C1Z5',
            stateCode: '27'
          },
          invoiceType: 'DOMESTIC_B2B',
          placeOfSupply: '27',
          taxableAmount: new Decimal(100000),
          cgstAmount: new Decimal(9000),
          sgstAmount: new Decimal(9000),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(118000),
          lineItems: []
        },
        {
          id: '2',
          invoiceNumber: 'FY24-25/002',
          invoiceDate: new Date('2024-05-20'),
          clientId: 'c1',
          client: {
            name: 'ABC Corp',
            gstin: '27AAECR2971C1Z5',
            stateCode: '27'
          },
          invoiceType: 'DOMESTIC_B2B',
          placeOfSupply: '27',
          taxableAmount: new Decimal(50000),
          cgstAmount: new Decimal(4500),
          sgstAmount: new Decimal(4500),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(59000),
          lineItems: []
        }
      ]

      const result = aggregateB2BInvoices(invoices)

      expect(result).toHaveLength(1)
      expect(result[0].ctin).toBe('27AAECR2971C1Z5')
      expect(result[0].inv).toHaveLength(2)
      expect(result[0].inv[0].inum).toBe('FY24-25/001')
      expect(result[0].inv[0].idt).toBe('15-05-2024')
      expect(result[0].inv[0].val).toBe(118000)
      expect(result[0].inv[0].itms[0].num).toBe(1)
      expect(result[0].inv[0].itms[0].itm_det.txval).toBe(100000)
      expect(result[0].inv[0].itms[0].itm_det.camt).toBe(9000)
      expect(result[0].inv[0].itms[0].itm_det.samt).toBe(9000)
      expect(result[0].inv[0].itms[0].itm_det.iamt).toBe(0)
    })

    it('should handle inter-state B2B invoices with IGST', () => {
      const invoices = [
        {
          id: '1',
          invoiceNumber: 'FY24-25/003',
          invoiceDate: new Date('2024-05-25'),
          clientId: 'c2',
          client: {
            name: 'XYZ Ltd',
            gstin: '29AAECR2971C1Z5',
            stateCode: '29'
          },
          invoiceType: 'DOMESTIC_B2B',
          placeOfSupply: '29',
          taxableAmount: new Decimal(200000),
          cgstAmount: new Decimal(0),
          sgstAmount: new Decimal(0),
          igstAmount: new Decimal(36000),
          totalAmount: new Decimal(236000),
          lineItems: []
        }
      ]

      const result = aggregateB2BInvoices(invoices)

      expect(result[0].ctin).toBe('29AAECR2971C1Z5')
      expect(result[0].inv[0].itms[0].itm_det.iamt).toBe(36000)
      expect(result[0].inv[0].itms[0].itm_det.camt).toBe(0)
      expect(result[0].inv[0].itms[0].itm_det.samt).toBe(0)
    })

    it('should group multiple invoices by different GSTINs', () => {
      const invoices = [
        {
          id: '1',
          invoiceNumber: 'FY24-25/001',
          invoiceDate: new Date('2024-05-15'),
          clientId: 'c1',
          client: {
            name: 'ABC Corp',
            gstin: '27AAECR2971C1Z5',
            stateCode: '27'
          },
          invoiceType: 'DOMESTIC_B2B',
          placeOfSupply: '27',
          taxableAmount: new Decimal(100000),
          cgstAmount: new Decimal(9000),
          sgstAmount: new Decimal(9000),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(118000),
          lineItems: []
        },
        {
          id: '2',
          invoiceNumber: 'FY24-25/002',
          invoiceDate: new Date('2024-05-20'),
          clientId: 'c2',
          client: {
            name: 'XYZ Ltd',
            gstin: '29AAECR2971C1Z5',
            stateCode: '29'
          },
          invoiceType: 'DOMESTIC_B2B',
          placeOfSupply: '29',
          taxableAmount: new Decimal(50000),
          cgstAmount: new Decimal(0),
          sgstAmount: new Decimal(0),
          igstAmount: new Decimal(9000),
          totalAmount: new Decimal(59000),
          lineItems: []
        }
      ]

      const result = aggregateB2BInvoices(invoices)

      expect(result).toHaveLength(2)
      expect(result.find(r => r.ctin === '27AAECR2971C1Z5')).toBeDefined()
      expect(result.find(r => r.ctin === '29AAECR2971C1Z5')).toBeDefined()
    })
  })

  describe('B2C Invoice Aggregation', () => {
    it('should aggregate B2C large invoices (>2.5L) by state', () => {
      const invoices = [
        {
          id: '1',
          invoiceNumber: 'FY24-25/010',
          invoiceDate: new Date('2024-05-15'),
          clientId: 'c3',
          client: {
            name: 'Retail Customer',
            gstin: null,
            stateCode: '27'
          },
          invoiceType: 'DOMESTIC_B2C',
          placeOfSupply: '27',
          taxableAmount: new Decimal(300000),
          cgstAmount: new Decimal(27000),
          sgstAmount: new Decimal(27000),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(354000),
          lineItems: []
        }
      ]

      const result = aggregateB2CInvoices(invoices)

      expect(result.b2cl).toHaveLength(1)
      expect(result.b2cl[0].pos).toBe('27')
      expect(result.b2cl[0].inv[0].inum).toBe('FY24-25/010')
      expect(result.b2cl[0].inv[0].idt).toBe('15-05-2024')
      expect(result.b2cl[0].inv[0].val).toBe(354000)
    })

    it('should aggregate B2C small invoices (<2.5L) state-wise', () => {
      const invoices = [
        {
          id: '1',
          invoiceNumber: 'FY24-25/011',
          invoiceDate: new Date('2024-05-16'),
          clientId: 'c4',
          client: {
            name: 'Small Retail',
            gstin: null,
            stateCode: '27'
          },
          invoiceType: 'DOMESTIC_B2C',
          placeOfSupply: '27',
          taxableAmount: new Decimal(10000),
          cgstAmount: new Decimal(900),
          sgstAmount: new Decimal(900),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(11800),
          lineItems: []
        },
        {
          id: '2',
          invoiceNumber: 'FY24-25/012',
          invoiceDate: new Date('2024-05-17'),
          clientId: 'c5',
          client: {
            name: 'Another Small Retail',
            gstin: null,
            stateCode: '27'
          },
          invoiceType: 'DOMESTIC_B2C',
          placeOfSupply: '27',
          taxableAmount: new Decimal(20000),
          cgstAmount: new Decimal(1800),
          sgstAmount: new Decimal(1800),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(23600),
          lineItems: []
        }
      ]

      const result = aggregateB2CInvoices(invoices)

      expect(result.b2cs).toHaveLength(1)
      expect(result.b2cs[0].pos).toBe('27')
      expect(result.b2cs[0].typ).toBe('OE') // Other than E-commerce
      expect(result.b2cs[0].txval).toBe(30000) // Combined taxable value
      expect(result.b2cs[0].camt).toBe(2700)
      expect(result.b2cs[0].samt).toBe(2700)
    })

    it('should treat exports as B2C', () => {
      const invoices = [
        {
          id: '1',
          invoiceNumber: 'FY24-25/020',
          invoiceDate: new Date('2024-05-20'),
          clientId: 'c6',
          client: {
            name: 'Foreign Client',
            gstin: null,
            country: 'USA',
            stateCode: '96' // Export
          },
          invoiceType: 'EXPORT',
          placeOfSupply: 'Outside India (Section 2-6)',
          taxableAmount: new Decimal(500000),
          cgstAmount: new Decimal(0),
          sgstAmount: new Decimal(0),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(500000),
          lineItems: [],
          shippingBillNo: 'SB001',
          shippingBillDate: new Date('2024-05-20'),
          portCode: 'INNSA1'
        }
      ]

      const result = aggregateB2CInvoices(invoices)

      expect(result.exp).toHaveLength(1)
      expect(result.exp[0].exp_typ).toBe('WPAY') // With payment
      expect(result.exp[0].inv[0].inum).toBe('FY24-25/020')
      expect(result.exp[0].inv[0].val).toBe(500000)
      expect(result.exp[0].inv[0].sbnum).toBe('SB001')
      expect(result.exp[0].inv[0].sbdt).toBe('20-05-2024')
      expect(result.exp[0].inv[0].sbpcode).toBe('INNSA1')
    })
  })

  describe('HSN Summary Generation', () => {
    it('should generate HSN summary split by B2B and B2C', () => {
      const invoices = [
        {
          id: '1',
          invoiceType: 'DOMESTIC_B2B',
          lineItems: [
            {
              id: 'li1',
              description: 'Software Development',
              serviceCode: '998314',
              quantity: new Decimal(1),
              rate: new Decimal(100000),
              amount: new Decimal(100000),
              cgstRate: new Decimal(9),
              sgstRate: new Decimal(9),
              igstRate: new Decimal(0),
              cgstAmount: new Decimal(9000),
              sgstAmount: new Decimal(9000),
              igstAmount: new Decimal(0),
              uqc: 'OTH'
            }
          ]
        },
        {
          id: '2',
          invoiceType: 'DOMESTIC_B2C',
          lineItems: [
            {
              id: 'li2',
              description: 'Consulting Services',
              serviceCode: '998314',
              quantity: new Decimal(1),
              rate: new Decimal(50000),
              amount: new Decimal(50000),
              cgstRate: new Decimal(9),
              sgstRate: new Decimal(9),
              igstRate: new Decimal(0),
              cgstAmount: new Decimal(4500),
              sgstAmount: new Decimal(4500),
              igstAmount: new Decimal(0),
              uqc: 'OTH'
            }
          ]
        }
      ]

      const result = generateHSNSummary(invoices, 10000000) // Turnover 1cr

      expect(result.b2b).toHaveLength(1)
      expect(result.b2b[0].hsn_sc).toBe('998314')
      expect(result.b2b[0].desc).toBe('Software Development')
      expect(result.b2b[0].uqc).toBe('OTH')
      expect(result.b2b[0].qty).toBe(1)
      expect(result.b2b[0].txval).toBe(100000)
      expect(result.b2b[0].camt).toBe(9000)
      expect(result.b2b[0].samt).toBe(9000)

      expect(result.b2c).toHaveLength(1)
      expect(result.b2c[0].hsn_sc).toBe('998314')
      expect(result.b2c[0].txval).toBe(50000)
    })

    it('should use 4-digit HSN for turnover <= 5cr', () => {
      const invoices = [
        {
          id: '1',
          invoiceType: 'DOMESTIC_B2B',
          lineItems: [
            {
              id: 'li1',
              serviceCode: '99831401', // 8-digit HSN
              quantity: new Decimal(1),
              rate: new Decimal(100000),
              amount: new Decimal(100000),
              cgstRate: new Decimal(18),
              sgstRate: new Decimal(0),
              igstRate: new Decimal(0),
              cgstAmount: new Decimal(9000),
              sgstAmount: new Decimal(9000),
              igstAmount: new Decimal(0),
              uqc: 'OTH'
            }
          ]
        }
      ]

      const result = generateHSNSummary(invoices, 40000000) // Turnover 4cr

      expect(result.b2b[0].hsn_sc).toBe('9983') // Should be 4-digit
    })

    it('should use 6-digit HSN for turnover > 5cr', () => {
      const invoices = [
        {
          id: '1',
          invoiceType: 'DOMESTIC_B2B',
          lineItems: [
            {
              id: 'li1',
              serviceCode: '99831401', // 8-digit HSN
              quantity: new Decimal(1),
              rate: new Decimal(100000),
              amount: new Decimal(100000),
              cgstRate: new Decimal(18),
              sgstRate: new Decimal(0),
              igstRate: new Decimal(0),
              cgstAmount: new Decimal(9000),
              sgstAmount: new Decimal(9000),
              igstAmount: new Decimal(0),
              uqc: 'OTH'
            }
          ]
        }
      ]

      const result = generateHSNSummary(invoices, 60000000) // Turnover 6cr

      expect(result.b2b[0].hsn_sc).toBe('998314') // Should be 6-digit
    })
  })

  describe('GSTR-1 Data Validation', () => {
    it('should validate B2B invoice has GSTIN', () => {
      const invoice = {
        invoiceType: 'DOMESTIC_B2B',
        client: {
          gstin: null
        }
      }

      const result = validateGSTR1Data(invoice)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('B2B invoice must have buyer GSTIN')
    })

    it('should validate HSN code length based on turnover', () => {
      const invoice = {
        invoiceType: 'DOMESTIC_B2B',
        lineItems: [
          {
            serviceCode: '99' // Too short
          }
        ]
      }

      const result = validateGSTR1Data(invoice, 60000000)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('HSN code must be at least 6 digits for turnover > 5cr')
    })

    it('should validate place of supply for domestic invoices', () => {
      const invoice = {
        invoiceType: 'DOMESTIC_B2B',
        placeOfSupply: null
      }

      const result = validateGSTR1Data(invoice)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Place of supply is required for domestic invoices')
    })

    it('should validate export invoices have shipping bill details', () => {
      const invoice = {
        invoiceType: 'EXPORT',
        shippingBillNo: null,
        shippingBillDate: null
      }

      const result = validateGSTR1Data(invoice)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Export invoices must have shipping bill details')
    })
  })

  describe('Complete GSTR-1 Generation', () => {
    it('should generate complete GSTR-1 JSON', () => {
      const invoices = [
        // B2B invoice
        {
          id: '1',
          invoiceNumber: 'FY24-25/001',
          invoiceDate: new Date('2024-05-15'),
          invoiceType: 'DOMESTIC_B2B',
          client: {
            name: 'ABC Corp',
            gstin: '27AAECR2971C1Z5',
            stateCode: '27'
          },
          placeOfSupply: '27',
          taxableAmount: new Decimal(100000),
          cgstAmount: new Decimal(9000),
          sgstAmount: new Decimal(9000),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(118000),
          lineItems: [
            {
              serviceCode: '998314',
              quantity: new Decimal(1),
              amount: new Decimal(100000),
              cgstAmount: new Decimal(9000),
              sgstAmount: new Decimal(9000),
              uqc: 'OTH'
            }
          ]
        },
        // B2C small
        {
          id: '2',
          invoiceNumber: 'FY24-25/010',
          invoiceDate: new Date('2024-05-16'),
          invoiceType: 'DOMESTIC_B2C',
          client: {
            name: 'Retail Customer',
            gstin: null,
            stateCode: '27'
          },
          placeOfSupply: '27',
          taxableAmount: new Decimal(10000),
          cgstAmount: new Decimal(900),
          sgstAmount: new Decimal(900),
          igstAmount: new Decimal(0),
          totalAmount: new Decimal(11800),
          lineItems: [
            {
              serviceCode: '998314',
              quantity: new Decimal(1),
              amount: new Decimal(10000),
              cgstAmount: new Decimal(900),
              sgstAmount: new Decimal(900),
              uqc: 'OTH'
            }
          ]
        }
      ]

      const creditNotes = []
      const debitNotes = []
      const config = {
        gstin: '27AAECR2971C1Z0',
        period: '052024',
        turnover: 40000000
      }

      const result = generateGSTR1(invoices, creditNotes, debitNotes, config)

      expect(result.gstin).toBe('27AAECR2971C1Z0')
      expect(result.fp).toBe('052024')
      expect(result.b2b).toHaveLength(1)
      expect(result.b2cs).toHaveLength(1)
      expect(result.hsn.data).toHaveLength(2) // B2B and B2C HSN
    })
  })
})