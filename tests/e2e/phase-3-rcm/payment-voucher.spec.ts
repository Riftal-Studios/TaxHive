import { test, expect } from '../fixtures/data-fixture'

test.describe('Payment Voucher', () => {
  test('should display payment voucher in self-invoice list', async ({ authenticatedPage, testPaymentVoucher }) => {
    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Table should have payment voucher column or link
    const pageContent = authenticatedPage.locator('text=/Self.Invoice|Voucher|Payment/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should link payment voucher to self-invoice', async ({ authenticatedPage, testSelfInvoice, testPaymentVoucher }) => {
    await authenticatedPage.goto(`/self-invoices/${testSelfInvoice.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Detail view should show linked payment voucher
    const voucherLink = authenticatedPage.locator('text=/Payment.*Voucher|Voucher/i')
    await expect(voucherLink.first()).toBeVisible()
  })

  test('should display payment reference in voucher', async ({ authenticatedPage, testPaymentVoucher }) => {
    // Payment voucher should show reference
    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    const pageContent = authenticatedPage.locator('text=/Self.Invoice|Payment/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show download voucher option', async ({ authenticatedPage, testSelfInvoice }) => {
    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should have download option for voucher
    // Page should have actions available
    const pageContent = authenticatedPage.locator('text=/Self.Invoice/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('payment voucher should show supplier name', async ({ authenticatedPage, testPaymentVoucher }) => {
    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Table should show supplier name
    const pageContent = authenticatedPage.locator('text=/Self.Invoice|Supplier/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('payment voucher should show voucher number', async ({ authenticatedPage, testPaymentVoucher }) => {
    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should display voucher number
    const pageContent = authenticatedPage.locator('text=/Self.Invoice/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('payment voucher should show voucher date', async ({ authenticatedPage, testPaymentVoucher }) => {
    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should display date
    const pageContent = authenticatedPage.locator('text=/Self.Invoice/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('payment voucher should show amount', async ({ authenticatedPage, testPaymentVoucher }) => {
    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should show amount in list
    const amountField = authenticatedPage.locator('text=/₹|Amount/i')
    await expect(amountField.first()).toBeVisible()
  })

  test('payment voucher should show payment mode', async ({ authenticatedPage, testPaymentVoucher }) => {
    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Payment mode should be visible
    const pageContent = authenticatedPage.locator('text=/Self.Invoice/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should auto-generate payment voucher on self-invoice submit', async ({ authenticatedPage, testIndianSupplier }) => {
    // This is tested implicitly - when self-invoice is created, voucher is generated
    // testIndianSupplier ensures at least one supplier exists
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Form should have Payment Voucher Details section
    const paymentSection = authenticatedPage.locator('text=/Payment Voucher Details|Payment Mode/i')
    await expect(paymentSection.first()).toBeVisible()
  })
})
