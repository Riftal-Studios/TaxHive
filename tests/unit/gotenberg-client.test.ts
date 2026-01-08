import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GotenbergClient, getGotenbergClient } from '@/lib/gotenberg-client'

describe('GotenbergClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('htmlToPdf', () => {
    it('should convert HTML to PDF successfully', async () => {
      const mockPdfBuffer = new ArrayBuffer(8)
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockPdfBuffer),
      } as Response)

      const client = new GotenbergClient('http://test:3000')
      const result = await client.htmlToPdf('<html><body>Test</body></html>')

      expect(result).toBeInstanceOf(Buffer)
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://test:3000/forms/chromium/convert/html',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should throw on Gotenberg error response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error'),
      } as Response)

      const client = new GotenbergClient('http://test:3000')
      await expect(client.htmlToPdf('<html></html>')).rejects.toThrow(
        'Gotenberg error (500): Internal error'
      )
    })

    it('should use default options for A4 format', async () => {
      const mockPdfBuffer = new ArrayBuffer(8)
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockPdfBuffer),
      } as Response)

      const client = new GotenbergClient('http://test:3000')
      await client.htmlToPdf('<html></html>')

      // Check that form data includes A4 dimensions
      const call = fetchSpy.mock.calls[0]
      const body = call[1]?.body as FormData
      expect(body.get('paperWidth')).toBe('8.27')
      expect(body.get('paperHeight')).toBe('11.7')
      expect(body.get('printBackground')).toBe('true')
    })

    it('should allow custom options', async () => {
      const mockPdfBuffer = new ArrayBuffer(8)
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockPdfBuffer),
      } as Response)

      const client = new GotenbergClient('http://test:3000')
      await client.htmlToPdf('<html></html>', {
        paperWidth: 8.5,
        paperHeight: 11,
        marginTop: 1,
      })

      const call = fetchSpy.mock.calls[0]
      const body = call[1]?.body as FormData
      expect(body.get('paperWidth')).toBe('8.5')
      expect(body.get('paperHeight')).toBe('11')
      expect(body.get('marginTop')).toBe('1')
    })

    it('should use environment variables for configuration', async () => {
      const originalUrl = process.env.GOTENBERG_URL
      process.env.GOTENBERG_URL = 'http://env-gotenberg:3000'

      const mockPdfBuffer = new ArrayBuffer(8)
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockPdfBuffer),
      } as Response)

      const client = new GotenbergClient()
      await client.htmlToPdf('<html></html>')

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://env-gotenberg:3000/forms/chromium/convert/html',
        expect.anything()
      )

      process.env.GOTENBERG_URL = originalUrl
    })
  })

  describe('isHealthy', () => {
    it('should return true when service is healthy', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: true } as Response)

      const client = new GotenbergClient('http://test:3000')
      const result = await client.isHealthy()

      expect(result).toBe(true)
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://test:3000/health',
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('should return false when service is unhealthy', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false } as Response)

      const client = new GotenbergClient('http://test:3000')
      const result = await client.isHealthy()

      expect(result).toBe(false)
    })

    it('should return false when service is unreachable', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const client = new GotenbergClient('http://test:3000')
      const result = await client.isHealthy()

      expect(result).toBe(false)
    })
  })

  describe('getGotenbergClient', () => {
    it('should return singleton instance', () => {
      const client1 = getGotenbergClient()
      const client2 = getGotenbergClient()

      expect(client1).toBe(client2)
    })
  })
})
