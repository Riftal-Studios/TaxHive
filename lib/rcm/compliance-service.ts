/**
 * Compliance Service
 * 
 * Database operations for compliance dashboard and monitoring.
 */

import { PrismaClient } from '@prisma/client';
import { 
  calculateComplianceScore,
  assessRiskLevel,
  generateDashboardMetrics,
  getComplianceAlerts as generateAlerts,
  analyzeComplianceTrends,
  getActionableInsights
} from './compliance-dashboard';

const prisma = new PrismaClient();

/**
 * Get compliance dashboard
 */
export async function getComplianceDashboard(input: {
  userId: string;
  period: string;
}) {
  const [month, year] = [
    parseInt(input.period.substring(0, 2)),
    parseInt(input.period.substring(2)),
  ];
  
  // Get payment metrics
  const liabilities = await prisma.rCMPaymentLiability.findMany({
    where: { userId: input.userId },
  });
  
  let paidOnTime = 0;
  let paidLate = 0;
  let unpaid = 0;
  let totalLiabilities = 0;
  
  for (const liability of liabilities) {
    totalLiabilities++;
    if (liability.status === 'PAID') {
      if (liability.paidDate && liability.paidDate <= liability.dueDate) {
        paidOnTime++;
      } else {
        paidLate++;
      }
    } else {
      unpaid++;
    }
  }
  
  // Get filing metrics
  const filings = await prisma.gSTR3BFiling.findMany({
    where: { userId: input.userId },
  });
  
  let returnsFiledOnTime = 0;
  let returnsFiledLate = 0;
  let returnsPending = 0;
  
  for (const filing of filings) {
    if (filing.filingStatus === 'FILED') {
      // Simplified logic - would check actual due dates
      returnsFiledOnTime++;
    }
  }
  
  // Calculate documentation (simplified)
  const documentationComplete = Math.floor(totalLiabilities * 0.8);
  const documentationPending = totalLiabilities - documentationComplete;
  
  // Calculate compliance score
  const score = calculateComplianceScore({
    totalRCMTransactions: totalLiabilities,
    paidOnTime,
    paidLate,
    unpaid,
    returnsFiledOnTime,
    returnsFiledLate,
    returnsPending,
    documentationComplete,
    documentationPending,
  });
  
  // Assess risk
  const now = new Date();
  const overduePayments = liabilities.filter(l => 
    l.status !== 'PAID' && l.dueDate < now
  );
  
  const maxDaysOverdue = overduePayments.reduce((max, l) => {
    const days = Math.ceil((now.getTime() - l.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(max, days);
  }, 0);
  
  const risk = assessRiskLevel({
    overduePayments: overduePayments.length,
    totalOutstanding: overduePayments.reduce((sum, l) => 
      sum + (Number(l.totalGST) - Number(l.paidAmount)), 0
    ),
    daysOverdueMax: maxDaysOverdue,
    complianceScore: score.overallScore,
    missedFilings: returnsPending,
    auditFindings: 0, // Would come from audit table
  });
  
  // Save score to history
  await prisma.complianceScore.upsert({
    where: {
      userId_period: {
        userId: input.userId,
        period: input.period,
      },
    },
    update: {
      overallScore: score.overallScore,
      paymentScore: score.paymentScore,
      filingScore: score.filingScore,
      documentationScore: score.documentationScore,
      rating: score.rating,
      riskLevel: risk.level,
      totalTransactions: totalLiabilities,
      paidOnTime,
      paidLate,
      unpaid,
      returnsFiledOnTime,
      returnsFiledLate,
      documentationComplete,
      documentationPending,
    },
    create: {
      userId: input.userId,
      period: input.period,
      month,
      year,
      overallScore: score.overallScore,
      paymentScore: score.paymentScore,
      filingScore: score.filingScore,
      documentationScore: score.documentationScore,
      rating: score.rating,
      riskLevel: risk.level,
      totalTransactions: totalLiabilities,
      paidOnTime,
      paidLate,
      unpaid,
      returnsFiledOnTime,
      returnsFiledLate,
      documentationComplete,
      documentationPending,
    },
  });
  
  return {
    complianceScore: score.overallScore,
    rating: score.rating,
    riskLevel: risk.level,
    paymentMetrics: {
      totalLiabilities,
      paidOnTime,
      paidLate,
      unpaid,
    },
    filingMetrics: {
      returnsFiledOnTime,
      returnsFiledLate,
      returnsPending,
    },
    documentationMetrics: {
      documentationComplete,
      documentationPending,
    },
  };
}

/**
 * Generate compliance alerts
 */
export async function generateComplianceAlerts(input: {
  userId: string;
}) {
  const now = new Date();
  const alerts: any[] = [];
  
  // Get upcoming payments
  const upcomingPayments = await prisma.rCMPaymentLiability.findMany({
    where: {
      userId: input.userId,
      status: { not: 'PAID' },
      dueDate: {
        gte: now,
        lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
      },
    },
  });
  
  for (const payment of upcomingPayments) {
    const daysUntilDue = Math.ceil(
      (payment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 1000)
    );
    
    const alert = await prisma.complianceAlert.create({
      data: {
        type: 'PAYMENT_DUE_SOON',
        priority: daysUntilDue <= 3 ? 'HIGH' : 'MEDIUM',
        message: `RCM payment of Rs. ${payment.totalGST} due on ${payment.dueDate.toLocaleDateString()}`,
        dueDate: payment.dueDate,
        relatedEntityId: payment.id,
        relatedEntityType: 'PAYMENT',
        userId: input.userId,
      },
    });
    
    alerts.push(alert);
  }
  
  // Get overdue payments
  const overduePayments = await prisma.rCMPaymentLiability.findMany({
    where: {
      userId: input.userId,
      status: { not: 'PAID' },
      dueDate: { lt: now },
    },
  });
  
  for (const payment of overduePayments) {
    const daysOverdue = Math.ceil(
      (now.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 1000)
    );
    
    const alert = await prisma.complianceAlert.create({
      data: {
        type: 'PAYMENT_OVERDUE',
        priority: daysOverdue > 30 ? 'CRITICAL' : 'HIGH',
        message: `RCM payment of Rs. ${payment.totalGST} overdue by ${daysOverdue} days`,
        dueDate: payment.dueDate,
        relatedEntityId: payment.id,
        relatedEntityType: 'PAYMENT',
        userId: input.userId,
      },
    });
    
    alerts.push(alert);
  }
  
  return alerts;
}

/**
 * Calculate compliance metrics
 */
export async function calculateComplianceMetrics(input: {
  userId: string;
  startDate: Date;
  endDate: Date;
}) {
  // Get historical scores
  const scores = await prisma.complianceScore.findMany({
    where: {
      userId: input.userId,
      createdAt: {
        gte: input.startDate,
        lte: input.endDate,
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  
  const trends = scores.map(score => ({
    month: `${getMonthName(score.month)} ${score.year}`,
    complianceScore: Number(score.overallScore),
    onTimeRate: score.totalTransactions > 0 
      ? (score.paidOnTime / score.totalTransactions) * 100 
      : 100,
  }));
  
  // Analyze trends
  const trendAnalysis = analyzeComplianceTrends(trends);
  
  return {
    trends,
    complianceDirection: trendAnalysis.direction,
    averageScore: trends.reduce((sum, t) => sum + t.complianceScore, 0) / trends.length,
    ...trendAnalysis,
  };
}

/**
 * Helper function to get month name
 */
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
}

/**
 * Create test compliance data (for testing)
 */
export async function createTestComplianceData() {
  // Implementation would be here for test data creation
}

/**
 * Create historical compliance data (for testing)
 */
export async function createHistoricalComplianceData() {
  // Implementation would be here for historical test data
}

/**
 * Prepare GSTR-3B data
 */
export async function prepareGSTR3BData(userId: string, period: string) {
  const [month, year] = [
    parseInt(period.substring(0, 2)),
    parseInt(period.substring(2)),
  ];
  
  // Get RCM liabilities for the period
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const liabilities = await prisma.rCMPaymentLiability.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });
  
  // Calculate table 3.1(d) - Supplies liable to reverse charge
  const table31d = {
    taxableValue: liabilities.reduce((sum, l) => sum + Number(l.taxableAmount), 0),
    igst: liabilities.reduce((sum, l) => sum + Number(l.igst), 0),
    cgst: liabilities.reduce((sum, l) => sum + Number(l.cgst), 0),
    sgst: liabilities.reduce((sum, l) => sum + Number(l.sgst), 0),
    cess: liabilities.reduce((sum, l) => sum + Number(l.cess), 0),
  };
  
  // Calculate table 4(B) - ITC on RCM
  const eligibleITC = liabilities.filter(l => l.itcEligible);
  
  const table4B = {
    inputs: {
      igst: eligibleITC.filter(l => l.itcCategory === 'INPUTS').reduce((sum, l) => sum + Number(l.igst), 0),
      cgst: eligibleITC.filter(l => l.itcCategory === 'INPUTS').reduce((sum, l) => sum + Number(l.cgst), 0),
      sgst: eligibleITC.filter(l => l.itcCategory === 'INPUTS').reduce((sum, l) => sum + Number(l.sgst), 0),
      cess: eligibleITC.filter(l => l.itcCategory === 'INPUTS').reduce((sum, l) => sum + Number(l.cess), 0),
    },
    inputServices: {
      igst: eligibleITC.filter(l => l.itcCategory === 'INPUT_SERVICES').reduce((sum, l) => sum + Number(l.igst), 0),
      cgst: eligibleITC.filter(l => l.itcCategory === 'INPUT_SERVICES').reduce((sum, l) => sum + Number(l.cgst), 0),
      sgst: eligibleITC.filter(l => l.itcCategory === 'INPUT_SERVICES').reduce((sum, l) => sum + Number(l.sgst), 0),
      cess: eligibleITC.filter(l => l.itcCategory === 'INPUT_SERVICES').reduce((sum, l) => sum + Number(l.cess), 0),
    },
    capitalGoods: {
      igst: eligibleITC.filter(l => l.itcCategory === 'CAPITAL_GOODS').reduce((sum, l) => sum + Number(l.igst), 0),
      cgst: eligibleITC.filter(l => l.itcCategory === 'CAPITAL_GOODS').reduce((sum, l) => sum + Number(l.cgst), 0),
      sgst: eligibleITC.filter(l => l.itcCategory === 'CAPITAL_GOODS').reduce((sum, l) => sum + Number(l.sgst), 0),
      cess: eligibleITC.filter(l => l.itcCategory === 'CAPITAL_GOODS').reduce((sum, l) => sum + Number(l.cess), 0),
    },
  };
  
  const totalRCMTax = table31d.igst + table31d.cgst + table31d.sgst + table31d.cess;
  const totalRCMITC = Object.values(table4B).reduce((sum, category) => 
    sum + category.igst + category.cgst + category.sgst + category.cess, 0
  );
  
  return {
    period,
    month,
    year,
    table31d,
    table4B,
    totalRCMTax,
    totalRCMITC,
    netRCMPayable: totalRCMTax - totalRCMITC,
  };
}

/**
 * Get compliance score
 */
export async function getComplianceScore(userId: string, date: Date): Promise<any> {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const period = `${month.toString().padStart(2, '0')}${year}`;
  
  const score = await prisma.complianceScore.findFirst({
    where: {
      userId,
      period,
    },
    orderBy: { createdAt: 'desc' },
  });
  
  if (score) {
    return {
      overallScore: Number(score.overallScore),
      paymentScore: Number(score.paymentScore),
      filingScore: Number(score.filingScore),
      documentationScore: Number(score.documentationScore),
      rating: score.rating,
      riskLevel: score.riskLevel,
    };
  }
  
  // Generate new score if not found
  const dashboard = await getComplianceDashboard({ userId, period });
  return {
    overallScore: dashboard.complianceScore,
    paymentScore: 80, // Default values
    filingScore: 85,
    documentationScore: 75,
    rating: dashboard.rating,
    riskLevel: dashboard.riskLevel,
  };
}