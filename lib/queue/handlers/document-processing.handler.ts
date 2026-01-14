/**
 * Document Processing Queue Handler
 *
 * Processes uploaded documents using AI classification and extraction.
 */

import type { Job, DocumentProcessingJobData } from '../types'
import { db } from '@/lib/prisma'
import { DocumentStatus, ReviewStatus, DocumentSourceType } from '@prisma/client'
import { createGeminiClient, extractDocumentData, extractFromImage } from '@/lib/inbox/gemini-client'
import { classifyDocument, type DocumentContent } from '@/lib/inbox/document-classifier'
import { calculateConfidenceScore, getReviewStatusFromConfidence, type ExtractionResult } from '@/lib/inbox/confidence-calculator'
import { parseUpworkCSV, aggregateUpworkEarnings } from '@/lib/inbox/parsers/upwork-csv.parser'

interface DocumentProcessingResult {
  success: boolean
  documentId: string
  classification?: string
  confidence?: number
  reviewStatus?: string
  error?: string
}

/**
 * Process a document upload
 */
export async function documentProcessingHandler(
  job: Job<DocumentProcessingJobData>
): Promise<DocumentProcessingResult> {
  const { documentUploadId, sourceType, filename, fileUrl, mimeType } = job.data

  try {
    // Update status to processing
    await db.documentUpload.update({
      where: { id: documentUploadId },
      data: {
        status: DocumentStatus.PROCESSING,
        processingJobId: job.id,
      },
    })

    // Fetch document content
    const content = await fetchDocumentContent(fileUrl, mimeType)
    if (!content) {
      throw new Error('Failed to fetch document content')
    }

    // Process based on source type
    let extractedData: ExtractedData
    let aiExtractionUsed = false

    const sourceTypeEnum = sourceType as DocumentSourceType

    if (sourceTypeEnum === DocumentSourceType.UPWORK && mimeType === 'text/csv') {
      // Use specialized Upwork CSV parser
      extractedData = await processUpworkCSV(content)
    } else if (isImageOrPdf(mimeType)) {
      // Use Gemini Vision for images/PDFs
      extractedData = await processWithGeminiVision(content, sourceTypeEnum, filename, mimeType)
      aiExtractionUsed = true
    } else {
      // Use Gemini for text extraction
      extractedData = await processWithGeminiText(content, sourceTypeEnum, filename)
      aiExtractionUsed = true
    }

    // Classify document
    const documentContent: DocumentContent = {
      sourceType: sourceTypeEnum,
      text: typeof content === 'string' ? content : '',
      extractedData: {
        ...extractedData,
        date: extractedData.date ? new Date(extractedData.date) : undefined,
      },
    }

    const classificationResult = classifyDocument(documentContent)

    // Calculate confidence
    const extractionResult: ExtractionResult = {
      classification: classificationResult.classification,
      amount: extractedData.amount,
      currency: extractedData.currency,
      date: extractedData.date ? new Date(extractedData.date) : undefined,
      vendorName: extractedData.vendorName,
      vendorCountry: extractedData.vendorCountry,
      vendorGstin: extractedData.vendorGstin,
      clientName: extractedData.clientName,
      clientCountry: extractedData.clientCountry,
      clientGstin: extractedData.clientGstin,
      invoiceNumber: extractedData.invoiceNumber,
      hasGstDetails: !!(extractedData.vendorGstin || extractedData.clientGstin || extractedData.taxDetails),
      sourceTypeMatch: true, // We trust the user's source type selection
      dataQuality: aiExtractionUsed ? 'medium' : 'high',
    }

    const confidenceScore = calculateConfidenceScore(extractionResult)
    const reviewStatus = getReviewStatusFromConfidence(confidenceScore)

    // Update document with results
    await db.documentUpload.update({
      where: { id: documentUploadId },
      data: {
        status: DocumentStatus.PROCESSED,
        classification: classificationResult.classification,
        confidenceScore: confidenceScore,
        rawExtractionData: extractedData as object,
        extractedData: {
          ...extractedData,
          classificationReasons: classificationResult.reasons,
        },
        extractedAmount: extractedData.amount,
        extractedCurrency: extractedData.currency,
        extractedDate: extractedData.date ? new Date(extractedData.date) : null,
        extractedVendorName: extractedData.vendorName,
        extractedVendorGstin: extractedData.vendorGstin,
        reviewStatus: reviewStatus,
      },
    })

    return {
      success: true,
      documentId: documentUploadId,
      classification: classificationResult.classification,
      confidence: confidenceScore,
      reviewStatus: reviewStatus,
    }
  } catch (error) {
    console.error(`Document processing failed for ${documentUploadId}:`, error)

    // Update document with error status
    await db.documentUpload.update({
      where: { id: documentUploadId },
      data: {
        status: DocumentStatus.FAILED,
        reviewStatus: ReviewStatus.MANUAL_REQUIRED,
        extractedData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    })

    return {
      success: false,
      documentId: documentUploadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Extracted data structure
 */
interface ExtractedData {
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
  taxDetails?: object
  lineItems?: object[]
  notes?: string[]
}

/**
 * Fetch document content from storage
 */
async function fetchDocumentContent(fileUrl: string, mimeType: string): Promise<string | null> {
  try {
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    if (mimeType === 'text/csv' || mimeType.startsWith('text/')) {
      return await response.text()
    }

    // For binary files, return base64
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return base64
  } catch (error) {
    console.error('Failed to fetch document content:', error)
    return null
  }
}

/**
 * Check if MIME type is image or PDF
 */
function isImageOrPdf(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf'
  )
}

/**
 * Process Upwork CSV using specialized parser
 */
async function processUpworkCSV(content: string): Promise<ExtractedData> {
  const parseResult = parseUpworkCSV(content)

  if (!parseResult.success || !parseResult.transactions) {
    throw new Error(parseResult.error || 'Failed to parse Upwork CSV')
  }

  const summary = aggregateUpworkEarnings(parseResult.transactions)

  return {
    amount: summary.netAmount,
    currency: 'USD',
    date: summary.endDate?.toISOString().split('T')[0],
    vendorName: 'Upwork',
    vendorCountry: 'US',
    notes: [
      `Total earnings: $${summary.totalEarnings}`,
      `Total fees: $${summary.totalFees}`,
      `Net amount: $${summary.netAmount}`,
      `Transactions: ${summary.transactionCount}`,
      ...(summary.startDate ? [`Period: ${summary.startDate.toISOString().split('T')[0]} to ${summary.endDate?.toISOString().split('T')[0]}`] : []),
    ],
  }
}

/**
 * Process document with Gemini Vision (for images/PDFs)
 */
async function processWithGeminiVision(
  base64Content: string,
  sourceType: DocumentSourceType,
  filename: string,
  mimeType: string
): Promise<ExtractedData> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY not configured')
  }

  const client = createGeminiClient(apiKey)
  const result = await extractFromImage(client, {
    base64Data: base64Content,
    mimeType,
    sourceType,
    filename,
  })

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Gemini extraction failed')
  }

  return {
    amount: result.data.amount,
    currency: result.data.currency,
    date: result.data.date,
    invoiceNumber: result.data.invoiceNumber,
    vendorName: result.data.vendorName,
    vendorAddress: result.data.vendorAddress,
    vendorCountry: result.data.vendorCountry,
    vendorGstin: result.data.vendorGstin,
    clientName: result.data.clientName,
    clientAddress: result.data.clientAddress,
    clientCountry: result.data.clientCountry,
    clientGstin: result.data.clientGstin,
    taxDetails: result.data.taxDetails,
    lineItems: result.data.lineItems,
    notes: result.data.notes,
  }
}

/**
 * Process document with Gemini Text (for text content)
 */
async function processWithGeminiText(
  textContent: string,
  sourceType: DocumentSourceType,
  filename: string
): Promise<ExtractedData> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY not configured')
  }

  const client = createGeminiClient(apiKey)
  const result = await extractDocumentData(client, {
    content: textContent,
    sourceType,
    filename,
  })

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Gemini extraction failed')
  }

  return {
    amount: result.data.amount,
    currency: result.data.currency,
    date: result.data.date,
    invoiceNumber: result.data.invoiceNumber,
    vendorName: result.data.vendorName,
    vendorAddress: result.data.vendorAddress,
    vendorCountry: result.data.vendorCountry,
    vendorGstin: result.data.vendorGstin,
    clientName: result.data.clientName,
    clientAddress: result.data.clientAddress,
    clientCountry: result.data.clientCountry,
    clientGstin: result.data.clientGstin,
    taxDetails: result.data.taxDetails,
    lineItems: result.data.lineItems,
    notes: result.data.notes,
  }
}
