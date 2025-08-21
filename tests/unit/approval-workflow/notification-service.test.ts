/**
 * @file Unit tests for Notification Service
 * @description TDD Tests for approval workflow notifications
 * Following RED-GREEN-REFACTOR cycle
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { NotificationService } from '@/lib/approval-workflow/notification-service'
import { db } from '@/lib/prisma'
import { queueManager } from '@/lib/queue/manager'
import type { ApprovalWorkflow, ApprovalNotification, User } from '@prisma/client'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  db: {
    approvalNotification: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    approvalRole: {
      findMany: vi.fn(),
    },
    approvalWorkflow: {
      findMany: vi.fn(),
    },
  },
}))

// Mock queue manager
vi.mock('@/lib/queue/manager', () => ({
  queueManager: {
    addJob: vi.fn(),
  },
}))

// Mock email service
vi.mock('@/lib/email/service', () => ({
  EmailService: {
    sendEmail: vi.fn(),
  },
}))

describe('NotificationService', () => {
  let notificationService: NotificationService
  let mockWorkflow: ApprovalWorkflow
  let mockApprovers: User[]
  let mockNotification: ApprovalNotification

  beforeEach(() => {
    vi.clearAllMocks()
    notificationService = new NotificationService()

    mockWorkflow = {
      id: 'workflow1',
      userId: 'user1',
      invoiceId: 'invoice1',
      ruleId: 'rule1',
      status: 'PENDING',
      currentLevel: 1,
      requiredLevel: 2,
      initiatedBy: 'user1',
      initiatedAt: new Date(),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ApprovalWorkflow

    mockApprovers = [
      {
        id: 'approver1',
        email: 'manager@example.com',
        name: 'Manager User',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'approver2',
        email: 'finance@example.com',
        name: 'Finance Head',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as User[]

    mockNotification = {
      id: 'notification1',
      workflowId: 'workflow1',
      type: 'APPROVAL_REQUIRED',
      recipientId: 'approver1',
      recipientRole: 'MANAGER',
      title: 'Approval Required',
      message: 'Invoice approval required',
      urgency: 'NORMAL',
      channels: ['EMAIL', 'IN_APP'],
      emailSent: false,
      inAppRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ApprovalNotification
  })

  describe('Service Initialization', () => {
    test('should throw error when NotificationService is not implemented', () => {
      // RED: This test should fail initially
      expect(() => new NotificationService()).toThrow('NotificationService not implemented')
    })
  })

  describe('Approval Request Notifications', () => {
    test('should send approval request notifications to approvers', async () => {
      // RED: This test should fail initially
      vi.mocked(db.approvalNotification.create).mockResolvedValue(mockNotification)
      vi.mocked(queueManager.addJob).mockResolvedValue({ id: 'job1' } as any)

      await notificationService.sendApprovalRequest(mockWorkflow, mockApprovers)

      expect(db.approvalNotification.create).toHaveBeenCalledTimes(2) // One for each approver
      expect(queueManager.addJob).toHaveBeenCalledWith(
        'email-notification',
        expect.objectContaining({
          type: 'approval_request',
          workflowId: 'workflow1',
        }),
        expect.any(Object)
      )
    })

    test('should create notification with correct details', async () => {
      // RED: This test should fail initially
      vi.mocked(db.approvalNotification.create).mockResolvedValue(mockNotification)

      await notificationService.sendApprovalRequest(mockWorkflow, [mockApprovers[0]])

      expect(db.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workflowId: 'workflow1',
          type: 'APPROVAL_REQUIRED',
          recipientId: 'approver1',
          title: expect.stringContaining('Approval Required'),
          message: expect.stringContaining('invoice approval'),
          urgency: 'NORMAL',
          channels: expect.arrayContaining(['EMAIL', 'IN_APP']),
        }),
      })
    })

    test('should set urgency based on due date', async () => {
      // RED: This test should fail initially
      const urgentWorkflow = {
        ...mockWorkflow,
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      }

      const urgentNotification = {
        ...mockNotification,
        urgency: 'HIGH',
      }

      vi.mocked(db.approvalNotification.create).mockResolvedValue(urgentNotification)

      await notificationService.sendApprovalRequest(urgentWorkflow, [mockApprovers[0]])

      expect(db.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          urgency: 'HIGH',
        }),
      })
    })

    test('should include workflow context in notification', async () => {
      // RED: This test should fail initially
      const workflowWithInvoice = {
        ...mockWorkflow,
        invoice: {
          invoiceNumber: 'FY24-25/001',
          totalInINR: '83500.00',
          client: {
            name: 'Test Client',
          },
        },
      }

      vi.mocked(db.approvalNotification.create).mockResolvedValue(mockNotification)

      await notificationService.sendApprovalRequest(workflowWithInvoice as any, [mockApprovers[0]])

      expect(db.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: expect.stringContaining('FY24-25/001'),
        }),
      })
    })

    test('should handle multiple notification channels', async () => {
      // RED: This test should fail initially
      const multiChannelNotification = {
        ...mockNotification,
        channels: ['EMAIL', 'IN_APP', 'SMS'],
      }

      vi.mocked(db.approvalNotification.create).mockResolvedValue(multiChannelNotification)

      await notificationService.sendApprovalRequest(mockWorkflow, [mockApprovers[0]])

      expect(queueManager.addJob).toHaveBeenCalledWith(
        'email-notification',
        expect.any(Object),
        expect.any(Object)
      )
      // Should also queue SMS notification if configured
    })
  })

  describe('Decision Notifications', () => {
    test('should send approval decision notification', async () => {
      // RED: This test should fail initially
      const approvedWorkflow = {
        ...mockWorkflow,
        status: 'APPROVED',
        finalDecision: 'APPROVED',
        finalDecisionBy: 'approver1',
        finalDecisionAt: new Date(),
      }

      const decisionNotification = {
        ...mockNotification,
        type: 'APPROVED',
        title: 'Invoice Approved',
        message: 'Your invoice has been approved',
      }

      vi.mocked(db.approvalNotification.create).mockResolvedValue(decisionNotification)

      await notificationService.sendDecisionNotification(approvedWorkflow, 'APPROVE')

      expect(db.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'APPROVED',
          title: expect.stringContaining('Approved'),
          recipientId: mockWorkflow.initiatedBy,
        }),
      })
    })

    test('should send rejection decision notification', async () => {
      // RED: This test should fail initially
      const rejectedWorkflow = {
        ...mockWorkflow,
        status: 'REJECTED',
        finalDecision: 'REJECTED',
        finalDecisionBy: 'approver1',
        finalDecisionAt: new Date(),
      }

      const rejectionNotification = {
        ...mockNotification,
        type: 'REJECTED',
        title: 'Invoice Rejected',
        message: 'Your invoice has been rejected',
        urgency: 'HIGH',
      }

      vi.mocked(db.approvalNotification.create).mockResolvedValue(rejectionNotification)

      await notificationService.sendDecisionNotification(rejectedWorkflow, 'REJECT')

      expect(db.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'REJECTED',
          title: expect.stringContaining('Rejected'),
          urgency: 'HIGH',
        }),
      })
    })

    test('should send changes requested notification', async () => {
      // RED: This test should fail initially
      const changesRequestedWorkflow = {
        ...mockWorkflow,
        status: 'PENDING',
      }

      const changesNotification = {
        ...mockNotification,
        type: 'REQUEST_CHANGES',
        title: 'Changes Requested',
        message: 'Changes have been requested for your invoice',
        urgency: 'NORMAL',
      }

      vi.mocked(db.approvalNotification.create).mockResolvedValue(changesNotification)

      await notificationService.sendDecisionNotification(changesRequestedWorkflow, 'REQUEST_CHANGES')

      expect(db.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'REQUEST_CHANGES',
          title: expect.stringContaining('Changes Requested'),
        }),
      })
    })

    test('should include decision details in notification', async () => {
      // RED: This test should fail initially
      const workflowWithAction = {
        ...mockWorkflow,
        actions: [
          {
            id: 'action1',
            action: 'APPROVE',
            comments: 'Approved after review',
            decidedBy: 'approver1',
            decidedAt: new Date(),
          },
        ],
      }

      vi.mocked(db.approvalNotification.create).mockResolvedValue(mockNotification)

      await notificationService.sendDecisionNotification(workflowWithAction as any, 'APPROVE')

      expect(db.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: expect.stringContaining('Approved after review'),
        }),
      })
    })
  })

  describe('Escalation Notifications', () => {
    test('should send escalation notification when workflow times out', async () => {
      // RED: This test should fail initially
      const expiredWorkflow = {
        ...mockWorkflow,
        dueDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (expired)
        escalatedTo: 'FINANCE_HEAD',
        escalatedAt: new Date(),
      }

      const escalationNotification = {
        ...mockNotification,
        type: 'ESCALATED',
        title: 'Approval Escalated',
        message: 'Invoice approval has been escalated due to timeout',
        urgency: 'HIGH',
        recipientRole: 'FINANCE_HEAD',
      }

      vi.mocked(db.approvalNotification.create).mockResolvedValue(escalationNotification)

      await notificationService.sendEscalationNotification(expiredWorkflow)

      expect(db.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'ESCALATED',
          urgency: 'HIGH',
          recipientRole: 'FINANCE_HEAD',
        }),
      })
    })

    test('should notify original submitter about escalation', async () => {
      // RED: This test should fail initially
      const escalatedWorkflow = {
        ...mockWorkflow,
        escalatedTo: 'DIRECTOR',
        escalatedAt: new Date(),
      }

      vi.mocked(db.approvalNotification.create).mockResolvedValue(mockNotification)

      await notificationService.sendEscalationNotification(escalatedWorkflow)

      // Should create notifications for both escalated recipient and original submitter
      expect(db.approvalNotification.create).toHaveBeenCalledTimes(2)
    })

    test('should include escalation reason in notification', async () => {
      // RED: This test should fail initially
      const escalatedWorkflow = {
        ...mockWorkflow,
        escalatedTo: 'DIRECTOR',
        escalatedAt: new Date(),
        escalationReason: 'Approval timeout exceeded',
      }

      vi.mocked(db.approvalNotification.create).mockResolvedValue(mockNotification)

      await notificationService.sendEscalationNotification(escalatedWorkflow as any)

      expect(db.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: expect.stringContaining('timeout exceeded'),
        }),
      })
    })
  })

  describe('Reminder Notifications', () => {
    test('should send reminder notifications for pending approvals', async () => {
      // RED: This test should fail initially
      const pendingWorkflows = [
        {
          ...mockWorkflow,
          dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        },
        {
          ...mockWorkflow,
          id: 'workflow2',
          dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        },
      ]

      const reminderNotification = {
        ...mockNotification,
        type: 'REMINDER',
        title: 'Approval Reminder',
        urgency: 'NORMAL',
      }

      vi.mocked(db.approvalWorkflow.findMany).mockResolvedValue(pendingWorkflows)
      vi.mocked(db.approvalNotification.create).mockResolvedValue(reminderNotification)

      await notificationService.sendReminderNotifications()

      expect(db.approvalWorkflow.findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          dueDate: {
            lte: expect.any(Date), // Due within reminder threshold
            gte: expect.any(Date), // Not yet expired
          },
        },
        include: expect.any(Object),
      })
    })

    test('should adjust reminder urgency based on time remaining', async () => {
      // RED: This test should fail initially
      const urgentWorkflow = {
        ...mockWorkflow,
        dueDate: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      }

      const urgentReminder = {
        ...mockNotification,
        type: 'REMINDER',
        urgency: 'HIGH',
      }

      vi.mocked(db.approvalWorkflow.findMany).mockResolvedValue([urgentWorkflow])
      vi.mocked(db.approvalNotification.create).mockResolvedValue(urgentReminder)

      await notificationService.sendReminderNotifications()

      expect(db.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          urgency: 'HIGH',
        }),
      })
    })

    test('should not send duplicate reminders within cooldown period', async () => {
      // RED: This test should fail initially
      const workflowWithRecentReminder = {
        ...mockWorkflow,
        notifications: [
          {
            type: 'REMINDER',
            createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          },
        ],
      }

      vi.mocked(db.approvalWorkflow.findMany).mockResolvedValue([workflowWithRecentReminder as any])

      await notificationService.sendReminderNotifications()

      expect(db.approvalNotification.create).not.toHaveBeenCalled()
    })
  })

  describe('Notification Delivery', () => {
    test('should mark email as sent after successful delivery', async () => {
      // RED: This test should fail initially
      const notificationId = 'notification1'
      
      await notificationService.markEmailAsSent(notificationId)

      expect(db.approvalNotification.update).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: {
          emailSent: true,
          emailSentAt: expect.any(Date),
        },
      })
    })

    test('should mark in-app notification as read', async () => {
      // RED: This test should fail initially
      const notificationId = 'notification1'

      await notificationService.markAsRead(notificationId)

      expect(db.approvalNotification.update).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: {
          inAppRead: true,
          inAppReadAt: expect.any(Date),
        },
      })
    })

    test('should get unread notifications for user', async () => {
      // RED: This test should fail initially
      const unreadNotifications = [
        {
          ...mockNotification,
          id: 'notification1',
          inAppRead: false,
        },
        {
          ...mockNotification,
          id: 'notification2',
          inAppRead: false,
        },
      ]

      vi.mocked(db.approvalNotification.findMany).mockResolvedValue(unreadNotifications)

      const result = await notificationService.getUnreadNotifications('approver1')

      expect(result).toHaveLength(2)
      expect(db.approvalNotification.findMany).toHaveBeenCalledWith({
        where: {
          recipientId: 'approver1',
          inAppRead: false,
        },
        orderBy: { createdAt: 'desc' },
      })
    })

    test('should retry failed email deliveries', async () => {
      // RED: This test should fail initially
      const failedNotifications = [
        {
          ...mockNotification,
          emailSent: false,
          createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        },
      ]

      vi.mocked(db.approvalNotification.findMany).mockResolvedValue(failedNotifications)

      await notificationService.retryFailedNotifications()

      expect(queueManager.addJob).toHaveBeenCalledWith(
        'email-notification',
        expect.objectContaining({
          notificationId: 'notification1',
          retryAttempt: true,
        }),
        expect.any(Object)
      )
    })
  })

  describe('Notification Templates', () => {
    test('should generate contextual notification content', async () => {
      // RED: This test should fail initially
      const workflowContext = {
        workflow: mockWorkflow,
        invoice: {
          invoiceNumber: 'FY24-25/001',
          totalInINR: '50000.00',
          client: { name: 'ABC Corp' },
        },
        approver: mockApprovers[0],
      }

      const content = await notificationService.generateNotificationContent(
        'APPROVAL_REQUIRED',
        workflowContext
      )

      expect(content.title).toContain('Approval Required')
      expect(content.message).toContain('FY24-25/001')
      expect(content.message).toContain('ABC Corp')
      expect(content.message).toContain('₹50,000')
    })

    test('should support multiple languages', async () => {
      // RED: This test should fail initially
      const context = {
        workflow: mockWorkflow,
        language: 'hi', // Hindi
      }

      const content = await notificationService.generateNotificationContent(
        'APPROVAL_REQUIRED',
        context
      )

      expect(content.title).toContain('अनुमोदन') // Hindi for approval
    })

    test('should include action buttons in email templates', async () => {
      // RED: This test should fail initially
      const emailContent = await notificationService.generateEmailTemplate(
        'APPROVAL_REQUIRED',
        mockWorkflow,
        mockApprovers[0]
      )

      expect(emailContent.html).toContain('Approve')
      expect(emailContent.html).toContain('Reject')
      expect(emailContent.html).toContain('View Details')
      expect(emailContent.html).toContain('href=') // Should have action links
    })
  })
})