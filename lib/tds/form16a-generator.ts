import { Decimal } from '@prisma/client/runtime/library'
import { validatePAN, validateTAN } from './calculator'

/**
 * Form 16A Certificate Generator
 * Generates TDS certificates for non-salary payments
 */

interface DeductorDetails {
  name: string
  tan: string
  pan: string
  address: string
  email?: string
  responsiblePerson?: string
  designation?: string
}

interface DeducteeDetails {
  name: string
  pan: string
  address: string
}

interface TDSTransaction {
  paymentDate: Date
  paymentAmount: Decimal
  sectionCode: string
  tdsRate: number
  tdsAmount: Decimal
  surcharge?: Decimal
  eduCess?: Decimal
  totalTDS: Decimal
  depositDate?: Date
  depositDueDate?: Date
  challanNumber?: string
  bsrCode?: string
}

interface CertificateSummary {
  totalPayments: Decimal
  totalTDSDeducted: Decimal
  totalTDSDeposited: Decimal
}

interface Form16AData {
  certificateNumber: string
  quarter: string
  financialYear: string
  assessmentYear: string
  deductor: DeductorDetails
  deductee: DeducteeDetails
  transactions: TDSTransaction[]
  summary: CertificateSummary
  issueDate?: Date
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

interface QuarterlyStatement {
  quarter: string
  financialYear: string
  totalPayments: number
  totalTDS: number
  transactionCount: number
  sectionWiseSummary: Record<string, {
    count: number
    totalTDS: number
    totalPayments: number
  }>
  lateDeposits?: Array<{
    paymentDate: Date
    depositDate: Date
    daysLate: number
    interest: number
    penalty: number
  }>
}

interface Form16AOutput extends Form16AData {
  verificationData?: {
    certificateNumber: string
    tan: string
    pan: string
    totalTDS: number
  }
  formattedAmounts?: {
    totalPayments: string
    totalTDS: string
  }
  signature?: {
    name: string
    designation: string
    date: string
    place: string
  }
}

/**
 * Generate Form 16A certificate
 */
export function generateForm16A(data: Partial<Form16AData>): Form16AOutput {
  const result: Form16AOutput = {
    certificateNumber: data.certificateNumber || '',
    quarter: data.quarter || '',
    financialYear: data.financialYear || '',
    assessmentYear: data.assessmentYear || '',
    deductor: data.deductor || {
      name: '',
      tan: '',
      pan: '',
      address: ''
    },
    deductee: data.deductee || {
      name: '',
      pan: '',
      address: ''
    },
    transactions: data.transactions || [],
    summary: data.summary || {
      totalPayments: new Decimal(0),
      totalTDSDeducted: new Decimal(0),
      totalTDSDeposited: new Decimal(0)
    }
  }
  
  // Add verification data for QR code
  if (result.certificateNumber && result.deductor.tan && result.deductee.pan) {
    const totalTDS = result.summary.totalTDSDeducted instanceof Decimal
      ? result.summary.totalTDSDeducted.toNumber()
      : (result.summary.totalTDSDeducted || 0)
    
    result.verificationData = {
      certificateNumber: result.certificateNumber,
      tan: result.deductor.tan,
      pan: result.deductee.pan,
      totalTDS: totalTDS
    }
  }
  
  // Format amounts in Indian numbering system
  if (result.summary) {
    const totalPayments = result.summary.totalPayments instanceof Decimal
      ? result.summary.totalPayments.toNumber()
      : (result.summary.totalPayments || 0)
    const totalTDS = result.summary.totalTDSDeducted instanceof Decimal
      ? result.summary.totalTDSDeducted.toNumber()
      : (result.summary.totalTDSDeducted || 0)
    
    result.formattedAmounts = {
      totalPayments: formatIndianNumber(totalPayments),
      totalTDS: formatIndianNumber(totalTDS)
    }
  }
  
  // Add signature details
  if (data.deductor?.responsiblePerson) {
    result.signature = {
      name: data.deductor.responsiblePerson,
      designation: data.deductor.designation || 'Authorized Signatory',
      date: formatDate(data.issueDate || new Date()),
      place: 'New Delhi' // Can be made configurable
    }
  }
  
  return result
}

/**
 * Validate Form 16A data
 */
export function validateForm16AData(data: Partial<Form16AData>): ValidationResult {
  const errors: string[] = []
  
  // Validate deductor details
  if (!data.deductor?.tan) {
    errors.push('Deductor TAN is required')
  } else if (!validateTAN(data.deductor.tan)) {
    errors.push('Invalid TAN format')
  }
  
  // Validate deductee details
  if (!data.deductee?.pan) {
    errors.push('Deductee PAN is required')
  } else if (!validatePAN(data.deductee.pan)) {
    errors.push('Invalid PAN format')
  }
  
  // Validate transactions
  if (data.transactions && Array.isArray(data.transactions)) {
    for (const transaction of data.transactions) {
      // Validate TDS calculation
      if (transaction.paymentAmount && transaction.tdsRate && transaction.tdsAmount) {
        const expectedTDS = transaction.paymentAmount.mul(transaction.tdsRate).div(100)
        const tolerance = new Decimal(1) // Allow 1 rupee tolerance for rounding
        
        if (transaction.tdsAmount.sub(expectedTDS).abs().greaterThan(tolerance)) {
          errors.push('TDS amount does not match calculation')
        }
      }
      
      // Validate deposit date
      if (transaction.paymentDate && transaction.depositDate) {
        if (transaction.depositDate < transaction.paymentDate) {
          errors.push('Deposit date cannot be before payment date')
        }
      }
      
      // Validate challan details
      if (transaction.depositDate && (!transaction.challanNumber || !transaction.bsrCode)) {
        errors.push('Challan details are required for deposited TDS')
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Format certificate number
 */
export function formatCertificateNumber(
  tan: string,
  financialYear: string,
  quarter: string,
  serialNumber: number
): string {
  const paddedSerial = serialNumber.toString().padStart(3, '0')
  return `${tan}/${financialYear}/${quarter}/${paddedSerial}`
}

/**
 * Generate quarterly statement summary
 */
export function generateQuarterlyStatement(
  transactions: TDSTransaction[],
  quarter: string,
  financialYear: string
): QuarterlyStatement {
  // Filter transactions for the quarter
  const quarterTransactions = filterTransactionsByQuarter(
    transactions,
    quarter,
    financialYear
  )
  
  // Calculate totals
  let totalPayments = new Decimal(0)
  let totalTDS = new Decimal(0)
  const sectionWiseSummary: Record<string, {
    count: number
    totalTDS: number
    totalPayments: number
  }> = {}
  const lateDeposits: Array<{
    paymentDate: Date
    depositDate: Date
    daysLate: number
    interest: number
    penalty: number
  }> = []
  
  for (const transaction of quarterTransactions) {
    totalPayments = totalPayments.add(transaction.paymentAmount)
    totalTDS = totalTDS.add(transaction.totalTDS)
    
    // Update section-wise summary
    if (!sectionWiseSummary[transaction.sectionCode]) {
      sectionWiseSummary[transaction.sectionCode] = {
        count: 0,
        totalTDS: 0,
        totalPayments: 0
      }
    }
    
    sectionWiseSummary[transaction.sectionCode].count++
    sectionWiseSummary[transaction.sectionCode].totalTDS += transaction.totalTDS.toNumber()
    sectionWiseSummary[transaction.sectionCode].totalPayments += transaction.paymentAmount.toNumber()
    
    // Check for late deposits
    if (transaction.depositDate && transaction.depositDueDate) {
      const daysLate = Math.max(
        0,
        Math.floor((transaction.depositDate.getTime() - transaction.depositDueDate.getTime()) / (1000 * 60 * 60 * 24))
      )
      
      if (daysLate > 0) {
        // Calculate interest: 1.5% per month
        const monthsLate = Math.ceil(daysLate / 30)
        const interest = transaction.tdsAmount.mul(1.5).mul(monthsLate).div(100).toNumber()
        
        // Calculate penalty: Rs 200 per day (max Rs 10,000)
        const penalty = Math.min(daysLate * 200, 10000)
        
        lateDeposits.push({
          paymentDate: transaction.paymentDate,
          depositDate: transaction.depositDate,
          daysLate,
          interest,
          penalty
        })
      }
    }
  }
  
  const result: QuarterlyStatement = {
    quarter,
    financialYear,
    totalPayments: totalPayments.toNumber(),
    totalTDS: totalTDS.toNumber(),
    transactionCount: quarterTransactions.length,
    sectionWiseSummary
  }
  
  if (lateDeposits.length > 0) {
    result.lateDeposits = lateDeposits
  }
  
  return result
}

/**
 * Filter transactions by quarter
 */
function filterTransactionsByQuarter(
  transactions: TDSTransaction[],
  quarter: string,
  financialYear: string
): TDSTransaction[] {
  const fyStart = parseInt(financialYear.slice(2, 4))
  const fyEnd = parseInt(financialYear.slice(5, 7))
  
  let startMonth: number
  let endMonth: number
  let year: number
  
  switch (quarter) {
    case 'Q1':
      startMonth = 3 // April (0-indexed)
      endMonth = 5 // June
      year = 2000 + fyStart
      break
    case 'Q2':
      startMonth = 6 // July
      endMonth = 8 // September
      year = 2000 + fyStart
      break
    case 'Q3':
      startMonth = 9 // October
      endMonth = 11 // December
      year = 2000 + fyStart
      break
    case 'Q4':
      startMonth = 0 // January
      endMonth = 2 // March
      year = 2000 + fyEnd
      break
    default:
      return []
  }
  
  return transactions.filter(t => {
    const date = new Date(t.paymentDate)
    const month = date.getMonth()
    const txYear = date.getFullYear()
    
    if (quarter === 'Q4') {
      // Q4 spans year boundary
      return txYear === year && month >= startMonth && month <= endMonth
    } else {
      return txYear === year && month >= startMonth && month <= endMonth
    }
  })
}

/**
 * Format number in Indian numbering system
 */
function formatIndianNumber(num: number): string {
  const numStr = Math.floor(num).toString()
  const lastThree = numStr.substring(numStr.length - 3)
  const otherNumbers = numStr.substring(0, numStr.length - 3)
  
  if (otherNumbers !== '') {
    const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    return formatted + ',' + lastThree
  }
  
  return lastThree
}

/**
 * Format date as DD-MM-YYYY
 */
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}