/**
 * RCM (Reverse Charge Mechanism) Compliance Management
 * 
 * Manages compliance aspects of RCM including:
 * - Due date calculation (20th of next month)
 * - Payment status tracking
 * - Overdue detection and categorization
 * - Interest calculation for late payments
 * - GSTR-3B integration
 * 
 * Implementation follows TDD methodology - making tests pass (GREEN phase)
 */

export interface RCMComplianceInput {
  taxAmount: number;
  transactionDate: Date;
  rcmType: string;
  vendorName: string;
}

export interface RCMPaymentInput {
  rcmTransactionId: string;
  paymentDate: Date;
  challanNumber: string;
  paymentAmount: number;
  paymentMethod: string;
}

export interface RCMOverdueResult {
  isOverdue: boolean;
  daysPastDue: number;
  overdueCategory: 'NOT_OVERDUE' | 'MINOR' | 'MAJOR' | 'CRITICAL';
}

export interface RCMComplianceResult {
  paymentStatus: 'PENDING' | 'PAID' | 'OVERDUE';
  dueDate: Date;
  paymentDate: Date | null;
  challanNumber: string | null;
  overdueInfo?: RCMOverdueResult;
  interestAmount?: number;
  returnPeriod: string;
  includedInReturn: boolean;
  gstr3bMapping?: {
    table: string;
    applicableTurnover: number;
    taxLiability: number;
  };
}

export interface RCMPaymentValidationResult {
  isValid: boolean;
  paymentStatus: string;
  validationMessages: string[];
}

// State code mapping for challan number generation
const STATE_CODES: Record<string, string> = {
  'ANDHRA_PRADESH': '28',
  'ARUNACHAL_PRADESH': '12',
  'ASSAM': '18',
  'BIHAR': '10',
  'CHHATTISGARH': '22',
  'DELHI': '07',
  'GOA': '30',
  'GUJARAT': '24',
  'HARYANA': '06',
  'HIMACHAL_PRADESH': '02',
  'JAMMU_KASHMIR': '01',
  'JHARKHAND': '20',
  'KARNATAKA': '29',
  'KERALA': '32',
  'LADAKH': '38',
  'MADHYA_PRADESH': '23',
  'MAHARASHTRA': '27',
  'MANIPUR': '14',
  'MEGHALAYA': '17',
  'MIZORAM': '15',
  'NAGALAND': '13',
  'ODISHA': '21',
  'PUNJAB': '03',
  'RAJASTHAN': '08',
  'SIKKIM': '11',
  'TAMIL_NADU': '33',
  'TELANGANA': '36',
  'TRIPURA': '16',
  'UTTAR_PRADESH': '09',
  'UTTARAKHAND': '05',
  'WEST_BENGAL': '19',
};

/**
 * Calculates RCM due date (20th of next month)
 */
export function getRCMDueDate(transactionDate: Date): Date {
  if (isNaN(transactionDate.getTime())) {
    throw new Error('Invalid transaction date');
  }
  
  // Check for future dates beyond reasonable limit
  const now = new Date();
  const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  if (transactionDate > twoYearsFromNow) {
    throw new Error('Transaction date cannot be too far in the future');
  }
  
  const dueDate = new Date(transactionDate);
  const targetMonth = dueDate.getMonth() + 1;
  const targetYear = dueDate.getFullYear();
  
  // Set date to 1st first to avoid month overflow issues (e.g., March 31 -> April 31 -> May 1)
  dueDate.setDate(1);
  
  // Handle year rollover
  if (targetMonth > 11) {
    dueDate.setFullYear(targetYear + 1);
    dueDate.setMonth(0); // January
  } else {
    dueDate.setMonth(targetMonth);
  }
  
  dueDate.setDate(20); // 20th of the month
  dueDate.setHours(0, 0, 0, 0); // Start of day
  
  return dueDate;
}

/**
 * Checks overdue status and categorizes delay
 */
export function checkOverdueStatus(dueDate: Date, currentDate?: Date): RCMOverdueResult {
  const checkDate = currentDate || new Date();
  
  // Reset time to compare dates only
  const dueDateOnly = new Date(dueDate);
  dueDateOnly.setHours(0, 0, 0, 0);
  
  const checkDateOnly = new Date(checkDate);
  checkDateOnly.setHours(0, 0, 0, 0);
  
  const timeDiff = checkDateOnly.getTime() - dueDateOnly.getTime();
  const daysPastDue = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
  
  let overdueCategory: RCMOverdueResult['overdueCategory'] = 'NOT_OVERDUE';
  
  if (daysPastDue > 0) {
    if (daysPastDue <= 30) {
      overdueCategory = 'MINOR';
    } else if (daysPastDue <= 90) {
      overdueCategory = 'MAJOR';
    } else {
      overdueCategory = 'CRITICAL';
    }
  }
  
  return {
    isOverdue: daysPastDue > 0,
    daysPastDue,
    overdueCategory,
  };
}

/**
 * Calculates interest for late payment of RCM
 */
export function calculateInterest(
  principal: number,
  daysOverdue: number,
  interestRate: number = 18
): number {
  if (principal < 0) {
    throw new Error('Principal amount cannot be negative');
  }
  
  if (daysOverdue < 0) {
    throw new Error('Days overdue cannot be negative');
  }
  
  if (interestRate <= 0) {
    throw new Error('Interest rate must be positive');
  }
  
  if (daysOverdue === 0) {
    return 0;
  }
  
  // Simple interest calculation: P * R * T / 100
  // Where T is in years (days / 365)
  const interest = (principal * interestRate * daysOverdue) / (365 * 100);
  
  return Math.round(interest); // Round to nearest rupee
}

/**
 * Tracks payment status for RCM transaction
 */
export function trackPaymentStatus(
  input: RCMComplianceInput,
  currentDate?: Date
): RCMComplianceResult {
  const dueDate = getRCMDueDate(input.transactionDate);
  const checkDate = currentDate || new Date();
  
  const overdueInfo = checkOverdueStatus(dueDate, checkDate);
  
  let paymentStatus: 'PENDING' | 'PAID' | 'OVERDUE' = 'PENDING';
  let interestAmount = 0;
  
  if (overdueInfo.isOverdue) {
    paymentStatus = 'OVERDUE';
    interestAmount = calculateInterest(input.taxAmount, overdueInfo.daysPastDue);
  }
  
  // Generate return period (MM-YYYY format)
  const returnPeriod = `${String(input.transactionDate.getMonth() + 1).padStart(2, '0')}-${input.transactionDate.getFullYear()}`;
  
  // For GSTR-3B mapping, input.taxAmount is the turnover, not the tax amount
  // We need to calculate tax FROM the turnover
  const gstRate = 18;
  const applicableTurnover = Math.round(input.taxAmount); // This is actually the turnover
  const taxLiability = Math.round(input.taxAmount * (gstRate / 100)); // Calculate tax from turnover
  
  return {
    paymentStatus,
    dueDate,
    paymentDate: null,
    challanNumber: null,
    overdueInfo: overdueInfo.isOverdue ? overdueInfo : undefined,
    interestAmount: interestAmount > 0 ? interestAmount : undefined,
    returnPeriod,
    includedInReturn: false,
    gstr3bMapping: {
      table: '3.1',
      applicableTurnover,
      taxLiability,
    },
  };
}

/**
 * Generates challan number for RCM payment
 */
export function generateChallanNumber(state: string, paymentDate: Date): string {
  const stateCode = STATE_CODES[state.toUpperCase()];
  
  if (!stateCode) {
    throw new Error('Invalid state code');
  }
  
  const dateStr = paymentDate.toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  
  return `CHAL${stateCode}-${dateStr}-${sequence}`;
}

/**
 * Validates challan number format
 */
function isValidChallanNumber(challanNumber: string): boolean {
  // Format: CHALXX-YYYYMMDD-XXXXXX
  const challanRegex = /^CHAL\d{2}-\d{8}-\d{6}$/;
  return challanRegex.test(challanNumber);
}

/**
 * Validates RCM payment details
 */
export function validateRCMPayment(input: RCMPaymentInput): RCMPaymentValidationResult {
  const validationMessages: string[] = [];
  
  // Validate challan number
  if (!input.challanNumber || input.challanNumber.trim() === '') {
    validationMessages.push('Challan number is required');
  } else if (!isValidChallanNumber(input.challanNumber)) {
    validationMessages.push('Invalid challan number format');
  }
  
  // Validate payment amount
  if (input.paymentAmount <= 0) {
    validationMessages.push('Payment amount must be greater than 0');
  }
  
  // Validate payment date
  const now = new Date();
  if (input.paymentDate > now) {
    validationMessages.push('Payment date cannot be in the future');
  }
  
  // Validate payment method
  const validPaymentMethods = ['ONLINE', 'NEFT', 'RTGS', 'CHEQUE', 'CASH'];
  if (!validPaymentMethods.includes(input.paymentMethod)) {
    validationMessages.push('Invalid payment method');
  }
  
  const isValid = validationMessages.length === 0;
  
  return {
    isValid,
    paymentStatus: isValid ? 'PAID' : 'PENDING',
    validationMessages,
  };
}

/**
 * Calculates the return period for GSTR-3B filing
 */
export function getGSTReturnPeriod(transactionDate: Date): string {
  const month = String(transactionDate.getMonth() + 1).padStart(2, '0');
  const year = transactionDate.getFullYear();
  return `${month}-${year}`;
}

/**
 * Gets GSTR-3B table mapping for RCM transaction
 */
export function getGSTR3BMapping(rcmType: string, taxableAmount: number, taxAmount: number) {
  let table = '3.1'; // Default table for RCM
  let description = '';
  
  switch (rcmType) {
    case 'UNREGISTERED':
      table = '3.1(d)';
      description = 'Inward supplies liable to reverse charge from unregistered persons';
      break;
    case 'IMPORT_SERVICE':
      table = '3.1(d)';
      description = 'Import of services';
      break;
    case 'NOTIFIED_SERVICE':
      table = '3.1(d)';
      description = 'Inward supplies of notified services liable to reverse charge';
      break;
    case 'NOTIFIED_GOODS':
      table = '3.1(d)';
      description = 'Inward supplies of notified goods liable to reverse charge';
      break;
    default:
      table = '3.1(d)';
      description = 'Other inward supplies liable to reverse charge';
  }
  
  return {
    table,
    description,
    applicableTurnover: taxableAmount,
    taxLiability: taxAmount,
  };
}

/**
 * Calculates quarterly summary for RCM transactions
 */
export function calculateQuarterlySummary(
  transactions: Array<{
    taxableAmount: number;
    taxAmount: number;
    rcmType: string;
    transactionDate: Date;
  }>,
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
  year: number
) {
  const quarterMonths = {
    'Q1': [0, 1, 2], // Jan, Feb, Mar
    'Q2': [3, 4, 5], // Apr, May, Jun
    'Q3': [6, 7, 8], // Jul, Aug, Sep
    'Q4': [9, 10, 11], // Oct, Nov, Dec
  };
  
  const relevantMonths = quarterMonths[quarter];
  
  const filteredTransactions = transactions.filter(t => 
    t.transactionDate.getFullYear() === year &&
    relevantMonths.includes(t.transactionDate.getMonth())
  );
  
  const summary = {
    totalTransactions: filteredTransactions.length,
    totalTaxableAmount: 0,
    totalTaxAmount: 0,
    byType: {} as Record<string, { count: number; taxableAmount: number; taxAmount: number }>,
  };
  
  filteredTransactions.forEach(t => {
    summary.totalTaxableAmount += t.taxableAmount;
    summary.totalTaxAmount += t.taxAmount;
    
    if (!summary.byType[t.rcmType]) {
      summary.byType[t.rcmType] = { count: 0, taxableAmount: 0, taxAmount: 0 };
    }
    
    summary.byType[t.rcmType].count++;
    summary.byType[t.rcmType].taxableAmount += t.taxableAmount;
    summary.byType[t.rcmType].taxAmount += t.taxAmount;
  });
  
  return summary;
}