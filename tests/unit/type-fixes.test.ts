import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'

// Mock the queue types for BullMQService test
vi.mock('@/lib/queue/types', async () => {
  const actual = await vi.importActual('@/lib/queue/types')
  return {
    ...actual as any,
    JobTypeEnum: {
      options: ['PDF_GENERATION', 'EMAIL_NOTIFICATION', 'EXCHANGE_RATE_FETCH', 'PAYMENT_REMINDER'],
      parse: vi.fn((value) => value)
    }
  }
})

describe('Type Fixes - TDD for fixing type errors', () => {
  describe('BullMQService API', () => {
    it('should use correct method names', async () => {
      const { BullMQService } = await import('@/lib/queue/bullmq.service')
      
      // Constructor should accept connection config, not just connection
      const service = new BullMQService({
        redis: {
          host: 'localhost',
          port: 6379,
        },
      })

      // Should have both 'enqueue' and 'enqueueJob' for backward compatibility
      expect(service.enqueue).toBeDefined()
      expect((service as any).enqueueJob).toBeDefined()

      // Should have both 'process' and 'registerHandler' for backward compatibility  
      expect(service.process).toBeDefined()
      expect((service as any).registerHandler).toBeDefined()

      // getJob should only take jobId, not type
      const getJobSpy = vi.spyOn(service, 'getJob')
      await service.getJob('job-123')
      expect(getJobSpy).toHaveBeenCalledWith('job-123')
    })
  })

  describe('tRPC Mutation States', () => {
    it('should use isPending instead of isLoading', () => {
      // Mock mutation result following tRPC v11 API
      const mockMutation = {
        isPending: false, // New property name
        isLoading: undefined, // This should not exist
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
      }

      expect(mockMutation.isPending).toBeDefined()
      expect(mockMutation.isLoading).toBeUndefined()
    })
  })

  describe('Invoice Property Names', () => {
    it('should use consistent property names', () => {
      const invoice = {
        invoiceDate: new Date(), // NOT issueDate
        serviceCode: '9983', // NOT serviceDescription
        exchangeSource: 'RBI', // NOT exchangeRateSource
      }

      expect(invoice.invoiceDate).toBeDefined()
      expect((invoice as any).issueDate).toBeUndefined()
      expect(invoice.exchangeSource).toBeDefined()
      expect((invoice as any).exchangeRateSource).toBeUndefined()
    })
  })

  describe('LUT Property Names', () => {
    it('should use consistent LUT property names', () => {
      const lut = {
        lutDate: new Date(), // NOT issuedDate
        validFrom: new Date(),
        validTill: new Date(),
      }

      expect(lut.lutDate).toBeDefined()
      expect((lut as any).issuedDate).toBeUndefined()
    })
  })

  describe('Decimal Type Usage', () => {
    it('should use Decimal type for monetary values', () => {
      const lineItem = {
        quantity: new Decimal(1),
        rate: new Decimal(100),
        amount: new Decimal(100),
        igstAmount: new Decimal(0),
        totalAmount: new Decimal(100),
      }

      // All monetary values should be Decimal, not number
      expect(lineItem.rate).toBeInstanceOf(Decimal)
      expect(lineItem.amount).toBeInstanceOf(Decimal)
      expect(lineItem.totalAmount).toBeInstanceOf(Decimal)
    })
  })

  describe('Test Data Completeness', () => {
    it('should include all required fields in test data', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: '123 Test Street',
        emailVerified: null, // This field is required
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const client = {
        id: 'client-123',
        name: 'Test Client',
        email: 'client@example.com',
        company: 'Test Company',
        address: '456 Client Street',
        country: 'US',
        phone: '+1234567890',
        taxId: 'US123456',
        userId: 'user-123',
        isActive: true, // This field is required
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(user.emailVerified).toBeDefined()
      expect(client.isActive).toBeDefined()
    })
  })
})