import { DocumentClassification, DocumentSourceType } from '@prisma/client'

/**
 * Document content for classification
 */
export interface DocumentContent {
  sourceType: DocumentSourceType
  text: string
  extractedData: ExtractedData
}

/**
 * Extracted data from document
 */
export interface ExtractedData {
  amount?: number
  currency?: string
  date?: Date
  vendorName?: string
  vendorCountry?: string
  vendorGstin?: string
  clientName?: string
  clientCountry?: string
  clientGstin?: string
  invoiceNumber?: string
}

/**
 * Classification result
 */
export interface ClassificationResult {
  classification: DocumentClassification
  confidence: number
  reasons: string[]
}

/**
 * Content inference result
 */
export interface ContentInferenceResult {
  likelyExport: boolean
  likelyDomesticB2B: boolean
  likelyDomesticB2C: boolean
  likelyPurchaseITC: boolean
  likelyPurchaseRCM: boolean
  hasGstin: boolean
  detectedGstin?: string
  detectedCurrency?: string
}

// GSTIN pattern: 2 digits state code + 10 char PAN + 1 char entity + 1 check digit + Z
const GSTIN_PATTERN = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1})\b/i

// Foreign currency codes
const FOREIGN_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'JPY', 'CHF', 'AED']

// Export platform keywords
const EXPORT_PLATFORM_KEYWORDS = [
  'upwork',
  'toptal',
  'fiverr',
  'freelancer.com',
  'guru.com',
  'peopleperhour',
]

// Foreign vendor keywords (for Import of Services RCM)
const FOREIGN_VENDOR_KEYWORDS = [
  'amazon web services',
  'aws',
  'google cloud',
  'microsoft azure',
  'figma',
  'github',
  'gitlab',
  'digitalocean',
  'heroku',
  'netlify',
  'vercel',
  'stripe',
  'twilio',
  'sendgrid',
  'mailchimp',
  'zoom',
  'slack',
  'notion',
  'airtable',
  'dropbox',
  'adobe',
  'canva',
  'intercom',
  'hubspot',
]

// Indian state codes (for domestic identification)
const INDIAN_STATE_CODES = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38',
]

/**
 * Classify a document based on its content and extracted data
 */
export function classifyDocument(content: DocumentContent): ClassificationResult {
  const { sourceType, text, extractedData } = content
  const reasons: string[] = []
  let classification: DocumentClassification = DocumentClassification.UNKNOWN
  let confidence = 50 // Base confidence

  const lowerText = text.toLowerCase()
  const inference = inferClassificationFromContent({
    text,
    currency: extractedData.currency,
    hasGstin: !!extractedData.vendorGstin || !!extractedData.clientGstin,
    isVendorBill: sourceType === DocumentSourceType.VENDOR_BILL,
  })

  // Priority 1: Source type specific classification
  if (sourceType === DocumentSourceType.UPWORK || sourceType === DocumentSourceType.TOPTAL) {
    classification = DocumentClassification.EXPORT_WITH_LUT
    reasons.push(`Source type ${sourceType} indicates export earnings`)
    confidence = 90
  }

  // Priority 2: Vendor bill classification
  else if (sourceType === DocumentSourceType.VENDOR_BILL) {
    classification = classifyVendorBill(extractedData, lowerText, inference, reasons)
    confidence = reasons.length > 1 ? 80 : 60
  }

  // Priority 3: Client invoice classification
  else if (sourceType === DocumentSourceType.CLIENT_INVOICE) {
    classification = classifyClientInvoice(extractedData, lowerText, inference, reasons)
    confidence = reasons.length > 1 ? 80 : 60
  }

  // Priority 4: Bank statement - needs manual review
  else if (sourceType === DocumentSourceType.BANK_STATEMENT) {
    classification = DocumentClassification.UNKNOWN
    reasons.push('Bank statements require manual classification')
    confidence = 30
  }

  // Priority 5: Try to infer from content
  else {
    if (inference.likelyExport) {
      classification = DocumentClassification.EXPORT_WITH_LUT
      reasons.push('Content suggests export transaction')
      confidence = 60
    } else if (inference.likelyPurchaseRCM) {
      classification = DocumentClassification.PURCHASE_RCM
      reasons.push('Content suggests foreign vendor purchase')
      confidence = 60
    } else if (inference.likelyPurchaseITC) {
      classification = DocumentClassification.PURCHASE_ITC
      reasons.push('Content contains GSTIN - likely ITC eligible')
      confidence = 60
    }
  }

  return {
    classification,
    confidence,
    reasons,
  }
}

/**
 * Classify vendor bill
 */
function classifyVendorBill(
  data: ExtractedData,
  text: string,
  inference: ContentInferenceResult,
  reasons: string[]
): DocumentClassification {
  // Foreign vendor → PURCHASE_RCM (Import of Services)
  if (data.vendorCountry && data.vendorCountry !== 'IN') {
    reasons.push(`Foreign vendor from ${data.vendorCountry}`)
    return DocumentClassification.PURCHASE_RCM
  }

  // Check for known foreign vendor keywords
  if (inference.likelyPurchaseRCM) {
    reasons.push('Known foreign service provider detected')
    return DocumentClassification.PURCHASE_RCM
  }

  // Has GSTIN → PURCHASE_ITC
  if (data.vendorGstin || inference.hasGstin) {
    reasons.push('Vendor GSTIN present - ITC eligible')
    return DocumentClassification.PURCHASE_ITC
  }

  // Indian vendor without GSTIN → PURCHASE_RCM (unregistered supplier)
  if (data.vendorCountry === 'IN' || (!data.vendorCountry && data.currency === 'INR')) {
    reasons.push('Indian vendor without GSTIN - RCM applicable')
    return DocumentClassification.PURCHASE_RCM
  }

  // Default for vendor bills
  reasons.push('Unable to determine vendor registration status')
  return DocumentClassification.UNKNOWN
}

/**
 * Classify client invoice
 */
function classifyClientInvoice(
  data: ExtractedData,
  text: string,
  inference: ContentInferenceResult,
  reasons: string[]
): DocumentClassification {
  // Foreign client → EXPORT_WITH_LUT
  if (data.clientCountry && data.clientCountry !== 'IN') {
    reasons.push(`Foreign client from ${data.clientCountry}`)
    return DocumentClassification.EXPORT_WITH_LUT
  }

  // Foreign currency → likely export
  if (data.currency && FOREIGN_CURRENCIES.includes(data.currency)) {
    reasons.push(`Foreign currency (${data.currency}) suggests export`)
    return DocumentClassification.EXPORT_WITH_LUT
  }

  // Indian client with GSTIN → DOMESTIC_B2B
  if (data.clientGstin || (data.clientCountry === 'IN' && inference.hasGstin)) {
    reasons.push('Indian client with GSTIN - B2B invoice')
    return DocumentClassification.DOMESTIC_B2B
  }

  // Indian client without GSTIN → DOMESTIC_B2C
  if (data.clientCountry === 'IN' || (!data.clientCountry && data.currency === 'INR')) {
    reasons.push('Indian client without GSTIN - B2C invoice')
    return DocumentClassification.DOMESTIC_B2C
  }

  // Check for export indicators in text
  if (inference.likelyExport) {
    reasons.push('Content suggests export transaction')
    return DocumentClassification.EXPORT_WITH_LUT
  }

  reasons.push('Unable to determine client location')
  return DocumentClassification.UNKNOWN
}

/**
 * Infer classification hints from content
 */
export function inferClassificationFromContent(params: {
  text?: string
  currency?: string
  hasGstin?: boolean
  isVendorBill?: boolean
}): ContentInferenceResult {
  const { text = '', currency, hasGstin = false, isVendorBill = false } = params
  const lowerText = text.toLowerCase()

  const result: ContentInferenceResult = {
    likelyExport: false,
    likelyDomesticB2B: false,
    likelyDomesticB2C: false,
    likelyPurchaseITC: false,
    likelyPurchaseRCM: false,
    hasGstin: hasGstin,
    detectedCurrency: currency,
  }

  // Detect GSTIN in text
  const gstinMatch = text.match(GSTIN_PATTERN)
  if (gstinMatch) {
    result.hasGstin = true
    result.detectedGstin = gstinMatch[1].toUpperCase()
  }

  // Foreign currency indicates export
  if (currency && FOREIGN_CURRENCIES.includes(currency)) {
    result.likelyExport = true
  }

  // Export platform keywords
  for (const keyword of EXPORT_PLATFORM_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      result.likelyExport = true
      break
    }
  }

  // Foreign vendor keywords (for purchases)
  if (isVendorBill) {
    for (const keyword of FOREIGN_VENDOR_KEYWORDS) {
      if (lowerText.includes(keyword)) {
        result.likelyPurchaseRCM = true
        break
      }
    }
  }

  // GSTIN presence
  if (result.hasGstin && !isVendorBill) {
    result.likelyDomesticB2B = true
  } else if (result.hasGstin && isVendorBill) {
    result.likelyPurchaseITC = true
  }

  // INR without GSTIN for client invoice
  if (currency === 'INR' && !result.hasGstin && !isVendorBill) {
    result.likelyDomesticB2C = true
  }

  return result
}

/**
 * Validate GSTIN format
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin || gstin.length !== 15) return false

  const stateCode = gstin.substring(0, 2)
  if (!INDIAN_STATE_CODES.includes(stateCode)) return false

  return GSTIN_PATTERN.test(gstin)
}

/**
 * Extract state code from GSTIN
 */
export function getStateFromGSTIN(gstin: string): string | null {
  if (!isValidGSTIN(gstin)) return null
  return gstin.substring(0, 2)
}
