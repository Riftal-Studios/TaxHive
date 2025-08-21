/**
 * RCM (Reverse Charge Mechanism) Tax Calculator
 * 
 * Calculates tax amounts for RCM transactions including:
 * - CGST/SGST for intra-state RCM
 * - IGST for inter-state/import RCM
 * - Currency conversion for imports
 * - Proper rounding as per GST rules
 * 
 * Implementation follows TDD methodology - making tests pass (GREEN phase)
 */

export interface RCMTaxInput {
  taxableAmount: number;
  gstRate: number;
  cessRate?: number;
  taxType: 'CGST_SGST' | 'IGST';
  rcmType: 'UNREGISTERED' | 'IMPORT_SERVICE' | 'NOTIFIED_SERVICE' | 'NOTIFIED_GOODS';
  placeOfSupply: string;
  recipientState: string;
  
  // For foreign currency transactions
  foreignCurrency?: string;
  foreignAmount?: number;
  exchangeRate?: number;
}

export interface RCMTaxResult {
  taxableAmount: number;
  
  // Tax rates
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate: number;
  
  // Tax amounts
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  
  // Foreign currency details (if applicable)
  foreignCurrency?: string;
  foreignAmount?: number;
  exchangeRate?: number;
}

/**
 * Valid GST rates in India
 */
const VALID_GST_RATES = [0, 5, 12, 18, 28];

/**
 * Rounds amount to nearest rupee as per GST rounding rules
 */
function roundToNearestRupee(amount: number): number {
  return Math.round(amount);
}

/**
 * Validates input parameters
 */
function validateInput(input: RCMTaxInput): void {
  if (input.taxableAmount < 0) {
    throw new Error('Taxable amount cannot be negative');
  }
  
  if (!VALID_GST_RATES.includes(input.gstRate)) {
    throw new Error('Invalid GST rate. Valid rates are: 0%, 5%, 12%, 18%, 28%');
  }
  
  // Validate foreign currency transaction requirements
  if (input.foreignCurrency && input.foreignAmount) {
    if (input.exchangeRate === undefined || input.exchangeRate === null) {
      throw new Error('Exchange rate is required for foreign currency transactions');
    }
    
    if (input.exchangeRate <= 0) {
      throw new Error('Exchange rate must be greater than 0');
    }
  }
}

/**
 * Calculates taxable amount from foreign currency if needed
 */
function calculateTaxableAmount(input: RCMTaxInput): number {
  if (input.foreignCurrency && input.foreignAmount && input.exchangeRate) {
    return roundToNearestRupee(input.foreignAmount * input.exchangeRate);
  }
  
  return input.taxableAmount;
}

/**
 * Main RCM tax calculation function
 */
export function calculateRCMTax(input: RCMTaxInput): RCMTaxResult {
  validateInput(input);
  
  const taxableAmount = calculateTaxableAmount(input);
  const cessRate = input.cessRate || 0;
  
  const result: RCMTaxResult = {
    taxableAmount,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    cessRate,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    cessAmount: 0,
    totalTaxAmount: 0,
    totalAmount: 0,
  };
  
  // Add foreign currency details if applicable
  if (input.foreignCurrency) {
    result.foreignCurrency = input.foreignCurrency;
    result.foreignAmount = input.foreignAmount;
    result.exchangeRate = input.exchangeRate;
  }
  
  // Calculate CESS first (applies to both CGST/SGST and IGST)
  if (cessRate > 0) {
    result.cessAmount = roundToNearestRupee(taxableAmount * (cessRate / 100));
  }
  
  // Calculate GST amounts based on tax type
  if (input.taxType === 'CGST_SGST') {
    // Intra-state: Split GST rate equally between CGST and SGST
    result.cgstRate = input.gstRate / 2;
    result.sgstRate = input.gstRate / 2;
    
    result.cgstAmount = roundToNearestRupee(taxableAmount * (result.cgstRate / 100));
    result.sgstAmount = roundToNearestRupee(taxableAmount * (result.sgstRate / 100));
  } else {
    // Inter-state or Import: Full rate as IGST
    result.igstRate = input.gstRate;
    result.igstAmount = roundToNearestRupee(taxableAmount * (result.igstRate / 100));
  }
  
  // Calculate totals
  result.totalTaxAmount = result.cgstAmount + result.sgstAmount + result.igstAmount + result.cessAmount;
  result.totalAmount = taxableAmount + result.totalTaxAmount;
  
  return result;
}

/**
 * Helper function to calculate tax for multiple line items
 */
export function calculateRCMTaxForLineItems(lineItems: Array<{
  description: string;
  amount: number;
  gstRate: number;
  cessRate?: number;
}>, input: Omit<RCMTaxInput, 'taxableAmount' | 'gstRate' | 'cessRate'>): RCMTaxResult {
  
  let totalTaxableAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  let totalIgstAmount = 0;
  let totalCessAmount = 0;
  
  // Calculate tax for each line item
  for (const item of lineItems) {
    const itemInput: RCMTaxInput = {
      ...input,
      taxableAmount: item.amount,
      gstRate: item.gstRate,
      cessRate: item.cessRate || 0,
    };
    
    const itemResult = calculateRCMTax(itemInput);
    
    totalTaxableAmount += itemResult.taxableAmount;
    totalCgstAmount += itemResult.cgstAmount;
    totalSgstAmount += itemResult.sgstAmount;
    totalIgstAmount += itemResult.igstAmount;
    totalCessAmount += itemResult.cessAmount;
  }
  
  // Use the rates from the first item (assuming all items have same rate structure)
  const firstItemInput: RCMTaxInput = {
    ...input,
    taxableAmount: lineItems[0].amount,
    gstRate: lineItems[0].gstRate,
    cessRate: lineItems[0].cessRate || 0,
  };
  const firstItemResult = calculateRCMTax(firstItemInput);
  
  return {
    taxableAmount: totalTaxableAmount,
    cgstRate: firstItemResult.cgstRate,
    sgstRate: firstItemResult.sgstRate,
    igstRate: firstItemResult.igstRate,
    cessRate: firstItemResult.cessRate,
    cgstAmount: totalCgstAmount,
    sgstAmount: totalSgstAmount,
    igstAmount: totalIgstAmount,
    cessAmount: totalCessAmount,
    totalTaxAmount: totalCgstAmount + totalSgstAmount + totalIgstAmount + totalCessAmount,
    totalAmount: totalTaxableAmount + totalCgstAmount + totalSgstAmount + totalIgstAmount + totalCessAmount,
    foreignCurrency: input.foreignCurrency,
    foreignAmount: input.foreignAmount,
    exchangeRate: input.exchangeRate,
  };
}

/**
 * Helper function to get applicable GST rate for different service types
 */
export function getServiceGSTRate(serviceType: string, hsnSacCode?: string): number {
  // Service-specific GST rates (this can be expanded based on HSN/SAC codes)
  const serviceRates: Record<string, number> = {
    'SOFTWARE': 18,
    'CONSULTING': 18,
    'PROFESSIONAL': 18,
    'TECHNICAL': 18,
    'CLOUD': 18,
    'SAAS': 18,
    'LEGAL': 18,
    'MANAGEMENT': 18,
    'FINANCIAL': 18,
  };
  
  // HSN/SAC specific rates can override service type rates
  if (hsnSacCode) {
    const hsnRates: Record<string, number> = {
      '998314': 18, // Software services
      '998313': 18, // Cloud computing services
      '998311': 18, // Professional services
      '998319': 18, // Other professional services
    };
    
    if (hsnRates[hsnSacCode]) {
      return hsnRates[hsnSacCode];
    }
  }
  
  return serviceRates[serviceType.toUpperCase()] || 18;
}

/**
 * Calculates the tax liability date (20th of next month)
 */
export function calculateRCMTaxDueDate(transactionDate: Date): Date {
  const dueDate = new Date(transactionDate);
  dueDate.setMonth(dueDate.getMonth() + 1); // Next month
  dueDate.setDate(20); // 20th of the month
  dueDate.setHours(0, 0, 0, 0); // Start of day
  
  return dueDate;
}

/**
 * Formats tax calculation result for display
 */
export function formatRCMTaxResult(result: RCMTaxResult, currency: string = 'INR'): string {
  const formatAmount = (amount: number) => 
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  
  let output = `Taxable Amount: ${formatAmount(result.taxableAmount)}\n`;
  
  if (result.cgstAmount > 0) {
    output += `CGST (${result.cgstRate}%): ${formatAmount(result.cgstAmount)}\n`;
    output += `SGST (${result.sgstRate}%): ${formatAmount(result.sgstAmount)}\n`;
  }
  
  if (result.igstAmount > 0) {
    output += `IGST (${result.igstRate}%): ${formatAmount(result.igstAmount)}\n`;
  }
  
  if (result.cessAmount > 0) {
    output += `CESS (${result.cessRate}%): ${formatAmount(result.cessAmount)}\n`;
  }
  
  output += `Total Tax: ${formatAmount(result.totalTaxAmount)}\n`;
  output += `Total Amount: ${formatAmount(result.totalAmount)}`;
  
  if (result.foreignCurrency && result.foreignAmount) {
    output += `\n\nForeign Amount: ${result.foreignAmount} ${result.foreignCurrency}`;
    output += `\nExchange Rate: ${result.exchangeRate}`;
  }
  
  return output;
}