import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should show sign in page', async ({ page }) => {
    await page.goto('/')
    
    // Should redirect to sign in
    await page.click('text=Get Started')
    await expect(page).toHaveURL('/auth/signin')
    
    // Should show sign in form
    await expect(page.locator('h1')).toContainText('Sign in to GSTHive')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('Send Magic Link')
  })

  test('should handle email submission', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Fill in email
    await page.fill('input[type="email"]', 'test@example.com')
    await page.click('button[type="submit"]')
    
    // Should show verification page
    await expect(page).toHaveURL('/auth/verify-request')
    await expect(page.locator('h1')).toContainText('Check your email')
  })

  test('protected routes should redirect to sign in', async ({ page }) => {
    // Try to access dashboard without auth
    await page.goto('/dashboard')
    
    // Should redirect to sign in
    await expect(page).toHaveURL('/auth/signin?callbackUrl=%2Fdashboard')
  })
})