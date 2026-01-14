import { test, expect } from '@playwright/test'

// These tests are skipped in favor of more robust tests in phase-2-lut/
// The phase-2 tests use proper fixtures with data-fixture.ts
// LUT management is now at /luts, not /settings?tab=lut
test.describe.skip('LUT Management (deprecated)', () => {
  test('should display LUT management tab and empty state', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    await expect(page.getByRole('button', { name: 'LUT Management' })).toHaveClass(/border-indigo-500/)
    await expect(page.getByText('No LUTs found. Add your first LUT to get started.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add LUT' })).toBeVisible()
  })

  test('should add a new LUT', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    await page.getByRole('button', { name: 'Add LUT' }).click()
    await page.getByLabel('LUT Number *').fill('AD290320241234567')
    await page.getByLabel('LUT Date *').fill('2024-03-29')
    await page.getByLabel('Valid From *').fill('2024-04-01')
    await page.getByLabel('Valid Till *').fill('2025-03-31')
    await page.getByRole('button', { name: 'Add LUT' }).click()
    await expect(page.getByText('AD290320241234567')).toBeVisible()
  })

  test('should validate LUT form inputs', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    await page.getByRole('button', { name: 'Add LUT' }).click()
    await page.getByLabel('LUT Number *').fill('123')
    await page.getByRole('button', { name: 'Add LUT' }).click()
    await expect(page.getByText(/LUT number must be at least 10 characters/)).toBeVisible()
  })

  test('should edit an existing LUT', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    await page.getByRole('button', { name: 'Edit' }).first().click()
    await page.getByLabel('LUT Number *').fill('AD290320241234568')
    await page.getByRole('button', { name: 'Update LUT' }).click()
    await expect(page.getByText('AD290320241234568')).toBeVisible()
  })

  test('should toggle LUT active status', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    await expect(page.getByText('Active')).toBeVisible()
    await page.getByRole('button', { name: 'Click to deactivate' }).click()
    await expect(page.getByText('Inactive')).toBeVisible()
  })

  test('should delete a LUT', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    page.on('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByText('No LUTs found. Add your first LUT to get started.')).toBeVisible()
  })

  test('should show expired status for expired LUTs', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    await expect(page.getByText('31 Mar 2024 (Expired)')).toBeVisible()
  })

  test('should deactivate other LUTs when activating one', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    const inactiveLUT = page.locator('tr', { hasText: 'AD290320241234568' })
    await inactiveLUT.getByRole('button', { name: 'Click to activate' }).click()
    const firstLUT = page.locator('tr', { hasText: 'AD290320241234567' })
    await expect(firstLUT.getByText('Inactive')).toBeVisible()
    const secondLUT = page.locator('tr', { hasText: 'AD290320241234568' })
    await expect(secondLUT.getByText('Active')).toBeVisible()
  })
})
