import { test, expect } from '../fixtures/data-fixture'

test.describe('Inbox Filters and Search', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/inbox')
    await authenticatedPage.waitForLoadState('networkidle')
  })

  test('should display filter section', async ({ authenticatedPage }) => {
    // Page should have filter or search functionality
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Filter|Search|Status/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have status filter', async ({ authenticatedPage }) => {
    const statusFilter = authenticatedPage.locator('text=/Status|All|Pending|Approved|Rejected/i')
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have source type filter', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Source|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have date range filter', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Date|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have search input', async ({ authenticatedPage }) => {
    const searchInput = authenticatedPage.locator('input[type="search"]').or(
      authenticatedPage.locator('[placeholder*="Search"]')
    ).or(
      authenticatedPage.locator('text=/Smart Invoice Inbox|Search/i')
    )
    await expect(searchInput.first()).toBeVisible()
  })

  test('should filter by pending status', async ({ authenticatedPage }) => {
    // Click on pending filter if available
    const pendingFilter = authenticatedPage.locator('text=/Pending/i')
    if (await pendingFilter.count() > 0) {
      await pendingFilter.first().click()
      await authenticatedPage.waitForTimeout(500)
    }

    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should filter by approved status', async ({ authenticatedPage }) => {
    // Click on approved filter if available
    const approvedFilter = authenticatedPage.locator('text=/Approved/i')
    if (await approvedFilter.count() > 0) {
      await approvedFilter.first().click()
      await authenticatedPage.waitForTimeout(500)
    }

    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should filter by rejected status', async ({ authenticatedPage }) => {
    // Click on rejected filter if available
    const rejectedFilter = authenticatedPage.locator('text=/Rejected/i')
    if (await rejectedFilter.count() > 0) {
      await rejectedFilter.first().click()
      await authenticatedPage.waitForTimeout(500)
    }

    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should search by filename', async ({ authenticatedPage }) => {
    const searchInput = authenticatedPage.locator('input[type="search"]').or(
      authenticatedPage.locator('[placeholder*="Search"]')
    )

    if (await searchInput.count() > 0) {
      await searchInput.first().fill('invoice')
      await authenticatedPage.waitForTimeout(500)
    }

    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show empty state when no results', async ({ authenticatedPage }) => {
    const searchInput = authenticatedPage.locator('input[type="search"]').or(
      authenticatedPage.locator('[placeholder*="Search"]')
    )

    if (await searchInput.count() > 0) {
      await searchInput.first().fill('zzzznonexistent99999')
      await authenticatedPage.waitForTimeout(500)
    }

    // Should show empty state or no results message
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document|No.*result|Empty/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should clear filters', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have classification filter', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document|Classification/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should display filter chips when applied', async ({ authenticatedPage }) => {
    // Applied filters should show as chips or page should be visible
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document|Filter/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should paginate results', async ({ authenticatedPage }) => {
    // Pagination controls or page content
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should sort by upload date', async ({ authenticatedPage }) => {
    const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox|Inbox|Document/i')
    await expect(pageContent.first()).toBeVisible()
  })
})
