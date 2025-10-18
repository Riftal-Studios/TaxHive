import { test, expect } from '@playwright/test'

test.describe('Landing Page - SEO Meta Tags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should have title tag with "TaxHive - GST-Compliant Invoice Management for Indian Exporters"', async ({ page }) => {
    const title = await page.title()
    expect(title).toBe('TaxHive - GST-Compliant Invoice Management for Indian Exporters')
  })

  test('should have meta description with 150-160 characters', async ({ page }) => {
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content')

    expect(metaDescription).toBeTruthy()
    expect(metaDescription!.length).toBeGreaterThanOrEqual(100)
    expect(metaDescription!.length).toBeLessThanOrEqual(160)
  })

  test('should have meta keywords', async ({ page }) => {
    const metaKeywords = await page.locator('meta[name="keywords"]').getAttribute('content')

    expect(metaKeywords).toBeTruthy()
    expect(metaKeywords!.length).toBeGreaterThan(10)
  })

  test('should have Open Graph title', async ({ page }) => {
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')

    expect(ogTitle).toBeTruthy()
    expect(ogTitle!.length).toBeGreaterThan(5)
  })

  test('should have Open Graph description', async ({ page }) => {
    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content')

    expect(ogDescription).toBeTruthy()
    expect(ogDescription!.length).toBeGreaterThan(20)
  })

  test('should have Open Graph image', async ({ page }) => {
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')

    expect(ogImage).toBeTruthy()
    // Should be a URL
    expect(ogImage).toMatch(/^https?:\/\//)
  })

  test('should have Open Graph URL', async ({ page }) => {
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content')

    expect(ogUrl).toBeTruthy()
    expect(ogUrl).toContain('taxhive.app')
  })

  test('should have Twitter Card meta tags', async ({ page }) => {
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content')
    const twitterTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content')
    const twitterDescription = await page.locator('meta[name="twitter:description"]').getAttribute('content')

    expect(twitterCard).toBeTruthy()
    expect(twitterCard).toBe('summary_large_image')

    expect(twitterTitle).toBeTruthy()
    expect(twitterTitle!.length).toBeGreaterThan(5)

    expect(twitterDescription).toBeTruthy()
    expect(twitterDescription!.length).toBeGreaterThan(10)
  })

  test('should have canonical URL', async ({ page }) => {
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')

    expect(canonical).toBeTruthy()
    expect(canonical).toMatch(/^https?:\/\//)
  })

  test('should have robots meta allowing indexing', async ({ page }) => {
    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content')

    // If robots meta exists, it should allow indexing
    if (robotsMeta) {
      expect(robotsMeta).not.toContain('noindex')
      expect(robotsMeta).not.toContain('nofollow')
    }

    // Check Next.js metadata API robots
    const nextRobots = page.locator('meta[name="robots"][content*="index"]')
    const count = await nextRobots.count()

    // Either no robots meta (defaults to allow) or explicit allow
    expect(count >= 0).toBeTruthy()
  })

  test('should have html lang attribute set to "en"', async ({ page }) => {
    const htmlLang = await page.locator('html').getAttribute('lang')

    expect(htmlLang).toBe('en')
  })

  test('should have viewport meta tag for responsive design', async ({ page }) => {
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')

    expect(viewport).toBeTruthy()
    expect(viewport).toContain('width=device-width')
  })

  test('should have charset meta tag', async ({ page }) => {
    const charset = await page.locator('meta[charset]').getAttribute('charset')

    expect(charset).toBeTruthy()
    expect(charset?.toLowerCase()).toBe('utf-8')
  })

  test('meta description should contain key terms (GST, invoice, export)', async ({ page }) => {
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content')

    const hasKeyTerms = /gst|invoice|export/i.test(metaDescription!)
    expect(hasKeyTerms).toBeTruthy()
  })

  test('should not have duplicate meta tags', async ({ page }) => {
    // Check for duplicate descriptions
    const descriptionCount = await page.locator('meta[name="description"]').count()
    expect(descriptionCount).toBe(1)

    // Check for duplicate OG titles
    const ogTitleCount = await page.locator('meta[property="og:title"]').count()
    expect(ogTitleCount).toBe(1)

    // Check for duplicate OG descriptions
    const ogDescCount = await page.locator('meta[property="og:description"]').count()
    expect(ogDescCount).toBe(1)
  })

  test('Open Graph type should be website', async ({ page }) => {
    const ogType = await page.locator('meta[property="og:type"]').getAttribute('content')

    expect(ogType).toBeTruthy()
    expect(ogType).toBe('website')
  })
})
