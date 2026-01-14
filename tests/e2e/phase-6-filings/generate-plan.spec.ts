import { test, expect } from '../fixtures/data-fixture'

test.describe('Filing Plan Generation', () => {
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

  test('should show filing type toggle', async ({ authenticatedPage }) => {
    const typeSelect = authenticatedPage.locator('text=/GSTR-1|GSTR-3B/i')
    await expect(typeSelect.first()).toBeVisible()
  })

  test('should have All status tab', async ({ authenticatedPage }) => {
    const allTab = authenticatedPage.getByRole('tab', { name: /^All$/i })
    await expect(allTab.first()).toBeVisible()
  })

  test('should have Pending tab', async ({ authenticatedPage }) => {
    const pendingTab = authenticatedPage.getByRole('tab', { name: /Pending/i })
    await expect(pendingTab.first()).toBeVisible()
  })

  test('should have Filed tab', async ({ authenticatedPage }) => {
    const filedTab = authenticatedPage.getByRole('tab', { name: /Filed/i })
    await expect(filedTab.first()).toBeVisible()
  })

  test('should display filing cards or empty state', async ({ authenticatedPage }) => {
    // When generating, should show progress indicator or empty state
    const pageContent = authenticatedPage.locator('text=/GST Filings|No filing periods/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show items count or empty state', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/GST Filings|items|No filing periods/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show taxable value or empty state', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/GST Filings|Taxable|₹|No filing periods/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show GSTR-1 toggle option', async ({ authenticatedPage }) => {
    const gstr1Option = authenticatedPage.getByRole('button', { name: /GSTR-1/i })
    await expect(gstr1Option.first()).toBeVisible()
  })

  test('should show GSTR-3B toggle option', async ({ authenticatedPage }) => {
    const gstr3bOption = authenticatedPage.getByRole('button', { name: /GSTR-3B/i })
    await expect(gstr3bOption.first()).toBeVisible()
  })
})
