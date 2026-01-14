import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createGeminiClient,
  extractDocumentData,
  buildExtractionPrompt,
  parseGeminiResponse,
  type GeminiExtractionResult,
} from '@/lib/inbox/gemini-client'
import { DocumentSourceType } from '@prisma/client'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Gemini Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createGeminiClient', () => {
    it('should create client with API key', () => {
      const client = createGeminiClient('test-api-key')
      expect(client).toBeDefined()
      expect(client.apiKey).toBe('test-api-key')
    })

    it('should throw error if API key is missing', () => {
      expect(() => createGeminiClient('')).toThrow('Gemini API key is required')
    })
  })

  describe('buildExtractionPrompt', () => {
    it('should build prompt for client invoice', () => {
      const prompt = buildExtractionPrompt({
        sourceType: DocumentSourceType.CLIENT_INVOICE,
        filename: 'invoice-001.pdf',
      })

      expect(prompt).toContain('invoice')
      expect(prompt).toContain('amount')
      expect(prompt).toContain('currency')
      expect(prompt).toContain('JSON')
    })

    it('should build prompt for vendor bill', () => {
      const prompt = buildExtractionPrompt({
        sourceType: DocumentSourceType.VENDOR_BILL,
        filename: 'aws-invoice.pdf',
      })

      expect(prompt).toContain('vendor')
      expect(prompt).toContain('GSTIN')
      expect(prompt).toContain('JSON')
    })

    it('should build prompt for Upwork CSV', () => {
      const prompt = buildExtractionPrompt({
        sourceType: DocumentSourceType.UPWORK,
        filename: 'upwork-earnings.csv',
      })

      expect(prompt).toContain('Upwork')
      expect(prompt).toContain('earnings')
    })

    it('should include source type hints', () => {
      const prompt = buildExtractionPrompt({
        sourceType: DocumentSourceType.BANK_STATEMENT,
        filename: 'statement.pdf',
      })

      expect(prompt).toContain('bank statement')
    })
  })

  describe('parseGeminiResponse', () => {
    it('should parse valid JSON response', () => {
      const response = {
        candidates: [{
          content: {
            parts: [{
              text: `\`\`\`json
{
  "documentType": "invoice",
  "amount": 1000,
  "currency": "USD",
  "date": "2024-01-15",
  "vendorName": "Acme Corp",
  "vendorCountry": "US",
  "confidence": 85
}
\`\`\``
            }]
          }
        }]
      }

      const result = parseGeminiResponse(response)

      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(1000)
      expect(result.data?.currency).toBe('USD')
      expect(result.data?.vendorName).toBe('Acme Corp')
    })

    it('should handle JSON without markdown code blocks', () => {
      const response = {
        candidates: [{
          content: {
            parts: [{
              text: `{
  "documentType": "invoice",
  "amount": 500,
  "currency": "EUR"
}`
            }]
          }
        }]
      }

      const result = parseGeminiResponse(response)

      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(500)
    })

    it('should handle malformed response', () => {
      const response = {
        candidates: [{
          content: {
            parts: [{
              text: 'This is not valid JSON'
            }]
          }
        }]
      }

      const result = parseGeminiResponse(response)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle empty response', () => {
      const response = {
        candidates: []
      }

      const result = parseGeminiResponse(response)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No response')
    })

    it('should extract GSTIN from response', () => {
      const response = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                vendorGstin: '29AABCT1234F1ZV',
                amount: 10000,
                currency: 'INR'
              })
            }]
          }
        }]
      }

      const result = parseGeminiResponse(response)

      expect(result.success).toBe(true)
      expect(result.data?.vendorGstin).toBe('29AABCT1234F1ZV')
    })
  })

  describe('extractDocumentData', () => {
    it('should call Gemini API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  documentType: 'invoice',
                  amount: 1000,
                  currency: 'USD'
                })
              }]
            }
          }]
        })
      })

      const client = createGeminiClient('test-api-key')
      const result = await extractDocumentData(client, {
        content: 'Invoice content...',
        sourceType: DocumentSourceType.CLIENT_INVOICE,
        filename: 'invoice.pdf',
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(result.success).toBe(true)
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      })

      const client = createGeminiClient('test-api-key')
      const result = await extractDocumentData(client, {
        content: 'Test content',
        sourceType: DocumentSourceType.OTHER,
        filename: 'test.pdf',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('429')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const client = createGeminiClient('test-api-key')
      const result = await extractDocumentData(client, {
        content: 'Test content',
        sourceType: DocumentSourceType.OTHER,
        filename: 'test.pdf',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })
})
