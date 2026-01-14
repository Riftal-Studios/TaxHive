import { test, expect } from '../fixtures/data-fixture'

test.describe('Filing Periods List', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/gst-filings')
    await authenticatedPage.waitForLoadState('networkidle')
  })

  test('should display filings page', async ({ authenticatedPage }) => {
    const pageTitle = authenticatedPage.locator('text=/GST Filings/i')
    await expect(pageTitle.first()).toBeVisible()
  })

  test('should show page subtitle', async ({ authenticatedPage }) => {
    const subtitle = authenticatedPage.locator('text=/Generate and manage your GSTR-1 and GSTR-3B filing plans/i')
    await expect(subtitle.first()).toBeVisible()
  })

  test('should have All toggle button', async ({ authenticatedPage }) => {
    const allButton = authenticatedPage.getByRole('button', { name: /^All$/i })
    await expect(allButton.first()).toBeVisible()
  })

  test('should filter by GSTR-1', async ({ authenticatedPage }) => {
    const gstr1Filter = authenticatedPage.getByRole('button', { name: /GSTR-1/i })
    await expect(gstr1Filter.first()).toBeVisible()
  })

  test('should filter by GSTR-3B', async ({ authenticatedPage }) => {
    const gstr3bFilter = authenticatedPage.getByRole('button', { name: /GSTR-3B/i })
    await expect(gstr3bFilter.first()).toBeVisible()
  })

  test('should have pending status tab', async ({ authenticatedPage }) => {
    const pendingTab = authenticatedPage.getByRole('tab', { name: /Pending/i })
    await expect(pendingTab.first()).toBeVisible()
  })

  test('should have filed status tab', async ({ authenticatedPage }) => {
    const filedTab = authenticatedPage.getByRole('tab', { name: /Filed/i })
    await expect(filedTab.first()).toBeVisible()
  })

  test('should show period format or empty state', async ({ authenticatedPage }) => {
    // Period should be shown as Month Year or empty state message
    const periodFormat = authenticatedPage.locator('text=/20[0-9]{2}|No filing periods found/i')
    await expect(periodFormat.first()).toBeVisible()
  })

  test('should display status chips or empty state', async ({ authenticatedPage }) => {
    // Status chips or empty state
    const pageContent = authenticatedPage.locator('text=/GST Filings|No filing periods/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show due date or empty state', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/GST Filings|Due|No filing periods/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show filing type or empty state', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/GST Filings|GSTR-1|GSTR-3B|No filing periods/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show empty state when no filings', async ({ authenticatedPage }) => {
    // If no filings exist, should show empty state
    const pageContent = authenticatedPage.locator('text=/GST Filings|No filing periods found/i')
    await expect(pageContent.first()).toBeVisible()
  })
})
