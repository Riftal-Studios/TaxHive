import { db } from '@/server/db'
import { GSP_PROVIDERS, type GSPProvider, TOKEN_EXPIRY_BUFFER_MINUTES } from './constants'
import { encryptCredentials, decryptCredentials, encryptWithAES256, decryptWithAES256, generateTransactionId } from './crypto'
import { addMinutes, isBefore } from 'date-fns'

interface AuthResponse {
  success: boolean
  authToken?: string
  sessionKey?: string
  tokenExpiry?: Date
  error?: string
}

interface IRPAuthPayload {
  username: string
  password: string
  appKey: string
  forceRefreshAccessToken?: boolean
}

/**
 * Get or refresh IRP authentication token
 * @param userId - User ID
 * @param forceRefresh - Force refresh even if token is valid
 * @returns Authentication token and session key
 */
export async function getIRPAuthToken(
  userId: string,
  forceRefresh: boolean = false
): Promise<AuthResponse> {
  try {
    // Get e-invoice configuration
    const config = await db.eInvoiceConfig.findUnique({
      where: { userId },
      include: {
        authTokens: {
          where: {
            isActive: true,
            tokenType: 'IRP'
          },
          orderBy: { tokenExpiry: 'desc' },
          take: 1
        }
      }
    })

    if (!config) {
      return {
        success: false,
        error: 'E-invoice configuration not found. Please configure e-invoicing first.'
      }
    }

    if (!config.isActive) {
      return {
        success: false,
        error: 'E-invoice configuration is inactive. Please activate it first.'
      }
    }

    // Check if we have a valid token
    const existingToken = config.authTokens[0]
    const tokenExpiryBuffer = addMinutes(new Date(), TOKEN_EXPIRY_BUFFER_MINUTES)

    if (existingToken && !forceRefresh && isBefore(tokenExpiryBuffer, existingToken.tokenExpiry)) {
      // Token is still valid
      return {
        success: true,
        authToken: existingToken.authToken,
        sessionKey: existingToken.sessionKey || undefined,
        tokenExpiry: existingToken.tokenExpiry
      }
    }

    // Need to get a new token
    const authResult = await authenticateWithGSP(config)

    if (!authResult.success) {
      return authResult
    }

    // Revoke old tokens
    if (existingToken) {
      await db.eInvoiceAuthToken.update({
        where: { id: existingToken.id },
        data: {
          isActive: false,
          revokedAt: new Date()
        }
      })
    }

    // Save new token
    const newToken = await db.eInvoiceAuthToken.create({
      data: {
        configId: config.id,
        authToken: authResult.authToken!,
        sessionKey: authResult.sessionKey,
        tokenExpiry: authResult.tokenExpiry!,
        tokenType: 'IRP',
        isActive: true
      }
    })

    // Update last sync time
    await db.eInvoiceConfig.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date() }
    })

    return {
      success: true,
      authToken: newToken.authToken,
      sessionKey: newToken.sessionKey || undefined,
      tokenExpiry: newToken.tokenExpiry
    }
  } catch (error) {
    console.error('Error getting IRP auth token:', error)
    return {
      success: false,
      error: 'Failed to authenticate with IRP. Please check your configuration.'
    }
  }
}

/**
 * Authenticate with GSP/IRP
 * @param config - E-invoice configuration
 * @returns Authentication response
 */
async function authenticateWithGSP(config: any): Promise<AuthResponse> {
  try {
    const provider = GSP_PROVIDERS[config.gspProvider as GSPProvider]
    if (!provider) {
      return {
        success: false,
        error: `Unsupported GSP provider: ${config.gspProvider}`
      }
    }

    const baseUrl = config.environment === 'PRODUCTION' 
      ? provider.productionUrl 
      : provider.sandboxUrl

    const url = config.gspUrl || `${baseUrl}${provider.authPath}`

    // Decrypt stored credentials
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key'
    const password = decryptCredentials(config.password, encryptionKey)

    // Prepare authentication payload based on GSP provider
    const payload = buildAuthPayload(config.gspProvider, {
      username: config.username,
      password,
      gstin: config.gstin,
      clientId: config.clientId,
      clientSecret: config.clientSecret ? decryptCredentials(config.clientSecret, encryptionKey) : undefined
    })

    // Make authentication request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Transaction-ID': generateTransactionId(),
        ...(config.clientId && { 'client-id': config.clientId }),
        ...(config.clientSecret && { 'client-secret': decryptCredentials(config.clientSecret, encryptionKey) })
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Authentication failed' }))
      return {
        success: false,
        error: errorData.message || `Authentication failed with status ${response.status}`
      }
    }

    const data = await response.json()

    // Parse response based on GSP provider format
    const authData = parseAuthResponse(config.gspProvider, data)

    if (!authData.success) {
      return authData
    }

    return {
      success: true,
      authToken: authData.authToken!,
      sessionKey: authData.sessionKey,
      tokenExpiry: authData.tokenExpiry!
    }
  } catch (error) {
    console.error('GSP authentication error:', error)
    return {
      success: false,
      error: 'Failed to authenticate with GSP. Please check your credentials and try again.'
    }
  }
}

/**
 * Build authentication payload based on GSP provider
 */
function buildAuthPayload(provider: string, credentials: any): any {
  switch (provider) {
    case 'CLEARTAX':
      return {
        username: credentials.gstin,
        password: credentials.password,
        app_key: credentials.clientId,
        force_refresh_access_token: true
      }
    
    case 'VAYANA':
      return {
        action: 'ACCESSTOKEN',
        username: credentials.username,
        password: credentials.password,
        gstin: credentials.gstin
      }
    
    case 'CYGNET':
      return {
        username: credentials.username,
        password: credentials.password,
        gstin: credentials.gstin,
        requestid: generateTransactionId()
      }
    
    default:
      return {
        username: credentials.username,
        password: credentials.password,
        gstin: credentials.gstin
      }
  }
}

/**
 * Parse authentication response based on GSP provider
 */
function parseAuthResponse(provider: string, data: any): AuthResponse {
  try {
    switch (provider) {
      case 'CLEARTAX':
        if (data.status === 'success' && data.data) {
          return {
            success: true,
            authToken: data.data.AuthToken,
            sessionKey: data.data.SessionKey || data.data.Sek,
            tokenExpiry: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
          }
        }
        break
      
      case 'VAYANA':
        if (data.status === '1' && data.authtoken) {
          return {
            success: true,
            authToken: data.authtoken,
            sessionKey: data.sek,
            tokenExpiry: new Date(data.tokenexpiry || Date.now() + 6 * 60 * 60 * 1000)
          }
        }
        break
      
      case 'CYGNET':
        if (data.Status === '1' && data.Data) {
          return {
            success: true,
            authToken: data.Data.AuthToken,
            sessionKey: data.Data.Sek,
            tokenExpiry: new Date(data.Data.TokenExpiry || Date.now() + 6 * 60 * 60 * 1000)
          }
        }
        break
      
      default:
        if (data.auth_token || data.authToken) {
          return {
            success: true,
            authToken: data.auth_token || data.authToken,
            sessionKey: data.session_key || data.sessionKey || data.sek,
            tokenExpiry: new Date(data.token_expiry || data.tokenExpiry || Date.now() + 6 * 60 * 60 * 1000)
          }
        }
    }

    return {
      success: false,
      error: data.message || data.error || 'Authentication failed'
    }
  } catch (error) {
    console.error('Error parsing auth response:', error)
    return {
      success: false,
      error: 'Failed to parse authentication response'
    }
  }
}

/**
 * Revoke authentication token
 * @param userId - User ID
 * @returns Success status
 */
export async function revokeIRPToken(userId: string): Promise<boolean> {
  try {
    const config = await db.eInvoiceConfig.findUnique({
      where: { userId },
      include: {
        authTokens: {
          where: {
            isActive: true,
            tokenType: 'IRP'
          }
        }
      }
    })

    if (!config || config.authTokens.length === 0) {
      return true // No active tokens to revoke
    }

    // Revoke all active tokens
    await db.eInvoiceAuthToken.updateMany({
      where: {
        configId: config.id,
        isActive: true,
        tokenType: 'IRP'
      },
      data: {
        isActive: false,
        revokedAt: new Date()
      }
    })

    return true
  } catch (error) {
    console.error('Error revoking IRP token:', error)
    return false
  }
}

/**
 * Check if user has valid IRP authentication
 * @param userId - User ID
 * @returns true if authenticated
 */
export async function isIRPAuthenticated(userId: string): Promise<boolean> {
  const result = await getIRPAuthToken(userId)
  return result.success
}