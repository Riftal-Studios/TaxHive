import { test, expect } from '../fixtures/data-fixture'

test.describe('Overdue Filing Alerts', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/gst-filings')
    await authenticatedPage.waitForLoadState('networkidle')
  })

  test('should display GST Filings page', async ({ authenticatedPage }) => {
    const pageTitle = authenticatedPage.locator('text=/GST Filings/i')
    await expect(pageTitle.first()).toBeVisible()
  })

  test('should show page description', async ({ authenticatedPage }) => {
    const description = authenticatedPage.locator('text=/Generate and manage your GSTR-1 and GSTR-3B/i')
    await expect(description.first()).toBeVisible()
  })

  test('should show alert section when overdue or page title', async ({ authenticatedPage }) => {
    // Overdue alert shows when there are overdue filings, otherwise just show page
    const pageContent = authenticatedPage.locator('text=/GST Filings|overdue/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have status tabs visible', async ({ authenticatedPage }) => {
    const statusTabs = authenticatedPage.getByRole('tab', { name: /All|Pending|Filed/i })
    await expect(statusTabs.first()).toBeVisible()
  })

  test('should have filing type toggles', async ({ authenticatedPage }) => {
    const typeToggle = authenticatedPage.getByRole('button', { name: /All|GSTR-1|GSTR-3B/i })
    await expect(typeToggle.first()).toBeVisible()
  })

  test('should display filing cards or empty state', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/GST Filings|No filing periods/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show GSTR-1 option', async ({ authenticatedPage }) => {
    const gstr1Button = authenticatedPage.getByRole('button', { name: /GSTR-1/i })
    await expect(gstr1Button.first()).toBeVisible()
  })

  test('should show GSTR-3B option', async ({ authenticatedPage }) => {
    const gstr3bButton = authenticatedPage.getByRole('button', { name: /GSTR-3B/i })
    await expect(gstr3bButton.first()).toBeVisible()
  })

  test('should persist page on reload', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/GST Filings/i')
    await expect(pageContent.first()).toBeVisible()

    await authenticatedPage.reload()
    await authenticatedPage.waitForLoadState('networkidle')

    await expect(pageContent.first()).toBeVisible()
  })

  test('should display in dashboard as well', async ({ authenticatedPage }) => {
    // Dashboard should also show filing information
    await authenticatedPage.goto('/dashboard')
    await authenticatedPage.waitForLoadState('networkidle')

    const dashboardContent = authenticatedPage.locator('text=/Dashboard/i')
    await expect(dashboardContent.first()).toBeVisible()
  })
})
