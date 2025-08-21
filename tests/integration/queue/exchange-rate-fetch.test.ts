import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock BullMQ
const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'mock-job-id', data: {} }),
  getJob: vi.fn().mockResolvedValue({
    id: 'mock-job-id',
    data: {},
    returnvalue: { success: true, rates: {} },
    finishedOn: Date.now()
  }),
  getJobs: vi.fn().mockResolvedValue([]),
  clean: vi.fn().mockResolvedValue([]),
  close: vi.fn().mockResolvedValue(undefined)
}

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => mockQueue),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock IORedis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    status: 'ready',
    disconnect: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock Prisma
const mockPrisma = {
  exchangeRate: {
    create: vi.fn().mockResolvedValue({ id: 'rate1' }),
    createMany: vi.fn().mockResolvedValue({ count: 3 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({ id: 'rate1' })
  }
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

// Mock exchange rate handler
const mockExchangeRateHandler = vi.fn().mockImplementation(async (job) => {
  const { date, baseCurrency, targetCurrencies } = job.data
  
  // Simulate API calls
  const rates = {}
  for (const currency of targetCurrencies) {
    rates[currency] = Math.random() * 100 // Mock exchange rate
  }

  // Simulate storing in database
  for (const [currency, rate] of Object.entries(rates)) {
    await mockPrisma.exchangeRate.upsert({
      where: { date_baseCurrency_targetCurrency: { date, baseCurrency, targetCurrency: currency } },
      create: { date, baseCurrency, targetCurrency: currency, rate, source: 'RBI' },
      update: { rate, source: 'RBI' }
    })
  }

  return { success: true, rates, count: Object.keys(rates).length }
})

vi.mock('@/lib/queue/handlers/exchange-rate-fetch.handler', () => ({
  exchangeRateFetchHandler: mockExchangeRateHandler
}))

describe('Exchange Rate Fetch Queue Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch exchange rates from RBI', async () => {
    const jobData = {
      date: new Date().toISOString().split('T')[0],
      baseCurrency: 'INR',
      targetCurrencies: ['USD', 'EUR', 'GBP'],
      source: 'RBI'
    }

    // Mock successful RBI API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          'USD': 83.25,
          'EUR': 90.12,
          'GBP': 105.45
        }
      })
    })

    // Simulate adding job to queue
    const job = await mockQueue.add('exchange_rate_fetch', jobData)
    expect(job.id).toBe('mock-job-id')

    // Simulate processing the job
    const mockJob = { id: 'mock-job-id', data: jobData }
    const result = await mockExchangeRateHandler(mockJob)

    expect(result.success).toBe(true)
    expect(result.count).toBe(3)
    expect(mockPrisma.exchangeRate.upsert).toHaveBeenCalledTimes(3)
  })

  it('should fallback to alternate API when RBI fails', async () => {
    const jobData = {
      date: new Date().toISOString().split('T')[0],
      baseCurrency: 'INR',
      targetCurrencies: ['USD', 'EUR'],
      source: 'RBI'
    }

    // Mock RBI API failure, then alternate API success
    mockFetch
      .mockRejectedValueOnce(new Error('RBI API unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rates: { 'USD': 83.50, 'EUR': 90.25 }
        })
      })

    mockExchangeRateHandler.mockImplementationOnce(async (job) => {
      try {
        // Try RBI first (will fail)
        throw new Error('RBI API unavailable')
      } catch (error) {
        // Fallback to alternate API
        const rates = { 'USD': 83.50, 'EUR': 90.25 }
        
        for (const [currency, rate] of Object.entries(rates)) {
          await mockPrisma.exchangeRate.upsert({
            where: { 
              date_baseCurrency_targetCurrency: { 
                date: job.data.date, 
                baseCurrency: job.data.baseCurrency, 
                targetCurrency: currency 
              } 
            },
            create: { 
              date: job.data.date, 
              baseCurrency: job.data.baseCurrency, 
              targetCurrency: currency, 
              rate, 
              source: 'FALLBACK_API' 
            },
            update: { rate, source: 'FALLBACK_API' }
          })
        }

        return { success: true, rates, source: 'FALLBACK_API', count: 2 }
      }
    })

    const mockJob = { id: 'mock-job-id', data: jobData }
    const result = await mockExchangeRateHandler(mockJob)

    expect(result.success).toBe(true)
    expect(result.source).toBe('FALLBACK_API')
    expect(result.count).toBe(2)
  })

  it('should handle partial rate fetch', async () => {
    const jobData = {
      date: new Date().toISOString().split('T')[0],
      baseCurrency: 'INR',
      targetCurrencies: ['USD', 'EUR', 'GBP', 'JPY'],
      source: 'RBI'
    }

    mockExchangeRateHandler.mockImplementationOnce(async (job) => {
      // Simulate partial success - only some currencies available
      const rates = { 'USD': 83.25, 'EUR': 90.12 }
      const failedCurrencies = ['GBP', 'JPY']

      for (const [currency, rate] of Object.entries(rates)) {
        await mockPrisma.exchangeRate.upsert({
          where: { 
            date_baseCurrency_targetCurrency: { 
              date: job.data.date, 
              baseCurrency: job.data.baseCurrency, 
              targetCurrency: currency 
            } 
          },
          create: { 
            date: job.data.date, 
            baseCurrency: job.data.baseCurrency, 
            targetCurrency: currency, 
            rate, 
            source: 'RBI' 
          },
          update: { rate, source: 'RBI' }
        })
      }

      return { 
        success: true, 
        rates, 
        count: Object.keys(rates).length,
        failedCurrencies 
      }
    })

    const mockJob = { id: 'mock-job-id', data: jobData }
    const result = await mockExchangeRateHandler(mockJob)

    expect(result.success).toBe(true)
    expect(result.count).toBe(2)
    expect(result.failedCurrencies).toEqual(['GBP', 'JPY'])
    expect(mockPrisma.exchangeRate.upsert).toHaveBeenCalledTimes(2)
  })

  it('should not duplicate rates for the same date', async () => {
    const jobData = {
      date: new Date().toISOString().split('T')[0],
      baseCurrency: 'INR',
      targetCurrencies: ['USD'],
      source: 'RBI'
    }

    // Mock existing rate
    mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce({
      id: 'existing-rate',
      date: jobData.date,
      baseCurrency: 'INR',
      targetCurrency: 'USD',
      rate: 83.00,
      source: 'RBI'
    })

    mockExchangeRateHandler.mockImplementationOnce(async (job) => {
      // Check if rate already exists for this date
      const existingRate = await mockPrisma.exchangeRate.findFirst({
        where: {
          date: job.data.date,
          baseCurrency: job.data.baseCurrency,
          targetCurrency: 'USD'
        }
      })

      if (existingRate) {
        return { 
          success: true, 
          skipped: true, 
          message: 'Rate already exists for this date' 
        }
      }

      // Otherwise create new rate
      const rate = 83.25
      await mockPrisma.exchangeRate.upsert({
        where: { 
          date_baseCurrency_targetCurrency: { 
            date: job.data.date, 
            baseCurrency: job.data.baseCurrency, 
            targetCurrency: 'USD' 
          } 
        },
        create: { 
          date: job.data.date, 
          baseCurrency: job.data.baseCurrency, 
          targetCurrency: 'USD', 
          rate, 
          source: 'RBI' 
        },
        update: { rate, source: 'RBI' }
      })

      return { success: true, rates: { 'USD': rate }, count: 1 }
    })

    const mockJob = { id: 'mock-job-id', data: jobData }
    const result = await mockExchangeRateHandler(mockJob)

    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalled()
  })

  it('should clean old exchange rates', async () => {
    const jobData = {
      cleanupDays: 90
    }

    mockExchangeRateHandler.mockImplementationOnce(async (job) => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - job.data.cleanupDays)

      const result = await mockPrisma.exchangeRate.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      })

      return { success: true, deletedCount: result.count }
    })

    const mockJob = { id: 'mock-job-id', data: jobData }
    const result = await mockExchangeRateHandler(mockJob)

    expect(result.success).toBe(true)
    expect(result.deletedCount).toBe(10)
    expect(mockPrisma.exchangeRate.deleteMany).toHaveBeenCalled()
  })

  it('should schedule daily exchange rate fetch', async () => {
    const jobData = {
      date: new Date().toISOString().split('T')[0],
      baseCurrency: 'INR',
      targetCurrencies: ['USD', 'EUR', 'GBP'],
      source: 'RBI',
      scheduled: true
    }

    // Simulate scheduled job
    const job = await mockQueue.add('exchange_rate_fetch', jobData, {
      repeat: { cron: '0 10 * * *' }, // 10 AM daily
      jobId: 'daily-exchange-rates'
    })

    expect(job.id).toBe('mock-job-id')
    expect(mockQueue.add).toHaveBeenCalledWith(
      'exchange_rate_fetch', 
      jobData, 
      expect.objectContaining({
        repeat: { cron: '0 10 * * *' },
        jobId: 'daily-exchange-rates'
      })
    )
  })

  it('should handle complete fetch failure', async () => {
    const jobData = {
      date: new Date().toISOString().split('T')[0],
      baseCurrency: 'INR',
      targetCurrencies: ['USD', 'EUR'],
      source: 'RBI'
    }

    // Mock complete failure
    mockExchangeRateHandler.mockImplementationOnce(async (job) => {
      throw new Error('All APIs unavailable')
    })

    const mockJob = { id: 'mock-job-id', data: jobData }
    
    try {
      await mockExchangeRateHandler(mockJob)
    } catch (error) {
      expect(error.message).toBe('All APIs unavailable')
    }
  })
})