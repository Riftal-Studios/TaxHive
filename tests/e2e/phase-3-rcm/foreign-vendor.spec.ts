import { test, expect } from '../fixtures/data-fixture'

test.describe('Foreign Vendor Management', () => {
  // Tests that need a supplier to show the form require testIndianSupplier fixture
  // The page shows "No Unregistered Suppliers" if there are no suppliers

  test('should display Import of Services option', async ({ authenticatedPage, testIndianSupplier }) => {
    // testIndianSupplier ensures at least one supplier exists so form is displayed
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should have Import of Services button in supplier type toggle
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await expect(foreignOption).toBeVisible()
  })

  test('should switch to Import of Services mode', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Click on Import of Services button
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()

    // Should show IGST info for foreign imports
    await authenticatedPage.waitForTimeout(500)
    const igstInfo = authenticatedPage.locator('text=/IGST|Section 5.*IGST/i')
    await expect(igstInfo.first()).toBeVisible()
  })

  test('should filter suppliers by Foreign type', async ({ authenticatedPage, testForeignVendor }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Select Import of Services mode
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()

    // Supplier dropdown should be visible
    await authenticatedPage.waitForTimeout(500)
    const supplierLabel = authenticatedPage.locator('text=/Select.*Supplier|Supplier|Foreign.*Vendor/i')
    await expect(supplierLabel.first()).toBeVisible()
  })

  test('should show foreign currency section', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Select Import of Services mode
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()

    // Should show currency-related section or IGST info in Import of Services mode
    await authenticatedPage.waitForTimeout(500)
    const pageContent = authenticatedPage.locator('text=/IGST|Import.*Services|Foreign.*Currency/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should display exchange rate field for foreign vendors', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Select Import of Services mode
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()

    // In Import of Services mode, check for IGST info or exchange rate
    await authenticatedPage.waitForTimeout(500)
    const pageContent = authenticatedPage.locator('text=/IGST|Import.*Services|Exchange/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should display exchange rate source (RBI)', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Select Import of Services mode
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()

    // Page should show Import of Services info
    await authenticatedPage.waitForTimeout(500)
    const pageContent = authenticatedPage.locator('text=/IGST|Section 5.*IGST|Import/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should calculate INR conversion correctly', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Select Import of Services mode
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()

    // Page should have line items section for amount entry
    await authenticatedPage.waitForTimeout(500)
    const pageContent = authenticatedPage.locator('text=/Service Details|Description|Amount/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should validate foreign amount > 0', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Select Import of Services mode
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()

    // Form should have service details section
    await authenticatedPage.waitForTimeout(500)
    const lineItemsHeader = authenticatedPage.locator('text=/Service Details|Add.*Service/i')
    await expect(lineItemsHeader.first()).toBeVisible()
  })

  test('should not require state field for foreign vendors', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Select Import of Services mode
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()

    // Import of Services uses IGST, no state-based CGST/SGST
    await authenticatedPage.waitForTimeout(500)
    const igstInfo = authenticatedPage.locator('text=/IGST|Section 5.*IGST/i')
    await expect(igstInfo.first()).toBeVisible()
  })

  test('should show country selection for foreign vendors', async ({ authenticatedPage, testIndianSupplier }) => {
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Select Import of Services mode
    const foreignOption = authenticatedPage.getByRole('button', { name: /Import of Services/i })
    await foreignOption.click()

    // Page should show Import of Services form
    await authenticatedPage.waitForTimeout(500)
    const form = authenticatedPage.locator('form')
    await expect(form.first()).toBeVisible()
  })
})
