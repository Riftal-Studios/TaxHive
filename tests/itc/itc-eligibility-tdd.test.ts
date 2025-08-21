import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkITCEligibility,
  calculateITCAmount,
  applyBlockingRules,
  calculateProportionateITC,
  applyRule36_4,
  calculateITCReversal,
  validateITCConditions,
  getBlockedCreditCategory,
  analyzeExpenseForBlocking,
  ITCEligibilityInput,
  ITCEligibilityResult,
  ITCBlockingRule,
  ProportionateITCInput,
  Rule36_4Input,
  ITCReversalInput,
  ExpenseAnalysisResult
} from '@/lib/itc/eligibility'

describe('ITC Eligibility Rules - TDD Implementation', () => {
  describe('Section 17(5) Blocked Credits (RED Phase)', () => {
    describe('Motor Vehicles - Section 17(5)(a)', () => {
      it('should block ITC for motor vehicles with seating capacity ≤ 13', () => {
        const input: ITCEligibilityInput = {
          category: 'MOTOR_VEHICLE',
          description: 'Toyota Innova',
          seatingCapacity: 8,
          engineCapacity: 2400,
          vehicleType: 'PASSENGER',
          businessPurpose: 'GENERAL',
          gstAmount: 200000,
          hsnCode: '87032310'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(false)
        expect(result.blockedCategory).toBe('MOTOR_VEHICLE')
        expect(result.blockingRule).toBe('Section 17(5)(a)(i)')
        expect(result.blockReason).toContain('Motor vehicles with seating capacity of 13 or less')
        expect(result.eligibleAmount.toNumber()).toBe(0)
        expect(result.blockedAmount.toNumber()).toBe(200000)
      })

      it('should allow ITC for motor vehicles with seating capacity > 13', () => {
        const input: ITCEligibilityInput = {
          category: 'MOTOR_VEHICLE',
          description: 'Bus - Tata 1512',
          seatingCapacity: 15,
          vehicleType: 'PASSENGER',
          businessPurpose: 'PASSENGER_TRANSPORT',
          gstAmount: 500000,
          hsnCode: '87022090'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(500000)
        expect(result.blockedAmount.toNumber()).toBe(0)
        expect(result.exemptionReason).toContain('Seating capacity > 13')
      })

      it('should allow ITC for motor vehicles used in passenger transportation business', () => {
        const input: ITCEligibilityInput = {
          category: 'MOTOR_VEHICLE',
          description: 'Taxi - Maruti Dzire',
          seatingCapacity: 5,
          vehicleType: 'PASSENGER',
          businessPurpose: 'PASSENGER_TRANSPORT',
          businessNature: 'TRANSPORT_OPERATOR',
          gstAmount: 80000,
          hsnCode: '87032210'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(80000)
        expect(result.exemptionReason).toContain('Used in passenger transportation business')
      })

      it('should allow ITC for goods transportation vehicles', () => {
        const input: ITCEligibilityInput = {
          category: 'MOTOR_VEHICLE',
          description: 'Goods Truck - Tata Ace',
          vehicleType: 'GOODS_CARRIER',
          gvw: 1500, // Gross Vehicle Weight
          businessPurpose: 'GOODS_TRANSPORT',
          gstAmount: 120000,
          hsnCode: '87042290'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(120000)
        expect(result.exemptionReason).toContain('Goods transportation vehicle')
      })

      it('should allow ITC for motor vehicles used for training', () => {
        const input: ITCEligibilityInput = {
          category: 'MOTOR_VEHICLE',
          description: 'Training Car - Maruti Swift',
          seatingCapacity: 5,
          businessPurpose: 'DRIVING_TRAINING',
          isTrainingVehicle: true,
          gstAmount: 60000,
          hsnCode: '87032210'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(60000)
        expect(result.exemptionReason).toContain('Used for imparting training')
      })
    })

    describe('Food and Beverages - Section 17(5)(b)(i)', () => {
      it('should block ITC for food and beverages', () => {
        const input: ITCEligibilityInput = {
          category: 'FOOD_BEVERAGE',
          description: 'Employee lunch catering',
          isForEmployees: true,
          isStatutoryRequirement: false,
          gstAmount: 50000,
          hsnCode: '99541990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(false)
        expect(result.blockedCategory).toBe('FOOD_BEVERAGE')
        expect(result.blockingRule).toBe('Section 17(5)(b)(i)')
        expect(result.blockReason).toContain('Food and beverages')
        expect(result.blockedAmount.toNumber()).toBe(50000)
      })

      it('should allow ITC for food when statutory obligation', () => {
        const input: ITCEligibilityInput = {
          category: 'FOOD_BEVERAGE',
          description: 'Canteen food for factory workers',
          isForEmployees: true,
          isStatutoryRequirement: true,
          statutoryProvision: 'Factories Act, 1948',
          gstAmount: 30000,
          hsnCode: '99541990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(30000)
        expect(result.exemptionReason).toContain('Statutory obligation under Factories Act')
      })

      it('should allow ITC for food used in business operations', () => {
        const input: ITCEligibilityInput = {
          category: 'FOOD_BEVERAGE',
          description: 'Raw materials for restaurant',
          isForResale: true,
          businessNature: 'RESTAURANT',
          gstAmount: 100000,
          hsnCode: '21069099'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(100000)
        expect(result.exemptionReason).toContain('Used in business operations')
      })
    })

    describe('Health and Life Insurance - Section 17(5)(b)(iii)', () => {
      it('should block ITC for health insurance premiums', () => {
        const input: ITCEligibilityInput = {
          category: 'INSURANCE',
          insuranceType: 'HEALTH',
          description: 'Employee health insurance premium',
          isForEmployees: true,
          isGroupPolicy: true,
          gstAmount: 25000,
          hsnCode: '99712190'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(false)
        expect(result.blockedCategory).toBe('INSURANCE')
        expect(result.blockingRule).toBe('Section 17(5)(b)(iii)')
        expect(result.blockReason).toContain('Health insurance')
        expect(result.blockedAmount.toNumber()).toBe(25000)
      })

      it('should block ITC for life insurance premiums', () => {
        const input: ITCEligibilityInput = {
          category: 'INSURANCE',
          insuranceType: 'LIFE',
          description: 'Group life insurance for employees',
          isForEmployees: true,
          isGroupPolicy: true,
          gstAmount: 15000,
          hsnCode: '99711990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(false)
        expect(result.blockedCategory).toBe('INSURANCE')
        expect(result.blockingRule).toBe('Section 17(5)(b)(iii)')
        expect(result.blockReason).toContain('Life insurance')
      })

      it('should allow ITC for business insurance', () => {
        const input: ITCEligibilityInput = {
          category: 'INSURANCE',
          insuranceType: 'GENERAL',
          description: 'Fire insurance for factory',
          isForBusiness: true,
          businessAsset: 'FACTORY_BUILDING',
          gstAmount: 40000,
          hsnCode: '99751990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(40000)
        expect(result.exemptionReason).toContain('Business insurance')
      })
    })

    describe('Construction of Immovable Property - Section 17(5)(c)', () => {
      it('should block ITC for building construction for own use', () => {
        const input: ITCEligibilityInput = {
          category: 'CONSTRUCTION',
          constructionType: 'BUILDING',
          description: 'Office building construction',
          purpose: 'OWN_USE',
          isImmovableProperty: true,
          gstAmount: 500000,
          hsnCode: '99543990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(false)
        expect(result.blockedCategory).toBe('CONSTRUCTION')
        expect(result.blockingRule).toBe('Section 17(5)(c)')
        expect(result.blockReason).toContain('Construction of immovable property')
        expect(result.blockedAmount.toNumber()).toBe(500000)
      })

      it('should allow ITC for plant and machinery installation', () => {
        const input: ITCEligibilityInput = {
          category: 'CONSTRUCTION',
          constructionType: 'INSTALLATION',
          description: 'Machinery installation in factory',
          purpose: 'PLANT_MACHINERY',
          isPlantMachinery: true,
          gstAmount: 200000,
          hsnCode: '99543990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(200000)
        expect(result.exemptionReason).toContain('Plant and machinery')
      })

      it('should allow ITC for construction by real estate developers', () => {
        const input: ITCEligibilityInput = {
          category: 'CONSTRUCTION',
          constructionType: 'BUILDING',
          description: 'Residential complex construction',
          purpose: 'SALE_DEVELOPMENT',
          businessNature: 'REAL_ESTATE_DEVELOPER',
          gstAmount: 1000000,
          hsnCode: '99543990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(1000000)
        expect(result.exemptionReason).toContain('Real estate development')
      })
    })

    describe('Membership Fees - Section 17(5)(f)', () => {
      it('should block ITC for club membership', () => {
        const input: ITCEligibilityInput = {
          category: 'MEMBERSHIP',
          membershipType: 'CLUB',
          description: 'Golf club membership for executives',
          isRecreational: true,
          gstAmount: 50000,
          hsnCode: '99996990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(false)
        expect(result.blockedCategory).toBe('MEMBERSHIP')
        expect(result.blockingRule).toBe('Section 17(5)(f)')
        expect(result.blockReason).toContain('Membership of club')
        expect(result.blockedAmount.toNumber()).toBe(50000)
      })

      it('should block ITC for health and fitness center membership', () => {
        const input: ITCEligibilityInput = {
          category: 'MEMBERSHIP',
          membershipType: 'FITNESS',
          description: 'Gym membership for employees',
          isForEmployees: true,
          gstAmount: 20000,
          hsnCode: '99996990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(false)
        expect(result.blockedCategory).toBe('MEMBERSHIP')
        expect(result.blockingRule).toBe('Section 17(5)(f)')
        expect(result.blockReason).toContain('Health and fitness centre')
      })

      it('should allow ITC for professional membership fees', () => {
        const input: ITCEligibilityInput = {
          category: 'MEMBERSHIP',
          membershipType: 'PROFESSIONAL',
          description: 'CA Institute membership',
          isProfessionalBody: true,
          businessRelevance: 'COMPLIANCE_REQUIREMENT',
          gstAmount: 5000,
          hsnCode: '99996990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(5000)
        expect(result.exemptionReason).toContain('Professional membership')
      })
    })

    describe('Personal Consumption - Section 17(5)(g)', () => {
      it('should block ITC for personal consumption goods', () => {
        const input: ITCEligibilityInput = {
          category: 'GENERAL',
          description: 'Mobile phone for personal use',
          usageType: 'PERSONAL',
          personalUsePercentage: 100,
          gstAmount: 10000,
          hsnCode: '85171200'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(false)
        expect(result.blockedCategory).toBe('PERSONAL_USE')
        expect(result.blockingRule).toBe('Section 17(5)(g)')
        expect(result.blockReason).toContain('Personal consumption')
        expect(result.blockedAmount.toNumber()).toBe(10000)
      })

      it('should calculate partial ITC for mixed personal/business use', () => {
        const input: ITCEligibilityInput = {
          category: 'GENERAL',
          description: 'Mobile phone - mixed use',
          usageType: 'MIXED',
          businessUsePercentage: 70,
          personalUsePercentage: 30,
          gstAmount: 20000,
          hsnCode: '85171200'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(14000) // 70% of 20000
        expect(result.blockedAmount.toNumber()).toBe(6000) // 30% personal use
        expect(result.partialEligibility).toBe(true)
        expect(result.businessUsePercentage).toBe(70)
      })
    })

    describe('Travel Benefits to Employees - Section 17(5)(h)', () => {
      it('should block ITC for travel benefits to employees', () => {
        const input: ITCEligibilityInput = {
          category: 'TRAVEL',
          description: 'Employee vacation trip',
          isForEmployees: true,
          travelPurpose: 'VACATION',
          isPersonalTravel: true,
          gstAmount: 30000,
          hsnCode: '99641990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(false)
        expect(result.blockedCategory).toBe('TRAVEL_BENEFITS')
        expect(result.blockingRule).toBe('Section 17(5)(h)')
        expect(result.blockReason).toContain('Travel benefits to employees')
        expect(result.blockedAmount.toNumber()).toBe(30000)
      })

      it('should allow ITC for business travel', () => {
        const input: ITCEligibilityInput = {
          category: 'TRAVEL',
          description: 'Client meeting travel',
          isForEmployees: true,
          travelPurpose: 'BUSINESS',
          isBusinessTravel: true,
          gstAmount: 25000,
          hsnCode: '99641990'
        }

        const result = checkITCEligibility(input)

        expect(result.isEligible).toBe(true)
        expect(result.eligibleAmount.toNumber()).toBe(25000)
        expect(result.exemptionReason).toContain('Business travel')
      })
    })
  })

  describe('Proportionate ITC Calculation (RED Phase)', () => {
    it('should calculate proportionate ITC for common credits', () => {
      const input: ProportionateITCInput = {
        totalGST: 100000,
        exemptSupplies: 200000,
        taxableSupplies: 800000,
        totalTurnover: 1000000,
        period: '2024-04'
      }

      const result = calculateProportionateITC(input)

      expect(result.eligibleITC.toNumber()).toBe(80000) // 80% eligible
      expect(result.reversedITC.toNumber()).toBe(20000) // 20% to be reversed
      expect(result.exemptSupplyPercentage).toBe(20)
      expect(result.taxableSupplyPercentage).toBe(80)
    })

    it('should handle 100% taxable supplies', () => {
      const input: ProportionateITCInput = {
        totalGST: 50000,
        exemptSupplies: 0,
        taxableSupplies: 500000,
        totalTurnover: 500000,
        period: '2024-04'
      }

      const result = calculateProportionateITC(input)

      expect(result.eligibleITC.toNumber()).toBe(50000) // 100% eligible
      expect(result.reversedITC.toNumber()).toBe(0)
      expect(result.exemptSupplyPercentage).toBe(0)
    })

    it('should apply de minimis rule for small exempt supplies', () => {
      const input: ProportionateITCInput = {
        totalGST: 100000,
        exemptSupplies: 40000, // 4% of total turnover
        taxableSupplies: 960000,
        totalTurnover: 1000000,
        period: '2024-04'
      }

      const result = calculateProportionateITC(input)

      // De minimis rule: if exempt supplies < 5% of total turnover, no reversal required
      expect(result.eligibleITC.toNumber()).toBe(100000) // Full ITC
      expect(result.reversedITC.toNumber()).toBe(0)
      expect(result.deMinimisApplied).toBe(true)
    })
  })

  describe('Rule 36(4) - Provisional ITC Limit (RED Phase)', () => {
    it('should limit ITC to 105% of GSTR-2B (old rule)', () => {
      const input: Rule36_4Input = {
        claimedITC: 110000,
        gstr2bITC: 100000,
        ruleVersion: 'OLD', // Before October 2022
        period: '2022-09'
      }

      const result = applyRule36_4(input)

      expect(result.allowedITC.toNumber()).toBe(105000) // 105% of 100000
      expect(result.excessITC.toNumber()).toBe(5000)
      expect(result.isCompliant).toBe(false)
      expect(result.limitPercentage).toBe(105)
    })

    it('should limit ITC to 100% of GSTR-2B (new rule)', () => {
      const input: Rule36_4Input = {
        claimedITC: 110000,
        gstr2bITC: 100000,
        ruleVersion: 'NEW', // After October 2022
        period: '2023-01'
      }

      const result = applyRule36_4(input)

      expect(result.allowedITC.toNumber()).toBe(100000) // 100% of GSTR-2B
      expect(result.excessITC.toNumber()).toBe(10000)
      expect(result.isCompliant).toBe(false)
      expect(result.limitPercentage).toBe(100)
    })

    it('should allow full ITC when within limits', () => {
      const input: Rule36_4Input = {
        claimedITC: 95000,
        gstr2bITC: 100000,
        ruleVersion: 'NEW',
        period: '2024-04'
      }

      const result = applyRule36_4(input)

      expect(result.allowedITC.toNumber()).toBe(95000)
      expect(result.excessITC.toNumber()).toBe(0)
      expect(result.isCompliant).toBe(true)
    })

    it('should handle zero GSTR-2B amount', () => {
      const input: Rule36_4Input = {
        claimedITC: 50000,
        gstr2bITC: 0,
        ruleVersion: 'NEW',
        period: '2024-04'
      }

      const result = applyRule36_4(input)

      expect(result.allowedITC.toNumber()).toBe(0)
      expect(result.excessITC.toNumber()).toBe(50000)
      expect(result.isCompliant).toBe(false)
      expect(result.warningMessage).toContain('GSTR-2B shows zero ITC')
    })
  })

  describe('ITC Reversal Scenarios (RED Phase)', () => {
    it('should calculate reversal for non-payment within 180 days', () => {
      const input: ITCReversalInput = {
        originalITC: 100000,
        reason: 'NON_PAYMENT_180_DAYS',
        invoiceDate: new Date('2024-01-15'),
        currentDate: new Date('2024-08-15'), // 7 months later
        supplierName: 'ABC Supplier'
      }

      const result = calculateITCReversal(input)

      expect(result.reversalAmount.toNumber()).toBe(100000) // Full reversal
      expect(result.interestAmount.toNumber()).toBeGreaterThan(0) // Interest calculated
      expect(result.totalAmount.toNumber()).toBeGreaterThan(100000)
      expect(result.reversalReason).toContain('Non-payment to supplier within 180 days')
      expect(result.interestPeriod).toBe(5) // 5 months late
    })

    it('should calculate reversal for goods lost or destroyed', () => {
      const input: ITCReversalInput = {
        originalITC: 50000,
        reason: 'GOODS_LOST',
        lossPercentage: 40,
        lossDate: new Date('2024-04-15'),
        lossReason: 'Fire accident'
      }

      const result = calculateITCReversal(input)

      expect(result.reversalAmount.toNumber()).toBe(20000) // 40% of 50000
      expect(result.interestAmount.toNumber()).toBe(0) // No interest for loss
      expect(result.totalAmount.toNumber()).toBe(20000)
      expect(result.reversalReason).toContain('Goods lost/destroyed - 40%')
    })

    it('should calculate reversal for change in usage from business to personal', () => {
      const input: ITCReversalInput = {
        originalITC: 80000,
        reason: 'USAGE_CHANGE',
        personalUsePercentage: 60,
        changeDate: new Date('2024-04-15'),
        changeReason: 'Asset transferred to personal use'
      }

      const result = calculateITCReversal(input)

      expect(result.reversalAmount.toNumber()).toBe(48000) // 60% of 80000
      expect(result.interestAmount.toNumber()).toBe(0) // No interest for usage change
      expect(result.totalAmount.toNumber()).toBe(48000)
      expect(result.reversalReason).toContain('Changed to personal use - 60%')
    })

    it('should calculate reversal for capital goods sold before 5 years', () => {
      const input: ITCReversalInput = {
        originalITC: 200000,
        reason: 'CAPITAL_GOODS_SALE',
        capitalGoodsAge: 2.5, // 2.5 years
        saleDate: new Date('2024-04-15'),
        saleAmount: 300000
      }

      const result = calculateITCReversal(input)

      // Reversal = (5 - 2.5) / 5 * 200000 = 50% of ITC
      expect(result.reversalAmount.toNumber()).toBe(100000)
      expect(result.reversalReason).toContain('Capital goods sold before 5 years')
      expect(result.remainingLife).toBe(2.5)
    })
  })

  describe('ITC Conditions Validation (RED Phase)', () => {
    it('should validate all conditions for ITC claim', () => {
      const conditions = {
        hasValidInvoice: true,
        goodsServicesReceived: true,
        taxPaidBySupplier: true,
        gstr3bFiled: true,
        withinTimeLimit: true,
        notPersonalConsumption: true,
        supplierExists: true
      }

      const result = validateITCConditions(conditions)

      expect(result.canClaimITC).toBe(true)
      expect(result.failedConditions).toHaveLength(0)
      expect(result.complianceScore).toBe(100)
    })

    it('should identify failed conditions', () => {
      const conditions = {
        hasValidInvoice: false,
        goodsServicesReceived: true,
        taxPaidBySupplier: false,
        gstr3bFiled: true,
        withinTimeLimit: false,
        notPersonalConsumption: true,
        supplierExists: true
      }

      const result = validateITCConditions(conditions)

      expect(result.canClaimITC).toBe(false)
      expect(result.failedConditions).toContain('Valid tax invoice required')
      expect(result.failedConditions).toContain('Tax must be paid by supplier')
      expect(result.failedConditions).toContain('ITC claim time limit exceeded')
      expect(result.complianceScore).toBeLessThan(60)
    })

    it('should check time limit for ITC claim', () => {
      const invoiceDate = new Date('2023-04-15')
      const currentDate = new Date('2024-10-15') // More than 3 years

      const timeCheck = validateITCTimeLimit(invoiceDate, currentDate)

      expect(timeCheck.isWithinLimit).toBe(false)
      expect(timeCheck.daysElapsed).toBeGreaterThan(1095) // More than 3 years
      expect(timeCheck.limitType).toBe('THREE_YEARS')
    })
  })

  describe('Expense Analysis for Blocking (RED Phase)', () => {
    it('should analyze expense description and suggest blocking category', () => {
      const expenses = [
        'Company car purchase - Hyundai Creta',
        'Employee lunch catering services',
        'Office building construction work',
        'Golf club membership for directors',
        'Group health insurance premium',
        'Business laptop purchase',
        'Factory machinery installation'
      ]

      expenses.forEach(description => {
        const analysis = analyzeExpenseForBlocking(description)
        
        expect(analysis.description).toBe(description)
        expect(analysis.suggestedCategory).toBeDefined()
        expect(analysis.confidenceScore).toBeGreaterThan(0)
        expect(analysis.blockingRisk).toBeDefined()
      })
    })

    it('should identify motor vehicle expenses', () => {
      const analysis = analyzeExpenseForBlocking('Mahindra Scorpio purchase for office use')

      expect(analysis.suggestedCategory).toBe('MOTOR_VEHICLE')
      expect(analysis.blockingRisk).toBe('HIGH')
      expect(analysis.confidenceScore).toBeGreaterThan(0.8)
      expect(analysis.keywords).toContain('vehicle')
    })

    it('should identify food and beverage expenses', () => {
      const analysis = analyzeExpenseForBlocking('Outdoor catering for employee event')

      expect(analysis.suggestedCategory).toBe('FOOD_BEVERAGE')
      expect(analysis.blockingRisk).toBe('HIGH')
      expect(analysis.recommendations).toContain('Check if statutory requirement')
    })

    it('should identify low-risk business expenses', () => {
      const analysis = analyzeExpenseForBlocking('Office stationery and supplies')

      expect(analysis.suggestedCategory).toBe('INPUTS')
      expect(analysis.blockingRisk).toBe('LOW')
      expect(analysis.confidenceScore).toBeGreaterThan(0.7)
    })
  })

  describe('Integration Tests (RED Phase)', () => {
    it('should handle complex scenario with multiple blocking rules', () => {
      const invoice = {
        lineItems: [
          {
            description: 'Company car - Toyota Camry',
            amount: 1000000,
            gstAmount: 180000,
            category: 'MOTOR_VEHICLE'
          },
          {
            description: 'Employee food vouchers',
            amount: 50000,
            gstAmount: 2500,
            category: 'FOOD_BEVERAGE'
          },
          {
            description: 'Office laptop computers',
            amount: 200000,
            gstAmount: 36000,
            category: 'INPUTS'
          }
        ]
      }

      const result = processInvoiceForITC(invoice)

      expect(result.totalGST.toNumber()).toBe(218500)
      expect(result.eligibleITC.toNumber()).toBe(36000) // Only laptops
      expect(result.blockedITC.toNumber()).toBe(182500) // Car + food
      expect(result.blockingDetails).toHaveLength(2)
    })

    it('should validate Rule 36(4) compliance for the month', () => {
      const monthlyData = {
        totalClaimedITC: 500000,
        gstr2bITC: 450000,
        period: '2024-04',
        ruleVersion: 'NEW'
      }

      const compliance = validateMonthlyRule36_4(monthlyData)

      expect(compliance.isCompliant).toBe(false)
      expect(compliance.excessClaimed.toNumber()).toBe(50000)
      expect(compliance.actionRequired).toContain('Reverse excess ITC')
    })
  })
})

// Type declarations for TDD functions (will fail initially - RED phase)
declare function validateITCTimeLimit(invoiceDate: Date, currentDate: Date): {
  isWithinLimit: boolean
  daysElapsed: number
  limitType: string
}

declare function processInvoiceForITC(invoice: any): {
  totalGST: any
  eligibleITC: any
  blockedITC: any
  blockingDetails: any[]
}

declare function validateMonthlyRule36_4(data: any): {
  isCompliant: boolean
  excessClaimed: any
  actionRequired: string
}