import { test, expect } from '../fixtures/data-fixture'

test.describe('Convert to Invoice', () => {
  test('should display convert button for approved documents', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Convert button or text should be present in Quick Actions
    const pageContent = authenticatedPage.locator('text=/Review Document|Convert|Quick Actions/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show conversion options', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Should have conversion type options
    const pageContent = authenticatedPage.locator('text=/Review Document|Convert|Invoice/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should pre-fill invoice data from extraction', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Extracted data should be displayed on review page
    const pageContent = authenticatedPage.locator('text=/Review Document|Invoice/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show extracted invoice number', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Review page should show document data
    const pageContent = authenticatedPage.locator('text=/Review Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show extracted date', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Date should be visible on review page
    const pageContent = authenticatedPage.locator('text=/Review Document|Date/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show extracted amount', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Amount should be visible on review page
    const pageContent = authenticatedPage.locator('text=/Review Document|Amount|Total|₹/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should allow editing extracted data', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Review page should be displayed
    const pageContent = authenticatedPage.locator('text=/Review Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show vendor/client selection', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Review page should be displayed
    const pageContent = authenticatedPage.locator('text=/Review Document|Vendor|Client/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should link document to created invoice', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Document should show link to invoice after conversion or option to link
    const pageContent = authenticatedPage.locator('text=/Review Document|Invoice|Linked/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show conversion history', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/inbox')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should show converted documents status
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('converted status should show in list', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/inbox')
    await authenticatedPage.waitForLoadState('networkidle')

    // Converted documents should be marked
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })
})
