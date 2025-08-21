import { z } from 'zod'
import { DEFAULT_SERVICE_UQC } from './constants'

/**
 * E-Invoice JSON Schema Validation (as per IRP specifications v1.1)
 */

// Basic validations
const gstinSchema = z.string().length(15).regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
const pinCodeSchema = z.string().regex(/^[1-9][0-9]{5}$/)
const phoneSchema = z.string().regex(/^[0-9]{6,12}$/)
const emailSchema = z.string().email().max(100)
const stateCodeSchema = z.string().regex(/^[0-9]{2}$/)

// Address Schema
const addressSchema = z.object({
  addr1: z.string().min(1).max(100),
  addr2: z.string().max(100).optional(),
  loc: z.string().min(1).max(100),
  pin: pinCodeSchema,
  stcd: stateCodeSchema
})

// Seller Details Schema
const sellerSchema = z.object({
  gstin: gstinSchema,
  lglNm: z.string().min(3).max(100),
  trdNm: z.string().min(3).max(100).optional(),
  addr1: z.string().min(1).max(100),
  addr2: z.string().max(100).optional(),
  loc: z.string().min(1).max(100),
  pin: pinCodeSchema,
  stcd: stateCodeSchema,
  ph: phoneSchema.optional(),
  em: emailSchema.optional()
})

// Buyer Details Schema
const buyerSchema = z.object({
  gstin: gstinSchema.optional(), // Optional for exports
  lglNm: z.string().min(3).max(100),
  trdNm: z.string().min(3).max(100).optional(),
  pos: stateCodeSchema, // Place of supply
  addr1: z.string().min(1).max(100),
  addr2: z.string().max(100).optional(),
  loc: z.string().min(1).max(100),
  pin: z.string().max(10), // Can be foreign pincode for exports
  stcd: stateCodeSchema,
  ph: phoneSchema.optional(),
  em: emailSchema.optional()
})

// Item Details Schema
const itemSchema = z.object({
  slNo: z.string(), // Serial number
  prdDesc: z.string().max(300).optional(), // Product description
  isServc: z.enum(['Y', 'N']),
  hsnCd: z.string().min(4).max(8), // HSN/SAC code
  barcde: z.string().max(30).optional(), // Barcode
  qty: z.number().positive().optional(),
  freeQty: z.number().min(0).optional(),
  unit: z.string().max(3).optional(), // UQC code
  unitPrice: z.number().positive().optional(),
  totAmt: z.number().min(0), // Total amount
  discount: z.number().min(0).optional(),
  preTaxVal: z.number().min(0).optional(),
  assAmt: z.number().min(0), // Assessable amount
  gstRt: z.number().min(0).max(100), // GST rate
  igstAmt: z.number().min(0).optional(),
  cgstAmt: z.number().min(0).optional(),
  sgstAmt: z.number().min(0).optional(),
  cesRt: z.number().min(0).optional(),
  cesAmt: z.number().min(0).optional(),
  cesNonAdvlAmt: z.number().min(0).optional(),
  stateCesRt: z.number().min(0).optional(),
  stateCesAmt: z.number().min(0).optional(),
  stateCesNonAdvlAmt: z.number().min(0).optional(),
  othChrg: z.number().min(0).optional(),
  totItemVal: z.number().min(0), // Total item value
  orgCntry: z.string().length(2).optional(), // Origin country code
  orgState: z.string().optional(),
  prdSlNo: z.string().max(20).optional(), // Product serial number
  attribDtls: z.array(z.object({
    nm: z.string().max(100),
    val: z.string().max(100)
  })).optional()
})

// Value Details Schema
const valueDetailsSchema = z.object({
  assVal: z.number().min(0), // Assessable value
  cgstVal: z.number().min(0).optional(),
  sgstVal: z.number().min(0).optional(),
  igstVal: z.number().min(0).optional(),
  cesVal: z.number().min(0).optional(),
  stCesVal: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  othChrg: z.number().min(0).optional(),
  rndOffAmt: z.number().optional(), // Round off amount
  totInvVal: z.number().positive(), // Total invoice value
  totInvValFc: z.number().positive().optional() // Total invoice value in foreign currency
})

// Payment Details Schema
const paymentDetailsSchema = z.object({
  nm: z.string().max(100).optional(), // Bank account name
  accDet: z.string().max(18).optional(), // Bank account number
  mode: z.string().max(18).optional(), // Payment mode
  finInsBr: z.string().max(11).optional(), // IFSC code
  payTerm: z.string().max(100).optional(), // Payment terms
  payInstr: z.string().max(100).optional(), // Payment instruction
  crTrn: z.string().max(100).optional(), // Credit transfer
  dirDr: z.string().max(100).optional(), // Direct debit
  crDay: z.number().min(0).max(9999).optional(), // Credit days
  paidAmt: z.number().min(0).optional(), // Paid amount
  paymtDue: z.number().min(0).optional() // Payment due
})

// Reference Details Schema
const referenceDetailsSchema = z.object({
  invRm: z.string().max(100).optional(), // Invoice remarks
  docPerdDtls: z.object({
    invStDt: z.string(), // Invoice start date (DD/MM/YYYY)
    invEndDt: z.string() // Invoice end date (DD/MM/YYYY)
  }).optional(),
  precDocDtls: z.array(z.object({
    invNo: z.string().max(16),
    invDt: z.string(), // DD/MM/YYYY
    othRefNo: z.string().max(20).optional()
  })).optional(),
  contrDtls: z.array(z.object({
    recAdvRefr: z.string().max(20).optional(), // Receipt advice reference
    recAdvDt: z.string().optional(), // DD/MM/YYYY
    tendRefr: z.string().max(20).optional(), // Tender reference
    contrRefr: z.string().max(20).optional(), // Contract reference
    extRefr: z.string().max(20).optional(), // External reference
    projRefr: z.string().max(20).optional(), // Project reference
    poRefr: z.string().max(16).optional(), // PO reference
    poRefDt: z.string().optional() // DD/MM/YYYY
  })).optional()
})

// Additional Document Details Schema
const additionalDocDetailsSchema = z.object({
  url: z.string().max(100).optional(),
  docs: z.string().max(1000).optional(),
  info: z.string().max(1000).optional()
})

// Export Details Schema
const exportDetailsSchema = z.object({
  shipBNo: z.string().max(16).optional(), // Shipping bill number
  shipBDt: z.string().optional(), // DD/MM/YYYY
  port: z.string().max(10).optional(), // Port code
  refClm: z.enum(['Y', 'N']).optional(), // Refund claim
  forCur: z.string().length(3).optional(), // Foreign currency code
  cntCode: z.string().length(2).optional(), // Country code
  expDuty: z.number().min(0).optional() // Export duty
})

// E-Way Bill Details Schema
const ewayBillDetailsSchema = z.object({
  transId: z.string().max(15).optional(), // Transporter ID
  transName: z.string().max(100).optional(),
  transMode: z.enum(['1', '2', '3', '4']), // 1-Road, 2-Rail, 3-Air, 4-Ship
  distance: z.number().positive(), // Distance in KM
  transDocNo: z.string().max(15).optional(),
  transDocDt: z.string().optional(), // DD/MM/YYYY
  vehNo: z.string().max(20).optional(),
  vehType: z.enum(['R', 'O']).optional() // R-Regular, O-ODC
})

// Transaction Details Schema
const transactionDetailsSchema = z.object({
  taxSch: z.enum(['GST', 'NONGST']).default('GST'),
  supTyp: z.enum(['B2B', 'SEZWP', 'SEZWOP', 'EXPWP', 'EXPWOP', 'DEXP']),
  regRev: z.enum(['Y', 'N']).optional(), // Reverse charge
  ecmGstin: z.string().optional(), // E-commerce GSTIN
  igstOnIntra: z.enum(['Y', 'N']).optional() // IGST on intra-state
})

// Document Details Schema
const documentDetailsSchema = z.object({
  typ: z.enum(['INV', 'CRN', 'DBN']),
  no: z.string().min(1).max(16),
  dt: z.string() // DD/MM/YYYY format
})

// Main E-Invoice Schema
export const eInvoiceSchema = z.object({
  version: z.string().default('1.1'),
  tranDtls: transactionDetailsSchema,
  docDtls: documentDetailsSchema,
  sellerDtls: sellerSchema,
  buyerDtls: buyerSchema,
  dispDtls: addressSchema.optional(), // Dispatch details
  shipDtls: addressSchema.optional(), // Shipping details
  itemList: z.array(itemSchema).min(1),
  valDtls: valueDetailsSchema,
  payDtls: paymentDetailsSchema.optional(),
  refDtls: referenceDetailsSchema.optional(),
  addlDocDtls: additionalDocDetailsSchema.optional(),
  expDtls: exportDetailsSchema.optional(),
  ewbDtls: ewayBillDetailsSchema.optional()
})

export type EInvoicePayload = z.infer<typeof eInvoiceSchema>

/**
 * Convert invoice data to IRP JSON format
 */
export function buildEInvoicePayload(invoice: any): EInvoicePayload {
  const isExport = invoice.invoiceType === 'EXPORT'
  const isB2B = invoice.invoiceType === 'DOMESTIC_B2B'
  const isB2C = invoice.invoiceType === 'DOMESTIC_B2C'
  
  // Determine supply type
  let supplyType: string = 'B2B'
  if (isExport) {
    supplyType = invoice.paymentStatus === 'PAID' ? 'EXPWP' : 'EXPWOP'
  }
  
  // Build items list
  const items = invoice.lineItems.map((item: any, index: number) => ({
    slNo: (index + 1).toString(),
    prdDesc: item.description,
    isServc: item.serviceCode.startsWith('99') ? 'Y' : 'N', // Services start with 99
    hsnCd: item.serviceCode.substring(0, 4), // Use 4-digit HSN for exports
    qty: item.quantity.toNumber(),
    unit: item.uqc || DEFAULT_SERVICE_UQC,
    unitPrice: item.rate.toNumber(),
    totAmt: item.amount.toNumber(),
    assAmt: item.amount.toNumber(), // Assessable amount
    gstRt: isExport ? 0 : (item.igstRate || 0).toNumber(), // 0% for exports
    igstAmt: isExport ? 0 : (item.igstAmount || 0).toNumber(),
    cgstAmt: isB2B ? (item.cgstAmount || 0).toNumber() : 0,
    sgstAmt: isB2B ? (item.sgstAmount || 0).toNumber() : 0,
    totItemVal: item.amount.toNumber()
  }))
  
  // Build payload
  const payload: EInvoicePayload = {
    version: '1.1',
    tranDtls: {
      taxSch: 'GST',
      supTyp: supplyType as any,
      regRev: 'N',
      igstOnIntra: isExport ? 'N' : undefined
    },
    docDtls: {
      typ: 'INV',
      no: invoice.invoiceNumber,
      dt: formatDateForIRP(invoice.invoiceDate)
    },
    sellerDtls: {
      gstin: invoice.user.gstin,
      lglNm: invoice.user.name || 'Company Name',
      addr1: invoice.user.address || 'Address Line 1',
      loc: 'City',
      pin: '110001', // Default pincode
      stcd: '07', // Delhi state code (default)
      ph: '9999999999',
      em: invoice.user.email
    },
    buyerDtls: {
      gstin: isB2B ? invoice.buyerGSTIN : undefined,
      lglNm: invoice.client.company || invoice.client.name,
      pos: isExport ? '96' : (invoice.client.stateCode || '07'), // 96 for exports
      addr1: invoice.client.address,
      loc: invoice.client.country,
      pin: isExport ? '999999' : '110001',
      stcd: isExport ? '96' : (invoice.client.stateCode || '07'),
      ph: invoice.client.phone,
      em: invoice.client.email
    },
    itemList: items,
    valDtls: {
      assVal: invoice.subtotal.toNumber(),
      cgstVal: isB2B ? (invoice.cgstAmount || 0).toNumber() : 0,
      sgstVal: isB2B ? (invoice.sgstAmount || 0).toNumber() : 0,
      igstVal: isExport ? 0 : (invoice.igstAmount || 0).toNumber(),
      totInvVal: invoice.totalAmount.toNumber(),
      totInvValFc: isExport ? invoice.totalAmount.toNumber() : undefined
    },
    payDtls: {
      mode: 'Wire Transfer',
      payTerm: invoice.paymentTerms,
      crDay: parseInt(invoice.paymentTerms?.match(/\d+/)?.[0] || '30')
    },
    expDtls: isExport ? {
      shipBNo: invoice.shippingBillNo,
      shipBDt: invoice.shippingBillDate ? formatDateForIRP(invoice.shippingBillDate) : undefined,
      port: invoice.portCode,
      refClm: 'N',
      forCur: invoice.currency,
      cntCode: getCountryCode(invoice.client.country)
    } : undefined
  }
  
  return payload
}

/**
 * Validate e-invoice payload
 */
export function validateEInvoicePayload(payload: unknown): { valid: boolean; errors?: string[] } {
  try {
    eInvoiceSchema.parse(payload)
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      return { valid: false, errors }
    }
    return { valid: false, errors: ['Invalid payload format'] }
  }
}

/**
 * Format date for IRP (DD/MM/YYYY)
 */
function formatDateForIRP(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Get country code from country name
 */
function getCountryCode(country: string): string {
  const countryCodes: Record<string, string> = {
    'United States': 'US',
    'USA': 'US',
    'United Kingdom': 'GB',
    'UK': 'GB',
    'Canada': 'CA',
    'Australia': 'AU',
    'Germany': 'DE',
    'France': 'FR',
    'India': 'IN',
    'Singapore': 'SG',
    'UAE': 'AE',
    'Dubai': 'AE',
    'Netherlands': 'NL',
    'Switzerland': 'CH',
    'Japan': 'JP',
    'China': 'CN',
    'Hong Kong': 'HK',
    'New Zealand': 'NZ',
    'Ireland': 'IE',
    'Sweden': 'SE',
    'Norway': 'NO',
    'Denmark': 'DK',
    'Belgium': 'BE',
    'Austria': 'AT',
    'Italy': 'IT',
    'Spain': 'ES',
    'Portugal': 'PT',
    'Israel': 'IL',
    'South Africa': 'ZA',
    'Brazil': 'BR',
    'Mexico': 'MX'
  }
  
  return countryCodes[country] || 'XX'
}