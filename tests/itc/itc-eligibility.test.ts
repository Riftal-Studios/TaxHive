import { describe, it, expect } from 'vitest'
import {
  checkITCEligibility,
  calculateITCAmount,
  getBlockedCreditCategory,
  applyRule36_4,
  calculateProportionateITC,
  ITCEligibilityInput,
  ITCEligibilityResult,
  BlockedCreditCategory
} from '@/lib/itc/eligibility'
import { Decimal } from '@prisma/client/runtime/library'

describe('ITC Eligibility Calculation', () => {
  describe('Blocked Credits under Section 17(5)', () => {
    it('should block ITC for motor vehicles with seating capacity <= 13', () => {
      const input: ITCEligibilityInput = {
        category: 'MOTOR_VEHICLE',
        seatingCapacity: 5,
        businessPurpose: 'GENERAL',
        gstAmount: new Decimal(50000)
      }
      
      const result = checkITCEligibility(input)
      
      expect(result.isEligible).toBe(false)
      expect(result.blockedCategory).toBe('MOTOR_VEHICLE')
      expect(result.blockedReason).toContain('Section 17(5)(a)')
      expect(result.eligibleAmount.toNumber()).toBe(0)
    })
    
    it('should allow ITC for motor vehicles with seating capacity > 13', () => {
      const input: ITCEligibilityInput = {
        category: 'MOTOR_VEHICLE',
        seatingCapacity: 14,
        businessPurpose: 'GENERAL',
        gstAmount: new Decimal(100000)
      }
      
      const result = checkITCEligibility(input)
      
      expect(result.isEligible).toBe(true)
      expect(result.eligibleAmount.toNumber()).toBe(100000)
    })
    
    it('should allow ITC for motor vehicles used in transportation business', () => {
      const input: ITCEligibilityInput = {
        category: 'MOTOR_VEHICLE',
        seatingCapacity: 5,
        businessPurpose: 'PASSENGER_TRANSPORT',
        gstAmount: new Decimal(50000)
      }
      
      const result = checkITCEligibility(input)
      
      expect(result.isEligible).toBe(true)
      expect(result.eligibleAmount.toNumber()).toBe(50000)
    })
    
    it('should block ITC for construction of immovable property', () => {
      const input: ITCEligibilityInput = {
        category: 'CONSTRUCTION',
        constructionType: 'BUILDING',
        businessPurpose: 'OWN_USE',
        gstAmount: new Decimal(200000)
      }
      
      const result = checkITCEligibility(input)
      
      expect(result.isEligible).toBe(false)
      expect(result.blockedCategory).toBe('CONSTRUCTION')
      expect(result.blockedReason).toContain('Section 17(5)(c)')
    })
    
    it('should allow ITC for construction by real estate developers', () => {
      const input: ITCEligibilityInput = {
        category: 'CONSTRUCTION',
        constructionType: 'BUILDING',
        businessPurpose: 'SALE_DEVELOPMENT',
        gstAmount: new Decimal(500000)
      }
      
      const result = checkITCEligibility(input)
      
      expect(result.isEligible).toBe(true)
      expect(result.eligibleAmount.toNumber()).toBe(500000)
    })
    
    it('should block ITC for food and beverages', () => {
      const input: ITCEligibilityInput = {
        category: 'FOOD_BEVERAGE',
        isStatutoryRequirement: false,
        gstAmount: new Decimal(10000)
      }
      
      const result = checkITCEligibility(input)
      
      expect(result.isEligible).toBe(false)
      expect(result.blockedCategory).toBe('FOOD_BEVERAGE')
      expect(result.blockedReason).toContain('Section 17(5)(b)(i)')
    })
    
    it('should allow ITC for food when statutory requirement', () => {
      const input: ITCEligibilityInput = {
        category: 'FOOD_BEVERAGE',
        isStatutoryRequirement: true,
        gstAmount: new Decimal(5000)
      }
      
      const result = checkITCEligibility(input)
      
      expect(result.isEligible).toBe(true)
      expect(result.eligibleAmount.toNumber()).toBe(5000)
    })
    
    it('should block ITC for health and life insurance', () => {
      const input: ITCEligibilityInput = {
        category: 'INSURANCE',
        insuranceType: 'HEALTH',
        isStatutoryRequirement: false,
        gstAmount: new Decimal(15000)
      }
      
      const result = checkITCEligibility(input)
      
      expect(result.isEligible).toBe(false)
      expect(result.blockedCategory).toBe('INSURANCE')
      expect(result.blockedReason).toContain('Section 17(5)(b)(iii)')
    })
    
    it('should block ITC for membership of clubs', () => {
      const input: ITCEligibilityInput = {
        category: 'MEMBERSHIP',
        membershipType: 'CLUB',
        gstAmount: new Decimal(20000)
      }
      
      const result = checkITCEligibility(input)
      
      expect(result.isEligible).toBe(false)
      expect(result.blockedCategory).toBe('MEMBERSHIP')
      expect(result.blockedReason).toContain('Section 17(5)(b)(ii)')
    })
    
    it('should block ITC for personal consumption', () => {
      const input: ITCEligibilityInput = {
        category: 'GENERAL',
        usageType: 'PERSONAL',
        gstAmount: new Decimal(5000)
      }
      
      const result = checkITCEligibility(input)
      
      expect(result.isEligible).toBe(false)
      expect(result.blockedCategory).toBe('PERSONAL_USE')
      expect(result.blockedReason).toContain('Section 17(5)(g)')
    })
  })
  
  describe('Partial ITC Calculation', () => {
    it('should calculate proportionate ITC for mixed use', () => {
      const result = calculateProportionateITC({
        totalGST: new Decimal(100000),
        businessUsePercentage: 70,
        exemptSupplyPercentage: 0
      })
      
      expect(result.eligibleITC.toNumber()).toBe(70000)
      expect(result.reversedITC.toNumber()).toBe(30000)
    })
    
    it('should apply reversal for exempt supplies', () => {
      const result = calculateProportionateITC({
        totalGST: new Decimal(100000),
        businessUsePercentage: 100,
        exemptSupplyPercentage: 20
      })
      
      expect(result.eligibleITC.toNumber()).toBe(80000)
      expect(result.reversedITC.toNumber()).toBe(20000)
    })
    
    it('should handle capital goods ITC over multiple years', () => {
      const result = calculateITCAmount({
        category: 'CAPITAL_GOODS',
        gstAmount: new Decimal(500000),
        assetLife: 5,
        currentYear: 1
      })
      
      expect(result.currentYearITC.toNumber()).toBe(100000) // 20% per year
      expect(result.totalEligibleITC.toNumber()).toBe(500000)
    })
  })
  
  describe('Rule 36(4) - Provisional ITC Limit', () => {
    it('should limit ITC to 105% of GSTR-2B amount (old rule)', () => {
      const result = applyRule36_4({
        claimedITC: new Decimal(110000),
        gstr2bITC: new Decimal(100000),
        ruleVersion: 'OLD' // Before October 2022
      })
      
      expect(result.allowedITC.toNumber()).toBe(105000) // 105% of 100000
      expect(result.excessITC.toNumber()).toBe(5000)
      expect(result.isCompliant).toBe(false)
    })
    
    it('should allow full ITC if within GSTR-2B amount (new rule)', () => {
      const result = applyRule36_4({
        claimedITC: new Decimal(100000),
        gstr2bITC: new Decimal(100000),
        ruleVersion: 'NEW' // After October 2022
      })
      
      expect(result.allowedITC.toNumber()).toBe(100000)
      expect(result.excessITC.toNumber()).toBe(0)
      expect(result.isCompliant).toBe(true)
    })
    
    it('should reject ITC exceeding GSTR-2B (new rule)', () => {
      const result = applyRule36_4({
        claimedITC: new Decimal(110000),
        gstr2bITC: new Decimal(100000),
        ruleVersion: 'NEW'
      })
      
      expect(result.allowedITC.toNumber()).toBe(100000)
      expect(result.excessITC.toNumber()).toBe(10000)
      expect(result.isCompliant).toBe(false)
    })
  })
  
  describe('ITC Conditions Validation', () => {
    it('should validate all conditions for ITC claim', () => {
      const conditions = {
        hasValidInvoice: true,
        goodsServicesReceived: true,
        taxPaidBySupplier: true,
        gstr3bFiled: true,
        withinTimeLimit: true
      }
      
      const result = validateITCConditions(conditions)
      
      expect(result.canClaimITC).toBe(true)
      expect(result.failedConditions).toHaveLength(0)
    })
    
    it('should reject ITC if invoice is missing', () => {
      const conditions = {
        hasValidInvoice: false,
        goodsServicesReceived: true,
        taxPaidBySupplier: true,
        gstr3bFiled: true,
        withinTimeLimit: true
      }
      
      const result = validateITCConditions(conditions)
      
      expect(result.canClaimITC).toBe(false)
      expect(result.failedConditions).toContain('Valid tax invoice required')
    })
    
    it('should reject ITC if time limit exceeded', () => {
      const conditions = {
        hasValidInvoice: true,
        goodsServicesReceived: true,
        taxPaidBySupplier: true,
        gstr3bFiled: true,
        withinTimeLimit: false
      }
      
      const result = validateITCConditions(conditions)
      
      expect(result.canClaimITC).toBe(false)
      expect(result.failedConditions).toContain('ITC claim time limit exceeded')
    })
  })
  
  describe('ITC Reversal Scenarios', () => {
    it('should calculate reversal for non-payment within 180 days', () => {
      const reversal = calculateITCReversal({
        originalITC: new Decimal(50000),
        reason: 'NON_PAYMENT_180_DAYS',
        invoiceDate: new Date('2024-01-15'),
        currentDate: new Date('2024-08-15')
      })
      
      expect(reversal.reversalAmount.toNumber()).toBe(50000)
      expect(reversal.interestAmount.toNumber()).toBeGreaterThan(0)
      expect(reversal.totalAmount.toNumber()).toBeGreaterThan(50000)
    })
    
    it('should reverse ITC for goods lost or destroyed', () => {
      const reversal = calculateITCReversal({
        originalITC: new Decimal(25000),
        reason: 'GOODS_LOST',
        lossPercentage: 40
      })
      
      expect(reversal.reversalAmount.toNumber()).toBe(10000) // 40% of 25000
      expect(reversal.reversalReason).toContain('lost')
    })
    
    it('should reverse ITC for change in usage from business to personal', () => {
      const reversal = calculateITCReversal({
        originalITC: new Decimal(30000),
        reason: 'USAGE_CHANGE',
        personalUsePercentage: 60
      })
      
      expect(reversal.reversalAmount.toNumber()).toBe(18000) // 60% of 30000
      expect(reversal.reversalReason).toContain('personal use')
    })
  })
  
  describe('Blocked Credit Categories', () => {
    it('should identify correct blocked category for different expenses', () => {
      expect(getBlockedCreditCategory('Motor vehicle purchase')).toBe('MOTOR_VEHICLE')
      expect(getBlockedCreditCategory('Building construction')).toBe('CONSTRUCTION')
      expect(getBlockedCreditCategory('Employee health insurance')).toBe('INSURANCE')
      expect(getBlockedCreditCategory('Club membership fees')).toBe('MEMBERSHIP')
      expect(getBlockedCreditCategory('Outdoor catering services')).toBe('FOOD_BEVERAGE')
      expect(getBlockedCreditCategory('Beauty treatment')).toBe('PERSONAL_SERVICES')
      expect(getBlockedCreditCategory('Travel benefits')).toBe('TRAVEL')
    })
  })
})

// Helper function for ITC conditions validation
function validateITCConditions(conditions: {
  hasValidInvoice: boolean
  goodsServicesReceived: boolean
  taxPaidBySupplier: boolean
  gstr3bFiled: boolean
  withinTimeLimit: boolean
}) {
  const failedConditions: string[] = []
  
  if (!conditions.hasValidInvoice) {
    failedConditions.push('Valid tax invoice required')
  }
  if (!conditions.goodsServicesReceived) {
    failedConditions.push('Goods/services must be received')
  }
  if (!conditions.taxPaidBySupplier) {
    failedConditions.push('Tax must be paid by supplier')
  }
  if (!conditions.gstr3bFiled) {
    failedConditions.push('GSTR-3B must be filed')
  }
  if (!conditions.withinTimeLimit) {
    failedConditions.push('ITC claim time limit exceeded')
  }
  
  return {
    canClaimITC: failedConditions.length === 0,
    failedConditions
  }
}

// Helper function for ITC reversal calculation
function calculateITCReversal(input: {
  originalITC: Decimal
  reason: string
  invoiceDate?: Date
  currentDate?: Date
  lossPercentage?: number
  personalUsePercentage?: number
}) {
  let reversalAmount = input.originalITC
  let interestAmount = new Decimal(0)
  let reversalReason = ''
  
  switch (input.reason) {
    case 'NON_PAYMENT_180_DAYS':
      reversalReason = 'Non-payment to supplier within 180 days'
      if (input.invoiceDate && input.currentDate) {
        const daysDiff = Math.floor((input.currentDate.getTime() - input.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysDiff > 180) {
          const monthsLate = Math.ceil((daysDiff - 180) / 30)
          interestAmount = input.originalITC.mul(0.18).mul(monthsLate).div(12)
        }
      }
      break
      
    case 'GOODS_LOST':
      if (input.lossPercentage) {
        reversalAmount = input.originalITC.mul(input.lossPercentage).div(100)
        reversalReason = `Goods lost/destroyed - ${input.lossPercentage}%`
      }
      break
      
    case 'USAGE_CHANGE':
      if (input.personalUsePercentage) {
        reversalAmount = input.originalITC.mul(input.personalUsePercentage).div(100)
        reversalReason = `Changed to personal use - ${input.personalUsePercentage}%`
      }
      break
  }
  
  return {
    reversalAmount,
    interestAmount,
    totalAmount: reversalAmount.add(interestAmount),
    reversalReason
  }
}