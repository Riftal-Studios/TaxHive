import { z } from 'zod'

/**
 * GSTIN (Goods and Services Tax Identification Number) Format:
 * 15 characters total:
 * - 2 digits: State code
 * - 5 letters: PAN-based (first 3 are entity name, 4th is status, 5th is first letter of surname/name)
 * - 4 digits: Registration number
 * - 1 letter: Entity code
 * - 1 digit: Check digit
 * - 1 letter: Always 'Z'
 * - 1 digit: Checksum digit
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[Z]{1}[0-9A-Z]{1}$/

/**
 * PAN (Permanent Account Number) Format:
 * 10 characters total:
 * - 5 letters: First 3 are sequence, 4th indicates holder type, 5th is first letter of surname/name
 * - 4 digits: Sequential number
 * - 1 letter: Check letter
 */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

// Validation schemas
export const gstinSchema = z
  .string()
  .transform(val => val.trim().toUpperCase())
  .refine(
    val => val === '' || GSTIN_REGEX.test(val),
    {
      message: 'Invalid GSTIN format. Must be 15 characters: 2 digits + 5 letters + 4 digits + 1 letter + 1 digit + Z + 1 checksum',
    }
  )

export const panSchema = z
  .string()
  .transform(val => val.trim().toUpperCase())
  .refine(
    val => val === '' || PAN_REGEX.test(val),
    {
      message: 'Invalid PAN format. Must be 10 characters: 5 letters + 4 digits + 1 letter',
    }
  )

// Helper functions for validation
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin) return true // Empty is valid
  return GSTIN_REGEX.test(gstin.trim().toUpperCase())
}

export function isValidPAN(pan: string): boolean {
  if (!pan) return true // Empty is valid
  return PAN_REGEX.test(pan.trim().toUpperCase())
}

// State codes for GSTIN validation (first 2 digits)
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
}

// PAN holder type codes (4th character)
export const PAN_HOLDER_TYPES: Record<string, string> = {
  'C': 'Company',
  'P': 'Person',
  'H': 'Hindu Undivided Family (HUF)',
  'F': 'Firm',
  'A': 'Association of Persons (AOP)',
  'T': 'Trust',
  'B': 'Body of Individuals (BOI)',
  'L': 'Local Authority',
  'J': 'Artificial Juridical Person',
  'G': 'Government',
}

// Extract state from GSTIN
export function getStateFromGSTIN(gstin: string): string | null {
  if (!isValidGSTIN(gstin)) return null
  const stateCode = gstin.substring(0, 2)
  return GST_STATE_CODES[stateCode] || null
}

// Extract PAN from GSTIN (characters 3-12)
export function getPANFromGSTIN(gstin: string): string | null {
  if (!isValidGSTIN(gstin)) return null
  return gstin.substring(2, 12)
}

// Validate that GSTIN and PAN match (if both provided)
export function validateGSTINPANMatch(gstin: string, pan: string): boolean {
  if (!gstin || !pan) return true // If either is empty, skip validation
  
  const gstinPAN = getPANFromGSTIN(gstin)
  return gstinPAN === pan.trim().toUpperCase()
}