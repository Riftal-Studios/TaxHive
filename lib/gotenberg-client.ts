/**
 * Gotenberg API Client
 *
 * Handles communication with Gotenberg service for PDF generation.
 * Replaces Puppeteer browser pool with HTTP API calls.
 */

export interface GotenbergOptions {
  paperWidth?: number // inches, default 8.27 (A4)
  paperHeight?: number // inches, default 11.7 (A4)
  marginTop?: number // inches, default 0.79 (20mm)
  marginBottom?: number // inches, default 0.79 (20mm)
  marginLeft?: number // inches, default 0.79 (20mm)
  marginRight?: number // inches, default 0.79 (20mm)
  printBackground?: boolean // default true
  preferCssPageSize?: boolean
}

const DEFAULT_OPTIONS: GotenbergOptions = {
  paperWidth: 8.27, // A4 width in inches
  paperHeight: 11.7, // A4 height in inches
  marginTop: 0.79, // ~20mm
  marginBottom: 0.79,
  marginLeft: 0.79,
  marginRight: 0.79,
  printBackground: true,
  preferCssPageSize: false,
}

export class GotenbergClient {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl?: string, timeout?: number) {
    this.baseUrl = baseUrl || process.env.GOTENBERG_URL || 'http://localhost:3000'
    this.timeout = timeout || parseInt(process.env.GOTENBERG_TIMEOUT || '60000', 10)
  }

  /**
   * Convert HTML string to PDF buffer
   */
  async htmlToPdf(html: string, options: GotenbergOptions = {}): Promise<Buffer> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

    // Create form data with HTML file
    const formData = new FormData()

    // Gotenberg expects an index.html file
    const htmlBlob = new Blob([html], { type: 'text/html' })
    formData.append('files', htmlBlob, 'index.html')

    // Add PDF options
    formData.append('paperWidth', String(mergedOptions.paperWidth))
    formData.append('paperHeight', String(mergedOptions.paperHeight))
    formData.append('marginTop', String(mergedOptions.marginTop))
    formData.append('marginBottom', String(mergedOptions.marginBottom))
    formData.append('marginLeft', String(mergedOptions.marginLeft))
    formData.append('marginRight', String(mergedOptions.marginRight))
    formData.append('printBackground', String(mergedOptions.printBackground))
    formData.append('preferCssPageSize', String(mergedOptions.preferCssPageSize))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}/forms/chromium/convert/html`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gotenberg error (${response.status}): ${errorText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Check if Gotenberg service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Singleton instance
let gotenbergClientInstance: GotenbergClient | null = null

export function getGotenbergClient(): GotenbergClient {
  if (!gotenbergClientInstance) {
    gotenbergClientInstance = new GotenbergClient()
  }
  return gotenbergClientInstance
}
