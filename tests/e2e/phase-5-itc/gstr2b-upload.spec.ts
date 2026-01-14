import { test, expect } from '../fixtures/data-fixture'

test.describe('GSTR-2B Upload', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/itc-reconciliation')
    await authenticatedPage.waitForLoadState('networkidle')
  })

  test('should display ITC reconciliation page', async ({ authenticatedPage }) => {
    const pageTitle = authenticatedPage.locator('text=/ITC Reconciliation/i')
    await expect(pageTitle.first()).toBeVisible()
  })

  test('should show upload GSTR-2B button', async ({ authenticatedPage }) => {
    const uploadButton = authenticatedPage.getByRole('button', { name: /Upload GSTR-2B/i })
    await expect(uploadButton).toBeVisible()
  })

  test('should display page subtitle', async ({ authenticatedPage }) => {
    const subtitle = authenticatedPage.locator('text=/Reconcile your purchase records/i')
    await expect(subtitle.first()).toBeVisible()
  })

  test('should show total claimable ITC card', async ({ authenticatedPage }) => {
    const claimableCard = authenticatedPage.locator('text=/Total Claimable ITC/i')
    await expect(claimableCard.first()).toBeVisible()
  })

  test('should display at risk ITC card', async ({ authenticatedPage }) => {
    const atRiskCard = authenticatedPage.locator('text=/At Risk ITC/i')
    await expect(atRiskCard.first()).toBeVisible()
  })

  test('should show uploads this year card', async ({ authenticatedPage }) => {
    const uploadsCard = authenticatedPage.locator('text=/Uploads This Year/i')
    await expect(uploadsCard.first()).toBeVisible()
  })

  test('should display recent GSTR-2B uploads section', async ({ authenticatedPage }) => {
    const recentSection = authenticatedPage.locator('text=/Recent GSTR-2B Uploads/i')
    await expect(recentSection.first()).toBeVisible()
  })

  test('should show empty state or uploads list', async ({ authenticatedPage }) => {
    // Should show either empty state message or list of uploads
    const content = authenticatedPage.locator('text=/No GSTR-2B uploads yet|entries|matched/i')
    await expect(content.first()).toBeVisible()
  })

  test('should have RCM + B2B label', async ({ authenticatedPage }) => {
    const rcmLabel = authenticatedPage.locator('text=/RCM.*B2B/i')
    await expect(rcmLabel.first()).toBeVisible()
  })

  test('should show mismatched or unverified label', async ({ authenticatedPage }) => {
    const mismatchLabel = authenticatedPage.locator('text=/Mismatched or unverified/i')
    await expect(mismatchLabel.first()).toBeVisible()
  })
})
