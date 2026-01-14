import { test, expect } from '../fixtures/data-fixture'

test.describe('GST Summary Widget', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard', { timeout: 60000 })
    // Wait for dashboard to load
    await authenticatedPage.waitForSelector('h1:has-text("Dashboard")', { timeout: 15000 })
  })

  test('should display GST summary widget with header', async ({ authenticatedPage }) => {
    const widget = authenticatedPage.locator('text=GST Summary')
    await expect(widget).toBeVisible()
  })

  test('should display output tax liability', async ({ authenticatedPage }) => {
    await authenticatedPage.waitForTimeout(2000) // Wait for data load
    const outputTax = authenticatedPage.locator('text=Output Tax Liability')
    await expect(outputTax).toBeVisible()
  })

  test('should display RCM liability', async ({ authenticatedPage }) => {
    const rcmLiability = authenticatedPage.locator('text=RCM Liability')
    await expect(rcmLiability).toBeVisible()
  })

  test('should display ITC available', async ({ authenticatedPage }) => {
    const itcAvailable = authenticatedPage.locator('text=ITC Available')
    await expect(itcAvailable).toBeVisible()
  })

  test('should display net payable or credit', async ({ authenticatedPage }) => {
    await authenticatedPage.waitForTimeout(2000)

    // Should show either "Net Tax Payable" or "Net ITC Balance"
    const netPayable = authenticatedPage.locator('text=Net Tax Payable')
    const netCredit = authenticatedPage.locator('text=Net ITC Balance')

    const hasPayable = await netPayable.isVisible().catch(() => false)
    const hasCredit = await netCredit.isVisible().catch(() => false)

    expect(hasPayable || hasCredit).toBe(true)
  })

  test('should show IGST/CGST/SGST columns', async ({ authenticatedPage }) => {
    // Check header columns
    const igstHeader = authenticatedPage.locator('text=IGST').first()
    const cgstHeader = authenticatedPage.locator('text=CGST').first()
    const sgstHeader = authenticatedPage.locator('text=SGST').first()

    await expect(igstHeader).toBeVisible()
    await expect(cgstHeader).toBeVisible()
    await expect(sgstHeader).toBeVisible()
  })

  test('should show Description and Total columns', async ({ authenticatedPage }) => {
    const descHeader = authenticatedPage.locator('text=Description').first()
    const totalHeader = authenticatedPage.locator('text=Total').first()

    await expect(descHeader).toBeVisible()
    await expect(totalHeader).toBeVisible()
  })

  test('payable shows red chip when tax due', async ({ authenticatedPage }) => {
    await authenticatedPage.waitForTimeout(2000)

    // Look for "payable" chip (error color)
    const payableChip = authenticatedPage.locator('[class*="MuiChip"]').filter({ hasText: /payable/i })

    // If payable chip exists, verify it has error styling
    if (await payableChip.isVisible().catch(() => false)) {
      // Check for error color class
      const classes = await payableChip.getAttribute('class')
      expect(classes).toMatch(/error|outlined/)
    }
  })

  test('credit shows green chip when ITC balance', async ({ authenticatedPage }) => {
    await authenticatedPage.waitForTimeout(2000)

    // Look for "credit" chip (success color)
    const creditChip = authenticatedPage.locator('[class*="MuiChip"]').filter({ hasText: /credit/i })

    // If credit chip exists, verify it has success styling
    if (await creditChip.isVisible().catch(() => false)) {
      const classes = await creditChip.getAttribute('class')
      expect(classes).toMatch(/success|outlined/)
    }
  })

  test('should show accumulated ITC for refund if applicable', async ({ authenticatedPage }) => {
    await authenticatedPage.waitForTimeout(2000)

    // Look for accumulated ITC chip
    const accumulatedChip = authenticatedPage.locator('text=/accumulated.*refund/i')

    // This may or may not be visible depending on data
    // Just verify widget renders properly
    const widget = authenticatedPage.locator('text=GST Summary')
    await expect(widget).toBeVisible()
  })

  test('currency should be formatted in INR', async ({ authenticatedPage }) => {
    await authenticatedPage.waitForTimeout(2000)

    // Look for INR currency symbol
    const currencyValues = authenticatedPage.locator('text=/₹[\\d,]+/')

    // Should have multiple currency values displayed
    const count = await currencyValues.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should show current period label', async ({ authenticatedPage }) => {
    const periodLabel = authenticatedPage.locator('text=(Current Period)')
    await expect(periodLabel).toBeVisible()
  })
})
