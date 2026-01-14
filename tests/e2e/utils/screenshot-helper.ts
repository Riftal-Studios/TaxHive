import type { Page, Locator } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

interface ScreenshotOptions {
  fullPage?: boolean
  outputDir?: string
  quality?: number
  type?: 'png' | 'jpeg'
}

/**
 * ScreenshotHelper provides utilities for capturing and organizing screenshots during tests
 */
export class ScreenshotHelper {
  private outputDir: string
  private testName: string
  private screenshotIndex: number = 0

  constructor(testName: string, outputDir: string = 'test-results/screenshots') {
    this.testName = testName.replace(/[^a-z0-9]/gi, '-')
    this.outputDir = path.resolve(outputDir, this.testName)

    // Ensure directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  /**
   * Generate a filename with timestamp and index
   */
  private generateFilename(name: string, ext: string = 'png'): string {
    this.screenshotIndex++
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `${this.screenshotIndex.toString().padStart(3, '0')}-${name}-${timestamp}.${ext}`
  }

  /**
   * Take a screenshot of the current viewport
   */
  async capture(page: Page, name: string, options: ScreenshotOptions = {}): Promise<string> {
    const filename = this.generateFilename(name, options.type || 'png')
    const filepath = path.join(this.outputDir, filename)

    await page.screenshot({
      path: filepath,
      fullPage: options.fullPage || false,
      type: options.type || 'png',
      quality: options.type === 'jpeg' ? options.quality || 80 : undefined,
    })

    return filepath
  }

  /**
   * Take a full page screenshot
   */
  async captureFullPage(page: Page, name: string): Promise<string> {
    return this.capture(page, `${name}-fullpage`, { fullPage: true })
  }

  /**
   * Take a screenshot of a specific element
   */
  async captureElement(locator: Locator, name: string): Promise<string> {
    const filename = this.generateFilename(name)
    const filepath = path.join(this.outputDir, filename)

    await locator.screenshot({
      path: filepath,
      type: 'png',
    })

    return filepath
  }

  /**
   * Take a screenshot before and after an action
   */
  async captureBeforeAfter(
    page: Page,
    actionName: string,
    action: () => Promise<void>
  ): Promise<{ before: string; after: string }> {
    const before = await this.capture(page, `${actionName}-before`)
    await action()
    const after = await this.capture(page, `${actionName}-after`)
    return { before, after }
  }

  /**
   * Take a screenshot on error
   */
  async captureOnError(page: Page, errorMessage: string): Promise<string> {
    const sanitizedError = errorMessage.substring(0, 50).replace(/[^a-z0-9]/gi, '-')
    return this.captureFullPage(page, `error-${sanitizedError}`)
  }

  /**
   * Get all screenshots taken for this test
   */
  getScreenshots(): string[] {
    if (!fs.existsSync(this.outputDir)) {
      return []
    }
    return fs.readdirSync(this.outputDir)
      .filter(f => f.endsWith('.png') || f.endsWith('.jpeg'))
      .map(f => path.join(this.outputDir, f))
  }

  /**
   * Get the output directory
   */
  getOutputDir(): string {
    return this.outputDir
  }

  /**
   * Clean up all screenshots for this test
   */
  cleanup(): void {
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true })
    }
  }
}

/**
 * Create a new ScreenshotHelper for a test
 */
export function createScreenshotHelper(testName: string, outputDir?: string): ScreenshotHelper {
  return new ScreenshotHelper(testName, outputDir)
}

/**
 * Utility to capture a screenshot at specific UI states
 */
export async function captureUIState(
  page: Page,
  name: string,
  outputDir: string = 'test-results/ui-states'
): Promise<string> {
  const dir = path.resolve(outputDir)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${name}-${timestamp}.png`
  const filepath = path.join(dir, filename)

  await page.screenshot({
    path: filepath,
    fullPage: true,
  })

  return filepath
}
