/**
 * @file Approval Workflow Service
 * @description Service for managing approval actions and workflow state
 * Following TDD GREEN phase - minimal implementation to make tests pass
 */

import { db } from '@/lib/prisma'
import type { 
  ApprovalWorkflow, 
  ApprovalAction, 
  ApprovalRole, 
  ApprovalDelegation,
  User 
} from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

export interface ApprovalActionData {
  workflowId: string
  action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'DELEGATE'
  decidedBy: string
  roleId: string
  comments?: string
  attachments?: string[]
  delegatedTo?: string
  delegatedUntil?: Date
  delegationReason?: string
  requestedChanges?: string
  changePriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
}

export interface WorkflowValidation {
  isValid: boolean
  errors: string[]
}

export class ApprovalWorkflowService {
  constructor() {
    // Constructor now ready for GREEN phase - tests should pass
  }

  /**
   * Take an approval action on a workflow
   */
  async takeAction(actionData: ApprovalActionData): Promise<ApprovalAction> {
    return await db.$transaction(async (tx) => {
      // Get workflow with invoice details
      const workflow = await tx.approvalWorkflow.findUnique({
        where: { id: actionData.workflowId },
        include: { 
          invoice: true,
          rule: true 
        }
      })

      if (!workflow) {
        throw new Error('Workflow not found')
      }

      if (workflow.status !== 'PENDING') {
        throw new Error('Cannot take action on completed workflow')
      }

      // Validate user permissions
      const userRole = await tx.approvalRole.findFirst({
        where: {
          id: actionData.roleId,
          userId: actionData.decidedBy
        }
      })

      if (!userRole) {
        throw new Error('User does not have permission to approve')
      }

      if (!userRole.canApprove && actionData.action === 'APPROVE') {
        throw new Error('User does not have permission to approve')
      }

      if (!userRole.canReject && actionData.action === 'REJECT') {
        throw new Error('User does not have permission to reject')
      }

      // Check approval amount limits
      if (userRole.maxApprovalAmount && workflow.invoice) {
        const invoiceAmount = workflow.invoice.totalInINR || workflow.invoice.totalAmount
        if (invoiceAmount.gt(userRole.maxApprovalAmount)) {
          throw new Error('Invoice amount exceeds user approval limit')
        }
      }

      // Create approval action record
      const action = await tx.approvalAction.create({
        data: {
          workflowId: actionData.workflowId,
          roleId: actionData.roleId,
          action: actionData.action,
          level: workflow.currentLevel,
          decidedBy: actionData.decidedBy,
          comments: actionData.comments,
          attachments: actionData.attachments || [],
          delegatedTo: actionData.delegatedTo,
          delegatedUntil: actionData.delegatedUntil,
          delegationReason: actionData.delegationReason,
          requestedChanges: actionData.requestedChanges,
          changePriority: actionData.changePriority,
        }
      })

      // Update workflow based on action
      let workflowUpdate: any = {}

      switch (actionData.action) {
        case 'APPROVE':
          if (workflow.currentLevel >= workflow.requiredLevel) {
            // Final approval - complete workflow
            workflowUpdate = {
              status: 'APPROVED',
              finalDecision: 'APPROVED',
              finalDecisionBy: actionData.decidedBy,
              finalDecisionAt: new Date(),
              completedAt: new Date()
            }
          } else {
            // Advance to next level
            workflowUpdate = {
              currentLevel: workflow.currentLevel + 1
            }
          }
          break

        case 'REJECT':
          workflowUpdate = {
            status: 'REJECTED',
            finalDecision: 'REJECTED',
            finalDecisionBy: actionData.decidedBy,
            finalDecisionAt: new Date(),
            completedAt: new Date()
          }
          break

        case 'DELEGATE':
          if (actionData.delegatedTo) {
            // Verify delegate user exists
            const delegateUser = await tx.user.findUnique({
              where: { id: actionData.delegatedTo }
            })
            if (!delegateUser) {
              throw new Error('Delegate user not found')
            }

            // Create delegation record
            await tx.approvalDelegation.create({
              data: {
                fromRoleId: actionData.roleId,
                toUserId: actionData.delegatedTo,
                startDate: new Date(),
                endDate: actionData.delegatedUntil || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                delegationType: 'TEMPORARY',
                reason: actionData.delegationReason || 'Approval delegation',
                isActive: true
              }
            })
          }
          break

        case 'REQUEST_CHANGES':
          // Workflow remains pending for changes
          break
      }

      // Update workflow if needed
      if (Object.keys(workflowUpdate).length > 0) {
        await tx.approvalWorkflow.update({
          where: { id: actionData.workflowId },
          data: workflowUpdate
        })
      }

      return action
    })
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string): Promise<ApprovalWorkflow[]> {
    // Get user's roles
    const userRoles = await db.approvalRole.findMany({
      where: { userId, isActive: true }
    })

    if (userRoles.length === 0) {
      return []
    }

    // Find workflows where user's role level matches current level
    const workflows = await db.approvalWorkflow.findMany({
      where: {
        status: 'PENDING',
        rule: {
          approverRoles: {
            hasSome: userRoles.map(role => role.name)
          }
        }
      },
      include: {
        invoice: {
          include: { client: true }
        },
        rule: true,
        actions: true
      },
      orderBy: { dueDate: 'asc' }
    })

    return workflows.filter(workflow => {
      const requiredRole = userRoles.find(role => role.level === workflow.currentLevel)
      return requiredRole !== undefined
    })
  }

  /**
   * Get approval history for a user
   */
  async getApprovalHistory(userId: string): Promise<ApprovalAction[]> {
    const actions = await db.approvalAction.findMany({
      where: { decidedBy: userId },
      include: {
        workflow: {
          include: {
            invoice: {
              include: { client: true }
            }
          }
        },
        role: true
      },
      orderBy: { decidedAt: 'desc' }
    })

    return actions
  }

  /**
   * Get workflow status with actions
   */
  async getWorkflowStatus(workflowId: string): Promise<ApprovalWorkflow | null> {
    const workflow = await db.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: {
        invoice: {
          include: { client: true }
        },
        rule: true,
        actions: {
          include: { role: true },
          orderBy: { decidedAt: 'asc' }
        },
        notifications: true
      }
    })

    return workflow
  }

  /**
   * Check if user can take action on workflow
   */
  async canUserTakeAction(
    userId: string, 
    workflowId: string, 
    action: string
  ): Promise<boolean> {
    const workflow = await db.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: { 
        invoice: true,
        rule: true 
      }
    })

    if (!workflow || workflow.status !== 'PENDING') {
      return false
    }

    // Check direct role permission
    const userRole = await db.approvalRole.findFirst({
      where: {
        userId,
        level: workflow.currentLevel,
        isActive: true
      }
    })

    if (userRole) {
      // Check action permissions
      switch (action) {
        case 'APPROVE':
          return userRole.canApprove
        case 'REJECT':
          return userRole.canReject
        case 'DELEGATE':
          return userRole.canDelegate
        default:
          return false
      }
    }

    // Check delegation permissions
    const delegation = await db.approvalDelegation.findFirst({
      where: {
        toUserId: userId,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: { fromRole: true }
    })

    if (delegation && delegation.fromRole.level === workflow.currentLevel) {
      // Check amount limits for delegation
      if (delegation.maxAmount && workflow.invoice) {
        const invoiceAmount = workflow.invoice.totalInINR || workflow.invoice.totalAmount
        return invoiceAmount.lte(delegation.maxAmount)
      }
      return true
    }

    return false
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(
    workflowId: string, 
    cancelledBy: string, 
    reason?: string
  ): Promise<ApprovalWorkflow> {
    const workflow = await db.approvalWorkflow.findUnique({
      where: { id: workflowId }
    })

    if (!workflow) {
      throw new Error('Workflow not found')
    }

    if (workflow.status !== 'PENDING') {
      throw new Error('Cannot cancel completed workflow')
    }

    const updatedWorkflow = await db.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        finalDecision: 'CANCELLED',
        finalDecisionBy: cancelledBy
      }
    })

    return updatedWorkflow
  }

  /**
   * Bypass workflow (admin only)
   */
  async bypassWorkflow(
    workflowId: string,
    bypassedBy: string,
    reason: string
  ): Promise<ApprovalWorkflow> {
    const workflow = await db.approvalWorkflow.findUnique({
      where: { id: workflowId }
    })

    if (!workflow) {
      throw new Error('Workflow not found')
    }

    const updatedWorkflow = await db.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: 'APPROVED',
        finalDecision: 'APPROVED',
        finalDecisionBy: bypassedBy,
        finalDecisionAt: new Date(),
        completedAt: new Date(),
        bypassReason: reason,
        bypassedBy,
        bypassedAt: new Date()
      }
    })

    return updatedWorkflow
  }

  /**
   * Find expired workflows for escalation
   */
  async findExpiredWorkflows(): Promise<ApprovalWorkflow[]> {
    const now = new Date()
    
    const workflows = await db.approvalWorkflow.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: now
        }
      },
      include: {
        invoice: {
          include: { client: true }
        },
        rule: true
      }
    })

    return workflows
  }

  /**
   * Escalate workflow to next level
   */
  async escalateWorkflow(workflow: ApprovalWorkflow): Promise<ApprovalWorkflow> {
    const canEscalate = workflow.currentLevel < workflow.requiredLevel && workflow.escalateToRole

    if (!canEscalate) {
      // Mark as expired if no more escalation possible
      return await db.approvalWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: 'EXPIRED',
          finalDecision: 'EXPIRED',
          completedAt: new Date()
        }
      })
    }

    // Escalate to next level
    const newDueDate = new Date()
    newDueDate.setHours(newDueDate.getHours() + 24) // Reset deadline

    const escalatedWorkflow = await db.approvalWorkflow.update({
      where: { id: workflow.id },
      data: {
        currentLevel: workflow.currentLevel + 1,
        escalatedAt: new Date(),
        escalatedTo: workflow.escalateToRole,
        dueDate: newDueDate
      }
    })

    return escalatedWorkflow
  }

  /**
   * Additional helper methods for edge cases
   */

  async validateDelegation(delegation: ApprovalDelegation): Promise<boolean> {
    // Check if delegate user exists
    const users = await db.user.findMany({
      where: { id: delegation.toUserId }
    })
    return users.length > 0
  }

  async cleanupExpiredDelegations(): Promise<void> {
    const now = new Date()
    await db.approvalDelegation.updateMany({
      where: {
        isActive: true,
        endDate: { lt: now }
      },
      data: { isActive: false }
    })
  }

  async detectCircularDelegation(userId: string): Promise<boolean> {
    // Simple implementation - check for direct circular references
    const delegations = await db.approvalDelegation.findMany({
      where: { isActive: true }
    })

    // Create adjacency list
    const graph = new Map<string, string[]>()
    delegations.forEach(delegation => {
      const from = delegation.fromRoleId
      const to = delegation.toUserId
      if (!graph.has(from)) graph.set(from, [])
      graph.get(from)?.push(to)
    })

    // Simple DFS to detect cycles (basic implementation)
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    function dfs(node: string): boolean {
      visited.add(node)
      recursionStack.add(node)

      const neighbors = graph.get(node) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true
        } else if (recursionStack.has(neighbor)) {
          return true // Cycle detected
        }
      }

      recursionStack.delete(node)
      return false
    }

    for (const [node] of graph) {
      if (!visited.has(node)) {
        if (dfs(node)) return true
      }
    }

    return false
  }

  async canDelegateWorkflow(userId: string, workflow: any): Promise<boolean> {
    const delegations = await db.approvalDelegation.findMany({
      where: {
        toUserId: userId,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      }
    })

    return delegations.some(delegation => {
      if (delegation.maxAmount && workflow.invoice?.totalInINR) {
        return workflow.invoice.totalInINR.lte(delegation.maxAmount)
      }
      return true
    })
  }

  async trackDelegationUsage(delegationId: string): Promise<void> {
    await db.approvalDelegation.update({
      where: { id: delegationId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    })
  }

  async validateWorkflowIntegrity(workflow: ApprovalWorkflow): Promise<WorkflowValidation> {
    const errors: string[] = []

    if (workflow.currentLevel > workflow.requiredLevel) {
      errors.push('Current level cannot exceed required level')
    }

    if (workflow.status === 'APPROVED' && !workflow.completedAt) {
      errors.push('Approved workflow must have completion date')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  async findOrphanedWorkflows(): Promise<ApprovalWorkflow[]> {
    const workflows = await db.approvalWorkflow.findMany({
      where: {
        status: 'PENDING'
      }
    })

    // Filter out workflows with non-existent invoices
    const orphaned: ApprovalWorkflow[] = []
    for (const workflow of workflows) {
      const invoice = await db.invoice.findUnique({
        where: { id: workflow.invoiceId }
      })
      if (!invoice) {
        orphaned.push(workflow)
      }
    }

    return orphaned
  }

  async cleanupStaleWorkflows(): Promise<void> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const staleWorkflows = await db.approvalWorkflow.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: thirtyDaysAgo },
        actions: { none: {} } // No actions taken
      }
    })

    for (const workflow of staleWorkflows) {
      await db.approvalWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: 'CANCELLED',
          completedAt: new Date()
        }
      })
    }
  }

  async repairInconsistentWorkflows(): Promise<void> {
    const inconsistentWorkflows = await db.approvalWorkflow.findMany({
      where: {
        requiredLevel: 0
      }
    })

    for (const workflow of inconsistentWorkflows) {
      const rule = await db.approvalRule.findUnique({
        where: { id: workflow.ruleId }
      })

      if (rule) {
        await db.approvalWorkflow.update({
          where: { id: workflow.id },
          data: { requiredLevel: rule.requiredApprovals }
        })
      }
    }
  }

  async expireWorkflow(workflow: ApprovalWorkflow): Promise<ApprovalWorkflow> {
    return await db.approvalWorkflow.update({
      where: { id: workflow.id },
      data: {
        status: 'EXPIRED',
        finalDecision: 'EXPIRED',
        completedAt: new Date()
      }
    })
  }

  async createDelegation(delegationData: any): Promise<void> {
    const existingDelegation = await db.approvalDelegation.findMany({
      where: {
        fromRoleId: delegationData.fromRoleId,
        isActive: true
      }
    })

    if (existingDelegation.length > 0) {
      throw new Error('Active delegation already exists for this role')
    }

    await db.approvalDelegation.create({
      data: delegationData
    })
  }
}