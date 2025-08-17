// E-Invoice Constants and Configuration

export const GSP_PROVIDERS = {
  CLEARTAX: {
    name: 'ClearTax',
    sandboxUrl: 'https://einvoicing.internal.cleartax.co',
    productionUrl: 'https://api.cleartax.in',
    authPath: '/v2/eInvoice/authenticate',
    generatePath: '/v1/governments/einvoice/generate',
    cancelPath: '/v1/governments/einvoice/cancel',
    irnByDocPath: '/v1/governments/einvoice/irn'
  },
  VAYANA: {
    name: 'Vayana',
    sandboxUrl: 'https://gsp.adaequare.com/test',
    productionUrl: 'https://gsp.adaequare.com',
    authPath: '/gsp/authenticate',
    generatePath: '/enriched/ei/api/invoice',
    cancelPath: '/enriched/ei/api/invoice/cancel',
    irnByDocPath: '/enriched/ei/api/invoice/irn'
  },
  CYGNET: {
    name: 'Cygnet',
    sandboxUrl: 'https://gsp.cygnetgsp.in/test',
    productionUrl: 'https://gsp.cygnetgsp.in',
    authPath: '/taxpayer/authenticate',
    generatePath: '/taxpayer/einvoice',
    cancelPath: '/taxpayer/einvoice/cancel',
    irnByDocPath: '/taxpayer/einvoice/details'
  }
} as const

export type GSPProvider = keyof typeof GSP_PROVIDERS

export const EINVOICE_DOC_TYPES = {
  INV: 'Invoice',
  CRN: 'Credit Note',
  DBN: 'Debit Note'
} as const

export type EInvoiceDocType = keyof typeof EINVOICE_DOC_TYPES

export const SUPPLY_TYPES = {
  B2B: 'Business to Business',
  SEZWP: 'SEZ with payment',
  SEZWOP: 'SEZ without payment',
  EXPWP: 'Export with Payment',
  EXPWOP: 'Export without payment',
  DEXP: 'Deemed Export'
} as const

export type SupplyType = keyof typeof SUPPLY_TYPES

export const CANCEL_REASONS = {
  '1': 'Duplicate',
  '2': 'Data entry mistake',
  '3': 'Order Cancelled',
  '4': 'Others'
} as const

export type CancelReason = keyof typeof CANCEL_REASONS

export const TRANSPORT_MODES = {
  '1': 'Road',
  '2': 'Rail',
  '3': 'Air',
  '4': 'Ship'
} as const

export type TransportMode = keyof typeof TRANSPORT_MODES

export const VEHICLE_TYPES = {
  'R': 'Regular',
  'O': 'ODC (Over Dimensional Cargo)'
} as const

export type VehicleType = keyof typeof VEHICLE_TYPES

// IRP Response Codes
export const IRP_ERROR_CODES: Record<string, string> = {
  '2150': 'Duplicate IRN',
  '2151': 'Duplicate Document Number',
  '2152': 'Invalid GSTIN',
  '2153': 'Invalid Document Type',
  '2154': 'Invalid Supply Type',
  '2155': 'Invalid Document Date',
  '2156': 'Invalid Seller GSTIN',
  '2157': 'Invalid Buyer GSTIN',
  '2158': 'Invalid State Code',
  '2159': 'Invalid Pincode',
  '2160': 'HSN code is mandatory',
  '2161': 'Invalid HSN Code',
  '2162': 'Invalid Tax Rate',
  '2163': 'Invalid UQC',
  '2164': 'Invalid Amount',
  '2165': 'Total invoice value mismatch',
  '2166': 'Invalid characters in field',
  '2167': 'Field length exceeded',
  '2168': 'Invalid email format',
  '2169': 'Invalid phone number',
  '2170': 'Missing mandatory field',
  '2171': 'Cannot cancel after 24 hours',
  '2172': 'IRN already cancelled',
  '2173': 'Invalid cancel reason',
  '2174': 'System error, please retry',
  '2175': 'Invalid auth token',
  '2176': 'Token expired',
  '2177': 'Rate limit exceeded'
}

// E-Invoice JSON Schema Version
export const EINVOICE_SCHEMA_VERSION = '1.1'

// Token expiry buffer (5 minutes before actual expiry)
export const TOKEN_EXPIRY_BUFFER_MINUTES = 5

// Maximum retry attempts
export const MAX_RETRY_ATTEMPTS = 3

// Retry delay in milliseconds
export const RETRY_DELAY_MS = 5000

// E-Way Bill Distance Slabs (in KM)
export const EWAY_BILL_VALIDITY_SLABS = [
  { maxDistance: 100, validity: 1 },  // 1 day
  { maxDistance: 300, validity: 3 },  // 3 days
  { maxDistance: 500, validity: 5 },  // 5 days
  { maxDistance: 1000, validity: 10 }, // 10 days
  { maxDistance: Infinity, validity: 15 } // 15 days for >1000km
]

// Unit Quantity Codes (UQC) for GST
export const UQC_CODES: Record<string, string> = {
  'BAG': 'BAGS',
  'BAL': 'BALE',
  'BDL': 'BUNDLES',
  'BKL': 'BUCKLES',
  'BOU': 'BILLION OF UNITS',
  'BOX': 'BOX',
  'BTL': 'BOTTLES',
  'BUN': 'BUNCHES',
  'CAN': 'CANS',
  'CBM': 'CUBIC METERS',
  'CCM': 'CUBIC CENTIMETERS',
  'CMS': 'CENTIMETERS',
  'CTN': 'CARTONS',
  'DOZ': 'DOZENS',
  'DRM': 'DRUMS',
  'GGK': 'GREAT GROSS',
  'GMS': 'GRAMMES',
  'GRS': 'GROSS',
  'GYD': 'GROSS YARDS',
  'KGS': 'KILOGRAMS',
  'KLR': 'KILOLITRE',
  'KME': 'KILOMETRE',
  'LTR': 'LITRES',
  'MLT': 'MILILITRE',
  'MTR': 'METERS',
  'MTS': 'METRIC TON',
  'NOS': 'NUMBERS',
  'OTH': 'OTHERS',
  'PAC': 'PACKS',
  'PCS': 'PIECES',
  'PRS': 'PAIRS',
  'QTL': 'QUINTAL',
  'ROL': 'ROLLS',
  'SET': 'SETS',
  'SQF': 'SQUARE FEET',
  'SQM': 'SQUARE METERS',
  'SQY': 'SQUARE YARDS',
  'TBS': 'TABLETS',
  'TGM': 'TEN GROSS',
  'THD': 'THOUSANDS',
  'TON': 'TONNES',
  'TUB': 'TUBES',
  'UGS': 'US GALLONS',
  'UNT': 'UNITS',
  'YDS': 'YARDS'
}

// Default UQC for services
export const DEFAULT_SERVICE_UQC = 'OTH'

// IRN Generation Separator
export const IRN_SEPARATOR = '/'