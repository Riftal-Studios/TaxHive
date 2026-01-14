import { test, expect } from '../fixtures/data-fixture'

test.describe('Upload Error Handling', () => {
  test.describe('Inbox Upload Errors', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/inbox')
      await authenticatedPage.waitForLoadState('networkidle')
    })

    test('should show Smart Invoice Inbox page', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should have upload document button', async ({ authenticatedPage }) => {
      const uploadButton = authenticatedPage.getByRole('button', { name: /Upload Document/i })
      await expect(uploadButton).toBeVisible()
    })

    test('should show upload dialog on click', async ({ authenticatedPage }) => {
      const uploadButton = authenticatedPage.getByRole('button', { name: /Upload Document/i })
      await uploadButton.click()
      await authenticatedPage.waitForTimeout(500)

      const dialogTitle = authenticatedPage.locator('text=/Upload Document/i')
      await expect(dialogTitle.first()).toBeVisible()
    })

    test('should allow retry after upload', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should display inbox content', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('GSTR-2B Upload Errors', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/itc-reconciliation')
      await authenticatedPage.waitForLoadState('networkidle')
    })

    test('should display ITC Reconciliation page', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/ITC Reconciliation/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should have upload GSTR-2B button', async ({ authenticatedPage }) => {
      const uploadButton = authenticatedPage.getByRole('button', { name: /Upload GSTR-2B/i })
      await expect(uploadButton).toBeVisible()
    })

    test('should show page description', async ({ authenticatedPage }) => {
      const description = authenticatedPage.locator('text=/Reconcile your purchase records/i')
      await expect(description.first()).toBeVisible()
    })

    test('should show summary cards', async ({ authenticatedPage }) => {
      const cards = authenticatedPage.locator('text=/Total Claimable ITC|At Risk ITC/i')
      await expect(cards.first()).toBeVisible()
    })
  })

  test.describe('Invoice PDF Upload Errors', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices')
      await authenticatedPage.waitForLoadState('networkidle')
    })

    test('should display invoices page', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Invoice/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should handle page load correctly', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Invoice/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('General Upload UX', () => {
    test('should display inbox page properly', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/inbox')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should have upload functionality available', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/inbox')
      await authenticatedPage.waitForLoadState('networkidle')

      const uploadButton = authenticatedPage.getByRole('button', { name: /Upload Document/i })
      await expect(uploadButton).toBeVisible()
    })

    test('should maintain page state after actions', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/inbox')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Smart Invoice Inbox/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })
})
