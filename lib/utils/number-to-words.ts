/**
 * Convert numbers to words in Indian numbering system
 * Supports up to 99,99,99,999 (99 crores 99 lakhs 99 thousand 999)
 */

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']

function convertLessThanThousand(num: number): string {
  if (num === 0) return ''
  
  const result: string[] = []
  
  // Handle hundreds
  if (num >= 100) {
    result.push(ones[Math.floor(num / 100)])
    result.push('Hundred')
    num %= 100
  }
  
  // Handle tens and ones
  if (num >= 20) {
    result.push(tens[Math.floor(num / 10)])
    num %= 10
  } else if (num >= 10) {
    result.push(teens[num - 10])
    return result.join(' ')
  }
  
  if (num > 0) {
    result.push(ones[num])
  }
  
  return result.join(' ')
}

export function numberToWordsIndian(num: number): string {
  if (num === 0) return 'Zero'
  
  // Handle decimal part separately
  const intPart = Math.floor(num)
  const decimalPart = Math.round((num - intPart) * 100)
  
  const parts: string[] = []
  
  // Handle crores (1,00,00,000)
  if (intPart >= 10000000) {
    const crores = Math.floor(intPart / 10000000)
    parts.push(convertLessThanThousand(crores))
    parts.push(crores === 1 ? 'Crore' : 'Crores')
  }
  
  // Handle lakhs (1,00,000)
  const remainingAfterCrores = intPart % 10000000
  if (remainingAfterCrores >= 100000) {
    const lakhs = Math.floor(remainingAfterCrores / 100000)
    parts.push(convertLessThanThousand(lakhs))
    parts.push(lakhs === 1 ? 'Lakh' : 'Lakhs')
  }
  
  // Handle thousands (1,000)
  const remainingAfterLakhs = remainingAfterCrores % 100000
  if (remainingAfterLakhs >= 1000) {
    const thousands = Math.floor(remainingAfterLakhs / 1000)
    parts.push(convertLessThanThousand(thousands))
    parts.push('Thousand')
  }
  
  // Handle remaining (less than 1000)
  const remaining = remainingAfterLakhs % 1000
  if (remaining > 0) {
    parts.push(convertLessThanThousand(remaining))
  }
  
  let result = parts.join(' ')
  
  // Add decimal part if exists
  if (decimalPart > 0) {
    result += ' and ' + convertLessThanThousand(decimalPart) + ' Paise'
  }
  
  return result
}

export function numberToWordsInternational(num: number): string {
  if (num === 0) return 'Zero'
  
  const intPart = Math.floor(num)
  const decimalPart = Math.round((num - intPart) * 100)
  
  const parts: string[] = []
  
  // Handle millions
  if (intPart >= 1000000) {
    const millions = Math.floor(intPart / 1000000)
    parts.push(convertLessThanThousand(millions))
    parts.push(millions === 1 ? 'Million' : 'Million')
  }
  
  // Handle thousands
  const remainingAfterMillions = intPart % 1000000
  if (remainingAfterMillions >= 1000) {
    const thousands = Math.floor(remainingAfterMillions / 1000)
    parts.push(convertLessThanThousand(thousands))
    parts.push('Thousand')
  }
  
  // Handle remaining
  const remaining = remainingAfterMillions % 1000
  if (remaining > 0) {
    parts.push(convertLessThanThousand(remaining))
  }
  
  let result = parts.join(' ')
  
  // Add decimal part if exists
  if (decimalPart > 0) {
    result += ' and ' + decimalPart + '/100'
  }
  
  return result
}