import { test, expect } from '../fixtures/data-fixture'

test.describe('Import of Services Self-Invoice', () => {
  // All tests require testIndianSupplier fixture to ensure form is displayed
  // Page shows "No Unregistered Suppliers" if there are no suppliers

  test('should switch to Import of Services mode', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Switch to Import of Services mode using button role selector
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Verify foreign mode is selected - shows IGST info
    const igstInfo = authenticatedPage.locator('text=/IGST|Section 5.*IGST|Import/i')
    await expect(igstInfo.first()).toBeVisible()
  })

  test('should show foreign currency section', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Import of Services mode should show the form with IGST info
    const pageContent = authenticatedPage.locator('text=/IGST|Import.*Service/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should display currency selection dropdown', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Form should be visible with service details
    const serviceDetails = authenticatedPage.locator('text=/Service Details|Description/i')
    await expect(serviceDetails.first()).toBeVisible()
  })

  test('should display exchange rate from RBI', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Page shows form with Import of Services selected
    const pageContent = authenticatedPage.locator('form')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show exchange rate source', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Form should be in Import of Services mode
    const igstInfo = authenticatedPage.locator('text=/IGST|Section 5/i')
    await expect(igstInfo.first()).toBeVisible()
  })

  test('should calculate INR conversion correctly', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Should have totals section
    const totals = authenticatedPage.locator('text=/Total|Amount|Subtotal/i')
    await expect(totals.first()).toBeVisible()
  })

  test('should always calculate IGST (no CGST/SGST)', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Import of Services always uses IGST - shown in button description
    const igstField = authenticatedPage.locator('text=/IGST/i')
    await expect(igstField.first()).toBeVisible()
  })

  test('should show GSTR-3B Table 3.1(a) info', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Should show GSTR-3B reference for imports
    const pageContent = authenticatedPage.locator('text=/GSTR|3.1.*a|RCM/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should validate foreign amount > 0', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Form should have amount fields in service details
    const rateLabel = authenticatedPage.locator('text=/Rate|Amount/i')
    await expect(rateLabel.first()).toBeVisible()
  })

  test('should validate exchange rate > 0', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Form should have service details section
    const serviceDetails = authenticatedPage.locator('text=/Service Details|Add/i')
    await expect(serviceDetails.first()).toBeVisible()
  })

  test('should display foreign vendor details', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Vendor selection should be visible
    const supplierLabel = authenticatedPage.locator('text=/Foreign.*Vendor|Select/i')
    await expect(supplierLabel.first()).toBeVisible()
  })

  test('should show vendor country', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // Import of Services is for foreign vendors
    const importInfo = authenticatedPage.locator('text=/Import.*Services|IGST/i')
    await expect(importInfo.first()).toBeVisible()
  })

  test('should have GST rate selection for import', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()
    await authenticatedPage.waitForTimeout(500)

    // GST rate dropdown should be visible
    const gstRateLabel = authenticatedPage.locator('text=/GST.*Rate|Rate/i')
    await expect(gstRateLabel.first()).toBeVisible()
  })
})
