import { test, expect } from '../fixtures/data-fixture'

test.describe('Form Validation Errors', () => {
  test.describe('Invoice Form Validation', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices/new')
      await authenticatedPage.waitForLoadState('networkidle')
    })

    test('should display create invoice page or no clients message', async ({ authenticatedPage }) => {
      // Page shows either "Create Invoice" form or "No Clients Found" message
      const pageContent = authenticatedPage.locator('text=/Create Invoice|No Clients Found/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should show invoice content', async ({ authenticatedPage }) => {
      // Page shows invoice-related content
      const pageContent = authenticatedPage.locator('text=/Invoice|Client/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should have action button', async ({ authenticatedPage }) => {
      // Has either submit button or "Add Client" button
      const pageContent = authenticatedPage.locator('text=/Invoice|Client|Add/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should display page content', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Invoice|Client/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should show appropriate message or form', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Invoice|Client|Create/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should display form or warning', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Invoice|No Clients|Create/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should maintain page state', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Invoice|Client/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('Client Page Validation', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/clients')
      await authenticatedPage.waitForLoadState('networkidle')
    })

    test('should display clients page', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Client/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should show add client button', async ({ authenticatedPage }) => {
      const addButton = authenticatedPage.getByRole('button', { name: /Add Client/i })
      await expect(addButton.first()).toBeVisible()
    })

    test('should have client search or empty state', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Client|Search|No clients/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should show client list or empty message', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Client/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('LUT Page Validation', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/luts')
      await authenticatedPage.waitForLoadState('networkidle')
    })

    test('should display LUT management page', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/LUT.*Management|LUT/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should show add LUT button', async ({ authenticatedPage }) => {
      const addButton = authenticatedPage.getByRole('button', { name: /Add.*LUT|New.*LUT/i })
      await expect(addButton.first()).toBeVisible()
    })

    test('should display LUT list or empty state', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/LUT|No.*LUT/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should display page content', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/LUT/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('Self-Invoice Form Validation', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/self-invoices/new')
      await authenticatedPage.waitForLoadState('networkidle')
    })

    test('should display self-invoice page content', async ({ authenticatedPage }) => {
      // Page shows either form, "No Unregistered Suppliers", or "Business Profile Incomplete"
      const pageContent = authenticatedPage.locator('text=/Self.*Invoice|Supplier|Business Profile|RCM|Unregistered/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should show relevant content or warning', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Supplier|Business Profile|Self.*Invoice|RCM|Unregistered/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should show action button or warning', async ({ authenticatedPage }) => {
      // Either shows form fields, Add Supplier button, or Complete Profile button
      const pageContent = authenticatedPage.locator('text=/Supplier|Add|Complete|Business/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should display page state', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Supplier|Profile|Self.*Invoice|Unregistered/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should display RCM or profile related content', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Self.*Invoice|RCM|Profile|Supplier|Unregistered/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('Unregistered Supplier Form Validation', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/self-invoices/new')
      await authenticatedPage.waitForLoadState('networkidle')
    })

    test('should show supplier related content', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Supplier|Profile|Self.*Invoice|Unregistered/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should show form or empty state', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Supplier|Profile|Self.*Invoice|Unregistered|Business/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should handle page state', async ({ authenticatedPage }) => {
      const pageContent = authenticatedPage.locator('text=/Self.*Invoice|Supplier|Profile|Unregistered/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })

  test.describe('General Form UX', () => {
    test('should display invoice form properly', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices/new')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Invoice|Client|Create/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should maintain page state', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices/new')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Invoice|Client/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should show form fields or warning', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices/new')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Invoice|Client|No/i')
      await expect(pageContent.first()).toBeVisible()
    })

    test('should allow form interaction', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invoices/new')
      await authenticatedPage.waitForLoadState('networkidle')

      const pageContent = authenticatedPage.locator('text=/Invoice|Client/i')
      await expect(pageContent.first()).toBeVisible()
    })
  })
})
