import crypto from 'crypto'

/**
 * E-Invoice Cryptography Utilities
 * Handles AES-256 encryption/decryption for IRP communication
 */

/**
 * Encrypt data using AES-256-ECB (as required by IRP)
 * @param data - Data to encrypt
 * @param key - Base64 encoded session encryption key (SEK)
 * @returns Base64 encoded encrypted data
 */
export function encryptWithAES256(data: string, key: string): string {
  try {
    const keyBuffer = Buffer.from(key, 'base64')
    const cipher = crypto.createCipheriv('aes-256-ecb', keyBuffer, null)
    
    let encrypted = cipher.update(data, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    return encrypted
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data for IRP')
  }
}

/**
 * Decrypt data using AES-256-ECB
 * @param encryptedData - Base64 encoded encrypted data
 * @param key - Base64 encoded session encryption key (SEK)
 * @returns Decrypted string
 */
export function decryptWithAES256(encryptedData: string, key: string): string {
  try {
    const keyBuffer = Buffer.from(key, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuffer, null)
    
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data from IRP')
  }
}

/**
 * Generate SHA256 hash (used for IRN generation)
 * @param data - Data to hash
 * @returns Hex encoded hash
 */
export function generateSHA256Hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Generate Base64 encoded SHA256 hash (for IRN)
 * @param data - Data to hash
 * @returns Base64 encoded hash
 */
export function generateBase64SHA256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('base64')
}

/**
 * Generate IRN hash based on IRP specifications
 * The IRN is a SHA256 hash of concatenated invoice fields
 * @param params - Invoice parameters for IRN generation
 * @returns 64-character IRN
 */
export function generateIRNHash(params: {
  gstin: string
  docType: string
  docNo: string
  docDate: string // Format: DD/MM/YYYY
  docValue: number
  buyerGstin?: string
}): string {
  // Build the string as per IRP specification
  const components = [
    params.gstin,
    params.docType,
    params.docNo,
    params.docDate,
    params.docValue.toFixed(2),
    params.buyerGstin || ''
  ]
  
  const dataToHash = components.join('')
  const hash = generateSHA256Hash(dataToHash)
  
  // IRN is 64 characters
  return hash.padEnd(64, '0')
}

/**
 * Generate OTP hash for authentication
 * @param otp - OTP received
 * @returns Base64 encoded hash
 */
export function generateOTPHash(otp: string): string {
  return Buffer.from(otp).toString('base64')
}

/**
 * Encrypt credentials for storage
 * @param text - Text to encrypt
 * @param secretKey - Encryption key (from environment)
 * @returns Encrypted text with IV
 */
export function encryptCredentials(text: string, secretKey: string): string {
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(secretKey, 'salt', 32)
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Return IV + encrypted data
  return iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypt credentials from storage
 * @param encryptedText - Encrypted text with IV
 * @param secretKey - Encryption key (from environment)
 * @returns Decrypted text
 */
export function decryptCredentials(encryptedText: string, secretKey: string): string {
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(secretKey, 'salt', 32)
  
  const [ivHex, encrypted] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Validate GSTIN checksum
 * @param gstin - GSTIN to validate
 * @returns true if valid
 */
export function validateGSTINChecksum(gstin: string): boolean {
  if (gstin.length !== 15) return false
  
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const factor = 2
  let sum = 0
  let checkCodePoint = 0
  const mod = chars.length
  
  for (let i = gstin.length - 2; i >= 0; i--) {
    const digit = chars.indexOf(gstin[i].toUpperCase())
    if (digit === -1) return false
    
    const addend = factor * digit
    sum += Math.floor(addend / mod) + (addend % mod)
    checkCodePoint = (checkCodePoint + digit) % mod
  }
  
  const checkDigit = (mod - (sum % mod)) % mod
  return chars[checkDigit] === gstin[gstin.length - 1].toUpperCase()
}

/**
 * Generate a random transaction ID for API calls
 * @returns Transaction ID
 */
export function generateTransactionId(): string {
  return `TXN${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`
}