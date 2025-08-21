/**
 * Approval Role Service
 * UOL-215: Invoice Approval Workflow System
 * 
 * Manages approval roles, hierarchy, and permissions for the invoice approval workflow
 */

import { ApprovalRole, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ApprovalRoleWithUser = ApprovalRole & { user: User };

export interface CreateApprovalRoleData {
  userId: string;
  name: string;
  level: number;
  canApprove?: boolean;
  canReject?: boolean;
  canDelegate?: boolean;
  canModify?: boolean;
  maxApprovalAmount?: number | null;
  currency?: string;
}

export interface UpdateApprovalRoleData {
  name?: string;
  level?: number;
  canApprove?: boolean;
  canReject?: boolean;
  canDelegate?: boolean;
  canModify?: boolean;
  maxApprovalAmount?: number | null;
  currency?: string;
  isActive?: boolean;
}

export class ApprovalRoleService {
  /**
   * Create a new approval role with validation
   */
  async createRole(data: CreateApprovalRoleData): Promise<ApprovalRole> {
    try {
      // Validate role level (1-10) first
      if (data.level < 1 || data.level > 10) {
        throw new Error('Role level must be between 1 and 10');
      }

      // Validate maximum approval amount
      if (data.maxApprovalAmount !== null && data.maxApprovalAmount !== undefined && data.maxApprovalAmount < 0) {
        throw new Error('Maximum approval amount must be positive');
      }

      // Validate permission consistency
      this.validatePermissionConsistency({
        canApprove: data.canApprove ?? true,
        canModify: data.canModify ?? false,
      });

      // Validate user exists
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check for duplicate role name for same user
      const existingRole = await prisma.approvalRole.findUnique({
        where: {
          userId_name: {
            userId: data.userId,
            name: data.name,
          },
        },
      });

      if (existingRole) {
        throw new Error('Role name already exists for this user');
      }

      // Create the role
      const role = await prisma.approvalRole.create({
        data,
      });

      return role;
    } catch (error) {
      if (error instanceof Error) {
        // Re-throw validation errors as-is
        if (error.message.includes('Role level must be between') ||
            error.message.includes('Maximum approval amount must be positive') ||
            error.message.includes('Cannot modify invoices without approval') ||
            error.message.includes('Role name already exists') ||
            error.message.includes('User not found')) {
          throw error;
        }
      }
      // Wrap database and other errors in generic message
      throw new Error('Failed to create approval role');
    }
  }

  /**
   * Get role by ID with user information
   */
  async getRoleById(roleId: string): Promise<ApprovalRoleWithUser | null> {
    return prisma.approvalRole.findUnique({
      where: { id: roleId },
      include: { user: true },
    });
  }

  /**
   * Get all roles for a user ordered by level
   */
  async getRolesByUserId(userId: string): Promise<ApprovalRole[]> {
    return prisma.approvalRole.findMany({
      where: { userId },
      orderBy: { level: 'asc' },
    });
  }

  /**
   * Get only active roles for a user ordered by level
   */
  async getActiveRolesByUserId(userId: string): Promise<ApprovalRole[]> {
    return prisma.approvalRole.findMany({
      where: { 
        userId, 
        isActive: true 
      },
      orderBy: { level: 'asc' },
    });
  }

  /**
   * Update an existing approval role
   */
  async updateRole(roleId: string, data: UpdateApprovalRoleData): Promise<ApprovalRole> {
    try {
      // Validate permission consistency if provided
      if (data.canApprove !== undefined || data.canModify !== undefined) {
        // Get current role to merge with updates
        const currentRole = await prisma.approvalRole.findUnique({
          where: { id: roleId },
        });

        if (!currentRole) {
          throw new Error('Role not found');
        }

        this.validatePermissionConsistency({
          canApprove: data.canApprove ?? currentRole.canApprove,
          canModify: data.canModify ?? currentRole.canModify,
        });
      }

      return await prisma.approvalRole.update({
        where: { id: roleId },
        data,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update approval role');
    }
  }

  /**
   * Deactivate a role instead of deleting for audit trail
   */
  async deactivateRole(roleId: string): Promise<ApprovalRole> {
    return await prisma.approvalRole.update({
      where: { id: roleId },
      data: { isActive: false },
    });
  }

  /**
   * Validate role hierarchy for approval chains
   * Returns false if there are gaps in the hierarchy levels
   */
  async validateRoleHierarchy(roles: Array<{ level: number }>): Promise<boolean> {
    const levels = roles.map(role => role.level).sort((a, b) => a - b);
    
    // Check for gaps in hierarchy (levels should be consecutive)
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Find the required role for a given approval amount
   */
  async getRequiredRoleForAmount(
    userId: string, 
    amount: number, 
    currency: string
  ): Promise<ApprovalRole | null> {
    const roles = await this.getActiveRolesByUserId(userId);
    
    // Convert amount to INR for comparison if needed
    const amountInINR = currency === 'INR' ? amount : await this.convertToINR(amount, currency);
    
    // Find the role with the lowest level that can approve this amount
    for (const role of roles) {
      if (role.currency !== 'INR' && role.maxApprovalAmount !== null) {
        // Convert role limit to INR for comparison
        const roleLimitInINR = await this.convertToINR(role.maxApprovalAmount, role.currency);
        if (amountInINR <= roleLimitInINR) {
          return role;
        }
      } else {
        // Role is in INR or has unlimited approval
        if (role.maxApprovalAmount === null || amountInINR <= role.maxApprovalAmount) {
          return role;
        }
      }
    }
    
    return null;
  }

  /**
   * Convert amount to INR for comparison
   * This is a placeholder implementation - in real system would use exchange rate service
   */
  async convertToINR(amount: number, currency: string): Promise<number> {
    // Mock exchange rates for testing
    const exchangeRates: Record<string, number> = {
      USD: 82.5,
      EUR: 90.0,
      GBP: 102.0,
      INR: 1.0,
    };

    const rate = exchangeRates[currency] || 1.0;
    return amount * rate;
  }

  /**
   * Validate permission consistency
   */
  private validatePermissionConsistency(permissions: { canApprove: boolean; canModify: boolean }): void {
    if (permissions.canModify && !permissions.canApprove) {
      throw new Error('Cannot modify invoices without approval permission');
    }
  }
}