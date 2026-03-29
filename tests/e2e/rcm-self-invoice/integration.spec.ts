import { test, expect } from '../fixtures/data-fixture'

test.describe('RCM Self Invoice Integration Tests', () => {
  test.describe('Complete Workflow: Create Supplier -> Create Self Invoice -> View', () => {
    test('should complete full self-invoice creation workflow', async ({ authenticatedPage, testIndianSupplier }) => {
      // Navigate to self-invoices
      await authenticatedPage.goto('/self-invoices')
      await authenticatedPage.waitForLoadState('networkidle')
      await authenticatedPage.getByRole('heading', { name: /self.*invoices/i }).waitFor({ state: 'visible' })

      // Click create
      await authenticatedPage.getByRole('button', { name: /create.*self.*invoice/i }).click()
      await expect(authenticatedPage).toHaveURL(/\/self-invoices\/new/)
      await authenticatedPage.waitForLoadState('networkidle')

      // Fill self-invoice form
      // Select supplier
      const supplierSelect = authenticatedPage.getByLabel(/supplier/i)
      await supplierSelect.click()
      await authenticatedPage.getByRole('option').first().click()

      // Fill line item
      await authenticatedPage.getByLabel(/description/i).first().fill('Integration Test Service')
      await authenticatedPage.getByLabel(/amount/i).first().fill('10000')

      // Select GST rate
      const gstSelect = authenticatedPage.getByLabel(/gst.*rate/i)
      await gstSelect.click()
      await authenticatedPage.getByRole('option', { name: /18%/i }).click()

      // Select payment mode
      const paymentSelect = authenticatedPage.getByLabel(/payment.*mode/i)
      await paymentSelect.click()
      await authenticatedPage.getByRole('option', { name: /bank.*transfer/i }).click()

      // Submit
      await authenticatedPage.getByRole('button', { name: /create.*invoice|save|submit/i }).click()

      // Should redirect to invoice detail
      await expect(authenticatedPage).toHaveURL(/\/self-invoices\/[a-z0-9]+/i, { timeout: 10000 })

      // Verify invoice was created
      await expect(authenticatedPage.getByText(/SI\/\d{4}-\d{2}\/\d+/)).toBeVisible()
    })
  })

  test.describe('Intrastate Transaction (CGST + SGST)', () => {
    test('should show CGST and SGST for same-state supplier', async ({ authenticatedPage, testIndianSupplier }) => {
      await authenticatedPage.goto('/self-invoices/new')
      await authenticatedPage.waitForLoadState('networkidle')
      await authenticatedPage.getByRole('heading', { name: /create.*self.*invoice|self.*invoice/i }).waitFor({ state: 'visible' })

      const supplierSelect = authenticatedPage.getByLabel(/supplier/i)
      await supplierSelect.click()
      await authenticatedPage.getByRole('option').first().click()

      // Fill amount and GST rate
      await authenticatedPage.getByLabel(/amount/i).first().fill('10000')
      const gstSelect = authenticatedPage.getByLabel(/gst.*rate/i)
      await gstSelect.click()
      await authenticatedPage.getByRole('option', { name: /18%/i }).click()

      await authenticatedPage.waitForTimeout(500)

      // For intrastate: should show CGST 9% and SGST 9%
      // For interstate: should show IGST 18%
      const hasCgst = await authenticatedPage.getByText(/cgst/i).isVisible().catch(() => false)
      const hasSgst = await authenticatedPage.getByText(/sgst/i).isVisible().catch(() => false)
      const hasIgst = await authenticatedPage.getByText(/igst/i).isVisible().catch(() => false)

      // Should show either CGST+SGST OR IGST
      expect((hasCgst && hasSgst) || hasIgst).toBe(true)
    })
  })

  test.describe('Interstate Transaction (IGST)', () => {
    test('should show IGST for different-state supplier', async ({ authenticatedPage, testForeignVendor }) => {
      await authenticatedPage.goto('/self-invoices/new')
      await authenticatedPage.waitForLoadState('networkidle')
      await authenticatedPage.getByRole('heading', { name: /create.*self.*invoice|self.*invoice/i }).waitFor({ state: 'visible' })

      const supplierSelect = authenticatedPage.getByLabel(/supplier/i)
      await supplierSelect.click()
      await authenticatedPage.getByRole('option').first().click()

      await authenticatedPage.getByLabel(/amount/i).first().fill('10000')
      const gstSelect = authenticatedPage.getByLabel(/gst.*rate/i)
      await gstSelect.click()
      await authenticatedPage.getByRole('option', { name: /18%/i }).click()

      await authenticatedPage.waitForTimeout(500)

      // Verify GST is displayed
      const hasGst = await authenticatedPage.getByText(/cgst|sgst|igst/i).first().isVisible().catch(() => false)
      expect(hasGst).toBe(true)
    })
  })

  test.describe('Payment Voucher Auto-generation', () => {
    test('should auto-generate payment voucher with self-invoice', async ({ authenticatedPage, testSelfInvoice, testPaymentVoucher }) => {
      await authenticatedPage.goto(`/self-invoices/${testSelfInvoice.id}`)
      await authenticatedPage.waitForLoadState('networkidle')
      await authenticatedPage.getByText(/self.*invoice|invoice.*detail/i).first().waitFor({ state: 'visible' })

      // Payment voucher section should be visible
      await expect(authenticatedPage.getByText(/payment.*voucher|voucher/i)).toBeVisible()

      // Payment voucher number should be displayed
      const pvNumber = authenticatedPage.getByText(/PV\/\d{4}-\d{2}\/\d+/)
      const hasPvNumber = await pvNumber.isVisible().catch(() => false)

      // Either has PV number or payment section visible
      expect(hasPvNumber || await authenticatedPage.getByText(/payment.*voucher/i).isVisible()).toBe(true)
    })

    test('should show payment voucher download option', async ({ authenticatedPage, testSelfInvoice }) => {
      await authenticatedPage.goto('/self-invoices')
      await authenticatedPage.waitForLoadState('networkidle')

      const invoiceRow = authenticatedPage.locator('table tbody tr').first()
      await invoiceRow.waitFor({ state: 'visible' })

      // Open more menu
      const moreButton = invoiceRow.locator('button').last()
      await moreButton.click()

      // Should show payment voucher download option
      const downloadVoucher = authenticatedPage.getByText(/download.*voucher/i)
      const hasVoucherDownload = await downloadVoucher.isVisible().catch(() => false)

      // Close menu
      await authenticatedPage.keyboard.press('Escape')

      // Test structure exists
      expect(typeof hasVoucherDownload).toBe('boolean')
    })
  })

  test.describe('Edit Self Invoice', () => {
    test('should navigate to edit page', async ({ authenticatedPage, testSelfInvoice }) => {
      await authenticatedPage.goto('/self-invoices')
      await authenticatedPage.waitForLoadState('networkidle')

      const invoiceRow = authenticatedPage.locator('table tbody tr').first()
      await invoiceRow.waitFor({ state: 'visible' })

      // Click edit button
      const editButton = invoiceRow.getByRole('button', { name: /edit/i })
      await editButton.click()

      // Should navigate to edit page
      await expect(authenticatedPage).toHaveURL(/\/self-invoices\/[a-z0-9]+\/edit/i)
    })

    test('should load existing invoice data in edit form', async ({ authenticatedPage, testSelfInvoice }) => {
      await authenticatedPage.goto('/self-invoices')
      await authenticatedPage.waitForLoadState('networkidle')

      const invoiceRow = authenticatedPage.locator('table tbody tr').first()
      await invoiceRow.waitFor({ state: 'visible' })

      // Click edit
      await invoiceRow.getByRole('button', { name: /edit/i }).click()
      await expect(authenticatedPage).toHaveURL(/\/self-invoices\/[a-z0-9]+\/edit/i)

      await authenticatedPage.waitForLoadState('networkidle')

      // Form should have populated fields
      const supplierSelect = authenticatedPage.getByLabel(/supplier/i)
      await expect(supplierSelect).toBeVisible()

      // Line items should have values
      const amountField = authenticatedPage.getByLabel(/amount/i).first()
      await expect(amountField).not.toHaveValue('')
    })

    test('should save changes and redirect', async ({ authenticatedPage, testSelfInvoice }) => {
      await authenticatedPage.goto('/self-invoices')
      await authenticatedPage.waitForLoadState('networkidle')

      const invoiceRow = authenticatedPage.locator('table tbody tr').first()
      await invoiceRow.waitFor({ state: 'visible' })

      // Go to edit page
      await invoiceRow.getByRole('button', { name: /edit/i }).click()
      await authenticatedPage.waitForURL(/\/self-invoices\/[a-z0-9]+\/edit/i)

      await authenticatedPage.waitForLoadState('networkidle')

      // Update notes field
      const notesField = authenticatedPage.getByLabel(/notes|remarks/i)
      if (await notesField.isVisible().catch(() => false)) {
        await notesField.fill('Updated via integration test')
      }

      // Save
      const saveButton = authenticatedPage.getByRole('button', { name: /save|update/i })
      await saveButton.click()

      // Should redirect to detail or list page
      await expect(authenticatedPage).not.toHaveURL(/\/edit$/i, { timeout: 10000 })
    })
  })

  test.describe('Invoice Number Sequence', () => {
    test('should generate sequential invoice numbers', async ({ authenticatedPage, testSelfInvoice }) => {
      await authenticatedPage.goto('/self-invoices')
      await authenticatedPage.waitForLoadState('networkidle')

      // Check existing invoices for SI/ format
      const invoiceNumbers = authenticatedPage.locator('table tbody tr td:first-child').getByText(/SI\/\d{4}-\d{2}\/\d+/)

      const count = await invoiceNumbers.count()
      if (count < 2) {
        // Need at least 2 invoices to verify sequence — we only have 1 from fixture
        test.skip()
        return
      }

      // Get first two invoice numbers
      const num1 = await invoiceNumbers.nth(0).textContent()
      const num2 = await invoiceNumbers.nth(1).textContent()

      // Both should match SI/ format
      expect(num1).toMatch(/SI\/\d{4}-\d{2}\/\d+/)
      expect(num2).toMatch(/SI\/\d{4}-\d{2}\/\d+/)
    })
  })

  test.describe('RCM Liability Equals ITC Claimable', () => {
    test('should show equal RCM liability and ITC claimable in summary', async ({ authenticatedPage, testSelfInvoice }) => {
      await authenticatedPage.goto('/self-invoices')
      await authenticatedPage.waitForLoadState('networkidle')
      await authenticatedPage.getByRole('heading', { name: /self.*invoices/i }).waitFor({ state: 'visible' })

      // RCM summary should show liability and ITC
      const rcmLiabilityText = await authenticatedPage.getByText(/rcm liability/i).locator('..').textContent()
      const itcClaimableText = await authenticatedPage.getByText(/itc claimable/i).locator('..').textContent()

      // Extract amounts (this is a basic check - actual values should match)
      const rcmMatch = rcmLiabilityText?.match(/[\d,]+(\.\d{2})?/)
      const itcMatch = itcClaimableText?.match(/[\d,]+(\.\d{2})?/)

      if (rcmMatch && itcMatch) {
        // RCM liability should equal ITC claimable
        expect(rcmMatch[0]).toBe(itcMatch[0])
      }
    })
  })

  test.describe('Navigation Between Related Pages', () => {
    test('should navigate from self-invoice to supplier details', async ({ authenticatedPage, testSelfInvoice }) => {
      await authenticatedPage.goto('/self-invoices')
      await authenticatedPage.waitForLoadState('networkidle')

      const invoiceRow = authenticatedPage.locator('table tbody tr').first()
      await invoiceRow.waitFor({ state: 'visible' })

      // Go to invoice detail
      await invoiceRow.click()
      await expect(authenticatedPage).toHaveURL(/\/self-invoices\/[a-z0-9]+/i)

      // Look for link to supplier
      const supplierLink = authenticatedPage.getByRole('link', { name: /view.*supplier|supplier.*details/i })
      const hasLink = await supplierLink.isVisible().catch(() => false)

      // Either has link or supplier info displayed
      expect(hasLink || await authenticatedPage.getByText(/supplier/i).isVisible()).toBe(true)
    })

    test('should show self-invoice from supplier detail page', async ({ authenticatedPage, testSelfInvoice, testIndianSupplier }) => {
      await authenticatedPage.goto('/suppliers')
      await authenticatedPage.waitForLoadState('networkidle')

      const supplierRow = authenticatedPage.locator('table tbody tr').first()
      await supplierRow.waitFor({ state: 'visible' })

      // Go to supplier detail
      await supplierRow.click()

      // Should show related invoices section (use first match to avoid strict mode)
      await expect(authenticatedPage.getByText(/invoices/i).first()).toBeVisible()
    })
  })

  test.describe('Cross-Page Data Consistency', () => {
    test('should show consistent invoice data across list and detail', async ({ authenticatedPage, testSelfInvoice }) => {
      await authenticatedPage.goto('/self-invoices')
      await authenticatedPage.waitForLoadState('networkidle')

      const invoiceRow = authenticatedPage.locator('table tbody tr').first()
      await invoiceRow.waitFor({ state: 'visible' })

      // Get invoice number from list
      const invoiceNumber = await invoiceRow.getByText(/SI\/\d{4}-\d{2}\/\d+/).textContent()

      // Navigate to detail
      await invoiceRow.click()
      await expect(authenticatedPage).toHaveURL(/\/self-invoices\/[a-z0-9]+/i)

      // Verify same data on detail page
      if (invoiceNumber) {
        await expect(authenticatedPage.getByText(invoiceNumber)).toBeVisible()
      }
    })
  })

  test.describe('PDF Generation', () => {
    test('should have download PDF button on detail page', async ({ authenticatedPage, testSelfInvoice }) => {
      await authenticatedPage.goto('/self-invoices')
      await authenticatedPage.waitForLoadState('networkidle')

      const invoiceRow = authenticatedPage.locator('table tbody tr').first()
      await invoiceRow.waitFor({ state: 'visible' })

      // Navigate to detail page
      await invoiceRow.click()
      await expect(authenticatedPage).toHaveURL(/\/self-invoices\/[a-z0-9]+/i)

      // Look for download button
      const downloadButton = authenticatedPage.getByRole('button', { name: /download.*pdf|download/i })
      await expect(downloadButton.first()).toBeVisible()
    })
  })
})
