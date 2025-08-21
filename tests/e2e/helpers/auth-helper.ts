import { expect, Page } from '@playwright/test'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'

export async function createTestUser(email: string, password: string, userData?: any) {
  // Hash the password
  const hashedPassword = await hashPassword(password)
  
  // Create user
  return await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      emailVerified: new Date(), // Set as verified so auth works
      name: 'Test User',
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      address: 'Test Address',
      onboardingCompleted: true,
      onboardingStep: 'complete',
      ...userData,
    },
  })
}

export async function signInUser(page: Page, email: string, password: string) {
  // Navigate to signin page
  await page.goto('/auth/signin')
  
  // Wait for page to be ready
  await page.waitForLoadState('domcontentloaded')
  
  // Wait for email input to be visible and fill it
  await page.waitForSelector('input[type="email"]', { state: 'visible' })
  await page.fill('input[type="email"]', email)
  
  // Fill password
  await page.fill('input[type="password"]', password)
  
  // Click submit button
  await page.click('button[type="submit"]')
  
  // Wait for navigation away from signin page
  await page.waitForURL(url => {
    const urlObj = new URL(url)
    return !urlObj.pathname.includes('/auth/signin')
  }, { timeout: 15000 })
  
  // Ensure we're on dashboard
  if (!page.url().includes('/dashboard')) {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  }
}

export async function cleanupTestUser(email: string) {
  // Clean up all related data for the test user
  await prisma.invoice.deleteMany({
    where: {
      user: {
        email: email,
      },
    },
  })
  await prisma.client.deleteMany({
    where: {
      user: {
        email: email,
      },
    },
  })
  await prisma.lUT.deleteMany({
    where: {
      user: {
        email: email,
      },
    },
  })
  await prisma.session.deleteMany({
    where: {
      user: {
        email: email,
      },
    },
  })
  await prisma.user.deleteMany({
    where: {
      email: email,
    },
  })
}