import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ITCRegisterService } from '../../../lib/itc/itc-register'
import type { 
  ITCRegisterData,
  ITCRegisterSummary,
  ITCUtilizationMetrics,
  ITCReport,
  ITCAgingReport,
  ITCDashboardData,
  ITCPeriodData,
  ITCVendorReport,
  ITCHSNReport,
  ITCComplianceStatus
} from '../../../lib/itc/itc-register'

// Mock Prisma client
const mockPrisma = {
  iTCRegister: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  purchaseInvoice: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  vendor: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}

describe('ITCRegisterService', () => {
  let service: ITCRegisterService

  beforeEach(() => {
    service = new ITCRegisterService(mockPrisma as any)
    vi.clearAllMocks()
  })

  describe('initializeRegister', () => {
    it('should initialize ITC register for a new period', async () => {
      const userId = 'user-123'
      const period = '04-2024'
      const financialYear = 'FY24-25'
      const openingBalance = 50000

      mockPrisma.iTCRegister.findUnique.mockResolvedValue(null)
      mockPrisma.iTCRegister.create.mockResolvedValue({
        id: 'register-123',
        userId,
        period,
        financialYear,
        openingBalance,
        eligibleITC: 0,
        claimedITC: 0,
        reversedITC: 0,
        blockedITC: 0,
        closingBalance: openingBalance,
        inputsITC: 0,
        capitalGoodsITC: 0,
        inputServicesITC: 0,
        isReconciled: false,
        reconciledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.initializeRegister(userId, period, financialYear, openingBalance)

      expect(mockPrisma.iTCRegister.create).toHaveBeenCalledWith({
        data: {
          userId,
          period,
          financialYear,
          openingBalance,
          eligibleITC: 0,
          claimedITC: 0,
          reversedITC: 0,
          blockedITC: 0,
          closingBalance: openingBalance,
          inputsITC: 0,
          capitalGoodsITC: 0,
          inputServicesITC: 0,
          isReconciled: false,
        }
      })

      expect(result.period).toBe(period)
      expect(result.openingBalance).toBe(openingBalance)
      expect(result.closingBalance).toBe(openingBalance)
    })

    it('should return existing register if already initialized', async () => {
      const userId = 'user-123'
      const period = '04-2024'
      const existingRegister = {
        id: 'register-123',
        userId,
        period,
        financialYear: 'FY24-25',
        openingBalance: 30000,
        closingBalance: 45000,
      }

      mockPrisma.iTCRegister.findUnique.mockResolvedValue(existingRegister)

      const result = await service.initializeRegister(userId, period, 'FY24-25', 50000)

      expect(mockPrisma.iTCRegister.create).not.toHaveBeenCalled()
      expect(result).toEqual(existingRegister)
    })

    it('should throw error for invalid period format', async () => {
      await expect(
        service.initializeRegister('user-123', '2024-04', 'FY24-25', 0)
      ).rejects.toThrow('Invalid period format. Expected MM-YYYY')
    })

    it('should throw error for negative opening balance', async () => {
      await expect(
        service.initializeRegister('user-123', '04-2024', 'FY24-25', -1000)
      ).rejects.toThrow('Opening balance cannot be negative')
    })
  })

  describe('updateRegister', () => {
    const sampleTransactions = [
      {
        id: 'txn-1',
        vendorGSTIN: '27AABCU9603R1ZN',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2024-04-15'),
        taxableAmount: 10000,
        cgstAmount: 900,
        sgstAmount: 900,
        igstAmount: 0,
        itcCategory: 'INPUTS' as const,
        itcEligible: true,
        hsn: '85234910',
      },
      {
        id: 'txn-2',
        vendorGSTIN: '29AABCU9603R1ZN',
        invoiceNumber: 'INV-002',
        invoiceDate: new Date('2024-04-20'),
        taxableAmount: 50000,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 9000,
        itcCategory: 'CAPITAL_GOODS' as const,
        itcEligible: true,
        hsn: '84713000',
      },
    ]

    it('should update register with new transactions', async () => {
      const userId = 'user-123'
      const period = '04-2024'
      
      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        id: 'register-123',
        userId,
        period,
        openingBalance: 30000,
        eligibleITC: 15000,
        claimedITC: 12000,
        reversedITC: 1000,
        blockedITC: 500,
        inputsITC: 8000,
        capitalGoodsITC: 4000,
        inputServicesITC: 0,
      })

      mockPrisma.iTCRegister.update.mockResolvedValue({
        id: 'register-123',
        userId,
        period,
        openingBalance: 30000,
        eligibleITC: 25800, // 15000 + 1800 + 9000
        claimedITC: 22800,  // 12000 + 1800 + 9000
        reversedITC: 1000,
        blockedITC: 500,
        closingBalance: 51800, // 30000 + 22800 - 1000
        inputsITC: 9800,    // 8000 + 1800
        capitalGoodsITC: 13000, // 4000 + 9000
        inputServicesITC: 0,
      })

      const result = await service.updateRegister(userId, period, sampleTransactions)

      expect(mockPrisma.iTCRegister.update).toHaveBeenCalledWith({
        where: { userId_period: { userId, period } },
        data: {
          eligibleITC: 25800,
          claimedITC: 22800,
          closingBalance: 51800,
          inputsITC: 9800,
          capitalGoodsITC: 13000,
          inputServicesITC: 0,
        }
      })

      expect(result.eligibleITC).toBe(25800)
      expect(result.inputsITC).toBe(9800)
      expect(result.capitalGoodsITC).toBe(13000)
    })

    it('should handle blocked ITC transactions', async () => {
      const blockedTransactions = [
        {
          id: 'txn-3',
          vendorGSTIN: '27AABCU9603R1ZN',
          invoiceNumber: 'INV-003',
          invoiceDate: new Date('2024-04-25'),
          taxableAmount: 5000,
          cgstAmount: 450,
          sgstAmount: 450,
          igstAmount: 0,
          itcCategory: 'BLOCKED' as const,
          itcEligible: false,
          hsn: '87032310', // Motor vehicles
        },
      ]

      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        id: 'register-123',
        userId: 'user-123',
        period: '04-2024',
        openingBalance: 30000,
        eligibleITC: 15000,
        claimedITC: 12000,
        reversedITC: 1000,
        blockedITC: 500,
        inputsITC: 8000,
        capitalGoodsITC: 4000,
        inputServicesITC: 0,
      })

      mockPrisma.iTCRegister.update.mockResolvedValue({
        id: 'register-123',
        blockedITC: 1400, // 500 + 900
      })

      const result = await service.updateRegister('user-123', '04-2024', blockedTransactions)

      expect(result.blockedITC).toBe(1400)
    })

    it('should throw error if register not found', async () => {
      mockPrisma.iTCRegister.findUnique.mockResolvedValue(null)

      await expect(
        service.updateRegister('user-123', '04-2024', sampleTransactions)
      ).rejects.toThrow('ITC Register not found for period 04-2024')
    })
  })

  describe('calculateClosingBalance', () => {
    it('should calculate correct closing balance', async () => {
      const userId = 'user-123'
      const period = '04-2024'

      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        openingBalance: 25000,
        claimedITC: 18000,
        reversedITC: 2000,
        blockedITC: 1500,
      })

      const closingBalance = await service.calculateClosingBalance(userId, period)

      expect(closingBalance).toBe(41000) // 25000 + 18000 - 2000
    })

    it('should handle utilization of ITC', async () => {
      const userId = 'user-123'
      const period = '04-2024'
      const utilizationAmount = 15000

      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        openingBalance: 25000,
        claimedITC: 18000,
        reversedITC: 2000,
        blockedITC: 1500,
      })

      const closingBalance = await service.calculateClosingBalance(userId, period, utilizationAmount)

      expect(closingBalance).toBe(26000) // 25000 + 18000 - 2000 - 15000
    })

    it('should not allow negative closing balance', async () => {
      const userId = 'user-123'
      const period = '04-2024'
      const utilizationAmount = 50000

      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        openingBalance: 25000,
        claimedITC: 18000,
        reversedITC: 2000,
      })

      await expect(
        service.calculateClosingBalance(userId, period, utilizationAmount)
      ).rejects.toThrow('Insufficient ITC balance for utilization')
    })
  })

  describe('generateMonthlyReport', () => {
    it('should generate comprehensive monthly ITC report', async () => {
      const userId = 'user-123'
      const period = '04-2024'

      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        id: 'register-123',
        period,
        financialYear: 'FY24-25',
        openingBalance: 30000,
        eligibleITC: 25000,
        claimedITC: 22000,
        reversedITC: 1500,
        blockedITC: 800,
        closingBalance: 50500,
        inputsITC: 15000,
        capitalGoodsITC: 5000,
        inputServicesITC: 2000,
        isReconciled: true,
        reconciledAt: new Date('2024-05-01'),
      })

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue([
        {
          vendorGSTIN: '27AABCU9603R1ZN',
          invoiceCount: 5,
          totalTaxableAmount: 100000,
          totalITC: 18000,
        },
      ])

      const report = await service.generateMonthlyReport(userId, period)

      expect(report.summary.period).toBe(period)
      expect(report.summary.openingBalance).toBe(30000)
      expect(report.summary.closingBalance).toBe(50500)
      expect(report.summary.netMovement).toBe(20500) // 50500 - 30000
      expect(report.summary.utilizationRate).toBe(88) // (22000/25000) * 100

      expect(report.categoryBreakdown.inputs).toBe(15000)
      expect(report.categoryBreakdown.capitalGoods).toBe(5000)
      expect(report.categoryBreakdown.inputServices).toBe(2000)
      expect(report.categoryBreakdown.blocked).toBe(800)

      expect(report.reconciliation.isReconciled).toBe(true)
      expect(report.reconciliation.reconciledAt).toEqual(new Date('2024-05-01'))
    })

    it('should calculate correct utilization metrics', async () => {
      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        openingBalance: 40000,
        eligibleITC: 30000,
        claimedITC: 25000,
        reversedITC: 2000,
        blockedITC: 1000,
        closingBalance: 63000,
      })

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue([])

      const report = await service.generateMonthlyReport('user-123', '04-2024')

      expect(report.summary.utilizationRate).toBe(83) // (25000/30000) * 100
      expect(report.summary.reversalRate).toBe(7) // (2000/30000) * 100
      expect(report.summary.blockageRate).toBe(3) // (1000/30000) * 100
    })

    it('should throw error for non-existent period', async () => {
      mockPrisma.iTCRegister.findUnique.mockResolvedValue(null)

      await expect(
        service.generateMonthlyReport('user-123', '13-2024')
      ).rejects.toThrow('ITC Register not found for period 13-2024')
    })
  })

  describe('generateVendorReport', () => {
    it('should generate vendor-wise ITC analysis', async () => {
      const userId = 'user-123'
      const period = '04-2024'

      const mockVendorData = [
        {
          vendorGSTIN: '27AABCU9603R1ZN',
          taxableAmount: 100000,
          cgstAmount: 9000,
          sgstAmount: 9000,
          igstAmount: 0,
          itcEligible: true,
          vendor: { name: 'ABC Corp Ltd' },
        },
        {
          vendorGSTIN: '27AABCU9603R1ZN',
          taxableAmount: 50000,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 9000,
          itcEligible: false,
          vendor: { name: 'ABC Corp Ltd' },
        },
        {
          vendorGSTIN: '29AABCU9603R1ZN',
          taxableAmount: 75000,
          cgstAmount: 6750,
          sgstAmount: 6750,
          igstAmount: 0,
          itcEligible: true,
          vendor: { name: 'XYZ Services Pvt Ltd' },
        },
      ]

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue(mockVendorData)

      const report = await service.generateVendorReport(userId, period)

      expect(report.period).toBe(period)
      expect(report.vendors).toHaveLength(2)

      const vendor1 = report.vendors[0]
      expect(vendor1.vendorGSTIN).toBe('27AABCU9603R1ZN')
      expect(vendor1.utilizationRate).toBe(67) // (18000/27000) * 100
      expect(vendor1.reconciliationRate).toBe(0) // (0/2) * 100

      const vendor2 = report.vendors[1]
      expect(vendor2.vendorGSTIN).toBe('29AABCU9603R1ZN')
      expect(vendor2.utilizationRate).toBe(100)
      expect(vendor2.reconciliationRate).toBe(0)

      expect(report.totals.totalVendors).toBe(2)
      expect(report.totals.totalInvoices).toBe(3)
      expect(report.totals.totalITC).toBe(40500)
      expect(report.totals.averageUtilizationRate).toBe(84) // ((67+100)/2)
    })

    it('should filter vendors by minimum threshold', async () => {
      mockPrisma.purchaseInvoice.findMany.mockResolvedValue([
        {
          vendorGSTIN: '27AABCU9603R1ZN',
          taxableAmount: 100000,
          cgstAmount: 25000,
          sgstAmount: 25000,
          igstAmount: 0,
          itcEligible: true,
          vendor: { name: 'High Value Vendor' },
        },
        {
          vendorGSTIN: '29AABCU9603R1ZN',
          taxableAmount: 1000,
          cgstAmount: 250,
          sgstAmount: 250,
          igstAmount: 0,
          itcEligible: true,
          vendor: { name: 'Low Value Vendor' },
        },
      ])

      const report = await service.generateVendorReport('user-123', '04-2024', { minITCAmount: 1000 })

      expect(report.vendors).toHaveLength(1)
      expect(report.vendors[0].vendorGSTIN).toBe('27AABCU9603R1ZN')
    })
  })

  describe('generateHSNReport', () => {
    it('should generate HSN-wise ITC breakdown', async () => {
      const userId = 'user-123'
      const period = '04-2024'

      const mockHSNData = [
        {
          invoiceNumber: 'INV-001',
          itcEligible: true,
          lineItems: [
            {
              hsn: '85234910',
              description: 'Electronic components',
              taxableAmount: 100000,
              cgstAmount: 9000,
              sgstAmount: 9000,
              igstAmount: 0,
              gstRate: 18,
            },
            {
              hsn: '85234910',
              description: 'Electronic components',
              taxableAmount: 100000,
              cgstAmount: 9000,
              sgstAmount: 9000,
              igstAmount: 0,
              gstRate: 18,
            },
          ],
        },
        {
          invoiceNumber: 'INV-002',
          itcEligible: true,
          lineItems: [
            {
              hsn: '84713000',
              description: 'Computer equipment',
              taxableAmount: 150000,
              cgstAmount: 13500,
              sgstAmount: 13500,
              igstAmount: 0,
              gstRate: 18,
            },
          ],
        },
      ]

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue(mockHSNData)

      const report = await service.generateHSNReport(userId, period)

      expect(report.period).toBe(period)
      expect(report.hsnCodes).toHaveLength(2)

      const hsn1 = report.hsnCodes[0]
      expect(hsn1.hsn).toBe('85234910')
      expect(hsn1.utilizationRate).toBe(100) // (36000/36000) * 100
      expect(hsn1.averageITCPerInvoice).toBe(36000) // 36000/1

      expect(report.totals.totalHSNCodes).toBe(2)
      expect(report.totals.totalITC).toBe(63000)
      expect(report.totals.weightedAvgGSTRate).toBe(18)
    })

    it('should sort HSN codes by ITC amount in descending order', async () => {
      mockPrisma.purchaseInvoice.findMany.mockResolvedValue([
        {
          invoiceNumber: 'INV-001',
          itcEligible: true,
          lineItems: [
            {
              hsn: '85234910',
              description: 'Electronics',
              taxableAmount: 50000,
              cgstAmount: 5000,
              sgstAmount: 5000,
              igstAmount: 0,
              gstRate: 18,
            },
          ],
        },
        {
          invoiceNumber: 'INV-002',
          itcEligible: true,
          lineItems: [
            {
              hsn: '84713000',
              description: 'Computers',
              taxableAmount: 100000,
              cgstAmount: 9000,
              sgstAmount: 9000,
              igstAmount: 0,
              gstRate: 18,
            },
          ],
        },
        {
          invoiceNumber: 'INV-003',
          itcEligible: true,
          lineItems: [
            {
              hsn: '39269099',
              description: 'Plastics',
              taxableAmount: 30000,
              cgstAmount: 2700,
              sgstAmount: 2700,
              igstAmount: 0,
              gstRate: 18,
            },
          ],
        },
      ])

      const report = await service.generateHSNReport('user-123', '04-2024')

      expect(report.hsnCodes[0].hsn).toBe('84713000') // Highest ITC (18000)
      expect(report.hsnCodes[1].hsn).toBe('85234910') // Middle ITC (10000)
      expect(report.hsnCodes[2].hsn).toBe('39269099') // Lowest ITC (5400)
    })
  })

  describe('trackITCUtilization', () => {
    it('should calculate accurate utilization metrics', async () => {
      const userId = 'user-123'
      const fromDate = new Date('2024-01-01')
      const toDate = new Date('2024-04-30')

      mockPrisma.iTCRegister.findMany.mockResolvedValue([
        {
          period: '01-2024',
          eligibleITC: 25000,
          claimedITC: 20000,
          reversedITC: 1000,
          blockedITC: 500,
        },
        {
          period: '02-2024',
          eligibleITC: 30000,
          claimedITC: 28000,
          reversedITC: 800,
          blockedITC: 200,
        },
        {
          period: '03-2024',
          eligibleITC: 22000,
          claimedITC: 20000,
          reversedITC: 1200,
          blockedITC: 800,
        },
        {
          period: '04-2024',
          eligibleITC: 35000,
          claimedITC: 32000,
          reversedITC: 500,
          blockedITC: 300,
        },
      ])

      const metrics = await service.trackITCUtilization(userId, fromDate, toDate)

      expect(metrics.totalEligibleITC).toBe(112000)
      expect(metrics.totalClaimedITC).toBe(100000)
      expect(metrics.totalReversedITC).toBe(3500)
      expect(metrics.totalBlockedITC).toBe(1800)

      expect(metrics.utilizationRate).toBe(89) // (100000/112000) * 100
      expect(metrics.reversalRate).toBe(3) // (3500/112000) * 100
      expect(metrics.blockageRate).toBe(2) // (1800/112000) * 100

      expect(metrics.averageMonthlyITC).toBe(28000) // 112000/4
      expect(metrics.monthlyTrend).toBe('stable') // Based on recent periods

      expect(metrics.periodBreakdown).toHaveLength(4)
      expect(metrics.periodBreakdown[3].period).toBe('04-2024')
      expect(metrics.periodBreakdown[3].utilizationRate).toBe(91) // (32000/35000) * 100
    })

    it('should identify trend correctly', async () => {
      // Test decreasing trend
      mockPrisma.iTCRegister.findMany.mockResolvedValue([
        { period: '01-2024', eligibleITC: 40000 },
        { period: '02-2024', eligibleITC: 35000 },
        { period: '03-2024', eligibleITC: 30000 },
        { period: '04-2024', eligibleITC: 25000 },
      ])

      const metrics = await service.trackITCUtilization('user-123', new Date(), new Date())

      expect(metrics.monthlyTrend).toBe('decreasing')
    })
  })

  describe('generateAgingReport', () => {
    it('should generate ITC aging analysis', async () => {
      const userId = 'user-123'
      const asOfDate = new Date('2024-05-15')

      const mockAgingData = [
        {
          invoiceDate: new Date('2024-04-10'), // 35 days old
          vendorGSTIN: '27AABCU9603R1ZN',
          invoiceNumber: 'INV-001',
          cgstAmount: 9000,
          sgstAmount: 9000,
          igstAmount: 0,
          paymentStatus: 'PAID',
          paymentDate: new Date('2024-04-25'),
        },
        {
          invoiceDate: new Date('2024-03-15'), // 61 days old
          vendorGSTIN: '29AABCU9603R1ZN',
          invoiceNumber: 'INV-002',
          cgstAmount: 13500,
          sgstAmount: 13500,
          igstAmount: 0,
          paymentStatus: 'PAID',
          paymentDate: new Date('2024-04-10'),
        },
        {
          invoiceDate: new Date('2023-12-10'), // 156 days old
          vendorGSTIN: '27AABCU9603R1ZN',
          invoiceNumber: 'INV-003',
          cgstAmount: 11250,
          sgstAmount: 11250,
          igstAmount: 0,
          paymentStatus: 'UNPAID',
          paymentDate: null,
        },
      ]

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue(mockAgingData)

      const report = await service.generateAgingReport(userId, asOfDate)

      expect(report.asOfDate).toBe(asOfDate)
      expect(report.agingBuckets['0-30']).toBe(0)
      expect(report.agingBuckets['31-60']).toBe(18000)
      expect(report.agingBuckets['61-90']).toBe(27000)
      expect(report.agingBuckets['91-180']).toBe(22500)
      expect(report.agingBuckets['181-365']).toBe(0)
      expect(report.agingBuckets['over-365']).toBe(0)

      expect(report.riskAnalysis.atRiskAmount).toBe(0) // No invoices > 180 days
      expect(report.riskAnalysis.criticalInvoices).toBe(0)
      expect(report.riskAnalysis.recommendedAction).toBe('All invoices are within compliance parameters')

      expect(report.complianceAlerts).toHaveLength(0)
    })

    it('should identify invoices requiring reversal', async () => {
      const asOfDate = new Date('2024-06-01')
      
      const mockData = [
        {
          invoiceDate: new Date('2023-11-15'), // >180 days, unpaid
          invoiceNumber: 'INV-OLD',
          vendorGSTIN: '27AABCU9603R1ZN',
          cgstAmount: 22500,
          sgstAmount: 22500,
          igstAmount: 0,
          paymentStatus: 'UNPAID',
          paymentDate: null,
        },
      ]

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue(mockData)

      const report = await service.generateAgingReport('user-123', asOfDate)

      expect(report.riskAnalysis.atRiskAmount).toBe(45000)
      expect(report.complianceAlerts[0].alertMessage).toContain('ITC must be reversed')
    })
  })

  describe('checkComplianceStatus', () => {
    it('should check comprehensive compliance status', async () => {
      const userId = 'user-123'
      const period = '04-2024'

      // Mock register data
      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        period,
        eligibleITC: 100000,
        claimedITC: 85000,
        reversedITC: 5000,
        isReconciled: true,
        reconciledAt: new Date('2024-05-10'),
      })

      // Mock purchase invoice data for payment compliance
      mockPrisma.purchaseInvoice.findMany.mockResolvedValue([
        {
          invoiceDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
          cgstAmount: 9000,
          sgstAmount: 9000,
          igstAmount: 0,
          paymentStatus: 'PAID',
          paymentDate: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), // Paid 50 days ago
        },
        {
          invoiceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          cgstAmount: 13500,
          sgstAmount: 13500,
          igstAmount: 0,
          paymentStatus: 'UNPAID',
          paymentDate: null,
        },
      ])

      const compliance = await service.checkComplianceStatus(userId, period)

      expect(compliance.period).toBe(period)
      expect(compliance.overallScore).toBe(100) // High compliance score

      expect(compliance.reconciliationCompliance.isCompliant).toBe(true)
      expect(compliance.reconciliationCompliance.status).toBe('RECONCILED')

      expect(compliance.paymentCompliance.isCompliant).toBe(true)
      expect(compliance.paymentCompliance.atRiskAmount).toBe(0)

      expect(compliance.utilizationCompliance.isCompliant).toBe(true)
      expect(compliance.utilizationCompliance.utilizationRate).toBe(85)

      expect(compliance.recommendations).toHaveLength(0) // No recommendations for high compliance
    })

    it('should identify compliance issues', async () => {
      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        period: '04-2024',
        eligibleITC: 100000,
        claimedITC: 110000, // Over-claimed
        isReconciled: false,
      })

      mockPrisma.purchaseInvoice.findMany.mockResolvedValue([
        {
          invoiceDate: new Date('2023-10-15'), // >180 days old
          cgstAmount: 22500,
          sgstAmount: 22500,
          igstAmount: 0,
          paymentStatus: 'UNPAID',
        },
      ])

      const compliance = await service.checkComplianceStatus('user-123', '04-2024')

      expect(compliance.overallScore).toBeLessThan(50) // Poor compliance

      expect(compliance.reconciliationCompliance.isCompliant).toBe(false)
      expect(compliance.paymentCompliance.isCompliant).toBe(false)
      expect(compliance.paymentCompliance.atRiskAmount).toBe(45000)
      expect(compliance.utilizationCompliance.isCompliant).toBe(false) // Over-claimed

      expect(compliance.recommendations.length).toBeGreaterThan(0)
      expect(compliance.recommendations).toContain('Complete GSTR-2A/2B reconciliation')
      expect(compliance.recommendations).toContain('Reverse ITC for unpaid invoices older than 180 days')
    })
  })

  describe('generateDashboard', () => {
    it('should generate comprehensive dashboard data', async () => {
      const userId = 'user-123'
      const financialYear = 'FY24-25'

      // Mock register data for multiple periods
      mockPrisma.iTCRegister.findMany.mockResolvedValue([
        {
          period: '04-2024',
          eligibleITC: 25000,
          claimedITC: 23000,
          reversedITC: 1000,
          blockedITC: 500,
          closingBalance: 45000,
        },
        {
          period: '05-2024',
          eligibleITC: 30000,
          claimedITC: 28000,
          reversedITC: 800,
          blockedITC: 200,
          closingBalance: 72200,
        },
        {
          period: '06-2024',
          eligibleITC: 35000,
          claimedITC: 33000,
          reversedITC: 500,
          blockedITC: 300,
          closingBalance: 104700,
        },
      ])

      // Mock purchase data for alerts
      mockPrisma.purchaseInvoice.findMany.mockResolvedValue([
        {
          invoiceDate: new Date('2023-12-01'), // >180 days
          totalITC: 15000,
          paymentStatus: 'UNPAID',
        },
      ])

      const dashboard = await service.generateDashboard(userId, financialYear)

      expect(dashboard.period).toBe(financialYear)
      expect(dashboard.summary.totalEligibleITC).toBe(90000)
      expect(dashboard.summary.totalClaimedITC).toBe(84000)
      expect(dashboard.summary.currentBalance).toBe(104700)
      expect(dashboard.summary.utilizationRate).toBe(93) // (84000/90000) * 100

      expect(dashboard.trends.monthlyData).toHaveLength(3)
      expect(dashboard.trends.growth.rate).toBeGreaterThan(0) // Positive growth
      expect(dashboard.trends.growth.direction).toBe('increasing')

      expect(dashboard.alerts).toHaveLength(1)
      expect(dashboard.alerts[0].type).toBe('PAYMENT_OVERDUE')
      expect(dashboard.alerts[0].severity).toBe('high')

      expect(dashboard.insights.topPerformingCategory).toBe('INPUT_SERVICES') // Assuming highest utilization
      expect(dashboard.insights.averageProcessingTime).toBeGreaterThan(0)
    })

    it('should handle empty data gracefully', async () => {
      mockPrisma.iTCRegister.findMany.mockResolvedValue([])
      mockPrisma.purchaseInvoice.findMany.mockResolvedValue([])

      const dashboard = await service.generateDashboard('user-123', 'FY24-25')

      expect(dashboard.summary.totalEligibleITC).toBe(0)
      expect(dashboard.summary.utilizationRate).toBe(0)
      expect(dashboard.trends.monthlyData).toHaveLength(0)
      expect(dashboard.alerts).toHaveLength(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockPrisma.iTCRegister.findUnique.mockRejectedValue(new Error('Database connection failed'))

      await expect(
        service.generateMonthlyReport('user-123', '04-2024')
      ).rejects.toThrow('Database connection failed')
    })

    it('should validate input parameters', async () => {
      await expect(
        service.initializeRegister('', '04-2024', 'FY24-25', 0)
      ).rejects.toThrow('User ID is required')

      await expect(
        service.generateVendorReport('user-123', '')
      ).rejects.toThrow('Period is required')
    })

    it('should handle concurrent updates gracefully', async () => {
      const userId = 'user-123'
      const period = '04-2024'
      
      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        id: 'register-123',
        openingBalance: 0,
        eligibleITC: 0,
        claimedITC: 0,
        reversedITC: 0,
        blockedITC: 0,
        inputsITC: 0,
        capitalGoodsITC: 0,
        inputServicesITC: 0,
      })

      mockPrisma.iTCRegister.update.mockRejectedValue(new Error('Record was modified by another process'))

      await expect(
        service.updateRegister(userId, period, [])
      ).rejects.toThrow('Record was modified by another process')
    })
  })

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `txn-${i}`,
        vendorGSTIN: `27AABCU960${i % 10}R1ZN`,
        invoiceNumber: `INV-${i}`,
        invoiceDate: new Date(),
        taxableAmount: 1000,
        cgstAmount: 90,
        sgstAmount: 90,
        igstAmount: 0,
        itcCategory: 'INPUTS' as const,
        itcEligible: true,
        hsn: '85234910',
      }))

      mockPrisma.iTCRegister.findUnique.mockResolvedValue({
        id: 'register-123',
        openingBalance: 0,
        eligibleITC: 0,
        claimedITC: 0,
        reversedITC: 0,
        blockedITC: 0,
        inputsITC: 0,
        capitalGoodsITC: 0,
        inputServicesITC: 0,
      })

      mockPrisma.iTCRegister.update.mockResolvedValue({
        eligibleITC: 1800000, // 10000 * 180
      })

      const startTime = Date.now()
      await service.updateRegister('user-123', '04-2024', largeDataset)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })
})