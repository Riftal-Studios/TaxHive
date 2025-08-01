import { randomBytes } from 'crypto'

/**
 * Generate a secure random token
 * @param length - Length of the token in bytes (default: 32)
 * @returns URL-safe base64 encoded token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length)
    .toString('base64url') // URL-safe base64 encoding
}

/**
 * Generate a token expiration date
 * @param days - Number of days until expiration (default: 90)
 * @returns Date object for token expiration
 */
export function getTokenExpirationDate(days: number = 90): Date {
  const expirationDate = new Date()
  expirationDate.setDate(expirationDate.getDate() + days)
  return expirationDate
}

/**
 * Check if a token has expired
 * @param expiresAt - Token expiration date
 * @returns Boolean indicating if token has expired
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false // No expiration means never expires
  return new Date() > new Date(expiresAt)
}