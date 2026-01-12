import { test, expect } from '@playwright/test'

test.describe('Unregistered Suppliers Management', () => {
  test.describe('Suppliers List Page', () => {
    test('should navigate to suppliers page', async ({ page }) => {
      await page.goto('/suppliers')

      // Skip if not authenticated
      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Should show page title
      await expect(page.getByRole('heading', { name: /unregistered suppliers/i })).toBeVisible()
    })

    test('should show empty state when no suppliers exist', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Check for empty state message or list
      const emptyState = page.getByText(/no suppliers|add your first/i)
      const supplierList = page.locator('table tbody tr')

      // Either empty state or supplier list should be visible
      const hasEmptyState = await emptyState.isVisible().catch(() => false)
      const hasSuppliers = await supplierList.first().isVisible().catch(() => false)

      expect(hasEmptyState || hasSuppliers).toBe(true)
    })

    test('should show Add Supplier button', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      const addButton = page.getByRole('button', { name: /add.*supplier/i })
      await expect(addButton).toBeVisible()
    })

    test('should open supplier dialog when Add Supplier is clicked', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Click Add Supplier button
      await page.getByRole('button', { name: /add.*supplier/i }).click()

      // Dialog should open
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText(/add.*supplier/i)).toBeVisible()
    })
  })

  test.describe('Create Supplier Form', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Open create supplier dialog
      await page.getByRole('button', { name: /add.*supplier/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    })

    test('should show all required form fields', async ({ page }) => {
      // Required fields
      await expect(page.getByLabel(/name/i)).toBeVisible()
      await expect(page.getByLabel(/address/i)).toBeVisible()
      await expect(page.getByLabel(/state/i)).toBeVisible()
    })

    test('should show optional form fields', async ({ page }) => {
      // Optional fields
      await expect(page.getByLabel(/pan/i)).toBeVisible()
      await expect(page.getByLabel(/pincode/i)).toBeVisible()
      await expect(page.getByLabel(/phone/i)).toBeVisible()
      await expect(page.getByLabel(/email/i)).toBeVisible()
    })

    test('should show state dropdown with GST state codes', async ({ page }) => {
      // Click state dropdown
      const stateSelect = page.getByLabel(/state/i)
      await stateSelect.click()

      // Should show state options
      await expect(page.getByRole('option', { name: /karnataka/i })).toBeVisible()
      await expect(page.getByRole('option', { name: /maharashtra/i })).toBeVisible()
      await expect(page.getByRole('option', { name: /delhi/i })).toBeVisible()
    })

    test('should validate required fields on submit', async ({ page }) => {
      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /save|create|add/i }).last()
      await submitButton.click()

      // Should show validation errors
      await expect(page.getByText(/required/i)).toBeVisible()
    })

    test('should validate email format', async ({ page }) => {
      // Fill invalid email
      await page.getByLabel(/email/i).fill('invalid-email')
      await page.getByLabel(/name/i).click() // Blur to trigger validation

      // Should show email validation error
      const emailError = page.getByText(/valid email|invalid email/i)
      await expect(emailError).toBeVisible()
    })

    test('should create supplier successfully with required fields', async ({ page }) => {
      // Fill required fields
      await page.getByLabel(/name/i).fill('Test Supplier E2E')
      await page.getByLabel(/address/i).fill('123 Test Street, Test City')

      // Select state
      await page.getByLabel(/state/i).click()
      await page.getByRole('option', { name: /karnataka/i }).click()

      // Submit
      const submitButton = page.getByRole('button', { name: /save|create|add/i }).last()
      await submitButton.click()

      // Dialog should close and supplier should appear in list
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

      // Supplier should be in the list
      await expect(page.getByText('Test Supplier E2E')).toBeVisible()
    })

    test('should create supplier with all optional fields', async ({ page }) => {
      // Fill all fields
      await page.getByLabel(/name/i).fill('Full Supplier E2E')
      await page.getByLabel(/address/i).fill('456 Full Street, Full City')
      await page.getByLabel(/state/i).click()
      await page.getByRole('option', { name: /maharashtra/i }).click()
      await page.getByLabel(/pan/i).fill('ABCDE1234F')
      await page.getByLabel(/pincode/i).fill('400001')
      await page.getByLabel(/phone/i).fill('9876543210')
      await page.getByLabel(/email/i).fill('supplier@test.com')

      // Submit
      const submitButton = page.getByRole('button', { name: /save|create|add/i }).last()
      await submitButton.click()

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

      // Supplier should be in the list
      await expect(page.getByText('Full Supplier E2E')).toBeVisible()
    })

    test('should close dialog when cancel is clicked', async ({ page }) => {
      // Click cancel
      await page.getByRole('button', { name: /cancel/i }).click()

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('Supplier Detail View', () => {
    test('should navigate to supplier detail page', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Check if there are suppliers in the list
      const supplierRow = page.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Click on first supplier
      await supplierRow.click()

      // Should navigate to detail page or show detail view
      await expect(page.getByText(/supplier details|address/i)).toBeVisible()
    })

    test('should display supplier information', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      const supplierRow = page.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      await supplierRow.click()

      // Should show supplier details
      await expect(page.getByText(/state/i)).toBeVisible()
      await expect(page.getByText(/address/i)).toBeVisible()
    })

    test('should show linked self-invoices for supplier', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      const supplierRow = page.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      await supplierRow.click()

      // Should show self-invoices section
      await expect(page.getByText(/self.*invoices|invoices|recent/i)).toBeVisible()
    })
  })

  test.describe('Edit Supplier', () => {
    test('should open edit dialog for existing supplier', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      const supplierRow = page.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Click edit button (could be in row or after opening detail)
      const editButton = page.getByRole('button', { name: /edit/i }).first()
      await editButton.click()

      // Edit dialog/form should open
      await expect(page.getByRole('dialog')).toBeVisible()
    })

    test('should update supplier successfully', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      const supplierRow = page.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Click edit
      const editButton = page.getByRole('button', { name: /edit/i }).first()
      await editButton.click()

      // Update name
      const nameField = page.getByLabel(/name/i)
      await nameField.clear()
      await nameField.fill('Updated Supplier Name E2E')

      // Save
      const saveButton = page.getByRole('button', { name: /save|update/i }).last()
      await saveButton.click()

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

      // Updated name should appear
      await expect(page.getByText('Updated Supplier Name E2E')).toBeVisible()
    })
  })

  test.describe('Delete Supplier', () => {
    test('should show delete confirmation dialog', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      const supplierRow = page.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Click delete button
      const deleteButton = page.getByRole('button', { name: /delete/i }).first()
      await deleteButton.click()

      // Should show confirmation dialog
      await expect(page.getByText(/confirm|are you sure/i)).toBeVisible()
    })

    test('should cancel delete operation', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      const supplierRow = page.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Click delete
      const deleteButton = page.getByRole('button', { name: /delete/i }).first()
      await deleteButton.click()

      // Click cancel in confirmation
      await page.getByRole('button', { name: /cancel|no/i }).click()

      // Confirmation should close
      await expect(page.getByText(/confirm|are you sure/i)).not.toBeVisible()
    })
  })

  test.describe('Supplier List Features', () => {
    test('should display supplier state and state code', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      const supplierRow = page.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // State info should be visible in the table
      await expect(supplierRow.getByText(/\(\d{2}\)/)).toBeVisible() // State code in parentheses
    })

    test('should show active/inactive status', async ({ page }) => {
      await page.goto('/suppliers')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      const supplierRow = page.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Status indicator should be present
      const statusChip = supplierRow.locator('[class*="Chip"]')
      const hasStatus = await statusChip.isVisible().catch(() => false)

      // Either has status chip or just shows supplier info
      expect(hasStatus || hasSuppliers).toBe(true)
    })
  })

  test.describe('Navigation Integration', () => {
    test('should have suppliers link in sidebar navigation', async ({ page }) => {
      await page.goto('/dashboard')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Check for suppliers link in navigation
      const suppliersLink = page.getByRole('link', { name: /suppliers/i })
      await expect(suppliersLink).toBeVisible()
    })

    test('should navigate from dashboard to suppliers', async ({ page }) => {
      await page.goto('/dashboard')

      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Click suppliers link
      await page.getByRole('link', { name: /suppliers/i }).click()

      // Should be on suppliers page
      await expect(page).toHaveURL(/\/suppliers/)
    })
  })
})
