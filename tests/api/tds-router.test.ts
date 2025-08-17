import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createInnerTRPCContext } from '@/server/api/trpc'
import { tdsRouter } from '@/server/api/routers/tds'
import { prisma } from '@/server/db'
import { Decimal } from '@prisma/client/runtime/library'

// Mock Prisma
vi.mock('@/server/db', () => ({
  prisma: {
    tDSDeduction: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    tDSConfiguration: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    tDSCertificate: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    tDSReturn: {
      create: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

describe('TDS Router', () => {
  let ctx: any
  let caller: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock context with authenticated user
    ctx = createInnerTRPCContext({
      session: {
        user: {
          id: 'user1',
          email: 'test@example.com'
        }
      }
    })
    
    // Create router caller
    caller = tdsRouter.createCaller(ctx)
  })

  describe('TDS Configuration', () => {
    it('should create TDS configuration', async () => {
      const configData = {
        tan: 'DELS12345F',
        pan: 'AABCG1234D',
        companyName: 'GSTHive Services Pvt Ltd',
        responsiblePersonName: 'John Doe',
        responsiblePersonDesignation: 'Finance Manager',
        responsiblePersonPan: 'ABCDE1234F',
        responsiblePersonMobile: '9876543210',
        responsiblePersonEmail: 'john@gsthive.com',
        address: '123 Business Park, New Delhi - 110001',
        city: 'New Delhi',
        state: 'Delhi',
        pincode: '110001'
      }

      prisma.tDSConfiguration.create.mockResolvedValue({
        id: 'config1',
        userId: 'user1',
        ...configData,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const result = await caller.createConfiguration(configData)

      expect(result.tan).toBe('DELS12345F')
      expect(result.companyName).toBe('GSTHive Services Pvt Ltd')
      expect(prisma.tDSConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user1',
          tan: 'DELS12345F'
        })
      })
    })

    it('should get TDS configuration', async () => {
      const mockConfig = {
        id: 'config1',
        userId: 'user1',
        tan: 'DELS12345F',
        pan: 'AABCG1234D',
        companyName: 'GSTHive Services Pvt Ltd'
      }

      prisma.tDSConfiguration.findFirst.mockResolvedValue(mockConfig)

      const result = await caller.getConfiguration()

      expect(result).toBeDefined()
      expect(result.tan).toBe('DELS12345F')
      expect(prisma.tDSConfiguration.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user1' }
      })
    })

    it('should update TDS configuration', async () => {
      const updateData = {
        responsiblePersonName: 'Jane Doe',
        responsiblePersonDesignation: 'CFO'
      }

      prisma.tDSConfiguration.update.mockResolvedValue({
        id: 'config1',
        userId: 'user1',
        ...updateData
      })

      const result = await caller.updateConfiguration(updateData)

      expect(result.responsiblePersonName).toBe('Jane Doe')
      expect(result.responsiblePersonDesignation).toBe('CFO')
    })
  })

  describe('TDS Deductions', () => {
    it('should record TDS deduction', async () => {
      const deductionData = {
        vendorId: 'vendor1',
        invoiceId: 'invoice1',
        paymentDate: new Date('2024-05-15'),
        paymentAmount: 100000,
        sectionCode: '194J',
        tdsRate: 10,
        tdsAmount: 10000,
        surcharge: 0,
        eduCess: 400,
        totalTDS: 10400
      }

      prisma.tDSDeduction.create.mockResolvedValue({
        id: 'deduction1',
        userId: 'user1',
        ...deductionData,
        paymentAmount: new Decimal(100000),
        tdsAmount: new Decimal(10000),
        surcharge: new Decimal(0),
        eduCess: new Decimal(400),
        totalTDS: new Decimal(10400),
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const result = await caller.recordDeduction(deductionData)

      expect(result.sectionCode).toBe('194J')
      expect(result.tdsRate).toBe(10)
      expect(result.totalTDS.toNumber()).toBe(10400)
    })

    it('should get deductions for a period', async () => {
      const mockDeductions = [
        {
          id: 'deduction1',
          paymentDate: new Date('2024-05-15'),
          sectionCode: '194J',
          paymentAmount: new Decimal(100000),
          totalTDS: new Decimal(10400)
        },
        {
          id: 'deduction2',
          paymentDate: new Date('2024-05-20'),
          sectionCode: '194C',
          paymentAmount: new Decimal(50000),
          totalTDS: new Decimal(520)
        }
      ]

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)

      const result = await caller.getDeductions({
        startDate: new Date('2024-05-01'),
        endDate: new Date('2024-05-31')
      })

      expect(result).toHaveLength(2)
      expect(result[0].sectionCode).toBe('194J')
      expect(result[1].sectionCode).toBe('194C')
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

      const result = await caller.getDeductionsByVendor({
        vendorId: 'vendor1'
      })

      expect(result).toHaveLength(1)
      expect(result[0].vendorId).toBe('vendor1')
    })

    it('should calculate cumulative TDS for threshold checking', async () => {
      const mockDeductions = [
        {
          paymentAmount: new Decimal(50000),
          totalTDS: new Decimal(5000)
        },
        {
          paymentAmount: new Decimal(60000),
          totalTDS: new Decimal(6000)
        }
      ]

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)

      const result = await caller.getCumulativeDeductions({
        vendorId: 'vendor1',
        sectionCode: '194C',
        financialYear: 'FY24-25'
      })

      expect(result.cumulativeAmount).toBe(110000)
      expect(result.cumulativeTDS).toBe(11000)
      expect(result.thresholdExceeded).toBe(true) // 110000 > 100000 threshold
    })
  })

  describe('TDS Deposit and Payment', () => {
    it('should record TDS deposit', async () => {
      const depositData = {
        deductionIds: ['deduction1', 'deduction2'],
        depositDate: new Date('2024-06-07'),
        challanNumber: 'BSR123456',
        bsrCode: '0123456',
        bankName: 'State Bank of India',
        depositAmount: 31200
      }

      prisma.tDSPayment.create.mockResolvedValue({
        id: 'payment1',
        userId: 'user1',
        ...depositData,
        depositAmount: new Decimal(31200),
        createdAt: new Date()
      })

      const result = await caller.recordDeposit(depositData)

      expect(result.challanNumber).toBe('BSR123456')
      expect(result.depositAmount.toNumber()).toBe(31200)
    })

    it('should check for late deposits', async () => {
      const mockDeductions = [
        {
          id: 'deduction1',
          paymentDate: new Date('2024-05-15'),
          depositDate: new Date('2024-06-20'), // Late
          dueDate: new Date('2024-06-07'),
          totalTDS: new Decimal(10400)
        }
      ]

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)

      const result = await caller.getLateDeposits({
        quarter: 'Q1',
        financialYear: 'FY24-25'
      })

      expect(result).toHaveLength(1)
      expect(result[0].daysLate).toBeGreaterThan(0)
      expect(result[0].interest).toBeGreaterThan(0)
      expect(result[0].penalty).toBeGreaterThan(0)
    })
  })

  describe('Form 16A Certificate', () => {
    it('should generate Form 16A certificate', async () => {
      const mockDeductions = [
        {
          id: 'deduction1',
          vendorId: 'vendor1',
          paymentDate: new Date('2024-05-15'),
          paymentAmount: new Decimal(100000),
          sectionCode: '194J',
          totalTDS: new Decimal(10400)
        }
      ]

      const mockConfig = {
        tan: 'DELS12345F',
        pan: 'AABCG1234D',
        companyName: 'GSTHive Services Pvt Ltd'
      }

      const mockVendor = {
        id: 'vendor1',
        name: 'ABC Consulting',
        pan: 'AABCA1234E',
        address: '456 Tech Hub, Bangalore'
      }

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)
      prisma.tDSConfiguration.findFirst.mockResolvedValue(mockConfig)
      prisma.vendor.findUnique.mockResolvedValue(mockVendor)

      const certificateData = {
        vendorId: 'vendor1',
        quarter: 'Q1',
        financialYear: 'FY24-25'
      }

      prisma.tDSCertificate.create.mockResolvedValue({
        id: 'cert1',
        certificateNumber: 'DELS12345F/FY24-25/Q1/001',
        ...certificateData
      })

      const result = await caller.generateForm16A(certificateData)

      expect(result.certificateNumber).toMatch(/DELS12345F\/FY24-25\/Q1\/\d{3}/)
      expect(result.deductor.tan).toBe('DELS12345F')
      expect(result.deductee.pan).toBe('AABCA1234E')
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

      const result = await caller.getCertificates({
        vendorId: 'vendor1'
      })

      expect(result).toHaveLength(1)
      expect(result[0].certificateNumber).toBe('DELS12345F/FY24-25/Q1/001')
    })
  })

  describe('TDS Returns', () => {
    it('should generate quarterly TDS return', async () => {
      const mockDeductions = [
        {
          paymentDate: new Date('2024-05-15'),
          paymentAmount: new Decimal(100000),
          sectionCode: '194J',
          totalTDS: new Decimal(10400)
        },
        {
          paymentDate: new Date('2024-06-20'),
          paymentAmount: new Decimal(200000),
          sectionCode: '194J',
          totalTDS: new Decimal(20800)
        }
      ]

      prisma.tDSDeduction.findMany.mockResolvedValue(mockDeductions)

      const returnData = {
        quarter: 'Q1',
        financialYear: 'FY24-25',
        formType: '26Q' // For non-salary TDS
      }

      prisma.tDSReturn.create.mockResolvedValue({
        id: 'return1',
        ...returnData,
        totalTDS: new Decimal(31200)
      })

      const result = await caller.generateQuarterlyReturn(returnData)

      expect(result.formType).toBe('26Q')
      expect(result.totalTDS.toNumber()).toBe(31200)
      expect(result.sectionWiseSummary['194J'].count).toBe(2)
    })

    it('should validate return before filing', async () => {
      const returnData = {
        id: 'return1',
        quarter: 'Q1',
        financialYear: 'FY24-25',
        totalTDS: new Decimal(31200),
        totalDeposited: new Decimal(30000) // Less than deducted
      }

      const result = await caller.validateReturn(returnData)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('TDS deposited is less than TDS deducted')
    })

    it('should file TDS return', async () => {
      const mockReturn = {
        id: 'return1',
        status: 'DRAFT'
      }

      prisma.tDSReturn.update.mockResolvedValue({
        ...mockReturn,
        status: 'FILED',
        filedDate: new Date(),
        acknowledgmentNumber: 'ACK123456'
      })

      const result = await caller.fileReturn({
        returnId: 'return1',
        acknowledgmentNumber: 'ACK123456'
      })

      expect(result.status).toBe('FILED')
      expect(result.acknowledgmentNumber).toBe('ACK123456')
    })
  })
})