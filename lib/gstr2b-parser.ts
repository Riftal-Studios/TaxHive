/**
 * GSTR-2B JSON Parser
 *
 * Parses GSTR-2B JSON files downloaded from the GST Portal.
 * Extracts B2B invoices, Credit/Debit notes, and Import entries.
 */

/**
 * GSTR-2B JSON structure from GST Portal
 */
export interface GSTR2BJson {
  gstin: string
  fp: string // Filing period (MMYYYY)
  // B2B - Inward supplies from registered suppliers
  b2b?: GSTR2BSupplier[]
  // B2BA - Amended B2B invoices
  b2ba?: GSTR2BSupplier[]
  // CDNR - Credit/Debit notes from registered suppliers
  cdnr?: GSTR2BCreditDebitNote[]
  // CDNRA - Amended credit/debit notes
  cdnra?: GSTR2BCreditDebitNote[]
  // IMPG - Import of goods
  impg?: GSTR2BImport[]
  // IMPGSEZ - Import from SEZ
  impgsez?: GSTR2BImport[]
}

interface GSTR2BSupplier {
  ctin: string // Vendor GSTIN
  trdnm?: string // Trade name
  inv: GSTR2BInvoice[]
}

interface GSTR2BInvoice {
  inum: string // Invoice number
  idt: string // Invoice date (DD-MM-YYYY)
  val: number // Invoice value
  txval: number // Taxable value
  igst?: number
  cgst?: number
  sgst?: number
  cess?: number
  itcavl?: string // ITC availability (Y/N)
  rsn?: string // Reason if ITC not available
  diffprcnt?: number // Differential percentage
  srctyp?: string // Source type (e-Invoice, etc.)
  // For amended invoices (B2BA)
  oinum?: string // Original invoice number
  oidt?: string // Original invoice date
}

interface GSTR2BCreditDebitNote {
  ctin: string
  trdnm?: string
  nt: GSTR2BNote[]
}

interface GSTR2BNote {
  ntnum: string // Note number
  ntdt: string // Note date
  val: number
  txval: number
  igst?: number
  cgst?: number
  sgst?: number
  cess?: number
  typ: string // C = Credit, D = Debit
  itcavl?: string
  rsn?: string
  // For amended notes
  ontnum?: string // Original note number
  ontdt?: string // Original note date
}

interface GSTR2BImport {
  refdt: string // Reference date
  portcd: string // Port code
  benum: string // Bill of Entry number
  bedt: string // Bill of Entry date
  txval: number
  igst?: number
  cess?: number
}

/**
 * Parsed GSTR-2B entry
 */
export interface ParsedGSTR2BEntry {
  vendorGstin: string
  vendorName?: string
  invoiceNumber: string
  invoiceDate: Date
  invoiceValue: number
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  itcAvailability?: string
  reason?: string
  supplyType: 'B2B' | 'B2BA' | 'CDNR' | 'CDNRA' | 'IMPG' | 'IMPGSEZ'
  // Additional metadata
  originalInvoiceNumber?: string
  originalInvoiceDate?: Date
  sourceType?: string
  portCode?: string
}

/**
 * Parse result
 */
export interface GSTR2BParseResult {
  success: boolean
  gstin?: string
  returnPeriod?: string
  entries: ParsedGSTR2BEntry[]
  summary?: GSTR2BSummary
  error?: string
}

interface GSTR2BSummary {
  totalInvoices: number
  totalTaxableValue: number
  totalIgst: number
  totalCgst: number
  totalSgst: number
  totalCess: number
  totalItcAvailable: number
}

/**
 * Parse GSTR-2B JSON
 */
export function parseGSTR2B(json: GSTR2BJson): GSTR2BParseResult {
  try {
    // Validate required fields
    if (!json.gstin || !json.fp) {
      return {
        success: false,
        entries: [],
        error: 'Invalid GSTR-2B JSON: missing gstin or fp (filing period)',
      }
    }

    const entries: ParsedGSTR2BEntry[] = []

    // Parse B2B invoices
    if (json.b2b && Array.isArray(json.b2b)) {
      for (const supplier of json.b2b) {
        if (supplier.inv && Array.isArray(supplier.inv)) {
          for (const invoice of supplier.inv) {
            entries.push(
              parseGSTR2BEntry(invoice, supplier.ctin, supplier.trdnm, 'B2B')
            )
          }
        }
      }
    }

    // Parse B2BA (amended B2B)
    if (json.b2ba && Array.isArray(json.b2ba)) {
      for (const supplier of json.b2ba) {
        if (supplier.inv && Array.isArray(supplier.inv)) {
          for (const invoice of supplier.inv) {
            const entry = parseGSTR2BEntry(invoice, supplier.ctin, supplier.trdnm, 'B2BA')
            if (invoice.oinum) {
              entry.originalInvoiceNumber = invoice.oinum
            }
            if (invoice.oidt) {
              entry.originalInvoiceDate = parseGSTR2BDate(invoice.oidt)
            }
            entries.push(entry)
          }
        }
      }
    }

    // Parse CDNR (credit/debit notes)
    if (json.cdnr && Array.isArray(json.cdnr)) {
      for (const supplier of json.cdnr) {
        if (supplier.nt && Array.isArray(supplier.nt)) {
          for (const note of supplier.nt) {
            entries.push(
              parseGSTR2BNoteEntry(note, supplier.ctin, supplier.trdnm, 'CDNR')
            )
          }
        }
      }
    }

    // Parse CDNRA (amended credit/debit notes)
    if (json.cdnra && Array.isArray(json.cdnra)) {
      for (const supplier of json.cdnra) {
        if (supplier.nt && Array.isArray(supplier.nt)) {
          for (const note of supplier.nt) {
            const entry = parseGSTR2BNoteEntry(note, supplier.ctin, supplier.trdnm, 'CDNRA')
            if (note.ontnum) {
              entry.originalInvoiceNumber = note.ontnum
            }
            if (note.ontdt) {
              entry.originalInvoiceDate = parseGSTR2BDate(note.ontdt)
            }
            entries.push(entry)
          }
        }
      }
    }

    // Parse IMPG (imports)
    if (json.impg && Array.isArray(json.impg)) {
      for (const imp of json.impg) {
        entries.push(parseGSTR2BImportEntry(imp, 'IMPG'))
      }
    }

    // Parse IMPGSEZ (imports from SEZ)
    if (json.impgsez && Array.isArray(json.impgsez)) {
      for (const imp of json.impgsez) {
        entries.push(parseGSTR2BImportEntry(imp, 'IMPGSEZ'))
      }
    }

    // Calculate summary
    const summary = calculateSummary(entries)

    return {
      success: true,
      gstin: json.gstin,
      returnPeriod: json.fp,
      entries,
      summary,
    }
  } catch (error) {
    return {
      success: false,
      entries: [],
      error: error instanceof Error ? error.message : 'Failed to parse GSTR-2B JSON',
    }
  }
}

/**
 * Parse a single B2B invoice entry
 */
export function parseGSTR2BEntry(
  rawEntry: GSTR2BInvoice,
  vendorGstin: string,
  vendorName: string | undefined,
  supplyType: 'B2B' | 'B2BA'
): ParsedGSTR2BEntry {
  return {
    vendorGstin,
    vendorName,
    invoiceNumber: rawEntry.inum,
    invoiceDate: parseGSTR2BDate(rawEntry.idt),
    invoiceValue: rawEntry.val,
    taxableValue: rawEntry.txval,
    igst: rawEntry.igst ?? 0,
    cgst: rawEntry.cgst ?? 0,
    sgst: rawEntry.sgst ?? 0,
    cess: rawEntry.cess ?? 0,
    itcAvailability: rawEntry.itcavl,
    reason: rawEntry.rsn || undefined,
    supplyType,
    sourceType: rawEntry.srctyp,
  }
}

/**
 * Parse a credit/debit note entry
 */
function parseGSTR2BNoteEntry(
  note: GSTR2BNote,
  vendorGstin: string,
  vendorName: string | undefined,
  supplyType: 'CDNR' | 'CDNRA'
): ParsedGSTR2BEntry {
  return {
    vendorGstin,
    vendorName,
    invoiceNumber: note.ntnum,
    invoiceDate: parseGSTR2BDate(note.ntdt),
    invoiceValue: note.val,
    taxableValue: note.txval,
    igst: note.igst ?? 0,
    cgst: note.cgst ?? 0,
    sgst: note.sgst ?? 0,
    cess: note.cess ?? 0,
    itcAvailability: note.itcavl,
    reason: note.rsn || undefined,
    supplyType,
  }
}

/**
 * Parse an import entry
 */
function parseGSTR2BImportEntry(
  imp: GSTR2BImport,
  supplyType: 'IMPG' | 'IMPGSEZ'
): ParsedGSTR2BEntry {
  return {
    vendorGstin: '', // No GSTIN for imports
    invoiceNumber: imp.benum, // Bill of Entry number
    invoiceDate: parseGSTR2BDate(imp.bedt),
    invoiceValue: imp.txval + (imp.igst ?? 0) + (imp.cess ?? 0),
    taxableValue: imp.txval,
    igst: imp.igst ?? 0,
    cgst: 0,
    sgst: 0,
    cess: imp.cess ?? 0,
    supplyType,
    portCode: imp.portcd,
  }
}

/**
 * Normalize invoice number for matching
 * Removes spaces, special characters, and converts to uppercase
 */
export function normalizeInvoiceNumber(invoiceNumber: string): string {
  if (!invoiceNumber) return ''
  return invoiceNumber
    .toString()
    .toUpperCase()
    .replace(/[\s\-\/\\\.#@_:;,|~]+/g, '')
    .trim()
}

/**
 * Parse GSTR-2B date format (DD-MM-YYYY or DD/MM/YYYY)
 */
export function parseGSTR2BDate(dateStr: string): Date {
  if (!dateStr) {
    throw new Error('Invalid date: empty string')
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY format
  const parts = dateStr.split(/[-\/]/)
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }

  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1 // JavaScript months are 0-indexed
  const year = parseInt(parts[2], 10)

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Invalid date: ${dateStr}`)
  }

  const date = new Date(year, month, day)

  // Validate the date is valid
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    throw new Error(`Invalid date: ${dateStr}`)
  }

  return date
}

/**
 * Calculate summary from parsed entries
 */
function calculateSummary(entries: ParsedGSTR2BEntry[]): GSTR2BSummary {
  let totalTaxableValue = 0
  let totalIgst = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalCess = 0
  let totalItcAvailable = 0

  for (const entry of entries) {
    totalTaxableValue += entry.taxableValue
    totalIgst += entry.igst
    totalCgst += entry.cgst
    totalSgst += entry.sgst
    totalCess += entry.cess

    // ITC available if explicitly marked as 'Y' or not specified (default available)
    if (entry.itcAvailability !== 'N') {
      totalItcAvailable += entry.igst + entry.cgst + entry.sgst
    }
  }

  return {
    totalInvoices: entries.length,
    totalTaxableValue,
    totalIgst,
    totalCgst,
    totalSgst,
    totalCess,
    totalItcAvailable,
  }
}

/**
 * Validate GSTR-2B JSON structure
 */
export function validateGSTR2BJson(json: unknown): json is GSTR2BJson {
  if (!json || typeof json !== 'object') return false

  const obj = json as Record<string, unknown>

  // Required fields
  if (typeof obj.gstin !== 'string' || typeof obj.fp !== 'string') {
    return false
  }

  // GSTIN format validation (15 characters)
  if (obj.gstin.length !== 15) {
    return false
  }

  // Filing period format validation (MMYYYY - 6 characters)
  if (obj.fp.length !== 6) {
    return false
  }

  return true
}
