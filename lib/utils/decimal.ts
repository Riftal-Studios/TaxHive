/**
 * Safely converts a value that might be a Prisma Decimal or a regular number to a number
 * @param value - The value to convert (could be Decimal or number)
 * @returns The numeric value
 */
export function toSafeNumber(value: unknown): number {
  // Check if the value is a Prisma Decimal object with toNumber method
  if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  
  // Otherwise, convert to number
  return Number(value)
}