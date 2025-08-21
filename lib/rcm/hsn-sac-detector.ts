/**
 * RCM Phase 2: HSN/SAC Code Detection and Validation
 * 
 * Validates, normalizes, and matches HSN/SAC codes for RCM detection.
 * 
 * HSN Codes: 4-8 digits for goods classification
 * SAC Codes: 6 digits for services classification (can be 4 digits partial)
 * 
 * This implementation is part of TDD GREEN phase - making tests pass.
 */

/**
 * Validates HSN (Harmonized System of Nomenclature) codes for goods
 * HSN codes can be 4, 6, or 8 digits
 * Validates the original format - does not normalize
 */
export function validateHSNCode(hsnCode: string): boolean {
  if (!hsnCode || typeof hsnCode !== 'string') {
    return false;
  }
  
  const trimmed = hsnCode.trim();
  
  // Empty after trimming
  if (!trimmed) {
    return false;
  }
  
  // Check if it's purely numeric (no special characters)
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }
  
  // Check length (4, 6, or 8 digits)
  const length = trimmed.length;
  return length === 4 || length === 6 || length === 8;
}

/**
 * Validates SAC (Services Accounting Code) codes for services
 * SAC codes are typically 6 digits, but can be 4 digits for partial matches
 * Validates the original format - does not normalize
 */
export function validateSACCode(sacCode: string): boolean {
  if (!sacCode || typeof sacCode !== 'string') {
    return false;
  }
  
  const trimmed = sacCode.trim();
  
  // Empty after trimming
  if (!trimmed) {
    return false;
  }
  
  // Check if it's purely numeric (no special characters)
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }
  
  // Check length (4 or 6 digits)
  const length = trimmed.length;
  return length === 4 || length === 6;
}

/**
 * Normalizes HSN/SAC codes by removing spaces, dashes, dots and converting to uppercase
 */
export function normalizeCode(code: string): string {
  if (!code || typeof code !== 'string') {
    return '';
  }
  
  return code
    .trim()
    .replace(/[\s\-\.]/g, '') // Remove spaces, dashes, and dots
    .toUpperCase();
}

/**
 * Matches a code against a list of patterns, supporting both exact and partial matches
 * Returns the matched pattern or null if no match found
 */
export function matchCodePattern(code: string, patterns: string[]): string | null {
  if (!code || !Array.isArray(patterns) || patterns.length === 0) {
    return null;
  }
  
  const normalizedCode = normalizeCode(code);
  
  if (!normalizedCode) {
    return null;
  }
  
  // First, try exact matches (highest priority)
  for (const pattern of patterns) {
    const normalizedPattern = normalizeCode(pattern);
    if (normalizedCode === normalizedPattern) {
      return normalizedPattern;
    }
  }
  
  // Then, try partial matches (prefix matching)
  for (const pattern of patterns) {
    const normalizedPattern = normalizeCode(pattern);
    if (normalizedCode.startsWith(normalizedPattern) || normalizedPattern.startsWith(normalizedCode)) {
      // Return the shorter one (the pattern that matched)
      return normalizedCode.length <= normalizedPattern.length ? normalizedCode : normalizedPattern;
    }
  }
  
  return null;
}

/**
 * Checks if a full code partially matches a pattern (prefix matching)
 */
export function isPartialMatch(fullCode: string, partialCode: string): boolean {
  if (!fullCode || !partialCode) {
    return false;
  }
  
  const normalizedFull = normalizeCode(fullCode);
  const normalizedPartial = normalizeCode(partialCode);
  
  if (!normalizedFull || !normalizedPartial) {
    return false;
  }
  
  // Check if partial is actually shorter or same length
  if (normalizedPartial.length > normalizedFull.length) {
    return false;
  }
  
  // Check if full code starts with partial code
  return normalizedFull.startsWith(normalizedPartial);
}

/**
 * Determines the type of code (HSN for goods, SAC for services)
 * Based on code patterns and length
 * Validates the original format first, then normalizes for analysis
 */
export function getCodeType(code: string): 'HSN' | 'SAC' | 'INVALID' {
  if (!code || typeof code !== 'string') {
    return 'INVALID';
  }
  
  const trimmed = code.trim();
  
  // Empty after trimming
  if (!trimmed) {
    return 'INVALID';
  }
  
  // For validation, check if it's already in clean format
  const isCleanFormat = /^\d+$/.test(trimmed);
  if (!isCleanFormat) {
    return 'INVALID';
  }
  
  const length = trimmed.length;
  
  // Invalid length
  if (length < 4 || length > 8) {
    return 'INVALID';
  }
  
  // 6-digit codes: check prefix to determine type
  if (length === 6) {
    const prefix = trimmed.substring(0, 2);
    const prefixNum = parseInt(prefix, 10);
    
    // SAC codes typically start with 99 (services)
    if (prefixNum >= 99) {
      return 'SAC';
    }
    
    // Lower numbers are typically HSN (goods) - even for 6-digit codes
    return 'HSN';
  }
  
  // 4-digit codes: check prefix to determine type
  if (length === 4) {
    const prefix = trimmed.substring(0, 2);
    const prefixNum = parseInt(prefix, 10);
    
    // SAC codes typically start with 99 (services)
    if (prefixNum >= 99) {
      return 'SAC';
    }
    
    // Lower numbers are typically HSN (goods)
    return 'HSN';
  }
  
  // 8-digit codes are typically HSN (goods)
  if (length === 8) {
    return 'HSN';
  }
  
  // Default to HSN for other valid lengths
  return 'HSN';
}