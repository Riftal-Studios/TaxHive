import type { PrismaClient } from '@prisma/client'

// Types for ITC Register Service
export interface ITCRegisterData {
  id: string
  userId: string
  period: string
  financialYear: string
  openingBalance: number
  eligibleITC: number
  claimedITC: number
  reversedITC: number
  blockedITC: number
  closingBalance: number
  inputsITC: number
  capitalGoodsITC: number
  inputServicesITC: number
  isReconciled: boolean
  reconciledAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ITCTransaction {
  id: string
  vendorGSTIN: string
  invoiceNumber: string
  invoiceDate: Date
  taxableAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  itcCategory: 'INPUTS' | 'CAPITAL_GOODS' | 'INPUT_SERVICES' | 'BLOCKED'
  itcEligible: boolean
  hsn: string
}

export interface ITCRegisterSummary {
  period: string
  financialYear: string
  openingBalance: number
  eligibleITC: number
  claimedITC: number
  reversedITC: number
  blockedITC: number
  closingBalance: number
  netMovement: number
  utilizationRate: number
  reversalRate: number
  blockageRate: number
}

export interface ITCCategoryBreakdown {
  inputs: number
  capitalGoods: number
  inputServices: number
  blocked: number
  total: number
}

export interface ITCReconciliationStatus {
  isReconciled: boolean
  reconciledAt: Date | null
  pendingInvoices: number
  matchedInvoices: number
  mismatchedInvoices: number
  reconciliationRate: number
}

export interface ITCReport {
  summary: ITCRegisterSummary
  categoryBreakdown: ITCCategoryBreakdown
  reconciliation: ITCReconciliationStatus
  vendorBreakdown: Array<{
    vendorGSTIN: string
    vendorName: string
    invoiceCount: number
    totalITC: number
    eligibleITC: number
  }>
  complianceStatus: {
    paymentCompliance: boolean
    reconciliationCompliance: boolean
    utilizationCompliance: boolean
    overallScore: number
  }
}

export interface ITCVendorReport {
  period: string
  vendors: Array<{
    vendorGSTIN: string
    vendorName: string
    totalInvoices: number
    totalTaxableAmount: number
    totalITC: number
    eligibleITC: number
    blockedITC: number
    reconciledInvoices: number
    pendingInvoices: number
    utilizationRate: number
    reconciliationRate: number
  }>
  totals: {
    totalVendors: number
    totalInvoices: number
    totalTaxableAmount: number
    totalITC: number
    eligibleITC: number
    averageUtilizationRate: number
  }
}

export interface ITCHSNReport {
  period: string
  hsnCodes: Array<{
    hsn: string
    description: string
    totalInvoices: number
    totalTaxableAmount: number
    totalITC: number
    eligibleITC: number
    blockedITC: number
    utilizationRate: number
    averageITCPerInvoice: number
    avgGSTRate: number
  }>
  totals: {
    totalHSNCodes: number
    totalInvoices: number
    totalTaxableAmount: number
    totalITC: number
    eligibleITC: number
    weightedAvgGSTRate: number
  }
}

export interface ITCUtilizationMetrics {
  totalEligibleITC: number
  totalClaimedITC: number
  totalReversedITC: number
  totalBlockedITC: number
  utilizationRate: number
  reversalRate: number
  blockageRate: number
  averageMonthlyITC: number
  monthlyTrend: 'increasing' | 'decreasing' | 'stable'
  periodBreakdown: Array<{
    period: string
    eligibleITC: number
    claimedITC: number
    utilizationRate: number
  }>
}

export interface ITCAgingReport {
  asOfDate: Date
  agingBuckets: {
    '0-30': number
    '31-60': number
    '61-90': number
    '91-180': number
    '181-365': number
    'over-365': number
  }
  riskAnalysis: {
    atRiskAmount: number
    criticalInvoices: number
    recommendedAction: string
  }
  complianceAlerts: Array<{
    type: 'REVERSAL_REQUIRED' | 'PAYMENT_OVERDUE' | 'RECONCILIATION_PENDING'
    invoiceNumber: string
    vendorGSTIN: string
    amount: number
    ageInDays: number
    alertMessage: string
  }>
}

export interface ITCComplianceStatus {
  period: string
  overallScore: number
  reconciliationCompliance: {
    isCompliant: boolean
    status: 'RECONCILED' | 'PENDING' | 'MISMATCHED'
    reconciliationRate: number
  }
  paymentCompliance: {
    isCompliant: boolean
    atRiskAmount: number
    criticalInvoices: number
  }
  utilizationCompliance: {
    isCompliant: boolean
    utilizationRate: number
    excessClaimed: number
  }
  recommendations: string[]
}

export interface ITCDashboardData {
  period: string
  summary: {
    totalEligibleITC: number
    totalClaimedITC: number
    totalReversedITC: number
    currentBalance: number
    utilizationRate: number
    monthOverMonthGrowth: number
  }
  trends: {
    monthlyData: Array<{
      period: string
      eligibleITC: number
      claimedITC: number
      closingBalance: number
    }>
    growth: {
      rate: number
      direction: 'increasing' | 'decreasing' | 'stable'
    }
  }
  alerts: Array<{
    type: 'PAYMENT_OVERDUE' | 'RECONCILIATION_PENDING' | 'OVER_UTILIZATION' | 'REVERSAL_REQUIRED'
    severity: 'low' | 'medium' | 'high' | 'critical'
    message: string
    count: number
  }>
  insights: {
    topPerformingCategory: string
    averageProcessingTime: number
    complianceScore: number
    recommendations: string[]
  }
}

export interface ITCPeriodData {
  period: string
  data: ITCRegisterData
}

export class ITCRegisterService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Initialize ITC register for a new period
   */
  async initializeRegister(
    userId: string,
    period: string,
    financialYear: string,
    openingBalance: number = 0
  ): Promise<ITCRegisterData> {
    // Validate inputs
    if (!userId) {
      throw new Error('User ID is required')
    }

    if (!period || !/^\d{2}-\d{4}$/.test(period)) {
      throw new Error('Invalid period format. Expected MM-YYYY')
    }

    if (openingBalance < 0) {
      throw new Error('Opening balance cannot be negative')
    }

    // Check if register already exists
    const existingRegister = await this.prisma.iTCRegister.findUnique({
      where: { userId_period: { userId, period } }
    })

    if (existingRegister) {
      return existingRegister as ITCRegisterData
    }

    // Create new register
    const register = await this.prisma.iTCRegister.create({
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

    return register as ITCRegisterData
  }

  /**
   * Update register with new transactions
   */
  async updateRegister(
    userId: string,
    period: string,
    transactions: ITCTransaction[]
  ): Promise<ITCRegisterData> {
    // Get existing register
    const register = await this.prisma.iTCRegister.findUnique({
      where: { userId_period: { userId, period } }
    })

    if (!register) {
      throw new Error(`ITC Register not found for period ${period}`)
    }

    // Calculate new ITC amounts from transactions
    let newEligibleITC = 0
    let newClaimedITC = 0
    let newBlockedITC = 0
    let newInputsITC = 0
    let newCapitalGoodsITC = 0
    let newInputServicesITC = 0

    transactions.forEach(transaction => {
      const totalITC = transaction.cgstAmount + transaction.sgstAmount + transaction.igstAmount

      if (transaction.itcEligible && transaction.itcCategory !== 'BLOCKED') {
        newEligibleITC += totalITC
        newClaimedITC += totalITC

        switch (transaction.itcCategory) {
          case 'INPUTS':
            newInputsITC += totalITC
            break
          case 'CAPITAL_GOODS':
            newCapitalGoodsITC += totalITC
            break
          case 'INPUT_SERVICES':
            newInputServicesITC += totalITC
            break
        }
      } else {
        newBlockedITC += totalITC
      }
    })

    // Update register
    const updatedRegister = await this.prisma.iTCRegister.update({
      where: { userId_period: { userId, period } },
      data: {
        eligibleITC: register.eligibleITC + newEligibleITC,
        claimedITC: register.claimedITC + newClaimedITC,
        inputsITC: register.inputsITC + newInputsITC,
        capitalGoodsITC: register.capitalGoodsITC + newCapitalGoodsITC,
        inputServicesITC: register.inputServicesITC + newInputServicesITC,
        closingBalance: register.openingBalance + register.claimedITC + newClaimedITC - register.reversedITC,
      }
    })

    return updatedRegister as ITCRegisterData
  }

  /**
   * Calculate closing balance for a period
   */
  async calculateClosingBalance(
    userId: string,
    period: string,
    utilizationAmount: number = 0
  ): Promise<number> {
    const register = await this.prisma.iTCRegister.findUnique({
      where: { userId_period: { userId, period } }
    })

    if (!register) {
      throw new Error(`ITC Register not found for period ${period}`)
    }

    const availableBalance = register.openingBalance + register.claimedITC - register.reversedITC
    const closingBalance = availableBalance - utilizationAmount

    if (closingBalance < 0) {
      throw new Error('Insufficient ITC balance for utilization')
    }

    return closingBalance
  }

  /**
   * Generate monthly ITC report
   */
  async generateMonthlyReport(userId: string, period: string): Promise<ITCReport> {
    if (!period) {
      throw new Error('Period is required')
    }

    const register = await this.prisma.iTCRegister.findUnique({
      where: { userId_period: { userId, period } }
    })

    if (!register) {
      throw new Error(`ITC Register not found for period ${period}`)
    }

    // Get vendor breakdown for the period
    const vendorData = await this.prisma.purchaseInvoice.findMany({
      where: {
        userId,
        invoiceDate: {
          gte: this.getStartDateFromPeriod(period),
          lte: this.getEndDateFromPeriod(period),
        }
      },
      select: {
        vendorGSTIN: true,
        vendor: { select: { name: true } },
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        itcEligible: true,
      }
    })

    const vendorBreakdown = this.groupVendorData(vendorData)

    // Calculate rates
    const utilizationRate = register.eligibleITC > 0 
      ? Math.round((register.claimedITC / register.eligibleITC) * 100)
      : 0

    const reversalRate = register.eligibleITC > 0 
      ? Math.round((register.reversedITC / register.eligibleITC) * 100)
      : 0

    const blockageRate = register.eligibleITC > 0 
      ? Math.round((register.blockedITC / register.eligibleITC) * 100)
      : 0

    return {
      summary: {
        period: register.period,
        financialYear: register.financialYear,
        openingBalance: register.openingBalance,
        eligibleITC: register.eligibleITC,
        claimedITC: register.claimedITC,
        reversedITC: register.reversedITC,
        blockedITC: register.blockedITC,
        closingBalance: register.closingBalance,
        netMovement: register.closingBalance - register.openingBalance,
        utilizationRate,
        reversalRate,
        blockageRate,
      },
      categoryBreakdown: {
        inputs: register.inputsITC,
        capitalGoods: register.capitalGoodsITC,
        inputServices: register.inputServicesITC,
        blocked: register.blockedITC,
        total: register.inputsITC + register.capitalGoodsITC + register.inputServicesITC + register.blockedITC,
      },
      reconciliation: {
        isReconciled: register.isReconciled,
        reconciledAt: register.reconciledAt,
        pendingInvoices: 0, // Will be calculated from actual reconciliation data
        matchedInvoices: 0,
        mismatchedInvoices: 0,
        reconciliationRate: register.isReconciled ? 100 : 0,
      },
      vendorBreakdown,
      complianceStatus: {
        paymentCompliance: true, // Will be calculated from payment data
        reconciliationCompliance: register.isReconciled,
        utilizationCompliance: utilizationRate <= 100,
        overallScore: this.calculateComplianceScore(register.isReconciled, utilizationRate <= 100, true),
      }
    }
  }

  /**
   * Generate vendor-wise ITC report
   */
  async generateVendorReport(
    userId: string,
    period: string,
    options: { minITCAmount?: number } = {}
  ): Promise<ITCVendorReport> {
    if (!period) {
      throw new Error('Period is required')
    }

    const startDate = this.getStartDateFromPeriod(period)
    const endDate = this.getEndDateFromPeriod(period)

    // Aggregate vendor data
    const vendorData = await this.prisma.purchaseInvoice.findMany({
      where: {
        userId,
        invoiceDate: { gte: startDate, lte: endDate }
      },
      select: {
        vendorGSTIN: true,
        taxableAmount: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        itcEligible: true,
        vendor: { select: { name: true } }
      }
    })

    const vendorMap = new Map<string, any>()

    vendorData.forEach(invoice => {
      const totalITC = invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount
      const eligibleITC = invoice.itcEligible ? totalITC : 0
      const blockedITC = invoice.itcEligible ? 0 : totalITC

      if (!vendorMap.has(invoice.vendorGSTIN)) {
        vendorMap.set(invoice.vendorGSTIN, {
          vendorGSTIN: invoice.vendorGSTIN,
          vendorName: invoice.vendor?.name || 'Unknown',
          totalInvoices: 0,
          totalTaxableAmount: 0,
          totalITC: 0,
          eligibleITC: 0,
          blockedITC: 0,
          reconciledInvoices: 0,
          pendingInvoices: 0,
        })
      }

      const vendor = vendorMap.get(invoice.vendorGSTIN)
      vendor.totalInvoices += 1
      vendor.totalTaxableAmount += invoice.taxableAmount
      vendor.totalITC += totalITC
      vendor.eligibleITC += eligibleITC
      vendor.blockedITC += blockedITC
      // TODO: Add reconciliation status from actual data
    })

    // Filter by minimum ITC amount if specified
    const vendors = Array.from(vendorMap.values())
      .filter(vendor => !options.minITCAmount || vendor.totalITC >= options.minITCAmount)
      .map(vendor => ({
        ...vendor,
        utilizationRate: vendor.totalITC > 0 
          ? Math.round((vendor.eligibleITC / vendor.totalITC) * 100)
          : 0,
        reconciliationRate: vendor.totalInvoices > 0 
          ? Math.round((vendor.reconciledInvoices / vendor.totalInvoices) * 100)
          : 0,
      }))
      .sort((a, b) => b.totalITC - a.totalITC)

    // Calculate totals
    const totals = vendors.reduce(
      (acc, vendor) => ({
        totalVendors: acc.totalVendors + 1,
        totalInvoices: acc.totalInvoices + vendor.totalInvoices,
        totalTaxableAmount: acc.totalTaxableAmount + vendor.totalTaxableAmount,
        totalITC: acc.totalITC + vendor.totalITC,
        eligibleITC: acc.eligibleITC + vendor.eligibleITC,
        averageUtilizationRate: 0, // Will be calculated after
      }),
      {
        totalVendors: 0,
        totalInvoices: 0,
        totalTaxableAmount: 0,
        totalITC: 0,
        eligibleITC: 0,
        averageUtilizationRate: 0,
      }
    )

    totals.averageUtilizationRate = vendors.length > 0
      ? Math.round(vendors.reduce((sum, v) => sum + v.utilizationRate, 0) / vendors.length)
      : 0

    return {
      period,
      vendors,
      totals,
    }
  }

  /**
   * Generate HSN-wise ITC report
   */
  async generateHSNReport(userId: string, period: string): Promise<ITCHSNReport> {
    const startDate = this.getStartDateFromPeriod(period)
    const endDate = this.getEndDateFromPeriod(period)

    // Aggregate HSN data from purchase line items
    const hsnData = await this.prisma.purchaseInvoice.findMany({
      where: {
        userId,
        invoiceDate: { gte: startDate, lte: endDate }
      },
      select: {
        invoiceNumber: true,
        itcEligible: true,
        lineItems: {
          select: {
            hsn: true,
            description: true,
            taxableAmount: true,
            cgstAmount: true,
            sgstAmount: true,
            igstAmount: true,
            gstRate: true
          }
        }
      }
    })

    const hsnMap = new Map<string, any>()

    hsnData.forEach(invoice => {
      (invoice.lineItems || []).forEach(lineItem => {
        const totalITC = lineItem.cgstAmount + lineItem.sgstAmount + lineItem.igstAmount
        const gstRate = lineItem.gstRate || 18 // Default to 18% if not specified
        const eligibleITC = invoice.itcEligible ? totalITC : 0
        const blockedITC = invoice.itcEligible ? 0 : totalITC

        if (!hsnMap.has(lineItem.hsn)) {
          hsnMap.set(lineItem.hsn, {
            hsn: lineItem.hsn,
            description: lineItem.description || 'N/A',
            totalInvoices: 0,
            totalTaxableAmount: 0,
            totalITC: 0,
            eligibleITC: 0,
            blockedITC: 0,
            totalGSTAmount: 0,
            invoiceNumbers: new Set(),
            gstRates: [],
          })
        }

        const hsn = hsnMap.get(lineItem.hsn)
        if (!hsn.invoiceNumbers.has(invoice.invoiceNumber)) {
          hsn.totalInvoices += 1
          hsn.invoiceNumbers.add(invoice.invoiceNumber)
        }
        hsn.totalTaxableAmount += lineItem.taxableAmount
        hsn.totalITC += totalITC
        hsn.eligibleITC += eligibleITC
        hsn.blockedITC += blockedITC
        hsn.totalGSTAmount += lineItem.taxableAmount
        hsn.gstRates.push({ rate: gstRate, amount: lineItem.taxableAmount })
      })
    })

    // Process HSN codes
    const hsnCodes = Array.from(hsnMap.values())
      .map(hsn => {
        // Calculate weighted average GST rate
        const totalAmount = hsn.gstRates.reduce((sum: number, item: any) => sum + item.amount, 0)
        const weightedAvgGSTRate = totalAmount > 0 
          ? hsn.gstRates.reduce((sum: number, item: any) => sum + (item.rate * item.amount), 0) / totalAmount
          : 0

        return {
          hsn: hsn.hsn,
          description: hsn.description,
          totalInvoices: hsn.totalInvoices,
          totalTaxableAmount: hsn.totalTaxableAmount,
          totalITC: hsn.totalITC,
          eligibleITC: hsn.eligibleITC,
          blockedITC: hsn.blockedITC,
          utilizationRate: hsn.totalITC > 0 
            ? Math.round((hsn.eligibleITC / hsn.totalITC) * 100)
            : 0,
          averageITCPerInvoice: hsn.totalInvoices > 0 
            ? Math.round(hsn.totalITC / hsn.totalInvoices)
            : 0,
          avgGSTRate: Math.round(weightedAvgGSTRate),
        }
      })
      .sort((a, b) => b.totalITC - a.totalITC)

    // Calculate totals
    const totals = hsnCodes.reduce(
      (acc, hsn) => ({
        totalHSNCodes: acc.totalHSNCodes + 1,
        totalInvoices: acc.totalInvoices + hsn.totalInvoices,
        totalTaxableAmount: acc.totalTaxableAmount + hsn.totalTaxableAmount,
        totalITC: acc.totalITC + hsn.totalITC,
        eligibleITC: acc.eligibleITC + hsn.eligibleITC,
        weightedGSTSum: acc.weightedGSTSum + (hsn.avgGSTRate * hsn.totalTaxableAmount),
      }),
      {
        totalHSNCodes: 0,
        totalInvoices: 0,
        totalTaxableAmount: 0,
        totalITC: 0,
        eligibleITC: 0,
        weightedGSTSum: 0,
      }
    )

    const weightedAvgGSTRate = totals.totalTaxableAmount > 0 
      ? Math.round(totals.weightedGSTSum / totals.totalTaxableAmount)
      : 0

    return {
      period,
      hsnCodes,
      totals: {
        ...totals,
        weightedAvgGSTRate,
      },
    }
  }

  /**
   * Track ITC utilization metrics over time
   */
  async trackITCUtilization(
    userId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<ITCUtilizationMetrics> {
    // Get all registers in the date range
    const registers = await this.prisma.iTCRegister.findMany({
      where: {
        userId,
        period: {
          gte: this.formatPeriod(fromDate),
          lte: this.formatPeriod(toDate),
        }
      },
      orderBy: { period: 'asc' }
    })

    if (registers.length === 0) {
      return this.getEmptyUtilizationMetrics()
    }

    // Calculate totals
    const totals = registers.reduce(
      (acc, register) => ({
        totalEligibleITC: acc.totalEligibleITC + register.eligibleITC,
        totalClaimedITC: acc.totalClaimedITC + register.claimedITC,
        totalReversedITC: acc.totalReversedITC + register.reversedITC,
        totalBlockedITC: acc.totalBlockedITC + register.blockedITC,
      }),
      { totalEligibleITC: 0, totalClaimedITC: 0, totalReversedITC: 0, totalBlockedITC: 0 }
    )

    // Calculate rates
    const utilizationRate = totals.totalEligibleITC > 0 
      ? Math.round((totals.totalClaimedITC / totals.totalEligibleITC) * 100)
      : 0

    const reversalRate = totals.totalEligibleITC > 0 
      ? Math.round((totals.totalReversedITC / totals.totalEligibleITC) * 100)
      : 0

    const blockageRate = totals.totalEligibleITC > 0 
      ? Math.round((totals.totalBlockedITC / totals.totalEligibleITC) * 100)
      : 0

    // Calculate trend
    const monthlyTrend = this.calculateTrend(registers.map(r => r.eligibleITC))

    // Period breakdown
    const periodBreakdown = registers.map(register => ({
      period: register.period,
      eligibleITC: register.eligibleITC,
      claimedITC: register.claimedITC,
      utilizationRate: register.eligibleITC > 0 
        ? Math.round((register.claimedITC / register.eligibleITC) * 100)
        : 0,
    }))

    return {
      ...totals,
      utilizationRate,
      reversalRate,
      blockageRate,
      averageMonthlyITC: Math.round(totals.totalEligibleITC / registers.length),
      monthlyTrend,
      periodBreakdown,
    }
  }

  /**
   * Generate ITC aging report
   */
  async generateAgingReport(userId: string, asOfDate: Date): Promise<ITCAgingReport> {
    // Get all purchase invoices with ITC
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        userId,
        itcEligible: true,
        invoiceDate: { lte: asOfDate }
      },
      select: {
        invoiceNumber: true,
        vendorGSTIN: true,
        invoiceDate: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        paymentStatus: true,
        paymentDate: true,
      }
    })

    const agingBuckets = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '91-180': 0,
      '181-365': 0,
      'over-365': 0,
    }

    let atRiskAmount = 0
    let criticalInvoices = 0
    const complianceAlerts: ITCAgingReport['complianceAlerts'] = []

    invoices.forEach(invoice => {
      const ageInDays = Math.floor((asOfDate.getTime() - invoice.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
      const totalITC = invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount

      // Categorize by age
      if (ageInDays <= 30) {
        agingBuckets['0-30'] += totalITC
      } else if (ageInDays <= 60) {
        agingBuckets['31-60'] += totalITC
      } else if (ageInDays <= 90) {
        agingBuckets['61-90'] += totalITC
      } else if (ageInDays <= 180) {
        agingBuckets['91-180'] += totalITC
      } else if (ageInDays <= 365) {
        agingBuckets['181-365'] += totalITC
      } else {
        agingBuckets['over-365'] += totalITC
      }

      // Check for compliance issues
      if (ageInDays > 180 && invoice.paymentStatus === 'UNPAID') {
        atRiskAmount += totalITC
        criticalInvoices += 1

        complianceAlerts.push({
          type: 'REVERSAL_REQUIRED',
          invoiceNumber: invoice.invoiceNumber,
          vendorGSTIN: invoice.vendorGSTIN,
          amount: totalITC,
          ageInDays,
          alertMessage: `Invoice is ${ageInDays} days old and unpaid. ITC must be reversed as per Section 16(2)(c).`
        })
      }
    })

    const recommendedAction = criticalInvoices > 0 
      ? `${criticalInvoices} invoices require immediate payment or ITC reversal`
      : 'All invoices are within compliance parameters'

    return {
      asOfDate,
      agingBuckets,
      riskAnalysis: {
        atRiskAmount,
        criticalInvoices,
        recommendedAction,
      },
      complianceAlerts,
    }
  }

  /**
   * Check compliance status for a period
   */
  async checkComplianceStatus(userId: string, period: string): Promise<ITCComplianceStatus> {
    const register = await this.prisma.iTCRegister.findUnique({
      where: { userId_period: { userId, period } }
    })

    if (!register) {
      throw new Error(`ITC Register not found for period ${period}`)
    }

    // Check payment compliance (180-day rule)
    const startDate = this.getStartDateFromPeriod(period)
    const endDate = this.getEndDateFromPeriod(period)
    const currentDate = new Date()

    const unpaidInvoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        userId,
        invoiceDate: { gte: startDate, lte: endDate },
        paymentStatus: 'UNPAID',
        itcEligible: true,
      }
    })

    let atRiskAmount = 0
    let criticalInvoices = 0

    unpaidInvoices.forEach(invoice => {
      const ageInDays = Math.floor((currentDate.getTime() - invoice.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
      if (ageInDays > 180) {
        atRiskAmount += invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount
        criticalInvoices += 1
      }
    })

    // Calculate compliance scores
    const utilizationRate = register.eligibleITC > 0 
      ? Math.round((register.claimedITC / register.eligibleITC) * 100)
      : 0

    const reconciliationCompliance = {
      isCompliant: register.isReconciled,
      status: register.isReconciled ? 'RECONCILED' as const : 'PENDING' as const,
      reconciliationRate: register.isReconciled ? 100 : 0,
    }

    const paymentCompliance = {
      isCompliant: criticalInvoices === 0,
      atRiskAmount,
      criticalInvoices,
    }

    const utilizationCompliance = {
      isCompliant: utilizationRate <= 100 && register.claimedITC <= register.eligibleITC,
      utilizationRate,
      excessClaimed: Math.max(0, register.claimedITC - register.eligibleITC),
    }

    // Generate recommendations
    const recommendations: string[] = []
    if (!reconciliationCompliance.isCompliant) {
      recommendations.push('Complete GSTR-2A/2B reconciliation')
    }
    if (!paymentCompliance.isCompliant) {
      recommendations.push('Reverse ITC for unpaid invoices older than 180 days')
    }
    if (!utilizationCompliance.isCompliant) {
      recommendations.push('Review ITC claims to ensure compliance with eligibility rules')
    }

    // Calculate overall score
    const scores = [
      reconciliationCompliance.isCompliant ? 35 : 0,
      paymentCompliance.isCompliant ? 35 : 0,
      utilizationCompliance.isCompliant ? 30 : 0,
    ]
    const overallScore = scores.reduce((sum, score) => sum + score, 0)

    return {
      period,
      overallScore,
      reconciliationCompliance,
      paymentCompliance,
      utilizationCompliance,
      recommendations,
    }
  }

  /**
   * Generate dashboard data with insights
   */
  async generateDashboard(userId: string, financialYear: string): Promise<ITCDashboardData> {
    // Get all registers for the financial year
    const registers = await this.prisma.iTCRegister.findMany({
      where: {
        userId,
        financialYear,
      },
      orderBy: { period: 'asc' }
    })

    if (registers.length === 0) {
      return this.getEmptyDashboard(financialYear)
    }

    // Calculate summary
    const totals = registers.reduce(
      (acc, register) => ({
        totalEligibleITC: acc.totalEligibleITC + register.eligibleITC,
        totalClaimedITC: acc.totalClaimedITC + register.claimedITC,
        totalReversedITC: acc.totalReversedITC + register.reversedITC,
      }),
      { totalEligibleITC: 0, totalClaimedITC: 0, totalReversedITC: 0 }
    )

    const currentBalance = registers[registers.length - 1]?.closingBalance || 0
    const utilizationRate = totals.totalEligibleITC > 0 
      ? Math.round((totals.totalClaimedITC / totals.totalEligibleITC) * 100)
      : 0

    // Calculate month-over-month growth
    const monthOverMonthGrowth = registers.length >= 2 
      ? Math.round(((registers[registers.length - 1].eligibleITC - registers[registers.length - 2].eligibleITC) / registers[registers.length - 2].eligibleITC) * 100)
      : 0

    // Monthly trends
    const monthlyData = registers.map(register => ({
      period: register.period,
      eligibleITC: register.eligibleITC,
      claimedITC: register.claimedITC,
      closingBalance: register.closingBalance,
    }))

    const growth = {
      rate: monthOverMonthGrowth,
      direction: monthOverMonthGrowth > 0 ? 'increasing' as const 
        : monthOverMonthGrowth < 0 ? 'decreasing' as const 
        : 'stable' as const,
    }

    // Generate alerts
    const alerts = await this.generateAlerts(userId, financialYear)

    // Calculate insights
    const topPerformingCategory = this.getTopPerformingCategory(registers)
    const averageProcessingTime = 15 // Days - would be calculated from actual processing data
    const complianceScore = Math.round(
      registers.reduce((sum, r) => sum + (r.isReconciled ? 100 : 0), 0) / registers.length
    )

    const recommendations = this.generateRecommendations(registers, alerts)

    return {
      period: financialYear,
      summary: {
        ...totals,
        currentBalance,
        utilizationRate,
        monthOverMonthGrowth,
      },
      trends: {
        monthlyData,
        growth,
      },
      alerts,
      insights: {
        topPerformingCategory,
        averageProcessingTime,
        complianceScore,
        recommendations,
      },
    }
  }

  // Helper methods
  private getStartDateFromPeriod(period: string): Date {
    const [month, year] = period.split('-')
    return new Date(parseInt(year), parseInt(month) - 1, 1)
  }

  private getEndDateFromPeriod(period: string): Date {
    const [month, year] = period.split('-')
    return new Date(parseInt(year), parseInt(month), 0) // Last day of month
  }

  private formatPeriod(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear().toString()
    return `${month}-${year}`
  }

  private groupVendorData(vendorData: any[]): ITCReport['vendorBreakdown'] {
    const vendorMap = new Map<string, any>()

    vendorData.forEach(invoice => {
      const totalITC = invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount
      const eligibleITC = invoice.itcEligible ? totalITC : 0

      if (!vendorMap.has(invoice.vendorGSTIN)) {
        vendorMap.set(invoice.vendorGSTIN, {
          vendorGSTIN: invoice.vendorGSTIN,
          vendorName: invoice.vendor?.name || 'Unknown',
          invoiceCount: 0,
          totalITC: 0,
          eligibleITC: 0,
        })
      }

      const vendor = vendorMap.get(invoice.vendorGSTIN)
      vendor.invoiceCount += 1
      vendor.totalITC += totalITC
      vendor.eligibleITC += eligibleITC
    })

    return Array.from(vendorMap.values())
  }

  private calculateComplianceScore(reconciled: boolean, utilizationCompliant: boolean, paymentCompliant: boolean): number {
    let score = 0
    if (reconciled) score += 35
    if (utilizationCompliant) score += 30
    if (paymentCompliant) score += 35
    return score
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable'
    
    const recent = values.slice(-3) // Last 3 months
    if (recent.length < 2) return 'stable'
    
    let increasingCount = 0
    let decreasingCount = 0
    
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] > recent[i - 1]) increasingCount++
      if (recent[i] < recent[i - 1]) decreasingCount++
    }
    
    if (increasingCount > decreasingCount) return 'increasing'
    if (decreasingCount > increasingCount) return 'decreasing'
    return 'stable'
  }

  private getEmptyUtilizationMetrics(): ITCUtilizationMetrics {
    return {
      totalEligibleITC: 0,
      totalClaimedITC: 0,
      totalReversedITC: 0,
      totalBlockedITC: 0,
      utilizationRate: 0,
      reversalRate: 0,
      blockageRate: 0,
      averageMonthlyITC: 0,
      monthlyTrend: 'stable',
      periodBreakdown: [],
    }
  }

  private getEmptyDashboard(financialYear: string): ITCDashboardData {
    return {
      period: financialYear,
      summary: {
        totalEligibleITC: 0,
        totalClaimedITC: 0,
        totalReversedITC: 0,
        currentBalance: 0,
        utilizationRate: 0,
        monthOverMonthGrowth: 0,
      },
      trends: {
        monthlyData: [],
        growth: { rate: 0, direction: 'stable' },
      },
      alerts: [],
      insights: {
        topPerformingCategory: 'INPUTS',
        averageProcessingTime: 0,
        complianceScore: 0,
        recommendations: [],
      },
    }
  }

  private async generateAlerts(userId: string, financialYear: string): Promise<ITCDashboardData['alerts']> {
    const alerts: ITCDashboardData['alerts'] = []

    // Check for overdue payments
    const overdueInvoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        userId,
        paymentStatus: 'UNPAID',
        itcEligible: true,
        invoiceDate: {
          lte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // 180 days ago
        }
      }
    })

    if (overdueInvoices.length > 0) {
      alerts.push({
        type: 'PAYMENT_OVERDUE',
        severity: 'high',
        message: `${overdueInvoices.length} invoices require payment to maintain ITC eligibility`,
        count: overdueInvoices.length,
      })
    }

    return alerts
  }

  private getTopPerformingCategory(registers: ITCRegisterData[]): string {
    const categoryTotals = registers.reduce(
      (acc, register) => ({
        INPUTS: acc.INPUTS + register.inputsITC,
        CAPITAL_GOODS: acc.CAPITAL_GOODS + register.capitalGoodsITC,
        INPUT_SERVICES: acc.INPUT_SERVICES + register.inputServicesITC,
      }),
      { INPUTS: 0, CAPITAL_GOODS: 0, INPUT_SERVICES: 0 }
    )

    const maxCategory = Object.entries(categoryTotals).reduce((a, b) => 
      a[1] > b[1] ? a : b
    )

    return maxCategory[0]
  }

  private generateRecommendations(registers: ITCRegisterData[], alerts: ITCDashboardData['alerts']): string[] {
    const recommendations: string[] = []

    const avgUtilization = registers.reduce((sum, r) => {
      return sum + (r.eligibleITC > 0 ? (r.claimedITC / r.eligibleITC) * 100 : 0)
    }, 0) / registers.length

    if (avgUtilization < 80) {
      recommendations.push('Review ITC eligibility to improve utilization rate')
    }

    if (alerts.some(a => a.type === 'PAYMENT_OVERDUE')) {
      recommendations.push('Prioritize payments for invoices nearing 180-day limit')
    }

    const unreconciled = registers.filter(r => !r.isReconciled).length
    if (unreconciled > 0) {
      recommendations.push('Complete pending GSTR-2A/2B reconciliations')
    }

    return recommendations
  }
}