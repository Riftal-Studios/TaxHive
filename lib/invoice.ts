export function generateInvoiceNumber(fiscalYear: string, sequence: number): string {
  // Extract YY-YY from YYYY-YY format (e.g., 2025-26 -> 25-26)
  const [startYear, endYear] = fiscalYear.split('-')
  const fy = `${startYear.slice(2)}-${endYear}`
  
  // Pad sequence number with zeros (minimum 3 digits for numbers less than 10)
  const paddedSequence = sequence < 10 ? sequence.toString().padStart(3, '0') : sequence.toString()
  
  return `FY${fy}/${paddedSequence}`
}

interface GSTInvoice {
  gstin?: string
  pan?: string
  placeOfSupply: string
  serviceCode: string
  igstRate: number
  lutNumber?: string
  lutDate?: Date
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export function validateGSTCompliance(invoice: GSTInvoice): ValidationResult {
  const errors: string[] = []
  
  // Validate GSTIN format (15 characters: 2 digits + PAN + 1 digit + Z + 1 check digit)
  if (invoice.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$/.test(invoice.gstin)) {
    errors.push('Invalid GSTIN format')
  }
  
  // Validate service code for exports (must be 8 digits)
  if (invoice.placeOfSupply.includes('Outside India') && 
      (!invoice.serviceCode || invoice.serviceCode.length !== 8 || !/^\d{8}$/.test(invoice.serviceCode))) {
    errors.push('Service code must be 8 digits for exports')
  }
  
  // Validate IGST rate for exports under LUT
  if (invoice.lutNumber && invoice.igstRate !== 0) {
    errors.push('IGST must be 0% for exports under LUT')
  }
  
  // Validate place of supply format
  if (!invoice.placeOfSupply.includes('Section 2-6') && invoice.placeOfSupply.includes('Outside India')) {
    errors.push('Place of supply must include Section 2-6 reference for exports')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}