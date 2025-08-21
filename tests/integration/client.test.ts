import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appRouter } from '@/server/api/root'
import { createTestUser, createTestContext, cleanupDatabase } from '../utils/test-helpers'
import type { Session } from 'next-auth'

describe('Client Router', () => {
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
    
    // Use test context creator to avoid Next.js API issues
    ctx = createTestContext(session)
    
    // Create caller with context
    caller = appRouter.createCaller(ctx)
  })

  afterEach(async () => {
    await cleanupDatabase()
  })

  describe('create', () => {
    it('should create a new client', async () => {
      const client = await caller.clients.create({
        name: 'Test Company Inc',
        email: 'contact@testcompany.com',
        company: 'Test Company',
        address: '123 Test Street, Test City',
        country: 'United States',
        phone: '+1-555-0123',
        taxId: 'US123456789',
      })

      expect(client).toMatchObject({
        name: 'Test Company Inc',
        email: 'contact@testcompany.com',
        userId: testUser.id,
      })
      expect(client.id).toBeTruthy()
    })

    it('should validate email format', async () => {
      await expect(
        caller.clients.create({
          name: 'Test Company',
          email: 'invalid-email',
          address: '123 Test Street',
          country: 'United States',
        })
      ).rejects.toThrow()
    })
  })

  describe('list', () => {
    it('should return only clients for authenticated user', async () => {
      // Create client for test user
      await caller.clients.create({
        name: 'My Client',
        email: 'client@example.com',
        address: '123 Street',
        country: 'USA',
      })

      // Create another user and their client (should not be returned)
      const otherUser = await createTestUser()
      const otherCtx = { ...ctx, session: { user: { id: otherUser.id } } }
      const otherCaller = appRouter.createCaller(otherCtx)
      
      await otherCaller.clients.create({
        name: 'Other Client',
        email: 'other@example.com',
        address: '456 Avenue',
        country: 'Canada',
      })

      // List should only return test user's client
      const clients = await caller.clients.list()
      expect(clients).toHaveLength(1)
      expect(clients[0].name).toBe('My Client')
    })
  })

  describe('update', () => {
    it('should update client details', async () => {
      const client = await caller.clients.create({
        name: 'Original Name',
        email: 'original@example.com',
        address: 'Original Address',
        country: 'USA',
      })

      await caller.clients.update({
        id: client.id,
        name: 'Updated Name',
        email: 'updated@example.com',
        address: 'Updated Address',
        country: 'Canada',
        isActive: false,
      })

      const updated = await caller.clients.getById({ id: client.id })
      expect(updated.name).toBe('Updated Name')
      expect(updated.email).toBe('updated@example.com')
      expect(updated.isActive).toBe(false)
    })

    it('should not update client owned by another user', async () => {
      const client = await caller.clients.create({
        name: 'Test Client',
        email: 'test@example.com',
        address: '123 Street',
        country: 'USA',
      })

      // Try to update with different user
      const otherUser = await createTestUser()
      const otherCtx = { ...ctx, session: { user: { id: otherUser.id } } }
      const otherCaller = appRouter.createCaller(otherCtx)

      await expect(
        otherCaller.clients.update({
          id: client.id,
          name: 'Hacked Name',
          email: 'hacked@example.com',
          address: 'Hacked Address',
          country: 'Hacked Country',
          isActive: true,
        })
      ).rejects.toThrow()
    })
  })
})