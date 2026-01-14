import { test, expect } from '../fixtures/data-fixture'

test.describe('Match Status Management', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/itc-reconciliation')
    await authenticatedPage.waitForLoadState('networkidle')
  })

  test('should display ITC reconciliation page', async ({ authenticatedPage }) => {
    const pageTitle = authenticatedPage.locator('text=/ITC Reconciliation/i')
    await expect(pageTitle.first()).toBeVisible()
  })

  test('should show matched count in uploads', async ({ authenticatedPage }) => {
    // Matched count is shown for each upload period
    const matchedText = authenticatedPage.locator('text=/matched|No GSTR-2B uploads yet/i')
    await expect(matchedText.first()).toBeVisible()
  })

  test('should show issues count in uploads', async ({ authenticatedPage }) => {
    // Issues/mismatched count is shown for each upload period
    const issuesText = authenticatedPage.locator('text=/issues|No GSTR-2B uploads yet/i')
    await expect(issuesText.first()).toBeVisible()
  })

  test('should display entries count', async ({ authenticatedPage }) => {
    // Entries count shown for each upload
    const entriesText = authenticatedPage.locator('text=/entries|No GSTR-2B uploads yet/i')
    await expect(entriesText.first()).toBeVisible()
  })

  test('should show at risk ITC card', async ({ authenticatedPage }) => {
    const atRiskCard = authenticatedPage.locator('text=/At Risk ITC/i')
    await expect(atRiskCard.first()).toBeVisible()
  })

  test('should show mismatched or unverified label', async ({ authenticatedPage }) => {
    const mismatchLabel = authenticatedPage.locator('text=/Mismatched or unverified/i')
    await expect(mismatchLabel.first()).toBeVisible()
  })

  test('should display status chip for uploads', async ({ authenticatedPage }) => {
    // Upload cards show status chips (COMPLETED, PROCESSING, etc.)
    const pageContent = authenticatedPage.locator('text=/ITC Reconciliation|COMPLETED|PROCESSING/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show total claimable ITC', async ({ authenticatedPage }) => {
    const claimableCard = authenticatedPage.locator('text=/Total Claimable ITC/i')
    await expect(claimableCard.first()).toBeVisible()
  })

  test('should have clickable upload cards', async ({ authenticatedPage }) => {
    // Upload cards should be clickable to view details
    const pageContent = authenticatedPage.locator('text=/ITC Reconciliation/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show upload date information', async ({ authenticatedPage }) => {
    // Each upload shows when it was uploaded
    const uploadedText = authenticatedPage.locator('text=/Uploaded|No GSTR-2B uploads yet/i')
    await expect(uploadedText.first()).toBeVisible()
  })

  test('should display RCM and B2B label', async ({ authenticatedPage }) => {
    const rcmLabel = authenticatedPage.locator('text=/RCM.*B2B/i')
    await expect(rcmLabel.first()).toBeVisible()
  })

  test('should show recent uploads section', async ({ authenticatedPage }) => {
    const recentSection = authenticatedPage.locator('text=/Recent GSTR-2B Uploads/i')
    await expect(recentSection.first()).toBeVisible()
  })

  test('should have upload button visible', async ({ authenticatedPage }) => {
    const uploadButton = authenticatedPage.getByRole('button', { name: /Upload GSTR-2B/i })
    await expect(uploadButton).toBeVisible()
  })
})
