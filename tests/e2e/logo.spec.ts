import { test, expect } from '@playwright/test'

test.describe('Logo Display', () => {
  test('should display logo on landing page navbar', async ({ page }) => {
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check if logo image is visible
    const logo = page.locator('img[alt="TaxHive Logo"]').first()
    await expect(logo).toBeVisible()

    // Check if logo src is valid
    const src = await logo.getAttribute('src')
    console.log('Landing page logo src:', src)
    expect(src).toBeTruthy()
  })

  test('should display logo on signin page', async ({ page }) => {
    await page.goto('/auth/signin')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check if logo image is visible
    const logo = page.locator('img[alt="TaxHive Logo"]')
    await expect(logo).toBeVisible()

    // Check if logo src is valid
    const src = await logo.getAttribute('src')
    console.log('Signin page logo src:', src)
    expect(src).toBeTruthy()
  })

  test('should display logo on signup page', async ({ page }) => {
    await page.goto('/auth/signup')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check if logo image is visible
    const logo = page.locator('img[alt="TaxHive Logo"]')
    await expect(logo).toBeVisible()

    // Check if logo src is valid
    const src = await logo.getAttribute('src')
    console.log('Signup page logo src:', src)
    expect(src).toBeTruthy()
  })

  test('should take screenshot of landing page with logo', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/landing-logo.png', fullPage: true })
  })

  test('should take screenshot of signin page with logo', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/signin-logo.png', fullPage: true })
  })

  test('should take screenshot of signup page with logo', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/signup-logo.png', fullPage: true })
  })
})
