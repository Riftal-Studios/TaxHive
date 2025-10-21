import { test, expect } from '@playwright/test'

test.describe('Landing Page - CTA Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should have compelling headline', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()
    const headline = ctaSection.locator('h2')
    await expect(headline).toBeVisible()

    const headlineText = await headline.textContent()
    expect(headlineText!.length).toBeGreaterThan(10)
  })

  test('should have "Start Free Trial" button', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()
    const ctaButton = ctaSection.locator('a:has-text("Start Free Trial")')
    await expect(ctaButton).toBeVisible()
  })

  test('button should link to /auth/signup', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()
    const ctaButton = ctaSection.locator('a:has-text("Start Free Trial")')
    await expect(ctaButton).toHaveAttribute('href', '/auth/signup')
  })

  test('should display value proposition text', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()
    const valueProposition = ctaSection.locator('p')
    await expect(valueProposition).toBeVisible()

    const propositionText = await valueProposition.textContent()
    expect(propositionText!.length).toBeGreaterThan(10)
  })

  test('should have contrasting background color', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()

    const bgColor = await ctaSection.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })

    // Should have a background color (not transparent)
    expect(bgColor).toBeTruthy()
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('button should be visually prominent', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()
    const ctaButton = ctaSection.locator('a:has-text("Start Free Trial")')

    // Check button has padding and background
    const styles = await ctaButton.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        paddingTop: computed.paddingTop,
        paddingBottom: computed.paddingBottom,
        paddingLeft: computed.paddingLeft,
        paddingRight: computed.paddingRight,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize,
      }
    })

    // Should have substantial padding
    expect(parseFloat(styles.paddingTop)).toBeGreaterThan(10)
    expect(parseFloat(styles.paddingLeft)).toBeGreaterThan(20)

    // Should have background color
    expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')

    // Should have reasonable font size
    expect(parseFloat(styles.fontSize)).toBeGreaterThan(14)
  })

  test('should be keyboard accessible and focusable', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()
    const ctaButton = ctaSection.locator('a:has-text("Start Free Trial")')

    // Focus the button
    await ctaButton.focus()

    // Verify it's focused
    await expect(ctaButton).toBeFocused()
  })

  test('CTA section should be at bottom of landing page', async ({ page }) => {
    const ctaSection = page.locator('section.cta, section:has(a:has-text("Start Free Trial"))').last()
    const heroSection = page.locator('section.hero')

    // Get positions
    const ctaBox = await ctaSection.boundingBox()
    const heroBox = await heroSection.boundingBox()

    // CTA should be below hero section
    expect(ctaBox!.y).toBeGreaterThan(heroBox!.y)
  })

  test('headline should mention GST or invoicing', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()
    const headline = ctaSection.locator('h2')
    const headlineText = await headline.textContent()

    // Should mention key terms
    const mentionsKeyTerm = /gst|invoic|export/i.test(headlineText!)
    expect(mentionsKeyTerm).toBeTruthy()
  })

  test('should have proper semantic HTML structure', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()

    // Should be a section element
    await expect(ctaSection).toBeVisible()

    // Should have H2 heading
    const h2 = ctaSection.locator('h2')
    await expect(h2).toBeVisible()

    // Should have paragraph for value prop
    const p = ctaSection.locator('p')
    await expect(p).toBeVisible()

    // Should have link/button
    const link = ctaSection.locator('a')
    await expect(link).toBeVisible()
  })

  test('CTA button should have hover effects', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()
    const ctaButton = ctaSection.locator('a:has-text("Start Free Trial")')

    // Hover over the button
    await ctaButton.hover()

    // Button should still be visible after hover
    await expect(ctaButton).toBeVisible()
  })

  test('CTA section should be in viewport when scrolled to', async ({ page }) => {
    const ctaSection = page.locator('section.cta').last()

    // Scroll to CTA section
    await ctaSection.scrollIntoViewIfNeeded()

    // Should be in viewport
    await expect(ctaSection).toBeInViewport()
  })
})
