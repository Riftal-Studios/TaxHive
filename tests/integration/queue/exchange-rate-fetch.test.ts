import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { BullMQService } from '@/lib/queue/bullmq.service'
import { exchangeRateFetchHandler } from '@/lib/queue/handlers/exchange-rate-fetch.handler'
import { prisma } from '@/lib/prisma'
import * as exchangeRatesLib from '@/lib/exchange-rates'

// Mock exchange rate fetching
vi.mock('@/lib/exchange-rates', () => ({
  fetchRBIRates: vi.fn(),
  fetchFallbackRates: vi.fn(),
}))

describe('Exchange Rate Fetch Queue Integration', () => {
  let queueService: BullMQService

  beforeAll(async () => {
    // Initialize queue service
    queueService = new BullMQService({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    })

    // Register the exchange rate fetch handler
    await queueService.registerHandler('EXCHANGE_RATE_FETCH', exchangeRateFetchHandler)
  })

  afterAll(async () => {
    await queueService.close()
    vi.restoreAllMocks()
  })

  beforeEach(async () => {
    // Clean up exchange rates
    await prisma.exchangeRate.deleteMany()
    
    // Reset mocks
    vi.clearAllMocks()
  })

  it('should fetch exchange rates from RBI', async () => {
    const mockRates = {
      USD: { rate: 83.5, source: 'RBI' },
      EUR: { rate: 90.2, source: 'RBI' },
      GBP: { rate: 105.3, source: 'RBI' },
    }

    vi.mocked(exchangeRatesLib.fetchRBIRates).mockResolvedValue(mockRates)
    vi.mocked(exchangeRatesLib.fetchFallbackRates).mockResolvedValue({})

    const job = await queueService.enqueueJob('EXCHANGE_RATE_FETCH', {
      date: new Date(),
      currencies: ['USD', 'EUR', 'GBP'],
      source: 'RBI',
    })

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000))

    const completedJob = await queueService.getJob(job.id)
    expect(completedJob?.status).toBe('completed')
    expect(completedJob?.result).toEqual({
      success: true,
      source: 'RBI',
      ratesFetched: 3,
    })

    // Verify rates were saved to database
    const savedRates = await prisma.exchangeRate.findMany({
      orderBy: { currency: 'asc' },
    })

    expect(savedRates).toHaveLength(3)
    expect(savedRates[0].currency).toBe('EUR')
    expect(savedRates[0].rate.toNumber()).toBe(90.2)
    expect(savedRates[0].source).toBe('RBI')
  })

  it('should fallback to alternate API when RBI fails', async () => {
    const mockFallbackRates = {
      USD: { rate: 83.45, source: 'exchangerate-api.com' },
      EUR: { rate: 90.15, source: 'exchangerate-api.com' },
    }

    vi.mocked(exchangeRatesLib.fetchRBIRates).mockResolvedValue({})
    vi.mocked(exchangeRatesLib.fetchFallbackRates).mockResolvedValue(mockFallbackRates)

    const job = await queueService.enqueueJob('EXCHANGE_RATE_FETCH', {
      date: new Date(),
      currencies: ['USD', 'EUR'],
      source: 'RBI',
    })

    await new Promise(resolve => setTimeout(resolve, 1000))

    const completedJob = await queueService.getJob(job.id)
    expect(completedJob?.status).toBe('completed')
    const result = completedJob?.result as { source: string; ratesFetched: number }
    expect(result?.source).toBe('FALLBACK')
    expect(result?.ratesFetched).toBe(2)

    // Verify fallback rates were saved
    const savedRates = await prisma.exchangeRate.findMany()
    expect(savedRates).toHaveLength(2)
    expect(savedRates[0].source).toBe('exchangerate-api.com')
  })

  it('should not duplicate rates for the same date', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Pre-create an exchange rate
    await prisma.exchangeRate.create({
      data: {
        currency: 'USD',
        rate: 83.0,
        source: 'Manual',
        date: today,
      },
    })

    const mockRates = {
      USD: { rate: 83.5, source: 'RBI' },
    }

    vi.mocked(exchangeRatesLib.fetchRBIRates).mockResolvedValue(mockRates)

    const job = await queueService.enqueueJob('EXCHANGE_RATE_FETCH', {
      date: today,
      currencies: ['USD'],
      source: 'RBI',
    })

    await new Promise(resolve => setTimeout(resolve, 1000))

    // Should update existing rate, not create duplicate
    const rates = await prisma.exchangeRate.findMany({
      where: { currency: 'USD', date: today },
    })

    expect(rates).toHaveLength(1)
    expect(rates[0].rate.toNumber()).toBe(83.5)
    expect(rates[0].source).toBe('RBI')
  })

  it('should handle partial rate fetch', async () => {
    const mockRates = {
      USD: { rate: 83.5, source: 'RBI' },
      // EUR missing - simulating partial fetch
    }

    vi.mocked(exchangeRatesLib.fetchRBIRates).mockResolvedValue(mockRates)
    vi.mocked(exchangeRatesLib.fetchFallbackRates).mockResolvedValue({
      EUR: { rate: 90.2, source: 'exchangerate-api.com' },
    })

    const job = await queueService.enqueueJob('EXCHANGE_RATE_FETCH', {
      date: new Date(),
      currencies: ['USD', 'EUR'],
      source: 'RBI',
    })

    await new Promise(resolve => setTimeout(resolve, 1000))

    const completedJob = await queueService.getJob(job.id)
    expect(completedJob?.status).toBe('completed')

    const savedRates = await prisma.exchangeRate.findMany({
      orderBy: { currency: 'asc' },
    })

    expect(savedRates).toHaveLength(2)
    expect(savedRates[0].source).toBe('exchangerate-api.com') // EUR from fallback
    expect(savedRates[1].source).toBe('RBI') // USD from RBI
  })

  it('should handle complete fetch failure', async () => {
    vi.mocked(exchangeRatesLib.fetchRBIRates).mockResolvedValue({})
    vi.mocked(exchangeRatesLib.fetchFallbackRates).mockResolvedValue({})

    const job = await queueService.enqueueJob('EXCHANGE_RATE_FETCH', {
      date: new Date(),
      currencies: ['USD', 'EUR'],
      source: 'RBI',
    }, {
      attempts: 1, // Don't retry for this test
    })

    await new Promise(resolve => setTimeout(resolve, 1000))

    const completedJob = await queueService.getJob(job.id)
    expect(completedJob?.status).toBe('failed')
    expect(completedJob?.error?.message).toContain('No rates could be fetched')

    const savedRates = await prisma.exchangeRate.findMany()
    expect(savedRates).toHaveLength(0)
  })

  it('should schedule daily exchange rate fetch', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)

    const job = await queueService.enqueueJob('EXCHANGE_RATE_FETCH', {
      date: tomorrow,
      currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'AED'],
      source: 'RBI',
    }, {
      delay: tomorrow.getTime() - Date.now(),
    })

    expect(job.status).toBe('delayed')

    // Verify job is scheduled
    const stats = await queueService.getStats()
    expect(stats.delayed).toBeGreaterThan(0)
  })

  it('should clean old exchange rates', async () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 45) // 45 days old

    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 10) // 10 days old

    // Create old and recent rates
    await prisma.exchangeRate.createMany({
      data: [
        {
          currency: 'USD',
          rate: 80.0,
          source: 'RBI',
          date: oldDate,
        },
        {
          currency: 'USD',
          rate: 83.0,
          source: 'RBI',
          date: recentDate,
        },
      ],
    })

    // Fetch new rates (handler should clean old ones)
    vi.mocked(exchangeRatesLib.fetchRBIRates).mockResolvedValue({
      USD: { rate: 83.5, source: 'RBI' },
    })

    await queueService.enqueueJob('EXCHANGE_RATE_FETCH', {
      date: new Date(),
      currencies: ['USD'],
      source: 'RBI',
    })

    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify old rate was deleted
    const remainingRates = await prisma.exchangeRate.findMany({
      orderBy: { date: 'asc' },
    })

    expect(remainingRates.some(r => r.date.getTime() === oldDate.getTime())).toBe(false)
    expect(remainingRates.some(r => r.date.getTime() === recentDate.getTime())).toBe(true)
  })
})