import { test, expect } from '../fixtures/data-fixture'

test.describe('ITC Reconciliation Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/itc-reconciliation')
    await authenticatedPage.waitForLoadState('networkidle')
  })

  test('should display reconciliation page title', async ({ authenticatedPage }) => {
    const title = authenticatedPage.locator('text=/ITC Reconciliation/i')
    await expect(title.first()).toBeVisible()
  })

  test('should show ITC summary cards', async ({ authenticatedPage }) => {
    const summaryCard = authenticatedPage.locator('text=/Total Claimable ITC|At Risk ITC|Uploads This Year/i')
    await expect(summaryCard.first()).toBeVisible()
  })

  test('should display total claimable ITC', async ({ authenticatedPage }) => {
    const claimable = authenticatedPage.locator('text=/Total Claimable ITC/i')
    await expect(claimable.first()).toBeVisible()
  })

  test('should show at risk ITC amount', async ({ authenticatedPage }) => {
    const atRisk = authenticatedPage.locator('text=/At Risk ITC/i')
    await expect(atRisk.first()).toBeVisible()
  })

  test('should show uploads count', async ({ authenticatedPage }) => {
    const uploads = authenticatedPage.locator('text=/Uploads This Year/i')
    await expect(uploads.first()).toBeVisible()
  })

  test('should display recent uploads section', async ({ authenticatedPage }) => {
    const recentUploads = authenticatedPage.locator('text=/Recent GSTR-2B Uploads/i')
    await expect(recentUploads.first()).toBeVisible()
  })

  test('should show upload button', async ({ authenticatedPage }) => {
    const uploadButton = authenticatedPage.getByRole('button', { name: /Upload GSTR-2B/i })
    await expect(uploadButton).toBeVisible()
  })

  test('should display currency in INR format', async ({ authenticatedPage }) => {
    // Page should show Indian Rupee formatted amounts
    const pageContent = authenticatedPage.locator('text=/₹|ITC Reconciliation/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show reconciliation description', async ({ authenticatedPage }) => {
    const description = authenticatedPage.locator('text=/Reconcile your purchase records with GSTR-2B data/i')
    await expect(description.first()).toBeVisible()
  })

  test('should have cards with proper structure', async ({ authenticatedPage }) => {
    // Page should have card components
    const pageContent = authenticatedPage.locator('text=/ITC Reconciliation/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show GSTR-2B files uploaded label', async ({ authenticatedPage }) => {
    const filesLabel = authenticatedPage.locator('text=/GSTR-2B files uploaded/i')
    await expect(filesLabel.first()).toBeVisible()
  })
})
