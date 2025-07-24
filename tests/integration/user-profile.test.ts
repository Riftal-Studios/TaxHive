import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appRouter } from '@/server/api/root'
import { createTestUser, cleanupDatabase, createTestContext } from '../utils/test-helpers'
import type { Session } from 'next-auth'

describe('User Profile Integration', () => {
  let testUser: any
  let ctx: any
  let caller: any

  beforeEach(async () => {
    // Create test user
    testUser = await createTestUser({
      name: 'Test User',
      email: 'test@example.com',
      gstin: null,
      pan: null,
      address: null,
    })
    
    // Create context with authenticated session
    const session: Session = {
      user: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }
    
    ctx = createTestContext(session)
    
    // Create caller with context
    caller = appRouter.createCaller(ctx)
  })

  afterEach(async () => {
    await cleanupDatabase()
  })

  describe('getProfile', () => {
    it('should return user profile with empty GST details', async () => {
      const profile = await caller.users.getProfile()
      
      expect(profile).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        name: 'Test User',
        gstin: null,
        pan: null,
        address: null,
      })
    })

    it('should return active LUTs with profile', async () => {
      // Create an active LUT
      await ctx.prisma.lUT.create({
        data: {
          userId: testUser.id,
          lutNumber: 'LUT/2024/001',
          lutDate: new Date('2024-01-01'),
          validFrom: new Date('2024-01-01'),
          validTill: new Date('2025-12-31'),
          isActive: true,
        },
      })

      const profile = await caller.users.getProfile()
      
      expect(profile.luts).toHaveLength(1)
      expect(profile.luts[0]).toMatchObject({
        lutNumber: 'LUT/2024/001',
        isActive: true,
      })
    })
  })

  describe('updateProfile', () => {
    it('should update profile with valid GSTIN and PAN', async () => {
      const updateData = {
        name: 'Updated Name',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: '123 Business St, Bangalore, Karnataka 560001',
      }

      const updated = await caller.users.updateProfile(updateData)
      
      expect(updated).toMatchObject(updateData)
      
      // Verify database was updated
      const dbUser = await ctx.prisma.user.findUnique({
        where: { id: testUser.id },
      })
      
      expect(dbUser).toMatchObject(updateData)
    })

    it('should convert GSTIN and PAN to uppercase', async () => {
      const updateData = {
        gstin: '29abcde1234f1z5',
        pan: 'abcde1234f',
      }

      const updated = await caller.users.updateProfile(updateData)
      
      expect(updated.gstin).toBe('29ABCDE1234F1Z5')
      expect(updated.pan).toBe('ABCDE1234F')
    })

    it('should trim whitespace from all fields', async () => {
      const updateData = {
        name: '  Test User  ',
        gstin: '  29ABCDE1234F1Z5  ',
        pan: '  ABCDE1234F  ',
        address: '  123 Test St  ',
      }

      const updated = await caller.users.updateProfile(updateData)
      
      expect(updated.name).toBe('Test User')
      expect(updated.gstin).toBe('29ABCDE1234F1Z5')
      expect(updated.pan).toBe('ABCDE1234F')
      expect(updated.address).toBe('123 Test St')
    })

    it('should allow empty GSTIN and PAN', async () => {
      const updateData = {
        gstin: '',
        pan: '',
      }

      const updated = await caller.users.updateProfile(updateData)
      
      expect(updated.gstin).toBe('')
      expect(updated.pan).toBe('')
    })

    it('should reject invalid GSTIN format', async () => {
      const updateData = {
        gstin: 'INVALID_GSTIN',
      }

      await expect(caller.users.updateProfile(updateData))
        .rejects.toThrow('Invalid GSTIN format')
    })

    it('should reject invalid PAN format', async () => {
      const updateData = {
        pan: 'INVALID',
      }

      await expect(caller.users.updateProfile(updateData))
        .rejects.toThrow('Invalid PAN format')
    })

    it('should reject mismatched PAN when GSTIN is provided', async () => {
      const updateData = {
        gstin: '29ABCDE1234F1Z5',
        pan: 'ZZZZZ9999Z', // Different PAN than in GSTIN
      }

      await expect(caller.users.updateProfile(updateData))
        .rejects.toThrow('PAN does not match the PAN in GSTIN')
    })

    it('should accept matching PAN when GSTIN is provided', async () => {
      const updateData = {
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F', // Same PAN as in GSTIN
      }

      const updated = await caller.users.updateProfile(updateData)
      
      expect(updated).toMatchObject(updateData)
    })

    it('should update only provided fields', async () => {
      // First set some initial values
      await caller.users.updateProfile({
        name: 'Initial Name',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: 'Initial Address',
      })

      // Update only name and address
      const partialUpdate = {
        name: 'New Name',
        address: 'New Address',
      }

      const updated = await caller.users.updateProfile(partialUpdate)
      
      expect(updated.name).toBe('New Name')
      expect(updated.address).toBe('New Address')
      expect(updated.gstin).toBe('29ABCDE1234F1Z5') // Unchanged
      expect(updated.pan).toBe('ABCDE1234F') // Unchanged
    })
  })

  describe('Authentication', () => {
    it('should require authentication for getProfile', async () => {
      const unauthCtx = createTestContext(null)
      
      const unauthCaller = appRouter.createCaller(unauthCtx)
      
      await expect(unauthCaller.users.getProfile())
        .rejects.toThrow('UNAUTHORIZED')
    })

    it('should require authentication for updateProfile', async () => {
      const unauthCtx = createTestContext(null)
      
      const unauthCaller = appRouter.createCaller(unauthCtx)
      
      await expect(unauthCaller.users.updateProfile({ name: 'Test' }))
        .rejects.toThrow('UNAUTHORIZED')
    })
  })
})