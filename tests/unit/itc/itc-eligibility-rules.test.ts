import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'

// Import interfaces and types that we need to implement
interface ITCEligibilityInput {
  category: string
  subcategory?: string
  seatingCapacity?: number
  businessPurpose?: string
  constructionType?: string
  isStatutoryRequirement?: boolean
  insuranceType?: string
  membershipType?: string
  usageType?: string
  gstAmount: Decimal
  businessUsePercentage?: number
  exemptSupplyPercentage?: number
  isCapitalGoods?: boolean
  assetLife?: number
  invoiceDate?: Date
  goodsReceiptDate?: Date
  taxPaidDate?: Date
  gstr3bFiledDate?: Date
  supplierGSTIN?: string
  isImport?: boolean
  importType?: 'GOODS' | 'SERVICES'
  customsDutyPaid?: boolean
  reverseChargeApplicable?: boolean
}

interface ITCEligibilityResult {
  isEligible: boolean
  eligibleAmount: Decimal
  blockedAmount: Decimal
  partialAmount?: Decimal
  reversalAmount?: Decimal
  blockedCategory?: string
  blockedReason?: string
  conditions: {
    validInvoice: boolean
    goodsReceived: boolean
    taxPaid: boolean
    gstr3bFiled: boolean
    withinTimeLimit: boolean
  }
  reversal?: {
    reason: string
    amount: Decimal
    dueDate?: Date
  }
}

interface ITCConditionsInput {
  invoiceNumber: string
  invoiceDate: Date
  goodsReceiptDate?: Date
  taxPaidDate?: Date
  gstr3bFiledDate?: Date
  supplierGSTIN: string
  currentDate: Date
}

interface BlockedCreditInput {
  category: string
  subcategory?: string
  seatingCapacity?: number
  businessPurpose?: string
  constructionType?: string
  isStatutoryRequirement?: boolean
  insuranceType?: string
  membershipType?: string
  usageType?: string
}

interface PartialITCInput {
  totalGST: Decimal
  businessUsePercentage: number
  exemptSupplyPercentage: number
  expenseType: 'COMMON' | 'CAPITAL_GOODS' | 'MIXED_USE'
}

interface ITCReversalInput {
  originalITC: Decimal
  reason: 'NON_PAYMENT_180_DAYS' | 'GOODS_LOST' | 'USAGE_CHANGE' | 'CREDIT_NOTE' | 'EXEMPT_SUPPLY_INCREASE'
  invoiceDate?: Date
  currentDate?: Date
  paymentDate?: Date
  lossPercentage?: number
  personalUsePercentage?: number
  creditNoteAmount?: Decimal
  exemptSupplyChange?: number
}

interface CapitalGoodsITCInput {
  gstAmount: Decimal
  assetLife: number
  businessUsePercentage: number
  currentYear: number
  disposalDate?: Date
  disposalValue?: Decimal
}

interface ImportITCInput {
  importType: 'GOODS' | 'SERVICES'
  igstAmount: Decimal
  customsDutyPaid: boolean
  billOfEntryNumber?: string
  reverseChargeApplicable?: boolean
  supplierCountry?: string
}

// Import the service that we need to implement
import {
  ITCEligibilityService,
  evaluateITCEligibility,
  checkBlockedCredits,
  calculatePartialITC,
  validateITCConditions,
  calculateITCReversal,
  getBlockedCategoryReason,
  calculateCapitalGoodsITC,
  processImportITC,
  calculateExemptSupplyReversal,
  trackITCCompliance
} from '@/lib/itc/itc-eligibility-rules'

describe('ITC Eligibility Rules - TDD Implementation', () => {
  const testUserId = 'test-user-id'
  const baseGSTAmount = new Decimal(10000) // ₹10,000

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // RED PHASE - Write failing tests first for Section 17(5) blocked credits
  describe('Section 17(5) Blocked Credits - Motor Vehicles (RED Phase)', () => {
    it('should block ITC for passenger cars with seating ≤13 not used for transport business', async () => {
      const input: BlockedCreditInput = {
        category: 'MOTOR_VEHICLE',
        subcategory: 'PASSENGER_CAR',
        seatingCapacity: 5,
        businessPurpose: 'OFFICE_USE'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(true)
      expect(result.blockedAmount).toEqual(baseGSTAmount)
      expect(result.blockedReason).toContain('Section 17(5)(a)')
      expect(result.category).toBe('MOTOR_VEHICLE')
    })

    it('should allow ITC for passenger transport vehicles with seating ≤13', async () => {
      const input: BlockedCreditInput = {
        category: 'MOTOR_VEHICLE',
        subcategory: 'PASSENGER_CAR',
        seatingCapacity: 13,
        businessPurpose: 'PASSENGER_TRANSPORT'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(false)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
    })

    it('should allow ITC for goods transport vehicles regardless of seating', async () => {
      const input: BlockedCreditInput = {
        category: 'MOTOR_VEHICLE',
        subcategory: 'GOODS_VEHICLE',
        seatingCapacity: 3,
        businessPurpose: 'GOODS_TRANSPORT'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(false)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
    })

    it('should allow ITC for vehicles used for imparting training on driving', async () => {
      const input: BlockedCreditInput = {
        category: 'MOTOR_VEHICLE',
        subcategory: 'PASSENGER_CAR',
        seatingCapacity: 5,
        businessPurpose: 'IMPARTING_TRAINING'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(false)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
    })

    it('should allow ITC for vehicles with seating >13', async () => {
      const input: BlockedCreditInput = {
        category: 'MOTOR_VEHICLE',
        subcategory: 'BUS',
        seatingCapacity: 20,
        businessPurpose: 'OFFICE_USE'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(false)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
    })
  })

  describe('Section 17(5) Blocked Credits - Food & Beverages (RED Phase)', () => {
    it('should block ITC for food and beverages not meeting statutory requirements', async () => {
      const input: BlockedCreditInput = {
        category: 'FOOD_BEVERAGE',
        subcategory: 'EMPLOYEE_MEALS',
        isStatutoryRequirement: false
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(true)
      expect(result.blockedAmount).toEqual(baseGSTAmount)
      expect(result.blockedReason).toContain('Section 17(5)(b)(i)')
    })

    it('should allow ITC for food and beverages when statutory requirement', async () => {
      const input: BlockedCreditInput = {
        category: 'FOOD_BEVERAGE',
        subcategory: 'FACTORY_CANTEEN',
        isStatutoryRequirement: true
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(false)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
    })

    it('should block ITC for outdoor catering services', async () => {
      const input: BlockedCreditInput = {
        category: 'FOOD_BEVERAGE',
        subcategory: 'OUTDOOR_CATERING',
        isStatutoryRequirement: false
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(true)
      expect(result.blockedReason).toContain('outdoor catering')
    })
  })

  describe('Section 17(5) Blocked Credits - Memberships & Insurance (RED Phase)', () => {
    it('should block ITC for club memberships', async () => {
      const input: BlockedCreditInput = {
        category: 'MEMBERSHIP',
        membershipType: 'CLUB',
        subcategory: 'GOLF_CLUB'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(true)
      expect(result.blockedReason).toContain('Section 17(5)(b)(ii)')
    })

    it('should block ITC for health and fitness center memberships', async () => {
      const input: BlockedCreditInput = {
        category: 'MEMBERSHIP',
        membershipType: 'FITNESS_CENTER',
        subcategory: 'GYM'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(true)
      expect(result.blockedReason).toContain('fitness')
    })

    it('should block ITC for life insurance premiums', async () => {
      const input: BlockedCreditInput = {
        category: 'INSURANCE',
        insuranceType: 'LIFE',
        isStatutoryRequirement: false
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(true)
      expect(result.blockedReason).toContain('life insurance')
    })

    it('should block ITC for health insurance premiums', async () => {
      const input: BlockedCreditInput = {
        category: 'INSURANCE',
        insuranceType: 'HEALTH',
        isStatutoryRequirement: false
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(true)
      expect(result.blockedReason).toContain('health insurance')
    })

    it('should allow ITC for property insurance', async () => {
      const input: BlockedCreditInput = {
        category: 'INSURANCE',
        insuranceType: 'PROPERTY',
        isStatutoryRequirement: false
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(false)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
    })
  })

  describe('Section 17(5) Blocked Credits - Works Contract & Personal Use (RED Phase)', () => {
    it('should block ITC for works contract services for immovable property (except for developers)', async () => {
      const input: BlockedCreditInput = {
        category: 'CONSTRUCTION',
        constructionType: 'IMMOVABLE_PROPERTY',
        businessPurpose: 'OFFICE_CONSTRUCTION'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(true)
      expect(result.blockedReason).toContain('Section 17(5)(c)')
    })

    it('should allow ITC for construction services for property developers', async () => {
      const input: BlockedCreditInput = {
        category: 'CONSTRUCTION',
        constructionType: 'IMMOVABLE_PROPERTY',
        businessPurpose: 'SALE_DEVELOPMENT'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(false)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
    })

    it('should allow ITC for plant and machinery construction', async () => {
      const input: BlockedCreditInput = {
        category: 'CONSTRUCTION',
        constructionType: 'PLANT_MACHINERY'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(false)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
    })

    it('should block ITC for personal consumption goods/services', async () => {
      const input: BlockedCreditInput = {
        category: 'GENERAL',
        usageType: 'PERSONAL',
        subcategory: 'EMPLOYEE_GIFT'
      }

      const result = await checkBlockedCredits(input, baseGSTAmount)
      
      expect(result.isBlocked).toBe(true)
      expect(result.blockedReason).toContain('Section 17(5)(g)')
    })
  })

  // RED PHASE - Partial ITC scenarios
  describe('Partial ITC Calculations (RED Phase)', () => {
    it('should calculate proportionate ITC for common expenses based on business use percentage', async () => {
      const input: PartialITCInput = {
        totalGST: baseGSTAmount,
        businessUsePercentage: 70,
        exemptSupplyPercentage: 0,
        expenseType: 'COMMON'
      }

      const result = await calculatePartialITC(input)
      
      expect(result.eligibleITC).toEqual(new Decimal(7000)) // 70% of 10,000
      expect(result.reversedITC).toEqual(new Decimal(3000)) // 30% of 10,000
      expect(result.reversalReason).toContain('business use percentage')
    })

    it('should calculate proportionate ITC reversal for exempt supplies', async () => {
      const input: PartialITCInput = {
        totalGST: baseGSTAmount,
        businessUsePercentage: 100,
        exemptSupplyPercentage: 30,
        expenseType: 'COMMON'
      }

      const result = await calculatePartialITC(input)
      
      expect(result.eligibleITC).toEqual(new Decimal(7000)) // 70% for taxable supplies
      expect(result.reversedITC).toEqual(new Decimal(3000)) // 30% for exempt supplies
      expect(result.reversalReason).toContain('exempt supply')
    })

    it('should calculate combined business use and exempt supply reversal', async () => {
      const input: PartialITCInput = {
        totalGST: baseGSTAmount,
        businessUsePercentage: 80,
        exemptSupplyPercentage: 25,
        expenseType: 'COMMON'
      }

      const result = await calculatePartialITC(input)
      
      // 80% business use = 8000, then 75% taxable supplies = 6000
      expect(result.eligibleITC).toEqual(new Decimal(6000))
      expect(result.reversedITC).toEqual(new Decimal(4000))
    })
  })

  // RED PHASE - ITC conditions validation
  describe('ITC Conditions Validation (RED Phase)', () => {
    it('should fail validation when no valid tax invoice is available', async () => {
      const conditions: ITCConditionsInput = {
        invoiceNumber: '',
        invoiceDate: new Date(),
        supplierGSTIN: '27AAPFU0939F1ZV',
        currentDate: new Date()
      }

      const result = await validateITCConditions(conditions)
      
      expect(result.canClaimITC).toBe(false)
      expect(result.failedConditions).toContain('Valid tax invoice required')
    })

    it('should fail validation when goods/services not received', async () => {
      const conditions: ITCConditionsInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2024-01-01'),
        supplierGSTIN: '27AAPFU0939F1ZV',
        currentDate: new Date('2024-01-10')
        // No goodsReceiptDate provided
      }

      const result = await validateITCConditions(conditions)
      
      expect(result.canClaimITC).toBe(false)
      expect(result.failedConditions).toContain('Goods/services must be received')
    })

    it('should fail validation when tax not paid by supplier', async () => {
      const conditions: ITCConditionsInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2024-01-01'),
        goodsReceiptDate: new Date('2024-01-05'),
        supplierGSTIN: '27AAPFU0939F1ZV',
        currentDate: new Date('2024-01-10')
        // No taxPaidDate provided
      }

      const result = await validateITCConditions(conditions)
      
      expect(result.canClaimITC).toBe(false)
      expect(result.failedConditions).toContain('Tax must be paid by supplier')
    })

    it('should fail validation when GSTR-3B not filed in time', async () => {
      const conditions: ITCConditionsInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2024-01-01'),
        goodsReceiptDate: new Date('2024-01-05'),
        taxPaidDate: new Date('2024-01-10'),
        supplierGSTIN: '27AAPFU0939F1ZV',
        currentDate: new Date('2024-01-15')
        // No gstr3bFiledDate provided
      }

      const result = await validateITCConditions(conditions)
      
      expect(result.canClaimITC).toBe(false)
      expect(result.failedConditions).toContain('GSTR-3B must be filed')
    })

    it('should fail validation when ITC claim time limit exceeded (September of following year)', async () => {
      const conditions: ITCConditionsInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2022-01-01'), // Old invoice
        goodsReceiptDate: new Date('2022-01-05'),
        taxPaidDate: new Date('2022-01-10'),
        gstr3bFiledDate: new Date('2022-01-20'),
        supplierGSTIN: '27AAPFU0939F1ZV',
        currentDate: new Date('2024-01-15') // Too late to claim
      }

      const result = await validateITCConditions(conditions)
      
      expect(result.canClaimITC).toBe(false)
      expect(result.failedConditions).toContain('ITC claim time limit exceeded')
    })

    it('should pass all validations when conditions are met', async () => {
      const conditions: ITCConditionsInput = {
        invoiceNumber: 'INV001',
        invoiceDate: new Date('2024-01-01'),
        goodsReceiptDate: new Date('2024-01-05'),
        taxPaidDate: new Date('2024-01-10'),
        gstr3bFiledDate: new Date('2024-01-20'),
        supplierGSTIN: '27AAPFU0939F1ZV',
        currentDate: new Date('2024-02-15')
      }

      const result = await validateITCConditions(conditions)
      
      expect(result.canClaimITC).toBe(true)
      expect(result.failedConditions).toHaveLength(0)
    })
  })

  // RED PHASE - Capital goods ITC
  describe('Capital Goods ITC Calculations (RED Phase)', () => {
    it('should calculate 100% ITC for capital goods used entirely for business', async () => {
      const input: CapitalGoodsITCInput = {
        gstAmount: baseGSTAmount,
        assetLife: 5,
        businessUsePercentage: 100,
        currentYear: 1
      }

      const result = await calculateCapitalGoodsITC(input)
      
      expect(result.currentYearITC).toEqual(baseGSTAmount) // 100% in year 1
      expect(result.totalEligibleITC).toEqual(baseGSTAmount)
      expect(result.schedule).toHaveLength(1) // Single year claim
    })

    it('should calculate proportionate ITC for capital goods with mixed use', async () => {
      const input: CapitalGoodsITCInput = {
        gstAmount: baseGSTAmount,
        assetLife: 5,
        businessUsePercentage: 70,
        currentYear: 1
      }

      const result = await calculateCapitalGoodsITC(input)
      
      expect(result.currentYearITC).toEqual(new Decimal(7000)) // 70% of 10,000
      expect(result.totalEligibleITC).toEqual(new Decimal(7000))
      expect(result.reversedITC).toEqual(new Decimal(3000)) // 30% reversed
    })

    it('should calculate reversal when capital goods disposed within 5 years', async () => {
      const input: CapitalGoodsITCInput = {
        gstAmount: baseGSTAmount,
        assetLife: 5,
        businessUsePercentage: 100,
        currentYear: 3, // Disposed in year 3
        disposalDate: new Date(),
        disposalValue: new Decimal(5000)
      }

      const result = await calculateCapitalGoodsITC(input)
      
      // Should reverse ITC for remaining 2 years (2/5 of original ITC)
      expect(result.reversalAmount).toEqual(new Decimal(4000)) // 40% reversal
      expect(result.reason).toContain('disposal within 5 years')
    })
  })

  // RED PHASE - Import of goods/services ITC
  describe('Import ITC Processing (RED Phase)', () => {
    it('should allow ITC for import of goods with IGST paid at customs', async () => {
      const input: ImportITCInput = {
        importType: 'GOODS',
        igstAmount: baseGSTAmount,
        customsDutyPaid: true,
        billOfEntryNumber: 'BOE123456'
      }

      const result = await processImportITC(input)
      
      expect(result.isEligible).toBe(true)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
      expect(result.source).toBe('CUSTOMS_IGST')
    })

    it('should process reverse charge ITC for import of services', async () => {
      const input: ImportITCInput = {
        importType: 'SERVICES',
        igstAmount: baseGSTAmount,
        customsDutyPaid: false,
        reverseChargeApplicable: true,
        supplierCountry: 'USA'
      }

      const result = await processImportITC(input)
      
      expect(result.isEligible).toBe(true)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
      expect(result.source).toBe('REVERSE_CHARGE')
      expect(result.conditions.reverseChargeComplied).toBe(true)
    })

    it('should block ITC for import where customs duty not paid', async () => {
      const input: ImportITCInput = {
        importType: 'GOODS',
        igstAmount: baseGSTAmount,
        customsDutyPaid: false
      }

      const result = await processImportITC(input)
      
      expect(result.isEligible).toBe(false)
      expect(result.blockedReason).toContain('customs duty not paid')
    })
  })

  // RED PHASE - ITC reversal scenarios
  describe('ITC Reversal Calculations (RED Phase)', () => {
    it('should calculate reversal for non-payment to vendor within 180 days', async () => {
      const input: ITCReversalInput = {
        originalITC: baseGSTAmount,
        reason: 'NON_PAYMENT_180_DAYS',
        invoiceDate: new Date('2024-01-01'),
        currentDate: new Date('2024-08-15') // 226 days later
      }

      const result = await calculateITCReversal(input)
      
      expect(result.reversalAmount).toEqual(baseGSTAmount)
      expect(result.interestAmount.greaterThan(0)).toBe(true) // Should have interest
      expect(result.reason).toContain('180 days')
    })

    it('should calculate partial reversal for goods lost/destroyed', async () => {
      const input: ITCReversalInput = {
        originalITC: baseGSTAmount,
        reason: 'GOODS_LOST',
        lossPercentage: 30
      }

      const result = await calculateITCReversal(input)
      
      expect(result.reversalAmount).toEqual(new Decimal(3000)) // 30% of 10,000
      expect(result.reason).toContain('lost/destroyed')
    })

    it('should calculate reversal for usage change to personal', async () => {
      const input: ITCReversalInput = {
        originalITC: baseGSTAmount,
        reason: 'USAGE_CHANGE',
        personalUsePercentage: 40
      }

      const result = await calculateITCReversal(input)
      
      expect(result.reversalAmount).toEqual(new Decimal(4000)) // 40% of 10,000
      expect(result.reason).toContain('personal use')
    })

    it('should calculate reversal when credit note received', async () => {
      const input: ITCReversalInput = {
        originalITC: baseGSTAmount,
        reason: 'CREDIT_NOTE',
        creditNoteAmount: new Decimal(2000)
      }

      const result = await calculateITCReversal(input)
      
      expect(result.reversalAmount).toEqual(new Decimal(2000))
      expect(result.reason).toContain('credit note')
    })
  })

  // RED PHASE - Main evaluation function
  describe('Main ITC Eligibility Evaluation (RED Phase)', () => {
    it('should perform comprehensive ITC evaluation with all checks', async () => {
      const input: ITCEligibilityInput = {
        category: 'OFFICE_SUPPLIES',
        gstAmount: baseGSTAmount,
        businessUsePercentage: 100,
        exemptSupplyPercentage: 0,
        invoiceDate: new Date('2024-01-01'),
        goodsReceiptDate: new Date('2024-01-05'),
        taxPaidDate: new Date('2024-01-10'),
        gstr3bFiledDate: new Date('2024-01-20'),
        supplierGSTIN: '27AAPFU0939F1ZV'
      }

      const result = await evaluateITCEligibility(input, testUserId)
      
      expect(result.isEligible).toBe(true)
      expect(result.eligibleAmount).toEqual(baseGSTAmount)
      expect(result.conditions.validInvoice).toBe(true)
      expect(result.conditions.goodsReceived).toBe(true)
      expect(result.conditions.taxPaid).toBe(true)
      expect(result.conditions.gstr3bFiled).toBe(true)
    })

    it('should block ITC for motor vehicle and show blocked category', async () => {
      const input: ITCEligibilityInput = {
        category: 'MOTOR_VEHICLE',
        subcategory: 'PASSENGER_CAR',
        seatingCapacity: 5,
        businessPurpose: 'OFFICE_USE',
        gstAmount: baseGSTAmount,
        invoiceDate: new Date('2024-01-01'),
        supplierGSTIN: '27AAPFU0939F1ZV'
      }

      const result = await evaluateITCEligibility(input, testUserId)
      
      expect(result.isEligible).toBe(false)
      expect(result.blockedAmount).toEqual(baseGSTAmount)
      expect(result.blockedCategory).toBe('MOTOR_VEHICLE')
      expect(result.blockedReason).toContain('Section 17(5)(a)')
    })

    it('should calculate partial ITC for mixed use capital goods', async () => {
      const input: ITCEligibilityInput = {
        category: 'CAPITAL_GOODS',
        subcategory: 'MACHINERY',
        gstAmount: baseGSTAmount,
        businessUsePercentage: 80,
        exemptSupplyPercentage: 20,
        isCapitalGoods: true,
        assetLife: 5,
        invoiceDate: new Date('2024-01-01'),
        supplierGSTIN: '27AAPFU0939F1ZV'
      }

      const result = await evaluateITCEligibility(input, testUserId)
      
      expect(result.isEligible).toBe(true)
      expect(result.partialAmount.greaterThan(0)).toBe(true)
      expect(result.partialAmount.lessThan(baseGSTAmount)).toBe(true)
    })
  })

  // RED PHASE - Compliance tracking
  describe('ITC Compliance Tracking (RED Phase)', () => {
    it('should track ITC claims and maintain audit trail', async () => {
      const complianceData = {
        userId: testUserId,
        invoiceId: 'INV001',
        claimedAmount: baseGSTAmount,
        eligibleAmount: baseGSTAmount,
        claimDate: new Date(),
        claimBasis: 'PURCHASE_INVOICE'
      }

      const result = await trackITCCompliance(complianceData)
      
      expect(result.trackingId).toBeDefined()
      expect(result.auditTrail).toBeDefined()
      expect(result.complianceStatus).toBe('COMPLIANT')
    })

    it('should flag non-compliant ITC claims for review', async () => {
      const complianceData = {
        userId: testUserId,
        invoiceId: 'INV002',
        claimedAmount: baseGSTAmount,
        eligibleAmount: new Decimal(5000), // Less than claimed
        claimDate: new Date(),
        claimBasis: 'BLOCKED_CATEGORY'
      }

      const result = await trackITCCompliance(complianceData)
      
      expect(result.complianceStatus).toBe('NON_COMPLIANT')
      expect(result.issues).toContain('Claimed amount exceeds eligible amount')
    })
  })

  // RED PHASE - Helper function tests
  describe('Helper Functions (RED Phase)', () => {
    it('should get blocked category reason for motor vehicle', async () => {
      const reason = await getBlockedCategoryReason('MOTOR_VEHICLE', {
        seatingCapacity: 5,
        businessPurpose: 'OFFICE_USE'
      })
      
      expect(reason).toContain('Section 17(5)(a)')
      expect(reason).toContain('motor vehicle')
    })

    it('should calculate exempt supply reversal based on turnover ratio', async () => {
      const result = await calculateExemptSupplyReversal({
        totalITC: baseGSTAmount,
        exemptTurnover: new Decimal(300000),
        totalTurnover: new Decimal(1000000)
      })
      
      expect(result.reversalAmount).toEqual(new Decimal(3000)) // 30% reversal
      expect(result.retainedITC).toEqual(new Decimal(7000)) // 70% retained
    })
  })
})