import { describe, it, expect } from 'vitest'
import { SAC_HSN_CODES } from '@/lib/constants'

describe('SAC/HSN Codes', () => {
  it('should have all codes in 8-digit format', () => {
    SAC_HSN_CODES.forEach(sac => {
      expect(sac.code).toMatch(/^\d{8}$/)
    })
  })

  it('should have unique codes', () => {
    const codes = SAC_HSN_CODES.map(sac => sac.code)
    const uniqueCodes = new Set(codes)
    expect(uniqueCodes.size).toBe(codes.length)
  })

  it('should have descriptions for all codes', () => {
    SAC_HSN_CODES.forEach(sac => {
      expect(sac.description).toBeTruthy()
      expect(sac.description.length).toBeGreaterThan(0)
    })
  })

  it('should include common software service codes', () => {
    const commonCodes = ['99831190', '99831140', '99831150', '99831400']
    commonCodes.forEach(code => {
      const found = SAC_HSN_CODES.find(sac => sac.code === code)
      expect(found).toBeDefined()
    })
  })
})