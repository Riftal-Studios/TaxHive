/**
 * RCM ITC Management Module
 * 
 * Implements ITC eligibility determination, claim processing,
 * time limit tracking, and GSTR-3B integration for RCM transactions
 * 
 * As per GST Section 16(4) and Section 17(5)
 */

// Types and Interfaces
export interface ITCEligibilityInput {
  rcmTransactionId: string;
  selfInvoiceId: string;
  selfInvoiceDate: Date;
  paymentCompleted: boolean;
  businessPurpose: string;
  category: ITCCategory;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  hsnCode?: string;
  sacCode?: string;
  description?: string;
}

export interface ITCEligibilityResult {
  isEligible: boolean;
  eligibilityStatus: 'ELIGIBLE' | 'BLOCKED' | 'EXPIRED' | 'PAYMENT_PENDING';
  totalITCAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  blockReason: string | null;
  section?: string;
  exception?: string;
}

export interface ITCClaim {
  claimId?: string;
  rcmTransactionId?: string;
  selfInvoiceId?: string;
  selfInvoiceDate?: Date;
  paymentCompleted?: boolean;
  businessPurpose?: string;
  category?: ITCCategory;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  totalITCAmount?: number;
  balance?: number;
  utilizeAmount?: number;
  claimStatus?: ITCClaimStatus;
  period?: string;
}

export interface ITCDeadlineResult {
  financialYear: string;
  deadlineDate: Date;
  daysRemaining: number;
  isExpired: boolean;
  expiryStatus?: 'ACTIVE' | 'WARNING' | 'EXPIRED';
  warningLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface BlockedCreditCheck {
  isBlocked: boolean;
  section?: string;
  reason?: string;
  exception?: string;
}

export interface GSTR3BData {
  period: string;
  table4B: {
    inputs: {
      cgst: number;
      sgst: number;
      igst: number;
      cess: number;
    };
    inputServices: {
      cgst: number;
      sgst: number;
      igst: number;
      cess: number;
    };
    capitalGoods: {
      cgst: number;
      sgst: number;
      igst: number;
      cess: number;
    };
  };
  totalITC: number;
  categoryWiseTotals?: {
    INPUTS: number;
    INPUT_SERVICES: number;
    CAPITAL_GOODS: number;
  };
  grandTotal?: number;
}

export type ITCCategory = 'INPUTS' | 'INPUT_SERVICES' | 'CAPITAL_GOODS';
export type ITCClaimStatus = 'PENDING' | 'CLAIMED' | 'REVERSED' | 'EXPIRED' | 'UTILIZED';

export interface BlockedCreditRule {
  section: string;
  description: string;
  keywords: string[];
  hsnCodes?: string[];
  sacCodes?: string[];
  exceptions?: string[];
}

// Blocked credit rules as per Section 17(5)
const BLOCKED_CREDIT_RULES: BlockedCreditRule[] = [
  {
    section: '17(5)(a)',
    description: 'Motor vehicles and conveyances',
    keywords: ['motor', 'vehicle', 'car', 'bike', 'scooter'],
    hsnCodes: ['8703', '8704', '8711'],
    exceptions: [
      'transportation of passengers',
      'transportation of goods',
      'training on driving',
      'taxi service',
      'logistics business',
    ],
  },
  {
    section: '17(5)(b)(i)',
    description: 'Food and beverages',
    keywords: ['food', 'beverage', 'catering', 'restaurant'],
    hsnCodes: ['2106', '2201', '2202'],
    sacCodes: ['996331', '996332'],
    exceptions: ['where it is obligatory for employer'],
  },
  {
    section: '17(5)(b)(ii)',
    description: 'Outdoor catering',
    keywords: ['outdoor catering', 'event catering'],
    sacCodes: ['996332'],
  },
  {
    section: '17(5)(b)(iii)',
    description: 'Health insurance',
    keywords: ['health insurance', 'medical insurance'],
    sacCodes: ['997132'],
    exceptions: ['where it is obligatory for employer'],
  },
  {
    section: '17(5)(b)(iv)',
    description: 'Travel benefits',
    keywords: ['travel', 'vacation', 'holiday', 'leave travel'],
    exceptions: ['where it is obligatory for employer'],
  },
  {
    section: '17(5)(c)',
    description: 'Works contract for immovable property',
    keywords: ['construction', 'building', 'works contract'],
    sacCodes: ['9954'],
    exceptions: ['plant and machinery', 'factory construction'],
  },
  {
    section: '17(5)(d)',
    description: 'Construction of immovable property',
    keywords: ['construction', 'immovable property'],
    exceptions: ['plant or machinery', 'further supply of works contract'],
  },
];

/**
 * Determine ITC eligibility based on GST rules
 */
export function determineITCEligibility(input: ITCEligibilityInput): ITCEligibilityResult {
  // Check payment completion first
  if (!input.paymentCompleted) {
    return {
      isEligible: false,
      eligibilityStatus: 'PAYMENT_PENDING',
      totalITCAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      cessAmount: 0,
      blockReason: 'Payment not completed',
    };
  }
  
  // Check if deadline expired
  const deadline = calculateITCDeadline(input.selfInvoiceDate);
  if (deadline.isExpired) {
    return {
      isEligible: false,
      eligibilityStatus: 'EXPIRED',
      totalITCAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      cessAmount: 0,
      blockReason: 'ITC claim deadline expired',
    };
  }
  
  // Check blocked credits
  const blockedCheck = checkBlockedCredits({
    hsnCode: input.hsnCode,
    sacCode: input.sacCode,
    description: input.description || input.businessPurpose,
    businessPurpose: input.businessPurpose,
  });
  
  if (blockedCheck.isBlocked) {
    return {
      isEligible: false,
      eligibilityStatus: 'BLOCKED',
      totalITCAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      cessAmount: 0,
      blockReason: `Section ${blockedCheck.section}: ${blockedCheck.reason}`,
      section: blockedCheck.section,
    };
  }
  
  // Calculate total ITC amount
  const totalITCAmount = 
    input.cgstAmount + 
    input.sgstAmount + 
    input.igstAmount + 
    input.cessAmount;
  
  return {
    isEligible: true,
    eligibilityStatus: 'ELIGIBLE',
    totalITCAmount,
    cgstAmount: input.cgstAmount,
    sgstAmount: input.sgstAmount,
    igstAmount: input.igstAmount,
    cessAmount: input.cessAmount,
    blockReason: null,
    exception: blockedCheck.exception,
  };
}

/**
 * Check if credit is blocked under Section 17(5)
 */
export function checkBlockedCredits(input: {
  hsnCode?: string;
  sacCode?: string;
  description?: string;
  businessPurpose: string;
}): BlockedCreditCheck {
  const lowerPurpose = input.businessPurpose.toLowerCase();
  const lowerDescription = (input.description || '').toLowerCase();
  
  for (const rule of BLOCKED_CREDIT_RULES) {
    // Check keywords
    const hasKeyword = rule.keywords.some(keyword => 
      lowerPurpose.includes(keyword) || lowerDescription.includes(keyword)
    );
    
    // Check HSN codes
    const hasHSN = rule.hsnCodes && input.hsnCode && 
      rule.hsnCodes.some(code => input.hsnCode?.startsWith(code));
    
    // Check SAC codes
    const hasSAC = rule.sacCodes && input.sacCode && 
      rule.sacCodes.some(code => input.sacCode?.startsWith(code));
    
    if (hasKeyword || hasHSN || hasSAC) {
      // Check exceptions
      if (rule.exceptions) {
        const hasException = rule.exceptions.some(exception => 
          lowerPurpose.includes(exception.toLowerCase())
        );
        
        if (hasException) {
          const foundException = rule.exceptions.find(e => 
            lowerPurpose.includes(e.toLowerCase())
          );
          return {
            isBlocked: false,
            section: rule.section,
            exception: foundException ? `Exception: ${foundException}` : undefined,
          };
        }
      }
      
      return {
        isBlocked: true,
        section: rule.section,
        reason: rule.description.toLowerCase(),
      };
    }
  }
  
  return { isBlocked: false };
}

/**
 * Calculate ITC deadline based on self-invoice date
 * Deadline is November 30th of the next financial year
 */
export function calculateITCDeadline(selfInvoiceDate: Date): ITCDeadlineResult {
  const invoiceDate = new Date(selfInvoiceDate);
  const currentDate = new Date();
  
  // Determine financial year of self-invoice
  const invoiceYear = invoiceDate.getFullYear();
  const invoiceMonth = invoiceDate.getMonth() + 1; // 0-indexed
  
  let financialYear: string;
  let deadlineYear: number;
  
  if (invoiceMonth >= 4) {
    // April to March - current year to next year
    financialYear = `${invoiceYear}-${(invoiceYear + 1).toString().slice(2)}`;
    deadlineYear = invoiceYear + 1;
  } else {
    // January to March - previous year to current year
    financialYear = `${invoiceYear - 1}-${invoiceYear.toString().slice(2)}`;
    deadlineYear = invoiceYear;
  }
  
  // Deadline is November 30th of the next financial year
  const deadlineDate = new Date(deadlineYear, 10, 30); // November is month 10
  
  // Calculate days remaining
  const timeDiff = deadlineDate.getTime() - currentDate.getTime();
  const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
  
  const isExpired = currentDate > deadlineDate;
  
  let expiryStatus: 'ACTIVE' | 'WARNING' | 'EXPIRED' = 'ACTIVE';
  let warningLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined;
  
  if (isExpired) {
    expiryStatus = 'EXPIRED';
  } else if (daysRemaining <= 30) {
    warningLevel = 'CRITICAL';
    expiryStatus = 'WARNING';
  } else if (daysRemaining <= 60) {
    warningLevel = 'HIGH';
    expiryStatus = 'WARNING';
  } else if (daysRemaining <= 90) {
    warningLevel = 'MEDIUM';
    expiryStatus = 'WARNING';
  } else if (daysRemaining <= 180) {
    warningLevel = 'LOW';
  }
  
  return {
    financialYear,
    deadlineDate,
    daysRemaining,
    isExpired,
    expiryStatus,
    warningLevel,
  };
}

/**
 * Process ITC claim
 */
export function processITCClaim(claim: ITCClaim): any {
  // Handle utilization update
  if (claim.utilizeAmount !== undefined && claim.totalITCAmount && claim.balance !== undefined) {
    const newBalance = claim.balance - claim.utilizeAmount;
    const utilizedAmount = claim.totalITCAmount - newBalance;
    const utilizationPercentage = (utilizedAmount / claim.totalITCAmount) * 100;
    
    return {
      success: true,
      utilizedAmount,
      balance: newBalance,
      utilizationPercentage,
    };
  }
  
  // Check if claim is expired
  if (claim.selfInvoiceDate) {
    const deadline = calculateITCDeadline(claim.selfInvoiceDate);
    if (deadline.isExpired) {
      return {
        success: false,
        claimStatus: 'EXPIRED',
        error: 'ITC claim deadline expired',
      };
    }
  }
  
  // Process new claim
  if (claim.rcmTransactionId && claim.selfInvoiceId) {
    const eligibility = determineITCEligibility({
      rcmTransactionId: claim.rcmTransactionId,
      selfInvoiceId: claim.selfInvoiceId,
      selfInvoiceDate: claim.selfInvoiceDate!,
      paymentCompleted: claim.paymentCompleted!,
      businessPurpose: claim.businessPurpose!,
      category: claim.category!,
      cgstAmount: claim.cgstAmount || 0,
      sgstAmount: claim.sgstAmount || 0,
      igstAmount: claim.igstAmount || 0,
      cessAmount: claim.cessAmount || 0,
    });
    
    if (!eligibility.isEligible) {
      return {
        success: false,
        claimStatus: eligibility.eligibilityStatus,
        error: eligibility.blockReason,
      };
    }
    
    return {
      success: true,
      claimStatus: 'CLAIMED',
      claimId: `claim-${Date.now()}`,
      totalITCAmount: eligibility.totalITCAmount,
      balance: eligibility.totalITCAmount,
    };
  }
  
  return {
    success: false,
    error: 'Invalid claim data',
  };
}

/**
 * Reverse ITC claim
 */
export function reverseITCClaim(reversal: any): any {
  // Handle auto-reversal of expired claims
  if (reversal.autoReverseExpired && reversal.claims) {
    const expiredClaims = reversal.claims.filter((claim: any) => {
      const deadline = calculateITCDeadline(claim.selfInvoiceDate);
      return deadline.isExpired;
    });
    
    const totalReversedAmount = expiredClaims.reduce(
      (sum: number, claim: any) => sum + claim.totalITCAmount, 
      0
    );
    
    return {
      reversedCount: expiredClaims.length,
      reversedClaims: expiredClaims.map((c: any) => c.claimId),
      totalReversedAmount,
    };
  }
  
  // Handle manual reversal
  if (reversal.claimId && reversal.reversalReason) {
    return {
      success: true,
      reversalStatus: 'REVERSED',
      reversedAmount: reversal.reversalAmount,
      reversalDate: new Date(),
    };
  }
  
  return {
    success: false,
    error: 'Invalid reversal data',
  };
}

/**
 * Prepare ITC data for GSTR-3B
 */
export function prepareITCForGSTR3B(claims: any[], period: string): GSTR3BData {
  const table4B = {
    inputs: { cgst: 0, sgst: 0, igst: 0, cess: 0 },
    inputServices: { cgst: 0, sgst: 0, igst: 0, cess: 0 },
    capitalGoods: { cgst: 0, sgst: 0, igst: 0, cess: 0 },
  };
  
  const categoryTotals = {
    INPUTS: 0,
    INPUT_SERVICES: 0,
    CAPITAL_GOODS: 0,
  };
  
  // Filter claims for the specified period if needed
  const periodClaims = claims.filter(claim => 
    !claim.period || claim.period === period
  );
  
  // Aggregate by category
  for (const claim of periodClaims) {
    const category = claim.category;
    
    if (category === 'INPUTS') {
      table4B.inputs.cgst += claim.cgstAmount || 0;
      table4B.inputs.sgst += claim.sgstAmount || 0;
      table4B.inputs.igst += claim.igstAmount || 0;
      table4B.inputs.cess += claim.cessAmount || 0;
      categoryTotals.INPUTS += claim.totalITCAmount || 
        (claim.cgstAmount || 0) + (claim.sgstAmount || 0) + 
        (claim.igstAmount || 0) + (claim.cessAmount || 0);
    } else if (category === 'INPUT_SERVICES') {
      table4B.inputServices.cgst += claim.cgstAmount || 0;
      table4B.inputServices.sgst += claim.sgstAmount || 0;
      table4B.inputServices.igst += claim.igstAmount || 0;
      table4B.inputServices.cess += claim.cessAmount || 0;
      categoryTotals.INPUT_SERVICES += claim.totalITCAmount || 
        (claim.cgstAmount || 0) + (claim.sgstAmount || 0) + 
        (claim.igstAmount || 0) + (claim.cessAmount || 0);
    } else if (category === 'CAPITAL_GOODS') {
      table4B.capitalGoods.cgst += claim.cgstAmount || 0;
      table4B.capitalGoods.sgst += claim.sgstAmount || 0;
      table4B.capitalGoods.igst += claim.igstAmount || 0;
      table4B.capitalGoods.cess += claim.cessAmount || 0;
      categoryTotals.CAPITAL_GOODS += claim.totalITCAmount || 
        (claim.cgstAmount || 0) + (claim.sgstAmount || 0) + 
        (claim.igstAmount || 0) + (claim.cessAmount || 0);
    }
  }
  
  // Calculate totals
  const totalITC = 
    table4B.inputs.cgst + table4B.inputs.sgst + table4B.inputs.igst + table4B.inputs.cess +
    table4B.inputServices.cgst + table4B.inputServices.sgst + table4B.inputServices.igst + table4B.inputServices.cess +
    table4B.capitalGoods.cgst + table4B.capitalGoods.sgst + table4B.capitalGoods.igst + table4B.capitalGoods.cess;
  
  const grandTotal = categoryTotals.INPUTS + categoryTotals.INPUT_SERVICES + categoryTotals.CAPITAL_GOODS;
  
  return {
    period,
    table4B,
    totalITC,
    categoryWiseTotals: categoryTotals,
    grandTotal,
  };
}

/**
 * Get expiring claims
 */
export function getExpiringClaims(claims: any[], daysThreshold: number): any {
  const expiringClaims = claims.filter(claim => 
    claim.daysRemaining <= daysThreshold && claim.daysRemaining > 0
  );
  
  const totalExpiringAmount = expiringClaims.reduce(
    (sum, claim) => sum + claim.totalITCAmount, 
    0
  );
  
  let urgencyLevel: string;
  if (daysThreshold <= 30) {
    urgencyLevel = 'CRITICAL';
  } else if (daysThreshold <= 60) {
    urgencyLevel = 'HIGH';
  } else if (daysThreshold <= 90) {
    urgencyLevel = 'MEDIUM';
  } else {
    urgencyLevel = 'LOW';
  }
  
  // Generate alerts
  const alerts = [
    {
      period: 30,
      level: 'CRITICAL',
      message: 'Claims expiring within 30 days require immediate action',
    },
    {
      period: 60,
      level: 'HIGH',
      message: 'Claims expiring within 60 days need attention',
    },
    {
      period: 90,
      level: 'MEDIUM',
      message: 'Claims expiring within 90 days should be reviewed',
    },
  ];
  
  return {
    expiringClaims,
    totalExpiringAmount,
    urgencyLevel,
    alerts,
  };
}

/**
 * Calculate ITC utilization
 */
export function calculateITCUtilization(input: any): any {
  // Single claim utilization
  if (input.totalITCAmount !== undefined && input.utilizedAmount !== undefined) {
    const utilizationPercentage = (input.utilizedAmount / input.totalITCAmount) * 100;
    const balance = input.totalITCAmount - input.utilizedAmount;
    
    let utilizationStatus: string;
    let recommendation: string | undefined;
    
    if (utilizationPercentage >= 80) {
      utilizationStatus = 'EXCELLENT';
    } else if (utilizationPercentage >= 60) {
      utilizationStatus = 'GOOD';
    } else if (utilizationPercentage >= 40) {
      utilizationStatus = 'MODERATE';
    } else {
      utilizationStatus = 'LOW';
      recommendation = 'Consider optimizing ITC utilization';
    }
    
    return {
      utilizationPercentage,
      balance,
      utilizationStatus,
      recommendation,
    };
  }
  
  // Multiple claims - category-wise utilization
  if (Array.isArray(input)) {
    const categoryWiseUtilization: any = {};
    let totalAmount = 0;
    let totalUtilized = 0;
    
    for (const claim of input) {
      const category = claim.category;
      const percentage = (claim.utilizedAmount / claim.totalITCAmount) * 100;
      categoryWiseUtilization[category] = percentage;
      
      totalAmount += claim.totalITCAmount;
      totalUtilized += claim.utilizedAmount;
    }
    
    const overallUtilization = (totalUtilized / totalAmount) * 100;
    
    return {
      categoryWiseUtilization,
      overallUtilization,
    };
  }
  
  return {
    error: 'Invalid input for utilization calculation',
  };
}