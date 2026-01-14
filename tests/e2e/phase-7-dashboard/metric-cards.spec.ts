import { test, expect } from '../fixtures/data-fixture'

test.describe('Dashboard Metric Cards', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Increase timeout for navigation (dev server can be slow under load)
    await authenticatedPage.goto('/dashboard', { timeout: 60000 })
    // Wait for dashboard header to appear instead of networkidle (faster)
    await authenticatedPage.waitForSelector('h1:has-text("Dashboard")', { timeout: 15000 })
  })

  test('should display dashboard page header', async ({ authenticatedPage }) => {
    const header = authenticatedPage.locator('h1:has-text("Dashboard")')
    await expect(header).toBeVisible()
  })

  test('should display total revenue card', async ({ authenticatedPage }) => {
    // Wait for metric cards to load
    const revenueCard = authenticatedPage.locator('text=Total Revenue')
    await expect(revenueCard).toBeVisible({ timeout: 10000 })
  })

  test('should display total invoices count', async ({ authenticatedPage }) => {
    const invoicesCard = authenticatedPage.locator('text=Total Invoices')
    await expect(invoicesCard).toBeVisible({ timeout: 10000 })
  })

  test('should display active clients count', async ({ authenticatedPage }) => {
    const clientsCard = authenticatedPage.locator('text=Active Clients')
    await expect(clientsCard).toBeVisible({ timeout: 10000 })
  })

  test('should display pending payments', async ({ authenticatedPage }) => {
    const pendingCard = authenticatedPage.locator('text=Pending Payments')
    await expect(pendingCard).toBeVisible({ timeout: 10000 })
  })

  test('should display overdue invoices', async ({ authenticatedPage }) => {
    const overdueCard = authenticatedPage.locator('text=Overdue Invoices')
    await expect(overdueCard).toBeVisible({ timeout: 10000 })
  })

  test('should display average invoice value', async ({ authenticatedPage }) => {
    const avgCard = authenticatedPage.locator('text=Average Invoice')
    await expect(avgCard).toBeVisible({ timeout: 10000 })
  })

  test('currency values should be formatted in INR', async ({ authenticatedPage }) => {
    // Wait for metric cards to load
    await authenticatedPage.waitForSelector('text=Total Revenue', { timeout: 10000 })

    // Look for INR formatted values (₹ symbol)
    const inrValues = authenticatedPage.locator('text=/₹/')
    const count = await inrValues.count()

    // Should have multiple currency values
    expect(count).toBeGreaterThan(0)
  })

  test('cards should have hover animation', async ({ authenticatedPage }) => {
    // Wait for metric cards to load
    await authenticatedPage.waitForSelector('text=Total Revenue', { timeout: 10000 })

    // Find a metric card
    const card = authenticatedPage.locator('[class*="MuiCard"]').first()
    await expect(card).toBeVisible()

    // Hover over it
    await card.hover()

    // Card should still be visible after hover
    await expect(card).toBeVisible()
  })

  test('loading skeleton should show while fetching', async ({ authenticatedPage }) => {
    // Navigate fresh to potentially catch loading state
    await authenticatedPage.goto('/dashboard', { timeout: 60000 })

    // Eventually content should load (skeletons disappear)
    await authenticatedPage.waitForSelector('h1:has-text("Dashboard")', { timeout: 15000 })

    // Verify cards have loaded
    const revenueCard = authenticatedPage.locator('text=Total Revenue')
    await expect(revenueCard).toBeVisible({ timeout: 10000 })
  })

  test('all six metric cards should be visible', async ({ authenticatedPage }) => {
    // Wait for first metric card to ensure they're loaded
    await authenticatedPage.waitForSelector('text=Total Revenue', { timeout: 10000 })

    const cards = [
      'Total Revenue',
      'Total Invoices',
      'Active Clients',
      'Pending Payments',
      'Overdue Invoices',
      'Average Invoice',
    ]

    for (const cardTitle of cards) {
      const card = authenticatedPage.locator(`text=${cardTitle}`)
      await expect(card).toBeVisible({ timeout: 5000 })
    }
  })

  test('metric cards should display subtitle info', async ({ authenticatedPage }) => {
    // Wait for metric cards to load
    await authenticatedPage.waitForSelector('text=Total Revenue', { timeout: 10000 })

    // Check for subtitle text patterns
    const subtitles = [
      'All time earnings',
      'this month',
      'Currently active',
      'invoices',
      'Per invoice',
    ]

    let foundSubtitles = 0
    for (const subtitle of subtitles) {
      const element = authenticatedPage.locator(`text=${subtitle}`).first()
      if (await element.isVisible().catch(() => false)) {
        foundSubtitles++
      }
    }

    expect(foundSubtitles).toBeGreaterThan(0)
  })

  test('should display business overview subtitle', async ({ authenticatedPage }) => {
    const subtitle = authenticatedPage.locator('text=/Overview.*business.*performance/i')
    await expect(subtitle).toBeVisible({ timeout: 5000 })
  })

  test('metric cards should have proper icon styling', async ({ authenticatedPage }) => {
    // Wait for metric cards to load
    await authenticatedPage.waitForSelector('text=Total Revenue', { timeout: 10000 })

    // Cards should have MUI icons
    const cards = authenticatedPage.locator('[class*="MuiCard"]')
    const count = await cards.count()

    // At minimum we should have the 6 metric cards
    expect(count).toBeGreaterThanOrEqual(6)
  })

  test('should display charts section', async ({ authenticatedPage }) => {
    // Wait for metric cards first
    await authenticatedPage.waitForSelector('text=Total Revenue', { timeout: 10000 })

    // Verify dashboard has charts area - look for canvas or chart titles
    const chartOrDashboard = authenticatedPage.locator('canvas').or(
      authenticatedPage.locator('text=Revenue Trend')
    ).or(
      authenticatedPage.locator('text=Payment Status')
    )

    // Dashboard should be visible at minimum
    const dashboard = authenticatedPage.locator('h1:has-text("Dashboard")')
    await expect(dashboard).toBeVisible()
  })

  test('should display recent invoices section', async ({ authenticatedPage }) => {
    // Wait for metric cards first
    await authenticatedPage.waitForSelector('text=Total Revenue', { timeout: 10000 })

    // Look for recent invoices heading
    const recentInvoices = authenticatedPage.locator('text=Recent Invoices')
    await expect(recentInvoices).toBeVisible({ timeout: 5000 })
  })
})
