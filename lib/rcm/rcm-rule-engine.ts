/**
 * RCM Phase 2: Rule Engine for Notified Services and Goods
 * 
 * Core engine that matches HSN/SAC codes against notified RCM rules
 * with priority handling and date validation.
 * 
 * This implementation is part of TDD GREEN phase - making tests pass.
 */

import { getNotifiedRules, type NotifiedRule, validateRCMRule } from './notified-list-registry';
import { normalizeCode, matchCodePattern, getCodeType } from './hsn-sac-detector';

export interface RCMRuleMatch {
  rule: NotifiedRule;
  matchedCode: string;
  isApplicable: boolean;
  reason: string;
}

/**
 * Matches a service SAC code against notified services registry
 */
export function matchNotifiedService(sacCode: string, vendorGSTIN?: string | null): RCMRuleMatch | null {
  if (!sacCode || typeof sacCode !== 'string') {
    return null;
  }
  
  const normalizedCode = normalizeCode(sacCode);
  if (!normalizedCode) {
    return null;
  }
  
  // Validate that this is a valid SAC code
  const codeType = getCodeType(normalizedCode);
  if (codeType === 'INVALID') {
    return null;
  }
  
  // Get all active notified service rules
  const serviceRules = getNotifiedRules().filter(rule => rule.ruleType === 'SERVICE');
  
  // Sort by priority (highest first), then by effective date (newest first)
  const sortedRules = serviceRules.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime(); // Newer first
  });
  
  // Find matching rule
  for (const rule of sortedRules) {
    if (!validateRCMRule(rule)) {
      continue;
    }
    
    const matchedPattern = matchCodePattern(normalizedCode, rule.hsnSacCodes);
    if (matchedPattern) {
      return {
        rule,
        matchedCode: normalizedCode,
        isApplicable: true,
        reason: `RCM applicable for notified service: ${rule.description}`,
      };
    }
  }
  
  return null;
}

/**
 * Matches a goods HSN code against notified goods registry
 */
export function matchNotifiedGoods(hsnCode: string, vendorGSTIN?: string | null): RCMRuleMatch | null {
  if (!hsnCode || typeof hsnCode !== 'string') {
    return null;
  }
  
  const normalizedCode = normalizeCode(hsnCode);
  if (!normalizedCode) {
    return null;
  }
  
  // Validate that this is a valid HSN code
  const codeType = getCodeType(normalizedCode);
  if (codeType === 'INVALID') {
    return null;
  }
  
  // Get all active notified goods rules
  const goodsRules = getNotifiedRules().filter(rule => rule.ruleType === 'GOODS');
  
  // Sort by priority (highest first), then by effective date (newest first)
  const sortedRules = goodsRules.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime(); // Newer first
  });
  
  // Find matching rule
  for (const rule of sortedRules) {
    if (!validateRCMRule(rule)) {
      continue;
    }
    
    const matchedPattern = matchCodePattern(normalizedCode, rule.hsnSacCodes);
    if (matchedPattern) {
      return {
        rule,
        matchedCode: normalizedCode,
        isApplicable: true,
        reason: `RCM applicable for notified goods: ${rule.description}`,
      };
    }
  }
  
  return null;
}

/**
 * Main RCM rule matching function that checks both services and goods
 */
export function matchRCMRule(hsnSacCode: string, vendorGSTIN?: string | null): RCMRuleMatch | null {
  if (!hsnSacCode) {
    return null;
  }
  
  const normalizedCode = normalizeCode(hsnSacCode);
  const codeType = getCodeType(normalizedCode);
  
  if (codeType === 'INVALID') {
    return null;
  }
  
  // Try services first (higher priority in most cases)
  if (codeType === 'SAC') {
    const serviceMatch = matchNotifiedService(normalizedCode, vendorGSTIN);
    if (serviceMatch) {
      return serviceMatch;
    }
  }
  
  // Try goods
  if (codeType === 'HSN') {
    const goodsMatch = matchNotifiedGoods(normalizedCode, vendorGSTIN);
    if (goodsMatch) {
      return goodsMatch;
    }
  }
  
  // If code type is ambiguous (4 digits), try both
  if (codeType === 'SAC' || codeType === 'HSN') {
    // Try the opposite type if primary didn't match
    if (codeType === 'SAC') {
      const goodsMatch = matchNotifiedGoods(normalizedCode, vendorGSTIN);
      if (goodsMatch) {
        return goodsMatch;
      }
    } else {
      const serviceMatch = matchNotifiedService(normalizedCode, vendorGSTIN);
      if (serviceMatch) {
        return serviceMatch;
      }
    }
  }
  
  return null;
}

/**
 * Check if RCM rule is effective on a given date
 */
export function isRuleEffective(rule: NotifiedRule, referenceDate?: Date): boolean {
  const checkDate = referenceDate || new Date();
  
  // Check if rule is active
  if (!rule.isActive) {
    return false;
  }
  
  // Check effective from date
  if (rule.effectiveFrom > checkDate) {
    return false;
  }
  
  // Check effective to date (if provided)
  if (rule.effectiveTo && rule.effectiveTo < checkDate) {
    return false;
  }
  
  return true;
}

/**
 * Get rules that are effective on a specific date
 */
export function getRulesEffectiveOn(date: Date, category?: string): NotifiedRule[] {
  const allRules = getNotifiedRules();
  
  return allRules.filter(rule => {
    if (category && rule.category !== category) {
      return false;
    }
    
    return isRuleEffective(rule, date);
  });
}

/**
 * Get active rules (no expiry or future expiry)
 */
export function getActiveRules(category?: string): NotifiedRule[] {
  return getRulesEffectiveOn(new Date(), category);
}

/**
 * Get rules within a date range
 */
export function getRulesByDateRange(startDate: Date, endDate: Date): NotifiedRule[] {
  const allRules = getNotifiedRules();
  
  return allRules.filter(rule => {
    const ruleEnd = rule.effectiveTo || new Date('2030-12-31');
    
    // Rule should be effective sometime within the date range
    return rule.effectiveFrom <= endDate && ruleEnd >= startDate;
  });
}

/**
 * Validate rule effective dates
 */
export function validateRuleEffectiveDates(rule: NotifiedRule): boolean {
  try {
    // Check effectiveFrom
    if (!rule.effectiveFrom || !(rule.effectiveFrom instanceof Date)) {
      return false;
    }
    
    if (isNaN(rule.effectiveFrom.getTime())) {
      return false;
    }
    
    // Check effectiveTo (if provided)
    if (rule.effectiveTo) {
      if (!(rule.effectiveTo instanceof Date)) {
        return false;
      }
      
      if (isNaN(rule.effectiveTo.getTime())) {
        return false;
      }
      
      // effectiveTo must be after effectiveFrom
      if (rule.effectiveTo <= rule.effectiveFrom) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Sort rules by priority and effective date
 */
export function sortRulesByPriority(rules: NotifiedRule[], referenceDate?: Date): NotifiedRule[] {
  return rules
    .filter(rule => referenceDate ? isRuleEffective(rule, referenceDate) : rule.isActive)
    .sort((a, b) => {
      // Primary sort: Priority (higher first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // Secondary sort: Effective date (newer first)
      return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
    });
}

/**
 * Get latest notification date for a specific HSN/SAC code
 */
export function getLatestNotificationDate(hsnSacCode: string): Date | null {
  const normalizedCode = normalizeCode(hsnSacCode);
  if (!normalizedCode) {
    return null;
  }
  
  const allRules = getNotifiedRules();
  const matchingRules = allRules.filter(rule => 
    rule.hsnSacCodes.some(code => 
      normalizeCode(code).startsWith(normalizedCode) || 
      normalizedCode.startsWith(normalizeCode(code))
    )
  );
  
  if (matchingRules.length === 0) {
    return null;
  }
  
  // Return the latest effective date
  return matchingRules
    .map(rule => rule.effectiveFrom)
    .sort((a, b) => b.getTime() - a.getTime())[0];
}