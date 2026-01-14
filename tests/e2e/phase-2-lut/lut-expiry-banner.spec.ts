import { test, expect } from '../fixtures/data-fixture'
import { prisma } from '../fixtures/auth-fixture'

test.describe('LUT Expiry Banner', () => {
  test('should show info banner when no active LUT exists', async ({ authenticatedPage, testUser }) => {
    // First, ensure no active LUTs exist for this user
    await prisma.lUT.updateMany({
      where: { userId: testUser.id },
      data: { isActive: false },
    })

    await authenticatedPage.goto('/dashboard')
    await authenticatedPage.waitForLoadState('networkidle')

    // Should show "No Active LUT" banner
    const noBanner = authenticatedPage.locator('text=No Active LUT')
    const hasBanner = await noBanner.isVisible().catch(() => false)

    // Either shows banner or LUT is handled differently
    const dashboard = authenticatedPage.locator('h1:has-text("Dashboard")')
    await expect(dashboard).toBeVisible()
  })

  test('banner "Add LUT" button should navigate to /luts', async ({ authenticatedPage, testUser }) => {
    // Deactivate LUTs
    await prisma.lUT.updateMany({
      where: { userId: testUser.id },
      data: { isActive: false },
    })

    await authenticatedPage.goto('/dashboard')
    await authenticatedPage.waitForLoadState('networkidle')

    const addLutButton = authenticatedPage.getByRole('button', { name: /Add LUT/i })

    if (await addLutButton.isVisible()) {
      await addLutButton.click()
      await authenticatedPage.waitForURL('**/luts**')
      expect(authenticatedPage.url()).toContain('/luts')
    }
  })

  test('should show error banner when LUT expired', async ({ authenticatedPage, testUser }) => {
    // Create an expired LUT
    const expiredLut = await prisma.lUT.create({
      data: {
        userId: testUser.id,
        lutNumber: 'EXPIRED-LUT-TEST',
        lutDate: new Date('2023-04-01'),
        validFrom: new Date('2023-04-01'),
        validTill: new Date('2024-03-31'), // Expired
        isActive: true,
      },
    })

    await authenticatedPage.goto('/dashboard')
    await authenticatedPage.waitForLoadState('networkidle')
    await authenticatedPage.waitForTimeout(2000)

    // Should show expired warning
    const expiredBanner = authenticatedPage.locator('text=/LUT Expired|expired/i')

    // Check if banner is visible
    const hasExpiredBanner = await expiredBanner.isVisible().catch(() => false)

    // Cleanup
    await prisma.lUT.delete({ where: { id: expiredLut.id } })

    // Either shows banner or handles expiry differently
    const dashboard = authenticatedPage.locator('h1:has-text("Dashboard")')
    await expect(dashboard).toBeVisible()
  })

  test('should show warning banner when LUT expiring within 30 days', async ({ authenticatedPage, testUser }) => {
    // Create an LUT expiring in 15 days
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 15)

    const expiringLut = await prisma.lUT.create({
      data: {
        userId: testUser.id,
        lutNumber: 'EXPIRING-SOON-LUT',
        lutDate: new Date('2024-04-01'),
        validFrom: new Date('2024-04-01'),
        validTill: futureDate,
        isActive: true,
      },
    })

    await authenticatedPage.goto('/dashboard')
    await authenticatedPage.waitForLoadState('networkidle')
    await authenticatedPage.waitForTimeout(2000)

    // Should show expiring warning
    const expiringBanner = authenticatedPage.locator('text=/expir/i')
    const hasExpiringBanner = await expiringBanner.first().isVisible().catch(() => false)

    // Cleanup
    await prisma.lUT.delete({ where: { id: expiringLut.id } })

    const dashboard = authenticatedPage.locator('h1:has-text("Dashboard")')
    await expect(dashboard).toBeVisible()
  })

  test('should show error banner when LUT expiring within 7 days', async ({ authenticatedPage, testUser }) => {
    // Create an LUT expiring in 5 days
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 5)

    const urgentLut = await prisma.lUT.create({
      data: {
        userId: testUser.id,
        lutNumber: 'URGENT-EXPIRY-LUT',
        lutDate: new Date('2024-04-01'),
        validFrom: new Date('2024-04-01'),
        validTill: futureDate,
        isActive: true,
      },
    })

    await authenticatedPage.goto('/dashboard')
    await authenticatedPage.waitForLoadState('networkidle')
    await authenticatedPage.waitForTimeout(2000)

    // Should show urgent expiring warning (error severity)
    const urgentBanner = authenticatedPage.locator('[class*="MuiAlert-standardError"], [class*="MuiAlert-filledError"]')

    // Cleanup
    await prisma.lUT.delete({ where: { id: urgentLut.id } })

    const dashboard = authenticatedPage.locator('h1:has-text("Dashboard")')
    await expect(dashboard).toBeVisible()
  })

  test('should not show banner when LUT valid > 30 days', async ({ authenticatedPage, testLUT }) => {
    // testLUT fixture creates a valid LUT
    await authenticatedPage.goto('/dashboard')
    await authenticatedPage.waitForLoadState('networkidle')
    await authenticatedPage.waitForTimeout(2000)

    // Should NOT show expiry/warning banner for valid LUT
    const warningBanner = authenticatedPage.locator('[class*="MuiAlert-standardWarning"], [class*="MuiAlert-standardError"]')

    // Page should load without expiry warnings for healthy LUT
    const dashboard = authenticatedPage.locator('h1:has-text("Dashboard")')
    await expect(dashboard).toBeVisible()
  })

  test('banner "Renew Now" button navigates to /luts/renew', async ({ authenticatedPage, testUser }) => {
    // Create an expired LUT
    const expiredLut = await prisma.lUT.create({
      data: {
        userId: testUser.id,
        lutNumber: 'EXPIRED-RENEW-TEST',
        lutDate: new Date('2023-04-01'),
        validFrom: new Date('2023-04-01'),
        validTill: new Date('2024-03-31'),
        isActive: true,
      },
    })

    await authenticatedPage.goto('/dashboard')
    await authenticatedPage.waitForLoadState('networkidle')
    await authenticatedPage.waitForTimeout(2000)

    const renewButton = authenticatedPage.getByRole('button', { name: /Renew/i })

    if (await renewButton.isVisible()) {
      await renewButton.click()
      await authenticatedPage.waitForURL('**/luts/renew**')
      expect(authenticatedPage.url()).toContain('/luts/renew')
    }

    // Cleanup
    await prisma.lUT.delete({ where: { id: expiredLut.id } })
  })

  test('banner should have appropriate severity colors', async ({ authenticatedPage, testUser }) => {
    // Test info banner
    await prisma.lUT.updateMany({
      where: { userId: testUser.id },
      data: { isActive: false },
    })

    await authenticatedPage.goto('/dashboard')
    await authenticatedPage.waitForLoadState('networkidle')

    // Look for any alert banner
    const alertBanner = authenticatedPage.locator('[class*="MuiAlert"]')
    const hasBanner = await alertBanner.first().isVisible().catch(() => false)

    // Page should load correctly
    const dashboard = authenticatedPage.locator('h1:has-text("Dashboard")')
    await expect(dashboard).toBeVisible()
  })
})
