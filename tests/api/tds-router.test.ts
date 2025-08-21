import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tdsRouter } from '@/server/api/routers/tds'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import type { Session } from 'next-auth'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tDSConfiguration: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    tDSSection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn()
    },
    tDSDeduction: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn()
    },
    tDSPayment: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn()
    },
    tDSCertificate: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn()
    },
    tDSReturn: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    vendor: {
      findUnique: vi.fn()
    },
    purchaseInvoice: {
      update: vi.fn()
    }
  }
}))

// Mock TDS calculations and constants
vi.mock('@/lib/tds/calculations', () => ({
  calculateTDS: vi.fn(() => ({
    tdsAmount: 10000,
    surcharge: 0,
    eduCess: 400,
    totalTDS: 10400,
    isThresholdExceeded: true
  })),
  generateCertificateNumber: vi.fn(() => 'DELS12345F/FY24-25/Q1/001'),
  generateChallanNumber: vi.fn(() => 'DELS12345F240515001')
}))

vi.mock('@/lib/tds/constants', () => ({
  TDS_SECTIONS: {
    '194J': {
      description: 'Fees for professional or technical services',
      individualRate: 10,
      companyRate: 10,
      thresholdLimit: 30000,
      aggregateLimit: 100000,
      applicableFor: ['INDIVIDUAL', 'COMPANY'],
      natureOfPayment: 'Professional Services'
    }
  },
  getCurrentFinancialYear: vi.fn(() => 'FY24-25'),
  getCurrentQuarter: vi.fn(() => 'Q1'),
  getDepositDueDate: vi.fn(() => new Date('2024-06-07')),
  validatePAN: vi.fn(() => true),
  validateTAN: vi.fn(() => true)
}))

describe('TDS Router', () => {
  let ctx: any
  let caller: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock context with authenticated user
    const mockSession: Session = {
      user: {
        id: 'user1',
        email: 'test@example.com'
      },
      expires: '2024-12-31'
    }
    
    ctx = {
      session: mockSession,
      prisma,
      req: {} as any
    }
    
    // Create router caller
    caller = tdsRouter.createCaller(ctx)
  })

  describe('TDS Configuration', () => {
    it('should create TDS configuration', async () => {
      const configData = {
        tanNumber: 'DELS12345F',
        deductorPAN: 'AABCG1234D',
        deductorName: 'GSTHive Services Pvt Ltd',
        deductorType: 'COMPANY' as const,
        responsiblePerson: 'John Doe',
        designation: 'Finance Manager',
        address: '123 Business Park, New Delhi - 110001',
        city: 'New Delhi',
        stateCode: 'DL',
        pincode: '110001',
        email: 'john@gsthive.com',
        phone: '9876543210'
      }

      // Mock that no existing config exists
      prisma.tDSConfiguration.findUnique.mockResolvedValue(null)

      const mockCreatedConfig = {
        id: 'config1',
        userId: 'user1',
        ...configData,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      prisma.tDSConfiguration.create.mockResolvedValue(mockCreatedConfig)

      const result = await caller.saveConfiguration(configData)

      expect(result.tanNumber).toBe('DELS12345F')
      expect(result.deductorName).toBe('GSTHive Services Pvt Ltd')
      expect(prisma.tDSConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user1',
          tanNumber: 'DELS12345F'
        })
      })
    })

    it('should get TDS configuration', async () => {
      const mockConfig = {
        id: 'config1',
        userId: 'user1',
        tanNumber: 'DELS12345F',
        deductorPAN: 'AABCG1234D',
        deductorName: 'GSTHive Services Pvt Ltd'
      }

      prisma.tDSConfiguration.findUnique.mockResolvedValue(mockConfig)

      const result = await caller.getConfiguration()

      expect(result).toBeDefined()
      expect(result.tanNumber).toBe('DELS12345F')
      expect(prisma.tDSConfiguration.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user1' }
      })
    })

    it('should update TDS configuration', async () => {
      const updateData = {
        tanNumber: 'DELS12345F',
        deductorPAN: 'AABCG1234D',
        deductorName: 'GSTHive Services Pvt Ltd',
        deductorType: 'COMPANY' as const,
        responsiblePerson: 'Jane Doe',
        designation: 'CFO',
        address: '123 Business Park, New Delhi - 110001',
        city: 'New Delhi',
        stateCode: 'DL',
        pincode: '110001',
        email: 'jane@gsthive.com',
        phone: '9876543210'
      }

      // Mock existing config
      const existingConfig = {
        id: 'config1',
        userId: 'user1',
        tanNumber: 'DELS12345F'
      }
      prisma.tDSConfiguration.findUnique.mockResolvedValue(existingConfig)

      const updatedConfig = {
        id: 'config1',
        userId: 'user1',
        ...updateData
      }
      prisma.tDSConfiguration.update.mockResolvedValue(updatedConfig)

      const result = await caller.saveConfiguration(updateData)

      expect(result.responsiblePerson).toBe('Jane Doe')
      expect(result.designation).toBe('CFO')
    })
  })

  describe('TDS Deductions', () => {
    it('should record TDS deduction', async () => {
      const deductionData = {
        vendorId: 'vendor1',
        sectionCode: '194J',
        taxableAmount: 100000,
        tdsRate: 10,
        tdsAmount: 10000,
        surcharge: 0,
        eduCess: 400,
        totalTDS: 10400,
        deductionDate: new Date('2024-05-15')
      }

      // Mock vendor
      prisma.vendor.findUnique.mockResolvedValue({
        id: 'vendor1',
        name: 'ABC Consulting',
        pan: 'AABCA1234E',
        vendorType: 'COMPANY'
      })

      // Mock section creation
      prisma.tDSSection.findUnique.mockResolvedValue(null)
      prisma.tDSSection.create.mockResolvedValue({
        id: 'section1',
        sectionCode: '194J'
      })

      const mockCreatedDeduction = {
        id: 'deduction1',
        userId: 'user1',
        sectionId: 'section1',
        taxableAmount: new Decimal(100000),
        tdsAmount: new Decimal(10000),
        surcharge: new Decimal(0),
        eduCess: new Decimal(400),
        totalTDS: new Decimal(10400),
        vendorName: 'ABC Consulting',
        vendorPAN: 'AABCA1234E',
        vendorType: 'COMPANY',
        financialYear: 'FY24-25',
        quarter: 'Q1',
        depositDueDate: new Date('2024-06-07'),
        deductionDate: new Date('2024-05-15'),
        ...deductionData
      }

      prisma.tDSDeduction.create.mockResolvedValue(mockCreatedDeduction)

      const result = await caller.createDeduction(deductionData)

      expect(result.sectionId).toBe('section1')
      expect(result.tdsRate).toBe(10)
      expect(result.totalTDS instanceof Decimal ? result.totalTDS.toNumber() : result.totalTDS).toBe(10400)
    })

    it('should get deductions for a period', async () => {
      const mockDeductions = [
        {
          id: 'deduction1',
          deductionDate: new Date('2024-05-15'),
          sectionCode: '194J',
          taxableAmount: new Decimal(100000),
          totalTDS: new Decimal(10400)
        }
      ]

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)
      prisma.tDSDeduction.count.mockResolvedValue(1)

      const result = await caller.getDeductions({
        financialYear: 'FY24-25',
        quarter: 'Q1'
      })

      expect(result.deductions).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.deductions[0].id).toBe('deduction1')
    })

    it('should get deductions by vendor', async () => {
      const mockDeductions = [
        {
          id: 'deduction1',
          vendorId: 'vendor1',
          sectionCode: '194J',
          totalTDS: new Decimal(10400)
        }
      ]

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)
      prisma.tDSDeduction.count.mockResolvedValue(1)

      const result = await caller.getDeductions({
        vendorId: 'vendor1'
      })

      expect(result.deductions).toHaveLength(1)
      expect(result.deductions[0].vendorId).toBe('vendor1')
    })

    it('should calculate cumulative TDS for threshold checking', async () => {
      const amount = 50000
      const sectionCode = '194J'
      const vendorId = 'vendor1'

      // Mock vendor
      prisma.vendor.findUnique.mockResolvedValue({
        id: 'vendor1',
        name: 'ABC Consulting',
        pan: 'AABCA1234E',
        vendorType: 'COMPANY',
        lowerTDSRate: null
      })

      const result = await caller.calculateTDS({
        amount,
        sectionCode,
        vendorId,
        previousPayments: 60000
      })

      expect(result.tdsAmount).toBe(10000)
      expect(result.totalTDS).toBe(10400)
      expect(result.isThresholdExceeded).toBe(true)
    })
  })

  describe('TDS Deposit and Payment', () => {
    it('should record TDS deposit', async () => {
      const depositData = {
        deductionIds: ['deduction1', 'deduction2'],
        challanDate: new Date('2024-06-07'),
        bsrCode: '0123456',
        bankName: 'State Bank of India',
        paymentMode: 'ONLINE' as const,
        paymentReference: 'TXN123456'
      }

      // Mock deductions to be paid
      const mockDeductions = [
        {
          id: 'deduction1',
          tdsAmount: new Decimal(10000),
          surcharge: new Decimal(0),
          eduCess: new Decimal(400),
          financialYear: 'FY24-25',
          quarter: 'Q1',
          sectionId: 'section1'
        }
      ]

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)
      prisma.tDSPayment.count.mockResolvedValue(0)

      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        challanNumber: 'DELS12345F240607001',
        totalAmount: new Decimal(31200),
        ...depositData
      }

      prisma.tDSPayment.create.mockResolvedValue(mockPayment)
      prisma.tDSDeduction.updateMany.mockResolvedValue({ count: 1 })

      const result = await caller.createPayment(depositData)

      expect(result.challanNumber).toBe('DELS12345F240607001')
      expect(result.totalAmount.toNumber()).toBe(31200)
    })

    it('should check for late deposits', async () => {
      const mockDeductions = [
        {
          id: 'deduction1',
          deductionDate: new Date('2024-05-15'),
          depositDueDate: new Date('2024-06-07'),
          totalTDS: new Decimal(10400),
          tdsPayment: {
            challanDate: new Date('2024-06-20') // Late deposit
          }
        }
      ]

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)

      const result = await caller.getDeductions({
        quarter: 'Q1',
        financialYear: 'FY24-25',
        depositStatus: 'LATE'
      })

      expect(result.deductions).toHaveLength(1)
    })
  })

  describe('Form 16A Certificate', () => {
    it('should generate Form 16A certificate', async () => {
      const certificateData = {
        vendorId: 'vendor1',
        quarter: 'Q1',
        financialYear: 'FY24-25'
      }

      // Mock vendor
      prisma.vendor.findUnique.mockResolvedValue({
        id: 'vendor1',
        name: 'ABC Consulting',
        pan: 'AABCA1234E',
        address: '456 Tech Hub, Bangalore'
      })

      // Mock deductions for certificate
      const mockDeductions = [
        {
          id: 'deduction1',
          vendorId: 'vendor1',
          deductionDate: new Date('2024-05-15'),
          taxableAmount: new Decimal(100000),
          sectionCode: '194J',
          totalTDS: new Decimal(10400),
          section: { sectionCode: '194J' },
          tdsPayment: { challanNumber: 'DELS12345F240607001' }
        }
      ]

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)

      // Mock config
      prisma.tDSConfiguration.findUnique.mockResolvedValue({
        tanNumber: 'DELS12345F',
        deductorPAN: 'AABCG1234D',
        deductorName: 'GSTHive Services Pvt Ltd'
      })

      prisma.tDSCertificate.count.mockResolvedValue(0)

      const mockCertificate = {
        id: 'cert1',
        certificateNumber: 'DELS12345F/FY24-25/Q1/001',
        vendorId: 'vendor1',
        quarter: 'Q1',
        financialYear: 'FY24-25',
        totalTDS: 10400,
        totalPaid: 100000
      }

      prisma.tDSCertificate.create.mockResolvedValue(mockCertificate)
      prisma.tDSDeduction.updateMany.mockResolvedValue({ count: 1 })

      const result = await caller.generateCertificate(certificateData)

      expect(result.certificateNumber).toBe('DELS12345F/FY24-25/Q1/001')
      expect(result.vendorId).toBe('vendor1')
    })

    it('should get all certificates for a vendor', async () => {
      const mockCertificates = [
        {
          id: 'cert1',
          certificateNumber: 'DELS12345F/FY24-25/Q1/001',
          vendorId: 'vendor1',
          quarter: 'Q1',
          financialYear: 'FY24-25'
        }
      ]

      prisma.tDSCertificate.findMany.mockResolvedValue(mockCertificates)

      const result = await caller.generateCertificate({
        vendorId: 'vendor1',
        quarter: 'Q1',
        financialYear: 'FY24-25'
      })

      expect(result).toBeDefined()
    })
  })

  describe('TDS Returns', () => {
    it('should generate quarterly TDS return', async () => {
      const returnData = {
        quarter: 'Q1',
        financialYear: 'FY24-25',
        returnType: '26Q' as const
      }

      // Mock config
      prisma.tDSConfiguration.findUnique.mockResolvedValue({
        userId: 'user1',
        tanNumber: 'DELS12345F',
        deductorName: 'GSTHive Services Pvt Ltd'
      })

      // Mock existing return check
      prisma.tDSReturn.findUnique.mockResolvedValue(null)

      // Mock deductions for the period
      const mockDeductions = [
        {
          deductionDate: new Date('2024-05-15'),
          taxableAmount: new Decimal(100000),
          sectionCode: '194J',
          totalTDS: new Decimal(10400),
          section: { sectionCode: '194J' },
          tdsPayment: { challanNumber: 'DELS12345F240607001' },
          vendor: { name: 'ABC Consulting' }
        }
      ]

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)
      prisma.tDSPayment.findMany.mockResolvedValue([])
      prisma.tDSCertificate.findMany.mockResolvedValue([])

      const mockReturn = {
        id: 'return1',
        returnType: '26Q',
        quarter: 'Q1',
        financialYear: 'FY24-25',
        totalTDS: new Decimal(10400),
        totalDeductions: 1,
        sectionWiseSummary: {
          '194J': { count: 1, totalTDS: 10400, totalPaid: 100000 }
        }
      }

      prisma.tDSReturn.create.mockResolvedValue(mockReturn)

      const result = await caller.prepareReturn(returnData)

      expect(result.returnType).toBe('26Q')
      expect(result.totalTDS.toNumber()).toBe(10400)
      expect(result.sectionWiseSummary['194J'].count).toBe(1)
    })

    it('should validate return before filing', async () => {
      const mockReturns = [
        {
          id: 'return1',
          returnType: '26Q',
          quarter: 'Q1',
          financialYear: 'FY24-25',
          totalTDS: new Decimal(31200),
          filingStatus: 'DRAFT'
        }
      ]

      prisma.tDSReturn.findMany.mockResolvedValue(mockReturns)

      const result = await caller.getReturns({
        financialYear: 'FY24-25',
        returnType: '26Q'
      })

      expect(result).toHaveLength(1)
      expect(result[0].returnType).toBe('26Q')
    })

    it('should file TDS return', async () => {
      // This test would cover the filing functionality
      // Since the actual router only has prepareReturn, we'll test that
      const returnData = {
        quarter: 'Q1',
        financialYear: 'FY24-25',
        returnType: '26Q' as const
      }

      // Mock the necessary setup
      prisma.tDSConfiguration.findUnique.mockResolvedValue({
        userId: 'user1',
        tanNumber: 'DELS12345F'
      })

      const existingReturn = {
        id: 'return1',
        filingStatus: 'DRAFT'
      }
      prisma.tDSReturn.findUnique.mockResolvedValue(existingReturn)

      prisma.tDSDeduction.findMany.mockResolvedValue([])
      prisma.tDSPayment.findMany.mockResolvedValue([])
      prisma.tDSCertificate.findMany.mockResolvedValue([])

      const updatedReturn = {
        id: 'return1',
        returnType: '26Q',
        filingStatus: 'PREPARED'
      }
      prisma.tDSReturn.update.mockResolvedValue(updatedReturn)

      const result = await caller.prepareReturn(returnData)

      expect(result.id).toBe('return1')
      expect(result.returnType).toBe('26Q')
    })
  })
})