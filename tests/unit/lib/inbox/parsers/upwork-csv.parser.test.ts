import { describe, it, expect } from 'vitest'
import {
  parseUpworkCSV,
  parseUpworkRow,
  aggregateUpworkEarnings,
  type UpworkTransaction,
} from '@/lib/inbox/parsers/upwork-csv.parser'

describe('Upwork CSV Parser', () => {
  describe('parseUpworkCSV', () => {
    it('should parse valid Upwork CSV data', () => {
      const csvContent = `Date,Type,Description,Amount
01/15/2024,Hourly,Payment from Acme Corp - Fixed Price,500.00
01/16/2024,Hourly,Payment from XYZ Inc - Hourly,250.00
01/17/2024,Service Fee,Upwork Service Fee,-75.00`

      const result = parseUpworkCSV(csvContent)

      expect(result.success).toBe(true)
      expect(result.transactions).toHaveLength(3)
      expect(result.transactions?.[0]).toMatchObject({
        date: expect.any(Date),
        type: 'Hourly',
        description: 'Payment from Acme Corp - Fixed Price',
        amount: 500.00,
      })
    })

    it('should handle empty CSV', () => {
      const result = parseUpworkCSV('')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle CSV with only headers', () => {
      const csvContent = 'Date,Type,Description,Amount'
      const result = parseUpworkCSV(csvContent)
      expect(result.success).toBe(true)
      expect(result.transactions).toHaveLength(0)
    })

    it('should skip invalid rows gracefully', () => {
      const csvContent = `Date,Type,Description,Amount
01/15/2024,Hourly,Valid Payment,500.00
invalid,row,data
01/16/2024,Hourly,Another Valid Payment,250.00`

      const result = parseUpworkCSV(csvContent)

      expect(result.success).toBe(true)
      expect(result.transactions).toHaveLength(2)
      expect(result.warnings).toContain('Skipped 1 invalid row(s)')
    })

    it('should handle different date formats', () => {
      // Test the common formats
      const csvContent = `Date,Type,Description,Amount
2024-01-15,Hourly,ISO Date Payment,500.00
01/15/2024,Hourly,US Date Payment,250.00
15/01/2024,Hourly,EU Date Payment,100.00`

      const result = parseUpworkCSV(csvContent)

      expect(result.success).toBe(true)
      expect(result.transactions).toHaveLength(3)
      // All dates should be parsed correctly to January 15
      result.transactions?.forEach(t => {
        expect(t.date).toBeInstanceOf(Date)
        expect(t.date.getMonth()).toBe(0) // January
        expect(t.date.getDate()).toBe(15)
        expect(t.date.getFullYear()).toBe(2024)
      })
    })

    it('should handle negative amounts (fees, refunds)', () => {
      const csvContent = `Date,Type,Description,Amount
01/15/2024,Service Fee,Upwork Service Fee,-75.00
01/15/2024,Withdrawal Fee,Payment Method Fee,-0.99`

      const result = parseUpworkCSV(csvContent)

      expect(result.success).toBe(true)
      expect(result.transactions?.[0].amount).toBe(-75.00)
      expect(result.transactions?.[1].amount).toBe(-0.99)
    })

    it('should handle amounts with currency symbols', () => {
      const csvContent = `Date,Type,Description,Amount
01/15/2024,Hourly,Payment,$500.00
01/16/2024,Hourly,Another Payment,"$1,250.00"`

      const result = parseUpworkCSV(csvContent)

      expect(result.success).toBe(true)
      expect(result.transactions?.[0].amount).toBe(500.00)
      expect(result.transactions?.[1].amount).toBe(1250.00)
    })
  })

  describe('parseUpworkRow', () => {
    it('should parse a valid row', () => {
      const row = {
        Date: '01/15/2024',
        Type: 'Hourly',
        Description: 'Payment from Client',
        Amount: '500.00',
      }

      const result = parseUpworkRow(row)

      expect(result).toMatchObject({
        date: expect.any(Date),
        type: 'Hourly',
        description: 'Payment from Client',
        amount: 500.00,
      })
    })

    it('should return null for invalid row', () => {
      const row = {
        Date: 'invalid-date',
        Type: 'Hourly',
        Description: 'Payment',
        Amount: 'not-a-number',
      }

      const result = parseUpworkRow(row)
      expect(result).toBeNull()
    })

    it('should extract client name from description', () => {
      const row = {
        Date: '01/15/2024',
        Type: 'Fixed Price',
        Description: 'Payment from Acme Corporation - Fixed Price',
        Amount: '1000.00',
      }

      const result = parseUpworkRow(row)
      expect(result?.clientName).toBe('Acme Corporation')
    })
  })

  describe('aggregateUpworkEarnings', () => {
    it('should calculate total earnings (excluding fees)', () => {
      const transactions: UpworkTransaction[] = [
        { date: new Date('2024-01-15'), type: 'Hourly', description: 'Payment 1', amount: 500, isEarning: true },
        { date: new Date('2024-01-16'), type: 'Fixed Price', description: 'Payment 2', amount: 1000, isEarning: true },
        { date: new Date('2024-01-17'), type: 'Service Fee', description: 'Fee', amount: -150, isEarning: false },
      ]

      const result = aggregateUpworkEarnings(transactions)

      expect(result.totalEarnings).toBe(1500)
      expect(result.totalFees).toBe(150)
      expect(result.netAmount).toBe(1350)
    })

    it('should group earnings by client', () => {
      const transactions: UpworkTransaction[] = [
        { date: new Date('2024-01-15'), type: 'Hourly', description: 'Payment', amount: 500, clientName: 'Acme Corp', isEarning: true },
        { date: new Date('2024-01-16'), type: 'Hourly', description: 'Payment', amount: 300, clientName: 'Acme Corp', isEarning: true },
        { date: new Date('2024-01-17'), type: 'Fixed Price', description: 'Payment', amount: 1000, clientName: 'XYZ Inc', isEarning: true },
      ]

      const result = aggregateUpworkEarnings(transactions)

      expect(result.byClient['Acme Corp']).toBe(800)
      expect(result.byClient['XYZ Inc']).toBe(1000)
    })

    it('should calculate date range', () => {
      const transactions: UpworkTransaction[] = [
        { date: new Date('2024-01-15'), type: 'Hourly', description: 'P1', amount: 500, isEarning: true },
        { date: new Date('2024-01-20'), type: 'Hourly', description: 'P2', amount: 300, isEarning: true },
        { date: new Date('2024-01-10'), type: 'Hourly', description: 'P3', amount: 200, isEarning: true },
      ]

      const result = aggregateUpworkEarnings(transactions)

      expect(result.startDate).toEqual(new Date('2024-01-10'))
      expect(result.endDate).toEqual(new Date('2024-01-20'))
    })

    it('should return zero for empty transactions', () => {
      const result = aggregateUpworkEarnings([])

      expect(result.totalEarnings).toBe(0)
      expect(result.totalFees).toBe(0)
      expect(result.netAmount).toBe(0)
    })

    it('should identify transaction types', () => {
      const transactions: UpworkTransaction[] = [
        { date: new Date('2024-01-15'), type: 'Hourly', description: 'Payment', amount: 500, isEarning: true },
        { date: new Date('2024-01-16'), type: 'Fixed Price', description: 'Payment', amount: 1000, isEarning: true },
        { date: new Date('2024-01-17'), type: 'Bonus', description: 'Bonus payment', amount: 100, isEarning: true },
        { date: new Date('2024-01-18'), type: 'Service Fee', description: 'Fee', amount: -160, isEarning: false },
      ]

      const result = aggregateUpworkEarnings(transactions)

      expect(result.byType['Hourly']).toBe(500)
      expect(result.byType['Fixed Price']).toBe(1000)
      expect(result.byType['Bonus']).toBe(100)
    })
  })
})
