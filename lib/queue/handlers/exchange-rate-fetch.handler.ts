import type { Job, ExchangeRateJobData } from '../types'
import { fetchRBIRates, fetchFallbackRates } from '@/lib/exchange-rates'
import { db } from '@/lib/prisma'
import Logger from '@/lib/logger'

interface ExchangeRateFetchResult {
  success: boolean
  source: 'RBI' | 'FALLBACK'
  ratesFetched: number
  currencies: string[]
  date: Date
  missingCurrencies?: string[]
}

export async function exchangeRateFetchHandler(job: Job<ExchangeRateJobData>): Promise<ExchangeRateFetchResult> {
  const { date: jobDate, currencies, cleanOldRates, cleanOlderThan } = job.data

  // Use current date if not specified
  const date = jobDate ? (jobDate instanceof Date ? jobDate : new Date(jobDate)) : new Date()
  date.setHours(0, 0, 0, 0) // Normalize to start of day

  // Update progress if available
  const updateProgress = (job as { updateProgress?: (progress: number) => Promise<void> }).updateProgress
  if (updateProgress) {
    await updateProgress(25)
  }

  let rates: Record<string, { rate: number; source: string }> = {}
  let actualSource: 'RBI' | 'FALLBACK' = 'RBI'

  try {
    // Try RBI first
    rates = await fetchRBIRates(date, currencies)
  } catch (error) {
    Logger.error('RBI API failed:', error)
    
    // Fallback to external API
    try {
      rates = await fetchFallbackRates(date, currencies)
      actualSource = 'FALLBACK'
    } catch (fallbackError) {
      Logger.error('Fallback API also failed:', fallbackError)
      throw new Error('Failed to fetch exchange rates from all sources')
    }
  }

  if (updateProgress) {
    await updateProgress(50)
  }

  // Save rates to database
  if (updateProgress) {
    await updateProgress(75)
  }

  const savedCurrencies: string[] = []
  const missingCurrencies: string[] = []

  for (const currency of currencies) {
    if (rates[currency]) {
      await db.exchangeRate.upsert({
        where: {
          currency_date: {
            currency,
            date,
          },
        },
        update: {
          rate: rates[currency].rate,
          source: rates[currency].source,
        },
        create: {
          currency,
          date,
          rate: rates[currency].rate,
          source: rates[currency].source,
        },
      })
      savedCurrencies.push(currency)
    } else {
      missingCurrencies.push(currency)
    }
  }


  // Clean old rates if requested
  if (cleanOldRates && cleanOlderThan) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - cleanOlderThan)
    
    await db.exchangeRate.deleteMany({
      where: {
        date: {
          lt: cutoffDate,
        },
      },
    })
  }

  if (updateProgress) {
    await updateProgress(100)
  }

  const result: ExchangeRateFetchResult = {
    success: true,
    source: actualSource,
    ratesFetched: savedCurrencies.length,
    currencies: savedCurrencies,
    date,
  }

  if (missingCurrencies.length > 0) {
    result.missingCurrencies = missingCurrencies
  }

  return result
}