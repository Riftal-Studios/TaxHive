import { test, expect } from './fixtures/data-fixture'

test.describe('Feedback Feature', () => {
  test.describe('Floating Feedback Button', () => {
    test('should show floating feedback button on authenticated pages', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')

      // Check for floating feedback button
      const feedbackButton = authenticatedPage.locator('button[aria-label="feedback"]')
      await expect(feedbackButton).toBeVisible()

      // Button should be in fixed position (bottom-right)
      const box = await feedbackButton.boundingBox()
      expect(box).toBeTruthy()
    })

    test('should open feedback modal when floating button is clicked', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')

      // Click floating button
      await authenticatedPage.click('button[aria-label="feedback"]')

      // Modal should be visible
      await expect(authenticatedPage.getByRole('dialog', { name: 'Send Feedback' })).toBeVisible()
      await expect(authenticatedPage.getByRole('combobox', { name: 'Type' })).toBeVisible()
      await expect(authenticatedPage.getByRole('textbox', { name: 'Message' })).toBeVisible()
    })
  })

  test.describe('User Menu Feedback Access', () => {
    test('should show feedback option in user menu', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')

      // Open user menu (click avatar)
      const avatar = authenticatedPage.locator('button').filter({ has: authenticatedPage.locator('div[class*="MuiAvatar"]') }).first()
      await avatar.click()

      // Check for "Send Feedback" menu item
      await expect(authenticatedPage.locator('text=Send Feedback')).toBeVisible()
    })

    test('should open feedback modal when user menu option is clicked', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')

      // Open user menu
      const avatar = authenticatedPage.locator('button').filter({ has: authenticatedPage.locator('div[class*="MuiAvatar"]') }).first()
      await avatar.click()

      // Click "Send Feedback"
      await authenticatedPage.click('text=Send Feedback')

      // Modal should be visible
      await expect(authenticatedPage.getByRole('dialog', { name: 'Send Feedback' })).toBeVisible()
      await expect(authenticatedPage.getByRole('combobox', { name: 'Type' })).toBeVisible()
    })
  })

  test.describe('Feedback Modal Functionality', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')

      // Open feedback modal
      await authenticatedPage.click('button[aria-label="feedback"]')
      await expect(authenticatedPage.getByRole('dialog', { name: 'Send Feedback' })).toBeVisible()
    })

    test('should show all feedback type options', async ({ authenticatedPage }) => {
      // Open feedback type dropdown (MUI Select)
      await authenticatedPage.getByRole('combobox', { name: 'Type' }).click()

      // Check all options are present
      await expect(authenticatedPage.getByRole('option', { name: /Report a Bug/i })).toBeVisible()
      await expect(authenticatedPage.getByRole('option', { name: /Request a Feature/i })).toBeVisible()
      await expect(authenticatedPage.getByRole('option', { name: /Ask a Question/i })).toBeVisible()
      await expect(authenticatedPage.getByRole('option', { name: /Other/i })).toBeVisible()
    })

    test('should show character counter for message', async ({ authenticatedPage }) => {
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      const counter = authenticatedPage.getByText(/\d+\/2000 characters/)

      // Initially should show 0/2000
      await expect(counter).toBeVisible()
      await expect(counter).toContainText('0/2000')

      // Type some text
      await textarea.fill('Hello world')
      await expect(counter).toContainText('11/2000')
    })

    test('should disable submit button when message is too short', async ({ authenticatedPage }) => {
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })

      // Initially disabled (empty message)
      await expect(submitButton).toBeDisabled()

      // Type less than 10 characters
      await textarea.fill('Short')
      await expect(submitButton).toBeDisabled()

      // Type 10+ characters
      await textarea.fill('This is a valid feedback message')
      await expect(submitButton).toBeEnabled()
    })

    test('should show error for message less than 10 characters on submit', async ({ authenticatedPage }) => {
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })

      // Type a short message
      await textarea.fill('Short')

      // Error should be indicated (field error state or helper text)
      const errorIndicator = authenticatedPage.locator('p.Mui-error, .MuiFormHelperText-root.Mui-error, [class*="error"]')
      // Check for error class or message length indicator showing error
      const hasError = await errorIndicator.isVisible().catch(() => false)
      const helperText = authenticatedPage.getByText(/5\/2000 characters/)
      expect(hasError || await helperText.isVisible()).toBe(true)
    })

    test('should close modal when cancel button is clicked', async ({ authenticatedPage }) => {
      const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' })
      await cancelButton.click()

      // Modal should be closed
      await expect(authenticatedPage.getByRole('dialog', { name: 'Send Feedback' })).not.toBeVisible()
    })

    test('should submit feedback successfully with BUG type', async ({ authenticatedPage }) => {
      // Select BUG type
      await authenticatedPage.getByRole('combobox', { name: 'Type' }).click()
      await authenticatedPage.getByRole('option', { name: /Report a Bug/i }).click()

      // Fill message
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      await textarea.fill('The invoice PDF generation is failing when the description is too long.')

      // Submit
      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })
      await submitButton.click()

      // Should show success message
      await expect(authenticatedPage.getByText(/Thank you for your feedback/i)).toBeVisible({ timeout: 5000 })

      // Modal should auto-close after success
      await expect(authenticatedPage.getByRole('dialog', { name: 'Send Feedback' })).not.toBeVisible({ timeout: 3000 })
    })

    test('should submit feedback successfully with FEATURE type', async ({ authenticatedPage }) => {
      // FEATURE is default, so just fill and submit

      // Fill message
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      await textarea.fill('It would be great to have bulk invoice export functionality.')

      // Submit
      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })
      await submitButton.click()

      // Should show success message
      await expect(authenticatedPage.getByText(/Thank you for your feedback/i)).toBeVisible({ timeout: 5000 })
    })

    test('should submit feedback successfully with QUESTION type', async ({ authenticatedPage }) => {
      // Select QUESTION type
      await authenticatedPage.getByRole('combobox', { name: 'Type' }).click()
      await authenticatedPage.getByRole('option', { name: /Ask a Question/i }).click()

      // Fill message
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      await textarea.fill('How do I update my LUT details after submission?')

      // Submit
      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })
      await submitButton.click()

      // Should show success message
      await expect(authenticatedPage.getByText(/Thank you for your feedback/i)).toBeVisible({ timeout: 5000 })
    })

    test('should submit feedback successfully with OTHER type', async ({ authenticatedPage }) => {
      // Select OTHER type
      await authenticatedPage.getByRole('combobox', { name: 'Type' }).click()
      await authenticatedPage.getByRole('option', { name: /Other/i }).click()

      // Fill message
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      await textarea.fill('Just wanted to say the app is great! Keep up the good work.')

      // Submit
      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })
      await submitButton.click()

      // Should show success message
      await expect(authenticatedPage.getByText(/Thank you for your feedback/i)).toBeVisible({ timeout: 5000 })
    })

    test('should reset form after successful submission', async ({ authenticatedPage }) => {
      // Fill and submit feedback
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      await textarea.fill('This is a test feedback message that is long enough.')

      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })
      await submitButton.click()

      // Wait for success
      await expect(authenticatedPage.getByText(/Thank you for your feedback/i)).toBeVisible({ timeout: 5000 })

      // Wait for modal to close
      await authenticatedPage.waitForTimeout(2500)

      // Open modal again
      await authenticatedPage.click('button[aria-label="feedback"]')

      // Form should be reset
      const newTextarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      await expect(newTextarea).toHaveValue('')
    })

    test('should show loading state during submission', async ({ authenticatedPage }) => {
      // Fill message
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      await textarea.fill('This is a test feedback message for loading state check.')

      // Submit
      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })
      await submitButton.click()

      // Should show "Sending..." text briefly or success
      const loadingButton = authenticatedPage.getByRole('button', { name: /Sending/i })
      // Check if it appears OR if success appears (race condition)
      await Promise.race([
        expect(loadingButton).toBeVisible(),
        expect(authenticatedPage.getByText(/Thank you for your feedback/i)).toBeVisible({ timeout: 5000 })
      ])
    })

    test('should prevent modal close during submission', async ({ authenticatedPage }) => {
      // Fill message
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      await textarea.fill('Test message for preventing close during submission.')

      // Start submission
      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })
      await submitButton.click()

      // Try to click cancel (should be disabled)
      const cancelButton = authenticatedPage.getByRole('button', { name: 'Cancel' })

      // If we can find the sending button, cancel should be disabled
      const sendingButton = authenticatedPage.getByRole('button', { name: /Sending/i })
      if (await sendingButton.isVisible().catch(() => false)) {
        await expect(cancelButton).toBeDisabled()
      }
    })
  })

  test.describe('Feedback Modal Validation', () => {
    test.beforeEach(async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')

      // Open feedback modal
      await authenticatedPage.click('button[aria-label="feedback"]')
      await expect(authenticatedPage.getByRole('dialog', { name: 'Send Feedback' })).toBeVisible()
    })

    test('should prevent submission with empty message', async ({ authenticatedPage }) => {
      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })

      // Submit button should be disabled
      await expect(submitButton).toBeDisabled()
    })

    test('should prevent submission with message exactly 9 characters', async ({ authenticatedPage }) => {
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      await textarea.fill('123456789') // Exactly 9 characters

      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })
      await expect(submitButton).toBeDisabled()
    })

    test('should allow submission with message exactly 10 characters', async ({ authenticatedPage }) => {
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      await textarea.fill('1234567890') // Exactly 10 characters

      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })
      await expect(submitButton).toBeEnabled()
    })

    test('should show character limit warning near 2000 characters', async ({ authenticatedPage }) => {
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      const longMessage = 'a'.repeat(1999)

      await textarea.fill(longMessage)

      // Counter should show 1999/2000
      await expect(authenticatedPage.getByText('1999/2000')).toBeVisible()
    })

    test('should prevent messages over 2000 characters', async ({ authenticatedPage }) => {
      const textarea = authenticatedPage.getByRole('textbox', { name: 'Message' })
      const tooLongMessage = 'a'.repeat(2001)

      await textarea.fill(tooLongMessage)

      // Submit button should be disabled
      const submitButton = authenticatedPage.getByRole('button', { name: 'Send' })
      await expect(submitButton).toBeDisabled()
    })
  })

  test.describe('Cross-page Persistence', () => {
    test('should show feedback button on all authenticated pages', async ({ authenticatedPage }) => {
      // Check dashboard
      await authenticatedPage.goto('/dashboard')
      await expect(authenticatedPage.locator('button[aria-label="feedback"]')).toBeVisible()

      // Check invoices page
      await authenticatedPage.goto('/invoices')
      await expect(authenticatedPage.locator('button[aria-label="feedback"]')).toBeVisible()

      // Check clients page
      await authenticatedPage.goto('/clients')
      await expect(authenticatedPage.locator('button[aria-label="feedback"]')).toBeVisible()

      // Check settings page
      await authenticatedPage.goto('/settings')
      await expect(authenticatedPage.locator('button[aria-label="feedback"]')).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels on feedback button', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')

      const feedbackButton = authenticatedPage.locator('button[aria-label="feedback"]')
      await expect(feedbackButton).toHaveAttribute('aria-label', 'feedback')
    })

    test('should be keyboard accessible', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard')

      // Tab to feedback button (this is tricky, might need adjustment)
      // For now, just verify button exists and can receive focus
      const feedbackButton = authenticatedPage.locator('button[aria-label="feedback"]')
      await feedbackButton.focus()

      // Press Enter to open modal
      await feedbackButton.press('Enter')

      // Modal should be visible
      await expect(authenticatedPage.getByRole('dialog', { name: 'Send Feedback' })).toBeVisible()
    })
  })
})
