import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  scrapeRBIReferenceRates,
  fetchFrankfurterRates,
  fetchOpenERRates,
  getOrFetchExchangeRate,
  updateExchangeRates,
  fetchRBIRates,
  fetchFallbackRates,
} from '@/lib/exchange-rates'
import { prisma } from '@/lib/prisma'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    exchangeRate: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      createMany: vi.fn(),
    },
  },
  db: {
    exchangeRate: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

// Sample RBI HTML response with reference rates table
const SAMPLE_RBI_HTML = `
<html>
<body>
<table id="ContentPlaceHolder1_GridView1">
  <tr>
    <th>Currency</th><th>15 Jan 2025</th>
  </tr>
  <tr>
    <td>US Dollar</td><td>86.1234</td>
  </tr>
  <tr>
    <td>Euro</td><td>89.4567</td>
  </tr>
  <tr>
    <td>Pound Sterling</td><td>106.7890</td>
  </tr>
  <tr>
    <td>Japanese Yen</td><td>0.5678</td>
  </tr>
  <tr>
    <td>UAE Dirham</td><td>23.4500</td>
  </tr>
</table>
</body>
</html>
`

// Sample RBI initial page with form tokens
const SAMPLE_RBI_FORM_PAGE = `
<html>
<body>
<form>
  <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="FAKE_VIEWSTATE_TOKEN" />
  <input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="FAKE_GENERATOR" />
  <input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="FAKE_VALIDATION" />
</form>
</body>
</html>
`

describe('Exchange Rate Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('scrapeRBIReferenceRates', () => {
    it('should extract ViewState tokens and POST form to get rates', async () => {
      const date = new Date('2025-01-15')

      // First call: GET form page with tokens
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_FORM_PAGE,
      })

      // Second call: POST with tokens and get rates table
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_HTML,
      })

      const rates = await scrapeRBIReferenceRates(date)

      // Should have made 2 fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // First call: GET request
      expect(mockFetch.mock.calls[0][0]).toContain('ReferenceRateArchive.aspx')

      // Second call: POST with form data
      const postCall = mockFetch.mock.calls[1]
      expect(postCall[1].method).toBe('POST')

      // Should return parsed rates
      expect(rates).toHaveLength(5)
      expect(rates).toContainEqual({
        currency: 'USD',
        rate: 86.1234,
        source: 'RBI',
      })
      expect(rates).toContainEqual({
        currency: 'EUR',
        rate: 89.4567,
        source: 'RBI',
      })
      expect(rates).toContainEqual({
        currency: 'GBP',
        rate: 106.789,
        source: 'RBI',
      })
      expect(rates).toContainEqual({
        currency: 'AED',
        rate: 23.45,
        source: 'RBI',
      })
    })

    it('should return empty array on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const rates = await scrapeRBIReferenceRates(new Date('2025-01-15'))
      expect(rates).toEqual([])
    })

    it('should return empty array on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const rates = await scrapeRBIReferenceRates(new Date('2025-01-15'))
      expect(rates).toEqual([])
    })

    it('should handle missing ViewState tokens gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><body>No tokens here</body></html>',
      })

      const rates = await scrapeRBIReferenceRates(new Date('2025-01-15'))
      expect(rates).toEqual([])
    })

    it('should handle empty table response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_FORM_PAGE,
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><body><table id="ContentPlaceHolder1_GridView1"></table></body></html>',
      })

      const rates = await scrapeRBIReferenceRates(new Date('2025-01-15'))
      expect(rates).toEqual([])
    })

    it('should map currency names to codes correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_FORM_PAGE,
      })

      const htmlWithAllCurrencies = `
<html><body>
<table id="ContentPlaceHolder1_GridView1">
  <tr><th>Currency</th><th>15 Jan 2025</th></tr>
  <tr><td>US Dollar</td><td>86.00</td></tr>
  <tr><td>Euro</td><td>89.00</td></tr>
  <tr><td>Pound Sterling</td><td>106.00</td></tr>
  <tr><td>Japanese Yen</td><td>0.57</td></tr>
  <tr><td>UAE Dirham</td><td>23.45</td></tr>
</table>
</body></html>`

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => htmlWithAllCurrencies,
      })

      const rates = await scrapeRBIReferenceRates(new Date('2025-01-15'))

      const currencies = rates.map(r => r.currency)
      expect(currencies).toContain('USD')
      expect(currencies).toContain('EUR')
      expect(currencies).toContain('GBP')
      expect(currencies).toContain('JPY')
      expect(currencies).toContain('AED')
    })

    it('should timeout after 10 seconds', async () => {
      // Verify the fetch is called with an AbortSignal
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_FORM_PAGE,
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_HTML,
      })

      await scrapeRBIReferenceRates(new Date('2025-01-15'))

      // Both calls should have AbortSignal for timeout
      expect(mockFetch.mock.calls[0][1]).toHaveProperty('signal')
      expect(mockFetch.mock.calls[1][1]).toHaveProperty('signal')
    })
  })

  describe('fetchFrankfurterRates', () => {
    it('should fetch rates for multiple currencies in parallel', async () => {
      const date = new Date('2025-01-15')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          amount: 1,
          base: 'CAD',
          date: '2025-01-15',
          rates: { INR: 62.50 },
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          amount: 1,
          base: 'AUD',
          date: '2025-01-15',
          rates: { INR: 54.30 },
        }),
      })

      const rates = await fetchFrankfurterRates(date, ['CAD', 'AUD'])

      expect(rates).toHaveLength(2)
      expect(rates).toContainEqual({
        currency: 'CAD',
        rate: 62.50,
        source: 'ECB/Frankfurter',
      })
      expect(rates).toContainEqual({
        currency: 'AUD',
        rate: 54.30,
        source: 'ECB/Frankfurter',
      })
    })

    it('should use correct URL format with date', async () => {
      const date = new Date('2025-01-15')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          amount: 1,
          base: 'USD',
          date: '2025-01-15',
          rates: { INR: 83.50 },
        }),
      })

      await fetchFrankfurterRates(date, ['USD'])

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.frankfurter.dev/v1/2025-01-15?base=USD&symbols=INR'
      )
    })

    it('should skip currencies that fail to fetch', async () => {
      const date = new Date('2025-01-15')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          amount: 1,
          base: 'CAD',
          date: '2025-01-15',
          rates: { INR: 62.50 },
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const rates = await fetchFrankfurterRates(date, ['CAD', 'SGD'])

      expect(rates).toHaveLength(1)
      expect(rates[0].currency).toBe('CAD')
    })

    it('should return empty array when all fetches fail', async () => {
      const date = new Date('2025-01-15')

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const rates = await fetchFrankfurterRates(date, ['CAD'])
      expect(rates).toEqual([])
    })
  })

  describe('fetchOpenERRates', () => {
    it('should fetch latest rates as last resort', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: 'success',
          base_code: 'CAD',
          rates: { INR: 62.50 },
        }),
      })

      const rates = await fetchOpenERRates(['CAD'])

      expect(rates).toHaveLength(1)
      expect(rates[0]).toEqual({
        currency: 'CAD',
        rate: 62.50,
        source: 'ExchangeRate-API',
      })
    })

    it('should use correct URL format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: 'success',
          base_code: 'SGD',
          rates: { INR: 63.20 },
        }),
      })

      await fetchOpenERRates(['SGD'])

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://open.er-api.com/v6/latest/SGD'
      )
    })

    it('should handle API failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API down'))

      const rates = await fetchOpenERRates(['CAD'])
      expect(rates).toEqual([])
    })

    it('should skip currencies that fail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: 'success',
          base_code: 'CAD',
          rates: { INR: 62.50 },
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const rates = await fetchOpenERRates(['CAD', 'SGD'])

      expect(rates).toHaveLength(1)
      expect(rates[0].currency).toBe('CAD')
    })
  })

  describe('getOrFetchExchangeRate', () => {
    it('should return rate from DB if exact date match exists', async () => {
      const mockRate = {
        id: '1',
        currency: 'USD',
        rate: 86.12,
        source: 'RBI',
        date: new Date('2025-01-15'),
        createdAt: new Date(),
      }

      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockRate)

      const result = await getOrFetchExchangeRate('USD', new Date('2025-01-15'))

      expect(result).toEqual({
        rate: 86.12,
        source: 'RBI',
        date: mockRate.date,
      })
    })

    it('should return nearby rate for weekends (within 5 days)', async () => {
      // Sunday Jan 19 - no exact match
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      // Nearby rate lookup returns Friday Jan 17
      const fridayRate = {
        id: '2',
        currency: 'USD',
        rate: 86.12,
        source: 'RBI',
        date: new Date('2025-01-17'),
        createdAt: new Date(),
      }
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fridayRate)

      const result = await getOrFetchExchangeRate('USD', new Date('2025-01-19'))

      expect(result).toEqual({
        rate: 86.12,
        source: 'RBI',
        date: fridayRate.date,
      })
    })

    it('should auto-fetch and save when DB has no rate', async () => {
      // No exact match
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
      // No nearby rate
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      // RBI scrape returns rate
      // GET form page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_FORM_PAGE,
      })
      // POST returns rates table
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_HTML,
      })

      // Mock upsert for saving
      ;(prisma.exchangeRate.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '3',
        currency: 'USD',
        rate: 86.1234,
        source: 'RBI',
        date: new Date('2025-01-15'),
      })

      const result = await getOrFetchExchangeRate('USD', new Date('2025-01-15'))

      expect(result).toEqual({
        rate: 86.1234,
        source: 'RBI',
        date: expect.any(Date),
      })

      // Should have saved to DB
      expect(prisma.exchangeRate.upsert).toHaveBeenCalled()
    })

    it('should fall back to Frankfurter when RBI fails', async () => {
      // No DB match
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      // RBI scrape fails
      mockFetch.mockRejectedValueOnce(new Error('RBI site down'))

      // Frankfurter succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          amount: 1,
          base: 'USD',
          date: '2025-01-15',
          rates: { INR: 86.00 },
        }),
      })

      // Mock upsert
      ;(prisma.exchangeRate.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '4',
        currency: 'USD',
        rate: 86.00,
        source: 'ECB/Frankfurter',
        date: new Date('2025-01-15'),
      })

      const result = await getOrFetchExchangeRate('USD', new Date('2025-01-15'))

      expect(result).toEqual({
        rate: 86.00,
        source: 'ECB/Frankfurter',
        date: expect.any(Date),
      })
    })

    it('should fall back to Frankfurter for non-RBI currencies like CAD', async () => {
      // No DB match
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      // RBI scrape succeeds but doesn't have CAD
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_FORM_PAGE,
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_HTML,
      })

      // Frankfurter fetches CAD
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          amount: 1,
          base: 'CAD',
          date: '2025-01-15',
          rates: { INR: 62.50 },
        }),
      })

      // Mock upsert for all rates
      ;(prisma.exchangeRate.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '5',
        currency: 'CAD',
        rate: 62.50,
        source: 'ECB/Frankfurter',
        date: new Date('2025-01-15'),
      })

      const result = await getOrFetchExchangeRate('CAD', new Date('2025-01-15'))

      expect(result).toEqual({
        rate: 62.50,
        source: 'ECB/Frankfurter',
        date: expect.any(Date),
      })
    })

    it('should return most recent DB rate when all APIs fail', async () => {
      // No exact or nearby match
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      // All fetches fail
      mockFetch.mockRejectedValue(new Error('All APIs down'))

      // Last resort: most recent rate from DB
      const oldRate = {
        id: '6',
        currency: 'USD',
        rate: 85.00,
        source: 'RBI',
        date: new Date('2025-01-10'),
        createdAt: new Date(),
      }
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(oldRate)

      const result = await getOrFetchExchangeRate('USD', new Date('2025-01-15'))

      expect(result).toEqual({
        rate: 85.00,
        source: 'RBI',
        date: oldRate.date,
      })
    })

    it('should return null when truly nothing is available', async () => {
      // No DB rates at all
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      // All fetches fail
      mockFetch.mockRejectedValue(new Error('Everything down'))

      const result = await getOrFetchExchangeRate('XYZ', new Date('2025-01-15'))

      expect(result).toBeNull()
    })
  })

  describe('updateExchangeRates', () => {
    it('should skip if rates already exist for today', async () => {
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: '1',
        currency: 'USD',
        rate: 83.50,
        date: new Date(),
      })

      const result = await updateExchangeRates()

      expect(result.skipped).toBe(true)
      expect(result.message).toContain('already updated today')
    })

    it('should try RBI scrape first, then Frankfurter for remaining currencies', async () => {
      // No existing rates
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      // RBI scrape: GET form
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_FORM_PAGE,
      })

      // RBI scrape: POST returns rates for USD, EUR, GBP, AED
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_HTML,
      })

      // Frankfurter for CAD, AUD, SGD
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ amount: 1, base: 'CAD', date: '2025-01-15', rates: { INR: 62.50 } }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ amount: 1, base: 'AUD', date: '2025-01-15', rates: { INR: 54.30 } }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ amount: 1, base: 'SGD', date: '2025-01-15', rates: { INR: 63.20 } }),
      })

      // Mock all upserts
      ;(prisma.exchangeRate.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})

      const result = await updateExchangeRates()

      expect(result.success).toBe(true)
      expect(result.skipped).toBe(false)
      // Should have upserted rates for multiple currencies
      expect(prisma.exchangeRate.upsert).toHaveBeenCalled()
    })

    it('should use Frankfurter as fallback when RBI fails completely', async () => {
      // No existing rates
      ;(prisma.exchangeRate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      // RBI scrape fails
      mockFetch.mockRejectedValueOnce(new Error('RBI site down'))

      // Frankfurter for all currencies
      const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'AED']
      for (const currency of currencies) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            amount: 1,
            base: currency,
            date: '2025-01-15',
            rates: { INR: 80.0 },
          }),
        })
      }

      ;(prisma.exchangeRate.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})

      const result = await updateExchangeRates()

      expect(result.success).toBe(true)
    })
  })

  describe('fetchRBIRates (wrapper for queue handler)', () => {
    it('should return rates in the expected Record format', async () => {
      // RBI scrape: GET form
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_FORM_PAGE,
      })

      // RBI scrape: POST returns rates
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_HTML,
      })

      const result = await fetchRBIRates(new Date('2025-01-15'), ['USD', 'EUR'])

      expect(result).toHaveProperty('USD')
      expect(result.USD).toEqual({
        rate: 86.1234,
        source: 'RBI',
      })
      expect(result).toHaveProperty('EUR')
      expect(result.EUR).toEqual({
        rate: 89.4567,
        source: 'RBI',
      })
    })

    it('should only include requested currencies', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_FORM_PAGE,
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_RBI_HTML,
      })

      const result = await fetchRBIRates(new Date('2025-01-15'), ['USD'])

      expect(Object.keys(result)).toEqual(['USD'])
    })
  })

  describe('fetchFallbackRates (wrapper for queue handler)', () => {
    it('should return rates in the expected Record format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          amount: 1,
          base: 'CAD',
          date: '2025-01-15',
          rates: { INR: 62.50 },
        }),
      })

      const result = await fetchFallbackRates(new Date('2025-01-15'), ['CAD'])

      expect(result).toHaveProperty('CAD')
      expect(result.CAD).toEqual({
        rate: 62.50,
        source: 'ECB/Frankfurter',
      })
    })
  })
})
