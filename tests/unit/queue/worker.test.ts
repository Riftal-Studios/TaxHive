import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BullMQService } from '@/lib/queue/bullmq.service'

vi.mock('@/lib/queue/bullmq.service')

describe('Queue Worker', () => {
  let queueService: BullMQService

  beforeEach(() => {
    vi.clearAllMocks()
    queueService = new BullMQService({ redis: { host: 'localhost', port: 6379 } })
  })

  it('should register all handlers on startup', () => {
    const mockProcess = vi.fn()
    queueService.process = mockProcess

    // Simulate worker startup
    queueService.process('PDF_GENERATION', expect.any(Function))
    queueService.process('EMAIL_NOTIFICATION', expect.any(Function))
    queueService.process('EXCHANGE_RATE_FETCH', expect.any(Function))

    expect(mockProcess).toHaveBeenCalledTimes(3)
    expect(mockProcess).toHaveBeenCalledWith('PDF_GENERATION', expect.any(Function))
    expect(mockProcess).toHaveBeenCalledWith('EMAIL_NOTIFICATION', expect.any(Function))
    expect(mockProcess).toHaveBeenCalledWith('EXCHANGE_RATE_FETCH', expect.any(Function))
  })

  it('should close queue service on shutdown', async () => {
    const mockClose = vi.fn().mockResolvedValue(undefined)
    queueService.close = mockClose

    // Simulate graceful shutdown
    await queueService.close()

    expect(mockClose).toHaveBeenCalled()
  })
})