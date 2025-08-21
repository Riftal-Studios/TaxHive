/**
 * @file E2E tests for Approval Workflow
 * @description TDD End-to-End Tests using Playwright
 * Following RED-GREEN-REFACTOR cycle
 */

import { test, expect } from '@playwright/test'
import { db } from '@/lib/prisma'

// Test data setup helper
async function setupTestData() {
  // This will fail initially as the approval workflow features don't exist
  const user = await db.user.create({
    data: {
      email: 'e2e-test@example.com',
      name: 'E2E Test User',
      gstin: 'E2ETEST123456789',
      onboardingCompleted: true,
    },
  })

  const client = await db.client.create({
    data: {
      userId: user.id,
      name: 'E2E Test Client',
      email: 'client@example.com',
      address: 'Test Address',
      country: 'India',
    },
  })

  const managerRole = await db.approvalRole.create({
    data: {
      userId: user.id,
      name: 'MANAGER',
      level: 1,
      maxApprovalAmount: 100000,
    },
  })

  const financeRole = await db.approvalRole.create({
    data: {
      userId: user.id,
      name: 'FINANCE_HEAD',
      level: 2,
      maxApprovalAmount: 500000,
    },
  })

  const approvalRule = await db.approvalRule.create({
    data: {
      userId: user.id,
      name: 'E2E Test Rule',
      minAmount: 50000,
      maxAmount: 200000,
      currency: 'INR',
      requiredApprovals: 2,
      approverRoles: ['MANAGER', 'FINANCE_HEAD'],
      approvalTimeout: 24,
      isActive: true,
      priority: 1,
    },
  })

  return { user, client, managerRole, financeRole, approvalRule }
}

// Cleanup helper
async function cleanupTestData(userId: string) {
  await db.approvalAuditLog.deleteMany({ where: { actorId: userId } })
  await db.approvalNotification.deleteMany({})
  await db.approvalAction.deleteMany({})
  await db.approvalWorkflow.deleteMany({ where: { userId } })
  await db.approvalDelegation.deleteMany({})
  await db.approvalRule.deleteMany({ where: { userId } })
  await db.approvalRole.deleteMany({ where: { userId } })
  await db.invoice.deleteMany({ where: { userId } })
  await db.client.deleteMany({ where: { userId } })
  await db.user.delete({ where: { id: userId } })
}

test.describe('Approval Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/auth/signin')
    
    // This will fail initially as approval workflow UI doesn't exist
    await page.fill('[data-testid="email"]', 'e2e-test@example.com')
    await page.click('[data-testid="signin-button"]')
    
    // Wait for authentication
    await page.waitForURL('/dashboard')
  })

  test('should configure approval rules', async ({ page }) => {
    // RED: This test should fail initially
    await page.goto('/admin/approval-rules')
    
    // Click create new rule button
    await page.click('[data-testid="create-rule-button"]')
    
    // Fill rule configuration form
    await page.fill('[data-testid="rule-name"]', 'E2E Test Rule')
    await page.fill('[data-testid="min-amount"]', '50000')
    await page.fill('[data-testid="max-amount"]', '200000')
    await page.selectOption('[data-testid="currency"]', 'INR')
    
    // Configure approval levels
    await page.fill('[data-testid="required-approvals"]', '2')
    await page.check('[data-testid="role-manager"]')
    await page.check('[data-testid="role-finance-head"]')
    
    // Set timeout
    await page.fill('[data-testid="approval-timeout"]', '24')
    await page.selectOption('[data-testid="escalate-to"]', 'DIRECTOR')
    
    // Save rule
    await page.click('[data-testid="save-rule-button"]')
    
    // Verify rule was created
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Rule created successfully')
    await expect(page.locator('[data-testid="rules-table"]')).toContainText('E2E Test Rule')
  })

  test('should create invoice requiring approval', async ({ page }) => {
    // RED: This test should fail initially
    const { user, client } = await setupTestData()
    
    try {
      await page.goto('/invoices/new')
      
      // Fill invoice form
      await page.selectOption('[data-testid="client-select"]', client.id)
      await page.fill('[data-testid="invoice-amount"]', '83500') // ₹83,500 in INR
      await page.selectOption('[data-testid="currency"]', 'USD')
      await page.fill('[data-testid="exchange-rate"]', '83.5')
      
      // Add line items
      await page.click('[data-testid="add-line-item"]')
      await page.fill('[data-testid="line-item-description"]', 'E2E Test Service')
      await page.fill('[data-testid="line-item-quantity"]', '1')
      await page.fill('[data-testid="line-item-rate"]', '1000')
      await page.fill('[data-testid="line-item-sac"]', '998314')
      
      // Submit for approval
      await page.click('[data-testid="submit-for-approval"]')
      
      // Verify approval workflow is triggered
      await expect(page.locator('[data-testid="approval-required-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="workflow-status"]')).toContainText('Pending Approval')
      
      // Verify approval workflow details
      await expect(page.locator('[data-testid="current-level"]')).toContainText('1')
      await expect(page.locator('[data-testid="required-level"]')).toContainText('2')
      await expect(page.locator('[data-testid="pending-approver"]')).toContainText('Manager')
    } finally {
      await cleanupTestData(user.id)
    }
  })

  test('should display pending approvals dashboard', async ({ page }) => {
    // RED: This test should fail initially
    const { user, client } = await setupTestData()
    
    try {
      // Create invoice that needs approval (setup)
      const invoice = await db.invoice.create({
        data: {
          userId: user.id,
          clientId: client.id,
          invoiceNumber: 'FY24-25/E2E001',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          currency: 'USD',
          exchangeRate: 83.5,
          subtotal: 1000,
          totalAmount: 1000,
          totalInINR: 83500,
          status: 'PENDING_APPROVAL',
        },
      })
      
      await page.goto('/approvals/pending')
      
      // Verify pending approvals are displayed
      await expect(page.locator('[data-testid="pending-approvals-count"]')).toContainText('1')
      await expect(page.locator('[data-testid="approval-item"]')).toContainText('FY24-25/E2E001')
      await expect(page.locator('[data-testid="approval-amount"]')).toContainText('₹83,500')
      await expect(page.locator('[data-testid="approval-due-date"]')).toBeVisible()
      
      // Test filters
      await page.selectOption('[data-testid="urgency-filter"]', 'HIGH')
      await page.fill('[data-testid="amount-filter"]', '50000')
      await page.click('[data-testid="apply-filters"]')
      
      // Test sorting
      await page.click('[data-testid="sort-by-amount"]')
      await page.click('[data-testid="sort-by-due-date"]')
    } finally {
      await cleanupTestData(user.id)
    }
  })

  test('should approve invoice through workflow', async ({ page }) => {
    // RED: This test should fail initially
    const { user, client, managerRole, financeRole } = await setupTestData()
    
    try {
      // Create test invoice and workflow (setup)
      const invoice = await db.invoice.create({
        data: {
          userId: user.id,
          clientId: client.id,
          invoiceNumber: 'FY24-25/E2E002',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          currency: 'USD',
          exchangeRate: 83.5,
          subtotal: 1000,
          totalAmount: 1000,
          totalInINR: 83500,
          status: 'PENDING_APPROVAL',
        },
      })
      
      const workflow = await db.approvalWorkflow.create({
        data: {
          userId: user.id,
          invoiceId: invoice.id,
          ruleId: 'test-rule-id',
          status: 'PENDING',
          currentLevel: 1,
          requiredLevel: 2,
          initiatedBy: user.id,
        },
      })
      
      await page.goto(`/approvals/review/${workflow.id}`)
      
      // Verify invoice details are displayed
      await expect(page.locator('[data-testid="invoice-number"]')).toContainText('FY24-25/E2E002')
      await expect(page.locator('[data-testid="invoice-amount"]')).toContainText('₹83,500')
      await expect(page.locator('[data-testid="client-name"]')).toContainText('E2E Test Client')
      
      // Verify approval chain visualization
      await expect(page.locator('[data-testid="approval-chain"]')).toBeVisible()
      await expect(page.locator('[data-testid="current-step"]')).toContainText('Manager Review')
      await expect(page.locator('[data-testid="next-step"]')).toContainText('Finance Head Review')
      
      // Add approval comments
      await page.fill('[data-testid="approval-comments"]', 'Looks good, approved by manager')
      
      // Upload supporting document
      await page.setInputFiles('[data-testid="attachment-upload"]', 'tests/fixtures/approval-document.pdf')
      
      // Approve at manager level
      await page.click('[data-testid="approve-button"]')
      
      // Verify approval confirmation
      await expect(page.locator('[data-testid="approval-success"]')).toContainText('Approval submitted successfully')
      await expect(page.locator('[data-testid="workflow-status"]')).toContainText('Awaiting Finance Head Approval')
      
      // Simulate finance head approval
      await page.goto(`/approvals/review/${workflow.id}`)
      await page.fill('[data-testid="approval-comments"]', 'Final approval granted')
      await page.click('[data-testid="approve-button"]')
      
      // Verify workflow completion
      await expect(page.locator('[data-testid="workflow-complete"]')).toContainText('Invoice Approved')
      await expect(page.locator('[data-testid="final-status"]')).toContainText('Approved')
    } finally {
      await cleanupTestData(user.id)
    }
  })

  test('should reject invoice with comments', async ({ page }) => {
    // RED: This test should fail initially
    const { user, client } = await setupTestData()
    
    try {
      // Setup test data
      const invoice = await db.invoice.create({
        data: {
          userId: user.id,
          clientId: client.id,
          invoiceNumber: 'FY24-25/E2E003',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          currency: 'USD',
          exchangeRate: 83.5,
          subtotal: 1000,
          totalAmount: 1000,
          totalInINR: 83500,
          status: 'PENDING_APPROVAL',
        },
      })
      
      const workflow = await db.approvalWorkflow.create({
        data: {
          userId: user.id,
          invoiceId: invoice.id,
          ruleId: 'test-rule-id',
          status: 'PENDING',
          currentLevel: 1,
          requiredLevel: 2,
          initiatedBy: user.id,
        },
      })
      
      await page.goto(`/approvals/review/${workflow.id}`)
      
      // Add rejection comments
      await page.fill('[data-testid="approval-comments"]', 'Client details need verification')
      
      // Reject the invoice
      await page.click('[data-testid="reject-button"]')
      
      // Confirm rejection in modal
      await page.fill('[data-testid="rejection-reason"]', 'GSTIN verification failed')
      await page.click('[data-testid="confirm-reject"]')
      
      // Verify rejection
      await expect(page.locator('[data-testid="rejection-success"]')).toContainText('Invoice rejected successfully')
      await expect(page.locator('[data-testid="workflow-status"]')).toContainText('Rejected')
      await expect(page.locator('[data-testid="rejection-reason"]')).toContainText('GSTIN verification failed')
    } finally {
      await cleanupTestData(user.id)
    }
  })

  test('should request changes on invoice', async ({ page }) => {
    // RED: This test should fail initially
    const { user, client } = await setupTestData()
    
    try {
      // Setup test data
      const invoice = await db.invoice.create({
        data: {
          userId: user.id,
          clientId: client.id,
          invoiceNumber: 'FY24-25/E2E004',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          currency: 'USD',
          exchangeRate: 83.5,
          subtotal: 1000,
          totalAmount: 1000,
          totalInINR: 83500,
          status: 'PENDING_APPROVAL',
        },
      })
      
      const workflow = await db.approvalWorkflow.create({
        data: {
          userId: user.id,
          invoiceId: invoice.id,
          ruleId: 'test-rule-id',
          status: 'PENDING',
          currentLevel: 1,
          requiredLevel: 2,
          initiatedBy: user.id,
        },
      })
      
      await page.goto(`/approvals/review/${workflow.id}`)
      
      // Request changes
      await page.click('[data-testid="request-changes-button"]')
      
      // Fill change request form
      await page.fill('[data-testid="requested-changes"]', 'Please update client GSTIN and verify address')
      await page.selectOption('[data-testid="change-priority"]', 'HIGH')
      await page.fill('[data-testid="change-comments"]', 'GSTIN format appears incorrect')
      
      // Submit change request
      await page.click('[data-testid="submit-changes"]')
      
      // Verify change request
      await expect(page.locator('[data-testid="changes-requested"]')).toContainText('Changes requested successfully')
      await expect(page.locator('[data-testid="workflow-status"]')).toContainText('Changes Requested')
      await expect(page.locator('[data-testid="change-details"]')).toContainText('Please update client GSTIN')
    } finally {
      await cleanupTestData(user.id)
    }
  })

  test('should delegate approval authority', async ({ page }) => {
    // RED: This test should fail initially
    const { user, client } = await setupTestData()
    
    try {
      // Create delegate user
      const delegateUser = await db.user.create({
        data: {
          email: 'delegate@example.com',
          name: 'Delegate User',
          onboardingCompleted: true,
        },
      })
      
      await page.goto('/approvals/delegation')
      
      // Create new delegation
      await page.click('[data-testid="create-delegation"]')
      
      // Fill delegation form
      await page.selectOption('[data-testid="from-role"]', 'MANAGER')
      await page.fill('[data-testid="delegate-to"]', 'delegate@example.com')
      await page.fill('[data-testid="delegation-reason"]', 'Vacation coverage')
      
      // Set delegation period
      await page.fill('[data-testid="start-date"]', '2024-08-19')
      await page.fill('[data-testid="end-date"]', '2024-08-26')
      
      // Set amount limit
      await page.fill('[data-testid="max-amount"]', '100000')
      
      // Submit delegation
      await page.click('[data-testid="submit-delegation"]')
      
      // Verify delegation created
      await expect(page.locator('[data-testid="delegation-success"]')).toContainText('Delegation created successfully')
      await expect(page.locator('[data-testid="delegations-table"]')).toContainText('Delegate User')
      await expect(page.locator('[data-testid="delegation-status"]')).toContainText('Active')
      
      // Test delegation usage
      const invoice = await db.invoice.create({
        data: {
          userId: user.id,
          clientId: client.id,
          invoiceNumber: 'FY24-25/E2E005',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          currency: 'USD',
          exchangeRate: 83.5,
          subtotal: 500, // Within delegation limit
          totalAmount: 500,
          totalInINR: 41750,
          status: 'PENDING_APPROVAL',
        },
      })
      
      // Verify delegate can see pending approval
      await page.goto('/auth/signin')
      await page.fill('[data-testid="email"]', 'delegate@example.com')
      await page.click('[data-testid="signin-button"]')
      
      await page.goto('/approvals/pending')
      await expect(page.locator('[data-testid="delegated-approval"]')).toContainText('FY24-25/E2E005')
      await expect(page.locator('[data-testid="delegation-notice"]')).toContainText('Acting for Manager')
      
      // Clean up delegate user
      await db.user.delete({ where: { id: delegateUser.id } })
    } finally {
      await cleanupTestData(user.id)
    }
  })

  test('should display approval history and audit trail', async ({ page }) => {
    // RED: This test should fail initially
    const { user, client } = await setupTestData()
    
    try {
      await page.goto('/approvals/history')
      
      // Test filters
      await page.selectOption('[data-testid="status-filter"]', 'APPROVED')
      await page.fill('[data-testid="date-from"]', '2024-08-01')
      await page.fill('[data-testid="date-to"]', '2024-08-31')
      await page.click('[data-testid="apply-filters"]')
      
      // Test search
      await page.fill('[data-testid="search-invoices"]', 'FY24-25')
      await page.click('[data-testid="search-button"]')
      
      // View detailed audit trail
      await page.click('[data-testid="view-audit-trail"]')
      
      // Verify audit details
      await expect(page.locator('[data-testid="audit-timeline"]')).toBeVisible()
      await expect(page.locator('[data-testid="audit-entry"]')).toBeVisible()
      
      // Test export functionality
      await page.click('[data-testid="export-audit"]')
      await page.selectOption('[data-testid="export-format"]', 'CSV')
      await page.click('[data-testid="download-export"]')
      
      // Verify download initiated
      await expect(page.locator('[data-testid="export-success"]')).toContainText('Export started')
    } finally {
      await cleanupTestData(user.id)
    }
  })

  test('should handle workflow timeout and escalation', async ({ page }) => {
    // RED: This test should fail initially
    const { user, client } = await setupTestData()
    
    try {
      // Create expired workflow (setup)
      const invoice = await db.invoice.create({
        data: {
          userId: user.id,
          clientId: client.id,
          invoiceNumber: 'FY24-25/E2E006',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          currency: 'USD',
          exchangeRate: 83.5,
          subtotal: 1000,
          totalAmount: 1000,
          totalInINR: 83500,
          status: 'PENDING_APPROVAL',
        },
      })
      
      const workflow = await db.approvalWorkflow.create({
        data: {
          userId: user.id,
          invoiceId: invoice.id,
          ruleId: 'test-rule-id',
          status: 'PENDING',
          currentLevel: 1,
          requiredLevel: 2,
          initiatedBy: user.id,
          dueDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (expired)
          escalatedTo: 'DIRECTOR',
          escalatedAt: new Date(),
        },
      })
      
      await page.goto('/approvals/escalated')
      
      // Verify escalated approval is displayed
      await expect(page.locator('[data-testid="escalated-approvals"]')).toContainText('FY24-25/E2E006')
      await expect(page.locator('[data-testid="escalation-reason"]')).toContainText('Timeout')
      await expect(page.locator('[data-testid="escalated-to"]')).toContainText('Director')
      await expect(page.locator('[data-testid="escalation-date"]')).toBeVisible()
      
      // Test escalation notification
      await expect(page.locator('[data-testid="escalation-alert"]')).toContainText('This approval has been escalated')
    } finally {
      await cleanupTestData(user.id)
    }
  })

  test('should provide mobile-responsive approval interface', async ({ page }) => {
    // RED: This test should fail initially
    const { user, client } = await setupTestData()
    
    try {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      await page.goto('/approvals/pending')
      
      // Verify mobile-friendly layout
      await expect(page.locator('[data-testid="mobile-approval-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="mobile-filters-button"]')).toBeVisible()
      
      // Test mobile approval card
      await page.click('[data-testid="mobile-approval-card"]')
      
      // Verify approval details in mobile view
      await expect(page.locator('[data-testid="mobile-invoice-details"]')).toBeVisible()
      await expect(page.locator('[data-testid="mobile-action-buttons"]')).toBeVisible()
      
      // Test mobile approval actions
      await page.click('[data-testid="mobile-approve-button"]')
      await page.fill('[data-testid="mobile-comments"]', 'Mobile approval test')
      await page.click('[data-testid="mobile-confirm-approve"]')
      
      // Verify mobile success message
      await expect(page.locator('[data-testid="mobile-success-toast"]')).toBeVisible()
    } finally {
      await cleanupTestData(user.id)
    }
  })

  test('should handle bulk approval operations', async ({ page }) => {
    // RED: This test should fail initially
    const { user, client } = await setupTestData()
    
    try {
      await page.goto('/approvals/bulk')
      
      // Select multiple approvals
      await page.check('[data-testid="approval-checkbox-1"]')
      await page.check('[data-testid="approval-checkbox-2"]')
      await page.check('[data-testid="approval-checkbox-3"]')
      
      // Verify bulk actions are enabled
      await expect(page.locator('[data-testid="bulk-actions"]')).toBeVisible()
      await expect(page.locator('[data-testid="selected-count"]')).toContainText('3 selected')
      
      // Test bulk approval
      await page.click('[data-testid="bulk-approve"]')
      await page.fill('[data-testid="bulk-comments"]', 'Bulk approval for routine invoices')
      await page.click('[data-testid="confirm-bulk-approve"]')
      
      // Verify bulk operation status
      await expect(page.locator('[data-testid="bulk-progress"]')).toBeVisible()
      await expect(page.locator('[data-testid="bulk-success"]')).toContainText('3 approvals processed')
      
      // Test bulk rejection
      await page.check('[data-testid="approval-checkbox-4"]')
      await page.check('[data-testid="approval-checkbox-5"]')
      await page.click('[data-testid="bulk-reject"]')
      await page.fill('[data-testid="bulk-rejection-reason"]', 'Batch processing - documentation incomplete')
      await page.click('[data-testid="confirm-bulk-reject"]')
      
      // Verify bulk rejection
      await expect(page.locator('[data-testid="bulk-rejection-success"]')).toContainText('2 rejections processed')
    } finally {
      await cleanupTestData(user.id)
    }
  })
})