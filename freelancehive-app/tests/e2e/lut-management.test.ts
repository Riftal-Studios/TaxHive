import { test, expect } from '@playwright/test'
import { prisma } from '@/lib/prisma'

// Helper to create a test user with session
async function createTestUser() {
  // Create user
  const user = await prisma.user.create({
    data: {
      email: 'lut-test@example.com',
      name: 'LUT Test User',
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      address: 'Test Address',
      onboardingCompleted: true,
      onboardingStep: 'complete',
    },
  })

  // Create session
  await prisma.session.create({
    data: {
      sessionToken: 'lut-test-session-token',
      userId: user.id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  })

  return user
}

async function cleanup() {
  await prisma.lUT.deleteMany({
    where: {
      user: {
        email: 'lut-test@example.com',
      },
    },
  })
  await prisma.session.deleteMany({
    where: {
      user: {
        email: 'lut-test@example.com',
      },
    },
  })
  await prisma.user.deleteMany({
    where: {
      email: 'lut-test@example.com',
    },
  })
}

test.describe('LUT Management', () => {
  test.beforeEach(async ({ context }) => {
    await cleanup()
    await createTestUser()
    
    // Set auth cookie
    await context.addCookies([{
      name: 'authjs.session-token',
      value: 'lut-test-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }])
  })

  test.afterEach(async () => {
    await cleanup()
  })

  test('should display LUT management tab and empty state', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    
    // Check if LUT tab is active
    await expect(page.getByRole('button', { name: 'LUT Management' })).toHaveClass(/border-indigo-500/)
    
    // Check empty state
    await expect(page.getByText('No LUTs found. Add your first LUT to get started.')).toBeVisible()
    
    // Check Add LUT button
    await expect(page.getByRole('button', { name: 'Add LUT' })).toBeVisible()
  })

  test('should add a new LUT', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    
    // Click Add LUT button
    await page.getByRole('button', { name: 'Add LUT' }).click()
    
    // Fill form
    await page.getByLabel('LUT Number *').fill('AD290320241234567')
    await page.getByLabel('LUT Date *').fill('2024-03-29')
    await page.getByLabel('Valid From *').fill('2024-04-01')
    await page.getByLabel('Valid Till *').fill('2025-03-31')
    
    // Submit form
    await page.getByRole('button', { name: 'Add LUT' }).click()
    
    // Check if LUT is displayed in table
    await expect(page.getByText('AD290320241234567')).toBeVisible()
    await expect(page.getByText('29 Mar 2024')).toBeVisible()
    await expect(page.getByText('01 Apr 2024')).toBeVisible()
    await expect(page.getByText('31 Mar 2025')).toBeVisible()
    await expect(page.getByText('Active')).toBeVisible()
  })

  test('should validate LUT form inputs', async ({ page }) => {
    await page.goto('/settings?tab=lut')
    
    // Click Add LUT button
    await page.getByRole('button', { name: 'Add LUT' }).click()
    
    // Try to submit with invalid data
    await page.getByLabel('LUT Number *').fill('123') // Too short
    await page.getByLabel('LUT Date *').fill('2024-04-15') // After valid from
    await page.getByLabel('Valid From *').fill('2024-04-01')
    await page.getByLabel('Valid Till *').fill('2024-03-01') // Before valid from
    
    // Submit form
    await page.getByRole('button', { name: 'Add LUT' }).click()
    
    // Check validation errors
    await expect(page.getByText(/LUT number must be at least 10 characters/)).toBeVisible()
  })

  test('should edit an existing LUT', async ({ page }) => {
    // Create a LUT first
    const user = await prisma.user.findUnique({
      where: { email: 'lut-test@example.com' },
    })
    
    await prisma.lUT.create({
      data: {
        userId: user!.id,
        lutNumber: 'AD290320241234567',
        lutDate: new Date('2024-03-29'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
        isActive: true,
      },
    })
    
    await page.goto('/settings?tab=lut')
    
    // Click edit button
    await page.getByRole('button', { name: 'Edit' }).first().click()
    
    // Update LUT number
    await page.getByLabel('LUT Number *').fill('AD290320241234568')
    
    // Submit form
    await page.getByRole('button', { name: 'Update LUT' }).click()
    
    // Check if updated
    await expect(page.getByText('AD290320241234568')).toBeVisible()
  })

  test('should toggle LUT active status', async ({ page }) => {
    // Create a LUT first
    const user = await prisma.user.findUnique({
      where: { email: 'lut-test@example.com' },
    })
    
    await prisma.lUT.create({
      data: {
        userId: user!.id,
        lutNumber: 'AD290320241234567',
        lutDate: new Date('2024-03-29'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
        isActive: true,
      },
    })
    
    await page.goto('/settings?tab=lut')
    
    // Check initial status
    await expect(page.getByText('Active')).toBeVisible()
    
    // Click to toggle status
    await page.getByRole('button', { name: 'Click to deactivate' }).click()
    
    // Check if status changed
    await expect(page.getByText('Inactive')).toBeVisible()
  })

  test('should delete a LUT', async ({ page }) => {
    // Create a LUT first
    const user = await prisma.user.findUnique({
      where: { email: 'lut-test@example.com' },
    })
    
    await prisma.lUT.create({
      data: {
        userId: user!.id,
        lutNumber: 'AD290320241234567',
        lutDate: new Date('2024-03-29'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
        isActive: true,
      },
    })
    
    await page.goto('/settings?tab=lut')
    
    // Set up dialog handler
    page.on('dialog', dialog => dialog.accept())
    
    // Click delete button
    await page.getByRole('button', { name: 'Delete' }).first().click()
    
    // Check if LUT is removed
    await expect(page.getByText('No LUTs found. Add your first LUT to get started.')).toBeVisible()
  })

  test('should show expired status for expired LUTs', async ({ page }) => {
    // Create an expired LUT
    const user = await prisma.user.findUnique({
      where: { email: 'lut-test@example.com' },
    })
    
    await prisma.lUT.create({
      data: {
        userId: user!.id,
        lutNumber: 'AD290320231234567',
        lutDate: new Date('2023-03-29'),
        validFrom: new Date('2023-04-01'),
        validTill: new Date('2024-03-31'), // Past date
        isActive: false,
      },
    })
    
    await page.goto('/settings?tab=lut')
    
    // Check if expired status is shown
    await expect(page.getByText('31 Mar 2024 (Expired)')).toBeVisible()
  })

  test('should deactivate other LUTs when activating one', async ({ page }) => {
    // Create multiple LUTs
    const user = await prisma.user.findUnique({
      where: { email: 'lut-test@example.com' },
    })
    
    await prisma.lUT.create({
      data: {
        userId: user!.id,
        lutNumber: 'AD290320241234567',
        lutDate: new Date('2024-03-29'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
        isActive: true,
      },
    })
    
    await prisma.lUT.create({
      data: {
        userId: user!.id,
        lutNumber: 'AD290320241234568',
        lutDate: new Date('2024-03-29'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
        isActive: false,
      },
    })
    
    await page.goto('/settings?tab=lut')
    
    // Find the inactive LUT and activate it
    const inactiveLUT = page.locator('tr', { hasText: 'AD290320241234568' })
    await inactiveLUT.getByRole('button', { name: 'Click to activate' }).click()
    
    // Check that the first LUT is now inactive
    const firstLUT = page.locator('tr', { hasText: 'AD290320241234567' })
    await expect(firstLUT.getByText('Inactive')).toBeVisible()
    
    // Check that the second LUT is now active
    const secondLUT = page.locator('tr', { hasText: 'AD290320241234568' })
    await expect(secondLUT.getByText('Active')).toBeVisible()
  })
})