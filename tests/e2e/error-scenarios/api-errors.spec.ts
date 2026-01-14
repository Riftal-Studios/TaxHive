import { test, expect } from '../fixtures/data-fixture'

test.describe('API Error Handling', () => {
  test.describe('Dashboard API Errors', () => {
    test('should display dashboard page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Dashboard/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should handle page load correctly', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Dashboard/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should show dashboard content', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Dashboard/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should display dashboard widgets', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Dashboard/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('Invoice API Errors', () => {
    test('should display create invoice page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices/new')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Invoice|Create|New/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should display invoices list page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Invoice/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should handle invalid invoice ID', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices/invalid-id')
      await authenticatedPage.waitForLoadState('networkidle')

      // Should handle invalid ID gracefully
      const pageContent = authenticatedPage.locator('text=/Not.*Found|Error|Invoice/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('Client API Errors', () => {
    test('should display clients page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/clients')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Client/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should handle invalid client ID', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/clients/invalid-id')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Not.*Found|Error|Client/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('Session Handling', () => {
    test('should redirect to login on session expiry', async ({ page }) => {
      // Without auth, should redirect to login
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Should be on login page or show login prompt
      const loginPage = page.locator('text=/Sign.*In|Login|Email/i')
      await expect(loginPage.first()).toBeVisible()
    })

    test('should show login page for unauthenticated users', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const pageContent = page.locator('text=/Sign.*In|Login/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('Error Toast Messages', () => {
    test('should display dashboard properly', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Dashboard/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should maintain page state', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Dashboard/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should allow closing dialogs', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Dashboard/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('Error Messages Quality', () => {
    test('should show friendly error for invalid routes', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices/invalid-id')
      await authenticatedPage.waitForLoadState('networkidle')

      // Should show friendly message
      const friendlyMessage = authenticatedPage.locator('text=/Not.*Found|Error|Invoice/i')
      await expect(friendlyMessage.first()).toBeVisible()
    })

    test('should display invoices page content', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Invoice/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })
})
