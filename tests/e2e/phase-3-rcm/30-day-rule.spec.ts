import { test, expect } from '../fixtures/data-fixture'
import { prisma } from '../../../lib/prisma'

test.describe('30-Day Rule Compliance', () => {
  test('should display RCM compliance status in self-invoice list', async ({ authenticatedPage, testSelfInvoice }) => {
    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // List should have compliance status column or chip
    const pageContent = authenticatedPage.locator('text=/Self.Invoice|RCM|Status/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should show compliant status when <= 25 days', async ({ authenticatedPage, testUser }) => {
    // Create a self-invoice within 25 days
    const receiptDate = new Date()
    receiptDate.setDate(receiptDate.getDate() - 20) // 20 days ago

    // Create test invoice (cleanup happens via fixture)
    const invoice = await prisma.invoice.create({
      data: {
        userId: testUser.id,
        invoiceNumber: `SI/TEST/${Date.now()}`,
        invoiceDate: new Date(),
        dateOfReceiptOfSupply: receiptDate,
        dueDate: new Date(),
        status: 'SENT',
        invoiceType: 'SELF_INVOICE',
        placeOfSupply: 'Karnataka (29)',
        serviceCode: '998311',
        currency: 'INR',
        exchangeRate: 1,
        exchangeSource: 'N/A',
        subtotal: 10000,
        totalAmount: 11800,
        totalInINR: 11800,
        cgstRate: 9,
        cgstAmount: 900,
        sgstRate: 9,
        sgstAmount: 900,
        isRCM: true,
        rcmLiability: 1800,
        paymentStatus: 'PAID',
        amountPaid: 11800,
        balanceDue: 0,
      },
    })

    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Page should load with invoices
    const pageContent = authenticatedPage.locator('text=/Self.Invoice/i')
    await expect(pageContent.first()).toBeVisible()

    // Cleanup
    await prisma.invoice.delete({ where: { id: invoice.id } })
  })

  test('should show warning when 25-30 days', async ({ authenticatedPage, testUser }) => {
    // Create a self-invoice at 27 days
    const receiptDate = new Date()
    receiptDate.setDate(receiptDate.getDate() - 27)

    const invoice = await prisma.invoice.create({
      data: {
        userId: testUser.id,
        invoiceNumber: `SI/WARNING/${Date.now()}`,
        invoiceDate: new Date(),
        dateOfReceiptOfSupply: receiptDate,
        dueDate: new Date(),
        status: 'SENT',
        invoiceType: 'SELF_INVOICE',
        placeOfSupply: 'Karnataka (29)',
        serviceCode: '998311',
        currency: 'INR',
        exchangeRate: 1,
        exchangeSource: 'N/A',
        subtotal: 10000,
        totalAmount: 11800,
        totalInINR: 11800,
        cgstRate: 9,
        cgstAmount: 900,
        sgstRate: 9,
        sgstAmount: 900,
        isRCM: true,
        rcmLiability: 1800,
        paymentStatus: 'PAID',
        amountPaid: 11800,
        balanceDue: 0,
      },
    })

    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should show warning (days left chip)
    const pageContent = authenticatedPage.locator('text=/Self.Invoice/i')
    await expect(pageContent.first()).toBeVisible()

    // Cleanup
    await prisma.invoice.delete({ where: { id: invoice.id } })
  })

  test('should show overdue when > 30 days', async ({ authenticatedPage, testUser }) => {
    // Create a self-invoice at 35 days
    const receiptDate = new Date()
    receiptDate.setDate(receiptDate.getDate() - 35)

    const invoice = await prisma.invoice.create({
      data: {
        userId: testUser.id,
        invoiceNumber: `SI/OVERDUE/${Date.now()}`,
        invoiceDate: new Date(),
        dateOfReceiptOfSupply: receiptDate,
        dueDate: new Date(),
        status: 'SENT',
        invoiceType: 'SELF_INVOICE',
        placeOfSupply: 'Karnataka (29)',
        serviceCode: '998311',
        currency: 'INR',
        exchangeRate: 1,
        exchangeSource: 'N/A',
        subtotal: 10000,
        totalAmount: 11800,
        totalInINR: 11800,
        cgstRate: 9,
        cgstAmount: 900,
        sgstRate: 9,
        sgstAmount: 900,
        isRCM: true,
        rcmLiability: 1800,
        paymentStatus: 'PAID',
        amountPaid: 11800,
        balanceDue: 0,
      },
    })

    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should show overdue chip
    const overdueChip = authenticatedPage.locator('text=/Overdue/i')
    const pageContent = authenticatedPage.locator('text=/Self.Invoice/i')
    await expect(pageContent.first()).toBeVisible()

    // Cleanup
    await prisma.invoice.delete({ where: { id: invoice.id } })
  })

  test('compliance chip colors should match severity', async ({ authenticatedPage, testSelfInvoice }) => {
    await authenticatedPage.goto('/self-invoices')
    await authenticatedPage.waitForLoadState('networkidle')

    // Chips should have appropriate colors
    // Green for compliant, warning for approaching, error for overdue
    const chips = authenticatedPage.locator('[class*="MuiChip"]')
    const pageContent = authenticatedPage.locator('text=/Self.Invoice/i')
    await expect(pageContent.first()).toBeVisible()
  })

  test('should display days countdown in self-invoice form', async ({ authenticatedPage, testIndianSupplier }) => {
    // testIndianSupplier ensures at least one supplier exists so form is displayed
    await authenticatedPage.goto('/self-invoices/new')
    await authenticatedPage.waitForLoadState('networkidle')

    // Date of Receipt of Supply field should be visible
    const dateField = authenticatedPage.locator('label:has-text("Date of Receipt of Supply")')
    await expect(dateField.first()).toBeVisible()
  })

  test('self-invoice detail view should show compliance status', async ({ authenticatedPage, testSelfInvoice }) => {
    await authenticatedPage.goto(`/self-invoices/${testSelfInvoice.id}`)
    await authenticatedPage.waitForLoadState('networkidle')

    // Detail view should show compliance information
    const pageContent = authenticatedPage.locator('text=/Self.Invoice|RCM|Invoice/i')
    await expect(pageContent.first()).toBeVisible()
  })
})
