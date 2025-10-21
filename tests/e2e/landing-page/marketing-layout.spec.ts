import { test, expect } from '@playwright/test'

/**
 * Task 1.2 RED - Marketing Layout Component Tests
 *
 * These tests verify that:
 * - Navbar has proper branding, links, and CTAs
 * - Footer has proper content and structure
 * - Marketing layout is distinct from authenticated app layout
 * - Navigation is functional and accessible
 */

test.describe('Marketing Navbar', () => {
  test('should have TaxHive logo/branding', async ({ page }) => {
    await page.goto('/')

    const navText = await page.locator('nav').textContent()
    expect(navText).toContain('TaxHive')
  })

  test('should have Features link in navbar', async ({ page }) => {
    await page.goto('/')

    const featuresLink = page.locator('nav a[href="/features"]')
    await expect(featuresLink).toBeVisible()
    expect(await featuresLink.textContent()).toContain('Features')
  })

  test('should have Pricing link in navbar', async ({ page }) => {
    await page.goto('/')

    const pricingLink = page.locator('nav a[href="/pricing"]')
    await expect(pricingLink).toBeVisible()
    expect(await pricingLink.textContent()).toContain('Pricing')
  })

  // Blog link removed until blog is implemented (Task 5.1-5.3)
  // test('should have Blog link in navbar', async ({ page }) => {
  //   await page.goto('/')

  //   const blogLink = page.locator('nav a[href="/blog"]')
  //   await expect(blogLink).toBeVisible()
  //   expect(await blogLink.textContent()).toContain('Blog')
  // })

  test('should have Sign In link in navbar', async ({ page }) => {
    await page.goto('/')

    const signinLink = page.locator('nav a[href="/auth/signin"]')
    await expect(signinLink).toBeVisible()
    expect(await signinLink.textContent()).toContain('Sign In')
  })

  test('should have Start Free Trial CTA button in navbar', async ({ page }) => {
    await page.goto('/')

    const ctaButton = page.locator('nav a[href="/auth/signup"]')
    await expect(ctaButton).toBeVisible()
    expect(await ctaButton.textContent()).toContain('Start Free Trial')
  })

  test('navbar links should be clickable', async ({ page }) => {
    await page.goto('/')

    const featuresLink = page.locator('nav a[href="/features"]')
    await expect(featuresLink).toBeEnabled()

    const pricingLink = page.locator('nav a[href="/pricing"]')
    await expect(pricingLink).toBeEnabled()
  })

  test('navbar should be sticky/fixed at top', async ({ page }) => {
    await page.goto('/')

    const nav = page.locator('nav')
    const position = await nav.evaluate((el) => window.getComputedStyle(el).position)

    // Should be sticky or fixed
    expect(['sticky', 'fixed']).toContain(position)
  })

  test('navbar should have proper z-index for layering', async ({ page }) => {
    await page.goto('/')

    const nav = page.locator('nav')
    const zIndex = await nav.evaluate((el) => window.getComputedStyle(el).zIndex)

    // Z-index should be high enough to stay on top
    expect(parseInt(zIndex)).toBeGreaterThan(10)
  })
})

test.describe('Marketing Footer', () => {
  test('should have footer element', async ({ page }) => {
    await page.goto('/')

    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
  })

  test('should have copyright text with current year', async ({ page }) => {
    await page.goto('/')

    const currentYear = new Date().getFullYear()
    const footerText = await page.locator('footer').textContent()

    expect(footerText).toContain(currentYear.toString())
    expect(footerText).toContain('TaxHive')
    expect(footerText).toContain('All rights reserved')
  })

  test('footer should be at bottom of page', async ({ page }) => {
    await page.goto('/')

    // Get footer position
    const footer = page.locator('footer')
    const footerBox = await footer.boundingBox()

    // Get page height
    const pageHeight = await page.evaluate(() => document.body.scrollHeight)

    // Footer should be near bottom of page
    expect(footerBox).toBeTruthy()
    if (footerBox) {
      expect(footerBox.y).toBeGreaterThan(pageHeight * 0.7) // Footer in bottom 30% of page
    }
  })

  test('footer should have distinct background color', async ({ page }) => {
    await page.goto('/')

    const footer = page.locator('footer')
    const bgColor = await footer.evaluate((el) => window.getComputedStyle(el).backgroundColor)

    // Should have a background color set (not transparent)
    expect(bgColor).toBeTruthy()
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(bgColor).not.toBe('transparent')
  })
})

test.describe('Marketing Layout Structure', () => {
  test('marketing layout should NOT have sidebar', async ({ page }) => {
    await page.goto('/')

    // Look for common sidebar selectors that might exist in authenticated layout
    const sidebar = page.locator('aside, [role="complementary"], .sidebar')
    const sidebarCount = await sidebar.count()

    expect(sidebarCount).toBe(0)
  })

  test('should have semantic HTML structure (nav, main, footer)', async ({ page }) => {
    await page.goto('/')

    // Check for semantic elements
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
  })

  test('main content should be between nav and footer', async ({ page }) => {
    await page.goto('/')

    const nav = page.locator('nav')
    const main = page.locator('main')
    const footer = page.locator('footer')

    const navBox = await nav.boundingBox()
    const mainBox = await main.boundingBox()
    const footerBox = await footer.boundingBox()

    expect(navBox).toBeTruthy()
    expect(mainBox).toBeTruthy()
    expect(footerBox).toBeTruthy()

    if (navBox && mainBox && footerBox) {
      // Main should be below nav
      expect(mainBox.y).toBeGreaterThan(navBox.y)

      // Footer should be below main
      expect(footerBox.y).toBeGreaterThan(mainBox.y)
    }
  })

  test('layout should be full width (no max-width constraint on body)', async ({ page }) => {
    await page.goto('/')

    const bodyWidth = await page.evaluate(() => document.body.offsetWidth)
    const viewportWidth = await page.viewportSize()

    // Body should span full viewport width
    expect(bodyWidth).toBeGreaterThan(0)
    if (viewportWidth) {
      expect(bodyWidth).toBeGreaterThanOrEqual(viewportWidth.width * 0.99) // Allow for scrollbar
    }
  })
})

test.describe('Navigation Functionality', () => {
  test('clicking Features link should navigate to /features', async ({ page, context }) => {
    await page.goto('/')

    // Create promise that resolves when navigation happens
    const navigationPromise = page.waitForURL(/\/features/)

    // Click the Features link
    await page.click('nav a[href="/features"]')

    // Wait for navigation
    await navigationPromise

    // Verify we're on features page (even if 404)
    expect(page.url()).toContain('/features')
  })

  test('clicking Start Free Trial should navigate to signup', async ({ page }) => {
    await page.goto('/')

    const navigationPromise = page.waitForURL(/\/auth\/signup/)

    await page.click('nav a[href="/auth/signup"]')

    await navigationPromise

    expect(page.url()).toContain('/auth/signup')
  })
})

test.describe('Responsive Design', () => {
  test('navbar should be visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')

    const navLinks = page.locator('nav a[href="/features"]')
    await expect(navLinks).toBeVisible()
  })

  test('page should be readable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
    await page.goto('/')

    // Main content should still be visible
    await expect(page.locator('main')).toBeVisible()

    // TaxHive branding should be visible
    const navText = await page.locator('nav').textContent()
    expect(navText).toContain('TaxHive')
  })
})

test.describe('Accessibility', () => {
  test('navbar links should have accessible text', async ({ page }) => {
    await page.goto('/')

    // All navigation links should have visible text (not empty, not just icons)
    const links = page.locator('nav a')
    const linkCount = await links.count()

    for (let i = 0; i < linkCount; i++) {
      const linkText = await links.nth(i).textContent()
      expect(linkText?.trim().length).toBeGreaterThan(0)
    }
  })

  test('footer should have readable contrast', async ({ page }) => {
    await page.goto('/')

    const footer = page.locator('footer')
    const color = await footer.evaluate((el) => window.getComputedStyle(el).color)
    const bgColor = await footer.evaluate((el) => window.getComputedStyle(el).backgroundColor)

    // Both color and background should be set
    expect(color).toBeTruthy()
    expect(bgColor).toBeTruthy()
  })
})
