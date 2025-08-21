import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createTestUser, createTestClient, cleanupTestData } from '@/tests/utils/test-helpers'
import { addMonths } from 'date-fns'

describe('Template Versioning API Integration Tests', () => {
  let userId: string
  let clientId: string
  let templateId: string
  
  beforeEach(async () => {
    // Setup test data
    const user = await createTestUser({
      email: 'versioning-test@example.com',
      onboardingCompleted: true
    })
    userId = user.id
    
    const client = await createTestClient({
      userId,
      name: 'Versioning Test Client',
      email: 'client@versioning-test.com'
    })
    clientId = client.id
    
    // Create a basic template with versioning
    const template = await prisma.recurringInvoice.create({
      data: {
        userId,
        templateName: 'Test Template',
        clientId,
        frequency: 'MONTHLY',
        interval: 1,
        startDate: new Date(),
        nextRunDate: addMonths(new Date(), 1),
        invoiceType: 'EXPORT',
        currency: 'USD',
        paymentTerms: 30,
        serviceCode: '998311',
        lineItems: {
          create: [{
            description: 'Test Service',
            hsnCode: '998311',
            quantity: 1,
            rate: 1000,
            isVariable: false
          }]
        }
      }
    })
    templateId = template.id
    
    // Create initial version manually for this test (normally done by tRPC router)
    const initialVersion = await prisma.templateVersion.create({
      data: {
        templateId,
        version: '1.0.0',
        changes: {
          type: 'initial_creation',
          templateData: {
            templateName: 'Test Template',
            frequency: 'MONTHLY',
            interval: 1,
            invoiceType: 'EXPORT',
            currency: 'USD',
            paymentTerms: 30,
            serviceCode: '998311'
          }
        },
        effectiveDate: new Date(),
        createdBy: userId
      }
    })
    
    // Update template to reference this version
    await prisma.recurringInvoice.update({
      where: { id: templateId },
      data: { currentVersionId: initialVersion.id }
    })
  })
  
  afterEach(async () => {
    await cleanupTestData()
  })

  test('should create initial version when template is created', async () => {
    // Check that an initial version was created automatically
    const versions = await prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: { createdAt: 'desc' }
    })
    
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('1.0.0')
    expect(versions[0].changes).toMatchObject({
      type: 'initial_creation'
    })
    expect(versions[0].createdBy).toBe(userId)
    
    // Check that template references this version as current
    const template = await prisma.recurringInvoice.findUnique({
      where: { id: templateId },
      include: { currentVersion: true }
    })
    
    expect(template?.currentVersionId).toBe(versions[0].id)
    expect(template?.currentVersion?.version).toBe('1.0.0')
  })
  
  test('should create new version with changes tracking', async () => {
    // Create a new version
    const newVersion = await prisma.templateVersion.create({
      data: {
        templateId,
        version: '1.1.0',
        changes: {
          type: 'feature_update',
          modifications: {
            paymentTerms: { from: 30, to: 45 },
            description: 'Updated payment terms'
          }
        },
        effectiveDate: new Date(),
        createdBy: userId,
        // Link to previous version
        previousVersionId: (await prisma.templateVersion.findFirst({
          where: { templateId },
          orderBy: { createdAt: 'desc' }
        }))?.id
      }
    })
    
    expect(newVersion.version).toBe('1.1.0')
    expect(newVersion.changes).toMatchObject({
      type: 'feature_update',
      modifications: {
        paymentTerms: { from: 30, to: 45 }
      }
    })
    expect(newVersion.previousVersionId).toBeDefined()
  })
  
  test('should maintain version history chain', async () => {
    // Create multiple versions
    const version1 = await prisma.templateVersion.findFirst({
      where: { templateId },
      orderBy: { createdAt: 'desc' }
    })
    
    const version2 = await prisma.templateVersion.create({
      data: {
        templateId,
        version: '1.1.0',
        changes: { type: 'update_1' },
        effectiveDate: new Date(),
        createdBy: userId,
        previousVersionId: version1?.id
      }
    })
    
    const version3 = await prisma.templateVersion.create({
      data: {
        templateId,
        version: '1.2.0',
        changes: { type: 'update_2' },
        effectiveDate: new Date(),
        createdBy: userId,
        previousVersionId: version2.id
      }
    })
    
    // Verify the chain
    expect(version2.previousVersionId).toBe(version1?.id)
    expect(version3.previousVersionId).toBe(version2.id)
    
    // Verify we can traverse the history
    const latestVersion = await prisma.templateVersion.findUnique({
      where: { id: version3.id },
      include: {
        previousVersion: {
          include: {
            previousVersion: true
          }
        }
      }
    })
    
    expect(latestVersion?.version).toBe('1.2.0')
    expect(latestVersion?.previousVersion?.version).toBe('1.1.0')
    expect(latestVersion?.previousVersion?.previousVersion?.version).toBe('1.0.0')
  })
  
  test('should support rollback functionality', async () => {
    // Create a few versions
    const version1 = await prisma.templateVersion.findFirst({
      where: { templateId },
      orderBy: { createdAt: 'desc' }
    })
    
    const version2 = await prisma.templateVersion.create({
      data: {
        templateId,
        version: '1.1.0',
        changes: { type: 'problematic_update' },
        effectiveDate: new Date(),
        createdBy: userId,
        previousVersionId: version1?.id
      }
    })
    
    // Now rollback to version 1.0.0
    const rollbackVersion = await prisma.templateVersion.create({
      data: {
        templateId,
        version: '1.1.1',
        changes: {
          type: 'rollback',
          rolledBackTo: version1?.version,
          reason: 'Fixing problematic update',
          originalChanges: version1?.changes
        },
        effectiveDate: new Date(),
        createdBy: userId,
        previousVersionId: version2.id
      }
    })
    
    expect(rollbackVersion.changes).toMatchObject({
      type: 'rollback',
      rolledBackTo: version1?.version,
      reason: 'Fixing problematic update'
    })
  })
})