/**
 * RCM Compliance Dashboard Module
 * 
 * Provides compliance scoring, risk assessment, dashboard metrics,
 * alerts, and trend analysis for RCM compliance management.
 */

// Types
export interface ComplianceScore {
  overallScore: number;
  paymentScore: number;
  filingScore: number;
  documentationScore: number;
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  color: 'green' | 'yellow' | 'orange' | 'red';
}

export interface RiskAssessment {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  color: 'green' | 'yellow' | 'red';
  requiresAction: boolean;
  recommendations?: string[];
  immediateActions?: string[];
  escalationRequired?: boolean;
  criticalFactors?: string[];
  legalActionRisk?: boolean;
}

export interface DashboardMetrics {
  totalTransactions: number;
  totalLiability: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  onTimePaymentRate: number;
  averageDaysToPayment?: number;
  trends?: {
    transactionGrowth?: number;
    complianceImprovement?: number;
    averageMonthlyLiability: number;
  };
  byCategory?: {
    [key: string]: {
      count: number;
      amount: number;
    };
  };
  topVendors?: Array<{
    name: string;
    totalAmount: number;
    transactionCount: number;
  }>;
  vendorRiskProfile?: any;
}

export interface ComplianceAlert {
  type: 'PAYMENT_DUE' | 'PAYMENT_OVERDUE' | 'RETURN_DUE' | 'COMPLIANCE_BREACH';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  daysUntilDue?: number;
  requiresAction?: boolean;
  suggestedAction?: string;
  escalationRequired?: boolean;
  notifyManagement?: boolean;
}

export interface ComplianceTrend {
  direction: 'IMPROVING' | 'STABLE' | 'DECLINING';
  averageImprovement?: number;
  averageDecline?: number;
  projection: {
    nextMonth?: number;
  };
  insights?: string[];
  warningLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedActions?: string[];
  riskOfNonCompliance?: boolean;
  seasonalPattern?: string;
  peakMonths?: string[];
}

/**
 * Calculate compliance score
 */
export function calculateComplianceScore(
  data: {
    totalRCMTransactions: number;
    paidOnTime: number;
    paidLate: number;
    unpaid: number;
    returnsFiledOnTime: number;
    returnsFiledLate: number;
    returnsPending: number;
    documentationComplete: number;
    documentationPending: number;
  },
  weights?: {
    paymentWeight?: number;
    filingWeight?: number;
    documentationWeight?: number;
  }
): ComplianceScore {
  // Default weights
  const paymentWeight = weights?.paymentWeight || 0.4;
  const filingWeight = weights?.filingWeight || 0.35;
  const documentationWeight = weights?.documentationWeight || 0.25;
  
  // Calculate individual scores
  const paymentScore = data.totalRCMTransactions > 0
    ? (data.paidOnTime / data.totalRCMTransactions) * 100
    : 100;
    
  const totalReturns = data.returnsFiledOnTime + data.returnsFiledLate + data.returnsPending;
  const filingScore = totalReturns > 0
    ? (data.returnsFiledOnTime / totalReturns) * 100
    : 100;
    
  const totalDocumentation = data.documentationComplete + data.documentationPending;
  const documentationScore = totalDocumentation > 0
    ? (data.documentationComplete / totalDocumentation) * 100
    : 100;
  
  // Calculate weighted overall score
  const overallScore = 
    paymentScore * paymentWeight +
    filingScore * filingWeight +
    documentationScore * documentationWeight;
  
  // Determine rating and color
  let rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  let color: 'green' | 'yellow' | 'orange' | 'red';
  
  if (overallScore >= 90) {
    rating = 'EXCELLENT';
    color = 'green';
  } else if (overallScore >= 75) {
    rating = 'GOOD';
    color = 'yellow';
  } else if (overallScore >= 60) {
    rating = 'FAIR';
    color = 'orange';
  } else {
    rating = 'POOR';
    color = 'red';
  }
  
  return {
    overallScore,
    paymentScore,
    filingScore,
    documentationScore,
    rating,
    color,
  };
}

/**
 * Assess risk level
 */
export function assessRiskLevel(factors: {
  overduePayments: number;
  totalOutstanding: number;
  daysOverdueMax: number;
  complianceScore: number;
  missedFilings: number;
  auditFindings: number;
  penaltiesImposed?: number;
  noticesReceived?: number;
}): RiskAssessment {
  let score = 0;
  const criticalFactors: string[] = [];
  const recommendations: string[] = [];
  const immediateActions: string[] = [];
  
  // Score calculation (0-100 scale)
  
  // Overdue payments (0-30 points)
  if (factors.overduePayments > 15) {
    score += 30;
    criticalFactors.push('High number of overdue payments');
  } else if (factors.overduePayments > 10) {
    score += 20;
  } else if (factors.overduePayments > 5) {
    score += 10;
  } else if (factors.overduePayments > 0) {
    score += 5;
  }
  
  // Days overdue (0-20 points)
  if (factors.daysOverdueMax > 60) {
    score += 20;
    criticalFactors.push('Severely overdue payments');
  } else if (factors.daysOverdueMax > 30) {
    score += 15;
  } else if (factors.daysOverdueMax > 15) {
    score += 10;
  } else if (factors.daysOverdueMax > 0) {
    score += 5;
  }
  
  // Compliance score (0-20 points)
  if (factors.complianceScore < 40) {
    score += 20;
    criticalFactors.push('Very low compliance score');
  } else if (factors.complianceScore < 60) {
    score += 15;
  } else if (factors.complianceScore < 75) {
    score += 10;
  } else if (factors.complianceScore < 90) {
    score += 5;
  }
  
  // Missed filings (0-15 points)
  if (factors.missedFilings > 3) {
    score += 15;
    criticalFactors.push('Multiple missed filings');
  } else if (factors.missedFilings > 1) {
    score += 10;
  } else if (factors.missedFilings > 0) {
    score += 5;
  }
  
  // Audit findings (0-15 points)
  if (factors.auditFindings > 3) {
    score += 15;
    criticalFactors.push('Multiple audit findings');
  } else if (factors.auditFindings > 1) {
    score += 10;
  } else if (factors.auditFindings > 0) {
    score += 5;
  }
  
  // Additional critical factors
  if (factors.penaltiesImposed && factors.penaltiesImposed > 0) {
    score += 10;
    criticalFactors.push('Penalties imposed');
  }
  
  if (factors.noticesReceived && factors.noticesReceived > 0) {
    score += 10;
    criticalFactors.push('Notices received');
  }
  
  // Determine risk level
  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  let color: 'green' | 'yellow' | 'red';
  let requiresAction = false;
  let escalationRequired = false;
  let legalActionRisk = false;
  
  if (score >= 90) {
    level = 'CRITICAL';
    color = 'red';
    requiresAction = true;
    escalationRequired = true;
    legalActionRisk = true;
    immediateActions.push('Immediate management intervention required');
    immediateActions.push('Consult legal/tax advisor');
    immediateActions.push('Prepare compliance recovery plan');
  } else if (score >= 70) {
    level = 'HIGH';
    color = 'red';
    requiresAction = true;
    escalationRequired = true;
    immediateActions.push('Clear all overdue payments');
    immediateActions.push('File pending returns');
    recommendations.push('Implement compliance monitoring system');
  } else if (score >= 30) {
    level = 'MEDIUM';
    color = 'yellow';
    requiresAction = true;
    recommendations.push('Review payment processes');
    recommendations.push('Automate compliance tracking');
  } else {
    level = 'LOW';
    color = 'green';
    requiresAction = false;
    recommendations.push('Maintain current compliance practices');
  }
  
  return {
    level,
    score,
    color,
    requiresAction,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
    immediateActions: immediateActions.length > 0 ? immediateActions : undefined,
    escalationRequired,
    criticalFactors: criticalFactors.length > 0 ? criticalFactors : undefined,
    legalActionRisk,
  };
}

/**
 * Generate dashboard metrics
 */
export function generateDashboardMetrics(data: any): DashboardMetrics {
  const metrics: DashboardMetrics = {
    totalTransactions: 0,
    totalLiability: 0,
    paidAmount: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    onTimePaymentRate: 0,
  };
  
  // Process transactions
  if (data.transactions) {
    metrics.totalTransactions = data.transactions.length;
    
    let onTimeCount = 0;
    let totalDaysToPayment = 0;
    let paidCount = 0;
    
    for (const trans of data.transactions) {
      metrics.totalLiability += trans.amount;
      
      if (trans.status === 'PAID') {
        metrics.paidAmount += trans.amount;
        if (trans.paidDate && trans.dueDate) {
          const daysDiff = Math.ceil(
            (new Date(trans.paidDate).getTime() - new Date(trans.dueDate).getTime()) / 
            (1000 * 60 * 60 * 24)
          );
          if (daysDiff <= 0) {
            onTimeCount++;
          }
          totalDaysToPayment += Math.abs(daysDiff);
          paidCount++;
        }
      } else if (trans.status === 'PENDING') {
        metrics.pendingAmount += trans.amount;
      } else if (trans.status === 'OVERDUE') {
        metrics.overdueAmount += trans.amount;
      }
    }
    
    metrics.onTimePaymentRate = metrics.totalTransactions > 0
      ? (onTimeCount / metrics.totalTransactions) * 100
      : 0;
      
    metrics.averageDaysToPayment = paidCount > 0
      ? totalDaysToPayment / paidCount
      : undefined;
  }
  
  // Process monthly data for trends
  if (data.monthlyData) {
    const totalMonths = data.monthlyData.length;
    const totalAmount = data.monthlyData.reduce((sum: number, m: any) => sum + m.amount, 0);
    
    metrics.trends = {
      averageMonthlyLiability: totalAmount / totalMonths,
    };
    
    if (totalMonths >= 2) {
      const firstMonth = data.monthlyData[0];
      const lastMonth = data.monthlyData[totalMonths - 1];
      metrics.trends.transactionGrowth = 
        ((lastMonth.transactions - firstMonth.transactions) / firstMonth.transactions) * 100;
      metrics.trends.complianceImprovement = 
        ((lastMonth.onTime / lastMonth.transactions) - (firstMonth.onTime / firstMonth.transactions)) * 100;
    }
  }
  
  // Process by category
  if (data.transactions) {
    metrics.byCategory = {};
    
    for (const trans of data.transactions) {
      const type = trans.type || 'UNKNOWN';
      if (!metrics.byCategory[type]) {
        metrics.byCategory[type] = { count: 0, amount: 0 };
      }
      metrics.byCategory[type].count++;
      metrics.byCategory[type].amount += trans.amount;
    }
  }
  
  // Process vendor metrics
  if (data.transactions) {
    const vendorMap = new Map<string, { amount: number; count: number }>();
    
    for (const trans of data.transactions) {
      if (trans.vendorName) {
        const existing = vendorMap.get(trans.vendorName) || { amount: 0, count: 0 };
        existing.amount += trans.amount;
        existing.count++;
        vendorMap.set(trans.vendorName, existing);
      }
    }
    
    metrics.topVendors = Array.from(vendorMap.entries())
      .map(([name, data]) => ({
        name,
        totalAmount: data.amount,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
    
    metrics.vendorRiskProfile = {};
  }
  
  return metrics;
}

/**
 * Get compliance alerts
 */
export function getComplianceAlerts(data: any): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];
  
  // Upcoming payment alerts
  if (data.upcomingPayments) {
    for (const payment of data.upcomingPayments) {
      const daysUntilDue = Math.ceil(
        (new Date(payment.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      alerts.push({
        type: 'PAYMENT_DUE',
        priority: daysUntilDue <= 5 ? 'HIGH' : 'MEDIUM',
        message: `RCM payment due for ${payment.id}: Rs. ${payment.amount}`,
        daysUntilDue,
        requiresAction: true,
        suggestedAction: 'Process payment before due date',
      });
    }
  }
  
  // Overdue payment alerts
  if (data.overduePayments) {
    for (const payment of data.overduePayments) {
      alerts.push({
        type: 'PAYMENT_OVERDUE',
        priority: 'HIGH',
        message: `RCM payment overdue for ${payment.id}`,
        requiresAction: true,
        suggestedAction: 'Make immediate payment to avoid interest and penalties',
      });
    }
  }
  
  // Return filing alerts
  if (data.upcomingReturns) {
    for (const returnData of data.upcomingReturns) {
      const daysUntilDue = Math.ceil(
        (new Date(returnData.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      alerts.push({
        type: 'RETURN_DUE',
        priority: daysUntilDue <= 3 ? 'HIGH' : 'MEDIUM',
        message: `${returnData.returnType} for period ${returnData.period} due soon`,
        daysUntilDue,
        requiresAction: true,
        suggestedAction: 'Prepare and file return',
      });
    }
  }
  
  // Compliance breach alerts
  if (data.complianceIssues) {
    if (data.complianceIssues.overduePayments >= 5 || 
        data.complianceIssues.missedFilings >= 2 ||
        data.complianceIssues.complianceScore < 40) {
      alerts.push({
        type: 'COMPLIANCE_BREACH',
        priority: 'CRITICAL',
        message: 'Multiple compliance failures detected',
        requiresAction: true,
        suggestedAction: 'Immediate compliance review and remediation required',
        escalationRequired: true,
        notifyManagement: true,
      });
    }
  }
  
  // Sort by priority
  const priorityOrder: { [key: string]: number } = {
    'CRITICAL': 0,
    'HIGH': 1,
    'MEDIUM': 2,
    'LOW': 3,
  };
  
  return alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Analyze compliance trends
 */
export function analyzeComplianceTrends(
  historicalData: Array<{
    month: string;
    complianceScore: number;
    onTimeRate: number;
    transactions?: number;
  }>
): ComplianceTrend {
  if (historicalData.length < 2) {
    return {
      direction: 'STABLE',
      projection: {},
    };
  }
  
  // Calculate trend direction
  const firstScore = historicalData[0].complianceScore;
  const lastScore = historicalData[historicalData.length - 1].complianceScore;
  const scoreDiff = lastScore - firstScore;
  const avgChange = scoreDiff / (historicalData.length - 1);
  
  let direction: 'IMPROVING' | 'STABLE' | 'DECLINING';
  let warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | undefined;
  const insights: string[] = [];
  const recommendedActions: string[] = [];
  
  if (avgChange > 5) {
    direction = 'IMPROVING';
    insights.push('Compliance showing positive trend');
  } else if (avgChange < -5) {
    direction = 'DECLINING';
    warningLevel = lastScore < 60 ? 'HIGH' : 'MEDIUM';
    insights.push('Compliance deteriorating - immediate action required');
    recommendedActions.push('Review compliance processes');
    recommendedActions.push('Implement additional controls');
  } else {
    direction = 'STABLE';
    insights.push('Compliance remaining stable');
  }
  
  // Project next month
  const nextMonthScore = lastScore + avgChange;
  
  // Check for seasonal patterns
  let seasonalPattern: string | undefined;
  const peakMonths: string[] = [];
  
  if (historicalData.length >= 6) {
    // Check for quarterly peaks
    const quarterlyPeaks = [];
    for (let i = 2; i < historicalData.length; i += 3) {
      if (historicalData[i].transactions && 
          historicalData[i].transactions > historicalData[i - 1].transactions! * 1.2) {
        quarterlyPeaks.push(i);
      }
    }
    
    if (quarterlyPeaks.length >= 2) {
      seasonalPattern = 'QUARTERLY_PEAK';
      peakMonths.push('March', 'June', 'September', 'December');
    }
  }
  
  return {
    direction,
    averageImprovement: avgChange > 0 ? avgChange : undefined,
    averageDecline: avgChange < 0 ? Math.abs(avgChange) : undefined,
    projection: {
      nextMonth: nextMonthScore,
    },
    insights: insights.length > 0 ? insights : undefined,
    warningLevel,
    recommendedActions: recommendedActions.length > 0 ? recommendedActions : undefined,
    riskOfNonCompliance: nextMonthScore < 50,
    seasonalPattern,
    peakMonths: peakMonths.length > 0 ? peakMonths : undefined,
  };
}

/**
 * Get actionable insights
 */
export function getActionableInsights(data: any): Array<{
  category: string;
  action: string;
  expectedImprovement: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation?: string;
}> {
  const insights = [];
  
  // Payment insights
  if (data.overduePayments > 5) {
    insights.push({
      category: 'PAYMENT',
      action: 'Clear overdue payments',
      expectedImprovement: 'Improve compliance score by 10-15 points',
      priority: 'HIGH' as const,
      recommendation: 'Set up automated payment reminders',
    });
  }
  
  // Filing insights
  if (data.missedFilings > 0) {
    insights.push({
      category: 'FILING',
      action: 'File pending returns immediately',
      expectedImprovement: 'Avoid penalties and improve compliance',
      priority: 'HIGH' as const,
      recommendation: 'Implement return filing calendar',
    });
  }
  
  // Vendor insights
  if (data.vendorCompliance) {
    const poorVendors = data.vendorCompliance.filter((v: any) => v.onTimeRate < 50);
    if (poorVendors.length > 0) {
      insights.push({
        category: 'VENDOR',
        action: `Review payment terms with ${poorVendors[0].name}`,
        expectedImprovement: 'Reduce payment delays',
        priority: 'MEDIUM' as const,
        recommendation: 'Negotiate better payment terms or automate payments',
      });
    }
  }
  
  // Documentation insights
  if (data.documentationPending > 10) {
    insights.push({
      category: 'DOCUMENTATION',
      action: 'Complete pending documentation',
      expectedImprovement: 'Improve audit readiness',
      priority: 'MEDIUM' as const,
      recommendation: 'Implement document management system',
    });
  }
  
  // Sort by priority
  return insights.sort((a, b) => {
    const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Predict compliance issues
 */
export function predictComplianceIssues(data: {
  recentTrend?: string;
  currentScore?: number;
  monthlyDecline?: number;
  upcomingTransactions?: number;
  historicalAccuracy?: number;
  averageMonthlyTransactions?: number;
  growthRate?: number;
  currentStaffCapacity?: number;
}): {
  nextMonthScore?: number;
  riskOfBreach?: boolean;
  criticalThresholdDate?: Date;
  preventiveActions?: string[];
  resourceGap?: number;
  additionalStaffNeeded?: number;
  automationOpportunities?: string[];
} {
  const result: any = {};
  
  // Predict next month score
  if (data.currentScore && data.monthlyDecline) {
    result.nextMonthScore = data.currentScore - data.monthlyDecline;
    result.riskOfBreach = result.nextMonthScore < 60;
    
    if (data.monthlyDecline > 0) {
      const monthsUntilCritical = Math.floor((data.currentScore - 40) / data.monthlyDecline);
      result.criticalThresholdDate = new Date();
      result.criticalThresholdDate.setMonth(result.criticalThresholdDate.getMonth() + monthsUntilCritical);
    }
  }
  
  // Preventive actions
  if (result.riskOfBreach || data.recentTrend === 'DECLINING') {
    result.preventiveActions = [
      'Increase compliance monitoring frequency',
      'Implement automated payment processing',
      'Schedule compliance training',
      'Review and optimize processes',
    ];
  }
  
  // Resource planning
  if (data.averageMonthlyTransactions && data.growthRate && data.currentStaffCapacity) {
    const projectedTransactions = data.averageMonthlyTransactions * (1 + data.growthRate);
    const capacityUtilization = (projectedTransactions / data.currentStaffCapacity) * 100;
    
    if (capacityUtilization > 100) {
      result.resourceGap = projectedTransactions - data.currentStaffCapacity;
      result.additionalStaffNeeded = Math.ceil(result.resourceGap / (data.currentStaffCapacity / 1));
      
      result.automationOpportunities = [
        'Automated payment processing',
        'Auto-reconciliation systems',
        'Compliance dashboard automation',
        'Alert and notification systems',
      ];
    }
  }
  
  return result;
}