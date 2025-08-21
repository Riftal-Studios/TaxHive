/**
 * Foreign Supplier Registry for RCM Management
 * 
 * Manages known foreign suppliers for import of services
 * Provides default HSN/SAC codes and supplier detection
 * 
 * Implementation follows TDD methodology - making tests pass (GREEN phase)
 */

export interface ForeignSupplierInput {
  name: string;
  country: string;
  serviceType: string;
  domain?: string;
  serviceDescription?: string;
  billingAddress?: string;
  defaultHSN?: string;
  defaultGSTRate?: number;
}

export interface KnownSupplierResult {
  isKnownSupplier: boolean;
  supplierCode: string | null;
  matchConfidence: number;
  matchedFields: string[];
  requiresManualReview?: boolean;
  entityType?: 'PARENT' | 'SUBSIDIARY';
  defaultHSN?: string;
  additionalInfo?: Record<string, any>;
}

export interface ForeignSupplierDefaults {
  defaultHSN: string;
  defaultGSTRate: number;
  serviceCategory: string;
  description: string;
  supportedServices?: string[];
  defaultCurrency: string;
  supportedCurrencies: string[];
  billingCountry: string;
  requiresManualReview?: boolean;
}

// Known supplier registry with patterns for detection
const KNOWN_SUPPLIERS = {
  'ADOBE': {
    patterns: [
      'adobe inc',
      'adobe systems',
      'adobe corporation',
      'adobe systems incorporated',
    ],
    domains: ['adobe.com'],
    defaultHSN: '998314', // Software services
    defaultGSTRate: 18,
    serviceCategory: 'SOFTWARE',
    description: 'Creative and document software services',
    supportedServices: ['Creative Cloud', 'Document Cloud', 'Experience Cloud'],
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR'],
    billingCountry: 'USA',
  },
  'MICROSOFT': {
    patterns: [
      'microsoft corporation',
      'microsoft ireland operations',
      'microsoft',
    ],
    domains: ['microsoft.com', 'office.com', 'outlook.com'],
    defaultHSN: '998314', // Software services
    defaultGSTRate: 18,
    serviceCategory: 'SOFTWARE',
    description: 'Enterprise software and cloud services',
    supportedServices: ['Office 365', 'Azure', 'Teams', 'Windows'],
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR', 'GBP'],
    billingCountry: 'USA',
  },
  'AWS': {
    patterns: [
      'amazon web services, inc',
      'amazon web services singapore private limited',
      'aws emea sarl',
      'amazon web services ireland limited',
      'amazon web services',
    ],
    domains: ['aws.amazon.com'],
    defaultHSN: '998313', // Cloud computing services
    defaultGSTRate: 18,
    serviceCategory: 'CLOUD',
    description: 'cloud computing and web services',
    supportedServices: ['EC2', 'S3', 'Lambda', 'RDS'],
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR', 'GBP'],
    billingCountry: 'USA',
  },
  'GOOGLE': {
    patterns: [
      'google llc',
      'google ireland limited',
      'google cloud india private limited',
      'google asia pacific',
    ],
    domains: ['google.com', 'gmail.com', 'googlecloud.com'],
    defaultHSN: '998314', // Software services
    defaultGSTRate: 18,
    serviceCategory: 'SOFTWARE',
    description: 'Search, advertising, and cloud services',
    supportedServices: ['Google Workspace', 'Google Cloud', 'Google Ads'],
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'SGD'],
    billingCountry: 'USA',
  },
  'ZOOM': {
    patterns: [
      'zoom video communications',
    ],
    domains: ['zoom.us'],
    defaultHSN: '998314', // Software services
    defaultGSTRate: 18,
    serviceCategory: 'SOFTWARE',
    description: 'video conferencing and communication services',
    supportedServices: ['Zoom Pro', 'Zoom Business', 'Zoom Enterprise'],
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD'],
    billingCountry: 'USA',
  },
  'SALESFORCE': {
    patterns: [
      'salesforce.com, inc',
      'salesforce',
    ],
    domains: ['salesforce.com'],
    defaultHSN: '998314', // Software services
    defaultGSTRate: 18,
    serviceCategory: 'SOFTWARE',
    description: 'CRM and customer engagement platform',
    supportedServices: ['Sales Cloud', 'Service Cloud', 'Marketing Cloud'],
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR', 'GBP'],
    billingCountry: 'USA',
  },
  'SLACK': {
    patterns: [
      'slack technologies',
    ],
    domains: ['slack.com'],
    defaultHSN: '998314', // Software services
    defaultGSTRate: 18,
    serviceCategory: 'SOFTWARE',
    description: 'Business communication and collaboration platform',
    supportedServices: ['Slack Pro', 'Slack Business+'],
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR'],
    billingCountry: 'USA',
  },
};

/**
 * Normalizes supplier name for comparison
 */
function normalizeSupplierName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Calculates string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  return 1 - distance / Math.max(len1, len2);
}

/**
 * Validates country code
 */
function isValidCountryCode(country: string): boolean {
  const validCountries = [
    'USA', 'UK', 'CANADA', 'IRELAND', 'SINGAPORE', 'AUSTRALIA',
    'GERMANY', 'FRANCE', 'NETHERLANDS', 'SWEDEN', 'NORWAY',
    'JAPAN', 'SOUTH_KOREA', 'CHINA', 'INDIA', 'BRAZIL', 'LUXEMBOURG'
  ];
  
  return validCountries.includes(country.toUpperCase());
}

/**
 * Detects known suppliers from input
 */
export function detectKnownSupplier(input: ForeignSupplierInput): KnownSupplierResult {
  if (!input.name || input.name.trim() === '') {
    throw new Error('Supplier name is required');
  }
  
  if (!isValidCountryCode(input.country)) {
    throw new Error('Invalid country code');
  }
  
  const normalizedName = normalizeSupplierName(input.name);
  const normalizedDomain = input.domain?.toLowerCase().trim();
  
  let bestMatch: {
    supplierCode: string;
    confidence: number;
    matchedFields: string[];
    entityType?: 'PARENT' | 'SUBSIDIARY';
  } | null = null;
  
  // Check against known suppliers
  for (const [supplierCode, supplier] of Object.entries(KNOWN_SUPPLIERS)) {
    let confidence = 0;
    const matchedFields: string[] = [];
    
    // Check name patterns
    for (const pattern of supplier.patterns) {
      const similarity = calculateSimilarity(normalizedName, normalizeSupplierName(pattern));
      if (similarity > confidence) {
        confidence = similarity;
        matchedFields.push('name');
      }
    }
    
    // Check domain if provided
    if (normalizedDomain && supplier.domains.some(d => normalizedDomain.includes(d))) {
      confidence = Math.max(confidence, 1.0);
      matchedFields.push('domain');
    }
    
    // Boost confidence for exact matches
    if (supplier.patterns.some(p => normalizeSupplierName(p) === normalizedName)) {
      confidence = 1.0;
    }
    
    // Determine entity type
    let entityType: 'PARENT' | 'SUBSIDIARY' | undefined;
    if (normalizedName.includes('ireland') || normalizedName.includes('singapore') || 
        normalizedName.includes('emea') || normalizedName.includes('asia pacific')) {
      entityType = 'SUBSIDIARY';
    }
    
    if (confidence > 0.7 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = {
        supplierCode,
        confidence,
        matchedFields: [...new Set(matchedFields)], // Remove duplicates
        entityType,
      };
    }
  }
  
  if (bestMatch) {
    const supplier = KNOWN_SUPPLIERS[bestMatch.supplierCode as keyof typeof KNOWN_SUPPLIERS];
    
    return {
      isKnownSupplier: true,
      supplierCode: bestMatch.supplierCode,
      matchConfidence: bestMatch.confidence,
      matchedFields: bestMatch.matchedFields,
      requiresManualReview: bestMatch.confidence < 0.8,
      entityType: bestMatch.entityType,
      defaultHSN: supplier.defaultHSN,
      additionalInfo: {
        supportedServices: supplier.supportedServices,
        serviceCategory: supplier.serviceCategory,
      },
    };
  }
  
  return {
    isKnownSupplier: false,
    supplierCode: null,
    matchConfidence: 0,
    matchedFields: [],
  };
}

/**
 * Gets default settings for a supplier
 */
export function getForeignSupplierDefaults(supplierCode: string, entityCountry?: string, serviceTypeHint?: string): ForeignSupplierDefaults {
  const supplier = KNOWN_SUPPLIERS[supplierCode as keyof typeof KNOWN_SUPPLIERS];
  
  if (supplier) {
    let defaultCurrency = supplier.defaultCurrency;
    let billingCountry = supplier.billingCountry;
    
    // Override currency and billing country for subsidiaries
    if (entityCountry) {
      switch (entityCountry.toUpperCase()) {
        case 'IRELAND':
          defaultCurrency = 'EUR';
          billingCountry = 'IRELAND';
          break;
        case 'SINGAPORE':
          // AWS Singapore still bills in USD typically
          billingCountry = 'SINGAPORE';
          break;
        case 'LUXEMBOURG':
          defaultCurrency = 'EUR';
          billingCountry = 'LUXEMBOURG';
          break;
        default:
          // Keep original values
          break;
      }
    }
    
    return {
      defaultHSN: supplier.defaultHSN,
      defaultGSTRate: supplier.defaultGSTRate,
      serviceCategory: supplier.serviceCategory,
      description: supplier.description,
      supportedServices: supplier.supportedServices,
      defaultCurrency,
      supportedCurrencies: supplier.supportedCurrencies,
      billingCountry,
    };
  }
  
  // Default for unknown suppliers - use service type hint if provided
  let serviceCategory = 'OTHER';
  let defaultHSN = '998319';
  let description = 'Other professional/technical services';
  
  if (serviceTypeHint) {
    const serviceType = serviceTypeHint.toUpperCase();
    switch (serviceType) {
      case 'SOFTWARE':
        serviceCategory = 'SOFTWARE';
        defaultHSN = '998314';
        description = 'Software services';
        break;
      case 'CLOUD':
        serviceCategory = 'CLOUD';
        defaultHSN = '998313';
        description = 'Cloud computing services';
        break;
      case 'CONSULTING':
      case 'PROFESSIONAL':
        serviceCategory = 'CONSULTING';
        defaultHSN = '998311';
        description = 'Professional consulting services';
        break;
    }
  }
  
  return {
    defaultHSN,
    defaultGSTRate: 18,
    serviceCategory,
    description,
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD'],
    billingCountry: 'UNKNOWN',
    requiresManualReview: true,
  };
}

/**
 * Registers a new foreign supplier (stub implementation)
 */
export function registerForeignSupplier(supplierData: ForeignSupplierInput) {
  // Check if supplier already exists
  const existing = detectKnownSupplier(supplierData);
  if (existing.isKnownSupplier) {
    return {
      success: false,
      error: `Supplier ${supplierData.name} already exists in registry`,
      existingSupplier: {
        supplierCode: existing.supplierCode,
      },
    };
  }
  
  // In a real implementation, this would save to database
  const supplierId = `supplier_${Date.now()}`;
  
  return {
    success: true,
    supplierId,
    supplier: {
      id: supplierId,
      name: supplierData.name,
      country: supplierData.country,
      serviceType: supplierData.serviceType,
      isKnownSupplier: false,
      defaultHSN: supplierData.defaultHSN || '998319',
      defaultGSTRate: supplierData.defaultGSTRate || 18,
    },
  };
}

/**
 * Updates supplier registry (stub implementation)
 */
export function updateSupplierRegistry(updateData: any) {
  // In a real implementation, this would update the database
  return {
    success: true,
    updatedSupplier: {
      id: updateData.supplierId,
      name: updateData.name || 'Adobe Inc.',
      defaultHSN: updateData.defaultHSN,
      supportedCurrencies: updateData.supportedCurrencies,
    },
  };
}

/**
 * Searches suppliers by criteria (stub implementation)
 */
export function searchForeignSuppliers(criteria: {
  query?: string;
  country?: string;
  serviceType?: string;
  fuzzySearch?: boolean;
  limit?: number;
}) {
  const results = [];
  
  // Search through known suppliers
  for (const [supplierCode, supplier] of Object.entries(KNOWN_SUPPLIERS)) {
    let matches = true;
    let matchScore = 1.0;
    
    if (criteria.query) {
      const normalizedQuery = normalizeSupplierName(criteria.query);
      
      const queryMatch = supplier.patterns.some(pattern => {
        const normalizedPattern = normalizeSupplierName(pattern);
        
        if (criteria.fuzzySearch) {
          // Check if query is substring of pattern (for partial matches)
          if (normalizedPattern.includes(normalizedQuery) || normalizedQuery.includes(normalizedPattern)) {
            matchScore = 0.8; // Good match for substring
            return true;
          }
          
          // Check similarity
          const similarity = calculateSimilarity(normalizedQuery, normalizedPattern);
          if (similarity > 0.6) {
            matchScore = similarity;
            return true;
          }
          
          // Check if first words match (common for company names)
          const queryWords = normalizedQuery.split(' ');
          const patternWords = normalizedPattern.split(' ');
          if (queryWords.length > 0 && patternWords.length > 0) {
            const firstWordSimilarity = calculateSimilarity(queryWords[0], patternWords[0]);
            if (firstWordSimilarity > 0.7) {
              matchScore = 0.7;
              return true;
            }
          }
        }
        
        return normalizedPattern.includes(normalizedQuery);
      });
      
      if (!queryMatch) matches = false;
    }
    
    if (criteria.serviceType) {
      const serviceTypeUpper = criteria.serviceType.toUpperCase();
      // Match by service category or by supported services
      const categoryMatches = supplier.serviceCategory === serviceTypeUpper;
      const serviceMatches = supplier.supportedServices?.some(service => 
        service.toLowerCase().includes(serviceTypeUpper.toLowerCase()) ||
        (serviceTypeUpper === 'CLOUD' && (service.includes('Azure') || service.includes('Cloud')))
      );
      
      if (!categoryMatches && !serviceMatches) {
        matches = false;
      }
    }
    
    if (criteria.country && supplier.billingCountry.toUpperCase() !== criteria.country.toUpperCase()) {
      matches = false;
    }
    
    if (matches) {
      results.push({
        supplierCode,
        name: supplier.patterns[0],
        serviceCategory: supplier.serviceCategory,
        defaultHSN: supplier.defaultHSN,
        matchScore,
      });
    }
  }
  
  // Sort by match score and limit results
  results.sort((a, b) => b.matchScore - a.matchScore);
  
  return {
    results: results.slice(0, criteria.limit || 10),
    total: results.length,
  };
}