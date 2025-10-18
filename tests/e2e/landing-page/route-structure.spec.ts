import { test, expect } from '@playwright/test'

/**
 * Task 1.1 RED - Marketing Route Structure Tests
 *
 * These tests verify that:
 * - Root route (/) is accessible without authentication
 * - Root route serves marketing content, not auth redirect
 * - Marketing and authenticated routes are properly separated
 * - Middleware doesn't block public marketing pages
 */

test.describe('Marketing Route Structure', () => {
  test('should access root route (/) without authentication', async ({ page }) => {
    const response = await page.goto('/')

    // Should return 200, not 302 redirect
    expect(response?.status()).toBe(200)
  })

  test('should NOT redirect to /auth/signin from root route', async ({ page }) => {
    await page.goto('/')

    // Should stay on root, not redirect to sign in
    expect(page.url()).toMatch(/\/$/)
    expect(page.url()).not.toContain('/auth/signin')
  })

  test('should serve marketing content on root route', async ({ page }) => {
    await page.goto('/')

    // Should have marketing-specific content
    const body = await page.textContent('body')
    expect(body).toBeTruthy()

    // Should have marketing CTA
    expect(body).toContain('Start Free Trial')

    // Should NOT show authenticated app navigation or dashboard links
    // (Note: marketing copy may mention "invoices" but shouldn't have app navigation)
    const navText = await page.locator('nav').textContent()
    expect(navText).not.toContain('Dashboard')
    expect(navText).not.toContain('Create Invoice')
  })

  test('should have different layout than authenticated routes', async ({ page, context }) => {
    // First, check root route (marketing)
    await page.goto('/')

    // Wait for nav element to be present (handles SSR/hydration)
    await page.waitForSelector('nav')
    const marketingNav = await page.locator('nav').count()

    // Marketing should have a nav element
    expect(marketingNav).toBeGreaterThan(0)

    // Now test authenticated route (should redirect to signin)
    const dashboardPage = await context.newPage()
    await dashboardPage.goto('/dashboard')

    // Should redirect to sign in since not authenticated
    await dashboardPage.waitForURL(/\/auth\/signin/)
    expect(dashboardPage.url()).toContain('/auth/signin')
  })

  test('should block /dashboard when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')

    // Should redirect to sign in
    await page.waitForURL(/\/auth\/signin/)
    expect(page.url()).toContain('/auth/signin')
  })

  test('should block /invoices when not authenticated', async ({ page }) => {
    await page.goto('/invoices')

    // Should redirect to sign in
    await page.waitForURL(/\/auth\/signin/)
    expect(page.url()).toContain('/auth/signin')
  })

  test('should allow /auth/signin without authentication', async ({ page }) => {
    const response = await page.goto('/auth/signin')

    // Auth pages should be accessible
    expect(response?.status()).toBe(200)
    expect(page.url()).toContain('/auth/signin')
  })

  test('should allow /auth/signup without authentication', async ({ page }) => {
    const response = await page.goto('/auth/signup')

    // Auth pages should be accessible
    expect(response?.status()).toBe(200)
    expect(page.url()).toContain('/auth/signup')
  })
})

test.describe('Marketing vs Authenticated Route Separation', () => {
  test('marketing routes should be publicly accessible', async ({ page }) => {
    // Blog removed until implemented (Task 5.1-5.3)
    const marketingRoutes = ['/', '/features', '/pricing']

    for (const route of marketingRoutes) {
      const response = await page.goto(route)

      // Should be accessible (200 or 404 if not yet implemented)
      // NOT 302 redirect to signin
      const status = response?.status()
      expect(status).not.toBe(302)

      // If 404, that's okay - route not implemented yet
      // If 200, that's great - route is implemented
      expect([200, 404]).toContain(status)
    }
  })

  test('app routes should require authentication', async ({ page }) => {
    const appRoutes = ['/dashboard', '/invoices', '/clients', '/luts', '/payments', '/settings']

    for (const route of appRoutes) {
      await page.goto(route)

      // Should redirect to signin
      await page.waitForURL(/\/auth\/signin/, { timeout: 5000 })
      expect(page.url()).toContain('/auth/signin')
    }
  })
})

test.describe('Root Route Content', () => {
  test('should have html lang attribute', async ({ page }) => {
    await page.goto('/')

    const htmlLang = await page.getAttribute('html', 'lang')
    expect(htmlLang).toBe('en')
  })

  test('should have viewport meta tag', async ({ page }) => {
    await page.goto('/')

    const viewport = await page.getAttribute('meta[name="viewport"]', 'content')
    expect(viewport).toContain('width=device-width')
  })

  test('should have a title tag', async ({ page }) => {
    await page.goto('/')

    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.length).toBeGreaterThan(0)
  })

  test('should have meta description', async ({ page }) => {
    await page.goto('/')

    const description = await page.getAttribute('meta[name="description"]', 'content')
    expect(description).toBeTruthy()
    expect(description!.length).toBeGreaterThan(50) // Reasonable description length
  })
})
