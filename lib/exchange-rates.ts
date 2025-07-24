import { prisma } from './prisma'
import { CURRENCY_CODES } from './constants'

interface ExchangeRate {
  currency: string
  rate: number
  source: string
}

const CURRENCY_MAP: Record<string, string> = {
  'US Dollar': 'USD',
  'Euro': 'EUR',
  'Pound Sterling': 'GBP',
  'Canadian Dollar': 'CAD',
  'Australian Dollar': 'AUD',
  'Singapore Dollar': 'SGD',
  'UAE Dirham': 'AED',
}

export async function fetchRBIExchangeRates(): Promise<ExchangeRate[]> {
  try {
    // Note: RBI API endpoint is hypothetical. In production, you'd need the actual RBI API
    // For now, we'll simulate with a mock endpoint
    const response = await fetch(process.env.RBI_API_URL || 'https://api.rbi.org.in/api/Forex/GetExchRate', {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`RBI API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Parse RBI response format
    const rates: ExchangeRate[] = []
    
    if (data.records && Array.isArray(data.records)) {
      for (const record of data.records) {
        const currencyCode = CURRENCY_MAP[record.currency]
        if (currencyCode) {
          // Calculate average of buying and selling rates
          const buyingRate = parseFloat(record.buying_rate)
          const sellingRate = parseFloat(record.selling_rate)
          const averageRate = (buyingRate + sellingRate) / 2
          
          rates.push({
            currency: currencyCode,
            rate: averageRate,
            source: 'RBI',
          })
        }
      }
    }
    
    return rates
  } catch (error) {
    console.error('Failed to fetch RBI exchange rates:', error)
    return []
  }
}

export async function fetchFallbackExchangeRates(): Promise<ExchangeRate[]> {
  const rates: ExchangeRate[] = []
  const currencies = Object.values(CURRENCY_CODES)
  
  try {
    // Use a free exchange rate API as fallback
    // In production, you'd use a proper API key
    // const apiKey = process.env.EXCHANGE_RATES_API_KEY || 'demo'
    
    for (const currency of currencies) {
      try {
        const response = await fetch(
          `https://api.exchangerate-api.com/v4/latest/${currency}`
        )
        
        if (!response.ok) continue
        
        const data = await response.json()
        
        if (data.rates && data.rates.INR) {
          rates.push({
            currency,
            rate: data.rates.INR,
            source: 'exchangerate-api.com',
          })
        }
      } catch (error) {
        console.error(`Failed to fetch rate for ${currency}:`, error)
      }
    }
    
    return rates
  } catch (error) {
    console.error('Failed to fetch fallback exchange rates:', error)
    return rates
  }
}

export async function updateExchangeRates() {
  try {
    // Check if we already have rates for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const existingRate = await prisma.exchangeRate.findFirst({
      where: {
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    })
    
    if (existingRate) {
      return {
        success: true,
        skipped: true,
        message: 'Exchange rates already updated today',
      }
    }
    
    // Try RBI first
    let rates = await fetchRBIExchangeRates()
    
    // If RBI fails or returns no rates, use fallback
    if (rates.length === 0) {
      console.log('RBI rates not available, using fallback...')
      rates = await fetchFallbackExchangeRates()
    }
    
    if (rates.length === 0) {
      throw new Error('No exchange rates available from any source')
    }
    
    // Update database
    const updates = await Promise.all(
      rates.map((rate) =>
        prisma.exchangeRate.upsert({
          where: {
            currency_date: {
              currency: rate.currency,
              date: today,
            },
          },
          create: {
            currency: rate.currency,
            rate: rate.rate,
            source: rate.source,
            date: today,
          },
          update: {
            rate: rate.rate,
            source: rate.source,
          },
        })
      )
    )
    
    return {
      success: true,
      skipped: false,
      count: updates.length,
      message: `Updated ${updates.length} exchange rates`,
    }
  } catch (error) {
    console.error('Failed to update exchange rates:', error)
    return {
      success: false,
      skipped: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Get exchange rate for a specific currency
export async function getExchangeRate(currency: string): Promise<number | null> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const rate = await prisma.exchangeRate.findFirst({
    where: {
      currency,
      date: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
  
  return rate ? Number(rate.rate) : null
}

// Export functions for queue handler
export async function fetchRBIRates(date: Date, currencies: string[]): Promise<Record<string, { rate: number; source: string }>> {
  const rates = await fetchRBIExchangeRates()
  const result: Record<string, { rate: number; source: string }> = {}
  
  for (const rate of rates) {
    if (currencies.includes(rate.currency)) {
      result[rate.currency] = {
        rate: rate.rate,
        source: rate.source,
      }
    }
  }
  
  return result
}

export async function fetchFallbackRates(date: Date, currencies: string[]): Promise<Record<string, { rate: number; source: string }>> {
  const rates = await fetchFallbackExchangeRates()
  const result: Record<string, { rate: number; source: string }> = {}
  
  for (const rate of rates) {
    if (currencies.includes(rate.currency)) {
      result[rate.currency] = {
        rate: rate.rate,
        source: rate.source,
      }
    }
  }
  
  return result
}