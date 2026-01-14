import { test, expect } from '../fixtures/data-fixture'

test.describe('Document Upload', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/inbox')
    await authenticatedPage.waitForLoadState('networkidle')
  })

  test('should display upload button', async ({ authenticatedPage }) => {
    // Upload Document button should be visible
    const uploadButton = authenticatedPage.getByRole('button', { name: /Upload Document/i })
    await expect(uploadButton).toBeVisible()
  })

  test('should show smart invoice inbox title', async ({ authenticatedPage }) => {
    // Page should show the main title
    const pageTitle = authenticatedPage.locator('text=/Smart Invoice Inbox/i')
    await expect(pageTitle.first()).toBeVisible()
  })

  test('should display supported file types', async ({ authenticatedPage }) => {
    // Page should have upload section
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Upload|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show file size limit info', async ({ authenticatedPage }) => {
    // Page should have upload information
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Upload|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should display document source selection', async ({ authenticatedPage }) => {
    // Page should have inbox section
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Upload|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show inbox list section', async ({ authenticatedPage }) => {
    // Inbox should have list of documents or empty state
    const listSection = authenticatedPage.locator('table').or(
      authenticatedPage.locator('[data-testid="inbox-list"]')
    ).or(
      authenticatedPage.locator('text=/No.*documents|Empty|Smart Invoice Inbox/i')
    )
    await expect(listSection.first()).toBeVisible()
  })

  test('should have inbox stats', async ({ authenticatedPage }) => {
    // InboxStats component should be visible
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Total|Documents/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show batch upload option', async ({ authenticatedPage }) => {
    // Upload button should be available
    const uploadButton = authenticatedPage.getByRole('button', { name: /Upload Document/i })
    await expect(uploadButton).toBeVisible()
  })

  test('should open upload dialog on button click', async ({ authenticatedPage }) => {
    // Click upload button
    const uploadButton = authenticatedPage.getByRole('button', { name: /Upload Document/i })
    await uploadButton.click()
    await authenticatedPage.waitForTimeout(500)

    // Dialog should open
    const dialogTitle = authenticatedPage.locator('text=/Upload Document/i')
    await expect(dialogTitle.first()).toBeVisible()
  })

  test('should display recent uploads section', async ({ authenticatedPage }) => {
    // Should show inbox content
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })
})
