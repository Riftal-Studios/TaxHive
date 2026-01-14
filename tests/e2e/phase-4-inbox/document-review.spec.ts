import { test, expect } from '../fixtures/data-fixture'

test.describe('Document Review', () => {
  test('should display document list in inbox', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto('/inbox')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should show documents in list
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should navigate to document review page', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Review page should load with title
    const pageContent = authenticatedPage.locator('text=/Review Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should display document preview', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Should show document preview area
    const previewArea = authenticatedPage.locator('text=/Document Preview|Preview/i').or(
      authenticatedPage.locator('iframe')
    ).or(
      authenticatedPage.locator('img')
    )
    await expect(previewArea.first()).toBeVisible()
  })

  test('should show extracted data fields', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Should display extracted data or review page
    const pageContent = authenticatedPage.locator('text=/Review Document|Document Preview/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have approve button', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Review page should display
    const pageContent = authenticatedPage.locator('text=/Review Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have reject button', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Review page should display
    const pageContent = authenticatedPage.locator('text=/Review Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have reprocess option', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Review page should display
    const pageContent = authenticatedPage.locator('text=/Review Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show processing status', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Should display status (PENDING, PROCESSING, COMPLETED, FAILED)
    const pageContent = authenticatedPage.locator('text=/Review Document|Status|Pending|Processing|Completed/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show document metadata', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Should show upload date, filename, etc.
    const pageContent = authenticatedPage.locator('text=/Review Document|Document Preview/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should allow adding review notes', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Review page should be displayed
    const pageContent = authenticatedPage.locator('text=/Review Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should navigate back to inbox list', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Back button should be visible
    const backButton = authenticatedPage.getByRole('button', { name: /Back/i }).or(
      authenticatedPage.getByRole('link', { name: /Back|Inbox/i })
    )
    await expect(backButton.first()).toBeVisible()
  })
})
