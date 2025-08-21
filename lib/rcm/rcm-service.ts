/**
 * RCM (Reverse Charge Mechanism) Service Orchestrator
 * 
 * Main service that orchestrates all RCM operations:
 * - RCM detection and applicability
 * - Tax calculation
 * - Compliance tracking
 * - Integration with purchase invoices
 * 
 * Implementation follows TDD methodology - making tests pass (GREEN phase)
 */

import { detectRCM, type RCMDetectionInput } from './rcm-detector';
import { calculateRCMTax, type RCMTaxInput, type RCMTaxResult } from './rcm-calculator';
import { trackPaymentStatus, type RCMComplianceInput, type RCMComplianceResult } from './rcm-compliance';
import { detectKnownSupplier } from './foreign-supplier-registry';

export interface CreateRCMTransactionInput {
  // Vendor details
  vendorName: string;
  vendorGSTIN?: string;
  vendorCountry: string;
  vendorAddress?: string;
  
  // Transaction details
  invoiceNumber: string;
  invoiceDate: Date;
  description: string;
  serviceType: string;
  hsnSacCode?: string;
  
  // Amount details
  taxableAmount: number;
  currency?: string;
  exchangeRate?: number;
  foreignAmount?: number;
  
  // Recipient details
  recipientGSTIN: string;
  recipientState: string;
  placeOfSupply: string;
  
  // Metadata
  userId: string;
  purchaseInvoiceId?: string;
}

export interface RCMTransactionResult {
  // Detection results
  isRCMApplicable: boolean;
  rcmType: string | null;
  reason: string;
  
  // Tax calculation
  taxCalculation?: RCMTaxResult;
  
  // Compliance information
  complianceInfo?: RCMComplianceResult;
  
  // Known supplier information
  knownSupplier?: {
    isKnown: boolean;
    supplierCode?: string;
    defaultHSN?: string;
  };
  
  // Transaction details for saving
  transactionData?: {
    transactionType: string;
    vendorName: string;
    vendorGSTIN?: string;
    vendorCountry?: string;
    invoiceNumber: string;
    invoiceDate: Date;
    description: string;
    hsnSacCode: string;
    taxableAmount: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    cessAmount?: number;
    totalTaxAmount: number;
    foreignCurrency?: string;
    exchangeRate?: number;
    foreignAmount?: number;
    paymentDueDate: Date;
    returnPeriod: string;
    userId: string;
    purchaseInvoiceId?: string;
  };
}

/**
 * Creates an RCM transaction with full detection, calculation, and compliance tracking
 */
export function createRCMTransaction(input: CreateRCMTransactionInput): RCMTransactionResult {
  // Step 1: Detect if RCM is applicable
  const detectionInput: RCMDetectionInput = {
    vendorGSTIN: input.vendorGSTIN || null,
    vendorName: input.vendorName,
    vendorCountry: input.vendorCountry,
    placeOfSupply: input.placeOfSupply,
    recipientGSTIN: input.recipientGSTIN,
    recipientState: input.recipientState,
    serviceType: input.serviceType,
    taxableAmount: input.taxableAmount,
  };
  
  const detectionResult = detectRCM(detectionInput);
  
  const result: RCMTransactionResult = {
    isRCMApplicable: detectionResult.isRCMApplicable,
    rcmType: detectionResult.rcmType,
    reason: detectionResult.reason,
  };
  
  // If RCM is not applicable, return early
  if (!detectionResult.isRCMApplicable) {
    return result;
  }
  
  // Step 2: Calculate tax amounts
  const taxInput: RCMTaxInput = {
    taxableAmount: input.taxableAmount,
    gstRate: detectionResult.gstRate,
    taxType: detectionResult.taxType!,
    rcmType: detectionResult.rcmType as any,
    placeOfSupply: input.placeOfSupply,
    recipientState: input.recipientState,
    foreignCurrency: input.currency !== 'INR' ? input.currency : undefined,
    foreignAmount: input.foreignAmount,
    exchangeRate: input.exchangeRate,
  };
  
  const taxCalculation = calculateRCMTax(taxInput);
  result.taxCalculation = taxCalculation;
  
  // Step 3: Set up compliance tracking
  const complianceInput: RCMComplianceInput = {
    taxAmount: taxCalculation.totalTaxAmount,
    transactionDate: input.invoiceDate,
    rcmType: detectionResult.rcmType!,
    vendorName: input.vendorName,
  };
  
  const complianceInfo = trackPaymentStatus(complianceInput);
  result.complianceInfo = complianceInfo;
  
  // Step 4: Check for known supplier information
  if (input.vendorCountry.toUpperCase() !== 'INDIA') {
    try {
      const supplierResult = detectKnownSupplier({
        name: input.vendorName,
        country: input.vendorCountry,
        serviceType: input.serviceType,
      });
      
      result.knownSupplier = {
        isKnown: supplierResult.isKnownSupplier,
        supplierCode: supplierResult.supplierCode || undefined,
        defaultHSN: supplierResult.defaultHSN,
      };
    } catch {
      // Continue without known supplier info if detection fails
      result.knownSupplier = {
        isKnown: false,
      };
    }
  }
  
  // Step 5: Prepare transaction data for database storage
  const hsnCode = input.hsnSacCode || 
    result.knownSupplier?.defaultHSN || 
    getDefaultHSNForService(input.serviceType);
  
  result.transactionData = {
    transactionType: detectionResult.rcmType!,
    vendorName: input.vendorName,
    vendorGSTIN: input.vendorGSTIN,
    vendorCountry: input.vendorCountry,
    invoiceNumber: input.invoiceNumber,
    invoiceDate: input.invoiceDate,
    description: input.description,
    hsnSacCode: hsnCode,
    taxableAmount: taxCalculation.taxableAmount,
    cgstAmount: taxCalculation.cgstAmount > 0 ? taxCalculation.cgstAmount : undefined,
    sgstAmount: taxCalculation.sgstAmount > 0 ? taxCalculation.sgstAmount : undefined,
    igstAmount: taxCalculation.igstAmount > 0 ? taxCalculation.igstAmount : undefined,
    cessAmount: taxCalculation.cessAmount > 0 ? taxCalculation.cessAmount : undefined,
    totalTaxAmount: taxCalculation.totalTaxAmount,
    foreignCurrency: taxCalculation.foreignCurrency,
    exchangeRate: taxCalculation.exchangeRate,
    foreignAmount: taxCalculation.foreignAmount,
    paymentDueDate: complianceInfo.dueDate,
    returnPeriod: complianceInfo.returnPeriod,
    userId: input.userId,
    purchaseInvoiceId: input.purchaseInvoiceId,
  };
  
  return result;
}

/**
 * Validates RCM transaction before creation
 */
export function validateRCMTransaction(input: CreateRCMTransactionInput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Required field validation
  if (!input.vendorName.trim()) {
    errors.push('Vendor name is required');
  }
  
  if (!input.vendorCountry.trim()) {
    errors.push('Vendor country is required');
  }
  
  if (!input.invoiceNumber.trim()) {
    errors.push('Invoice number is required');
  }
  
  if (!input.description.trim()) {
    errors.push('Description is required');
  }
  
  if (!input.serviceType.trim()) {
    errors.push('Service type is required');
  }
  
  if (!input.recipientGSTIN.trim()) {
    errors.push('Recipient GSTIN is required');
  }
  
  if (!input.recipientState.trim()) {
    errors.push('Recipient state is required');
  }
  
  if (!input.placeOfSupply.trim()) {
    errors.push('Place of supply is required');
  }
  
  if (!input.userId.trim()) {
    errors.push('User ID is required');
  }
  
  // Amount validation
  if (input.taxableAmount <= 0) {
    errors.push('Taxable amount must be greater than 0');
  }
  
  // Date validation
  if (isNaN(input.invoiceDate.getTime())) {
    errors.push('Invalid invoice date');
  }
  
  // Foreign currency validation
  if (input.currency && input.currency !== 'INR') {
    if (!input.foreignAmount || input.foreignAmount <= 0) {
      errors.push('Foreign amount is required for foreign currency transactions');
    }
    
    if (!input.exchangeRate || input.exchangeRate <= 0) {
      errors.push('Exchange rate is required and must be greater than 0');
    }
  }
  
  // GSTIN format validation (basic)
  if (input.vendorGSTIN) {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(input.vendorGSTIN)) {
      errors.push('Invalid vendor GSTIN format');
    }
  }
  
  const recipientGstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!recipientGstinRegex.test(input.recipientGSTIN)) {
    errors.push('Invalid recipient GSTIN format');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Gets default HSN/SAC code for service type
 */
function getDefaultHSNForService(serviceType: string): string {
  const serviceHSNMap: Record<string, string> = {
    'SOFTWARE': '998314',
    'CLOUD': '998313',
    'CONSULTING': '998311',
    'PROFESSIONAL': '998311',
    'TECHNICAL': '998311',
    'MANAGEMENT': '998311',
    'LEGAL': '998311',
    'FINANCIAL': '998311',
  };
  
  return serviceHSNMap[serviceType.toUpperCase()] || '998319'; // Other professional services
}

/**
 * Bulk processes RCM transactions from purchase invoices
 */
export function processRCMForPurchaseInvoices(invoices: Array<{
  id: string;
  vendorName: string;
  vendorGSTIN?: string;
  vendorCountry: string;
  invoiceNumber: string;
  invoiceDate: Date;
  taxableAmount: number;
  serviceType: string;
  description: string;
  userId: string;
  recipientGSTIN: string;
  recipientState: string;
  placeOfSupply: string;
}>): Array<{
  invoiceId: string;
  result: RCMTransactionResult;
}> {
  
  return invoices.map(invoice => {
    const input: CreateRCMTransactionInput = {
      vendorName: invoice.vendorName,
      vendorGSTIN: invoice.vendorGSTIN,
      vendorCountry: invoice.vendorCountry,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      description: invoice.description,
      serviceType: invoice.serviceType,
      taxableAmount: invoice.taxableAmount,
      recipientGSTIN: invoice.recipientGSTIN,
      recipientState: invoice.recipientState,
      placeOfSupply: invoice.placeOfSupply,
      userId: invoice.userId,
      purchaseInvoiceId: invoice.id,
    };
    
    const result = createRCMTransaction(input);
    
    return {
      invoiceId: invoice.id,
      result,
    };
  });
}

/**
 * Gets summary statistics for RCM transactions
 */
export function getRCMSummary(transactions: Array<{
  rcmType: string;
  taxableAmount: number;
  totalTaxAmount: number;
  paymentStatus: string;
  transactionDate: Date;
}>): {
  totalTransactions: number;
  totalTaxableAmount: number;
  totalTaxAmount: number;
  pendingPayments: number;
  overduePayments: number;
  byType: Record<string, { count: number; taxableAmount: number; taxAmount: number }>;
  byMonth: Record<string, { count: number; taxableAmount: number; taxAmount: number }>;
} {
  const summary = {
    totalTransactions: transactions.length,
    totalTaxableAmount: 0,
    totalTaxAmount: 0,
    pendingPayments: 0,
    overduePayments: 0,
    byType: {} as Record<string, { count: number; taxableAmount: number; taxAmount: number }>,
    byMonth: {} as Record<string, { count: number; taxableAmount: number; taxAmount: number }>,
  };
  
  transactions.forEach(transaction => {
    summary.totalTaxableAmount += transaction.taxableAmount;
    summary.totalTaxAmount += transaction.totalTaxAmount;
    
    if (transaction.paymentStatus === 'PENDING') {
      summary.pendingPayments++;
    } else if (transaction.paymentStatus === 'OVERDUE') {
      summary.overduePayments++;
    }
    
    // By type
    if (!summary.byType[transaction.rcmType]) {
      summary.byType[transaction.rcmType] = { count: 0, taxableAmount: 0, taxAmount: 0 };
    }
    summary.byType[transaction.rcmType].count++;
    summary.byType[transaction.rcmType].taxableAmount += transaction.taxableAmount;
    summary.byType[transaction.rcmType].taxAmount += transaction.totalTaxAmount;
    
    // By month
    const monthKey = `${transaction.transactionDate.getFullYear()}-${String(transaction.transactionDate.getMonth() + 1).padStart(2, '0')}`;
    if (!summary.byMonth[monthKey]) {
      summary.byMonth[monthKey] = { count: 0, taxableAmount: 0, taxAmount: 0 };
    }
    summary.byMonth[monthKey].count++;
    summary.byMonth[monthKey].taxableAmount += transaction.taxableAmount;
    summary.byMonth[monthKey].taxAmount += transaction.totalTaxAmount;
  });
  
  return summary;
}