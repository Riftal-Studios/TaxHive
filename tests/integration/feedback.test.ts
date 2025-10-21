import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appRouter } from '@/server/api/root'
import { createTestUser, cleanupDatabase, prisma, createTestContext } from '../utils/test-helpers'
import type { Session } from 'next-auth'

describe('Feedback Router', () => {
  let testUser: any
  let ctx: any
  let caller: any

  beforeEach(async () => {
    // Create test user
    testUser = await createTestUser()

    // Create context with authenticated session
    const session: Session = {
      user: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }

    // Use createTestContext instead of createTRPCContext
    ctx = createTestContext(session)

    // Create caller with context
    caller = appRouter.createCaller(ctx)
  })

  afterEach(async () => {
    await cleanupDatabase()
  })

  describe('create', () => {
    it('should create a new feedback with BUG type', async () => {
      const feedback = await caller.feedback.create({
        type: 'BUG',
        message: 'The invoice PDF generation is failing when the description is too long.',
        pageUrl: 'https://dev.taxhive.app/invoices/new',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      })

      expect(feedback).toMatchObject({
        type: 'BUG',
        message: 'The invoice PDF generation is failing when the description is too long.',
        pageUrl: 'https://dev.taxhive.app/invoices/new',
        userId: testUser.id,
        status: 'NEW',
      })
      expect(feedback.id).toBeTruthy()
      expect(feedback.createdAt).toBeInstanceOf(Date)
    })

    it('should create feedback with FEATURE type', async () => {
      const feedback = await caller.feedback.create({
        type: 'FEATURE',
        message: 'It would be great to have bulk invoice export functionality.',
        pageUrl: 'https://dev.taxhive.app/invoices',
        userAgent: 'Mozilla/5.0',
      })

      expect(feedback.type).toBe('FEATURE')
      expect(feedback.status).toBe('NEW')
    })

    it('should create feedback with QUESTION type', async () => {
      const feedback = await caller.feedback.create({
        type: 'QUESTION',
        message: 'How do I update my LUT details?',
        pageUrl: 'https://dev.taxhive.app/luts',
      })

      expect(feedback.type).toBe('QUESTION')
      expect(feedback.userAgent).toBeNull()
    })

    it('should create feedback with OTHER type', async () => {
      const feedback = await caller.feedback.create({
        type: 'OTHER',
        message: 'Just wanted to say the app is great!',
        pageUrl: 'https://dev.taxhive.app/dashboard',
      })

      expect(feedback.type).toBe('OTHER')
    })

    it('should reject feedback with invalid type', async () => {
      await expect(
        caller.feedback.create({
          type: 'INVALID_TYPE',
          message: 'This should fail',
          pageUrl: 'https://dev.taxhive.app/dashboard',
        })
      ).rejects.toThrow()
    })

    it('should reject feedback with message too short (< 10 characters)', async () => {
      await expect(
        caller.feedback.create({
          type: 'BUG',
          message: 'Short',
          pageUrl: 'https://dev.taxhive.app/dashboard',
        })
      ).rejects.toThrow()
    })

    it('should reject feedback with message too long (> 2000 characters)', async () => {
      const longMessage = 'a'.repeat(2001)

      await expect(
        caller.feedback.create({
          type: 'BUG',
          message: longMessage,
          pageUrl: 'https://dev.taxhive.app/dashboard',
        })
      ).rejects.toThrow()
    })

    it('should reject feedback without pageUrl', async () => {
      await expect(
        caller.feedback.create({
          type: 'BUG',
          message: 'This feedback is missing pageUrl',
        })
      ).rejects.toThrow()
    })

    it('should require authentication to create feedback', async () => {
      // Create caller without session
      const unauthCtx = createTestContext(null)
      const unauthCaller = appRouter.createCaller(unauthCtx)

      await expect(
        unauthCaller.feedback.create({
          type: 'BUG',
          message: 'This should fail without authentication',
          pageUrl: 'https://dev.taxhive.app/dashboard',
        })
      ).rejects.toThrow()
    })
  })

  describe('list', () => {
    it('should return only feedback from authenticated user', async () => {
      // Create feedback for test user
      await caller.feedback.create({
        type: 'BUG',
        message: 'My bug report that is at least 10 characters long',
        pageUrl: 'https://dev.taxhive.app/invoices',
      })

      await caller.feedback.create({
        type: 'FEATURE',
        message: 'My feature request that is at least 10 characters',
        pageUrl: 'https://dev.taxhive.app/clients',
      })

      // Create another user and their feedback (should not be returned)
      const otherUser = await createTestUser()
      const otherSession: Session = {
        user: {
          id: otherUser.id,
          email: otherUser.email,
          name: otherUser.name,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
      const otherCtx = { ...ctx, session: otherSession }
      const otherCaller = appRouter.createCaller(otherCtx)

      await otherCaller.feedback.create({
        type: 'QUESTION',
        message: 'Other user question that should not appear',
        pageUrl: 'https://dev.taxhive.app/dashboard',
      })

      // List should only return test user's feedback
      const feedbackList = await caller.feedback.list()
      expect(feedbackList).toHaveLength(2)
      expect(feedbackList[0].userId).toBe(testUser.id)
      expect(feedbackList[1].userId).toBe(testUser.id)
    })

    it('should return feedback ordered by most recent first', async () => {
      // Create multiple feedback items
      const first = await caller.feedback.create({
        type: 'BUG',
        message: 'First feedback item created at least 10 chars',
        pageUrl: 'https://dev.taxhive.app/dashboard',
      })

      // Wait a tiny bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))

      const second = await caller.feedback.create({
        type: 'FEATURE',
        message: 'Second feedback item created at least 10 chars',
        pageUrl: 'https://dev.taxhive.app/dashboard',
      })

      const feedbackList = await caller.feedback.list()
      expect(feedbackList[0].id).toBe(second.id) // Most recent first
      expect(feedbackList[1].id).toBe(first.id)
    })

    it('should filter feedback by status when provided', async () => {
      // Create feedback with different statuses
      const newFeedback = await caller.feedback.create({
        type: 'BUG',
        message: 'New bug report with at least 10 characters',
        pageUrl: 'https://dev.taxhive.app/dashboard',
      })

      // Manually update status in database (since we don't have update endpoint yet)
      await prisma.feedback.update({
        where: { id: newFeedback.id },
        data: { status: 'REVIEWED' },
      })

      await caller.feedback.create({
        type: 'FEATURE',
        message: 'Another new feedback with at least 10 chars',
        pageUrl: 'https://dev.taxhive.app/dashboard',
      })

      // Filter by NEW status
      const newFeedbackList = await caller.feedback.list({ status: 'NEW' })
      expect(newFeedbackList).toHaveLength(1)
      expect(newFeedbackList[0].status).toBe('NEW')

      // Filter by REVIEWED status
      const reviewedFeedbackList = await caller.feedback.list({ status: 'REVIEWED' })
      expect(reviewedFeedbackList).toHaveLength(1)
      expect(reviewedFeedbackList[0].status).toBe('REVIEWED')
    })

    it('should limit results when limit parameter is provided', async () => {
      // Create 5 feedback items
      for (let i = 0; i < 5; i++) {
        await caller.feedback.create({
          type: 'BUG',
          message: `Feedback item ${i} with at least 10 characters`,
          pageUrl: 'https://dev.taxhive.app/dashboard',
        })
      }

      const feedbackList = await caller.feedback.list({ limit: 3 })
      expect(feedbackList).toHaveLength(3)
    })

    it('should enforce maximum limit of 100', async () => {
      // Should reject limit > 100
      await expect(
        caller.feedback.list({ limit: 150 })
      ).rejects.toThrow()

      // But 100 should work fine
      const feedbackList = await caller.feedback.list({ limit: 100 })
      expect(Array.isArray(feedbackList)).toBe(true)
    })

    it('should require authentication to list feedback', async () => {
      // Create caller without session
      const unauthCtx = createTestContext(null)
      const unauthCaller = appRouter.createCaller(unauthCtx)

      await expect(
        unauthCaller.feedback.list()
      ).rejects.toThrow()
    })
  })
})
