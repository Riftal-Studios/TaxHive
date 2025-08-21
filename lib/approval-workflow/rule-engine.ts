/**
 * @file Approval Rule Engine
 * @description Rule evaluation and workflow creation engine
 * Following TDD GREEN phase - minimal implementation to make tests pass
 */

import { db } from '@/lib/prisma'
import type { ApprovalRule, Invoice, ApprovalWorkflow } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

export interface ApprovalRequirement {
  levels: number[]
  roles: string[]
  parallelApproval: boolean
  timeoutHours: number
}

export interface RuleValidation {
  isValid: boolean
  errors: string[]
}

export class ApprovalRuleEngine {
  constructor() {
    // Constructor now ready for GREEN phase - tests should pass
  }

  /**
   * Evaluate which approval rules apply to an invoice
   */
  async evaluateRules(invoice: Invoice): Promise<ApprovalRule[]> {
    // Convert invoice amount to INR for rule matching
    const amountInINR = invoice.currency === 'INR' 
      ? invoice.totalAmount 
      : invoice.totalInINR || new Decimal(0)

    const rules = await db.approvalRule.findMany({
      where: {
        userId: invoice.userId,
        isActive: true,
        OR: [
          {
            AND: [
              { minAmount: { lte: amountInINR } },
              { maxAmount: { gte: amountInINR } }
            ]
          },
          {
            AND: [
              { minAmount: { lte: amountInINR } },
              { maxAmount: null }
            ]
          }
        ],
      },
      orderBy: { priority: 'desc' }
    })

    // Filter by currency and invoice type
    const filteredRules = rules.filter(rule => {
      // Currency filter
      if (rule.currency && rule.currency !== 'INR' && rule.currency !== invoice.currency) {
        return false
      }
      
      // Invoice type filter
      if (rule.invoiceType && rule.invoiceType !== invoice.invoiceType) {
        return false
      }
      
      return true
    })

    // Return highest priority rule only (to avoid conflicts)
    return filteredRules.slice(0, 1)
  }

  /**
   * Create approval workflow for an invoice
   */
  async createWorkflow(
    invoice: Invoice, 
    rules: ApprovalRule[], 
    initiatedBy: string
  ): Promise<ApprovalWorkflow> {
    // Check if workflow already exists
    const existingWorkflow = await db.approvalWorkflow.findUnique({
      where: { invoiceId: invoice.id }
    })

    if (existingWorkflow) {
      throw new Error('Invoice already has an approval workflow')
    }

    if (rules.length === 0) {
      throw new Error('No applicable approval rules found')
    }

    const rule = rules[0] // Use first (highest priority) rule
    const requiredLevel = rule.requiredApprovals

    // Calculate due date based on timeout
    let dueDate: Date | undefined
    if (rule.approvalTimeout) {
      dueDate = new Date()
      dueDate.setHours(dueDate.getHours() + rule.approvalTimeout)
    }

    const workflow = await db.approvalWorkflow.create({
      data: {
        userId: invoice.userId,
        invoiceId: invoice.id,
        ruleId: rule.id,
        status: 'PENDING',
        currentLevel: 1,
        requiredLevel,
        initiatedBy,
        dueDate,
      }
    })

    return workflow
  }

  /**
   * Calculate required approvals for an amount
   */
  async calculateRequiredApprovals(
    amount: Decimal, 
    currency: string
  ): Promise<ApprovalRequirement> {
    const rules = await db.approvalRule.findMany({
      where: {
        isActive: true,
        OR: [
          {
            AND: [
              { minAmount: { lte: amount } },
              { maxAmount: { gte: amount } }
            ]
          },
          {
            AND: [
              { minAmount: { lte: amount } },
              { maxAmount: null }
            ]
          }
        ],
        currency: {
          in: [currency, null, 'INR']
        }
      },
      orderBy: { priority: 'desc' }
    })

    if (rules.length === 0) {
      return {
        levels: [],
        roles: [],
        parallelApproval: false,
        timeoutHours: 24 // Default timeout
      }
    }

    const rule = rules[0]
    const levels = Array.from({ length: rule.requiredApprovals }, (_, i) => i + 1)

    return {
      levels,
      roles: rule.approverRoles,
      parallelApproval: rule.parallelApproval,
      timeoutHours: rule.approvalTimeout || 24
    }
  }

  /**
   * Validate approval rule configuration
   */
  async validateRule(rule: ApprovalRule): Promise<RuleValidation> {
    const errors: string[] = []

    // Validate amount range
    if (rule.minAmount && rule.maxAmount && rule.minAmount.gt(rule.maxAmount)) {
      errors.push('Minimum amount cannot be greater than maximum amount')
    }

    // Validate approver roles
    if (rule.approverRoles.length === 0) {
      errors.push('At least one approver role is required')
    }

    // Check if roles exist
    const existingRoles = await db.approvalRole.findMany({
      where: {
        name: { in: rule.approverRoles }
      }
    }) || []

    const existingRoleNames = existingRoles.map(r => r.name)
    const invalidRoles = rule.approverRoles.filter(role => !existingRoleNames.includes(role))
    
    invalidRoles.forEach(role => {
      errors.push(`Invalid approver role: ${role}`)
    })

    // Validate required approvals
    if (rule.requiredApprovals > rule.approverRoles.length) {
      errors.push('Required approvals cannot exceed number of approver roles')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}