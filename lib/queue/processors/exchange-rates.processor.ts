import { Job } from 'bullmq'
import { ExchangeRateJobData, ExchangeRateJobResult } from '../types'
import { prisma } from '@/lib/prisma'
import { fetchRBIReferenceRates } from '@/lib/exchange-rates/rbi'
import { fetchExchangeRates } from '@/lib/exchange-rates'
import Logger from '@/lib/logger'

// Main processor function
export default async function processExchangeRates(
  job: Job<ExchangeRateJobData>
): Promise<ExchangeRateJobResult> {
  const { source, date, currencies } = job.data
  
  // Update job progress
  await job.updateProgress(10)
  
  try {
    let rates: Record<string, number> = {}
    let baseCurrency = 'INR'
    let fetchedDate = date || new Date().toISOString().split('T')[0]
    
    // Fetch rates based on source
    switch (source) {
      case 'RBI': {
        await job.updateProgress(30)
        
        // Fetch RBI reference rates
        const rbiRates = await fetchRBIReferenceRates(fetchedDate)
        
        if (!rbiRates || Object.keys(rbiRates).length === 0) {
          throw new Error('Failed to fetch RBI reference rates')
        }
        
        rates = rbiRates
        await job.updateProgress(60)
        break
      }
      
      case 'EXCHANGE_RATE_API':
      case 'CURRENCY_API':
      case 'FIXER': {
        await job.updateProgress(30)
        
        // Use the generic exchange rate fetcher
        const fetchedRates = await fetchExchangeRates(
          baseCurrency,
          currencies || ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD'],
          fetchedDate
        )
        
        if (!fetchedRates) {
          throw new Error(`Failed to fetch rates from ${source}`)
        }
        
        rates = fetchedRates.rates
        baseCurrency = fetchedRates.base
        fetchedDate = fetchedRates.date
        
        await job.updateProgress(60)
        break
      }
      
      default:
        throw new Error(`Unknown exchange rate source: ${source}`)
    }
    
    // Save rates to database
    const currenciesToSave = currencies || Object.keys(rates)
    
    for (const currency of currenciesToSave) {
      const rate = rates[currency]
      if (!rate || rate <= 0) continue
      
      // Check if rate already exists for this date
      const existing = await prisma.exchangeRate.findUnique({
        where: {
          currency_date_source: {
            currency,
            date: new Date(fetchedDate),
            source,
          },
        },
      })
      
      if (existing) {
        // Update existing rate
        await prisma.exchangeRate.update({
          where: {
            currency_date_source: {
              currency,
              date: new Date(fetchedDate),
              source,
            },
          },
          data: {
            rate,
            updatedAt: new Date(),
          },
        })
      } else {
        // Create new rate
        await prisma.exchangeRate.create({
          data: {
            currency,
            rate,
            date: new Date(fetchedDate),
            source,
            baseCurrency,
          },
        })
      }
    }
    
    await job.updateProgress(90)
    
    // Log the fetch operation
    await prisma.exchangeRateFetchLog.create({
      data: {
        source,
        date: new Date(fetchedDate),
        status: 'SUCCESS',
        currenciesFetched: currenciesToSave,
        ratesCount: currenciesToSave.length,
        metadata: {
          rates,
          baseCurrency,
        },
      },
    })
    
    await job.updateProgress(100)
    
    // Return result
    const result: ExchangeRateJobResult = {
      source,
      date: fetchedDate,
      rates,
      baseCurrency,
      fetchedAt: new Date(),
    }
    
    return result
    
  } catch (error) {
    Logger.error(`Error fetching exchange rates from ${source}:`, error)
    
    // Log failed fetch attempt
    await prisma.exchangeRateFetchLog.create({
      data: {
        source,
        date: date ? new Date(date) : new Date(),
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        currenciesFetched: [],
        ratesCount: 0,
      },
    })
    
    // Try fallback sources if RBI fails
    if (source === 'RBI') {
      Logger.queue('RBI fetch failed, attempting fallback to other sources...')
      
      // Try other sources in order of preference
      const fallbackSources = ['EXCHANGE_RATE_API', 'CURRENCY_API', 'FIXER']
      
      for (const fallbackSource of fallbackSources) {
        try {
          // Check if API key is configured
          const apiKeyEnvMap: Record<string, string> = {
            'EXCHANGE_RATE_API': 'EXCHANGE_RATE_API_KEY',
            'CURRENCY_API': 'CURRENCY_API_KEY',
            'FIXER': 'FIXER_API_KEY',
          }
          
          if (!process.env[apiKeyEnvMap[fallbackSource]]) {
            continue
          }
          
          // Recursively call with fallback source
          const fallbackJob = {
            ...job,
            data: {
              ...job.data,
              source: fallbackSource as any,
            },
          }
          
          return await processExchangeRates(fallbackJob)
        } catch (fallbackError) {
          Logger.error(`Fallback to ${fallbackSource} also failed:`, fallbackError)
          continue
        }
      }
    }
    
    throw error
  }
}