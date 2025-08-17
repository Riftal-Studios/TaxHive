import { describe, it, expect } from 'vitest'
import { 
  calculateTDS,
  getTDSSection,
  calculateTDSWithThreshold,
  calculateQuarterlyTDS,
  getDepositDueDate,
  TDS_SECTIONS
} from '@/lib/tds/calculator'
import { Decimal } from '@prisma/client/runtime/library'

describe('TDS Calculator', () => {
  describe('TDS Sections Configuration', () => {
    it('should have correct TDS rates for section 194C (Contracts)', () => {
      const section = getTDSSection('194C')
      expect(section.code).toBe('194C')
      expect(section.description).toBe('Payment to Contractors')
      expect(section.individualRate).toBe(1)
      expect(section.companyRate).toBe(2)
      expect(section.thresholdLimit).toBe(100000) // Annual limit
      expect(section.singleTransactionLimit).toBe(30000)
    })

    it('should have correct TDS rates for section 194J (Professional Services)', () => {
      const section = getTDSSection('194J')
      expect(section.code).toBe('194J')
      expect(section.description).toBe('Professional/Technical Services')
      expect(section.individualRate).toBe(10)
      expect(section.companyRate).toBe(10)
      expect(section.thresholdLimit).toBe(30000)
    })

    it('should have correct TDS rates for section 194H (Commission/Brokerage)', () => {
      const section = getTDSSection('194H')
      expect(section.code).toBe('194H')
      expect(section.description).toBe('Commission or Brokerage')
      expect(section.individualRate).toBe(5)
      expect(section.companyRate).toBe(5)
      expect(section.thresholdLimit).toBe(15000)
    })

    it('should have correct TDS rates for section 194I (Rent)', () => {
      const section = getTDSSection('194I')
      expect(section.code).toBe('194I')
      expect(section.description).toBe('Rent')
      expect(section.individualRate).toBe(10)
      expect(section.companyRate).toBe(10)
      expect(section.thresholdLimit).toBe(240000)
    })

    it('should have correct TDS rates for section 194IA (Property Purchase)', () => {
      const section = getTDSSection('194IA')
      expect(section.code).toBe('194IA')
      expect(section.description).toBe('Transfer of Immovable Property')
      expect(section.individualRate).toBe(1)
      expect(section.companyRate).toBe(1)
      expect(section.thresholdLimit).toBe(5000000)
    })
  })

  describe('Basic TDS Calculation', () => {
    it('should calculate TDS for individual under section 194C', () => {
      const result = calculateTDS({
        amount: new Decimal(50000),
        sectionCode: '194C',
        vendorType: 'INDIVIDUAL',
        hasPAN: true
      })

      expect(result.tdsRate).toBe(1)
      expect(result.tdsAmount.toNumber()).toBe(500) // 1% of 50000
      expect(result.surcharge.toNumber()).toBe(0)
      expect(result.eduCess.toNumber()).toBe(20) // 4% of 500
      expect(result.totalTDS.toNumber()).toBe(520)
    })

    it('should calculate TDS for company under section 194C', () => {
      const result = calculateTDS({
        amount: new Decimal(100000),
        sectionCode: '194C',
        vendorType: 'COMPANY',
        hasPAN: true
      })

      expect(result.tdsRate).toBe(2)
      expect(result.tdsAmount.toNumber()).toBe(2000) // 2% of 100000
      expect(result.eduCess.toNumber()).toBe(80) // 4% of 2000
      expect(result.totalTDS.toNumber()).toBe(2080)
    })

    it('should calculate TDS for professional services (194J)', () => {
      const result = calculateTDS({
        amount: new Decimal(100000),
        sectionCode: '194J',
        vendorType: 'INDIVIDUAL',
        hasPAN: true
      })

      expect(result.tdsRate).toBe(10)
      expect(result.tdsAmount.toNumber()).toBe(10000) // 10% of 100000
      expect(result.eduCess.toNumber()).toBe(400) // 4% of 10000
      expect(result.totalTDS.toNumber()).toBe(10400)
    })

    it('should apply 20% TDS when PAN is not provided', () => {
      const result = calculateTDS({
        amount: new Decimal(50000),
        sectionCode: '194J',
        vendorType: 'INDIVIDUAL',
        hasPAN: false
      })

      expect(result.tdsRate).toBe(20) // Higher rate without PAN
      expect(result.tdsAmount.toNumber()).toBe(10000) // 20% of 50000
      expect(result.eduCess.toNumber()).toBe(400) // 4% of 10000
      expect(result.totalTDS.toNumber()).toBe(10400)
    })

    it('should calculate surcharge for high-value transactions', () => {
      const result = calculateTDS({
        amount: new Decimal(15000000), // 1.5 crore
        sectionCode: '194J',
        vendorType: 'COMPANY',
        hasPAN: true
      })

      // For company: 10% TDS on 1.5 crore = 15 lakh
      // Surcharge: 12% on amount > 1 crore for companies
      expect(result.tdsRate).toBe(10)
      expect(result.tdsAmount.toNumber()).toBe(1500000)
      expect(result.surcharge.toNumber()).toBe(180000) // 12% of 15 lakh
      expect(result.eduCess.toNumber()).toBe(67200) // 4% of (15 lakh + 1.8 lakh)
      expect(result.totalTDS.toNumber()).toBe(1747200)
    })
  })

  describe('TDS with Threshold Limits', () => {
    it('should not deduct TDS when below threshold for section 194C', () => {
      const result = calculateTDSWithThreshold({
        currentAmount: new Decimal(20000),
        cumulativeAmount: new Decimal(20000),
        sectionCode: '194C',
        vendorType: 'INDIVIDUAL',
        hasPAN: true
      })

      expect(result.tdsApplicable).toBe(false)
      expect(result.tdsAmount.toNumber()).toBe(0)
      expect(result.totalTDS.toNumber()).toBe(0)
    })

    it('should deduct TDS when single transaction exceeds limit for 194C', () => {
      const result = calculateTDSWithThreshold({
        currentAmount: new Decimal(35000), // Exceeds single transaction limit
        cumulativeAmount: new Decimal(35000),
        sectionCode: '194C',
        vendorType: 'INDIVIDUAL',
        hasPAN: true
      })

      expect(result.tdsApplicable).toBe(true)
      expect(result.tdsAmount.toNumber()).toBe(350) // 1% of 35000
    })

    it('should deduct TDS when cumulative amount exceeds annual threshold', () => {
      const result = calculateTDSWithThreshold({
        currentAmount: new Decimal(20000),
        cumulativeAmount: new Decimal(110000), // Total exceeds 100000 annual limit
        sectionCode: '194C',
        vendorType: 'INDIVIDUAL',
        hasPAN: true
      })

      expect(result.tdsApplicable).toBe(true)
      expect(result.tdsAmount.toNumber()).toBe(200) // 1% of 20000
    })

    it('should deduct TDS on entire cumulative amount after crossing threshold', () => {
      const result = calculateTDSWithThreshold({
        currentAmount: new Decimal(20000),
        cumulativeAmount: new Decimal(95000), // Will cross 100000 with this payment
        sectionCode: '194C',
        vendorType: 'INDIVIDUAL',
        hasPAN: true,
        deductOnEntireAmount: true
      })

      // Total after payment = 115000, threshold = 100000
      // TDS on excess = 1% of (115000 - 100000) = 150
      expect(result.tdsApplicable).toBe(true)
      expect(result.tdsAmount.toNumber()).toBe(1150) // 1% of 115000
    })
  })

  describe('Quarterly TDS Calculation', () => {
    it('should calculate quarterly TDS summary', () => {
      const deductions = [
        {
          taxableAmount: new Decimal(100000),
          tdsAmount: new Decimal(10000),
          surcharge: new Decimal(0),
          eduCess: new Decimal(400),
          totalTDS: new Decimal(10400),
          sectionCode: '194J'
        },
        {
          taxableAmount: new Decimal(50000),
          tdsAmount: new Decimal(500),
          surcharge: new Decimal(0),
          eduCess: new Decimal(20),
          totalTDS: new Decimal(520),
          sectionCode: '194C'
        },
        {
          taxableAmount: new Decimal(200000),
          tdsAmount: new Decimal(20000),
          surcharge: new Decimal(0),
          eduCess: new Decimal(800),
          totalTDS: new Decimal(20800),
          sectionCode: '194J'
        }
      ]

      const result = calculateQuarterlyTDS(deductions)

      expect(result.totalTaxableAmount.toNumber()).toBe(350000)
      expect(result.totalTDSAmount.toNumber()).toBe(30500)
      expect(result.totalSurcharge.toNumber()).toBe(0)
      expect(result.totalEducationCess.toNumber()).toBe(1220)
      expect(result.totalTDS.toNumber()).toBe(31720)
      expect(result.sectionWiseSummary['194J'].count).toBe(2)
      expect(result.sectionWiseSummary['194J'].totalTDS.toNumber()).toBe(31200)
      expect(result.sectionWiseSummary['194C'].count).toBe(1)
      expect(result.sectionWiseSummary['194C'].totalTDS.toNumber()).toBe(520)
    })
  })

  describe('Due Date Calculation', () => {
    it('should calculate due date for government deductor', () => {
      const deductionDate = new Date('2024-05-15')
      const dueDate = getDepositDueDate(deductionDate, true) // Government deductor
      
      // For government: Same day (30th of same month)
      expect(dueDate.getDate()).toBe(30)
      expect(dueDate.getMonth()).toBe(4) // May (0-indexed)
      expect(dueDate.getFullYear()).toBe(2024)
    })

    it('should calculate due date for non-government deductor', () => {
      const deductionDate = new Date('2024-05-15')
      const dueDate = getDepositDueDate(deductionDate, false) // Non-government
      
      // For non-government: 7th of next month
      expect(dueDate.getDate()).toBe(7)
      expect(dueDate.getMonth()).toBe(5) // June (0-indexed)
      expect(dueDate.getFullYear()).toBe(2024)
    })

    it('should handle year-end due date calculation', () => {
      const deductionDate = new Date('2024-12-20')
      const dueDate = getDepositDueDate(deductionDate, false)
      
      // December deduction -> Due on 7th January next year
      expect(dueDate.getDate()).toBe(7)
      expect(dueDate.getMonth()).toBe(0) // January (0-indexed)
      expect(dueDate.getFullYear()).toBe(2025)
    })

    it('should handle March quarter-end due date', () => {
      const deductionDate = new Date('2024-03-31')
      const dueDate = getDepositDueDate(deductionDate, false, true) // Quarter end
      
      // March quarter end -> Due on 30th April
      expect(dueDate.getDate()).toBe(30)
      expect(dueDate.getMonth()).toBe(3) // April (0-indexed)
      expect(dueDate.getFullYear()).toBe(2024)
    })
  })

  describe('TDS Section Validation', () => {
    it('should validate if payment type matches section', () => {
      expect(TDS_SECTIONS['194C'].applicableFor).toContain('CONTRACT')
      expect(TDS_SECTIONS['194J'].applicableFor).toContain('PROFESSIONAL')
      expect(TDS_SECTIONS['194H'].applicableFor).toContain('COMMISSION')
      expect(TDS_SECTIONS['194I'].applicableFor).toContain('RENT')
    })

    it('should throw error for invalid section code', () => {
      expect(() => getTDSSection('INVALID')).toThrow('Invalid TDS section code')
    })

    it('should return all active TDS sections', () => {
      const sections = Object.values(TDS_SECTIONS)
      expect(sections.length).toBeGreaterThan(0)
      expect(sections.every(s => s.code && s.description)).toBe(true)
    })
  })
})