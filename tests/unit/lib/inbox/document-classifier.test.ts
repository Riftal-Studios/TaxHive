import { describe, it, expect } from 'vitest'
import {
  classifyDocument,
  inferClassificationFromContent,
  type DocumentContent,
} from '@/lib/inbox/document-classifier'
import { DocumentClassification, DocumentSourceType } from '@prisma/client'

describe('Document Classifier', () => {
  describe('classifyDocument', () => {
    it('should classify Upwork earnings as EXPORT_WITH_LUT', () => {
      const content: DocumentContent = {
        sourceType: DocumentSourceType.UPWORK,
        text: 'Earnings from Upwork client in United States',
        extractedData: {
          amount: 500,
          currency: 'USD',
          clientCountry: 'US',
        },
      }

      const result = classifyDocument(content)
      expect(result.classification).toBe(DocumentClassification.EXPORT_WITH_LUT)
    })

    it('should classify foreign client invoice as EXPORT_WITH_LUT', () => {
      const content: DocumentContent = {
        sourceType: DocumentSourceType.CLIENT_INVOICE,
        text: 'Invoice to Acme Corp, 123 Main St, New York, USA',
        extractedData: {
          amount: 2000,
          currency: 'USD',
          clientCountry: 'US',
          clientName: 'Acme Corp',
        },
      }

      const result = classifyDocument(content)
      expect(result.classification).toBe(DocumentClassification.EXPORT_WITH_LUT)
    })

    it('should classify vendor bill with GSTIN as PURCHASE_ITC', () => {
      const content: DocumentContent = {
        sourceType: DocumentSourceType.VENDOR_BILL,
        text: 'Invoice from ABC Pvt Ltd, GSTIN: 29AABCT1234F1ZV',
        extractedData: {
          amount: 10000,
          currency: 'INR',
          vendorGstin: '29AABCT1234F1ZV',
          vendorName: 'ABC Pvt Ltd',
        },
      }

      const result = classifyDocument(content)
      expect(result.classification).toBe(DocumentClassification.PURCHASE_ITC)
    })

    it('should classify Indian vendor bill without GSTIN as PURCHASE_RCM', () => {
      const content: DocumentContent = {
        sourceType: DocumentSourceType.VENDOR_BILL,
        text: 'Invoice from local supplier, No GST registration',
        extractedData: {
          amount: 5000,
          currency: 'INR',
          vendorName: 'Local Supplier',
          vendorCountry: 'IN',
          // No GSTIN
        },
      }

      const result = classifyDocument(content)
      expect(result.classification).toBe(DocumentClassification.PURCHASE_RCM)
    })

    it('should classify foreign vendor bill as PURCHASE_RCM (Import of Services)', () => {
      const content: DocumentContent = {
        sourceType: DocumentSourceType.VENDOR_BILL,
        text: 'AWS Invoice - Amazon Web Services',
        extractedData: {
          amount: 100,
          currency: 'USD',
          vendorName: 'Amazon Web Services',
          vendorCountry: 'US',
        },
      }

      const result = classifyDocument(content)
      expect(result.classification).toBe(DocumentClassification.PURCHASE_RCM)
    })

    it('should classify domestic B2B invoice with client GSTIN', () => {
      const content: DocumentContent = {
        sourceType: DocumentSourceType.CLIENT_INVOICE,
        text: 'Invoice to XYZ Ltd, GSTIN: 27AABCX1234F1ZP',
        extractedData: {
          amount: 50000,
          currency: 'INR',
          clientGstin: '27AABCX1234F1ZP',
          clientName: 'XYZ Ltd',
          clientCountry: 'IN',
        },
      }

      const result = classifyDocument(content)
      expect(result.classification).toBe(DocumentClassification.DOMESTIC_B2B)
    })

    it('should classify domestic invoice without client GSTIN as DOMESTIC_B2C', () => {
      const content: DocumentContent = {
        sourceType: DocumentSourceType.CLIENT_INVOICE,
        text: 'Invoice to individual customer in India',
        extractedData: {
          amount: 5000,
          currency: 'INR',
          clientName: 'John Doe',
          clientCountry: 'IN',
          // No GSTIN
        },
      }

      const result = classifyDocument(content)
      expect(result.classification).toBe(DocumentClassification.DOMESTIC_B2C)
    })

    it('should return UNKNOWN for ambiguous documents', () => {
      const content: DocumentContent = {
        sourceType: DocumentSourceType.OTHER,
        text: 'Some random document text',
        extractedData: {},
      }

      const result = classifyDocument(content)
      expect(result.classification).toBe(DocumentClassification.UNKNOWN)
    })
  })

  describe('inferClassificationFromContent', () => {
    it('should detect foreign currency as indicator of export', () => {
      const result = inferClassificationFromContent({
        currency: 'USD',
        text: 'Payment received',
      })

      expect(result.likelyExport).toBe(true)
    })

    it('should detect INR with GSTIN as domestic B2B', () => {
      const result = inferClassificationFromContent({
        currency: 'INR',
        text: 'GSTIN: 29AABCT1234F1ZV',
        hasGstin: true,
      })

      expect(result.likelyDomesticB2B).toBe(true)
    })

    it('should detect common export platforms', () => {
      const upworkResult = inferClassificationFromContent({
        text: 'Upwork earnings statement',
      })
      expect(upworkResult.likelyExport).toBe(true)

      const toptalResult = inferClassificationFromContent({
        text: 'Toptal payment receipt',
      })
      expect(toptalResult.likelyExport).toBe(true)

      const fiverrResult = inferClassificationFromContent({
        text: 'Fiverr order completed',
      })
      expect(fiverrResult.likelyExport).toBe(true)
    })

    it('should detect common foreign vendors as PURCHASE_RCM', () => {
      const awsResult = inferClassificationFromContent({
        text: 'Amazon Web Services invoice',
        isVendorBill: true,
      })
      expect(awsResult.likelyPurchaseRCM).toBe(true)

      const figmaResult = inferClassificationFromContent({
        text: 'Figma subscription invoice',
        isVendorBill: true,
      })
      expect(figmaResult.likelyPurchaseRCM).toBe(true)
    })

    it('should detect GSTIN pattern in text', () => {
      const result = inferClassificationFromContent({
        text: 'Vendor GSTIN: 29AABCT1234F1ZV, Invoice No: 123',
      })

      expect(result.detectedGstin).toBe('29AABCT1234F1ZV')
      expect(result.hasGstin).toBe(true)
    })
  })
})
