import puppeteer, { Browser } from 'puppeteer'

interface BrowserPoolOptions {
  maxBrowsers?: number
}

interface WaitingRequest {
  resolve: (browser: Browser) => void
  reject: (error: Error) => void
}

export class BrowserPool {
  private maxBrowsers: number
  private availableBrowsers: Browser[] = []
  private activeBrowsersCount: number = 0
  private waitingQueue: WaitingRequest[] = []
  private closed: boolean = false

  constructor(options: BrowserPoolOptions = {}) {
    this.maxBrowsers = options.maxBrowsers || 2
  }

  /**
   * Acquire a browser from the pool
   * Creates a new browser if pool is not at capacity
   * Otherwise, queues the request until a browser becomes available
   */
  async acquire(): Promise<Browser> {
    if (this.closed) {
      throw new Error('Browser pool is closed')
    }

    // Try to get an available browser from the pool
    if (this.availableBrowsers.length > 0) {
      const browser = this.availableBrowsers.pop()!
      this.activeBrowsersCount++
      return browser
    }

    // If we haven't reached max capacity, create a new browser
    if (this.activeBrowsersCount < this.maxBrowsers) {
      this.activeBrowsersCount++
      try {
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        return browser
      } catch (error) {
        this.activeBrowsersCount--
        throw error
      }
    }

    // Pool is full, queue the request
    return new Promise<Browser>((resolve, reject) => {
      this.waitingQueue.push({ resolve, reject })
    })
  }

  /**
   * Release a browser back to the pool
   * If browser is disconnected, it will be closed instead of returned to pool
   */
  async release(browser: Browser): Promise<void> {
    this.activeBrowsersCount--

    // Check if browser is still connected
    if (!browser.isConnected()) {
      // Browser is disconnected, close it
      try {
        await browser.close()
      } catch (error) {
        // Ignore errors when closing disconnected browser
        console.error('Error closing disconnected browser:', error)
      }

      // Try to fulfill waiting request with a new browser
      if (this.waitingQueue.length > 0 && !this.closed) {
        const { resolve, reject } = this.waitingQueue.shift()!
        this.activeBrowsersCount++
        try {
          const newBrowser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          })
          resolve(newBrowser)
        } catch (error) {
          this.activeBrowsersCount--
          reject(error as Error)
        }
      }
      return
    }

    // Browser is still connected, return to pool or fulfill waiting request
    if (this.waitingQueue.length > 0) {
      // There's a waiting request, fulfill it immediately
      const { resolve } = this.waitingQueue.shift()!
      this.activeBrowsersCount++
      resolve(browser)
    } else {
      // No waiting requests, return to pool
      this.availableBrowsers.push(browser)
    }
  }

  /**
   * Execute a function with a browser from the pool
   * Automatically acquires and releases the browser
   * Ensures browser is released even if function throws
   */
  async execute<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
    const browser = await this.acquire()
    try {
      return await fn(browser)
    } finally {
      await this.release(browser)
    }
  }

  /**
   * Close all browsers in the pool
   * Rejects all waiting requests
   * Prevents new acquisitions
   */
  async close(): Promise<void> {
    this.closed = true

    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const { reject } = this.waitingQueue.shift()!
      reject(new Error('Browser pool is closed'))
    }

    // Close all available browsers
    const closePromises = this.availableBrowsers.map(browser =>
      browser.close().catch(error => {
        console.error('Error closing browser:', error)
      })
    )

    await Promise.all(closePromises)
    this.availableBrowsers = []
  }
}

// Singleton instance
let browserPoolInstance: BrowserPool | null = null

/**
 * Get the singleton browser pool instance
 * Creates a new instance if one doesn't exist
 */
export function getBrowserPool(): BrowserPool {
  if (!browserPoolInstance) {
    browserPoolInstance = new BrowserPool({
      maxBrowsers: 2,
    })
  }
  return browserPoolInstance
}
