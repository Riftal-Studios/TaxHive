/**
 * Extract field errors from Zod error in a backwards-compatible way
 * Works with both Zod v3 and v4 error structures
 */
export function extractZodFieldErrors(zodError: any): Record<string, string[]> {
  if (!zodError) return {}

  // Zod v4 uses a different structure for fieldErrors
  // v3: zodError.fieldErrors = { field: ["error1", "error2"] }
  // v4: zodError.fieldErrors might be nested or formatted differently
  
  // Try v3 format first
  if (zodError.fieldErrors && typeof zodError.fieldErrors === 'object') {
    const result: Record<string, string[]> = {}
    
    for (const [field, value] of Object.entries(zodError.fieldErrors)) {
      // In v3, value is string[]
      // In v4, it might be { _errors: string[] } or other format
      if (Array.isArray(value)) {
        result[field] = value
      } else if (value && typeof value === 'object' && '_errors' in value) {
        // v4 format
        result[field] = (value as any)._errors || []
      } else if (value) {
        // Fallback - try to extract any array
        result[field] = [String(value)]
      }
    }
    
    return result
  }

  // Try alternative format (formatted errors)
  if (zodError.format && typeof zodError.format === 'function') {
    try {
      const formatted = zodError.format()
      return extractFormattedErrors(formatted)
    } catch {
      // Ignore format errors
    }
  }

  return {}
}

function extractFormattedErrors(formatted: any, prefix = ''): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  
  if (!formatted || typeof formatted !== 'object') {
    return result
  }

  // Check for _errors at current level
  if ('_errors' in formatted && Array.isArray(formatted._errors) && formatted._errors.length > 0) {
    result[prefix || '_root'] = formatted._errors
  }

  // Recursively check nested fields
  for (const [key, value] of Object.entries(formatted)) {
    if (key === '_errors') continue
    
    const fieldKey = prefix ? `${prefix}.${key}` : key
    
    if (value && typeof value === 'object') {
      const nested = extractFormattedErrors(value, fieldKey)
      Object.assign(result, nested)
    }
  }

  return result
}

/**
 * Convert Zod field errors to a simple key-value object for form display
 * @param zodError - The Zod error object from tRPC
 * @returns Object with field names as keys and first error message as values
 */
export function zodErrorsToFormErrors<T extends Record<string, any>>(
  zodError: any
): Partial<Record<keyof T, string>> {
  const fieldErrors = extractZodFieldErrors(zodError)
  const result: Partial<Record<keyof T, string>> = {}
  
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      result[field as keyof T] = messages[0]
    }
  }
  
  return result
}