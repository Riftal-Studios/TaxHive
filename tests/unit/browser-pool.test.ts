import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Browser } from 'puppeteer'

// Mock puppeteer before importing BrowserPool
const mockBrowserClose = vi.fn()
const mockIsConnected = vi.fn(() => true)

const createMockBrowser = (id: string): Browser => ({
  close: mockBrowserClose,
  isConnected: mockIsConnected,
  _id: id, // For testing purposes
} as any)

const mockLaunch = vi.fn()

vi.mock('puppeteer', () => ({
  default: {
    launch: mockLaunch,
  },
}))

describe('BrowserPool', () => {
  let BrowserPool: any
  let getBrowserPool: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockBrowserClose.mockResolvedValue(undefined)
    mockIsConnected.mockReturnValue(true)
    mockLaunch.mockImplementation((id: string = 'browser-1') =>
      Promise.resolve(createMockBrowser(id))
    )

    // Re-import the module to get a fresh instance
    vi.resetModules()
    const module = await import('@/lib/browser-pool')
    BrowserPool = module.BrowserPool
    getBrowserPool = module.getBrowserPool
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('should create new browser when pool is empty', async () => {
    const pool = new BrowserPool({ maxBrowsers: 2 })

    const browser = await pool.acquire()

    expect(mockLaunch).toHaveBeenCalledTimes(1)
    expect(browser).toBeDefined()
    expect(browser.isConnected()).toBe(true)

    await pool.close()
  })

  it('should reuse browser from pool', async () => {
    const pool = new BrowserPool({ maxBrowsers: 2 })

    // Acquire and release a browser
    const browser1 = await pool.acquire()
    await pool.release(browser1)

    // Acquire again - should reuse the same browser
    const browser2 = await pool.acquire()

    // Should only launch once, not twice
    expect(mockLaunch).toHaveBeenCalledTimes(1)
    expect(browser2).toBe(browser1)

    await pool.close()
  })

  it('should return browser to pool on release', async () => {
    const pool = new BrowserPool({ maxBrowsers: 2 })

    const browser = await pool.acquire()
    await pool.release(browser)

    // Browser should not be closed, just returned to pool
    expect(mockBrowserClose).not.toHaveBeenCalled()

    await pool.close()
  })

  it('should not return disconnected browser to pool', async () => {
    const pool = new BrowserPool({ maxBrowsers: 2 })

    const browser = await pool.acquire()

    // Simulate browser disconnect
    mockIsConnected.mockReturnValueOnce(false)

    await pool.release(browser)

    // Should close the disconnected browser
    expect(mockBrowserClose).toHaveBeenCalledTimes(1)

    await pool.close()
  })

  it('should close all browsers on pool close', async () => {
    const pool = new BrowserPool({ maxBrowsers: 2 })

    const browser1 = await pool.acquire()
    const browser2 = await pool.acquire()

    await pool.release(browser1)
    await pool.release(browser2)

    // Clear the mock to count only close() calls
    mockBrowserClose.mockClear()

    await pool.close()

    // Both browsers should be closed
    expect(mockBrowserClose).toHaveBeenCalledTimes(2)
  })

  it('should prevent acquiring after pool is closed', async () => {
    const pool = new BrowserPool({ maxBrowsers: 2 })

    await pool.close()

    await expect(pool.acquire()).rejects.toThrow('Browser pool is closed')
  })

  it('should execute function with browser from pool', async () => {
    const pool = new BrowserPool({ maxBrowsers: 2 })

    const testFn = vi.fn(async (browser: Browser) => {
      expect(browser).toBeDefined()
      return 'test-result'
    })

    const result = await pool.execute(testFn)

    expect(testFn).toHaveBeenCalledTimes(1)
    expect(result).toBe('test-result')
    expect(mockLaunch).toHaveBeenCalledTimes(1)

    await pool.close()
  })

  it('should release browser even if function throws', async () => {
    const pool = new BrowserPool({ maxBrowsers: 2 })

    const testFn = vi.fn(async (browser: Browser) => {
      throw new Error('Test error')
    })

    await expect(pool.execute(testFn)).rejects.toThrow('Test error')

    // Browser should still be released back to pool
    expect(mockBrowserClose).not.toHaveBeenCalled()

    // Should be able to reuse the browser
    await pool.execute(async (browser) => {
      expect(browser).toBeDefined()
    })

    // Should only launch once (browser was reused)
    expect(mockLaunch).toHaveBeenCalledTimes(1)

    await pool.close()
  })

  it('should queue requests when pool is full', async () => {
    const pool = new BrowserPool({ maxBrowsers: 1 })

    const execOrder: number[] = []

    // Start two concurrent executions with only 1 browser in pool
    const promise1 = pool.execute(async () => {
      execOrder.push(1)
      await new Promise(resolve => setTimeout(resolve, 50))
      return 'result-1'
    })

    const promise2 = pool.execute(async () => {
      execOrder.push(2)
      return 'result-2'
    })

    const [result1, result2] = await Promise.all([promise1, promise2])

    expect(result1).toBe('result-1')
    expect(result2).toBe('result-2')
    // Should execute in order since only 1 browser available
    expect(execOrder).toEqual([1, 2])

    await pool.close()
  })

  it('getBrowserPool should return singleton instance', async () => {
    const pool1 = getBrowserPool()
    const pool2 = getBrowserPool()

    expect(pool1).toBe(pool2)

    await pool1.close()
  })
})
