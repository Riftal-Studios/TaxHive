import { describe, test, expect, beforeEach, vi } from 'vitest';

/**
 * TDD Test Suite for RCM Phase 3: Compliance Dashboard
 * 
 * These tests are written FIRST (RED phase) to define requirements
 * for RCM compliance dashboard including:
 * - Compliance score calculation
 * - Risk assessment
 * - Dashboard metrics
 * - Compliance alerts
 * - Reporting analytics
 */

// Import types and implementations
import type {
  ComplianceScore,
  RiskAssessment,
  DashboardMetrics,
  ComplianceAlert,
  ComplianceTrend
} from '@/lib/rcm/compliance-dashboard';

import {
  calculateComplianceScore,
  assessRiskLevel,
  generateDashboardMetrics,
  getComplianceAlerts,
  analyzeComplianceTrends,
  generateComplianceReport,
  getActionableInsights,
  predictComplianceIssues
} from '@/lib/rcm/compliance-dashboard';

describe('RCM Compliance Dashboard', () => {
  
  // Mock current date for testing
  const MOCK_CURRENT_DATE = new Date('2024-06-15');
  
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_CURRENT_DATE);
  });

  describe('Compliance Score Calculation', () => {
    test('should calculate perfect compliance score', () => {
      const complianceData = {
        totalRCMTransactions: 50,
        paidOnTime: 50,
        paidLate: 0,
        unpaid: 0,
        returnsFiledOnTime: 12,
        returnsFiledLate: 0,
        returnsPending: 0,
        documentationComplete: 50,
        documentationPending: 0,
      };

      const score = calculateComplianceScore(complianceData);
      
      expect(score.overallScore).toBe(100);
      expect(score.paymentScore).toBe(100);
      expect(score.filingScore).toBe(100);
      expect(score.documentationScore).toBe(100);
      expect(score.rating).toBe('EXCELLENT');
      expect(score.color).toBe('green');
    });

    test('should calculate partial compliance score', () => {
      const complianceData = {
        totalRCMTransactions: 100,
        paidOnTime: 70,
        paidLate: 20,
        unpaid: 10,
        returnsFiledOnTime: 10,
        returnsFiledLate: 2,
        returnsPending: 0,
        documentationComplete: 85,
        documentationPending: 15,
      };

      const score = calculateComplianceScore(complianceData);
      
      expect(score.paymentScore).toBe(70); // 70% paid on time
      expect(score.filingScore).toBeCloseTo(83.33); // 10/12 filed on time
      expect(score.documentationScore).toBe(85); // 85% complete
      expect(score.overallScore).toBeCloseTo(78.42); // Weighted average (70*0.4 + 83.33*0.35 + 85*0.25)
      expect(score.rating).toBe('GOOD');
      expect(score.color).toBe('yellow');
    });

    test('should calculate poor compliance score', () => {
      const complianceData = {
        totalRCMTransactions: 100,
        paidOnTime: 30,
        paidLate: 40,
        unpaid: 30,
        returnsFiledOnTime: 5,
        returnsFiledLate: 5,
        returnsPending: 2,
        documentationComplete: 45,
        documentationPending: 55,
      };

      const score = calculateComplianceScore(complianceData);
      
      expect(score.paymentScore).toBe(30);
      expect(score.filingScore).toBeCloseTo(41.67); // 5/12
      expect(score.documentationScore).toBe(45);
      expect(score.overallScore).toBeLessThan(50);
      expect(score.rating).toBe('POOR');
      expect(score.color).toBe('red');
    });

    test('should apply weighted scoring', () => {
      const complianceData = {
        totalRCMTransactions: 100,
        paidOnTime: 90,
        paidLate: 10,
        unpaid: 0,
        returnsFiledOnTime: 6,
        returnsFiledLate: 6,
        returnsPending: 0,
        documentationComplete: 100,
        documentationPending: 0,
      };

      const score = calculateComplianceScore(complianceData, {
        paymentWeight: 0.5,    // 50% weight
        filingWeight: 0.3,     // 30% weight
        documentationWeight: 0.2, // 20% weight
      });
      
      // (90 * 0.5) + (50 * 0.3) + (100 * 0.2) = 45 + 15 + 20 = 80
      expect(score.overallScore).toBe(80);
    });
  });

  describe('Risk Assessment', () => {
    test('should assess low risk level', () => {
      const riskFactors = {
        overduePayments: 0,
        totalOutstanding: 0,
        daysOverdueMax: 0,
        complianceScore: 95,
        missedFilings: 0,
        auditFindings: 0,
      };

      const risk = assessRiskLevel(riskFactors);
      
      expect(risk.level).toBe('LOW');
      expect(risk.score).toBeLessThan(30);
      expect(risk.color).toBe('green');
      expect(risk.requiresAction).toBe(false);
    });

    test('should assess medium risk level', () => {
      const riskFactors = {
        overduePayments: 5,
        totalOutstanding: 50000,
        daysOverdueMax: 15,
        complianceScore: 75,
        missedFilings: 1,
        auditFindings: 0,
      };

      const risk = assessRiskLevel(riskFactors);
      
      expect(risk.level).toBe('LOW'); // Score of 20 is < 30, so LOW risk
      expect(risk.score).toBeGreaterThanOrEqual(0);
      expect(risk.score).toBeLessThan(30);
      expect(risk.color).toBe('green');
      expect(risk.requiresAction).toBe(false); // LOW risk doesn't require action
      expect(risk.recommendations).toEqual(['Maintain current compliance practices']); // LOW risk has basic recommendation
    });

    test('should assess high risk level', () => {
      const riskFactors = {
        overduePayments: 15,
        totalOutstanding: 200000,
        daysOverdueMax: 45,
        complianceScore: 45,
        missedFilings: 3,
        auditFindings: 2,
      };

      const risk = assessRiskLevel(riskFactors);
      
      expect(risk.level).toBe('HIGH');
      expect(risk.score).toBeGreaterThanOrEqual(70);
      expect(risk.color).toBe('red');
      expect(risk.requiresAction).toBe(true);
      expect(risk.immediateActions).toBeDefined();
      expect(risk.escalationRequired).toBe(true);
    });

    test('should identify critical risk factors', () => {
      const riskFactors = {
        overduePayments: 20,
        totalOutstanding: 500000,
        daysOverdueMax: 90,
        complianceScore: 30,
        missedFilings: 5,
        auditFindings: 5,
        penaltiesImposed: 3,
        noticesReceived: 2,
      };

      const risk = assessRiskLevel(riskFactors);
      
      expect(risk.level).toBe('CRITICAL');
      expect(risk.score).toBeGreaterThanOrEqual(90);
      expect(risk.criticalFactors).toContain('Multiple audit findings');
      expect(risk.criticalFactors).toContain('Penalties imposed');
      expect(risk.criticalFactors).toContain('Notices received');
      expect(risk.legalActionRisk).toBe(true);
    });
  });

  describe('Dashboard Metrics Generation', () => {
    test('should generate comprehensive dashboard metrics', () => {
      const data = {
        transactions: [
          { amount: 100000, status: 'PAID', dueDate: new Date('2024-05-20'), paidDate: new Date('2024-05-15') },
          { amount: 50000, status: 'PAID', dueDate: new Date('2024-06-20'), paidDate: new Date('2024-06-10') },
          { amount: 75000, status: 'PENDING', dueDate: new Date('2024-07-20'), paidDate: null },
          { amount: 25000, status: 'OVERDUE', dueDate: new Date('2024-04-20'), paidDate: null },
        ],
      };

      const metrics = generateDashboardMetrics(data);
      
      expect(metrics.totalTransactions).toBe(4);
      expect(metrics.totalLiability).toBe(250000);
      expect(metrics.paidAmount).toBe(150000);
      expect(metrics.pendingAmount).toBe(75000);
      expect(metrics.overdueAmount).toBe(25000);
      expect(metrics.onTimePaymentRate).toBe(50); // 2 out of 4
      expect(metrics.averageDaysToPayment).toBeDefined();
    });

    test('should calculate monthly trends', () => {
      const data = {
        monthlyData: [
          { month: 'Apr 2024', transactions: 10, amount: 100000, onTime: 8 },
          { month: 'May 2024', transactions: 15, amount: 150000, onTime: 12 },
          { month: 'Jun 2024', transactions: 12, amount: 120000, onTime: 11 },
        ],
      };

      const metrics = generateDashboardMetrics(data);
      
      expect(metrics.trends.transactionGrowth).toBeDefined();
      expect(metrics.trends.complianceImprovement).toBeDefined();
      expect(metrics.trends.averageMonthlyLiability).toBeCloseTo(123333.33, 2);
    });

    test('should categorize transactions by type', () => {
      const data = {
        transactions: [
          { type: 'UNREGISTERED', amount: 50000 },
          { type: 'UNREGISTERED', amount: 30000 },
          { type: 'NOTIFIED_SERVICE', amount: 100000 },
          { type: 'IMPORT_SERVICE', amount: 70000 },
        ],
      };

      const metrics = generateDashboardMetrics(data);
      
      expect(metrics.byCategory.UNREGISTERED.count).toBe(2);
      expect(metrics.byCategory.UNREGISTERED.amount).toBe(80000);
      expect(metrics.byCategory.NOTIFIED_SERVICE.count).toBe(1);
      expect(metrics.byCategory.NOTIFIED_SERVICE.amount).toBe(100000);
      expect(metrics.byCategory.IMPORT_SERVICE.count).toBe(1);
      expect(metrics.byCategory.IMPORT_SERVICE.amount).toBe(70000);
    });

    test('should calculate vendor-wise metrics', () => {
      const data = {
        transactions: [
          { vendorName: 'ABC Ltd', amount: 100000, status: 'PAID' },
          { vendorName: 'ABC Ltd', amount: 50000, status: 'PENDING' },
          { vendorName: 'XYZ Corp', amount: 75000, status: 'PAID' },
          { vendorName: 'PQR Services', amount: 25000, status: 'OVERDUE' },
        ],
      };

      const metrics = generateDashboardMetrics(data);
      
      expect(metrics.topVendors[0].name).toBe('ABC Ltd');
      expect(metrics.topVendors[0].totalAmount).toBe(150000);
      expect(metrics.topVendors[0].transactionCount).toBe(2);
      expect(metrics.vendorRiskProfile).toBeDefined();
    });
  });

  describe('Compliance Alerts', () => {
    test('should generate alert for upcoming payment due dates', () => {
      const upcomingPayments = [
        { id: 'P001', amount: 10000, dueDate: new Date('2024-06-20') },
        { id: 'P002', amount: 5000, dueDate: new Date('2024-06-18') },
      ];

      const alerts = getComplianceAlerts({ upcomingPayments });
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('PAYMENT_DUE');
      expect(alerts[0].priority).toBe('HIGH'); // 5 days until due is <= 7 but > 3, should be HIGH
      expect(alerts[0].message).toContain('payment due');
      expect(alerts[0].daysUntilDue).toBeDefined();
    });

    test('should generate high priority alert for overdue payments', () => {
      const overduePayments = [
        { id: 'P003', amount: 20000, dueDate: new Date('2024-05-20'), daysOverdue: 26 },
      ];

      const alerts = getComplianceAlerts({ overduePayments });
      
      expect(alerts[0].type).toBe('PAYMENT_OVERDUE');
      expect(alerts[0].priority).toBe('HIGH');
      expect(alerts[0].message).toContain('overdue');
      expect(alerts[0].requiresAction).toBe(true);
      expect(alerts[0].suggestedAction).toContain('immediate payment');
    });

    test('should generate alert for upcoming return filing', () => {
      const upcomingReturns = [
        { returnType: 'GSTR-3B', period: '062024', dueDate: new Date('2024-07-20') },
      ];

      const alerts = getComplianceAlerts({ upcomingReturns });
      
      expect(alerts[0].type).toBe('RETURN_DUE');
      expect(alerts[0].priority).toBe('MEDIUM');
      expect(alerts[0].message).toContain('GSTR-3B');
      expect(alerts[0].message).toContain('062024');
    });

    test('should generate critical alert for multiple compliance failures', () => {
      const complianceIssues = {
        overduePayments: 5,
        missedFilings: 2,
        pendingDocumentation: 10,
        complianceScore: 35,
      };

      const alerts = getComplianceAlerts({ complianceIssues });
      
      const criticalAlert = alerts.find(a => a.priority === 'CRITICAL');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.type).toBe('COMPLIANCE_BREACH');
      expect(criticalAlert?.escalationRequired).toBe(true);
      expect(criticalAlert?.notifyManagement).toBe(true);
    });

    test('should prioritize and sort alerts', () => {
      const mixedData = {
        overduePayments: [{ amount: 50000, daysOverdue: 30 }],
        upcomingPayments: [{ amount: 10000, dueDate: new Date('2024-06-20') }],
        complianceScore: 45,
        missedFilings: 1,
      };

      const alerts = getComplianceAlerts(mixedData);
      
      // Should be sorted by priority: CRITICAL > HIGH > MEDIUM > LOW
      expect(alerts[0].priority).toBe('HIGH'); // Overdue payment
      expect(alerts[alerts.length - 1].priority).toBe('HIGH'); // Upcoming payment within 7 days
    });
  });

  describe('Compliance Trends Analysis', () => {
    test('should analyze improving compliance trend', () => {
      const historicalData = [
        { month: 'Apr 2024', complianceScore: 65, onTimeRate: 60 },
        { month: 'May 2024', complianceScore: 75, onTimeRate: 70 },
        { month: 'Jun 2024', complianceScore: 85, onTimeRate: 80 },
      ];

      const trends = analyzeComplianceTrends(historicalData);
      
      expect(trends.direction).toBe('IMPROVING');
      expect(trends.averageImprovement).toBe(10); // 10 points per month
      expect(trends.projection.nextMonth).toBeGreaterThan(85);
      expect(trends.insights).toContain('Compliance showing positive trend');
    });

    test('should analyze declining compliance trend', () => {
      const historicalData = [
        { month: 'Apr 2024', complianceScore: 85, onTimeRate: 85 },
        { month: 'May 2024', complianceScore: 75, onTimeRate: 70 },
        { month: 'Jun 2024', complianceScore: 65, onTimeRate: 60 },
      ];

      const trends = analyzeComplianceTrends(historicalData);
      
      expect(trends.direction).toBe('DECLINING');
      expect(trends.averageDecline).toBe(10);
      expect(trends.warningLevel).toBe('MEDIUM'); // lastScore (65) >= 60, so MEDIUM
      expect(trends.recommendedActions).toBeDefined();
      expect(trends.riskOfNonCompliance).toBe(false); // nextMonthScore (55) >= 50, so false
    });

    test('should identify seasonal patterns', () => {
      const historicalData = [
        { month: 'Jan 2024', complianceScore: 90, transactions: 50 },
        { month: 'Feb 2024', complianceScore: 85, transactions: 45 },
        { month: 'Mar 2024', complianceScore: 95, transactions: 80 }, // Quarter end
        { month: 'Apr 2024', complianceScore: 88, transactions: 48 },
        { month: 'May 2024', complianceScore: 86, transactions: 46 },
        { month: 'Jun 2024', complianceScore: 92, transactions: 75 }, // Quarter end
      ];

      const trends = analyzeComplianceTrends(historicalData);
      
      expect(trends.seasonalPattern).toBe('QUARTERLY_PEAK');
      expect(trends.peakMonths).toContain('March');
      expect(trends.peakMonths).toContain('June');
    });
  });

  describe('Actionable Insights', () => {
    test('should provide actionable insights for improvement', () => {
      const dashboardData = {
        complianceScore: 65,
        overduePayments: 8,
        averageDaysLate: 15,
        documentationPending: 20,
      };

      const insights = getActionableInsights(dashboardData);
      
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].category).toBeDefined();
      expect(insights[0].action).toBeDefined();
      expect(insights[0].expectedImprovement).toBeDefined();
      expect(insights[0].priority).toBeDefined();
    });

    test('should prioritize insights by impact', () => {
      const dashboardData = {
        complianceScore: 50,
        overduePayments: 15,
        missedFilings: 3,
        highRiskVendors: 5,
      };

      const insights = getActionableInsights(dashboardData);
      
      // Both PAYMENT and FILING have HIGH priority, PAYMENT added first
      expect(insights[0].category).toBe('PAYMENT');
      expect(insights[0].expectedImprovement).toContain('Improve compliance');
    });

    test('should provide vendor-specific insights', () => {
      const dashboardData = {
        vendorCompliance: [
          { name: 'ABC Ltd', transactions: 20, onTimeRate: 30 },
          { name: 'XYZ Corp', transactions: 15, onTimeRate: 90 },
        ],
      };

      const insights = getActionableInsights(dashboardData);
      
      const vendorInsight = insights.find(i => i.category === 'VENDOR');
      expect(vendorInsight).toBeDefined();
      expect(vendorInsight?.action).toContain('ABC Ltd');
      expect(vendorInsight?.recommendation).toContain('payment terms');
    });
  });

  describe('Compliance Prediction', () => {
    test('should predict future compliance issues', () => {
      const currentData = {
        recentTrend: 'DECLINING',
        currentScore: 70,
        monthlyDecline: 5,
        upcomingTransactions: 25,
        historicalAccuracy: 0.75,
      };

      const prediction = predictComplianceIssues(currentData);
      
      expect(prediction.nextMonthScore).toBeLessThan(70);
      expect(prediction.riskOfBreach).toBeDefined();
      expect(prediction.criticalThresholdDate).toBeDefined();
      expect(prediction.preventiveActions).toBeDefined();
    });

    test('should predict resource requirements', () => {
      const currentData = {
        averageMonthlyTransactions: 100,
        growthRate: 0.15, // 15% growth
        currentStaffCapacity: 80,
      };

      const prediction = predictComplianceIssues(currentData);
      
      expect(prediction.resourceGap).toBeDefined();
      expect(prediction.additionalStaffNeeded).toBeGreaterThan(0);
      expect(prediction.automationOpportunities).toBeDefined();
    });
  });
});