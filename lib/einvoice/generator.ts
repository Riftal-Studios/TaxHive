import { db } from '@/lib/prisma'
import { getIRPAuthToken } from './auth'
import { 
  GSP_PROVIDERS, 
  type GSPProvider, 
  MAX_RETRY_ATTEMPTS, 
  RETRY_DELAY_MS,
  IRP_ERROR_CODES 
} from './constants'
import { 
  encryptWithAES256, 
  decryptWithAES256, 
  generateTransactionId 
} from './crypto'
import { 
  buildEInvoicePayload, 
  validateEInvoicePayload,
  type EInvoicePayload 
} from './schema'
import QRCode from 'qrcode'

interface GenerateIRNResponse {
  success: boolean
  irn?: string
  ackNo?: string
  ackDate?: Date
  signedQRCode?: string
  qrCodeUrl?: string
  ewayBillNo?: string
  ewayBillDate?: Date
  ewayBillValidTill?: Date
  error?: string
  errorCode?: string
}

/**
 * Generate IRN for an invoice
 * @param invoiceId - Invoice ID
 * @param userId - User ID
 * @returns IRN generation response
 */
export async function generateIRN(
  invoiceId: string,
  userId: string
): Promise<GenerateIRNResponse> {
  try {
    // Check if IRN already exists
    const existingEInvoice = await db.eInvoice.findUnique({
      where: { invoiceId }
    })

    if (existingEInvoice?.status === 'GENERATED') {
      return {
        success: true,
        irn: existingEInvoice.irn!,
        ackNo: existingEInvoice.ackNo!,
        ackDate: existingEInvoice.ackDate!,
        signedQRCode: existingEInvoice.signedQRCode!,
        qrCodeUrl: existingEInvoice.qrCodeUrl!
      }
    }

    // Get invoice details
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: true,
        client: true,
        lineItems: true,
        lut: true
      }
    })

    if (!invoice) {
      return {
        success: false,
        error: 'Invoice not found'
      }
    }

    if (invoice.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized'
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

    // Build e-invoice payload
    const payload = buildEInvoicePayload(invoice)

    // Validate payload
    const validation = validateEInvoicePayload(payload)
    if (!validation.valid) {
      return {
        success: false,
        error: 'Invalid e-invoice data',
        errorCode: validation.errors?.join(', ')
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

    // Create or update e-invoice record
    const eInvoiceRecord = existingEInvoice || await db.eInvoice.create({
      data: {
        userId,
        invoiceId,
        docType: 'INV',
        docNo: invoice.invoiceNumber,
        docDate: invoice.invoiceDate,
        supplyType: payload.tranDtls.supTyp,
        sellerGstin: invoice.user.gstin!,
        sellerName: invoice.user.name!,
        sellerAddress: invoice.user.address!,
        buyerGstin: invoice.buyerGSTIN,
        buyerName: invoice.client.company || invoice.client.name,
        buyerAddress: invoice.client.address,
        buyerStateCode: invoice.client.stateCode || '96',
        totalValue: invoice.subtotal,
        totalGstValue: invoice.totalGSTAmount,
        totalInvoiceValue: invoice.totalAmount,
        requestPayload: payload,
        status: 'PENDING'
      }
    })

    // Generate IRN with retry logic
    let attempts = 0
    let lastError: string | undefined

    while (attempts < MAX_RETRY_ATTEMPTS) {
      attempts++

      try {
        const irnResult = await callIRPGenerateAPI(
          config,
          payload,
          authResult.authToken!,
          authResult.sessionKey
        )

        if (irnResult.success) {
          // Generate QR code
          let qrCodeUrl: string | undefined
          if (config.includeQRCode && irnResult.signedQRCode) {
            qrCodeUrl = await generateQRCodeImage(irnResult.signedQRCode)
          }

          // Update e-invoice record
          await db.eInvoice.update({
            where: { id: eInvoiceRecord.id },
            data: {
              irn: irnResult.irn,
              ackNo: irnResult.ackNo,
              ackDate: irnResult.ackDate,
              signedQRCode: irnResult.signedQRCode,
              qrCodeUrl,
              responsePayload: irnResult.responsePayload,
              status: 'GENERATED',
              ewayBillNo: irnResult.ewayBillNo,
              ewayBillDate: irnResult.ewayBillDate,
              ewayBillValidTill: irnResult.ewayBillValidTill
            }
          })

          return {
            success: true,
            irn: irnResult.irn!,
            ackNo: irnResult.ackNo!,
            ackDate: irnResult.ackDate!,
            signedQRCode: irnResult.signedQRCode!,
            qrCodeUrl,
            ewayBillNo: irnResult.ewayBillNo,
            ewayBillDate: irnResult.ewayBillDate,
            ewayBillValidTill: irnResult.ewayBillValidTill
          }
        }

        lastError = irnResult.error
        
        // Check if error is retryable
        if (!isRetryableError(irnResult.errorCode)) {
          break
        }

        if (attempts < MAX_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
        }
      } catch (error) {
        console.error(`IRN generation attempt ${attempts} failed:`, error)
        lastError = 'System error during IRN generation'
      }
    }

    // Update e-invoice record with failure
    await db.eInvoice.update({
      where: { id: eInvoiceRecord.id },
      data: {
        status: 'FAILED',
        errorMessage: lastError,
        retryCount: attempts,
        lastRetryAt: new Date()
      }
    })

    return {
      success: false,
      error: lastError || 'Failed to generate IRN after multiple attempts'
    }
  } catch (error) {
    console.error('Error generating IRN:', error)
    return {
      success: false,
      error: 'Failed to generate IRN'
    }
  }
}

/**
 * Call IRP Generate API
 */
async function callIRPGenerateAPI(
  config: any,
  payload: EInvoicePayload,
  authToken: string,
  sessionKey?: string
): Promise<any> {
  try {
    const provider = GSP_PROVIDERS[config.gspProvider as GSPProvider]
    const baseUrl = config.environment === 'PRODUCTION' 
      ? provider.productionUrl 
      : provider.sandboxUrl
    const url = `${baseUrl}${provider.generatePath}`

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
      const errorMessage = IRP_ERROR_CODES[errorCode] || responseData.error_message || responseData.Message || 'IRN generation failed'
      
      return {
        success: false,
        error: errorMessage,
        errorCode
      }
    }

    // Decrypt response if encrypted
    let irnData = responseData
    if (sessionKey && responseData.data) {
      const decryptedData = decryptWithAES256(responseData.data, sessionKey)
      irnData = JSON.parse(decryptedData)
    }

    // Parse response based on provider format
    return parseIRNResponse(config.gspProvider, irnData)
  } catch (error) {
    console.error('IRP API call error:', error)
    return {
      success: false,
      error: 'Failed to call IRP API'
    }
  }
}

/**
 * Parse IRN response based on GSP provider
 */
function parseIRNResponse(provider: string, data: any): any {
  try {
    // Common fields across providers
    const irn = data.Irn || data.irn || data.IRN
    const ackNo = data.AckNo || data.ackno || data.AckNumber
    const ackDt = data.AckDt || data.ackdt || data.AckDate
    const signedQRCode = data.SignedQRCode || data.signedqrcode || data.QRCode
    
    if (!irn || !ackNo) {
      return {
        success: false,
        error: 'Invalid response from IRP'
      }
    }

    return {
      success: true,
      irn,
      ackNo,
      ackDate: new Date(ackDt),
      signedQRCode,
      responsePayload: data,
      ewayBillNo: data.EwbNo || data.ewbno,
      ewayBillDate: data.EwbDt ? new Date(data.EwbDt) : undefined,
      ewayBillValidTill: data.EwbValidTill ? new Date(data.EwbValidTill) : undefined
    }
  } catch (error) {
    console.error('Error parsing IRN response:', error)
    return {
      success: false,
      error: 'Failed to parse IRP response'
    }
  }
}

/**
 * Generate QR code image from signed QR data
 */
async function generateQRCodeImage(signedQRCode: string): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(signedQRCode, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    })
    
    return qrCodeDataUrl
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw error
  }
}

/**
 * Check if error is retryable
 */
function isRetryableError(errorCode?: string): boolean {
  if (!errorCode) return true
  
  const nonRetryableCodes = [
    '2150', // Duplicate IRN
    '2151', // Duplicate Document Number
    '2152', // Invalid GSTIN
    '2171', // Cannot cancel after 24 hours
    '2172', // IRN already cancelled
    '2173'  // Invalid cancel reason
  ]
  
  return !nonRetryableCodes.includes(errorCode)
}

/**
 * Get IRN by document details
 */
export async function getIRNByDocument(
  docType: string,
  docNo: string,
  docDate: Date,
  userId: string
): Promise<GenerateIRNResponse> {
  try {
    const eInvoice = await db.eInvoice.findFirst({
      where: {
        userId,
        docType,
        docNo,
        docDate,
        status: 'GENERATED'
      }
    })

    if (!eInvoice) {
      return {
        success: false,
        error: 'E-invoice not found'
      }
    }

    return {
      success: true,
      irn: eInvoice.irn!,
      ackNo: eInvoice.ackNo!,
      ackDate: eInvoice.ackDate!,
      signedQRCode: eInvoice.signedQRCode!,
      qrCodeUrl: eInvoice.qrCodeUrl!
    }
  } catch (error) {
    console.error('Error getting IRN by document:', error)
    return {
      success: false,
      error: 'Failed to retrieve IRN'
    }
  }
}