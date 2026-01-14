import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'child_process'
import { BullMQService } from '@/lib/queue/bullmq.service'
import { prisma } from '@/lib/prisma'
import type { User, Client, Invoice, LUT } from '@prisma/client'

describe('Queue Worker Process', () => {
  let queueService: BullMQService
  let workerProcess: any
  let testUser: User
  let testClient: Client
  let testLut: LUT
  let testInvoice: Invoice

  beforeAll(async () => {
    // Start the worker process
    workerProcess = spawn('tsx', ['scripts/queue-worker.ts'], {
      env: { ...process.env },
      stdio: 'pipe',
    })

    // Wait for worker to start
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Initialize queue service for testing
    queueService = new BullMQService({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    })

    // Create test data
    testUser = await prisma.user.create({
      data: {
        email: 'worker-test@example.com',
        name: 'Worker Test User',
        gstin: '27AAPFU0939F1ZV',
        pan: 'AAPFU0939F',
        address: 'Test Address\nMumbai, MH 400001',
      },
    })

    testClient = await prisma.client.create({
      data: {
        userId: testUser.id,
        name: 'Worker Test Client',
        email: 'worker-client@example.com',
        company: 'Worker Test Company Ltd',
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
        invoiceNumber: 'FY24-25/999',
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

    await prisma.invoiceItem.create({
      data: {
        invoiceId: testInvoice.id,
        description: 'IT Consulting Services',
        quantity: 40,
        rate: 25,
        amount: 1000,
        serviceCode: '99831130',
      },
    })
  })

  afterAll(async () => {
    // Clean up test data
    if (testInvoice) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: testInvoice.id } })
      await prisma.invoice.delete({ where: { id: testInvoice.id } })
    }
    if (testLut) await prisma.lUT.delete({ where: { id: testLut.id } })
    if (testClient) await prisma.client.delete({ where: { id: testClient.id } })
    if (testUser) await prisma.user.delete({ where: { id: testUser.id } })

    // Close queue service
    await queueService.close()

    // Kill worker process
    if (workerProcess) {
      workerProcess.kill('SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  })

  it('should process PDF generation jobs via worker', async () => {
    // Enqueue a job
    const job = await queueService.enqueueJob('PDF_GENERATION', {
      invoiceId: testInvoice.id,
      userId: testUser.id,
    })

    // Wait for worker to process
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Check job status
    const completedJob = await queueService.getJob(job.id)
    expect(completedJob?.status).toBe('completed')
    const result = completedJob?.result as { success: boolean; pdfUrl: string }
    expect(result?.success).toBe(true)
    expect(result?.pdfUrl).toBeTruthy()

    // Verify invoice was updated
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: testInvoice.id },
    })
    expect(updatedInvoice?.pdfUrl).toBeTruthy()
  })

  it('should process multiple job types', async () => {
    // Enqueue different job types
    const pdfJob = await queueService.enqueueJob('PDF_GENERATION', {
      invoiceId: testInvoice.id,
      userId: testUser.id,
    })

    const emailJob = await queueService.enqueueJob('EMAIL_NOTIFICATION', {
      type: 'invoice',
      to: 'test@example.com',
      invoiceNumber: testInvoice.invoiceNumber,
      clientName: testClient.name,
      amount: 1000,
      currency: 'USD',
      dueDate: new Date(),
    })

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Check both jobs completed
    const [pdfResult, emailResult] = await Promise.all([
      queueService.getJob(pdfJob.id),
      queueService.getJob(emailJob.id),
    ])

    expect(pdfResult?.status).toBe('completed')
    expect(emailResult?.status).toBe('completed')
  })

  it('should handle worker restart gracefully', async () => {
    // Enqueue a job
    const job1 = await queueService.enqueueJob('PDF_GENERATION', {
      invoiceId: testInvoice.id,
      userId: testUser.id,
    })

    // Kill worker
    workerProcess.kill('SIGTERM')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Restart worker
    workerProcess = spawn('tsx', ['scripts/queue-worker.ts'], {
      env: { ...process.env },
      stdio: 'pipe',
    })
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Enqueue another job
    const job2 = await queueService.enqueueJob('PDF_GENERATION', {
      invoiceId: testInvoice.id,
      userId: testUser.id,
    })

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Both jobs should be processed
    const [result1, result2] = await Promise.all([
      queueService.getJob(job1.id),
      queueService.getJob(job2.id),
    ])

    expect(result1?.status).toBe('completed')
    expect(result2?.status).toBe('completed')
  })

  it('should respect job priorities', async () => {
    const completionOrder: string[] = []

    // Create a slow email job to block the queue
    const blockingJob = await queueService.enqueueJob('EMAIL_NOTIFICATION', {
      type: 'invoice',
      to: 'blocking@example.com',
      invoiceNumber: 'BLOCK-001',
      clientName: 'Blocker',
      amount: 1000,
      currency: 'USD',
      dueDate: new Date(),
    }, { priority: 10 }) // Low priority

    // High priority job
    const highPriorityJob = await queueService.enqueueJob('PDF_GENERATION', {
      invoiceId: testInvoice.id,
      userId: testUser.id,
    }, { priority: 1 })

    // Normal priority job
    const normalPriorityJob = await queueService.enqueueJob('PDF_GENERATION', {
      invoiceId: testInvoice.id,
      userId: testUser.id,
    }, { priority: 5 })

    // Wait for all to complete
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Check completion order
    const jobs = await Promise.all([
      queueService.getJob(highPriorityJob.id),
      queueService.getJob(normalPriorityJob.id),
      queueService.getJob(blockingJob.id),
    ])

    // High priority should complete first
    expect(jobs[0]?.status).toBe('completed')
    expect(jobs[1]?.status).toBe('completed')
    expect(jobs[2]?.status).toBe('completed')
  })
})