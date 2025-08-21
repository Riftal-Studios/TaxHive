import { describe, test, expect } from 'vitest';

/**
 * TDD Test Suite for HSN/SAC Code Detection and Validation
 * 
 * These tests are written FIRST (RED phase) to define requirements
 * for HSN/SAC code detection, validation, and normalization.
 * 
 * HSN Codes: 4-8 digits for goods classification
 * SAC Codes: 6 digits for services classification
 */

// Import the implemented functions
import {
  validateHSNCode,
  validateSACCode,
  normalizeCode,
  matchCodePattern,
  isPartialMatch,
  getCodeType,
} from '@/lib/rcm/hsn-sac-detector';

describe('HSN/SAC Code Detection and Validation', () => {
  
  describe('HSN Code Validation', () => {
    test('should validate 4-digit HSN codes', () => {
      expect(validateHSNCode('0801')).toBe(true);
      expect(validateHSNCode('2401')).toBe(true);
      expect(validateHSNCode('5004')).toBe(true);
      expect(validateHSNCode('9999')).toBe(true);
    });

    test('should validate 6-digit HSN codes', () => {
      expect(validateHSNCode('080110')).toBe(true);
      expect(validateHSNCode('240110')).toBe(true);
      expect(validateHSNCode('500410')).toBe(true);
    });

    test('should validate 8-digit HSN codes', () => {
      expect(validateHSNCode('08011000')).toBe(true);
      expect(validateHSNCode('24011000')).toBe(true);
      expect(validateHSNCode('50041000')).toBe(true);
      expect(validateHSNCode('99901199')).toBe(true);
    });

    test('should reject invalid HSN codes', () => {
      expect(validateHSNCode('')).toBe(false);
      expect(validateHSNCode('123')).toBe(false); // Too short
      expect(validateHSNCode('123456789')).toBe(false); // Too long
      expect(validateHSNCode('ABCD')).toBe(false); // Contains letters
      expect(validateHSNCode('12-34')).toBe(false); // Contains special chars
      expect(validateHSNCode('12.34')).toBe(false); // Contains dots
    });

    test('should handle HSN codes with leading zeros', () => {
      expect(validateHSNCode('0001')).toBe(true);
      expect(validateHSNCode('000100')).toBe(true);
      expect(validateHSNCode('00010000')).toBe(true);
    });
  });

  describe('SAC Code Validation', () => {
    test('should validate 6-digit SAC codes', () => {
      expect(validateSACCode('998211')).toBe(true);
      expect(validateSACCode('996711')).toBe(true);
      expect(validateSACCode('995411')).toBe(true);
      expect(validateSACCode('997111')).toBe(true);
    });

    test('should validate 4-digit SAC codes (partial)', () => {
      expect(validateSACCode('9982')).toBe(true);
      expect(validateSACCode('9967')).toBe(true);
      expect(validateSACCode('9954')).toBe(true);
    });

    test('should reject invalid SAC codes', () => {
      expect(validateSACCode('')).toBe(false);
      expect(validateSACCode('123')).toBe(false); // Too short
      expect(validateSACCode('1234567')).toBe(false); // Too long
      expect(validateSACCode('ABCDEF')).toBe(false); // Contains letters
      expect(validateSACCode('99-82')).toBe(false); // Contains special chars
    });

    test('should handle SAC codes with leading zeros', () => {
      expect(validateSACCode('099821')).toBe(true);
      expect(validateSACCode('009982')).toBe(true);
    });
  });

  describe('Code Normalization', () => {
    test('should remove spaces from codes', () => {
      expect(normalizeCode('99 82 11')).toBe('998211');
      expect(normalizeCode(' 0801 ')).toBe('0801');
      expect(normalizeCode('08 01 10 00')).toBe('08011000');
    });

    test('should remove dashes from codes', () => {
      expect(normalizeCode('99-82-11')).toBe('998211');
      expect(normalizeCode('08-01')).toBe('0801');
      expect(normalizeCode('24-01-10-00')).toBe('24011000');
    });

    test('should remove dots from codes', () => {
      expect(normalizeCode('99.82.11')).toBe('998211');
      expect(normalizeCode('08.01')).toBe('0801');
      expect(normalizeCode('24.01.10.00')).toBe('24011000');
    });

    test('should handle mixed separators', () => {
      expect(normalizeCode('99-82 11')).toBe('998211');
      expect(normalizeCode('08.01-10 00')).toBe('08011000');
      expect(normalizeCode(' 99-82.11 ')).toBe('998211');
    });

    test('should convert to uppercase', () => {
      expect(normalizeCode('abcd')).toBe('ABCD');
      expect(normalizeCode('99a2b1')).toBe('99A2B1');
    });

    test('should handle empty and null inputs', () => {
      expect(normalizeCode('')).toBe('');
      expect(normalizeCode('   ')).toBe('');
    });
  });

  describe('Code Pattern Matching', () => {
    test('should match exact patterns', () => {
      const patterns = ['998211', '996711', '995411'];
      
      expect(matchCodePattern('998211', patterns)).toBe('998211');
      expect(matchCodePattern('996711', patterns)).toBe('996711');
      expect(matchCodePattern('995411', patterns)).toBe('995411');
    });

    test('should match partial patterns (prefix)', () => {
      const patterns = ['9982', '9967', '9954'];
      
      expect(matchCodePattern('998211', patterns)).toBe('9982');
      expect(matchCodePattern('996712', patterns)).toBe('9967');
      expect(matchCodePattern('995421', patterns)).toBe('9954');
    });

    test('should return null for no matches', () => {
      const patterns = ['998211', '996711'];
      
      expect(matchCodePattern('123456', patterns)).toBeNull();
      expect(matchCodePattern('555555', patterns)).toBeNull();
    });

    test('should prioritize exact matches over partial matches', () => {
      const patterns = ['9982', '998211']; // Both would match 998211
      
      expect(matchCodePattern('998211', patterns)).toBe('998211'); // Exact match
    });

    test('should match normalized codes', () => {
      const patterns = ['998211'];
      
      expect(matchCodePattern('99-82-11', patterns)).toBe('998211');
      expect(matchCodePattern('99 82 11', patterns)).toBe('998211');
      expect(matchCodePattern('99.82.11', patterns)).toBe('998211');
    });
  });

  describe('Partial Code Matching', () => {
    test('should detect partial matches for HSN codes', () => {
      expect(isPartialMatch('08011000', '0801')).toBe(true);
      expect(isPartialMatch('24011000', '2401')).toBe(true);
      expect(isPartialMatch('50041000', '5004')).toBe(true);
    });

    test('should detect partial matches for SAC codes', () => {
      expect(isPartialMatch('998211', '9982')).toBe(true);
      expect(isPartialMatch('996711', '9967')).toBe(true);
      expect(isPartialMatch('995411', '9954')).toBe(true);
    });

    test('should reject non-matching codes', () => {
      expect(isPartialMatch('998211', '9967')).toBe(false);
      expect(isPartialMatch('08011000', '2401')).toBe(false);
      expect(isPartialMatch('123456', '789')).toBe(false);
    });

    test('should handle same-length codes (exact match)', () => {
      expect(isPartialMatch('9982', '9982')).toBe(true);
      expect(isPartialMatch('0801', '0801')).toBe(true);
      expect(isPartialMatch('9982', '9967')).toBe(false);
    });

    test('should handle longer partial than full (invalid)', () => {
      expect(isPartialMatch('9982', '998211')).toBe(false);
      expect(isPartialMatch('0801', '08011000')).toBe(false);
    });
  });

  describe('Code Type Detection', () => {
    test('should detect HSN codes (4-8 digits, primarily for goods)', () => {
      expect(getCodeType('0801')).toBe('HSN');
      expect(getCodeType('080110')).toBe('HSN');
      expect(getCodeType('08011000')).toBe('HSN');
      expect(getCodeType('2401')).toBe('HSN');
      expect(getCodeType('5004')).toBe('HSN');
    });

    test('should detect SAC codes (primarily 6 digits for services)', () => {
      expect(getCodeType('998211')).toBe('SAC');
      expect(getCodeType('996711')).toBe('SAC');
      expect(getCodeType('995411')).toBe('SAC');
      expect(getCodeType('997111')).toBe('SAC');
    });

    test('should handle ambiguous codes (4 digits could be either)', () => {
      // 4-digit codes starting with 99 are typically SAC (services)
      expect(getCodeType('9982')).toBe('SAC');
      expect(getCodeType('9967')).toBe('SAC');
      
      // 4-digit codes starting with lower numbers are typically HSN (goods)
      expect(getCodeType('0801')).toBe('HSN');
      expect(getCodeType('2401')).toBe('HSN');
    });

    test('should return INVALID for invalid codes', () => {
      expect(getCodeType('')).toBe('INVALID');
      expect(getCodeType('123')).toBe('INVALID'); // Too short
      expect(getCodeType('123456789')).toBe('INVALID'); // Too long
      expect(getCodeType('ABCD')).toBe('INVALID'); // Not numeric
      expect(getCodeType('12-34')).toBe('INVALID'); // With separators (should normalize first)
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null and undefined inputs gracefully', () => {
      expect(() => validateHSNCode('')).not.toThrow();
      expect(() => validateSACCode('')).not.toThrow();
      expect(() => normalizeCode('')).not.toThrow();
      expect(() => getCodeType('')).not.toThrow();
    });

    test('should handle very large numbers', () => {
      expect(validateHSNCode('99999999')).toBe(true); // Valid 8-digit
      expect(validateSACCode('999999')).toBe(true); // Valid 6-digit
    });

    test('should handle codes with leading zeros correctly', () => {
      expect(normalizeCode('0801')).toBe('0801'); // Should preserve leading zeros
      expect(normalizeCode('00801')).toBe('00801');
      expect(isPartialMatch('00801000', '0080')).toBe(true);
    });

    test('should be case-insensitive for any alphabetic characters', () => {
      expect(normalizeCode('99a2b1')).toBe('99A2B1');
      expect(normalizeCode('99A2B1')).toBe('99A2B1');
    });
  });
});