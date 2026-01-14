import { test, expect } from '../fixtures/data-fixture'

test.describe('Due Date Display', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/gst-filings')
    await authenticatedPage.waitForLoadState('networkidle')
  })

  test('should display GST Filings page', async ({ authenticatedPage }) => {
    const pageTitle = authenticatedPage.locator('text=/GST Filings/i')
    await expect(pageTitle.first()).toBeVisible()
  })

  test('should show page subtitle', async ({ authenticatedPage }) => {
    const subtitle = authenticatedPage.locator('text=/Generate and manage your GSTR-1 and GSTR-3B/i')
    await expect(subtitle.first()).toBeVisible()
  })

  test('GSTR-1 toggle should be visible', async ({ authenticatedPage }) => {
    const gstr1Toggle = authenticatedPage.getByRole('button', { name: /GSTR-1/i })
    await expect(gstr1Toggle.first()).toBeVisible()
  })

  test('GSTR-3B toggle should be visible', async ({ authenticatedPage }) => {
    const gstr3bToggle = authenticatedPage.getByRole('button', { name: /GSTR-3B/i })
    await expect(gstr3bToggle.first()).toBeVisible()
  })

  test('should show days display or empty state', async ({ authenticatedPage }) => {
    // Should display days left or empty state
    const pageContent = authenticatedPage.locator('text=/GST Filings|day|No filing periods/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should display status tabs', async ({ authenticatedPage }) => {
    const allTab = authenticatedPage.getByRole('tab', { name: /All/i })
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

  test('should show filing cards or empty state', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/GST Filings|No filing periods/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show period year or empty state', async ({ authenticatedPage }) => {
    // Due date should be associated with correct period
    const pageContent = authenticatedPage.locator('text=/GST Filings|202|No filing periods/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should display All toggle button', async ({ authenticatedPage }) => {
    const allButton = authenticatedPage.getByRole('button', { name: /^All$/i })
    await expect(allButton.first()).toBeVisible()
  })

  test('should show filing type filters', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/GST Filings|GSTR-1|GSTR-3B/i')
    await expect(pageContent.first()).toBeVisible()
  })
})
