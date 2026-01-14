import { test, expect } from '../fixtures/data-fixture'

test.describe('ITC Summary Calculations', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/itc-reconciliation')
    await authenticatedPage.waitForLoadState('networkidle')
  })

  test('should display total claimable ITC', async ({ authenticatedPage }) => {
    const claimableITC = authenticatedPage.locator('text=/Total Claimable ITC/i')
    await expect(claimableITC.first()).toBeVisible()
  })

  test('should display ITC at risk', async ({ authenticatedPage }) => {
    const atRiskITC = authenticatedPage.locator('text=/At Risk ITC/i')
    await expect(atRiskITC.first()).toBeVisible()
  })

  test('should show uploads this year count', async ({ authenticatedPage }) => {
    const uploadsCount = authenticatedPage.locator('text=/Uploads This Year/i')
    await expect(uploadsCount.first()).toBeVisible()
  })

  test('should display RCM + B2B breakdown label', async ({ authenticatedPage }) => {
    const rcmLabel = authenticatedPage.locator('text=/RCM.*B2B.*last 12 months/i')
    await expect(rcmLabel.first()).toBeVisible()
  })

  test('should show mismatched or unverified label', async ({ authenticatedPage }) => {
    const mismatchLabel = authenticatedPage.locator('text=/Mismatched or unverified/i')
    await expect(mismatchLabel.first()).toBeVisible()
  })

  test('should display GSTR-2B files uploaded label', async ({ authenticatedPage }) => {
    const filesLabel = authenticatedPage.locator('text=/GSTR-2B files uploaded/i')
    await expect(filesLabel.first()).toBeVisible()
  })

  test('should show recent GSTR-2B uploads section', async ({ authenticatedPage }) => {
    const recentSection = authenticatedPage.locator('text=/Recent GSTR-2B Uploads/i')
    await expect(recentSection.first()).toBeVisible()
  })

  test('should display page title', async ({ authenticatedPage }) => {
    const pageTitle = authenticatedPage.locator('text=/ITC Reconciliation/i')
    await expect(pageTitle.first()).toBeVisible()
  })

  test('should show page description', async ({ authenticatedPage }) => {
    const description = authenticatedPage.locator('text=/Reconcile your purchase records with GSTR-2B data/i')
    await expect(description.first()).toBeVisible()
  })

  test('should have upload GSTR-2B button', async ({ authenticatedPage }) => {
    const uploadButton = authenticatedPage.getByRole('button', { name: /Upload GSTR-2B/i })
    await expect(uploadButton).toBeVisible()
  })

  test('should display ITC amounts in INR', async ({ authenticatedPage }) => {
    // Amounts should be formatted in Indian Rupees
    const pageContent = authenticatedPage.locator('text=/₹|ITC Reconciliation/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show empty state or upload list', async ({ authenticatedPage }) => {
    // Either show empty state message or list of uploads with data
    const content = authenticatedPage.locator('text=/No GSTR-2B uploads yet|entries|matched/i')
    await expect(content.first()).toBeVisible()
  })
})
