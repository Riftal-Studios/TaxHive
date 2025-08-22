/**
 * RCM ITC Eligibility Rules Engine
 * 
 * Implements Section 17(5) blocked categories, RCM-specific ITC rules,
 * business purpose validation, and eligibility determination.
 * 
 * Based on:
 * - Section 17(5) of CGST Act - Blocked Credit categories
 * - GST Circular 05/2024 - Time limits for RCM ITC
 * - 2024 amendments on construction services and CSR activities
 */

// Types and Interfaces
export interface ITCEligibilityRequest {
  // Transaction details
  transactionType?: 'REGULAR' | 'RCM' | 'IMPORT';
  transactionId?: string;
  
  // Category and classification
  category: string;
  description?: string;
  sacCode?: string;
  hsnCode?: string;
  
  // Amounts
  amount: number;
  gstAmount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  
  // Usage and purpose
  usage?: string;
  businessUsePercentage?: number;
  personalUsePercentage?: number;
  
  // Specific category details
  seatingCapacity?: number; // For vehicles
  membershipType?: string; // For memberships
  constructionType?: string; // For construction
  isPlantOrMachinery?: boolean;
  isCapitalGood?: boolean;
  
  // RCM specific
  rcmApplicable?: boolean;
  isNotifiedService?: boolean;
  isImport?: boolean;
  gtaWithoutITC?: boolean;
  supplierType?: string;
  supplierGSTIN?: string;
  supplierStatus?: string;
  
  // Legal and compliance
  legalMandateReference?: string;
  status?: string;
  
  // Dates
  invoiceDate?: Date;
  supplyDate?: Date;
  selfInvoiceDate?: Date;
  paymentDate?: Date;
  currentDate?: Date;
  effectiveDate?: Date;
  financialYear?: string;
  
  // Payment details
  paymentStatus?: string;
  daysSinceInvoice?: number;
  
  // Previous reversal
  previousReversal?: ITCReversalReason;
  
  // Common credit
  taxableSupplies?: number;
  exemptSupplies?: number;
  totalSupplies?: number;
  usefulLife?: number;
  
  // Vehicle usage
  vehicleUsageDetails?: {
    businessKm: number;
    personalKm: number;
    totalKm: number;
  };
}

export interface ITCEligibilityResult {
  isEligible: boolean;
  eligibleAmount: number;
  blockedAmount?: number;
  eligibilityPercentage?: number;
  
  // Tax breakup
  cgstEligible?: number;
  sgstEligible?: number;
  igstEligible?: number;
  cessEligible?: number;
  
  // Blocking details
  blockedCategories?: string[];
  blockReason?: string;
  ineligibleReason?: string;
  exception?: string;
  
  // Tax type
  taxType?: 'CGST_SGST' | 'IGST';
  
  // Compliance
  complianceNote?: string;
  complianceRequirements?: string[];
  gstr3bTable?: string;
  
  // Reversal
  reversalRequired?: boolean;
  reversalReason?: string;
  reversalAmount?: number;
  
  // Reclaim
  reclaimEligible?: boolean;
  reclaimAmount?: number;
  reclaimMonth?: string;
}

export interface BlockedCategory {
  isBlocked: boolean;
  blockReason?: string;
  section?: string;
  exception?: string;
}

export interface ITCReversalReason {
  reason: string;
  amount: number;
  reversalDate: Date;
}

/**
 * Check if transaction falls under Section 17(5) blocked categories
 */
export function checkBlockedCategories(request: ITCEligibilityRequest): BlockedCategory {
  const result: BlockedCategory = {
    isBlocked: false,
  };

  switch (request.category) {
    case 'MOTOR_VEHICLE':
      // Section 17(5)(a) - Motor vehicles
      if (request.seatingCapacity && request.seatingCapacity <= 13) {
        // Check exceptions
        if (request.usage === 'TAXI_SERVICE' || 
            request.usage === 'PASSENGER_TRANSPORT' ||
            request.usage === 'GOODS_TRANSPORT' ||
            request.usage === 'TRAINING_SCHOOL') {
          result.isBlocked = false;
          result.exception = 'Used for taxable supply of passenger transport';
        } else {
          result.isBlocked = true;
          result.blockReason = 'Motor vehicle with seating <= 13 - Section 17(5)(a)';
          result.section = 'Section 17(5)(a)';
        }
      }
      break;

    case 'FOOD_BEVERAGES':
      // Section 17(5)(b) - Food and beverages
      if (request.usage === 'LEGAL_REQUIREMENT' && request.legalMandateReference) {
        result.isBlocked = false;
        result.exception = 'legally required under ' + request.legalMandateReference;
      } else if (request.usage === 'OUTWARD_SUPPLY') {
        result.isBlocked = false;
        result.exception = 'Used for making outward taxable supply';
      } else {
        result.isBlocked = true;
        result.blockReason = 'Food and beverages - Section 17(5)(b)';
        result.section = 'Section 17(5)(b)';
      }
      break;

    case 'MEMBERSHIP':
      // Section 17(5)(c) - Membership of clubs
      if (request.membershipType === 'HEALTH_CLUB' || 
          request.membershipType === 'FITNESS_CENTER' ||
          request.membershipType === 'CLUB') {
        result.isBlocked = true;
        result.blockReason = 'Club/health membership - Section 17(5)(c)';
        result.section = 'Section 17(5)(c)';
      }
      break;

    case 'CONSTRUCTION':
      // Section 17(5)(d) - Construction of immovable property
      if (request.constructionType === 'IMMOVABLE_PROPERTY') {
        if (request.isPlantOrMachinery || request.usage === 'RENTAL_BUSINESS') {
          result.isBlocked = false;
          result.exception = 'Qualifies as plant and machinery for business';
        } else {
          result.isBlocked = true;
          result.blockReason = 'Construction of immovable property - Section 17(5)(d)';
          result.section = 'Section 17(5)(d)';
        }
      }
      break;

    case 'GENERAL_GOODS':
      // Section 17(5)(e) - Personal use
      if (request.usage === 'PERSONAL' || request.businessUsePercentage === 0) {
        result.isBlocked = true;
        result.blockReason = 'Personal use - Section 17(5)(e)';
        result.section = 'Section 17(5)(e)';
      }
      // Section 17(5)(f) - Lost/stolen/destroyed
      if (request.status === 'LOST' || request.status === 'STOLEN' || 
          request.status === 'DESTROYED' || request.status === 'WRITTEN_OFF') {
        result.isBlocked = true;
        result.blockReason = 'Lost/stolen/destroyed goods - Section 17(5)(f)';
        result.section = 'Section 17(5)(f)';
      }
      break;

    case 'CSR_EXPENSE':
      // CSR activities
      result.isBlocked = true;
      result.blockReason = 'CSR activities - Blocked under GST';
      break;
  }

  return result;
}

/**
 * Calculate eligible ITC amount
 */
export function calculateEligibleITC(request: ITCEligibilityRequest): number {
  // If blocked category, return 0
  const blockCheck = checkBlockedCategories(request);
  if (blockCheck.isBlocked) {
    return 0;
  }

  // For RCM transactions
  if (request.rcmApplicable && request.transactionType === 'RCM') {
    // 100% ITC if used for business
    if (request.usage === 'BUSINESS') {
      return request.gstAmount;
    }
    return 0;
  }

  // For mixed use
  if (request.businessUsePercentage && request.businessUsePercentage < 100) {
    return (request.gstAmount * request.businessUsePercentage) / 100;
  }

  return request.gstAmount;
}

/**
 * Validate business purpose
 */
export function validateBusinessPurpose(request: ITCEligibilityRequest): boolean {
  if (request.usage === 'PERSONAL' || request.usage === 'CSR_ACTIVITY') {
    return false;
  }
  
  if (request.businessUsePercentage === 0) {
    return false;
  }
  
  return true;
}

/**
 * Check time limit for ITC claim
 */
export function checkTimeLimit(request: ITCEligibilityRequest): {
  isWithinTimeLimit: boolean;
  lastDateToClaim?: Date;
  daysRemaining?: number;
  reason?: string;
} {
  if (!request.financialYear || !request.currentDate) {
    return { isWithinTimeLimit: true }; // Cannot validate without dates
  }

  // For RCM with self-invoice, use self-invoice date's FY
  const relevantDate = request.selfInvoiceDate || request.invoiceDate;
  if (!relevantDate) {
    return { isWithinTimeLimit: true };
  }

  // Extract FY from date
  const invoiceYear = relevantDate.getFullYear();
  const invoiceMonth = relevantDate.getMonth();
  let fy: string;
  
  if (invoiceMonth >= 3) { // April onwards
    fy = `${invoiceYear}-${(invoiceYear + 1).toString().slice(2)}`;
  } else { // Jan-March
    fy = `${invoiceYear - 1}-${invoiceYear.toString().slice(2)}`;
  }

  // Calculate deadline - Nov 30 of next FY
  const fyEndYear = parseInt('20' + fy.split('-')[1]);
  const deadline = new Date(fyEndYear, 10, 30); // Nov 30

  const isWithinLimit = request.currentDate <= deadline;
  const daysRemaining = Math.ceil((deadline.getTime() - request.currentDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    isWithinTimeLimit: isWithinLimit,
    lastDateToClaim: deadline,
    daysRemaining: isWithinLimit ? daysRemaining : 0,
    reason: isWithinLimit ? undefined : 'Time limit expired under Section 16(4)',
  };
}

/**
 * Apply proportionate ITC rules (Rule 42/43)
 */
export function applyProportionateRule(request: ITCEligibilityRequest): {
  eligibleAmount: number;
  blockedAmount?: number;
  reversalAmount?: number;
  rule?: string;
} {
  // For mixed personal/business use
  if (request.usage === 'MIXED' && request.businessUsePercentage) {
    const eligible = (request.gstAmount * request.businessUsePercentage) / 100;
    const blocked = request.gstAmount - eligible;
    
    return {
      eligibleAmount: eligible,
      blockedAmount: blocked,
      rule: 'PROPORTIONATE',
    };
  }

  // Rule 42 - Common credit for taxable and exempt supplies
  if (request.category === 'COMMON_CREDIT' && request.taxableSupplies && request.totalSupplies) {
    const ratio = request.taxableSupplies / request.totalSupplies;
    const eligible = request.gstAmount * ratio;
    const reversal = request.gstAmount - eligible;
    
    return {
      eligibleAmount: eligible,
      reversalAmount: reversal,
      rule: 'RULE_42',
    };
  }

  // Rule 43 - Capital goods
  if (request.isCapitalGood && request.taxableSupplies && request.totalSupplies) {
    const ratio = request.taxableSupplies / request.totalSupplies;
    const eligible = Math.round(request.gstAmount * ratio * 100) / 100; // Round to 2 decimals
    const reversal = Math.round((request.gstAmount - eligible) * 100) / 100;
    
    return {
      eligibleAmount: eligible,
      reversalAmount: reversal,
      rule: 'RULE_43',
    };
  }

  return {
    eligibleAmount: request.gstAmount,
  };
}

/**
 * Main function to determine ITC eligibility
 */
export function determineITCEligibility(request: ITCEligibilityRequest): ITCEligibilityResult {
  const result: ITCEligibilityResult = {
    isEligible: false,
    eligibleAmount: 0,
    blockedCategories: [],
    complianceRequirements: [],
  };

  // Step 1: Check blocked categories
  const blockCheck = checkBlockedCategories(request);
  if (blockCheck.isBlocked) {
    result.isEligible = false;
    result.eligibleAmount = 0;
    result.blockedCategories?.push(request.category);
    result.blockReason = blockCheck.blockReason;
    result.ineligibleReason = blockCheck.blockReason;
    
    // Still need to report liability for RCM
    if (request.rcmApplicable) {
      result.gstr3bTable = '3.1(d)'; // Liability table only
    }
    
    return result;
  }

  // Step 2: Check business purpose
  if (!validateBusinessPurpose(request)) {
    result.isEligible = false;
    result.eligibleAmount = 0;
    result.ineligibleReason = 'Used for non-business purpose';
    return result;
  }

  // Step 3: Check time limits
  const timeCheck = checkTimeLimit(request);
  if (!timeCheck.isWithinTimeLimit) {
    result.isEligible = false;
    result.eligibleAmount = 0;
    result.ineligibleReason = timeCheck.reason;
    return result;
  }

  // Step 4: RCM specific checks
  if (request.rcmApplicable && request.transactionType === 'RCM') {
    // Check for GTA without ITC
    if (request.gtaWithoutITC) {
      result.isEligible = false;
      result.eligibleAmount = 0;
      result.ineligibleReason = 'GTA service without ITC option';
      return result;
    }

    result.complianceRequirements?.push('Self-invoice required');
    result.complianceRequirements?.push('Payment in cash only');
    result.gstr3bTable = '4(A)(3)'; // RCM ITC table

    if (request.isNotifiedService) {
      result.complianceNote = 'Self-invoice required for notified service';
    }

    if (request.isImport) {
      result.taxType = 'IGST';
      result.complianceNote = 'Import of services under RCM';
    }

    if (request.effectiveDate && request.effectiveDate >= new Date('2024-10-10')) {
      if (request.category === 'RENTAL_COMMERCIAL') {
        result.complianceNote = 'RCM on commercial rental (post Oct 10, 2024)';
      }
    }
  }

  // Step 5: Check for reversals
  if (request.paymentStatus === 'UNPAID' && request.daysSinceInvoice && request.daysSinceInvoice > 180) {
    result.reversalRequired = true;
    result.reversalReason = 'NON_PAYMENT_180_DAYS';
    result.reversalAmount = request.gstAmount;
  }

  if (request.supplierStatus === 'CANCELLED') {
    result.reversalRequired = true;
    result.reversalReason = 'SUPPLIER_REGISTRATION_CANCELLED';
    result.reversalAmount = request.gstAmount;
  }

  // Step 6: Check for reclaim
  if (request.previousReversal && request.paymentStatus === 'PAID') {
    result.reclaimEligible = true;
    result.reclaimAmount = request.previousReversal.amount;
    if (request.paymentDate) {
      const month = request.paymentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      result.reclaimMonth = month;
    }
  }

  // Step 7: Apply proportionate rules
  const proportionate = applyProportionateRule(request);
  
  // Step 8: Calculate final eligible amount
  result.eligibleAmount = proportionate.eligibleAmount;
  result.blockedAmount = proportionate.blockedAmount;
  
  // Set tax breakup
  if (request.cgst && request.sgst) {
    const ratio = result.eligibleAmount / request.gstAmount;
    result.cgstEligible = request.cgst * ratio;
    result.sgstEligible = request.sgst * ratio;
    result.taxType = 'CGST_SGST';
  } else if (request.igst) {
    result.igstEligible = result.eligibleAmount;
    result.taxType = 'IGST';
  }

  // Set final eligibility
  result.isEligible = result.eligibleAmount > 0;
  result.eligibilityPercentage = (result.eligibleAmount / request.gstAmount) * 100;

  return result;
}