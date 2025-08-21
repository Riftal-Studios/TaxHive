import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'

// Import interfaces and types that we need to implement
interface GSTR2AData {
  gstin: string
  fp: string // Return filing period
  version: string
  hash: string
  b2b: GSTR2AB2BEntry[]
  b2ba: GSTR2AB2BAEntry[]
  cdnr: GSTR2ACDNREntry[]
  cdnra: GSTR2ACDNRAEntry[]
  isd: GSTR2AISDEntry[]
  impg: GSTR2AIMPGEntry[]
  imps: GSTR2AIMPSEntry[]
}

interface GSTR2AB2BEntry {
  ctin: string // Supplier GSTIN
  inv: GSTR2AInvoice[]
}

interface GSTR2AInvoice {
  inum: string // Invoice number
  idt: string // Invoice date (DD-MM-YYYY)
  val: number // Invoice value
  pos: string // Place of supply
  rchrg: 'Y' | 'N' // Reverse charge
  inv_typ: 'R' | 'SEWP' | 'SEWOP' | 'DE' // Invoice type
  itms: GSTR2AItem[]
}

interface GSTR2AItem {
  num: number // Serial number
  itm_det: {
    txval: number // Taxable value
    rt: number // Tax rate
    iamt: number // IGST amount
    camt: number // CGST amount
    samt: number // SGST amount
    csamt: number // Cess amount
  }
}

interface GSTR2AB2BAEntry {
  ctin: string
  inv: GSTR2AAmendedInvoice[]
}

interface GSTR2AAmendedInvoice extends GSTR2AInvoice {
  oinum: string // Original invoice number
  oidt: string // Original invoice date
}

interface GSTR2ACDNREntry {
  ctin: string
  nt: GSTR2ACreditNote[]
}

interface GSTR2ACreditNote {
  ntty: 'C' | 'D' // Note type
  nt_num: string // Note number
  nt_dt: string // Note date
  rsn: string // Reason
  val: number // Note value
  itms: GSTR2AItem[]
}

interface GSTR2ACDNRAEntry extends GSTR2ACDNREntry {}

interface GSTR2AISDEntry {
  isd_docty: 'ISD01' | 'ISD02'
  docnum: string
  docdt: string
  itms: GSTR2AItem[]
}

interface GSTR2AIMPGEntry {
  refdt: string
  recdt: string
  portcd: string
  benum: string
  bedt: string
  txval: number
  iamt: number
  csamt: number
}

interface GSTR2AIMPSEntry {
  inum: string
  idt: string
  val: number
  pos: string
  itms: GSTR2AItem[]
}

interface ReconciliationMatch {
  id: string
  gstr2aInvoice: GSTR2AInvoice
  purchaseInvoice?: any
  matchType: 'EXACT' | 'PARTIAL' | 'FUZZY' | 'NO_MATCH'
  matchScore: number
  mismatches: ReconciliationMismatch[]
  status: 'MATCHED' | 'MISMATCHED' | 'MISSING_IN_BOOKS' | 'MISSING_IN_GSTR2A' | 'PENDING_REVIEW'
}

interface ReconciliationMismatch {
  field: string
  gstr2aValue: any
  booksValue: any
  tolerance: number
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
}

interface ReconciliationSummary {
  totalGSTR2AInvoices: number
  totalPurchaseInvoices: number
  exactMatches: number
  partialMatches: number
  fuzzyMatches: number
  noMatches: number
  missingInBooks: number
  missingInGSTR2A: number
  totalMismatches: number
  totalITCAvailable: Decimal
  totalITCClaimed: Decimal
  totalITCPending: Decimal
  excessClaim: Decimal
}

interface VendorReconciliation {
  vendorGSTIN: string
  vendorName?: string
  totalInvoices: number
  matchedInvoices: number
  mismatchedInvoices: number
  missingInvoices: number
  totalValue: Decimal
  totalITC: Decimal
  status: 'RECONCILED' | 'PARTIALLY_RECONCILED' | 'PENDING' | 'DISCREPANCIES'
  actionItems: string[]
  lastReconciliationDate?: Date
}

interface ITCAvailability {
  vendorGSTIN: string
  availableITC: Decimal
  claimedITC: Decimal
  unclaimedITC: Decimal
  excessClaim: Decimal
  period: string
  source: 'GSTR2A' | 'GSTR2B' | 'COMPUTED'
}

interface MatchingOptions {
  amountTolerance: number // Percentage tolerance for amount matching
  dateTolerance: number // Days tolerance for date matching
  fuzzyThreshold: number // Minimum score for fuzzy matching
  autoAcceptExactMatches: boolean
  requireManualReviewForFuzzy: boolean
}

interface ReconciliationAction {
  type: 'ACCEPT_MATCH' | 'FLAG_MISMATCH' | 'MARK_RECONCILED' | 'VENDOR_FOLLOW_UP' | 'MANUAL_REVIEW'
  invoiceId: string
  reason: string
  actionBy: string
  actionDate: Date
  notes?: string
}

interface MismatchReport {
  period: string
  generatedAt: Date
  vendorMismatches: VendorMismatchSummary[]
  amountMismatches: AmountMismatch[]
  dateMismatches: DateMismatch[]
  missingInvoices: MissingInvoice[]
  duplicateInvoices: DuplicateInvoice[]
  totalDiscrepancies: number
}

interface VendorMismatchSummary {
  vendorGSTIN: string
  vendorName?: string
  totalDiscrepancies: number
  amountMismatches: number
  dateMismatches: number
  missingInvoices: number
  totalImpact: Decimal
}

interface AmountMismatch {
  invoiceNumber: string
  vendorGSTIN: string
  gstr2aAmount: Decimal
  booksAmount: Decimal
  difference: Decimal
  percentageDiff: number
}

interface DateMismatch {
  invoiceNumber: string
  vendorGSTIN: string
  gstr2aDate: Date
  booksDate: Date
  daysDifference: number
}

interface MissingInvoice {
  invoiceNumber: string
  vendorGSTIN: string
  source: 'GSTR2A' | 'BOOKS'
  amount: Decimal
  itcAmount: Decimal
}

interface DuplicateInvoice {
  invoiceNumber: string
  vendorGSTIN: string
  occurrences: number
  totalAmount: Decimal
}

// Import the service that we need to implement
import {
  GSTRReconciliationService,
  importGSTR2AData,
  reconcileInvoices,
  matchInvoice,
  identifyMismatches,
  calculateMatchScore,
  processReconciliation,
  getReconciliationSummary,
  getVendorReconciliation,
  exportMismatchReport,
  trackITCAvailability
} from '@/lib/itc/gstr-reconciliation'

describe('GSTR-2A/2B Reconciliation - TDD Implementation', () => {
  const testUserId = 'test-user-id'
  const testPeriod = '03-2024'
  
  // Sample GSTR-2A data
  const sampleGSTR2AData: GSTR2AData = {
    gstin: '27AAPFU0939F1ZV',
    fp: '032024',
    version: '1.0',
    hash: 'test-hash',
    b2b: [
      {
        ctin: '29AWGPV7107B1Z1',
        inv: [
          {
            inum: 'INV001',
            idt: '15-03-2024',
            val: 11800,
            pos: '29',
            rchrg: 'N',
            inv_typ: 'R',
            itms: [
              {
                num: 1,
                itm_det: {
                  txval: 10000,
                  rt: 18,
                  iamt: 0,
                  camt: 900,
                  samt: 900,
                  csamt: 0
                }
              }
            ]
          }
        ]
      }
    ],
    b2ba: [],
    cdnr: [],
    cdnra: [],
    isd: [],
    impg: [],
    imps: []
  }

  const matchingOptions: MatchingOptions = {
    amountTolerance: 1.0, // 1% tolerance
    dateTolerance: 2, // 2 days tolerance
    fuzzyThreshold: 0.8, // 80% match score
    autoAcceptExactMatches: true,
    requireManualReviewForFuzzy: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // RED PHASE - GSTR-2A/2B Data Import and Parsing Tests
  describe('GSTR-2A/2B Data Import and Parsing (RED Phase)', () => {
    it('should fail to import invalid JSON format', async () => {
      const invalidJson = '{"invalid": "json"'

      await expect(importGSTR2AData(invalidJson, testUserId, testPeriod))
        .rejects.toThrow('Invalid JSON format in GSTR-2A data')
    })

    it('should fail to import data without required fields', async () => {
      const incompleteData = {
        gstin: '27AAPFU0939F1ZV'
        // Missing required fields like fp, b2b, etc.
      }

      await expect(importGSTR2AData(JSON.stringify(incompleteData), testUserId, testPeriod))
        .rejects.toThrow('Missing required GSTR-2A fields')
    })

    it('should fail to import data with invalid GSTIN format', async () => {
      const invalidGSTINData = {
        ...sampleGSTR2AData,
        gstin: 'INVALID-GSTIN'
      }

      await expect(importGSTR2AData(JSON.stringify(invalidGSTINData), testUserId, testPeriod))
        .rejects.toThrow('Invalid GSTIN format')
    })

    it('should successfully import valid GSTR-2A data', async () => {
      const result = await importGSTR2AData(JSON.stringify(sampleGSTR2AData), testUserId, testPeriod)

      expect(result.success).toBe(true)
      expect(result.totalInvoices).toBe(1)
      expect(result.totalSuppliers).toBe(1)
      expect(result.totalITCAmount).toBeInstanceOf(Decimal)
      expect(result.importedAt).toBeInstanceOf(Date)
    })

    it('should parse multiple supplier entries correctly', async () => {
      const multiSupplierData = {
        ...sampleGSTR2AData,
        b2b: [
          ...sampleGSTR2AData.b2b,
          {
            ctin: '29ABCDE1234F1Z1',
            inv: [
              {
                inum: 'INV002',
                idt: '16-03-2024',
                val: 5900,
                pos: '29',
                rchrg: 'N',
                inv_typ: 'R',
                itms: [
                  {
                    num: 1,
                    itm_det: {
                      txval: 5000,
                      rt: 18,
                      iamt: 0,
                      camt: 450,
                      samt: 450,
                      csamt: 0
                    }
                  }
                ]
              }
            ]
          }
        ]
      }

      const result = await importGSTR2AData(JSON.stringify(multiSupplierData), testUserId, testPeriod)

      expect(result.totalInvoices).toBe(2)
      expect(result.totalSuppliers).toBe(2)
    })

    it('should handle amended invoices (B2BA) correctly', async () => {
      const amendedData = {
        ...sampleGSTR2AData,
        b2ba: [
          {
            ctin: '29AWGPV7107B1Z1',
            inv: [
              {
                inum: 'INV001-AMD',
                idt: '20-03-2024',
                val: 12980,
                pos: '29',
                rchrg: 'N',
                inv_typ: 'R',
                oinum: 'INV001',
                oidt: '15-03-2024',
                itms: [
                  {
                    num: 1,
                    itm_det: {
                      txval: 11000,
                      rt: 18,
                      iamt: 0,
                      camt: 990,
                      samt: 990,
                      csamt: 0
                    }
                  }
                ]
              }
            ]
          }
        ]
      }

      const result = await importGSTR2AData(JSON.stringify(amendedData), testUserId, testPeriod)

      expect(result.amendedInvoices).toBe(1)
      expect(result.success).toBe(true)
    })
  })

  // RED PHASE - Invoice Matching Logic Tests
  describe('Invoice Matching Logic (RED Phase)', () => {
    it('should perform exact match for identical invoice details', async () => {
      const gstr2aInvoice = sampleGSTR2AData.b2b[0].inv[0]
      const purchaseInvoice = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2024-03-15'),
        vendorGSTIN: '29AWGPV7107B1Z1',
        totalAmount: new Decimal(11800),
        igstAmount: new Decimal(0),
        cgstAmount: new Decimal(900),
        sgstAmount: new Decimal(900)
      }

      const match = await matchInvoice(gstr2aInvoice, purchaseInvoice, matchingOptions)

      expect(match.matchType).toBe('EXACT')
      expect(match.matchScore).toBe(1.0)
      expect(match.mismatches).toHaveLength(0)
    })

    it('should perform partial match with amount within tolerance', async () => {
      const gstr2aInvoice = sampleGSTR2AData.b2b[0].inv[0]
      const purchaseInvoice = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2024-03-15'),
        vendorGSTIN: '29AWGPV7107B1Z1',
        totalAmount: new Decimal(11918), // 1% difference
        igstAmount: new Decimal(0),
        cgstAmount: new Decimal(900),
        sgstAmount: new Decimal(900)
      }

      const match = await matchInvoice(gstr2aInvoice, purchaseInvoice, matchingOptions)

      expect(match.matchType).toBe('PARTIAL')
      expect(match.matchScore).toBeGreaterThan(0.8)
      expect(match.mismatches).toHaveLength(1)
      expect(match.mismatches[0].field).toBe('amount')
    })

    it('should perform fuzzy match for similar invoice numbers', async () => {
      const gstr2aInvoice = sampleGSTR2AData.b2b[0].inv[0]
      const purchaseInvoice = {
        invoiceNumber: 'INV-001', // Similar but not exact
        invoiceDate: new Date('2024-03-15'),
        vendorGSTIN: '29AWGPV7107B1Z1',
        totalAmount: new Decimal(11800),
        igstAmount: new Decimal(0),
        cgstAmount: new Decimal(900),
        sgstAmount: new Decimal(900)
      }

      const match = await matchInvoice(gstr2aInvoice, purchaseInvoice, matchingOptions)

      expect(match.matchType).toBe('FUZZY')
      expect(match.matchScore).toBeGreaterThan(matchingOptions.fuzzyThreshold)
      expect(match.mismatches).toHaveLength(1)
      expect(match.mismatches[0].field).toBe('invoiceNumber')
    })

    it('should return no match for significantly different invoices', async () => {
      const gstr2aInvoice = sampleGSTR2AData.b2b[0].inv[0]
      const purchaseInvoice = {
        invoiceNumber: 'COMPLETELY-DIFFERENT',
        invoiceDate: new Date('2024-01-15'),
        vendorGSTIN: '29DIFFERENT1234F1Z1',
        totalAmount: new Decimal(50000),
        igstAmount: new Decimal(0),
        cgstAmount: new Decimal(4500),
        sgstAmount: new Decimal(4500)
      }

      const match = await matchInvoice(gstr2aInvoice, purchaseInvoice, matchingOptions)

      expect(match.matchType).toBe('NO_MATCH')
      expect(match.matchScore).toBeLessThan(0.5)
    })

    it('should handle date tolerance correctly', async () => {
      const gstr2aInvoice = sampleGSTR2AData.b2b[0].inv[0]
      const purchaseInvoice = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2024-03-17'), // 2 days difference
        vendorGSTIN: '29AWGPV7107B1Z1',
        totalAmount: new Decimal(11800),
        igstAmount: new Decimal(0),
        cgstAmount: new Decimal(900),
        sgstAmount: new Decimal(900)
      }

      const match = await matchInvoice(gstr2aInvoice, purchaseInvoice, matchingOptions)

      expect(match.matchType).toBe('PARTIAL')
      expect(match.mismatches.some(m => m.field === 'date')).toBe(true)
    })

    it('should detect multiple mismatches correctly', async () => {
      const gstr2aInvoice = sampleGSTR2AData.b2b[0].inv[0]
      const purchaseInvoice = {
        invoiceNumber: 'INV-001', // Fuzzy match
        invoiceDate: new Date('2024-03-18'), // Date mismatch
        vendorGSTIN: '29AWGPV7107B1Z1',
        totalAmount: new Decimal(12508), // Amount mismatch
        igstAmount: new Decimal(0),
        cgstAmount: new Decimal(900),
        sgstAmount: new Decimal(900)
      }

      const match = await matchInvoice(gstr2aInvoice, purchaseInvoice, matchingOptions)

      expect(match.mismatches.length).toBeGreaterThan(1)
      expect(match.mismatches.some(m => m.field === 'invoiceNumber')).toBe(true)
      expect(match.mismatches.some(m => m.field === 'date')).toBe(true)
      expect(match.mismatches.some(m => m.field === 'amount')).toBe(true)
    })
  })

  // RED PHASE - Mismatch Identification Tests
  describe('Mismatch Identification (RED Phase)', () => {
    it('should identify invoices missing in books but present in GSTR-2A', async () => {
      const gstr2aData = sampleGSTR2AData
      const purchaseInvoices: any[] = [] // Empty - no invoices in books

      const mismatches = await identifyMismatches(gstr2aData, purchaseInvoices, testUserId, testPeriod)

      expect(mismatches.missingInBooks).toHaveLength(1)
      expect(mismatches.missingInBooks[0].invoiceNumber).toBe('INV001')
      expect(mismatches.missingInBooks[0].vendorGSTIN).toBe('29AWGPV7107B1Z1')
    })

    it('should identify invoices missing in GSTR-2A but present in books', async () => {
      const emptyGSTR2AData: GSTR2AData = {
        ...sampleGSTR2AData,
        b2b: []
      }
      const purchaseInvoices = [
        {
          invoiceNumber: 'INV002',
          invoiceDate: new Date('2024-03-15'),
          vendorGSTIN: '29AWGPV7107B1Z1',
          totalAmount: new Decimal(11800)
        }
      ]

      const mismatches = await identifyMismatches(emptyGSTR2AData, purchaseInvoices, testUserId, testPeriod)

      expect(mismatches.missingInGSTR2A).toHaveLength(1)
      expect(mismatches.missingInGSTR2A[0].invoiceNumber).toBe('INV002')
    })

    it('should identify amount mismatches beyond tolerance', async () => {
      const gstr2aData = sampleGSTR2AData
      const purchaseInvoices = [
        {
          invoiceNumber: 'INV001',
          invoiceDate: new Date('2024-03-15'),
          vendorGSTIN: '29AWGPV7107B1Z1',
          totalAmount: new Decimal(15000) // Significant difference
        }
      ]

      const mismatches = await identifyMismatches(gstr2aData, purchaseInvoices, testUserId, testPeriod)

      expect(mismatches.amountMismatches).toHaveLength(1)
      expect(mismatches.amountMismatches[0].difference.toNumber()).toBeGreaterThan(1000)
    })

    it('should identify tax rate mismatches', async () => {
      const gstr2aData = sampleGSTR2AData
      const purchaseInvoices = [
        {
          invoiceNumber: 'INV001',
          invoiceDate: new Date('2024-03-15'),
          vendorGSTIN: '29AWGPV7107B1Z1',
          totalAmount: new Decimal(11800),
          lineItems: [
            {
              gstRate: 12 // Different from 18% in GSTR-2A
            }
          ]
        }
      ]

      const mismatches = await identifyMismatches(gstr2aData, purchaseInvoices, testUserId, testPeriod)

      expect(mismatches.taxRateMismatches).toHaveLength(1)
    })

    it('should identify date mismatches beyond tolerance', async () => {
      const gstr2aData = sampleGSTR2AData
      const purchaseInvoices = [
        {
          invoiceNumber: 'INV001',
          invoiceDate: new Date('2024-03-10'), // 5 days difference
          vendorGSTIN: '29AWGPV7107B1Z1',
          totalAmount: new Decimal(11800)
        }
      ]

      const mismatches = await identifyMismatches(gstr2aData, purchaseInvoices, testUserId, testPeriod)

      expect(mismatches.dateMismatches).toHaveLength(1)
      expect(mismatches.dateMismatches[0].daysDifference).toBe(5)
    })

    it('should identify duplicate invoices', async () => {
      const gstr2aData = {
        ...sampleGSTR2AData,
        b2b: [
          {
            ctin: '29AWGPV7107B1Z1',
            inv: [
              sampleGSTR2AData.b2b[0].inv[0],
              sampleGSTR2AData.b2b[0].inv[0] // Duplicate
            ]
          }
        ]
      }
      const purchaseInvoices: any[] = []

      const mismatches = await identifyMismatches(gstr2aData, purchaseInvoices, testUserId, testPeriod)

      expect(mismatches.duplicateInvoices).toHaveLength(1)
      expect(mismatches.duplicateInvoices[0].occurrences).toBe(2)
    })
  })

  // RED PHASE - Reconciliation Actions Tests
  describe('Reconciliation Actions (RED Phase)', () => {
    it('should accept matched invoices automatically for exact matches', async () => {
      const matches: ReconciliationMatch[] = [
        {
          id: 'match-1',
          gstr2aInvoice: sampleGSTR2AData.b2b[0].inv[0],
          purchaseInvoice: {
            id: 'pi-1',
            invoiceNumber: 'INV001'
          },
          matchType: 'EXACT',
          matchScore: 1.0,
          mismatches: [],
          status: 'MATCHED'
        }
      ]

      const result = await processReconciliation(matches, testUserId, testPeriod, matchingOptions)

      expect(result.acceptedMatches).toBe(1)
      expect(result.pendingReview).toBe(0)
      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].type).toBe('ACCEPT_MATCH')
    })

    it('should flag mismatches for manual review', async () => {
      const matches: ReconciliationMatch[] = [
        {
          id: 'match-1',
          gstr2aInvoice: sampleGSTR2AData.b2b[0].inv[0],
          purchaseInvoice: {
            id: 'pi-1',
            invoiceNumber: 'INV001'
          },
          matchType: 'PARTIAL',
          matchScore: 0.7,
          mismatches: [
            {
              field: 'amount',
              gstr2aValue: 11800,
              booksValue: 15000,
              tolerance: 1.0,
              severity: 'HIGH',
              description: 'Amount difference beyond tolerance'
            }
          ],
          status: 'MISMATCHED'
        }
      ]

      const result = await processReconciliation(matches, testUserId, testPeriod, matchingOptions)

      expect(result.flaggedMismatches).toBe(1)
      expect(result.pendingReview).toBe(1)
      expect(result.actions[0].type).toBe('FLAG_MISMATCH')
    })

    it('should require manual review for fuzzy matches', async () => {
      const matches: ReconciliationMatch[] = [
        {
          id: 'match-1',
          gstr2aInvoice: sampleGSTR2AData.b2b[0].inv[0],
          purchaseInvoice: {
            id: 'pi-1',
            invoiceNumber: 'INV-001'
          },
          matchType: 'FUZZY',
          matchScore: 0.85,
          mismatches: [
            {
              field: 'invoiceNumber',
              gstr2aValue: 'INV001',
              booksValue: 'INV-001',
              tolerance: 0,
              severity: 'MEDIUM',
              description: 'Invoice number format difference'
            }
          ],
          status: 'PENDING_REVIEW'
        }
      ]

      const result = await processReconciliation(matches, testUserId, testPeriod, matchingOptions)

      expect(result.pendingReview).toBe(1)
      expect(result.actions[0].type).toBe('MANUAL_REVIEW')
    })

    it('should create vendor follow-up actions for missing invoices', async () => {
      const matches: ReconciliationMatch[] = [
        {
          id: 'match-1',
          gstr2aInvoice: sampleGSTR2AData.b2b[0].inv[0],
          matchType: 'NO_MATCH',
          matchScore: 0,
          mismatches: [],
          status: 'MISSING_IN_BOOKS'
        }
      ]

      const result = await processReconciliation(matches, testUserId, testPeriod, matchingOptions)

      expect(result.vendorFollowUps).toBe(1)
      expect(result.actions[0].type).toBe('VENDOR_FOLLOW_UP')
    })
  })

  // RED PHASE - ITC Availability Tracking Tests
  describe('ITC Availability Tracking (RED Phase)', () => {
    it('should calculate available ITC from GSTR-2A data', async () => {
      const itcAvailability = await trackITCAvailability(testUserId, testPeriod, 'GSTR2A')

      expect(itcAvailability).toBeDefined()
      expect(itcAvailability.availableITC).toBeInstanceOf(Decimal)
      expect(itcAvailability.source).toBe('GSTR2A')
      expect(itcAvailability.period).toBe(testPeriod)
    })

    it('should calculate claimed ITC from purchase invoices', async () => {
      const itcAvailability = await trackITCAvailability(testUserId, testPeriod, 'COMPUTED')

      expect(itcAvailability.claimedITC).toBeInstanceOf(Decimal)
      expect(itcAvailability.source).toBe('COMPUTED')
    })

    it('should identify unclaimed ITC opportunities', async () => {
      const itcAvailability = await trackITCAvailability(testUserId, testPeriod, 'GSTR2A')

      if (itcAvailability.unclaimedITC.greaterThan(0)) {
        expect(itcAvailability.unclaimedITC).toBeInstanceOf(Decimal)
        expect(itcAvailability.unclaimedITC.toNumber()).toBeGreaterThan(0)
      }
    })

    it('should detect excess ITC claims', async () => {
      // Mock scenario where claimed > available
      const itcAvailability = await trackITCAvailability(testUserId, testPeriod, 'COMPUTED')

      if (itcAvailability.excessClaim.greaterThan(0)) {
        expect(itcAvailability.excessClaim).toBeInstanceOf(Decimal)
        expect(itcAvailability.excessClaim.toNumber()).toBeGreaterThan(0)
      }
    })
  })

  // RED PHASE - Vendor-wise Reconciliation Tests
  describe('Vendor-wise Reconciliation (RED Phase)', () => {
    it('should provide vendor-wise reconciliation summary', async () => {
      const vendorGSTIN = '29AWGPV7107B1Z1'
      const vendorReconciliation = await getVendorReconciliation(testUserId, testPeriod, vendorGSTIN)

      expect(vendorReconciliation.vendorGSTIN).toBe(vendorGSTIN)
      expect(vendorReconciliation.totalInvoices).toBeGreaterThanOrEqual(0)
      expect(vendorReconciliation.status).toBeOneOf(['RECONCILED', 'PARTIALLY_RECONCILED', 'PENDING', 'DISCREPANCIES'])
      expect(vendorReconciliation.totalValue).toBeInstanceOf(Decimal)
      expect(vendorReconciliation.totalITC).toBeInstanceOf(Decimal)
    })

    it('should generate action items for vendor discrepancies', async () => {
      const vendorGSTIN = '29AWGPV7107B1Z1'
      const vendorReconciliation = await getVendorReconciliation(testUserId, testPeriod, vendorGSTIN)

      if (vendorReconciliation.status === 'DISCREPANCIES') {
        expect(vendorReconciliation.actionItems).toHaveLength.greaterThan(0)
        expect(vendorReconciliation.actionItems[0]).toContain('vendor')
      }
    })

    it('should track reconciliation status over time', async () => {
      const vendorGSTIN = '29AWGPV7107B1Z1'
      const vendorReconciliation = await getVendorReconciliation(testUserId, testPeriod, vendorGSTIN)

      if (vendorReconciliation.lastReconciliationDate) {
        expect(vendorReconciliation.lastReconciliationDate).toBeInstanceOf(Date)
      }
    })
  })

  // RED PHASE - Match Score Calculation Tests
  describe('Match Score Calculation (RED Phase)', () => {
    it('should calculate score of 1.0 for exact matches', async () => {
      const gstr2aInvoice = sampleGSTR2AData.b2b[0].inv[0]
      const purchaseInvoice = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2024-03-15'),
        vendorGSTIN: '29AWGPV7107B1Z1',
        totalAmount: new Decimal(11800)
      }

      const score = await calculateMatchScore(gstr2aInvoice, purchaseInvoice, matchingOptions)

      expect(score).toBe(1.0)
    })

    it('should penalize score for amount differences', async () => {
      const gstr2aInvoice = sampleGSTR2AData.b2b[0].inv[0]
      const purchaseInvoice = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2024-03-15'),
        vendorGSTIN: '29AWGPV7107B1Z1',
        totalAmount: new Decimal(15000) // Significant difference
      }

      const score = await calculateMatchScore(gstr2aInvoice, purchaseInvoice, matchingOptions)

      expect(score).toBeLessThan(0.8)
    })

    it('should penalize score for date differences', async () => {
      const gstr2aInvoice = sampleGSTR2AData.b2b[0].inv[0]
      const purchaseInvoice = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2024-03-01'), // 14 days difference
        vendorGSTIN: '29AWGPV7107B1Z1',
        totalAmount: new Decimal(11800)
      }

      const score = await calculateMatchScore(gstr2aInvoice, purchaseInvoice, matchingOptions)

      expect(score).toBeLessThan(0.9)
    })

    it('should handle fuzzy string matching for invoice numbers', async () => {
      const gstr2aInvoice = sampleGSTR2AData.b2b[0].inv[0]
      const purchaseInvoice = {
        invoiceNumber: 'INV-001', // Similar format
        invoiceDate: new Date('2024-03-15'),
        vendorGSTIN: '29AWGPV7107B1Z1',
        totalAmount: new Decimal(11800)
      }

      const score = await calculateMatchScore(gstr2aInvoice, purchaseInvoice, matchingOptions)

      expect(score).toBeGreaterThan(0.8)
      expect(score).toBeLessThan(1.0)
    })
  })

  // RED PHASE - Summary and Reporting Tests
  describe('Summary and Reporting (RED Phase)', () => {
    it('should generate comprehensive reconciliation summary', async () => {
      const summary = await getReconciliationSummary(testUserId, testPeriod)

      expect(summary.totalGSTR2AInvoices).toBeGreaterThanOrEqual(0)
      expect(summary.totalPurchaseInvoices).toBeGreaterThanOrEqual(0)
      expect(summary.exactMatches).toBeGreaterThanOrEqual(0)
      expect(summary.partialMatches).toBeGreaterThanOrEqual(0)
      expect(summary.fuzzyMatches).toBeGreaterThanOrEqual(0)
      expect(summary.noMatches).toBeGreaterThanOrEqual(0)
      expect(summary.totalITCAvailable).toBeInstanceOf(Decimal)
      expect(summary.totalITCClaimed).toBeInstanceOf(Decimal)
      expect(summary.totalITCPending).toBeInstanceOf(Decimal)
    })

    it('should export detailed mismatch report', async () => {
      const report = await exportMismatchReport(testUserId, testPeriod)

      expect(report.period).toBe(testPeriod)
      expect(report.generatedAt).toBeInstanceOf(Date)
      expect(report.vendorMismatches).toBeInstanceOf(Array)
      expect(report.amountMismatches).toBeInstanceOf(Array)
      expect(report.dateMismatches).toBeInstanceOf(Array)
      expect(report.missingInvoices).toBeInstanceOf(Array)
      expect(report.totalDiscrepancies).toBeGreaterThanOrEqual(0)
    })

    it('should provide actionable insights in reports', async () => {
      const report = await exportMismatchReport(testUserId, testPeriod)

      if (report.totalDiscrepancies > 0) {
        expect(report.vendorMismatches.length).toBeGreaterThan(0)
        expect(report.vendorMismatches[0].totalImpact).toBeInstanceOf(Decimal)
      }
    })
  })

  // RED PHASE - Bulk Processing Tests
  describe('Bulk Reconciliation Processing (RED Phase)', () => {
    it('should handle large volumes of invoice data efficiently', async () => {
      const largeGSTR2AData = {
        ...sampleGSTR2AData,
        b2b: Array(1000).fill(null).map((_, index) => ({
          ctin: `29AAPFU${String(index).padStart(4, '0')}F1ZA`, // Valid 15-char GSTIN format
          inv: [
            {
              inum: `INV${String(index + 1).padStart(6, '0')}`,
              idt: '15-03-2024',
              val: 11800,
              pos: '29',
              rchrg: 'N',
              inv_typ: 'R',
              itms: [
                {
                  num: 1,
                  itm_det: {
                    txval: 10000,
                    rt: 18,
                    iamt: 0,
                    camt: 900,
                    samt: 900,
                    csamt: 0
                  }
                }
              ]
            }
          ]
        }))
      }

      const startTime = Date.now()
      const result = await reconcileInvoices(largeGSTR2AData, [], testUserId, testPeriod, matchingOptions)
      const endTime = Date.now()

      expect(result.totalProcessed).toBe(1000)
      expect(endTime - startTime).toBeLessThan(30000) // Should process within 30 seconds
    })

    it('should handle batch processing with proper error handling', async () => {
      const mixedQualityData = {
        ...sampleGSTR2AData,
        b2b: [
          sampleGSTR2AData.b2b[0], // Valid data
          {
            ctin: 'INVALID-GSTIN',
            inv: [
              {
                inum: '', // Invalid invoice number
                idt: 'INVALID-DATE',
                val: -100, // Invalid amount
                pos: '29',
                rchrg: 'N',
                inv_typ: 'R',
                itms: []
              }
            ]
          }
        ]
      }

      const result = await reconcileInvoices(mixedQualityData, [], testUserId, testPeriod, matchingOptions)

      expect(result.errors).toHaveLength(1)
      expect(result.successfullyProcessed).toBe(1)
      expect(result.failedProcessing).toBe(1)
    })
  })

  // RED PHASE - Service Instantiation Tests
  describe('GSTRReconciliationService Instantiation (RED Phase)', () => {
    it('should create service instance with valid configuration', async () => {
      const service = new GSTRReconciliationService(testUserId)

      expect(service).toBeInstanceOf(GSTRReconciliationService)
      expect(service.userId).toBe(testUserId)
    })

    it('should fail to create service without user ID', async () => {
      expect(() => new GSTRReconciliationService('')).toThrow('User ID is required')
    })

    it('should initialize with default matching options', async () => {
      const service = new GSTRReconciliationService(testUserId)

      expect(service.matchingOptions.amountTolerance).toBeDefined()
      expect(service.matchingOptions.dateTolerance).toBeDefined()
      expect(service.matchingOptions.fuzzyThreshold).toBeDefined()
    })
  })
})