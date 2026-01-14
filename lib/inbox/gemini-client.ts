/**
 * Google Gemini API Client for Document Processing
 *
 * Handles document analysis, OCR, and data extraction using
 * Google's Gemini AI models.
 */

import { DocumentSourceType } from '@prisma/client'

// Gemini API endpoint
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

/**
 * Gemini client configuration
 */
export interface GeminiClient {
  apiKey: string
  model: string
}

/**
 * Document extraction input
 */
export interface ExtractionInput {
  content: string
  sourceType: DocumentSourceType
  filename: string
  mimeType?: string
}

/**
 * Extracted document data
 */
export interface GeminiExtractionResult {
  success: boolean
  data?: ExtractedDocumentData
  error?: string
  rawResponse?: unknown
}

/**
 * Structured extracted data
 */
export interface ExtractedDocumentData {
  documentType?: string
  amount?: number
  currency?: string
  date?: string
  invoiceNumber?: string
  vendorName?: string
  vendorAddress?: string
  vendorCountry?: string
  vendorGstin?: string
  clientName?: string
  clientAddress?: string
  clientCountry?: string
  clientGstin?: string
  lineItems?: LineItem[]
  taxDetails?: TaxDetails
  confidence?: number
  notes?: string[]
}

/**
 * Line item in invoice
 */
export interface LineItem {
  description: string
  quantity?: number
  rate?: number
  amount: number
  hsnSac?: string
}

/**
 * Tax details
 */
export interface TaxDetails {
  igst?: number
  cgst?: number
  sgst?: number
  totalTax?: number
  taxRate?: number
}

/**
 * Create a Gemini API client
 */
export function createGeminiClient(apiKey: string): GeminiClient {
  if (!apiKey) {
    throw new Error('Gemini API key is required')
  }

  return {
    apiKey,
    model: 'gemini-1.5-flash',
  }
}

/**
 * Build the extraction prompt based on document type
 */
export function buildExtractionPrompt(params: {
  sourceType: DocumentSourceType
  filename: string
}): string {
  const { sourceType, filename } = params

  const basePrompt = `Analyze this document and extract structured data. Return ONLY a valid JSON object with the following fields where applicable:

{
  "documentType": "invoice|receipt|statement|unknown",
  "amount": <number - total amount>,
  "currency": "<3-letter currency code like USD, INR, EUR>",
  "date": "<ISO date string YYYY-MM-DD>",
  "invoiceNumber": "<invoice/reference number>",
  "vendorName": "<seller/vendor company name>",
  "vendorAddress": "<vendor address>",
  "vendorCountry": "<2-letter ISO country code>",
  "vendorGstin": "<15-character GSTIN if present>",
  "clientName": "<buyer/client company name>",
  "clientAddress": "<client address>",
  "clientCountry": "<2-letter ISO country code>",
  "clientGstin": "<15-character GSTIN if present>",
  "lineItems": [
    {
      "description": "<item description>",
      "quantity": <number>,
      "rate": <number>,
      "amount": <number>,
      "hsnSac": "<HSN/SAC code if present>"
    }
  ],
  "taxDetails": {
    "igst": <number>,
    "cgst": <number>,
    "sgst": <number>,
    "totalTax": <number>,
    "taxRate": <percentage as number>
  },
  "confidence": <0-100 confidence score>,
  "notes": ["any relevant observations or warnings"]
}

Important guidelines:
- For amounts, extract the numeric value only (no currency symbols)
- For GSTIN, validate it follows the 15-character format (e.g., 29AABCT1234F1ZV)
- If a field is not found or unclear, omit it from the response
- The confidence score should reflect how certain you are about the extraction
- Return ONLY the JSON object, no explanations or markdown`

  // Add source-type specific hints
  let contextHint = ''

  switch (sourceType) {
    case DocumentSourceType.UPWORK:
      contextHint = `
This is an Upwork earnings document. Focus on:
- Total earnings amount
- Client names from transaction descriptions
- Date range of transactions
- Service fees deducted
- Net amount received
Currency is typically USD.`
      break

    case DocumentSourceType.TOPTAL:
      contextHint = `
This is a Toptal payment document. Focus on:
- Payment amount
- Client project details
- Payment date
- Platform fees if any
Currency is typically USD.`
      break

    case DocumentSourceType.CLIENT_INVOICE:
      contextHint = `
This is a client invoice. Focus on:
- Invoice number
- Total amount and currency
- Client/recipient details
- Service description
- Any GST/tax details if present
- GSTIN numbers for both parties if this is an Indian invoice`
      break

    case DocumentSourceType.VENDOR_BILL:
      contextHint = `
This is a vendor bill/purchase invoice. Focus on:
- Vendor/seller details
- GSTIN of the vendor (critical for ITC claims)
- Invoice number and date
- Tax breakdown (IGST/CGST/SGST)
- HSN/SAC codes for items
- Total amount including taxes`
      break

    case DocumentSourceType.BANK_STATEMENT:
      contextHint = `
This is a bank statement. Focus on:
- Transaction dates
- Credit/debit amounts
- Transaction descriptions
- Running balance
- Account holder name
- Foreign currency transactions (important for forex earnings)`
      break

    case DocumentSourceType.SCREENSHOT:
      contextHint = `
This is a screenshot. Extract any visible:
- Transaction amounts
- Dates
- Platform/service names
- Reference numbers
Note: Screenshots may have lower accuracy.`
      break

    default:
      contextHint = `
Document type: ${sourceType}
Filename: ${filename}
Extract all relevant financial and tax information.`
  }

  return `${basePrompt}\n\nContext:\n${contextHint}`
}

/**
 * Parse Gemini API response
 */
export function parseGeminiResponse(response: unknown): GeminiExtractionResult {
  try {
    const typed = response as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string
          }>
        }
      }>
    }

    if (!typed.candidates || typed.candidates.length === 0) {
      return {
        success: false,
        error: 'No response from Gemini API',
      }
    }

    const text = typed.candidates[0]?.content?.parts?.[0]?.text
    if (!text) {
      return {
        success: false,
        error: 'Empty response from Gemini API',
      }
    }

    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = text.trim()

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    // Parse JSON
    const data = JSON.parse(jsonStr) as ExtractedDocumentData

    return {
      success: true,
      data,
      rawResponse: response,
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse Gemini response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      rawResponse: response,
    }
  }
}

/**
 * Extract data from document using Gemini API
 */
export async function extractDocumentData(
  client: GeminiClient,
  input: ExtractionInput
): Promise<GeminiExtractionResult> {
  try {
    const prompt = buildExtractionPrompt({
      sourceType: input.sourceType,
      filename: input.filename,
    })

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { text: `\n\nDocument content:\n${input.content}` },
        ],
      }],
      generationConfig: {
        temperature: 0.1, // Low temperature for more deterministic extraction
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 2048,
      },
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${client.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Gemini API error: ${response.status} ${response.statusText}`,
      }
    }

    const data = await response.json()
    return parseGeminiResponse(data)
  } catch (error) {
    return {
      success: false,
      error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Extract data from image/PDF using Gemini Vision
 */
export async function extractFromImage(
  client: GeminiClient,
  input: {
    base64Data: string
    mimeType: string
    sourceType: DocumentSourceType
    filename: string
  }
): Promise<GeminiExtractionResult> {
  try {
    const prompt = buildExtractionPrompt({
      sourceType: input.sourceType,
      filename: input.filename,
    })

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.base64Data,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 2048,
      },
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${client.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Gemini API error: ${response.status} ${response.statusText}`,
      }
    }

    const data = await response.json()
    return parseGeminiResponse(data)
  } catch (error) {
    return {
      success: false,
      error: `Image extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Validate extracted GSTIN
 */
export function validateExtractedGstin(gstin: string | undefined): boolean {
  if (!gstin) return false
  // GSTIN format: 2 digits state code + 10 char PAN + 1 char entity + Z + 1 check
  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/i
  return gstinPattern.test(gstin)
}

/**
 * Normalize currency code
 */
export function normalizeCurrency(currency: string | undefined): string | undefined {
  if (!currency) return undefined

  const normalized = currency.toUpperCase().trim()

  // Common mappings
  const currencyMap: Record<string, string> = {
    '$': 'USD',
    'US$': 'USD',
    'US DOLLAR': 'USD',
    'DOLLAR': 'USD',
    '€': 'EUR',
    'EURO': 'EUR',
    '£': 'GBP',
    'POUND': 'GBP',
    '₹': 'INR',
    'RS': 'INR',
    'RS.': 'INR',
    'RUPEE': 'INR',
    'RUPEES': 'INR',
  }

  return currencyMap[normalized] || normalized
}
