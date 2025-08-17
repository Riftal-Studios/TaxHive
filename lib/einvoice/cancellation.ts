import { db } from '@/server/db'
import { getIRPAuthToken } from './auth'
import { 
  GSP_PROVIDERS, 
  type GSPProvider,
  type CancelReason,
  CANCEL_REASONS,
  IRP_ERROR_CODES
} from './constants'
import { 
  encryptWithAES256, 
  decryptWithAES256,
  generateTransactionId 
} from './crypto'
import { differenceInHours } from 'date-fns'

interface CancelIRNResponse {
  success: boolean
  cancelIRN?: string
  cancelDate?: Date
  error?: string
  errorCode?: string
}

interface CancelPayload {
  irn: string
  cnlRsn: string // Cancel reason code
  cnlRem: string // Cancel remarks
}

/**
 * Cancel an e-invoice IRN
 * @param invoiceId - Invoice ID
 * @param userId - User ID
 * @param reason - Cancel reason code
 * @param remarks - Cancel remarks
 * @returns Cancellation response
 */
export async function cancelIRN(
  invoiceId: string,
  userId: string,
  reason: CancelReason,
  remarks: string
): Promise<CancelIRNResponse> {
  try {
    // Get e-invoice record
    const eInvoice = await db.eInvoice.findUnique({
      where: { invoiceId },
      include: {
        invoice: true
      }
    })

    if (!eInvoice) {
      return {
        success: false,
        error: 'E-invoice not found'
      }
    }

    if (eInvoice.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized'
      }
    }

    if (eInvoice.status !== 'GENERATED') {
      return {
        success: false,
        error: 'E-invoice is not in generated status'
      }
    }

    if (!eInvoice.irn) {
      return {
        success: false,
        error: 'IRN not found for this e-invoice'
      }
    }

    // Check if cancellation is within 24 hours
    const hoursSinceGeneration = differenceInHours(new Date(), eInvoice.ackDate!)
    if (hoursSinceGeneration > 24) {
      return {
        success: false,
        error: 'Cannot cancel IRN after 24 hours of generation',
        errorCode: '2171'
      }
    }

    // Get e-invoice configuration
    const config = await db.eInvoiceConfig.findUnique({
      where: { userId }
    })

    if (!config || !config.isActive) {
      return {
        success: false,
        error: 'E-invoice configuration not found or inactive'
      }
    }

    // Get authentication token
    const authResult = await getIRPAuthToken(userId)
    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error
      }
    }

    // Build cancellation payload
    const payload: CancelPayload = {
      irn: eInvoice.irn,
      cnlRsn: reason,
      cnlRem: remarks.substring(0, 100) // Max 100 characters
    }

    // Call IRP cancellation API
    const cancelResult = await callIRPCancelAPI(
      config,
      payload,
      authResult.authToken!,
      authResult.sessionKey
    )

    if (cancelResult.success) {
      // Update e-invoice record
      await db.eInvoice.update({
        where: { id: eInvoice.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: cancelResult.cancelDate || new Date(),
          cancelReason: CANCEL_REASONS[reason],
          cancelRemarks: remarks,
          cancelIRN: cancelResult.cancelIRN
        }
      })

      // Update invoice status if needed
      await db.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'CANCELLED'
        }
      })

      return {
        success: true,
        cancelIRN: cancelResult.cancelIRN,
        cancelDate: cancelResult.cancelDate
      }
    }

    return {
      success: false,
      error: cancelResult.error,
      errorCode: cancelResult.errorCode
    }
  } catch (error) {
    console.error('Error cancelling IRN:', error)
    return {
      success: false,
      error: 'Failed to cancel IRN'
    }
  }
}

/**
 * Call IRP Cancel API
 */
async function callIRPCancelAPI(
  config: any,
  payload: CancelPayload,
  authToken: string,
  sessionKey?: string
): Promise<any> {
  try {
    const provider = GSP_PROVIDERS[config.gspProvider as GSPProvider]
    const baseUrl = config.environment === 'PRODUCTION' 
      ? provider.productionUrl 
      : provider.sandboxUrl
    const url = `${baseUrl}${provider.cancelPath}`

    // Encrypt payload if session key is available
    let requestBody: string
    if (sessionKey) {
      const jsonPayload = JSON.stringify(payload)
      const encryptedData = encryptWithAES256(jsonPayload, sessionKey)
      requestBody = JSON.stringify({ data: encryptedData })
    } else {
      requestBody = JSON.stringify(payload)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Transaction-ID': generateTransactionId(),
        'gstin': config.gstin,
        'user_name': config.username
      },
      body: requestBody
    })

    const responseData = await response.json()

    if (!response.ok) {
      const errorCode = responseData.error_code || responseData.ErrorCode || response.status.toString()
      const errorMessage = IRP_ERROR_CODES[errorCode] || responseData.error_message || responseData.Message || 'IRN cancellation failed'
      
      return {
        success: false,
        error: errorMessage,
        errorCode
      }
    }

    // Decrypt response if encrypted
    let cancelData = responseData
    if (sessionKey && responseData.data) {
      const decryptedData = decryptWithAES256(responseData.data, sessionKey)
      cancelData = JSON.parse(decryptedData)
    }

    // Parse response
    return parseCancelResponse(config.gspProvider, cancelData)
  } catch (error) {
    console.error('IRP Cancel API call error:', error)
    return {
      success: false,
      error: 'Failed to call IRP Cancel API'
    }
  }
}

/**
 * Parse cancellation response based on GSP provider
 */
function parseCancelResponse(provider: string, data: any): any {
  try {
    const cancelIRN = data.CancelIrn || data.cancelirn || data.CancelIRN
    const cancelDate = data.CancelDate || data.canceldate || data.CancelDt
    
    if (!cancelIRN) {
      return {
        success: false,
        error: 'Invalid cancellation response from IRP'
      }
    }

    return {
      success: true,
      cancelIRN,
      cancelDate: cancelDate ? new Date(cancelDate) : new Date()
    }
  } catch (error) {
    console.error('Error parsing cancel response:', error)
    return {
      success: false,
      error: 'Failed to parse IRP cancellation response'
    }
  }
}

/**
 * Check if an IRN can be cancelled
 * @param invoiceId - Invoice ID
 * @param userId - User ID
 * @returns Whether the IRN can be cancelled
 */
export async function canCancelIRN(
  invoiceId: string,
  userId: string
): Promise<{ canCancel: boolean; reason?: string }> {
  try {
    const eInvoice = await db.eInvoice.findUnique({
      where: { invoiceId }
    })

    if (!eInvoice) {
      return {
        canCancel: false,
        reason: 'E-invoice not found'
      }
    }

    if (eInvoice.userId !== userId) {
      return {
        canCancel: false,
        reason: 'Unauthorized'
      }
    }

    if (eInvoice.status !== 'GENERATED') {
      return {
        canCancel: false,
        reason: 'E-invoice is not in generated status'
      }
    }

    if (!eInvoice.ackDate) {
      return {
        canCancel: false,
        reason: 'E-invoice acknowledgment date not found'
      }
    }

    const hoursSinceGeneration = differenceInHours(new Date(), eInvoice.ackDate)
    if (hoursSinceGeneration > 24) {
      return {
        canCancel: false,
        reason: `Cannot cancel after 24 hours. ${hoursSinceGeneration} hours have passed since generation.`
      }
    }

    return {
      canCancel: true
    }
  } catch (error) {
    console.error('Error checking IRN cancellation eligibility:', error)
    return {
      canCancel: false,
      reason: 'Error checking cancellation eligibility'
    }
  }
}

/**
 * Get cancellation history for an invoice
 */
export async function getCancellationHistory(
  invoiceId: string,
  userId: string
): Promise<any[]> {
  try {
    const eInvoices = await db.eInvoice.findMany({
      where: {
        invoiceId,
        userId,
        status: 'CANCELLED'
      },
      select: {
        id: true,
        irn: true,
        cancelledAt: true,
        cancelReason: true,
        cancelRemarks: true,
        cancelIRN: true
      },
      orderBy: {
        cancelledAt: 'desc'
      }
    })

    return eInvoices
  } catch (error) {
    console.error('Error getting cancellation history:', error)
    return []
  }
}

/**
 * Bulk cancel multiple IRNs
 */
export async function bulkCancelIRNs(
  invoiceIds: string[],
  userId: string,
  reason: CancelReason,
  remarks: string
): Promise<{ succeeded: string[]; failed: Array<{ invoiceId: string; error: string }> }> {
  const succeeded: string[] = []
  const failed: Array<{ invoiceId: string; error: string }> = []

  for (const invoiceId of invoiceIds) {
    const result = await cancelIRN(invoiceId, userId, reason, remarks)
    
    if (result.success) {
      succeeded.push(invoiceId)
    } else {
      failed.push({
        invoiceId,
        error: result.error || 'Unknown error'
      })
    }

    // Add delay between cancellations to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return { succeeded, failed }
}