import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exchangeRateFetchHandler } from '@/lib/queue/handlers/exchange-rate-fetch.handler'
import type { Job } from '@/lib/queue/types'
import * as exchangeRates from '@/lib/exchange-rates'
import { db } from '@/lib/prisma'

vi.mock('@/lib/exchange-rates')
vi.mock('@/lib/prisma', () => ({
  db: {
    exchangeRate: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

describe('Exchange Rate Fetch Handler', () => {
  const testDate = new Date('2024-01-20')
  testDate.setHours(0, 0, 0, 0) // Normalize to start of day

  const mockJob: Job = {
    id: 'job-1',
    type: 'EXCHANGE_RATE_FETCH',
    data: {
      date: testDate,
      currencies: ['USD', 'EUR', 'GBP'],
      source: 'RBI',
    },
    status: 'active',
    attempts: 1,
    maxAttempts: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch and store exchange rates from RBI successfully', async () => {
    const mockRates = {
      USD: { rate: 83.50, source: 'RBI' },
      EUR: { rate: 91.25, source: 'RBI' },
      GBP: { rate: 106.30, source: 'RBI' },
    }

    vi.mocked(exchangeRates.fetchRBIRates).mockResolvedValue(mockRates)

    const result = await exchangeRateFetchHandler(mockJob)

    // Verify RBI API call
    expect(exchangeRates.fetchRBIRates).toHaveBeenCalledWith(
      testDate,
      ['USD', 'EUR', 'GBP']
    )

    // Verify database upserts
    expect(db.exchangeRate.upsert).toHaveBeenCalledTimes(3)
    expect(db.exchangeRate.upsert).toHaveBeenCalledWith({
      where: {
        currency_date: {
          currency: 'USD',
          date: testDate,
        },
      },
      update: {
        rate: 83.50,
        source: 'RBI',
      },
      create: {
        currency: 'USD',
        date: testDate,
        rate: 83.50,
        source: 'RBI',
      },
    })

    // Verify result
    expect(result).toEqual({
      success: true,
      source: 'RBI',
      ratesFetched: 3,
      currencies: ['USD', 'EUR', 'GBP'],
      date: testDate,
    })
  })

  it('should fallback to external API when RBI fails', async () => {
    const mockFallbackRates = {
      USD: { rate: 83.45, source: 'FALLBACK' },
      EUR: { rate: 91.20, source: 'FALLBACK' },
      GBP: { rate: 106.25, source: 'FALLBACK' },
    }

    vi.mocked(exchangeRates.fetchRBIRates).mockRejectedValue(
      new Error('RBI API unavailable')
    )
    vi.mocked(exchangeRates.fetchFallbackRates).mockResolvedValue(mockFallbackRates)

    const result = await exchangeRateFetchHandler(mockJob)

    // Verify fallback call
    expect(exchangeRates.fetchFallbackRates).toHaveBeenCalledWith(
      testDate,
      ['USD', 'EUR', 'GBP']
    )

    // Verify database upserts with fallback data
    expect(db.exchangeRate.upsert).toHaveBeenCalledTimes(3)
    expect(db.exchangeRate.upsert).toHaveBeenCalledWith({
      where: {
        currency_date: {
          currency: 'USD',
          date: testDate,
        },
      },
      update: {
        rate: 83.45,
        source: 'FALLBACK',
      },
      create: {
        currency: 'USD',
        date: testDate,
        rate: 83.45,
        source: 'FALLBACK',
      },
    })

    // Verify result
    expect(result).toEqual({
      success: true,
      source: 'FALLBACK',
      ratesFetched: 3,
      currencies: ['USD', 'EUR', 'GBP'],
      date: testDate,
    })
  })

  it('should handle partial rate fetch', async () => {
    const mockRates = {
      USD: { rate: 83.50, source: 'RBI' },
      EUR: { rate: 91.25, source: 'RBI' },
      // GBP missing
    }

    vi.mocked(exchangeRates.fetchRBIRates).mockResolvedValue(mockRates)

    const result = await exchangeRateFetchHandler(mockJob)

    // Should only upsert available rates
    expect(db.exchangeRate.upsert).toHaveBeenCalledTimes(2)

    expect(result).toEqual({
      success: true,
      source: 'RBI',
      ratesFetched: 2,
      currencies: ['USD', 'EUR'],
      date: testDate,
      missingCurrencies: ['GBP'],
    })
  })

  it('should handle complete failure of both sources', async () => {
    vi.mocked(exchangeRates.fetchRBIRates).mockRejectedValue(
      new Error('RBI API unavailable')
    )
    vi.mocked(exchangeRates.fetchFallbackRates).mockRejectedValue(
      new Error('Fallback API unavailable')
    )

    await expect(exchangeRateFetchHandler(mockJob)).rejects.toThrow(
      'Failed to fetch exchange rates from all sources'
    )

    expect(db.exchangeRate.upsert).not.toHaveBeenCalled()
  })

  it('should clean old rates when specified', async () => {
    const mockJobWithCleanup = {
      ...mockJob,
      data: {
        ...mockJob.data,
        cleanOldRates: true,
        cleanOlderThan: 30, // days
      },
    }

    const mockRates = {
      USD: { rate: 83.50, source: 'RBI' },
    }

    vi.mocked(exchangeRates.fetchRBIRates).mockResolvedValue(mockRates)

    await exchangeRateFetchHandler(mockJobWithCleanup as any)

    // Verify cleanup
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30)

    expect(db.exchangeRate.deleteMany).toHaveBeenCalledWith({
      where: {
        date: {
          lt: expect.any(Date),
        },
      },
    })
  })

  it('should update progress during processing', async () => {
    const mockJobWithProgress = {
      ...mockJob,
      updateProgress: vi.fn(),
    }

    const mockRates = {
      USD: { rate: 83.50, source: 'RBI' },
      EUR: { rate: 91.25, source: 'RBI' },
      GBP: { rate: 106.30, source: 'RBI' },
    }

    vi.mocked(exchangeRates.fetchRBIRates).mockResolvedValue(mockRates)

    await exchangeRateFetchHandler(mockJobWithProgress as any)

    // Verify progress updates
    expect(mockJobWithProgress.updateProgress).toHaveBeenCalledWith(25) // Started fetching
    expect(mockJobWithProgress.updateProgress).toHaveBeenCalledWith(50) // Fetched rates
    expect(mockJobWithProgress.updateProgress).toHaveBeenCalledWith(75) // Saving to DB
    expect(mockJobWithProgress.updateProgress).toHaveBeenCalledWith(100) // Completed
  })

  it('should fetch rates for current date when date not specified', async () => {
    const mockJobNoDate = {
      ...mockJob,
      data: {
        date: undefined,
        currencies: ['USD'],
      },
    }

    const mockRates = {
      USD: { rate: 83.50, source: 'RBI' },
    }

    vi.mocked(exchangeRates.fetchRBIRates).mockResolvedValue(mockRates)

    await exchangeRateFetchHandler(mockJobNoDate as any)

    // Should use current date
    expect(exchangeRates.fetchRBIRates).toHaveBeenCalledWith(
      expect.any(Date),
      ['USD']
    )

    const callDate = vi.mocked(exchangeRates.fetchRBIRates).mock.calls[0][0]
    const today = new Date()
    expect(callDate.toDateString()).toBe(today.toDateString())
  })
})