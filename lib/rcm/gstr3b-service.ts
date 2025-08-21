/**
 * GSTR-3B Service
 * 
 * Database operations for GSTR-3B preparation and filing with RCM data.
 */

import { PrismaClient } from '@prisma/client';
import { 
  prepareGSTR3BWithRCM, 
  validateGSTR3B as validateGSTR3BData,
  generateGSTR3BJSON,
  getReturnPeriod 
} from './gstr3b-integration';

const prisma = new PrismaClient();

/**
 * Prepare GSTR-3B with RCM data
 */
export async function prepareGSTR3B(input: {
  gstin: string;
  returnPeriod: string;
  month: number;
  year: number;
}) {
  // Get RCM transactions for the period
  const startDate = new Date(input.year, input.month - 1, 1);
  const endDate = new Date(input.year, input.month, 0);
  
  const rcmLiabilities = await prisma.rCMPaymentLiability.findMany({
    where: {
      userId: 'test-user', // Would come from context
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });
  
  // Calculate aggregates
  const rcmBreakdown = {
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
  
  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalCess = 0;
  
  for (const liability of rcmLiabilities) {
    const taxableAmount = Number(liability.taxableAmount);
    const cgst = Number(liability.cgst);
    const sgst = Number(liability.sgst);
    const igst = Number(liability.igst);
    const cess = Number(liability.cess);
    const totalTax = cgst + sgst + igst + cess;
    
    totalTaxableValue += taxableAmount;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    totalCess += cess;
    
    if (liability.rcmType === 'UNREGISTERED') {
      rcmBreakdown.unregistered.count++;
      rcmBreakdown.unregistered.taxableValue += taxableAmount;
      rcmBreakdown.unregistered.tax += totalTax;
    } else if (liability.rcmType === 'IMPORT_SERVICE') {
      rcmBreakdown.importService.count++;
      rcmBreakdown.importService.taxableValue += taxableAmount;
      rcmBreakdown.importService.tax += totalTax;
    } else if (liability.rcmType === 'NOTIFIED_SERVICE') {
      rcmBreakdown.notifiedService.count++;
      rcmBreakdown.notifiedService.taxableValue += taxableAmount;
      rcmBreakdown.notifiedService.tax += totalTax;
    }
  }
  
  // Calculate ITC on RCM (only for paid liabilities)
  const paidLiabilities = rcmLiabilities.filter(l => 
    l.status === 'PAID' && l.itcEligible
  );
  
  const itcByCategory = {
    inputs: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    inputServices: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    capitalGoods: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
  };
  
  let ineligibleITC = 0;
  
  for (const liability of paidLiabilities) {
    const category = liability.itcCategory || 'INPUT_SERVICES';
    const target = 
      category === 'INPUTS' ? itcByCategory.inputs :
      category === 'CAPITAL_GOODS' ? itcByCategory.capitalGoods :
      itcByCategory.inputServices;
    
    if (liability.itcEligible) {
      target.cgst += Number(liability.cgst);
      target.sgst += Number(liability.sgst);
      target.igst += Number(liability.igst);
      target.cess += Number(liability.cess);
    } else {
      ineligibleITC += Number(liability.totalGST);
    }
  }
  
  const totalITC = 
    itcByCategory.inputs.cgst + itcByCategory.inputs.sgst + itcByCategory.inputs.igst +
    itcByCategory.inputServices.cgst + itcByCategory.inputServices.sgst + itcByCategory.inputServices.igst +
    itcByCategory.capitalGoods.cgst + itcByCategory.capitalGoods.sgst + itcByCategory.capitalGoods.igst;
  
  // Check for unpaid liabilities
  const unpaidLiabilities = rcmLiabilities.filter(l => l.status !== 'PAID');
  
  return {
    gstin: input.gstin,
    returnPeriod: input.returnPeriod,
    table31d: {
      totalTaxableValue,
      integratedTax: totalIgst,
      centralTax: totalCgst,
      stateTax: totalSgst,
      cess: totalCess,
      totalTax: totalCgst + totalSgst + totalIgst + totalCess,
      description: 'Inward supplies from unregistered persons liable to reverse charge',
    },
    table4B: {
      inputs: itcByCategory.inputs,
      inputServices: itcByCategory.inputServices,
      capitalGoods: itcByCategory.capitalGoods,
      totalITC,
      ineligibleITC,
    },
    rcmBreakdown,
    unpaidLiabilities: unpaidLiabilities.length > 0 ? unpaidLiabilities : undefined,
  };
}

/**
 * Validate GSTR-3B data
 */
export async function validateGSTR3BData(gstr3b: any) {
  // Basic validation
  const validation = validateGSTR3BData(gstr3b);
  
  // Additional database validation
  if (gstr3b.unpaidLiabilities && gstr3b.unpaidLiabilities.length > 0) {
    validation.errors = validation.errors || [];
    validation.errors.push('Unpaid RCM liabilities exist');
    validation.isValid = false;
  }
  
  return validation;
}

/**
 * File GSTR-3B
 */
export async function fileGSTR3B(input: {
  returnPeriod: string;
  gstin: string;
  gstr3bData: any;
}) {
  // Save to database
  const filing = await prisma.gSTR3BFiling.create({
    data: {
      returnPeriod: input.returnPeriod,
      month: parseInt(input.returnPeriod.substring(0, 2)),
      year: parseInt(input.returnPeriod.substring(2)),
      gstin: input.gstin,
      filingStatus: 'FILED',
      filedDate: new Date(),
      table31d_taxableValue: input.gstr3bData.table31d?.totalTaxableValue || 0,
      table31d_igst: input.gstr3bData.table31d?.integratedTax || 0,
      table31d_cgst: input.gstr3bData.table31d?.centralTax || 0,
      table31d_sgst: input.gstr3bData.table31d?.stateTax || 0,
      table31d_cess: input.gstr3bData.table31d?.cess || 0,
      table4B_inputs_igst: input.gstr3bData.table4B?.inputs?.integratedTax || 0,
      table4B_inputs_cgst: input.gstr3bData.table4B?.inputs?.centralTax || 0,
      table4B_inputs_sgst: input.gstr3bData.table4B?.inputs?.stateTax || 0,
      table4B_inputs_cess: input.gstr3bData.table4B?.inputs?.cess || 0,
      table4B_inputServices_igst: input.gstr3bData.table4B?.inputServices?.integratedTax || 0,
      table4B_inputServices_cgst: input.gstr3bData.table4B?.inputServices?.centralTax || 0,
      table4B_inputServices_sgst: input.gstr3bData.table4B?.inputServices?.stateTax || 0,
      table4B_inputServices_cess: input.gstr3bData.table4B?.inputServices?.cess || 0,
      table4B_capitalGoods_igst: input.gstr3bData.table4B?.capitalGoods?.integratedTax || 0,
      table4B_capitalGoods_cgst: input.gstr3bData.table4B?.capitalGoods?.centralTax || 0,
      table4B_capitalGoods_sgst: input.gstr3bData.table4B?.capitalGoods?.stateTax || 0,
      table4B_capitalGoods_cess: input.gstr3bData.table4B?.capitalGoods?.cess || 0,
      totalRCMTax: input.gstr3bData.table31d?.totalTax || 0,
      totalRCMITC: input.gstr3bData.table4B?.totalITC || 0,
      jsonData: generateGSTR3BJSON(input.gstr3bData),
      userId: 'test-user', // Would come from context
    },
  });
  
  // Mark liabilities as included in return
  await prisma.rCMPaymentLiability.updateMany({
    where: {
      userId: 'test-user',
      returnPeriod: null,
    },
    data: {
      returnPeriod: input.returnPeriod,
      includedInGSTR3B: true,
    },
  });
  
  return filing;
}