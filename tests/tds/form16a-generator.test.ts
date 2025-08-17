import { describe, it, expect } from 'vitest'
import { 
  generateForm16A,
  validateForm16AData,
  formatCertificateNumber,
  generateQuarterlyStatement
} from '@/lib/tds/form16a-generator'
import { Decimal } from '@prisma/client/runtime/library'

describe('Form 16A Certificate Generation', () => {
  describe('Certificate Data Structure', () => {
    it('should generate Form 16A with all required fields', () => {
      const certificateData = {
        certificateNumber: 'DELS12345F/FY24-25/Q1/001',
        quarter: 'Q1',
        financialYear: 'FY24-25',
        assessmentYear: 'AY25-26',
        
        // Deductor Details
        deductor: {
          name: 'GSTHive Services Pvt Ltd',
          tan: 'DELS12345F',
          pan: 'AABCG1234D',
          address: '123 Business Park, New Delhi - 110001',
          email: 'accounts@gsthive.com',
          responsiblePerson: 'John Doe'
        },
        
        // Deductee Details  
        deductee: {
          name: 'ABC Consulting Services',
          pan: 'AABCA1234E',
          address: '456 Tech Hub, Bangalore - 560001'
        },
        
        // TDS Details
        transactions: [
          {
            paymentDate: new Date('2024-05-15'),
            paymentAmount: new Decimal(100000),
            sectionCode: '194J',
            tdsRate: 10,
            tdsAmount: new Decimal(10000),
            surcharge: new Decimal(0),
            eduCess: new Decimal(400),
            totalTDS: new Decimal(10400),
            depositDate: new Date('2024-06-07'),
            challanNumber: 'BSR123456',
            bsrCode: '0123456'
          },
          {
            paymentDate: new Date('2024-06-20'),
            paymentAmount: new Decimal(200000),
            sectionCode: '194J',
            tdsRate: 10,
            tdsAmount: new Decimal(20000),
            surcharge: new Decimal(0),
            eduCess: new Decimal(800),
            totalTDS: new Decimal(20800),
            depositDate: new Date('2024-07-07'),
            challanNumber: 'BSR123457',
            bsrCode: '0123456'
          }
        ],
        
        // Summary
        summary: {
          totalPayments: new Decimal(300000),
          totalTDSDeducted: new Decimal(31200),
          totalTDSDeposited: new Decimal(31200)
        }
      }
      
      const result = generateForm16A(certificateData)
      
      expect(result.certificateNumber).toBe('DELS12345F/FY24-25/Q1/001')
      expect(result.deductor.tan).toBe('DELS12345F')
      expect(result.deductee.pan).toBe('AABCA1234E')
      expect(result.transactions).toHaveLength(2)
      expect(result.summary.totalTDSDeducted.toNumber()).toBe(31200)
    })
    
    it('should generate certificate number in correct format', () => {
      const certificateNumber = formatCertificateNumber(
        'DELS12345F',
        'FY24-25',
        'Q1',
        1
      )
      
      expect(certificateNumber).toBe('DELS12345F/FY24-25/Q1/001')
    })
    
    it('should handle multiple TDS sections in single certificate', () => {
      const certificateData = {
        transactions: [
          {
            paymentDate: new Date('2024-05-15'),
            paymentAmount: new Decimal(100000),
            sectionCode: '194J', // Professional services
            tdsRate: 10,
            tdsAmount: new Decimal(10000)
          },
          {
            paymentDate: new Date('2024-05-20'),
            paymentAmount: new Decimal(50000),
            sectionCode: '194C', // Contracts
            tdsRate: 1,
            tdsAmount: new Decimal(500)
          }
        ]
      }
      
      const result = generateForm16A(certificateData)
      
      expect(result.transactions).toHaveLength(2)
      expect(result.transactions[0].sectionCode).toBe('194J')
      expect(result.transactions[1].sectionCode).toBe('194C')
    })
  })
  
  describe('Form 16A Validation', () => {
    it('should validate mandatory fields are present', () => {
      const invalidData = {
        deductor: {
          tan: null, // Missing TAN
          pan: 'AABCG1234D'
        },
        deductee: {
          pan: null // Missing PAN
        }
      }
      
      const result = validateForm16AData(invalidData)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Deductor TAN is required')
      expect(result.errors).toContain('Deductee PAN is required')
    })
    
    it('should validate TAN format', () => {
      const invalidData = {
        deductor: {
          tan: 'INVALID123', // Invalid format
          pan: 'AABCG1234D'
        }
      }
      
      const result = validateForm16AData(invalidData)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid TAN format')
    })
    
    it('should validate PAN format', () => {
      const invalidData = {
        deductee: {
          pan: 'INVALIDPAN' // Invalid format
        }
      }
      
      const result = validateForm16AData(invalidData)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid PAN format')
    })
    
    it('should validate TDS amount matches calculation', () => {
      const data = {
        transactions: [
          {
            paymentAmount: new Decimal(100000),
            tdsRate: 10,
            tdsAmount: new Decimal(8000) // Should be 10000
          }
        ]
      }
      
      const result = validateForm16AData(data)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('TDS amount does not match calculation')
    })
    
    it('should validate deposit date is after payment date', () => {
      const data = {
        transactions: [
          {
            paymentDate: new Date('2024-06-15'),
            depositDate: new Date('2024-06-10') // Before payment
          }
        ]
      }
      
      const result = validateForm16AData(data)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Deposit date cannot be before payment date')
    })
    
    it('should validate challan details are present', () => {
      const data = {
        transactions: [
          {
            depositDate: new Date('2024-06-07'),
            challanNumber: null,
            bsrCode: null
          }
        ]
      }
      
      const result = validateForm16AData(data)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Challan details are required for deposited TDS')
    })
  })
  
  describe('Quarterly Statement Generation', () => {
    it('should generate quarterly statement summary', () => {
      const transactions = [
        {
          paymentDate: new Date('2024-04-15'),
          paymentAmount: new Decimal(100000),
          sectionCode: '194J',
          tdsAmount: new Decimal(10000),
          totalTDS: new Decimal(10400)
        },
        {
          paymentDate: new Date('2024-05-20'),
          paymentAmount: new Decimal(200000),
          sectionCode: '194J',
          tdsAmount: new Decimal(20000),
          totalTDS: new Decimal(20800)
        },
        {
          paymentDate: new Date('2024-06-25'),
          paymentAmount: new Decimal(150000),
          sectionCode: '194C',
          tdsAmount: new Decimal(1500),
          totalTDS: new Decimal(1560)
        }
      ]
      
      const result = generateQuarterlyStatement(transactions, 'Q1', 'FY24-25')
      
      expect(result.quarter).toBe('Q1')
      expect(result.financialYear).toBe('FY24-25')
      expect(result.totalPayments).toBe(450000)
      expect(result.totalTDS).toBe(32760)
      expect(result.sectionWiseSummary['194J'].count).toBe(2)
      expect(result.sectionWiseSummary['194J'].totalTDS).toBe(31200)
      expect(result.sectionWiseSummary['194C'].count).toBe(1)
      expect(result.sectionWiseSummary['194C'].totalTDS).toBe(1560)
    })
    
    it('should filter transactions by quarter', () => {
      const transactions = [
        {
          paymentDate: new Date('2024-04-15'), // Q1
          paymentAmount: new Decimal(100000),
          sectionCode: '194J',
          totalTDS: new Decimal(10400)
        },
        {
          paymentDate: new Date('2024-07-20'), // Q2
          paymentAmount: new Decimal(200000),
          sectionCode: '194J',
          totalTDS: new Decimal(20800)
        }
      ]
      
      const result = generateQuarterlyStatement(transactions, 'Q1', 'FY24-25')
      
      expect(result.transactionCount).toBe(1)
      expect(result.totalPayments).toBe(100000)
      expect(result.totalTDS).toBe(10400)
    })
    
    it('should calculate late deposit penalties', () => {
      const transactions = [
        {
          paymentDate: new Date('2024-05-15'),
          paymentAmount: new Decimal(100000),
          tdsAmount: new Decimal(10000),
          totalTDS: new Decimal(10400),
          depositDate: new Date('2024-06-20'), // Late by 13 days
          depositDueDate: new Date('2024-06-07')
        }
      ]
      
      const result = generateQuarterlyStatement(transactions, 'Q1', 'FY24-25')
      
      expect(result.lateDeposits).toHaveLength(1)
      expect(result.lateDeposits[0].daysLate).toBe(13)
      expect(result.lateDeposits[0].interest).toBeGreaterThan(0)
      expect(result.lateDeposits[0].penalty).toBe(2600) // 200 per day * 13 days
    })
  })
  
  describe('Form 16A PDF Generation', () => {
    it('should include QR code with verification data', () => {
      const certificateData = {
        certificateNumber: 'DELS12345F/FY24-25/Q1/001',
        deductor: {
          tan: 'DELS12345F'
        },
        deductee: {
          pan: 'AABCA1234E'
        },
        summary: {
          totalTDSDeducted: new Decimal(31200)
        }
      }
      
      const result = generateForm16A(certificateData)
      
      expect(result.verificationData).toBeDefined()
      expect(result.verificationData.certificateNumber).toBe('DELS12345F/FY24-25/Q1/001')
      expect(result.verificationData.tan).toBe('DELS12345F')
      expect(result.verificationData.pan).toBe('AABCA1234E')
      expect(result.verificationData.totalTDS).toBe(31200)
    })
    
    it('should format amounts in Indian numbering system', () => {
      const certificateData = {
        summary: {
          totalPayments: new Decimal(1234567),
          totalTDSDeducted: new Decimal(123456)
        }
      }
      
      const result = generateForm16A(certificateData)
      
      expect(result.formattedAmounts.totalPayments).toBe('12,34,567')
      expect(result.formattedAmounts.totalTDS).toBe('1,23,456')
    })
    
    it('should include digital signature placeholder', () => {
      const certificateData = {
        deductor: {
          responsiblePerson: 'John Doe',
          designation: 'Finance Manager'
        },
        issueDate: new Date('2024-07-15')
      }
      
      const result = generateForm16A(certificateData)
      
      expect(result.signature).toBeDefined()
      expect(result.signature.name).toBe('John Doe')
      expect(result.signature.designation).toBe('Finance Manager')
      expect(result.signature.date).toBe('15-07-2024')
      expect(result.signature.place).toBeDefined()
    })
  })
})