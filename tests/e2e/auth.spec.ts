import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should show sign in page', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Should show sign in form
    await expect(page.locator('h1')).toContainText('Sign in to GSTHive')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In')
  })

  test('should show validation error with empty fields', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Click submit without filling fields
    await page.click('button[type="submit"]')
    
    // Should show browser validation (HTML5 required fields)
    // The form should not submit
    await expect(page).toHaveURL('/auth/signin')
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'nonexistent@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    
    // Should stay on signin page and show error
    await expect(page).toHaveURL('/auth/signin')
    // Error message should appear (check for error alert or text)
    await expect(page.locator('[role="alert"]')).toBeVisible()
  })

  test('protected routes should redirect to sign in', async ({ page }) => {
    // Try to access dashboard without auth
    await page.goto('/dashboard')
    
    // Should redirect to sign in with callback URL
    // The URL encoding might vary, so let's check the base path and parameter existence
    await expect(page).toHaveURL(/\/auth\/signin/)
    await expect(page.url()).toContain('callbackUrl')
    await expect(page.url()).toContain('dashboard')
  })

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Click sign up link
    await page.click('text=Sign up')
    
    // Should navigate to signup page
    await expect(page).toHaveURL('/auth/signup')
  })

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Click forgot password link
    await page.click('text=Forgot password?')
    
    // Should navigate to forgot password page
    await expect(page).toHaveURL('/auth/forgot-password')
  })
})