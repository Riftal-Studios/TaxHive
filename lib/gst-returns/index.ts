/**
 * GST Returns Library
 * Central export point for all GST return generation utilities
 */

export * from './gstr1-generator'
export * from './gstr3b-generator'

// Export commonly used types from GSTR-1
export type {
  GSTR1Json,
  B2BEntry,
  B2CLEntry,
  B2CSEntry,
  ExportEntry,
  HSNData,
} from './gstr1-generator'

// Export commonly used types from GSTR-3B
export type {
  GSTR3BJson,
  SupplyDetails,
  ITCEligible,
  OutwardSupplies,
  ZeroRatedSupplies,
} from './gstr3b-generator'