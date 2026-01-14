import type { Page, ConsoleMessage, Request, Response } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

interface NetworkError {
  url: string
  status: number
  statusText: string
  method: string
  timestamp: Date
}

interface PageError {
  message: string
  stack?: string
  timestamp: Date
}

interface ConsoleError {
  type: string
  text: string
  location?: string
  timestamp: Date
}

export interface ErrorSummary {
  console: ConsoleError[]
  network: NetworkError[]
  page: PageError[]
  totalErrors: number
}

/**
 * ErrorRecorder captures all errors during a Playwright test:
 * - Console errors and warnings
 * - Network request failures (4xx, 5xx)
 * - Page crash/error events
 */
export class ErrorRecorder {
  private consoleErrors: ConsoleError[] = []
  private networkErrors: NetworkError[] = []
  private pageErrors: PageError[] = []
  private page: Page | null = null

  /**
   * Attach error listeners to a page
   */
  async attachToPage(page: Page): Promise<void> {
    this.page = page
    this.reset()

    // Capture console errors
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type()
      if (type === 'error' || type === 'warning') {
        this.consoleErrors.push({
          type,
          text: msg.text(),
          location: msg.location()?.url,
          timestamp: new Date(),
        })
      }
    })

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error: Error) => {
      this.pageErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      })
    })

    // Capture network failures
    page.on('response', (response: Response) => {
      const status = response.status()
      if (status >= 400) {
        const request = response.request()
        this.networkErrors.push({
          url: request.url(),
          status,
          statusText: response.statusText(),
          method: request.method(),
          timestamp: new Date(),
        })
      }
    })

    // Capture request failures (network issues)
    page.on('requestfailed', (request: Request) => {
      this.networkErrors.push({
        url: request.url(),
        status: 0,
        statusText: request.failure()?.errorText || 'Network error',
        method: request.method(),
        timestamp: new Date(),
      })
    })
  }

  /**
   * Reset all error collections
   */
  reset(): void {
    this.consoleErrors = []
    this.networkErrors = []
    this.pageErrors = []
  }

  /**
   * Get all recorded errors
   */
  getErrors(): ErrorSummary {
    return {
      console: [...this.consoleErrors],
      network: [...this.networkErrors],
      page: [...this.pageErrors],
      totalErrors: this.consoleErrors.length + this.networkErrors.length + this.pageErrors.length,
    }
  }

  /**
   * Check if any errors were recorded
   */
  hasErrors(): boolean {
    return this.consoleErrors.length > 0 ||
           this.networkErrors.length > 0 ||
           this.pageErrors.length > 0
  }

  /**
   * Get only critical errors (page errors and 5xx responses)
   */
  getCriticalErrors(): ErrorSummary {
    const criticalNetwork = this.networkErrors.filter(e => e.status >= 500 || e.status === 0)
    return {
      console: this.consoleErrors.filter(e => e.type === 'error'),
      network: criticalNetwork,
      page: [...this.pageErrors],
      totalErrors: this.consoleErrors.filter(e => e.type === 'error').length +
                   criticalNetwork.length +
                   this.pageErrors.length,
    }
  }

  /**
   * Save errors to a JSON file
   */
  async saveToFile(testName: string, outputDir: string = 'test-results/errors'): Promise<string> {
    const errors = this.getErrors()
    if (errors.totalErrors === 0) return ''

    // Ensure directory exists
    const dir = path.resolve(outputDir)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const filename = `${testName.replace(/[^a-z0-9]/gi, '-')}-errors.json`
    const filepath = path.join(dir, filename)

    fs.writeFileSync(filepath, JSON.stringify({
      testName,
      timestamp: new Date().toISOString(),
      ...errors,
    }, null, 2))

    return filepath
  }

  /**
   * Format errors for console output
   */
  formatForConsole(): string {
    const lines: string[] = []

    if (this.pageErrors.length > 0) {
      lines.push('\n=== PAGE ERRORS ===')
      this.pageErrors.forEach((e, i) => {
        lines.push(`[${i + 1}] ${e.message}`)
        if (e.stack) lines.push(`    Stack: ${e.stack.split('\n')[0]}`)
      })
    }

    if (this.networkErrors.length > 0) {
      lines.push('\n=== NETWORK ERRORS ===')
      this.networkErrors.forEach((e, i) => {
        lines.push(`[${i + 1}] ${e.method} ${e.url} - ${e.status} ${e.statusText}`)
      })
    }

    if (this.consoleErrors.length > 0) {
      lines.push('\n=== CONSOLE ERRORS ===')
      this.consoleErrors.forEach((e, i) => {
        lines.push(`[${i + 1}] [${e.type.toUpperCase()}] ${e.text}`)
        if (e.location) lines.push(`    at ${e.location}`)
      })
    }

    return lines.join('\n')
  }

  /**
   * Assert that no errors occurred (throws if errors exist)
   */
  assertNoErrors(): void {
    if (this.hasErrors()) {
      throw new Error(`Test recorded ${this.getErrors().totalErrors} errors:${this.formatForConsole()}`)
    }
  }

  /**
   * Assert no critical errors (ignores warnings and 4xx)
   */
  assertNoCriticalErrors(): void {
    const critical = this.getCriticalErrors()
    if (critical.totalErrors > 0) {
      throw new Error(`Test recorded ${critical.totalErrors} critical errors:${this.formatForConsole()}`)
    }
  }
}

/**
 * Create a new ErrorRecorder instance attached to a page
 */
export async function createErrorRecorder(page: Page): Promise<ErrorRecorder> {
  const recorder = new ErrorRecorder()
  await recorder.attachToPage(page)
  return recorder
}
