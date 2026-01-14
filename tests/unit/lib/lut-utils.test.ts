import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { LUT } from '@prisma/client'
import {
  isLUTValid,
  daysUntilLUTExpiry,
  shouldSendLUTReminder,
  getLUTStatus,
  getLUTExpiryWarning,
  getActiveLUTForInvoice,
} from '@/lib/lut-utils'

describe('LUT Utilities', () => {
  // Helper to create a mock LUT
  const createMockLUT = (overrides: Partial<LUT> = {}): LUT => ({
    id: 'lut-1',
    userId: 'user-1',
    lutNumber: 'AD290124000001',
    lutDate: new Date('2024-01-01'),
    validFrom: new Date('2024-04-01'),
    validTill: new Date('2025-03-31'),
    isActive: true,
    reminderSentAt: null,
    renewalReminderSentAt: null,
    previousLutId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  describe('isLUTValid', () => {
    it('should return true for valid LUT within date range', () => {
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })
      const invoiceDate = new Date('2024-06-15')

      expect(isLUTValid(lut, invoiceDate)).toBe(true)
    })

    it('should return true for invoice date on validFrom date', () => {
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })
      const invoiceDate = new Date('2024-04-01')

      expect(isLUTValid(lut, invoiceDate)).toBe(true)
    })

    it('should return true for invoice date on validTill date', () => {
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })
      const invoiceDate = new Date('2025-03-31')

      expect(isLUTValid(lut, invoiceDate)).toBe(true)
    })

    it('should return false for invoice date before validFrom', () => {
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })
      const invoiceDate = new Date('2024-03-15')

      expect(isLUTValid(lut, invoiceDate)).toBe(false)
    })

    it('should return false for invoice date after validTill', () => {
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })
      const invoiceDate = new Date('2025-04-01')

      expect(isLUTValid(lut, invoiceDate)).toBe(false)
    })

    it('should return false for inactive LUT', () => {
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
        isActive: false,
      })
      const invoiceDate = new Date('2024-06-15')

      expect(isLUTValid(lut, invoiceDate)).toBe(false)
    })
  })

  describe('daysUntilLUTExpiry', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return positive days for future expiry', () => {
      vi.setSystemTime(new Date('2025-03-01'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
      })

      expect(daysUntilLUTExpiry(lut)).toBe(30)
    })

    it('should return 0 for expiry today', () => {
      vi.setSystemTime(new Date('2025-03-31'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
      })

      expect(daysUntilLUTExpiry(lut)).toBe(0)
    })

    it('should return negative days for expired LUT', () => {
      vi.setSystemTime(new Date('2025-04-10'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
      })

      expect(daysUntilLUTExpiry(lut)).toBe(-10)
    })

    it('should handle leap years correctly', () => {
      vi.setSystemTime(new Date('2024-02-28'))
      const lut = createMockLUT({
        validTill: new Date('2024-03-01'),
      })

      expect(daysUntilLUTExpiry(lut)).toBe(2) // Feb 28 -> Feb 29 -> Mar 1
    })
  })

  describe('shouldSendLUTReminder', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return true when LUT expires within 30 days and no reminder sent', () => {
      vi.setSystemTime(new Date('2025-03-10'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
        reminderSentAt: null,
      })

      expect(shouldSendLUTReminder(lut)).toBe(true)
    })

    it('should return false when reminder already sent', () => {
      vi.setSystemTime(new Date('2025-03-10'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
        reminderSentAt: new Date('2025-03-01'),
      })

      expect(shouldSendLUTReminder(lut)).toBe(false)
    })

    it('should return false when LUT expires in more than 30 days', () => {
      vi.setSystemTime(new Date('2025-01-01'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
        reminderSentAt: null,
      })

      expect(shouldSendLUTReminder(lut)).toBe(false)
    })

    it('should return false for already expired LUT', () => {
      vi.setSystemTime(new Date('2025-04-15'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
        reminderSentAt: null,
      })

      expect(shouldSendLUTReminder(lut)).toBe(false)
    })

    it('should return false for inactive LUT', () => {
      vi.setSystemTime(new Date('2025-03-10'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
        reminderSentAt: null,
        isActive: false,
      })

      expect(shouldSendLUTReminder(lut)).toBe(false)
    })
  })

  describe('getLUTStatus', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return "valid" for LUT expiring in more than 30 days', () => {
      vi.setSystemTime(new Date('2025-01-15'))
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })

      expect(getLUTStatus(lut)).toBe('valid')
    })

    it('should return "expiring" for LUT expiring within 30 days', () => {
      vi.setSystemTime(new Date('2025-03-15'))
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })

      expect(getLUTStatus(lut)).toBe('expiring')
    })

    it('should return "expired" for expired LUT', () => {
      vi.setSystemTime(new Date('2025-04-15'))
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })

      expect(getLUTStatus(lut)).toBe('expired')
    })

    it('should return "expired" for LUT that expired today', () => {
      vi.setSystemTime(new Date('2025-04-01'))
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })

      expect(getLUTStatus(lut)).toBe('expired')
    })

    it('should return "not_started" for LUT that has not started yet', () => {
      vi.setSystemTime(new Date('2024-03-01'))
      const lut = createMockLUT({
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      })

      expect(getLUTStatus(lut)).toBe('not_started')
    })
  })

  describe('getLUTExpiryWarning', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return null for valid LUT expiring in more than 30 days', () => {
      vi.setSystemTime(new Date('2025-01-15'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
      })

      expect(getLUTExpiryWarning(lut)).toBeNull()
    })

    it('should return warning message for LUT expiring within 30 days', () => {
      vi.setSystemTime(new Date('2025-03-15'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
      })

      const warning = getLUTExpiryWarning(lut)
      expect(warning).not.toBeNull()
      expect(warning?.type).toBe('warning')
      expect(warning?.message).toContain('16 days')
    })

    it('should return error message for expired LUT', () => {
      vi.setSystemTime(new Date('2025-04-15'))
      const lut = createMockLUT({
        validTill: new Date('2025-03-31'),
      })

      const warning = getLUTExpiryWarning(lut)
      expect(warning).not.toBeNull()
      expect(warning?.type).toBe('error')
      expect(warning?.message).toContain('expired')
    })

    it('should include LUT number in the warning', () => {
      vi.setSystemTime(new Date('2025-03-15'))
      const lut = createMockLUT({
        lutNumber: 'AD290124000001',
        validTill: new Date('2025-03-31'),
      })

      const warning = getLUTExpiryWarning(lut)
      expect(warning?.message).toContain('AD290124000001')
    })
  })

  describe('getActiveLUTForInvoice', () => {
    it('should return null when no LUTs provided', () => {
      const result = getActiveLUTForInvoice([], new Date('2024-06-15'))
      expect(result).toBeNull()
    })

    it('should return the valid active LUT for the invoice date', () => {
      const luts = [
        createMockLUT({
          id: 'lut-1',
          validFrom: new Date('2024-04-01'),
          validTill: new Date('2025-03-31'),
          isActive: true,
        }),
        createMockLUT({
          id: 'lut-2',
          validFrom: new Date('2023-04-01'),
          validTill: new Date('2024-03-31'),
          isActive: false,
        }),
      ]

      const result = getActiveLUTForInvoice(luts, new Date('2024-06-15'))
      expect(result?.id).toBe('lut-1')
    })

    it('should return null when no active LUT covers the invoice date', () => {
      const luts = [
        createMockLUT({
          id: 'lut-1',
          validFrom: new Date('2024-04-01'),
          validTill: new Date('2025-03-31'),
          isActive: false, // Not active
        }),
      ]

      const result = getActiveLUTForInvoice(luts, new Date('2024-06-15'))
      expect(result).toBeNull()
    })

    it('should return null when active LUT does not cover invoice date', () => {
      const luts = [
        createMockLUT({
          id: 'lut-1',
          validFrom: new Date('2024-04-01'),
          validTill: new Date('2025-03-31'),
          isActive: true,
        }),
      ]

      const result = getActiveLUTForInvoice(luts, new Date('2023-06-15'))
      expect(result).toBeNull()
    })
  })
})
