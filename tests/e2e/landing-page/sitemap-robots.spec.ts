import { test, expect } from '@playwright/test'

test.describe('Landing Page - Sitemap and Robots.txt', () => {
  test.describe('Sitemap.xml', () => {
    test('should return 200 status code', async ({ page }) => {
      const response = await page.goto('/sitemap.xml')
      expect(response?.status()).toBe(200)
    })

    test('should have valid XML content-type', async ({ page }) => {
      const response = await page.goto('/sitemap.xml')
      const contentType = response?.headers()['content-type']
      expect(contentType).toMatch(/xml/)
    })

    test('should include root URL "/"', async ({ page }) => {
      const response = await page.goto('/sitemap.xml')
      const content = await response?.text()

      // Should include the root URL (with or without trailing slash)
      expect(content).toContain('<loc>')
      expect(content).toMatch(/<loc>https?:\/\/[^<]+\/?<\/loc>/)
    })

    test('should have valid XML format with urlset', async ({ page }) => {
      const response = await page.goto('/sitemap.xml')
      const content = await response?.text()

      // Should have proper XML structure
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(content).toContain('<urlset')
      expect(content).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(content).toContain('</urlset>')
    })

    test('should include lastModified dates', async ({ page }) => {
      await page.goto('/sitemap.xml')
      const content = await page.content()

      // Should have lastmod tags
      expect(content).toContain('<lastmod>')
      expect(content).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}/)
    })

    test('should include changeFrequency', async ({ page }) => {
      await page.goto('/sitemap.xml')
      const content = await page.content()

      // Should have changefreq tag
      expect(content).toContain('<changefreq>')
    })

    test('should include priority', async ({ page }) => {
      await page.goto('/sitemap.xml')
      const content = await page.content()

      // Should have priority tag
      expect(content).toContain('<priority>')
    })
  })

  test.describe('Robots.txt', () => {
    test('should return 200 status code', async ({ page }) => {
      const response = await page.goto('/robots.txt')
      expect(response?.status()).toBe(200)
    })

    test('should have plain text content-type', async ({ page }) => {
      const response = await page.goto('/robots.txt')
      const contentType = response?.headers()['content-type']
      expect(contentType).toMatch(/text\/plain/)
    })

    test('should allow "/" path', async ({ page }) => {
      const response = await page.goto('/robots.txt')
      const content = await response?.text()

      // Should have User-agent/User-Agent and Allow rules
      expect(content).toMatch(/User-[Aa]gent:/i)
      expect(content).toContain('Allow: /')
    })

    test('should disallow "/api/*" path', async ({ page }) => {
      await page.goto('/robots.txt')
      const content = await page.content()

      expect(content).toContain('Disallow: /api')
    })

    test('should disallow "/dashboard/*" path', async ({ page }) => {
      await page.goto('/robots.txt')
      const content = await page.content()

      expect(content).toContain('Disallow: /dashboard')
    })

    test('should disallow "/invoices/*" path', async ({ page }) => {
      await page.goto('/robots.txt')
      const content = await page.content()

      expect(content).toContain('Disallow: /invoices')
    })

    test('should reference sitemap', async ({ page }) => {
      await page.goto('/robots.txt')
      const content = await page.content()

      expect(content).toMatch(/Sitemap:\s*https?:\/\//)
    })

    test('should have valid robots.txt format', async ({ page }) => {
      const response = await page.goto('/robots.txt')
      const content = await response?.text()

      // Should follow basic robots.txt structure (case-insensitive)
      expect(content).toMatch(/User-[Aa]gent:\s*\*/i)
    })
  })
})
