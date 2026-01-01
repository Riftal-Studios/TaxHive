import { test, expect } from '@playwright/test'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
const Decimal = Prisma.Decimal

// Helper to create test data
async function createTestData() {
  // Create user
  const user = await prisma.user.create({
    data: {
      email: 'dashboard-test@example.com',
      name: 'Dashboard Test User',
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
      sessionToken: 'dashboard-test-session-token',
      userId: user.id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
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
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: client1.id,
      invoiceNumber: 'FY24-25/001',
      invoiceDate: lastMonth,
      dueDate: new Date(lastMonth.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: 'PAID',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '9983',
      currency: 'USD',
      exchangeRate: new Decimal('83.50'),
      exchangeSource: 'RBI',
      subtotal: new Decimal('1000'),
      igstRate: new Decimal('0'),
      igstAmount: new Decimal('0'),
      totalAmount: new Decimal('1000'),
      totalInINR: new Decimal('83500'),
    },
  })

  // Sent invoice (pending)
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: client2.id,
      invoiceNumber: 'FY24-25/002',
      invoiceDate: now,
      dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: 'SENT',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '9983',
      currency: 'EUR',
      exchangeRate: new Decimal('90.25'),
      exchangeSource: 'RBI',
      subtotal: new Decimal('500'),
      igstRate: new Decimal('0'),
      igstAmount: new Decimal('0'),
      totalAmount: new Decimal('500'),
      totalInINR: new Decimal('45125'),
    },
  })

  // Overdue invoice
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: client1.id,
      invoiceNumber: 'FY24-25/003',
      invoiceDate: twoMonthsAgo,
      dueDate: new Date(twoMonthsAgo.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days ago
      status: 'SENT',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '9983',
      currency: 'USD',
      exchangeRate: new Decimal('82.75'),
      exchangeSource: 'RBI',
      subtotal: new Decimal('750'),
      igstRate: new Decimal('0'),
      igstAmount: new Decimal('0'),
      totalAmount: new Decimal('750'),
      totalInINR: new Decimal('62062.50'),
    },
  })

  return user
}

async function cleanup() {
  await prisma.invoice.deleteMany({
    where: {
      user: {
        email: 'dashboard-test@example.com',
      },
    },
  })
  await prisma.client.deleteMany({
    where: {
      user: {
        email: 'dashboard-test@example.com',
      },
    },
  })
  await prisma.session.deleteMany({
    where: {
      user: {
        email: 'dashboard-test@example.com',
      },
    },
  })
  await prisma.user.deleteMany({
    where: {
      email: 'dashboard-test@example.com',
    },
  })
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ context }) => {
    await cleanup()
    await createTestData()
    
    // Set auth cookie
    await context.addCookies([{
      name: 'authjs.session-token',
      value: 'dashboard-test-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }])
  })

  test.afterEach(async () => {
    await cleanup()
  })

  test('should display dashboard with all metrics', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check page title
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    
    // Check metric cards are displayed
    await expect(page.getByText('Total Revenue')).toBeVisible()
    await expect(page.getByText('Total Invoices')).toBeVisible()
    await expect(page.getByText('Active Clients')).toBeVisible()
    await expect(page.getByText('Pending Payments')).toBeVisible()
    await expect(page.getByText('Overdue Invoices')).toBeVisible()
    await expect(page.getByText('Average Invoice')).toBeVisible()
    
    // Check specific metric values
    await expect(page.getByText('₹1,90,688')).toBeVisible() // Total revenue (paid + pending + overdue)
    await expect(page.getByText('3')).toBeVisible() // Total invoices
    await expect(page.getByText('2', { exact: true })).toBeVisible() // Active clients
    
    // Check charts are displayed
    await expect(page.getByText('Revenue Trend')).toBeVisible()
    await expect(page.getByText('Payment Status Breakdown')).toBeVisible()
  })

  test('should display recent invoices', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check recent invoices section
    await expect(page.getByText('Recent Invoices')).toBeVisible()
    
    // Check invoice table headers
    await expect(page.getByRole('columnheader', { name: 'Invoice' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Client' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    
    // Check invoice data is displayed
    await expect(page.getByText('FY24-25/001')).toBeVisible()
    await expect(page.getByText('FY24-25/002')).toBeVisible()
    await expect(page.getByText('FY24-25/003')).toBeVisible()
    
    // Check client names
    await expect(page.getByText('Tech Solutions Inc')).toBeVisible()
    await expect(page.getByText('Digital Agency Ltd')).toBeVisible()
    
    // Check status badges
    await expect(page.getByText('Paid')).toBeVisible()
    await expect(page.getByText('Sent')).toHaveCount(2)
  })

  test('should navigate to invoices page from recent invoices', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Click on View all link
    await page.getByRole('link', { name: 'View all' }).click()
    
    // Should navigate to invoices page
    await expect(page).toHaveURL('/invoices')
  })

  test('should navigate to invoice detail from recent invoices', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Click on View link for first invoice
    await page.getByRole('link', { name: 'View' }).first().click()
    
    // Should navigate to invoice detail page
    await expect(page.url()).toMatch(/\/invoices\/[a-zA-Z0-9-]+/)
  })

  test('should display correct status colors', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check Paid status has green color
    const paidStatus = page.locator('span', { hasText: 'Paid' })
    await expect(paidStatus).toHaveClass(/bg-green-100/)
    
    // Check Sent status has yellow color
    const sentStatus = page.locator('span', { hasText: 'Sent' }).first()
    await expect(sentStatus).toHaveClass(/bg-yellow-100/)
  })

  test('should handle empty state gracefully', async ({ page }) => {
    // Clean up all data first
    await cleanup()
    
    // Create user without any invoices or clients
    const user = await prisma.user.create({
      data: {
        email: 'dashboard-test@example.com',
        name: 'Dashboard Test User',
        onboardingCompleted: true,
      },
    })
    
    await prisma.session.create({
      data: {
        sessionToken: 'dashboard-test-session-token',
        userId: user.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })
    
    await page.goto('/dashboard')
    
    // Check that metrics show zero values
    await expect(page.getByText('₹0')).toBeVisible()
    await expect(page.getByText('0', { exact: true })).toHaveCount(4) // Total invoices, clients, pending, overdue
    
    // Check empty state in recent invoices
    await expect(page.getByText('No invoices found')).toBeVisible()
  })

  test('should be responsive on mobile', async ({ page }) => {
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