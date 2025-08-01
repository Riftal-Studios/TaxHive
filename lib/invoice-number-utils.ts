/**
 * Utility to get the next invoice number by finding the highest existing number
 */
export function getNextInvoiceSequence(invoiceNumbers: string[]): number {
  if (invoiceNumbers.length === 0) {
    return 1
  }
  
  // Extract sequence numbers from invoice numbers (format: FY24-25/123)
  const sequences = invoiceNumbers
    .map(num => {
      const match = num.match(/\/(\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    .filter(seq => !isNaN(seq))
  
  if (sequences.length === 0) {
    return 1
  }
  
  // Find the highest sequence number and add 1
  return Math.max(...sequences) + 1
}