import { test as base, expect, type Page, type BrowserContext } from '@playwright/test'
import { type User } from '@prisma/client'
import { faker } from '@faker-js/faker'
import { createErrorRecorder, ErrorRecorder } from '../utils/error-recorder'
import { createScreenshotHelper, ScreenshotHelper } from '../utils/screenshot-helper'
import { prisma } from '../../../lib/prisma'
import { encode } from 'next-auth/jwt'

interface TestUser extends User {
  jwtToken: string
}

interface AuthFixtures {
  testUser: TestUser
  authenticatedPage: Page
  errorRecorder: ErrorRecorder
  screenshotHelper: ScreenshotHelper
}

/**
 * Create a JWT token for a test user (NextAuth JWT session strategy)
 * Uses NextAuth's encode function to create a properly encrypted token
 */
async function createJwtToken(user: User): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET must be set for E2E tests')
  }

  // NextAuth JWT payload structure matching our auth.ts JWT callback
  const token = await encode({
    secret,
    token: {
      id: user.id,
      name: user.name,
      email: user.email,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
    },
    maxAge: 24 * 60 * 60, // 24 hours
  })

  return token
}

/**
 * Create a test user with a valid JWT session
 */
async function createTestUserWithSession(overrides: Partial<User> = {}): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      email: faker.internet.email({ provider: 'taxhive-test.com' }),
      name: faker.person.fullName(),
      emailVerified: new Date(),
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      address: faker.location.streetAddress() + ', Bangalore, Karnataka 560001',
      onboardingCompleted: true,
      onboardingStep: 'complete',
      ...overrides,
    },
  })

  const jwtToken = await createJwtToken(user)
  return { ...user, jwtToken }
}

/**
 * Set up authentication cookies for a page context
 * Uses NextAuth v4 cookie naming convention for development
 */
async function setupAuthCookies(context: BrowserContext, jwtToken: string): Promise<void> {
  await context.addCookies([
    {
      name: 'next-auth.session-token',
      value: jwtToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

/**
 * Clean up a test user and all related data
 */
async function cleanupTestUser(userId: string): Promise<void> {
  // Delete in correct order to respect foreign keys
  await prisma.paymentVoucher.deleteMany({ where: { userId } })
  await prisma.feedback.deleteMany({ where: { userId } })
  await prisma.emailHistory.deleteMany({ where: { userId } })
  // Payment has no direct userId - delete via invoice relation
  await prisma.payment.deleteMany({ where: { invoice: { userId } } })
  await prisma.invoiceItem.deleteMany({ where: { invoice: { userId } } })
  await prisma.invoice.deleteMany({ where: { userId } })
  await prisma.unregisteredSupplier.deleteMany({ where: { userId } })
  await prisma.client.deleteMany({ where: { userId } })
  await prisma.lUT.deleteMany({ where: { userId } })
  await prisma.documentUpload.deleteMany({ where: { userId } })
  await prisma.gSTFilingPeriod.deleteMany({ where: { userId } })
  await prisma.gSTR2BUpload.deleteMany({ where: { userId } })
  await prisma.iTCLedger.deleteMany({ where: { userId } })
  await prisma.session.deleteMany({ where: { userId } })
  await prisma.account.deleteMany({ where: { userId } })
  await prisma.user.delete({ where: { id: userId } })
}

/**
 * Extended test with authentication fixtures
 */
export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    const user = await createTestUserWithSession()
    await use(user)
    await cleanupTestUser(user.id)
  },

  authenticatedPage: async ({ page, context, testUser }, use) => {
    await setupAuthCookies(context, testUser.jwtToken)
    await use(page)
  },

  errorRecorder: async ({ page }, use) => {
    const recorder = await createErrorRecorder(page)
    await use(recorder)
  },

  screenshotHelper: async ({}, use, testInfo) => {
    const helper = createScreenshotHelper(testInfo.title)
    await use(helper)
    // Clean up on success, keep on failure
    if (testInfo.status === 'passed') {
      helper.cleanup()
    }
  },
})

export { expect, createTestUserWithSession, setupAuthCookies, cleanupTestUser, prisma }

/**
 * Test fixture that includes full error recording and screenshots
 */
export const testWithRecording = test.extend<{
  captureOnFailure: () => Promise<void>
}>({
  captureOnFailure: async ({ page, screenshotHelper, errorRecorder }, use, testInfo) => {
    const capture = async () => {
      if (testInfo.status !== 'passed') {
        await screenshotHelper.captureFullPage(page, 'failure-state')
        await errorRecorder.saveToFile(testInfo.title)
      }
    }
    await use(capture)
  },
})
