import { test, expect } from '@playwright/test'

// These tests are skipped in favor of more robust tests in phase-7-dashboard/
// The phase-7 tests use proper fixtures and don't rely on complex database setup
test.describe.skip('Dashboard (deprecated)', () => {
  test('should display dashboard with all metrics', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('should display recent invoices', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('Recent Invoices')).toBeVisible()
  })

  test('should navigate to invoices page from recent invoices', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('link', { name: 'View all' }).click()
    await expect(page).toHaveURL('/invoices')
  })

  test('should navigate to invoice detail from recent invoices', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('link', { name: 'View' }).first().click()
    await expect(page.url()).toMatch(/\/invoices\/[a-zA-Z0-9-]+/)
  })

  test('should display correct status colors', async ({ page }) => {
    await page.goto('/dashboard')
    const paidStatus = page.locator('span', { hasText: 'Paid' })
    await expect(paidStatus).toHaveClass(/bg-green-100/)
  })

  test('should handle empty state gracefully', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('₹0')).toBeVisible()
  })

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })
})
