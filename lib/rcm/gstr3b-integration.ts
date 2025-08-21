/**
 * GSTR-3B Integration Module for RCM
 * 
 * Handles GSTR-3B return preparation, validation, and JSON generation
 * with specific focus on RCM reporting requirements.
 */

// Types
export interface GSTR3BReturn {
  gstin: string;
  returnPeriod: string;
  table31d: Table31d;
  table4B: Table4B;
  rcmBreakdown?: RCMBreakdown;
}

export interface RCMInwardSupplies {
  vendorType: 'UNREGISTERED' | 'REGISTERED' | 'FOREIGN';
  serviceType?: string;
  description?: string;
  hsnSacCode?: string;
  vendorCountry?: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface RCMITCEligible {
  category: 'INPUTS' | 'INPUT_SERVICES' | 'CAPITAL_GOODS';
  serviceType?: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  itcEligible: boolean;
  itcIneligibleReason?: string;
}

export interface Table31d {
  totalTaxableValue: number;
  integratedTax: number;
  centralTax: number;
  stateTax: number;
  cess: number;
  totalTax: number;
  description: string;
  includesImportOfServices?: boolean;
}

export interface Table4B {
  inputs: TaxBreakup;
  inputServices: TaxBreakup;
  capitalGoods: TaxBreakup;
  totalITC: number;
  ineligibleITC: number;
}

export interface TaxBreakup {
  integratedTax: number;
  centralTax: number;
  stateTax: number;
  cess: number;
}

export interface RCMBreakdown {
  unregistered: CategoryBreakdown;
  importService: CategoryBreakdown;
  notifiedService: CategoryBreakdown;
  notifiedGoods?: CategoryBreakdown;
}

export interface CategoryBreakdown {
  count: number;
  taxableValue: number;
  tax: number;
}

export interface GSTR3BValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rcmPaymentMatches?: boolean;
  rcmMismatchAmount?: number;
  itcRcmBalanced?: boolean;
}

export interface ReturnPeriod {
  month: number;
  year: number;
  quarter?: string;
  returnPeriod: string;
  startDate: Date;
  endDate: Date;
  dueDate: Date;
}

/**
 * Get return period details
 */
export function getReturnPeriod(
  date: Date,
  filingType: 'MONTHLY' | 'QUARTERLY'
): ReturnPeriod {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  if (filingType === 'MONTHLY') {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const dueDate = new Date(year, month, 20);
    
    return {
      month,
      year,
      returnPeriod: `${month.toString().padStart(2, '0')}${year}`,
      startDate,
      endDate,
      dueDate,
    };
  } else {
    const quarter = Math.ceil(month / 3);
    const quarterStartMonth = (quarter - 1) * 3;
    const startDate = new Date(year, quarterStartMonth, 1);
    const endDate = new Date(year, quarterStartMonth + 3, 0);
    const dueDate = new Date(year, quarterStartMonth + 3, 24);
    
    return {
      month,
      year,
      quarter: `Q${quarter}`,
      returnPeriod: `Q${quarter}${year}`,
      startDate,
      endDate,
      dueDate,
    };
  }
}

/**
 * Calculate Table 3.1(d) - Inward supplies liable to reverse charge
 */
export function calculateTable31d(
  transactions: RCMInwardSupplies[]
): Table31d {
  let totalTaxableValue = 0;
  let integratedTax = 0;
  let centralTax = 0;
  let stateTax = 0;
  let cess = 0;
  let includesImportOfServices = false;
  
  for (const trans of transactions) {
    totalTaxableValue += trans.taxableAmount;
    integratedTax += trans.igst;
    centralTax += trans.cgst;
    stateTax += trans.sgst;
    cess += trans.cess;
    
    if (trans.vendorType === 'FOREIGN' || trans.serviceType === 'IMPORT_SERVICE') {
      includesImportOfServices = true;
    }
  }
  
  const totalTax = integratedTax + centralTax + stateTax + cess;
  
  return {
    totalTaxableValue,
    integratedTax,
    centralTax,
    stateTax,
    cess,
    totalTax,
    description: 'Inward supplies from unregistered persons liable to reverse charge',
    includesImportOfServices,
  };
}

/**
 * Calculate Table 4(B) - ITC Available (including inputs and input services liable to reverse charge)
 */
export function calculateTable4B(
  rcmITC: RCMITCEligible[]
): Table4B {
  const inputs: TaxBreakup = {
    integratedTax: 0,
    centralTax: 0,
    stateTax: 0,
    cess: 0,
  };
  
  const inputServices: TaxBreakup = {
    integratedTax: 0,
    centralTax: 0,
    stateTax: 0,
    cess: 0,
  };
  
  const capitalGoods: TaxBreakup = {
    integratedTax: 0,
    centralTax: 0,
    stateTax: 0,
    cess: 0,
  };
  
  let ineligibleITC = 0;
  
  for (const itc of rcmITC) {
    if (itc.itcEligible) {
      const target = 
        itc.category === 'INPUTS' ? inputs :
        itc.category === 'INPUT_SERVICES' ? inputServices :
        capitalGoods;
      
      target.integratedTax += itc.igst;
      target.centralTax += itc.cgst;
      target.stateTax += itc.sgst;
      target.cess += itc.cess;
    } else {
      ineligibleITC += itc.igst + itc.cgst + itc.sgst + itc.cess;
    }
  }
  
  const totalITC = 
    inputs.integratedTax + inputs.centralTax + inputs.stateTax + inputs.cess +
    inputServices.integratedTax + inputServices.centralTax + inputServices.stateTax + inputServices.cess +
    capitalGoods.integratedTax + capitalGoods.centralTax + capitalGoods.stateTax + capitalGoods.cess;
  
  return {
    inputs,
    inputServices,
    capitalGoods,
    totalITC,
    ineligibleITC,
  };
}

/**
 * Prepare complete GSTR-3B with RCM data
 */
export function prepareGSTR3BWithRCM(data: {
  returnPeriod: string;
  gstin: string;
  legalName: string;
  rcmTransactions: RCMInwardSupplies[];
  rcmITC: RCMITCEligible[];
}): GSTR3BReturn & { 
  rcmBreakdown: RCMBreakdown;
} {
  const table31d = calculateTable31d(data.rcmTransactions);
  const table4B = calculateTable4B(data.rcmITC);
  
  // Calculate breakdown by category
  const rcmBreakdown: RCMBreakdown = {
    unregistered: {
      count: 0,
      taxableValue: 0,
      tax: 0,
    },
    importService: {
      count: 0,
      taxableValue: 0,
      tax: 0,
    },
    notifiedService: {
      count: 0,
      taxableValue: 0,
      tax: 0,
    },
  };
  
  for (const trans of data.rcmTransactions) {
    const tax = trans.cgst + trans.sgst + trans.igst + trans.cess;
    
    if (trans.vendorType === 'UNREGISTERED') {
      rcmBreakdown.unregistered.count++;
      rcmBreakdown.unregistered.taxableValue += trans.taxableAmount;
      rcmBreakdown.unregistered.tax += tax;
    } else if (trans.vendorType === 'FOREIGN' || trans.serviceType === 'IMPORT_SERVICE') {
      rcmBreakdown.importService.count++;
      rcmBreakdown.importService.taxableValue += trans.taxableAmount;
      rcmBreakdown.importService.tax += tax;
    } else if (trans.serviceType === 'NOTIFIED_SERVICE') {
      rcmBreakdown.notifiedService.count++;
      rcmBreakdown.notifiedService.taxableValue += trans.taxableAmount;
      rcmBreakdown.notifiedService.tax += tax;
    }
  }
  
  return {
    gstin: data.gstin,
    returnPeriod: data.returnPeriod,
    table31d,
    table4B,
    rcmBreakdown,
  };
}

/**
 * Validate GSTR-3B data
 */
export function validateGSTR3B(gstr3b: any): GSTR3BValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check RCM payment matches
  let rcmPaymentMatches = true;
  let rcmMismatchAmount = 0;
  
  if (gstr3b.table31d && gstr3b.paymentRecords) {
    const rcmTaxDeclared = gstr3b.table31d.totalTax;
    const rcmTaxPaid = gstr3b.paymentRecords
      .filter((p: any) => p.type === 'RCM' && p.status === 'PAID')
      .reduce((sum: number, p: any) => sum + p.amount, 0);
    
    if (rcmTaxDeclared !== rcmTaxPaid) {
      rcmPaymentMatches = false;
      rcmMismatchAmount = rcmTaxDeclared - rcmTaxPaid;
      errors.push('RCM payment mismatch');
    }
  }
  
  // Check ITC claims vs RCM paid
  let itcRcmBalanced = true;
  
  if (gstr3b.table31d && gstr3b.table4B) {
    if (gstr3b.table4B.totalITC > gstr3b.table31d.totalTax) {
      itcRcmBalanced = false;
      errors.push('ITC claimed exceeds RCM paid');
    }
  }
  
  // Check for unpaid liabilities
  if (gstr3b.unpaidLiabilities && gstr3b.unpaidLiabilities.length > 0) {
    warnings.push('Unpaid RCM liabilities exist');
  }
  
  const isValid = errors.length === 0;
  
  return {
    isValid,
    errors,
    warnings,
    rcmPaymentMatches,
    rcmMismatchAmount,
    itcRcmBalanced,
  };
}

/**
 * Generate GSTR-3B JSON for filing
 */
export function generateGSTR3BJSON(data: any): any {
  const json: any = {
    gstin: data.gstin,
    ret_period: data.returnPeriod,
    sup_details: {
      isup_rev: {
        txval: data.table31d?.totalTaxableValue || 0,
        iamt: data.table31d?.integratedTax || 0,
        camt: data.table31d?.centralTax || 0,
        samt: data.table31d?.stateTax || 0,
        csamt: data.table31d?.cess || 0,
      },
    },
    itc_elg: {
      itc_rev: [],
    },
  };
  
  // Add ITC details
  if (data.table4B) {
    if (data.table4B.inputs.integratedTax > 0 || 
        data.table4B.inputs.centralTax > 0 || 
        data.table4B.inputs.stateTax > 0) {
      json.itc_elg.itc_rev.push({
        ty: 'IMPG',
        iamt: data.table4B.inputs.integratedTax,
        camt: data.table4B.inputs.centralTax,
        samt: data.table4B.inputs.stateTax,
        csamt: data.table4B.inputs.cess,
      });
    }
    
    if (data.table4B.inputServices.integratedTax > 0 || 
        data.table4B.inputServices.centralTax > 0 || 
        data.table4B.inputServices.stateTax > 0) {
      json.itc_elg.itc_rev.push({
        ty: 'IMPS',
        iamt: data.table4B.inputServices.integratedTax,
        camt: data.table4B.inputServices.centralTax,
        samt: data.table4B.inputServices.stateTax,
        csamt: data.table4B.inputServices.cess,
      });
    }
    
    if (data.table4B.capitalGoods.integratedTax > 0 || 
        data.table4B.capitalGoods.centralTax > 0 || 
        data.table4B.capitalGoods.stateTax > 0) {
      json.itc_elg.itc_rev.push({
        ty: 'IMPCG',
        iamt: data.table4B.capitalGoods.integratedTax,
        camt: data.table4B.capitalGoods.centralTax,
        samt: data.table4B.capitalGoods.stateTax,
        csamt: data.table4B.capitalGoods.cess,
      });
    }
  }
  
  // Round all numbers to 2 decimal places
  const roundObject = (obj: any): any => {
    if (typeof obj === 'number') {
      return Math.round(obj * 100) / 100;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => roundObject(item));
    }
    if (typeof obj === 'object' && obj !== null) {
      const rounded: any = {};
      for (const key in obj) {
        rounded[key] = roundObject(obj[key]);
      }
      return rounded;
    }
    return obj;
  };
  
  return roundObject(json);
}

/**
 * Reconcile GSTR-3B with books
 */
export function reconcileWithBooks(
  gstr3bData: {
    table31d: {
      totalTaxableValue: number;
      totalTax: number;
    };
  },
  booksData: {
    rcmPurchases: number;
    rcmTaxPaid: number;
  }
): {
  matches: boolean;
  taxableValueDifference: number;
  taxDifference: number;
  requiresAdjustment?: boolean;
  suggestedAdjustments?: Array<{
    description: string;
    amount: number;
  }>;
} {
  const taxableValueDifference = gstr3bData.table31d.totalTaxableValue - booksData.rcmPurchases;
  const taxDifference = gstr3bData.table31d.totalTax - booksData.rcmTaxPaid;
  
  const matches = taxableValueDifference === 0 && taxDifference === 0;
  const requiresAdjustment = Math.abs(taxableValueDifference) > 0 || Math.abs(taxDifference) > 0;
  
  const suggestedAdjustments: Array<{ description: string; amount: number }> = [];
  
  if (taxableValueDifference > 0) {
    suggestedAdjustments.push({
      description: 'Possible missing transaction in books',
      amount: taxableValueDifference,
    });
  } else if (taxableValueDifference < 0) {
    suggestedAdjustments.push({
      description: 'Possible missing transaction in GSTR-3B',
      amount: Math.abs(taxableValueDifference),
    });
  }
  
  if (taxDifference > 0) {
    suggestedAdjustments.push({
      description: 'Tax payment not recorded in books',
      amount: taxDifference,
    });
  } else if (taxDifference < 0) {
    suggestedAdjustments.push({
      description: 'Excess tax recorded in books',
      amount: Math.abs(taxDifference),
    });
  }
  
  return {
    matches,
    taxableValueDifference,
    taxDifference,
    requiresAdjustment,
    suggestedAdjustments: suggestedAdjustments.length > 0 ? suggestedAdjustments : undefined,
  };
}