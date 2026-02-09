import { parse } from 'node-html-parser'
import { prisma } from './prisma'
import { CURRENCY_CODES } from './constants'

interface ExchangeRate {
  currency: string
  rate: number
  source: string
}

interface ExchangeRateResult {
  rate: number
  source: string
  date: Date
}

// RBI currency name → ISO code mapping
const RBI_CURRENCY_MAP: Record<string, string> = {
  'US Dollar': 'USD',
  'Euro': 'EUR',
  'Pound Sterling': 'GBP',
  'Japanese Yen': 'JPY',
  'UAE Dirham': 'AED',
}

const RBI_SCRAPE_TIMEOUT = 10_000 // 10 seconds

/**
 * Tier 1 (Primary): Scrape RBI Reference Rate Archive
 * https://www.rbi.org.in/scripts/ReferenceRateArchive.aspx
 *
 * ASP.NET WebForms scraping: GET → extract ViewState → POST form → parse HTML table
 */
export async function scrapeRBIReferenceRates(date: Date): Promise<ExchangeRate[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RBI_SCRAPE_TIMEOUT)

  try {
    const url = 'https://www.rbi.org.in/scripts/ReferenceRateArchive.aspx'

    // Step 1: GET the page to extract ASP.NET form tokens
    const getResponse = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TaxHive/1.0)',
      },
    })

    if (!getResponse.ok) {
      console.error(`RBI page returned status ${getResponse.status}`)
      return []
    }

    const formHtml = await getResponse.text()
    const formDoc = parse(formHtml)

    // Extract ASP.NET ViewState tokens
    const viewState = formDoc.querySelector('#__VIEWSTATE')?.getAttribute('value')
    const viewStateGenerator = formDoc.querySelector('#__VIEWSTATEGENERATOR')?.getAttribute('value')
    const eventValidation = formDoc.querySelector('#__EVENTVALIDATION')?.getAttribute('value')

    if (!viewState || !eventValidation) {
      console.error('Failed to extract ASP.NET form tokens from RBI page')
      return []
    }

    // Step 2: POST form to get rates for the target date
    const dateStr = formatDateForRBI(date) // dd/mm/yyyy

    const formData = new URLSearchParams()
    formData.append('__VIEWSTATE', viewState)
    if (viewStateGenerator) formData.append('__VIEWSTATEGENERATOR', viewStateGenerator)
    formData.append('__EVENTVALIDATION', eventValidation)
    formData.append('ctl00$ContentPlaceHolder1$ddlCurrency', 'All')
    formData.append('ctl00$ContentPlaceHolder1$txtFromDate', dateStr)
    formData.append('ctl00$ContentPlaceHolder1$txtToDate', dateStr)
    formData.append('ctl00$ContentPlaceHolder1$btnSubmit', 'Submit')

    const postResponse = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; TaxHive/1.0)',
      },
      body: formData.toString(),
    })

    if (!postResponse.ok) {
      console.error(`RBI POST returned status ${postResponse.status}`)
      return []
    }

    const tableHtml = await postResponse.text()
    return parseRBIRatesTable(tableHtml)
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('RBI scraping timed out after 10 seconds')
    } else {
      console.error('Failed to scrape RBI reference rates:', error)
    }
    return []
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Parse the RBI reference rates HTML table into ExchangeRate[]
 */
function parseRBIRatesTable(html: string): ExchangeRate[] {
  const doc = parse(html)
  const table = doc.querySelector('#ContentPlaceHolder1_GridView1')

  if (!table) {
    return []
  }

  const rates: ExchangeRate[] = []
  const rows = table.querySelectorAll('tr')

  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td')
    if (cells.length < 2) continue

    const currencyName = cells[0].text.trim()
    const rateStr = cells[1].text.trim()

    const currencyCode = RBI_CURRENCY_MAP[currencyName]
    if (!currencyCode) continue

    const rate = parseFloat(rateStr)
    if (isNaN(rate) || rate <= 0) continue

    rates.push({
      currency: currencyCode,
      rate,
      source: 'RBI',
    })
  }

  return rates
}

/**
 * Format date as dd/mm/yyyy for RBI form submission
 */
function formatDateForRBI(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Format date as yyyy-mm-dd for Frankfurter API
 */
function formatDateISO(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Tier 2 (Supplementary + Fallback): Frankfurter API (ECB rates)
 * Covers CAD, AUD, SGD and serves as fallback when RBI scraping fails.
 * Free, no API key, supports historical dates.
 */
export async function fetchFrankfurterRates(date: Date, currencies: string[]): Promise<ExchangeRate[]> {
  if (currencies.length === 0) return []

  const dateStr = formatDateISO(date)
  const rates: ExchangeRate[] = []

  const results = await Promise.allSettled(
    currencies.map(async (currency) => {
      const response = await fetch(
        `https://api.frankfurter.dev/v1/${dateStr}?base=${currency}&symbols=INR`
      )

      if (!response.ok) {
        console.error(`Frankfurter API error for ${currency}: ${response.status}`)
        return null
      }

      const data = await response.json()

      if (data.rates?.INR) {
        return {
          currency,
          rate: data.rates.INR as number,
          source: 'ECB/Frankfurter',
        }
      }
      return null
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      rates.push(result.value)
    }
  }

  return rates
}

/**
 * Tier 3 (Last resort): Open ExchangeRate API
 * Latest rates only (no historical). Free, no key.
 */
export async function fetchOpenERRates(currencies: string[]): Promise<ExchangeRate[]> {
  const rates: ExchangeRate[] = []

  for (const currency of currencies) {
    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${currency}`)

      if (!response.ok) {
        console.error(`Open ER API error for ${currency}: ${response.status}`)
        continue
      }

      const data = await response.json()

      if (data.rates?.INR) {
        rates.push({
          currency,
          rate: data.rates.INR as number,
          source: 'ExchangeRate-API',
        })
      }
    } catch (error) {
      console.error(`Failed to fetch Open ER rate for ${currency}:`, error)
    }
  }

  return rates
}

/**
 * Self-healing exchange rate lookup:
 * 1. Check DB for exact date match
 * 2. Check DB for nearby date (within 5 days, for weekends/holidays)
 * 3. Auto-fetch from APIs (RBI → Frankfurter → Open ER)
 * 4. Save fetched rates to DB
 * 5. Fall back to most recent DB rate
 * 6. Return null only if truly nothing available
 */
export async function getOrFetchExchangeRate(
  currency: string,
  date: Date
): Promise<ExchangeRateResult | null> {
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)

  // Step 1: Check DB for exact date match
  const exactMatch = await prisma.exchangeRate.findFirst({
    where: {
      currency,
      date: {
        gte: targetDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (exactMatch) {
    return {
      rate: Number(exactMatch.rate),
      source: exactMatch.source,
      date: exactMatch.date,
    }
  }

  // Step 2: Check for nearby rate (within 5 days before target)
  const fiveDaysAgo = new Date(targetDate.getTime() - 5 * 24 * 60 * 60 * 1000)
  const nearbyRate = await prisma.exchangeRate.findFirst({
    where: {
      currency,
      date: {
        gte: fiveDaysAgo,
        lt: targetDate,
      },
    },
    orderBy: { date: 'desc' },
  })

  if (nearbyRate) {
    return {
      rate: Number(nearbyRate.rate),
      source: nearbyRate.source,
      date: nearbyRate.date,
    }
  }

  // Step 3: Auto-fetch from APIs
  let fetchedRate: ExchangeRate | null = null

  // Try RBI scrape first
  const rbiRates = await scrapeRBIReferenceRates(targetDate)
  const rbiMatch = rbiRates.find((r) => r.currency === currency)
  if (rbiMatch) {
    fetchedRate = rbiMatch
  }

  // Save all RBI rates to DB (opportunistic caching)
  if (rbiRates.length > 0) {
    await saveRatesToDB(rbiRates, targetDate)
  }

  // If not found in RBI, try Frankfurter
  if (!fetchedRate) {
    const frankfurterRates = await fetchFrankfurterRates(targetDate, [currency])
    const frankfurterMatch = frankfurterRates.find((r) => r.currency === currency)
    if (frankfurterMatch) {
      fetchedRate = frankfurterMatch
      await saveRatesToDB([frankfurterMatch], targetDate)
    }
  }

  // If still not found, try Open ER API
  if (!fetchedRate) {
    const openERRates = await fetchOpenERRates([currency])
    const openERMatch = openERRates.find((r) => r.currency === currency)
    if (openERMatch) {
      fetchedRate = openERMatch
      await saveRatesToDB([openERMatch], targetDate)
    }
  }

  if (fetchedRate) {
    return {
      rate: fetchedRate.rate,
      source: fetchedRate.source,
      date: targetDate,
    }
  }

  // Step 4: Last resort - most recent rate from DB (any date)
  const lastResortRate = await prisma.exchangeRate.findFirst({
    where: { currency },
    orderBy: { date: 'desc' },
  })

  if (lastResortRate) {
    return {
      rate: Number(lastResortRate.rate),
      source: lastResortRate.source,
      date: lastResortRate.date,
    }
  }

  // Step 5: Truly nothing available
  return null
}

/**
 * Save rates to DB via upsert
 */
async function saveRatesToDB(rates: ExchangeRate[], date: Date): Promise<void> {
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)

  await Promise.all(
    rates.map((rate) =>
      prisma.exchangeRate.upsert({
        where: {
          currency_date: {
            currency: rate.currency,
            date: targetDate,
          },
        },
        create: {
          currency: rate.currency,
          rate: rate.rate,
          source: rate.source,
          date: targetDate,
        },
        update: {
          rate: rate.rate,
          source: rate.source,
        },
      })
    )
  )
}

/**
 * Daily update: fetch rates for all supported currencies.
 * Called by cron endpoint (app/api/cron/exchange-rates/route.ts).
 */
export async function updateExchangeRates() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check if we already have rates for today
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

    const allCurrencies = Object.values(CURRENCY_CODES) as string[]
    const allRates: ExchangeRate[] = []

    // Step 1: Try RBI scrape for RBI-covered currencies
    const rbiRates = await scrapeRBIReferenceRates(today)
    allRates.push(...rbiRates)

    const fetchedCurrencies = new Set(rbiRates.map((r) => r.currency))

    // Step 2: Determine which currencies still need fetching
    const missingCurrencies = allCurrencies.filter((c) => !fetchedCurrencies.has(c))

    // Step 3: Use Frankfurter for remaining currencies (and RBI fallback)
    if (missingCurrencies.length > 0) {
      const frankfurterRates = await fetchFrankfurterRates(today, missingCurrencies)
      allRates.push(...frankfurterRates)

      for (const r of frankfurterRates) {
        fetchedCurrencies.add(r.currency)
      }
    }

    // Step 4: Use Open ER API for anything still missing
    const stillMissing = allCurrencies.filter((c) => !fetchedCurrencies.has(c))
    if (stillMissing.length > 0) {
      const openERRates = await fetchOpenERRates(stillMissing)
      allRates.push(...openERRates)
    }

    if (allRates.length === 0) {
      return {
        success: false,
        skipped: false,
        error: 'No exchange rates available from any source',
      }
    }

    // Upsert all rates to DB
    const updates = await Promise.all(
      allRates.map((rate) =>
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

/**
 * Get exchange rate for a specific currency (simple DB lookup).
 * Kept for backward compatibility.
 */
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

/**
 * Wrapper for queue handler: fetch RBI rates.
 * Preserves same function signature as before.
 */
export async function fetchRBIRates(
  date: Date,
  currencies: string[]
): Promise<Record<string, { rate: number; source: string }>> {
  const rates = await scrapeRBIReferenceRates(date)
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

/**
 * Wrapper for queue handler: fetch fallback rates.
 * Preserves same function signature as before.
 */
export async function fetchFallbackRates(
  date: Date,
  currencies: string[]
): Promise<Record<string, { rate: number; source: string }>> {
  const rates = await fetchFrankfurterRates(date, currencies)
  const result: Record<string, { rate: number; source: string }> = {}

  for (const rate of rates) {
    result[rate.currency] = {
      rate: rate.rate,
      source: rate.source,
    }
  }

  return result
}
