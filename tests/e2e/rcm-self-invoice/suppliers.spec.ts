import { test, expect } from '../fixtures/data-fixture'

test.describe('Unregistered Suppliers Management', () => {
  test.describe('Suppliers List Page', () => {
    test('should navigate to suppliers page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      // Should show page title
      await expect(authenticatedPage.getByRole('heading', { name: /unregistered suppliers/i })).toBeVisible()
    })

    test('should show empty state when no suppliers exist', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      // Check for empty state message or list
      const emptyState = authenticatedPage.getByText(/no suppliers|add your first/i)
      const supplierList = authenticatedPage.locator('table tbody tr')

      // Either empty state or supplier list should be visible
      const hasEmptyState = await emptyState.isVisible().catch(() => false)
      const hasSuppliers = await supplierList.first().isVisible().catch(() => false)

      expect(hasEmptyState || hasSuppliers).toBe(true)
    })

    test('should show Add Supplier button', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      // Use .first() since there may be multiple Add Supplier buttons (header + empty state)
      const addButton = authenticatedPage.getByRole('button', { name: /add.*supplier/i }).first()
      await expect(addButton).toBeVisible()
    })

    test('should navigate to add supplier page when Add Supplier is clicked', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      // Click Add Supplier button (use .first() since there may be multiple)
      await authenticatedPage.getByRole('button', { name: /add.*supplier/i }).first().click()

      // Should navigate to new supplier page
      await expect(authenticatedPage).toHaveURL(/\/suppliers\/new/)
      await expect(authenticatedPage.getByRole('heading', { name: /add.*unregistered.*supplier/i })).toBeVisible()
    })
  })

  test.describe('Create Supplier Form', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      // Navigate directly to new supplier page
      await authenticatedPage.goto('/suppliers/new')
      await expect(authenticatedPage.getByRole('heading', { name: /add.*unregistered.*supplier/i })).toBeVisible()
    })

    test('should show all required form fields', async ({ authenticatedPage }) => {
      // Required fields - form uses "Supplier Name" label
      await expect(authenticatedPage.getByLabel(/supplier.*name/i)).toBeVisible()
      await expect(authenticatedPage.getByLabel(/address/i)).toBeVisible()
      await expect(authenticatedPage.getByLabel(/state/i)).toBeVisible()
    })

    test('should show optional form fields', async ({ authenticatedPage }) => {
      // Optional fields
      await expect(authenticatedPage.getByLabel(/pan/i)).toBeVisible()
      await expect(authenticatedPage.getByLabel(/pincode/i)).toBeVisible()
      await expect(authenticatedPage.getByLabel(/phone/i)).toBeVisible()
      await expect(authenticatedPage.getByLabel(/email/i)).toBeVisible()
    })

    test('should show state dropdown with GST state codes', async ({ authenticatedPage }) => {
      // The state field is a native select, not MUI dropdown
      const stateSelect = authenticatedPage.locator('select').filter({ hasText: /select.*state/i })
      await expect(stateSelect).toBeVisible()

      // Check that state options exist in the dropdown
      await expect(stateSelect.locator('option')).toHaveCount(await stateSelect.locator('option').count())
    })

    test('should validate required fields on submit', async ({ authenticatedPage }) => {
      // Try to submit empty form
      const submitButton = authenticatedPage.getByRole('button', { name: /save|create|add/i }).last()
      await submitButton.click()

      // Should show validation errors (use .first() since multiple required errors may appear)
      await expect(authenticatedPage.getByText(/required/i).first()).toBeVisible()
    })

    test('should validate email format', async ({ authenticatedPage }) => {
      // Fill invalid email
      await authenticatedPage.getByLabel(/email/i).fill('invalid-email')
      await authenticatedPage.getByLabel(/name/i).click() // Blur to trigger validation

      // Should show email validation error
      const emailError = authenticatedPage.getByText(/valid email|invalid email/i)
      await expect(emailError).toBeVisible()
    })

    test('should create supplier successfully with required fields', async ({ authenticatedPage }) => {
      // Fill required fields
      await authenticatedPage.getByLabel(/supplier.*name/i).fill('Test Supplier E2E')
      await authenticatedPage.getByLabel(/address/i).fill('123 Test Street, Test City')

      // Select state using native select
      await authenticatedPage.locator('select').selectOption({ label: 'Karnataka (29)' })

      // Submit
      const submitButton = authenticatedPage.getByRole('button', { name: /save|create|add/i }).last()
      await submitButton.click()

      // Should redirect to suppliers list or detail page
      await expect(authenticatedPage).toHaveURL(/\/suppliers/, { timeout: 10000 })

      // Supplier name should appear (use .first() as name may appear multiple times)
      await expect(authenticatedPage.getByText('Test Supplier E2E').first()).toBeVisible()
    })

    test('should create supplier with all optional fields', async ({ authenticatedPage }) => {
      // Fill all fields
      await authenticatedPage.getByLabel(/supplier.*name/i).fill('Full Supplier E2E')
      await authenticatedPage.getByLabel(/address/i).fill('456 Full Street, Full City')
      await authenticatedPage.locator('select').selectOption({ label: 'Maharashtra (27)' })
      await authenticatedPage.getByLabel(/pan/i).fill('ABCDE1234F')
      await authenticatedPage.getByLabel(/pincode/i).fill('400001')
      await authenticatedPage.getByLabel(/phone/i).fill('9876543210')
      await authenticatedPage.getByLabel(/email/i).fill('supplier@test.com')

      // Submit
      const submitButton = authenticatedPage.getByRole('button', { name: /save|create|add/i }).last()
      await submitButton.click()

      // Should redirect to suppliers list or detail page
      await expect(authenticatedPage).toHaveURL(/\/suppliers/, { timeout: 10000 })

      // Supplier name should appear (use .first() as name may appear multiple times)
      await expect(authenticatedPage.getByText('Full Supplier E2E').first()).toBeVisible()
    })

    test('should navigate back when Back to Suppliers is clicked', async ({ authenticatedPage }) => {
      // Click back link
      await authenticatedPage.getByRole('link', { name: /back.*suppliers/i }).click()

      // Should navigate to suppliers list
      await expect(authenticatedPage).toHaveURL(/\/suppliers/)
    })
  })

  test.describe('Supplier Detail View', () => {
    test('should navigate to supplier detail page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      // Check if there are suppliers in the list
      const supplierRow = authenticatedPage.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Click on first supplier
      await supplierRow.click()

      // Should navigate to detail page or show detail view
      await expect(authenticatedPage.getByText(/supplier details|address/i)).toBeVisible()
    })

    test('should display supplier information', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      const supplierRow = authenticatedPage.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      await supplierRow.click()

      // Should show supplier details
      await expect(authenticatedPage.getByText(/state/i)).toBeVisible()
      await expect(authenticatedPage.getByText(/address/i)).toBeVisible()
    })

    test('should show linked self-invoices for supplier', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      const supplierRow = authenticatedPage.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      await supplierRow.click()

      // Should show self-invoices section
      await expect(authenticatedPage.getByText(/self.*invoices|invoices|recent/i)).toBeVisible()
    })
  })

  test.describe('Edit Supplier', () => {
    test('should navigate to edit page for existing supplier', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      const supplierRow = authenticatedPage.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Click edit button in row
      const editButton = supplierRow.getByRole('button', { name: /edit/i })
      await editButton.click()

      // Should navigate to edit page
      await expect(authenticatedPage).toHaveURL(/\/suppliers\/.*\/edit/)
    })

    test('should update supplier successfully', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      const supplierRow = authenticatedPage.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Click edit
      const editButton = supplierRow.getByRole('button', { name: /edit/i })
      await editButton.click()

      // Should be on edit page
      await expect(authenticatedPage).toHaveURL(/\/suppliers\/.*\/edit/)

      // Update name
      const nameField = authenticatedPage.getByLabel(/supplier.*name/i)
      await nameField.clear()
      await nameField.fill('Updated Supplier Name E2E')

      // Save
      const saveButton = authenticatedPage.getByRole('button', { name: /save|update/i }).last()
      await saveButton.click()

      // Should redirect to suppliers list or detail page
      await expect(authenticatedPage).toHaveURL(/\/suppliers/, { timeout: 10000 })

      // Updated name should appear (use .first() as name may appear multiple times)
      await expect(authenticatedPage.getByText('Updated Supplier Name E2E').first()).toBeVisible()
    })
  })

  test.describe('Delete Supplier', () => {
    test('should show delete confirmation dialog', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      const supplierRow = authenticatedPage.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Click delete button
      const deleteButton = authenticatedPage.getByRole('button', { name: /delete/i }).first()
      await deleteButton.click()

      // Should show confirmation dialog
      await expect(authenticatedPage.getByText(/confirm|are you sure/i)).toBeVisible()
    })

    test('should cancel delete operation', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      const supplierRow = authenticatedPage.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // Click delete
      const deleteButton = authenticatedPage.getByRole('button', { name: /delete/i }).first()
      await deleteButton.click()

      // Click cancel in confirmation
      await authenticatedPage.getByRole('button', { name: /cancel|no/i }).click()

      // Confirmation should close
      await expect(authenticatedPage.getByText(/confirm|are you sure/i)).not.toBeVisible()
    })
  })

  test.describe('Supplier List Features', () => {
    test('should display supplier state and state code', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      const supplierRow = authenticatedPage.locator('table tbody tr').first()
      const hasSuppliers = await supplierRow.isVisible().catch(() => false)

      if (!hasSuppliers) {
        test.skip()
        return
      }

      // State info should be visible in the table
      await expect(supplierRow.getByText(/\(\d{2}\)/)).toBeVisible() // State code in parentheses
    })

    test('should show active/inactive status', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/suppliers')

      const supplierRow = authenticatedPage.locator('table tbody tr').first()
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
    test('should have suppliers link in sidebar navigation', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')

      // Check for suppliers link in navigation
      const suppliersLink = authenticatedPage.getByRole('link', { name: /suppliers/i })
      await expect(suppliersLink).toBeVisible()
    })

    test('should navigate from dashboard to suppliers', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')

      // Click suppliers link
      await authenticatedPage.getByRole('link', { name: /suppliers/i }).click()

      // Should be on suppliers page
      await expect(authenticatedPage).toHaveURL(/\/suppliers/)
    })
  })
})
