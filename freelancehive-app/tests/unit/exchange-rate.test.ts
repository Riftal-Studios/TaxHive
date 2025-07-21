import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchRBIExchangeRates, fetchFallbackExchangeRates, updateExchangeRates } from '@/lib/exchange-rates'
import { prisma } from '@/lib/prisma'

// Mock fetch
global.fetch = vi.fn()

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    exchangeRate: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

describe('Exchange Rate Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchRBIExchangeRates', () => {
    it('should parse RBI API response correctly', async () => {
      const mockRBIResponse = {
        records: [
          {
            currency: 'US Dollar',
            buying_rate: '83.45',
            selling_rate: '83.55',
            date: '2024-01-15',
          },
          {
            currency: 'Euro',
            buying_rate: '91.20',
            selling_rate: '91.30',
            date: '2024-01-15',
          },
        ],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRBIResponse,
      })

      const rates = await fetchRBIExchangeRates()

      expect(rates).toHaveLength(2)
      expect(rates[0]).toEqual({
        currency: 'USD',
        rate: 83.50, // Average of buying and selling
        source: 'RBI',
      })
      expect(rates[1]).toEqual({
        currency: 'EUR',
        rate: 91.25,
        source: 'RBI',
      })
    })

    it('should handle RBI API errors gracefully', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const rates = await fetchRBIExchangeRates()
      
      expect(rates).toEqual([])
    })
  })

  describe('fetchFallbackExchangeRates', () => {
    it('should fetch rates from fallback API', async () => {
      const mockFallbackResponse = {
        rates: {
          INR: 83.50,
        },
        base: 'USD',
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFallbackResponse,
      })

      const rates = await fetchFallbackExchangeRates()

      expect(rates).toContainEqual({
        currency: 'USD',
        rate: 83.50,
        source: 'ExchangeRatesAPI',
      })
    })

    it('should calculate rates for multiple currencies', async () => {
      const mockResponses = {
        USD: { rates: { INR: 83.50 }, base: 'USD' },
        EUR: { rates: { INR: 91.25 }, base: 'EUR' },
        GBP: { rates: { INR: 106.30 }, base: 'GBP' },
      }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponses.USD,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponses.EUR,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponses.GBP,
        })

      const rates = await fetchFallbackExchangeRates()

      expect(rates).toHaveLength(3)
      expect(rates).toContainEqual({
        currency: 'USD',
        rate: 83.50,
        source: 'ExchangeRatesAPI',
      })
    })
  })

  describe('updateExchangeRates', () => {
    it('should try RBI first, then fallback', async () => {
      const mockRBIRates = [
        { currency: 'USD', rate: 83.50, source: 'RBI' },
      ]

      // Mock successful RBI fetch
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              currency: 'US Dollar',
              buying_rate: '83.45',
              selling_rate: '83.55',
              date: '2024-01-15',
            },
          ],
        }),
      })

      await updateExchangeRates()

      expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            currency_date: expect.objectContaining({
              currency: 'USD',
            }),
          }),
          create: expect.objectContaining({
            currency: 'USD',
            rate: 83.50,
            source: 'RBI',
          }),
          update: expect.objectContaining({
            rate: 83.50,
            source: 'RBI',
          }),
        })
      )
    })

    it('should use fallback when RBI fails', async () => {
      // Mock failed RBI fetch
      ;(global.fetch as any).mockRejectedValueOnce(new Error('RBI API down'))

      // Mock successful fallback fetch
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rates: { INR: 83.50 },
          base: 'USD',
        }),
      })

      await updateExchangeRates()

      expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            source: 'ExchangeRatesAPI',
          }),
        })
      )
    })

    it('should check if rates already exist for today', async () => {
      // Mock existing rate for today
      ;(prisma.exchangeRate.findFirst as any).mockResolvedValueOnce({
        id: '1',
        currency: 'USD',
        rate: 83.50,
        date: new Date(),
      })

      const result = await updateExchangeRates()

      expect(result.skipped).toBe(true)
      expect(result.message).toContain('already updated today')
    })
  })
})