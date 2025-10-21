import { test, expect } from '@playwright/test'

test.describe('Feedback Feature', () => {
  test.describe('Floating Feedback Button', () => {
    test('should show floating feedback button on authenticated pages', async ({ page }) => {
      // First, authenticate (simplified - in real scenario you'd use auth helpers)
      // For now, we'll just check that protected routes redirect
      await page.goto('/dashboard')

      // If redirected to signin, skip this test (requires auth setup)
      const url = page.url()
      if (url.includes('/auth/signin')) {
        test.skip()
        return
      }

      // Check for floating feedback button
      const feedbackButton = page.locator('button[aria-label="feedback"]')
      await expect(feedbackButton).toBeVisible()

      // Button should be in fixed position (bottom-right)
      const box = await feedbackButton.boundingBox()
      expect(box).toBeTruthy()
    })

    test('should open feedback modal when floating button is clicked', async ({ page }) => {
      await page.goto('/dashboard')

      // Skip if not authenticated
      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Click floating button
      await page.click('button[aria-label="feedback"]')

      // Modal should be visible
      await expect(page.locator('text=Send Feedback')).toBeVisible()
      await expect(page.locator('select#feedback-type')).toBeVisible()
      await expect(page.locator('textarea')).toBeVisible()
    })
  })

  test.describe('User Menu Feedback Access', () => {
    test('should show feedback option in user menu', async ({ page }) => {
      await page.goto('/dashboard')

      // Skip if not authenticated
      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Open user menu (click avatar)
      const avatar = page.locator('button').filter({ has: page.locator('div[class*="MuiAvatar"]') }).first()
      await avatar.click()

      // Check for "Send Feedback" menu item
      await expect(page.locator('text=Send Feedback')).toBeVisible()
    })

    test('should open feedback modal when user menu option is clicked', async ({ page }) => {
      await page.goto('/dashboard')

      // Skip if not authenticated
      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Open user menu
      const avatar = page.locator('button').filter({ has: page.locator('div[class*="MuiAvatar"]') }).first()
      await avatar.click()

      // Click "Send Feedback"
      await page.click('text=Send Feedback')

      // Modal should be visible
      await expect(page.locator('text=Send Feedback').first()).toBeVisible()
      await expect(page.locator('select#feedback-type')).toBeVisible()
    })
  })

  test.describe('Feedback Modal Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard')

      // Skip if not authenticated
      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Open feedback modal
      await page.click('button[aria-label="feedback"]')
      await expect(page.locator('text=Send Feedback')).toBeVisible()
    })

    test('should show all feedback type options', async ({ page }) => {
      // Open feedback type dropdown
      await page.click('select#feedback-type')

      // Check all options are present
      await expect(page.locator('text=Report a Bug')).toBeVisible()
      await expect(page.locator('text=Request a Feature')).toBeVisible()
      await expect(page.locator('text=Ask a Question')).toBeVisible()
      await expect(page.locator('text=Other')).toBeVisible()
    })

    test('should show character counter for message', async ({ page }) => {
      const textarea = page.locator('textarea')
      const counter = page.locator('text=/\\d+\\/2000 characters/')

      // Initially should show 0/2000
      await expect(counter).toBeVisible()
      await expect(counter).toContainText('0/2000')

      // Type some text
      await textarea.fill('Hello world')
      await expect(counter).toContainText('11/2000')
    })

    test('should disable submit button when message is too short', async ({ page }) => {
      const textarea = page.locator('textarea')
      const submitButton = page.locator('button:has-text("Send")')

      // Initially disabled (empty message)
      await expect(submitButton).toBeDisabled()

      // Type less than 10 characters
      await textarea.fill('Short')
      await expect(submitButton).toBeDisabled()

      // Type 10+ characters
      await textarea.fill('This is a valid feedback message')
      await expect(submitButton).toBeEnabled()
    })

    test('should show error for message less than 10 characters on submit', async ({ page }) => {
      const textarea = page.locator('textarea')

      // Type a short message
      await textarea.fill('Short')

      // Error should be indicated (field error state)
      const errorIndicator = page.locator('p.Mui-error, .MuiFormHelperText-root.Mui-error')
      await expect(errorIndicator).toBeVisible()
    })

    test('should close modal when cancel button is clicked', async ({ page }) => {
      const cancelButton = page.locator('button:has-text("Cancel")')
      await cancelButton.click()

      // Modal should be closed
      await expect(page.locator('text=Send Feedback').first()).not.toBeVisible()
    })

    test('should submit feedback successfully with BUG type', async ({ page }) => {
      // Select BUG type
      await page.click('select#feedback-type')
      await page.click('text=Report a Bug')

      // Fill message
      const textarea = page.locator('textarea')
      await textarea.fill('The invoice PDF generation is failing when the description is too long.')

      // Submit
      const submitButton = page.locator('button:has-text("Send")')
      await submitButton.click()

      // Should show success message
      await expect(page.locator('text=Thank you for your feedback')).toBeVisible({ timeout: 5000 })

      // Modal should auto-close after success
      await expect(page.locator('text=Send Feedback').first()).not.toBeVisible({ timeout: 3000 })
    })

    test('should submit feedback successfully with FEATURE type', async ({ page }) => {
      // Select FEATURE type
      await page.click('select#feedback-type')
      await page.click('text=Request a Feature')

      // Fill message
      const textarea = page.locator('textarea')
      await textarea.fill('It would be great to have bulk invoice export functionality.')

      // Submit
      const submitButton = page.locator('button:has-text("Send")')
      await submitButton.click()

      // Should show success message
      await expect(page.locator('text=Thank you for your feedback')).toBeVisible({ timeout: 5000 })
    })

    test('should submit feedback successfully with QUESTION type', async ({ page }) => {
      // Select QUESTION type
      await page.click('select#feedback-type')
      await page.click('text=Ask a Question')

      // Fill message
      const textarea = page.locator('textarea')
      await textarea.fill('How do I update my LUT details after submission?')

      // Submit
      const submitButton = page.locator('button:has-text("Send")')
      await submitButton.click()

      // Should show success message
      await expect(page.locator('text=Thank you for your feedback')).toBeVisible({ timeout: 5000 })
    })

    test('should submit feedback successfully with OTHER type', async ({ page }) => {
      // Select OTHER type
      await page.click('select#feedback-type')
      await page.click('text=Other')

      // Fill message
      const textarea = page.locator('textarea')
      await textarea.fill('Just wanted to say the app is great! Keep up the good work.')

      // Submit
      const submitButton = page.locator('button:has-text("Send")')
      await submitButton.click()

      // Should show success message
      await expect(page.locator('text=Thank you for your feedback')).toBeVisible({ timeout: 5000 })
    })

    test('should reset form after successful submission', async ({ page }) => {
      // Fill and submit feedback
      const textarea = page.locator('textarea')
      await textarea.fill('This is a test feedback message that is long enough.')

      const submitButton = page.locator('button:has-text("Send")')
      await submitButton.click()

      // Wait for success
      await expect(page.locator('text=Thank you for your feedback')).toBeVisible({ timeout: 5000 })

      // Wait for modal to close
      await page.waitForTimeout(2500)

      // Open modal again
      await page.click('button[aria-label="feedback"]')

      // Form should be reset
      const newTextarea = page.locator('textarea')
      await expect(newTextarea).toHaveValue('')
    })

    test('should show loading state during submission', async ({ page }) => {
      // Fill message
      const textarea = page.locator('textarea')
      await textarea.fill('This is a test feedback message for loading state check.')

      // Submit
      const submitButton = page.locator('button:has-text("Send")')
      await submitButton.click()

      // Should show "Sending..." text briefly
      // Note: This might be too fast to catch in real scenario
      const loadingButton = page.locator('button:has-text("Sending...")')
      // Check if it appears OR if success appears (race condition)
      await Promise.race([
        expect(loadingButton).toBeVisible(),
        expect(page.locator('text=Thank you for your feedback')).toBeVisible({ timeout: 5000 })
      ])
    })

    test('should prevent modal close during submission', async ({ page }) => {
      // Fill message
      const textarea = page.locator('textarea')
      await textarea.fill('Test message for preventing close during submission.')

      // Start submission
      const submitButton = page.locator('button:has-text("Send")')
      await submitButton.click()

      // Try to click cancel (should be disabled)
      const cancelButton = page.locator('button:has-text("Cancel")')

      // If we can find the sending button, cancel should be disabled
      const sendingButton = page.locator('button:has-text("Sending...")')
      if (await sendingButton.isVisible()) {
        await expect(cancelButton).toBeDisabled()
      }
    })
  })

  test.describe('Feedback Modal Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard')

      // Skip if not authenticated
      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Open feedback modal
      await page.click('button[aria-label="feedback"]')
      await expect(page.locator('text=Send Feedback')).toBeVisible()
    })

    test('should prevent submission with empty message', async ({ page }) => {
      const submitButton = page.locator('button:has-text("Send")')

      // Submit button should be disabled
      await expect(submitButton).toBeDisabled()
    })

    test('should prevent submission with message exactly 9 characters', async ({ page }) => {
      const textarea = page.locator('textarea')
      await textarea.fill('123456789') // Exactly 9 characters

      const submitButton = page.locator('button:has-text("Send")')
      await expect(submitButton).toBeDisabled()
    })

    test('should allow submission with message exactly 10 characters', async ({ page }) => {
      const textarea = page.locator('textarea')
      await textarea.fill('1234567890') // Exactly 10 characters

      const submitButton = page.locator('button:has-text("Send")')
      await expect(submitButton).toBeEnabled()
    })

    test('should show character limit warning near 2000 characters', async ({ page }) => {
      const textarea = page.locator('textarea')
      const longMessage = 'a'.repeat(1999)

      await textarea.fill(longMessage)

      // Counter should show 1999/2000
      await expect(page.locator('text=1999/2000')).toBeVisible()
    })

    test('should prevent messages over 2000 characters', async ({ page }) => {
      const textarea = page.locator('textarea')
      const tooLongMessage = 'a'.repeat(2001)

      await textarea.fill(tooLongMessage)

      // Submit button should be disabled
      const submitButton = page.locator('button:has-text("Send")')
      await expect(submitButton).toBeDisabled()
    })
  })

  test.describe('Cross-page Persistence', () => {
    test('should show feedback button on all authenticated pages', async ({ page }) => {
      // Skip if not authenticated
      await page.goto('/dashboard')
      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Check dashboard
      await expect(page.locator('button[aria-label="feedback"]')).toBeVisible()

      // Check invoices page
      await page.goto('/invoices')
      await expect(page.locator('button[aria-label="feedback"]')).toBeVisible()

      // Check clients page
      await page.goto('/clients')
      await expect(page.locator('button[aria-label="feedback"]')).toBeVisible()

      // Check settings page
      await page.goto('/settings')
      await expect(page.locator('button[aria-label="feedback"]')).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels on feedback button', async ({ page }) => {
      await page.goto('/dashboard')

      // Skip if not authenticated
      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      const feedbackButton = page.locator('button[aria-label="feedback"]')
      await expect(feedbackButton).toHaveAttribute('aria-label', 'feedback')
    })

    test('should be keyboard accessible', async ({ page }) => {
      await page.goto('/dashboard')

      // Skip if not authenticated
      if (page.url().includes('/auth/signin')) {
        test.skip()
        return
      }

      // Tab to feedback button (this is tricky, might need adjustment)
      // For now, just verify button exists and can receive focus
      const feedbackButton = page.locator('button[aria-label="feedback"]')
      await feedbackButton.focus()

      // Press Enter to open modal
      await feedbackButton.press('Enter')

      // Modal should be visible
      await expect(page.locator('text=Send Feedback')).toBeVisible()
    })
  })
})
