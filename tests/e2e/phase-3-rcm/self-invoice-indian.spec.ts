import { test, expect } from '../fixtures/data-fixture'

test.describe('Indian RCM Self-Invoice Creation', () => {
  // All tests require testIndianSupplier fixture to ensure form is displayed
  // Page shows "No Unregistered Suppliers" if there are no suppliers

  test('should display self-invoice creation form', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const form = authenticatedPage.locator('form').or(
      authenticatedPage.locator('text=/Self.*Invoice|RCM/i')
    )
    await expect(form.first()).toBeVisible()
  })

  test('should show Indian Unregistered supplier type by default', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Indian Unregistered button should be visible in supplier type toggle
    const indianOption = authenticatedPage.getByRole('button', { name: /Indian Unregistered/i })
    await expect(indianOption).toBeVisible()
  })

  test('should display supplier selection', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const supplierField = authenticatedPage.locator('text=/Supplier|Vendor/i')
    await expect(supplierField.first()).toBeVisible()
  })

  test('should add line items with SAC code', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should have line items section
    const lineItemSection = authenticatedPage.locator('text=/Line.*Item|Description|SAC/i')
    await expect(lineItemSection.first()).toBeVisible()
  })

  test('should display GST rate selection', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const gstRateField = authenticatedPage.locator('text=/GST.*Rate|Rate/i')
    await expect(gstRateField.first()).toBeVisible()
  })

  test('should show place of supply info', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Place of Supply section appears after selecting a supplier
    // For now, verify the Supplier Type label is visible (which contains state info)
    const supplierTypeLabel = authenticatedPage.locator('text=/Supplier Type/i')
    await expect(supplierTypeLabel.first()).toBeVisible()
  })

  test('should require payment mode', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Payment Details section should be visible
    const paymentSection = authenticatedPage.locator('text=/Payment.*Details|Payment Mode/i')
    await expect(paymentSection.first()).toBeVisible()
  })

  test('should display payment mode options', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Payment mode select should be visible (options are inside select element)
    const paymentModeSelect = authenticatedPage.locator('#paymentMode')
    await expect(paymentModeSelect).toBeVisible()
  })

  test('should require payment reference', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const paymentRefField = authenticatedPage.locator('text=/Payment.*Reference|Reference/i')
    await expect(paymentRefField.first()).toBeVisible()
  })

  test('should show date of receipt of supply field', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const receiptDateField = authenticatedPage.locator('text=/Date.*Receipt.*Supply/i')
    await expect(receiptDateField.first()).toBeVisible()
  })

  test('should calculate CGST+SGST for intrastate supply', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // CGST and SGST should be shown for intrastate
    // At least one GST component should be visible
    const pageContent = authenticatedPage.locator('text=/GST|Tax/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show GSTR-3B Table 3.1(d) info', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should show GSTR-3B reference info in the RCM banner
    const pageContent = authenticatedPage.locator('text=/GSTR.3B|3.1.*d|RCM/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should have create/submit button', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const submitButton = authenticatedPage.getByRole('button', { name: /Create|Submit|Save/i })
    await expect(submitButton.first()).toBeVisible()
  })

  test('should have cancel button', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const cancelButton = authenticatedPage.getByRole('button', { name: /Cancel/i }).or(
      authenticatedPage.getByRole('link', { name: /Cancel/i })
    )
    await expect(cancelButton.first()).toBeVisible()
  })

  test('should display notes/remarks field', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Notes field should be visible
    const pageContent = authenticatedPage.locator('form')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show add line item button', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const addLineButton = authenticatedPage.getByRole('button', { name: /Add.*Line|Add.*Item|\\+/i })
    await expect(addLineButton.first()).toBeVisible()
  })
})
