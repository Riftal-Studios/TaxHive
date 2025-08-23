import { test, expect } from '@playwright/test'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { createTestUser, signInUser, cleanupTestUser } from './helpers/auth-helper'
import { Logger } from '@/lib/logger'

// Generate unique email for each test to avoid conflicts
const getTestEmail = (testId: string) => `dashboard-${testId}-${Date.now()}@example.com`
const TEST_PASSWORD = 'TestPassword123!'

// Helper to create test data
async function createTestData(testEmail: string) {
  // Create user with proper password authentication
  const user = await createTestUser(testEmail, TEST_PASSWORD, {
    name: 'Dashboard Test User',
    gstin: '29ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    address: 'Test Address',
  })

  // Create clients
  const client1 = await prisma.client.create({
    data: {
      userId: user.id,
      name: 'Tech Solutions Inc',
      email: 'contact@techsolutions.com',
      company: 'Tech Solutions Inc',
      address: '123 Tech Street, San Francisco, CA',
      country: 'United States',
      isActive: true,
    },
  })

  const client2 = await prisma.client.create({
    data: {
      userId: user.id,
      name: 'Digital Agency Ltd',
      email: 'info@digitalagency.co.uk',
      company: 'Digital Agency Ltd',
      address: '456 Digital Road, London',
      country: 'United Kingdom',
      isActive: true,
    },
  })

  // Create invoices
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  
  // Paid invoice
  const uniqueSuffix = Date.now().toString() + Math.random().toString(36).substring(2, 9)
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: client1.id,
      invoiceNumber: `FY24-25/${uniqueSuffix}-001`,
      invoiceDate: lastMonth,
      dueDate: new Date(lastMonth.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: 'PAID',
      invoiceType: 'EXPORT',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '9983',
      currency: 'USD',
      exchangeRate: new Decimal('83.50'),
      exchangeSource: 'RBI',
      subtotal: new Decimal('1000'),
      taxableAmount: new Decimal('1000'),
      igstRate: new Decimal('0'),
      igstAmount: new Decimal('0'),
      totalAmount: new Decimal('1000'),
      totalInINR: new Decimal('83500'),
      paymentTerms: 'Net 30',
    },
  })

  // Sent invoice (pending)
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: client2.id,
      invoiceNumber: `FY24-25/${uniqueSuffix}-002`,
      invoiceDate: now,
      dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: 'SENT',
      invoiceType: 'EXPORT',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '9983',
      currency: 'EUR',
      exchangeRate: new Decimal('90.25'),
      exchangeSource: 'RBI',
      subtotal: new Decimal('500'),
      taxableAmount: new Decimal('500'),
      igstRate: new Decimal('0'),
      igstAmount: new Decimal('0'),
      totalAmount: new Decimal('500'),
      totalInINR: new Decimal('45125'),
      paymentTerms: 'Net 30',
    },
  })

  // Overdue invoice
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: client1.id,
      invoiceNumber: `FY24-25/${uniqueSuffix}-003`,
      invoiceDate: twoMonthsAgo,
      dueDate: new Date(twoMonthsAgo.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days ago
      status: 'SENT',
      invoiceType: 'EXPORT',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '9983',
      currency: 'USD',
      exchangeRate: new Decimal('82.75'),
      exchangeSource: 'RBI',
      subtotal: new Decimal('750'),
      taxableAmount: new Decimal('750'),
      igstRate: new Decimal('0'),
      igstAmount: new Decimal('0'),
      totalAmount: new Decimal('750'),
      totalInINR: new Decimal('62062.50'),
      paymentTerms: 'Net 30',
    },
  })

  return user
}

test.describe('Dashboard', () => {
  let testEmail: string
  
  test.beforeEach(async ({ page }, testInfo) => {
    // Generate unique email for this test
    testEmail = getTestEmail(testInfo.testId)
    
    // Cleanup any existing data and create fresh test data
    await cleanupTestUser(testEmail)
    await createTestData(testEmail)
    
    // Sign in the test user
    await signInUser(page, testEmail, TEST_PASSWORD)
  })

  test.afterEach(async () => {
    if (testEmail) {
      await cleanupTestUser(testEmail)
    }
  })

  test('should display dashboard with all metrics', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Wait for page to fully load and log current URL for debugging
    await page.waitForLoadState('networkidle')
    Logger.info('Current URL:', page.url())
    Logger.info('Page title:', await page.title())
    
    // Check page title
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    
    // Check metric cards are displayed
    await expect(page.getByText('Total Revenue')).toBeVisible()
    await expect(page.getByText('Total Invoices')).toBeVisible()
    await expect(page.getByText('Active Clients')).toBeVisible()
    await expect(page.getByText('Pending Payments')).toBeVisible()
    await expect(page.getByText('Overdue Invoices')).toBeVisible()
    await expect(page.getByText('Average Invoice')).toBeVisible()
    
    // Check specific metric values (use more specific selectors to avoid multiple matches)
    await expect(page.getByText('₹1,90,688')).toBeVisible() // Total revenue (paid + pending + overdue)
    await expect(page.getByText('3', { exact: true }).first()).toBeVisible() // Total invoices (use first match)
    await expect(page.locator('text=Active Clients').locator('..').getByText('2')).toBeVisible() // Active clients with context
    
    // Check charts are displayed
    await expect(page.getByText('Revenue Trend')).toBeVisible()
    await expect(page.getByText('Payment Status Breakdown')).toBeVisible()
  })

  test('should display recent invoices', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check recent invoices section
    await expect(page.getByText('Recent Invoices')).toBeVisible()
    
    // Check invoice table headers
    await expect(page.getByRole('columnheader', { name: 'Invoice #' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Client' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Invoice Date' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    
    // Check invoice data is displayed (using partial matching due to unique suffixes)
    await expect(page.getByText(/FY24-25\/.*-001/)).toBeVisible()
    await expect(page.getByText(/FY24-25\/.*-002/)).toBeVisible()
    await expect(page.getByText(/FY24-25\/.*-003/)).toBeVisible()
    
    // Check client names are in the table
    await expect(page.getByText('Tech Solutions Inc').first()).toBeVisible()
    await expect(page.getByText('Digital Agency Ltd').first()).toBeVisible()
    
    // Check status badges
    await expect(page.getByText('PAID')).toBeVisible()
    await expect(page.getByText('SENT').first()).toBeVisible()
  })

  test('should navigate to invoices page from recent invoices', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Wait for dashboard to load
    await page.waitForLoadState('networkidle')
    
    // Click on View all button
    await page.getByRole('button', { name: 'View All' }).click()
    
    // Wait for navigation and check URL
    await page.waitForURL('**/invoices', { timeout: 10000 })
    
    // Should navigate to invoices page
    await expect(page).toHaveURL(/\/invoices$/)
  })

  test('should navigate to invoice detail from recent invoices', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Wait for dashboard to load
    await page.waitForLoadState('networkidle')
    
    // Click on View Invoice button for first invoice
    await page.getByRole('button', { name: 'View Invoice' }).first().click()
    
    // Wait for navigation
    await page.waitForURL(/\/invoices\/[a-zA-Z0-9-]+/, { timeout: 10000 })
    
    // Should navigate to invoice detail page
    await expect(page.url()).toMatch(/\/invoices\/[a-zA-Z0-9-]+/)
  })

  test('should display correct status colors', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check status badges are displayed with correct text
    const paidStatus = page.getByText('PAID')
    await expect(paidStatus).toBeVisible()
    
    const sentStatus = page.getByText('SENT').first()
    await expect(sentStatus).toBeVisible()
  })

  test.skip('should handle empty state gracefully', async ({ page }) => {
    // Skip this test for now as it requires special handling
    // Create a new test email for empty state test
    const emptyStateEmail = `dashboard-empty-${Date.now()}@example.com`
    
    // Clean up any existing data and create fresh user
    await cleanupTestUser(emptyStateEmail)
    
    // Create user without any invoices or clients but sign them in
    await createTestUser(emptyStateEmail, TEST_PASSWORD, {
      name: 'Dashboard Test User',
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      address: 'Test Address',
    })
    
    await signInUser(page, emptyStateEmail, TEST_PASSWORD)
    await page.goto('/dashboard')
    
    // Check that metrics show zero values
    await expect(page.getByText('₹0')).toBeVisible()
    await expect(page.getByText('0', { exact: true })).toHaveCount(4) // Total invoices, clients, pending, overdue
    
    // Check empty state in recent invoices
    await expect(page.getByText('No invoices found')).toBeVisible()
    
    // Clean up the empty state test user
    await cleanupTestUser(emptyStateEmail)
  })

  test.skip('should be responsive on mobile', async ({ page }) => {
    // Skip this test for now as it requires viewport handling
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/dashboard')
    
    // Check that content is still visible
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('Total Revenue')).toBeVisible()
    
    // Check that grid layout adjusts for mobile
    const metricCards = page.locator('.grid > div').filter({ hasText: 'Total Revenue' }).locator('..')
    await expect(metricCards).toHaveCSS('grid-template-columns', /repeat\(1/)
  })
})