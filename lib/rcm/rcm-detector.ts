/**
 * RCM (Reverse Charge Mechanism) Detection Logic
 * 
 * Detects when RCM is applicable based on:
 * - Phase 1: Vendor registration status, Import of services
 * - Phase 2: Notified goods/services under RCM (NEW)
 * 
 * Priority Order: NOTIFIED > IMPORT > UNREGISTERED
 * 
 * Implementation follows TDD methodology - making tests pass (GREEN phase)
 */

import { detectKnownSupplier } from './foreign-supplier-registry';
import { matchRCMRule } from './rcm-rule-engine';

export interface RCMDetectionInput {
  vendorGSTIN: string | null;
  vendorName?: string;
  vendorCountry: string;
  placeOfSupply: string | null;
  recipientGSTIN: string | null;
  recipientState: string;
  serviceType: string;
  hsnSacCode?: string; // NEW: HSN/SAC code for notified services/goods detection
  taxableAmount: number;
  isCompositionVendor?: boolean;
}

export interface RCMDetectionResult {
  isRCMApplicable: boolean;
  rcmType: 'UNREGISTERED' | 'IMPORT_SERVICE' | 'NOTIFIED_SERVICE' | 'NOTIFIED_GOODS' | null;
  taxType: 'CGST_SGST' | 'IGST' | null;
  gstRate: number;
  reason: string;
  matchedRule?: {
    id: string;
    description: string;
    notificationNo?: string;
    effectiveFrom: Date;
  }; // NEW: Matched rule information for notified services/goods
  knownSupplier?: boolean;
  supplierCode?: string;
  defaultHSN?: string;
}

/**
 * Validates GSTIN format
 */
function isValidGSTIN(gstin: string | null): boolean {
  if (!gstin || gstin.trim() === '') return false;
  
  // GSTIN format: 2 digit state code + 10 character PAN + 1 check digit + Z + check digit
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.trim());
}

/**
 * Determines if supply is intra-state or inter-state
 */
function getTaxType(placeOfSupply: string, recipientState: string): 'CGST_SGST' | 'IGST' {
  if (placeOfSupply === 'OUTSIDE_INDIA') {
    return 'IGST';
  }
  
  // Extract state codes for comparison
  const cleanPlaceOfSupply = placeOfSupply.toUpperCase().trim();
  const cleanRecipientState = recipientState.toUpperCase().trim();
  
  return cleanPlaceOfSupply === cleanRecipientState ? 'CGST_SGST' : 'IGST';
}

/**
 * Gets GST rate based on service type
 */
function getGSTRate(serviceType: string): number {
  // Most services are at 18% GST rate in India
  const serviceRateMap: Record<string, number> = {
    'SOFTWARE': 18,
    'CONSULTING': 18,
    'CLOUD': 18,
    'PROFESSIONAL': 18,
    'TECHNICAL': 18,
    'MANAGEMENT': 18,
  };
  
  return serviceRateMap[serviceType.toUpperCase()] || 18;
}

/**
 * Main RCM detection function with Phase 2 integration
 * Priority Order: NOTIFIED > IMPORT > UNREGISTERED
 */
export function detectRCM(input: RCMDetectionInput): RCMDetectionResult {
  // Input validation
  if (!input.recipientGSTIN) {
    throw new Error('Recipient GSTIN is required');
  }
  
  if (!input.placeOfSupply) {
    throw new Error('Place of supply is required');
  }
  
  if (input.taxableAmount <= 0) {
    throw new Error('Taxable amount must be greater than 0');
  }
  
  const result: RCMDetectionResult = {
    isRCMApplicable: false,
    rcmType: null,
    taxType: null,
    gstRate: getGSTRate(input.serviceType),
    reason: '',
    knownSupplier: false,
  };
  
  // PRIORITY 1: Check for notified services/goods (HIGHEST PRIORITY)
  if (input.hsnSacCode) {
    try {
      const ruleMatch = matchRCMRule(input.hsnSacCode, input.vendorGSTIN);
      if (ruleMatch && ruleMatch.isApplicable) {
        result.isRCMApplicable = true;
        result.rcmType = ruleMatch.rule.ruleType === 'SERVICE' ? 'NOTIFIED_SERVICE' : 'NOTIFIED_GOODS';
        result.gstRate = ruleMatch.rule.gstRate;
        result.reason = ruleMatch.reason;
        result.matchedRule = {
          id: ruleMatch.rule.id,
          description: ruleMatch.rule.description,
          notificationNo: ruleMatch.rule.notificationNo,
          effectiveFrom: ruleMatch.rule.effectiveFrom,
        };
        
        // Determine tax type based on place of supply
        result.taxType = getTaxType(input.placeOfSupply, input.recipientState);
        
        return result;
      }
    } catch (error) {
      // Continue to next priority if notified rule matching fails
      console.warn('Error matching notified RCM rules:', error);
    }
  }
  
  // PRIORITY 2: Check for import of services
  if (input.vendorCountry.toUpperCase() !== 'INDIA' || input.placeOfSupply === 'OUTSIDE_INDIA') {
    result.isRCMApplicable = true;
    result.rcmType = 'IMPORT_SERVICE';
    result.taxType = 'IGST'; // Always IGST for imports
    result.reason = 'RCM applicable for import of services from foreign vendor';
    
    // Check if it's a known foreign supplier
    if (input.vendorName) {
      try {
        const supplierResult = detectKnownSupplier({
          name: input.vendorName,
          country: input.vendorCountry,
          serviceType: input.serviceType,
        });
        
        if (supplierResult.isKnownSupplier) {
          result.knownSupplier = true;
          result.supplierCode = supplierResult.supplierCode || undefined;
          result.defaultHSN = supplierResult.defaultHSN;
        }
      } catch {
        // Ignore errors in known supplier detection, continue with basic RCM detection
      }
    }
    
    return result;
  }
  
  // PRIORITY 3: Check for unregistered domestic vendor or composition scheme vendor
  const hasValidGSTIN = isValidGSTIN(input.vendorGSTIN);
  const isComposition = input.isCompositionVendor || false;
  
  if (!hasValidGSTIN || isComposition) {
    result.isRCMApplicable = true;
    result.rcmType = 'UNREGISTERED';
    result.taxType = getTaxType(input.placeOfSupply, input.recipientState);
    
    if (!hasValidGSTIN && input.vendorGSTIN) {
      result.reason = 'RCM applicable for unregistered vendor (invalid GSTIN format)';
    } else if (isComposition) {
      result.reason = 'RCM applicable for composition scheme vendor';
    } else {
      result.reason = 'RCM applicable for unregistered vendor (no GSTIN)';
    }
    
    return result;
  }
  
  // If we reach here, vendor is registered and domestic with no notified rules - no RCM applicable
  result.reason = 'No RCM applicable for registered vendor with valid GSTIN';
  return result;
}

/**
 * Helper function to check if RCM applies to a specific HSN/SAC code
 * This can be extended for notified goods/services
 */
export function isNotifiedForRCM(hsnSacCode: string): boolean {
  // List of HSN/SAC codes where RCM is applicable
  // This is a simplified list - in practice, this would be maintained based on GST notifications
  const notifiedCodes = [
    // Add specific HSN/SAC codes that fall under RCM as per GST notifications
    // For now, returning false as Phase 1 focuses on unregistered vendors and imports
  ];
  
  return notifiedCodes.includes(hsnSacCode);
}

/**
 * Checks if vendor is eligible for composition scheme
 */
export function isCompositionEligible(turnover: number, businessType: string): boolean {
  // Composition scheme eligibility criteria
  const maxTurnover = businessType === 'GOODS' ? 150_00_000 : 50_00_000; // 1.5 cr for goods, 50L for services
  return turnover <= maxTurnover;
}

/**
 * Gets the applicable RCM rate based on transaction type and service
 */
export function getRCMRate(rcmType: string, serviceType: string): number {
  // Most RCM transactions are at standard GST rates
  switch (rcmType) {
    case 'UNREGISTERED':
    case 'IMPORT_SERVICE':
      return getGSTRate(serviceType);
    case 'NOTIFIED_SERVICE':
    case 'NOTIFIED_GOODS':
      // These might have different rates based on specific notifications
      return getGSTRate(serviceType);
    default:
      return 18; // Default rate
  }
}