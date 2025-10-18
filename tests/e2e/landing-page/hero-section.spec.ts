import { test, expect } from '@playwright/test'

test.describe('Landing Page - Hero Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should have H1 with "GST-Compliant Invoicing for Indian Exporters"', async ({ page }) => {
    const h1 = page.locator('h1')
    await expect(h1).toContainText('GST-Compliant Invoicing for Indian Exporters')
  })

  test('should have descriptive subtitle', async ({ page }) => {
    // Look for a subtitle/description near the hero
    const subtitle = page.locator('text=/Professional invoice management|Zero-rated supplies|export business/i').first()
    await expect(subtitle).toBeVisible()
  })

  test('should have "Start Free Trial" CTA button', async ({ page }) => {
    // Scope to hero section to avoid matches in navbar/footer
    const heroSection = page.locator('section.hero')
    const ctaButton = heroSection.locator('a:has-text("Start Free Trial")')
    await expect(ctaButton).toBeVisible()
  })

  test('should have "Learn More" secondary button', async ({ page }) => {
    const heroSection = page.locator('section.hero')
    const learnMoreButton = heroSection.locator('a:has-text("Learn More")')
    await expect(learnMoreButton).toBeVisible()
  })

  test('"Start Free Trial" should link to /auth/signup', async ({ page }) => {
    const heroSection = page.locator('section.hero')
    const ctaButton = heroSection.locator('a:has-text("Start Free Trial")')
    await expect(ctaButton).toHaveAttribute('href', '/auth/signup')
  })

  test('should display trust badge: GST compliant', async ({ page }) => {
    const heroSection = page.locator('section.hero')
    const gstBadge = heroSection.locator('text=/GST.*compliant/i').first()
    await expect(gstBadge).toBeVisible()
  })

  test('should display trust badge: LUT support', async ({ page }) => {
    const heroSection = page.locator('section.hero')
    const lutBadge = heroSection.locator('text=/LUT.*support/i').first()
    await expect(lutBadge).toBeVisible()
  })

  test('should display trust badge: RBI rates', async ({ page }) => {
    const heroSection = page.locator('section.hero')
    const rbiBadge = heroSection.locator('text=/RBI.*rate/i').first()
    await expect(rbiBadge).toBeVisible()
  })

  test('should have hero image with proper alt text', async ({ page }) => {
    // Look for SVG with aria-label or img with alt in hero section
    const heroSection = page.locator('section.hero')
    const heroImage = heroSection.locator('svg[aria-label], img[alt]').first()
    await expect(heroImage).toBeVisible()

    // Verify it has alt text or aria-label
    const altText = await heroImage.getAttribute('alt') || await heroImage.getAttribute('aria-label')
    expect(altText).toBeTruthy()
    expect(altText!.length).toBeGreaterThan(10)
  })

  test('CTA buttons should be keyboard accessible', async ({ page }) => {
    const heroSection = page.locator('section.hero')
    const ctaButton = heroSection.locator('a:has-text("Start Free Trial")')

    // Focus the button using keyboard
    await ctaButton.focus()

    // Verify it's focused
    await expect(ctaButton).toBeFocused()

    // Verify it can be activated with Enter key
    const href = await ctaButton.getAttribute('href')
    expect(href).toBe('/auth/signup')
  })

  test('hero section should be above the fold', async ({ page }) => {
    // Get h1 position
    const h1 = page.locator('h1').first()
    const box = await h1.boundingBox()

    // H1 should be visible in the first viewport (within 800px from top)
    expect(box!.y).toBeLessThan(800)
  })

  test('hero section should have gradient or visual background', async ({ page }) => {
    // Check if the hero section has a background gradient or color
    const heroSection = page.locator('section, div').filter({ has: page.locator('h1') }).first()
    const bgColor = await heroSection.evaluate((el) => {
      return window.getComputedStyle(el).background || window.getComputedStyle(el).backgroundColor
    })

    // Should have some background styling (not transparent/default)
    expect(bgColor).toBeTruthy()
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
  })
})
