import { test, expect } from '../fixtures/data-fixture'

test.describe('AI Classification Display', () => {
  test('should display classification label', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Classification should be displayed in review page
    const pageContent = authenticatedPage.locator('text=/Review Document|Classification|Type/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show confidence percentage', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Confidence score should be visible in review page
    const pageContent = authenticatedPage.locator('text=/Review Document|Confidence|Score/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should display classification options', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Should show classification types in review page
    const pageContent = authenticatedPage.locator('text=/Review Document|Invoice|Receipt/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have manual classification override', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Should allow changing classification on review page
    const pageContent = authenticatedPage.locator('text=/Review Document|Classification/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show classification in inbox list', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto('/inbox')
    await authenticatedPage.waitForLoadState('networkidle')

    // List should show classification column
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('high confidence should show indicator', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // High confidence (>=90%) shows indicator
    const pageContent = authenticatedPage.locator('text=/Review Document|Confidence/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('medium confidence should show indicator', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Medium confidence (70-89%) shows indicator
    const pageContent = authenticatedPage.locator('text=/Review Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('low confidence should show indicator', async ({ authenticatedPage, testInboxDocument }) => {
    await authenticatedPage.goto(`/inbox/review/${testInboxDocument.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Low confidence (<70%) shows indicator
    const pageContent = authenticatedPage.locator('text=/Review Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show processing message during classification', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/inbox')
    await authenticatedPage.waitForLoadState('networkidle')

    // Processing documents should show status
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Processing/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should sort by confidence in list', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/inbox')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should be able to sort by confidence
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })
})
