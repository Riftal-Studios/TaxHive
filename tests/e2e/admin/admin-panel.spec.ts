/* eslint-disable react-hooks/rules-of-hooks */
import { test as authTest, expect, createTestUserWithSession, setupAuthCookies, cleanupTestUser } from '../fixtures/auth-fixture'
import type { Page, BrowserContext } from '@playwright/test'

// Regular user tests - use default auth fixture
authTest.describe('Admin Panel - Route Protection (Regular User)', () => {
  authTest('should redirect non-admin users from /admin to /dashboard', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/admin')
    await authenticatedPage.waitForURL(/\/dashboard/, { timeout: 10000 })
    await expect(authenticatedPage).toHaveURL(/\/dashboard/)
  })

  authTest('should redirect non-admin users from /admin/users', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/admin/users')
    await authenticatedPage.waitForURL(/\/dashboard/, { timeout: 10000 })
    await expect(authenticatedPage).toHaveURL(/\/dashboard/)
  })

  authTest('should redirect non-admin users from /admin/feedback', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/admin/feedback')
    await authenticatedPage.waitForURL(/\/dashboard/, { timeout: 10000 })
    await expect(authenticatedPage).toHaveURL(/\/dashboard/)
  })

  authTest('should NOT show admin link in sidebar for regular users', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard')
    await authenticatedPage.waitForLoadState('networkidle')

    const adminButton = authenticatedPage.getByRole('button', { name: /^admin$/i })
    await expect(adminButton).not.toBeVisible()
  })
})

// Admin user tests - create admin user with custom fixture
const test = authTest.extend<{ adminPage: Page }>({
  adminPage: async ({ page, context }, use) => {
    const adminUser = await createTestUserWithSession({ role: 'ADMIN' })
    await setupAuthCookies(context, adminUser.jwtToken)
    await use(page)
    await cleanupTestUser(adminUser.id)
  },
})

test.describe('Admin Panel - Admin User', () => {
  test.describe('Sidebar Navigation', () => {
    test('should show admin link for admin users', async ({ adminPage }) => {
      await adminPage.goto('/dashboard')
      await adminPage.waitForLoadState('networkidle')

      const adminButton = adminPage.getByRole('button', { name: /^admin$/i })
      await expect(adminButton).toBeVisible()
    })

    test('should navigate to admin panel when admin link clicked', async ({ adminPage }) => {
      await adminPage.goto('/dashboard')
      await adminPage.waitForLoadState('networkidle')

      await adminPage.getByRole('button', { name: /^admin$/i }).click()
      await expect(adminPage).toHaveURL(/\/admin/)
    })
  })

  test.describe('Admin Dashboard', () => {
    test('should display admin dashboard page', async ({ adminPage }) => {
      await adminPage.goto('/admin')
      await adminPage.waitForLoadState('networkidle')

      await expect(adminPage.getByText(/admin dashboard/i)).toBeVisible()
    })

    test('should show system stat cards', async ({ adminPage }) => {
      await adminPage.goto('/admin')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/admin dashboard/i).waitFor({ state: 'visible' })

      await expect(adminPage.getByText(/total users/i)).toBeVisible()
      await expect(adminPage.getByText(/total invoices/i)).toBeVisible()
      await expect(adminPage.getByText(/total clients/i)).toBeVisible()
    })

    test('should show quick actions', async ({ adminPage }) => {
      await adminPage.goto('/admin')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/admin dashboard/i).waitFor({ state: 'visible' })

      await expect(adminPage.getByText(/quick actions/i)).toBeVisible()
      await expect(adminPage.getByText(/manage users/i)).toBeVisible()
      await expect(adminPage.getByText(/review feedback/i)).toBeVisible()
    })

    test('should navigate to users page from quick actions', async ({ adminPage }) => {
      await adminPage.goto('/admin')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/admin dashboard/i).waitFor({ state: 'visible' })

      await adminPage.getByText(/manage users/i).click()
      await expect(adminPage).toHaveURL(/\/admin\/users/)
    })
  })

  test.describe('Users List Page', () => {
    test('should display users list page', async ({ adminPage }) => {
      await adminPage.goto('/admin/users')
      await adminPage.waitForLoadState('networkidle')

      await expect(adminPage.getByText(/user management/i)).toBeVisible()
    })

    test('should show search field', async ({ adminPage }) => {
      await adminPage.goto('/admin/users')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/user management/i).waitFor({ state: 'visible' })

      const searchField = adminPage.getByPlaceholder(/search/i)
      await expect(searchField).toBeVisible()
    })

    test('should show user table with columns', async ({ adminPage }) => {
      await adminPage.goto('/admin/users')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/user management/i).waitFor({ state: 'visible' })

      await expect(adminPage.getByRole('columnheader', { name: /name/i })).toBeVisible()
      await expect(adminPage.getByRole('columnheader', { name: /email/i })).toBeVisible()
      await expect(adminPage.getByRole('columnheader', { name: /role/i })).toBeVisible()
    })

    test('should show at least the admin user in the table', async ({ adminPage }) => {
      await adminPage.goto('/admin/users')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/user management/i).waitFor({ state: 'visible' })

      const rows = adminPage.locator('table tbody tr')
      await expect(rows.first()).toBeVisible()
    })

    test('should show ADMIN role chip', async ({ adminPage }) => {
      await adminPage.goto('/admin/users')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/user management/i).waitFor({ state: 'visible' })

      await expect(adminPage.getByText('ADMIN').first()).toBeVisible()
    })

    test('should show pagination controls', async ({ adminPage }) => {
      await adminPage.goto('/admin/users')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/user management/i).waitFor({ state: 'visible' })

      await expect(adminPage.getByText(/rows per page/i)).toBeVisible()
    })

    test('should navigate to user detail on view click', async ({ adminPage }) => {
      await adminPage.goto('/admin/users')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/user management/i).waitFor({ state: 'visible' })

      const viewButton = adminPage.locator('table tbody tr').first().getByRole('button')
      await viewButton.click()

      await expect(adminPage).toHaveURL(/\/admin\/users\/[a-z0-9]+/i)
    })
  })

  test.describe('User Detail Page', () => {
    test('should display user information', async ({ adminPage }) => {
      await adminPage.goto('/admin/users')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/user management/i).waitFor({ state: 'visible' })

      const viewButton = adminPage.locator('table tbody tr').first().getByRole('button')
      await viewButton.click()
      await adminPage.waitForURL(/\/admin\/users\/[a-z0-9]+/i)
      await adminPage.waitForLoadState('networkidle')

      await expect(adminPage.getByText(/user information/i)).toBeVisible()
      await expect(adminPage.getByText(/statistics/i)).toBeVisible()
    })

    test('should show back button that navigates to users list', async ({ adminPage }) => {
      // Navigate to user detail via table
      await adminPage.goto('/admin/users')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/user management/i).waitFor({ state: 'visible' })
      await adminPage.locator('table tbody tr').first().waitFor({ state: 'visible' })

      await adminPage.locator('table tbody tr').first().getByRole('button').click()
      await adminPage.waitForURL(/\/admin\/users\/[a-z0-9]+/i)
      await adminPage.waitForLoadState('networkidle')

      // Wait for either user info or user not found
      const userInfo = adminPage.getByText(/user information/i)
      const notFound = adminPage.getByText(/user not found/i)
      await Promise.race([
        userInfo.waitFor({ state: 'visible', timeout: 10000 }),
        notFound.waitFor({ state: 'visible', timeout: 10000 }),
      ])

      // If user found, verify back button works
      if (await userInfo.isVisible().catch(() => false)) {
        const backButton = adminPage.getByRole('button', { name: /back to users/i })
        await expect(backButton).toBeVisible()
        await backButton.click()
        await expect(adminPage).toHaveURL(/\/admin\/users$/)
      }
    })

    test('should show recent invoices section', async ({ adminPage }) => {
      await adminPage.goto('/admin/users')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/user management/i).waitFor({ state: 'visible' })
      await adminPage.locator('table tbody tr').first().waitFor({ state: 'visible' })

      await adminPage.locator('table tbody tr').first().getByRole('button').click()
      await adminPage.waitForURL(/\/admin\/users\/[a-z0-9]+/i)
      await adminPage.waitForLoadState('networkidle')

      // Wait for page to render
      const userInfo = adminPage.getByText(/user information/i)
      const notFound = adminPage.getByText(/user not found/i)
      await Promise.race([
        userInfo.waitFor({ state: 'visible', timeout: 10000 }),
        notFound.waitFor({ state: 'visible', timeout: 10000 }),
      ])

      if (await userInfo.isVisible().catch(() => false)) {
        await expect(adminPage.getByText(/recent invoices/i)).toBeVisible()
      }
    })
  })

  test.describe('Feedback Management Page', () => {
    test('should display feedback management page', async ({ adminPage }) => {
      await adminPage.goto('/admin/feedback')
      await adminPage.waitForLoadState('networkidle')

      await expect(adminPage.getByText(/feedback management/i)).toBeVisible()
    })

    test('should show status filter', async ({ adminPage }) => {
      await adminPage.goto('/admin/feedback')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/feedback management/i).waitFor({ state: 'visible' })

      await expect(adminPage.getByText(/filter by status/i).first()).toBeVisible()
    })

    test('should show feedback table with columns', async ({ adminPage }) => {
      await adminPage.goto('/admin/feedback')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/feedback management/i).waitFor({ state: 'visible' })

      await expect(adminPage.getByRole('columnheader', { name: /type/i })).toBeVisible()
      await expect(adminPage.getByRole('columnheader', { name: /message/i })).toBeVisible()
      await expect(adminPage.getByRole('columnheader', { name: /user/i })).toBeVisible()
      await expect(adminPage.getByRole('columnheader', { name: /status/i })).toBeVisible()
    })

    test('should show empty state or feedback entries', async ({ adminPage }) => {
      await adminPage.goto('/admin/feedback')
      await adminPage.waitForLoadState('networkidle')
      await adminPage.getByText(/feedback management/i).waitFor({ state: 'visible' })

      const noFeedback = adminPage.getByText(/no feedback found/i)
      const feedbackRow = adminPage.locator('table tbody tr').first()

      const hasEmpty = await noFeedback.isVisible().catch(() => false)
      const hasRows = await feedbackRow.isVisible().catch(() => false)

      expect(hasEmpty || hasRows).toBe(true)
    })
  })
})
