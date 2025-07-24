import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { BullMQService } from '@/lib/queue/bullmq.service'
import { pdfGenerationHandler } from '@/lib/queue/handlers/pdf-generation.handler'
import { prisma } from '@/lib/prisma'
import type { User, Client, Invoice, LUT } from '@prisma/client'

describe('PDF Generation Queue Integration', () => {
  let queueService: BullMQService
  let testUser: User
  let testClient: Client
  let testLut: LUT
  let testInvoice: Invoice

  beforeAll(async () => {
    // Initialize queue service
    queueService = new BullMQService({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    })

    // Register the PDF generation handler
    await queueService.registerHandler('PDF_GENERATION', pdfGenerationHandler)

    // Create test data
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        gstin: '27AAPFU0939F1ZV',
        pan: 'AAPFU0939F',
        address: 'Test Address\nMumbai, MH 400001',
      },
    })

    testClient = await prisma.client.create({
      data: {
        userId: testUser.id,
        name: 'Test Client',
        email: 'client@example.com',
        company: 'Test Company Ltd',
        address: '123 Test Street\nNew York, NY 10001',
        country: 'United States',
      },
    })

    testLut = await prisma.lUT.create({
      data: {
        userId: testUser.id,
        lutNumber: 'AD270324000123456',
        lutDate: new Date('2024-03-27'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      },
    })

    testInvoice = await prisma.invoice.create({
      data: {
        userId: testUser.id,
        clientId: testClient.id,
        lutId: testLut.id,
        invoiceNumber: 'FY24-25/001',
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'DRAFT',
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '99831130',
        currency: 'USD',
        exchangeRate: 83.5,
        exchangeSource: 'exchangerate-api.com',
        subtotal: 1000,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 1000,
        totalInINR: 83500,
      },
    })

    // Create line items
    await prisma.invoiceItem.createMany({
      data: [
        {
          invoiceId: testInvoice.id,
          description: 'IT Consulting Services',
          quantity: 40,
          rate: 25,
          amount: 1000,
          serviceCode: '99831130',
        },
      ],
    })
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: testInvoice.id } })
    await prisma.invoice.delete({ where: { id: testInvoice.id } })
    await prisma.lUT.delete({ where: { id: testLut.id } })
    await prisma.client.delete({ where: { id: testClient.id } })
    await prisma.user.delete({ where: { id: testUser.id } })

    // Close queue service
    await queueService.close()
  })

  beforeEach(async () => {
    // Clean the queue before each test
    await queueService.clean({
      grace: 0,
      status: 'completed',
    })
    await queueService.clean({
      grace: 0,
      status: 'failed',
    })
  })

  it('should successfully queue and process PDF generation job', async () => {
    // Enqueue the job
    const job = await queueService.enqueueJob('PDF_GENERATION', {
      invoiceId: testInvoice.id,
      userId: testUser.id,
    })

    expect(job).toBeDefined()
    expect(job.id).toBeTruthy()
    expect(job.type).toBe('PDF_GENERATION')
    expect(job.status).toBe('pending')
    expect(job.data).toEqual({
      invoiceId: testInvoice.id,
      userId: testUser.id,
    })

    // Wait for job to be processed
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check job status
    const completedJob = await queueService.getJob(job.id)
    
    expect(completedJob).toBeDefined()
    expect(completedJob?.status).toBe('completed')
    expect(completedJob?.result).toBeDefined()
    expect(completedJob?.result.success).toBe(true)
    expect(completedJob?.result.pdfUrl).toBeTruthy()
    expect(completedJob?.result.invoiceId).toBe(testInvoice.id)

    // Verify invoice was updated with PDF URL
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: testInvoice.id },
    })
    expect(updatedInvoice?.pdfUrl).toBe(completedJob?.result.pdfUrl)
  })

  it('should handle job with priority and delay', async () => {
    const job = await queueService.enqueueJob(
      'PDF_GENERATION',
      {
        invoiceId: testInvoice.id,
        userId: testUser.id,
      },
      {
        priority: 1,
        delay: 500,
      }
    )

    expect(job.priority).toBe(1)

    // Job should still be pending due to delay
    const immediateJob = await queueService.getJob(job.id)
    expect(immediateJob?.status).toBe('delayed')

    // Wait for delay + processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    const completedJob = await queueService.getJob(job.id)
    expect(completedJob?.status).toBe('completed')
  })

  it('should handle multiple PDF generation jobs', async () => {
    // Create another invoice
    const invoice2 = await prisma.invoice.create({
      data: {
        userId: testUser.id,
        clientId: testClient.id,
        lutId: testLut.id,
        invoiceNumber: 'FY24-25/002',
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'DRAFT',
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '99831130',
        currency: 'USD',
        exchangeRate: 83.5,
        exchangeSource: 'exchangerate-api.com',
        subtotal: 2000,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 2000,
        totalInINR: 167000,
      },
    })

    // Enqueue multiple jobs
    const jobs = await Promise.all([
      queueService.enqueueJob('PDF_GENERATION', {
        invoiceId: testInvoice.id,
        userId: testUser.id,
      }),
      queueService.enqueueJob('PDF_GENERATION', {
        invoiceId: invoice2.id,
        userId: testUser.id,
      }),
    ])

    expect(jobs).toHaveLength(2)

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check both jobs completed
    const [job1, job2] = await Promise.all([
      queueService.getJob(jobs[0].id),
      queueService.getJob(jobs[1].id),
    ])

    expect(job1?.status).toBe('completed')
    expect(job2?.status).toBe('completed')

    // Clean up
    await prisma.invoice.delete({ where: { id: invoice2.id } })
  })

  it('should retrieve job statistics', async () => {
    // Enqueue some jobs
    await Promise.all([
      queueService.enqueueJob('PDF_GENERATION', {
        invoiceId: testInvoice.id,
        userId: testUser.id,
      }),
      queueService.enqueueJob('PDF_GENERATION', {
        invoiceId: testInvoice.id,
        userId: testUser.id,
      }, { delay: 5000 }),
    ])

    const stats = await queueService.getStats()

    expect(stats).toBeDefined()
    expect(stats.pending).toBeGreaterThanOrEqual(1)
    expect(stats.delayed).toBeGreaterThanOrEqual(1)
    expect(stats.paused).toBe(false)
  })

  it('should retrieve jobs with filters', async () => {
    // Enqueue a job
    await queueService.enqueueJob('PDF_GENERATION', {
      invoiceId: testInvoice.id,
      userId: testUser.id,
    })

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get completed PDF generation jobs
    const jobs = await queueService.getJobs({
      type: 'PDF_GENERATION',
      status: ['completed'],
      limit: 10,
    })

    expect(jobs.length).toBeGreaterThan(0)
    expect(jobs[0].type).toBe('PDF_GENERATION')
    expect(jobs[0].status).toBe('completed')
  })

  it('should handle job failure and retry', async () => {
    // Create an invoice without line items to cause failure
    const failingInvoice = await prisma.invoice.create({
      data: {
        userId: testUser.id,
        clientId: testClient.id,
        lutId: testLut.id,
        invoiceNumber: 'FY24-25/999',
        invoiceDate: new Date(),
        dueDate: new Date(),
        status: 'DRAFT',
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '99831130',
        currency: 'USD',
        exchangeRate: 83.5,
        exchangeSource: 'exchangerate-api.com',
        subtotal: 0,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 0,
        totalInINR: 0,
      },
    })

    const job = await queueService.enqueueJob('PDF_GENERATION', {
      invoiceId: failingInvoice.id,
      userId: testUser.id,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 100,
      },
    })

    // Wait for job to fail
    await new Promise(resolve => setTimeout(resolve, 2000))

    const failedJob = await queueService.getJob(job.id)
    expect(failedJob?.status).toBe('failed')
    expect(failedJob?.attempts).toBeGreaterThan(0)
    expect(failedJob?.error).toBeDefined()

    // Clean up
    await prisma.invoice.delete({ where: { id: failingInvoice.id } })
  })

  it('should clean old completed jobs', async () => {
    // Enqueue and complete a job
    const job = await queueService.enqueueJob('PDF_GENERATION', {
      invoiceId: testInvoice.id,
      userId: testUser.id,
    })

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Clean completed jobs with 0 grace period
    const cleaned = await queueService.clean({
      grace: 0,
      status: 'completed',
    })

    expect(cleaned).toBeGreaterThan(0)

    // Job should no longer exist
    const deletedJob = await queueService.getJob(job.id)
    expect(deletedJob).toBeNull()
  })
})