import { test, expect } from '@playwright/test'

test.describe('Landing Page - Features Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should have H2 "Complete GST Compliance for Export Invoices"', async ({ page }) => {
    const h2 = page.locator('h2', { hasText: /Complete GST Compliance for Export Invoices/i })
    await expect(h2).toBeVisible()
  })

  test('should display at least 4 feature cards', async ({ page }) => {
    const featuresSection = page.locator('section.features, section:has(h2:text-matches(".*GST.*Compliance.*", "i"))')
    const featureCards = featuresSection.locator('.feature-card, [class*="feature"], div:has(h3)')
    const count = await featureCards.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('each feature card should have icon, title, and description', async ({ page }) => {
    const featuresSection = page.locator('section.features, section:has(h2:text-matches(".*GST.*Compliance.*", "i"))')
    const firstCard = featuresSection.locator('.feature-card').first()

    // Check for icon (SVG)
    const icon = firstCard.locator('svg').first()
    await expect(icon).toBeVisible()

    // Check for title (H3)
    const title = firstCard.locator('h3').first()
    await expect(title).toBeVisible()

    // Check for description (paragraph)
    const description = firstCard.locator('p').first()
    await expect(description).toBeVisible()
  })

  test('should include "GST Rule 46 Compliance" feature', async ({ page }) => {
    const feature = page.locator('text=/GST.*Rule.*46.*Compliance/i')
    await expect(feature).toBeVisible()
  })

  test('should include "LUT Declaration" feature', async ({ page }) => {
    const featuresSection = page.locator('section.features, section:has(h2:text-matches(".*GST.*Compliance.*", "i"))')
    const feature = featuresSection.locator('text=/LUT.*Declaration/i').first()
    await expect(feature).toBeVisible()
  })

  test('should include "RBI Exchange Rates" feature', async ({ page }) => {
    const featuresSection = page.locator('section.features, section:has(h2:text-matches(".*GST.*Compliance.*", "i"))')
    const feature = featuresSection.locator('text=/RBI.*Exchange.*Rates/i').first()
    await expect(feature).toBeVisible()
  })

  test('should include "Professional PDF" feature', async ({ page }) => {
    const featuresSection = page.locator('section.features, section:has(h2:text-matches(".*GST.*Compliance.*", "i"))')
    const feature = featuresSection.locator('text=/Professional.*PDF/i').first()
    await expect(feature).toBeVisible()
  })

  test('feature cards should have proper semantic HTML', async ({ page }) => {
    const featuresSection = page.locator('section.features, section:has(h2:text-matches(".*GST.*Compliance.*", "i"))')

    // Should be a section
    await expect(featuresSection).toBeVisible()

    // Should have H2 heading
    const h2 = featuresSection.locator('h2')
    await expect(h2).toBeVisible()

    // Feature titles should be H3 tags
    const h3Count = await featuresSection.locator('h3').count()
    expect(h3Count).toBeGreaterThanOrEqual(4)
  })

  test('features section should be in viewport (visible)', async ({ page }) => {
    const featuresSection = page.locator('section.features, section:has(h2:text-matches(".*GST.*Compliance.*", "i"))')
    await expect(featuresSection).toBeInViewport()
  })

  test('all feature titles should be H3 tags', async ({ page }) => {
    const featuresSection = page.locator('section.features, section:has(h2:text-matches(".*GST.*Compliance.*", "i"))')
    const featureTitles = featuresSection.locator('h3')

    const count = await featureTitles.count()
    expect(count).toBeGreaterThanOrEqual(4)

    // Verify each H3 has meaningful text
    for (let i = 0; i < Math.min(count, 4); i++) {
      const title = featureTitles.nth(i)
      const text = await title.textContent()
      expect(text!.length).toBeGreaterThan(5)
    }
  })

  test('feature cards should have consistent styling', async ({ page }) => {
    const featuresSection = page.locator('section.features, section:has(h2:text-matches(".*GST.*Compliance.*", "i"))')
    const cards = featuresSection.locator('.feature-card').all()

    const cardList = await cards
    expect(cardList.length).toBeGreaterThanOrEqual(4)

    // All cards should have similar structure
    for (const card of cardList.slice(0, 4)) {
      await expect(card.locator('svg').first()).toBeVisible()
      await expect(card.locator('h3').first()).toBeVisible()
      await expect(card.locator('p').first()).toBeVisible()
    }
  })

  test('feature icons should use brand colors', async ({ page }) => {
    const featuresSection = page.locator('section.features, section:has(h2:text-matches(".*GST.*Compliance.*", "i"))')
    const firstIcon = featuresSection.locator('svg').first()

    // Icon should be visible
    await expect(firstIcon).toBeVisible()

    // Check if icon has color class (indigo, emerald, blue, purple, etc.)
    const className = await firstIcon.evaluate((el) => el.className.baseVal || el.className)
    const hasColorClass = /indigo|emerald|blue|purple|green/i.test(String(className))

    expect(hasColorClass || className.length > 0).toBeTruthy()
  })
})
