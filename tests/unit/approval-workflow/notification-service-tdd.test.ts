/**
 * TDD Tests for Approval Notification Service
 * UOL-215: Invoice Approval Workflow System
 * 
 * RED PHASE: These tests should FAIL initially
 * Tests email, in-app, escalation, and reminder notifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalNotificationService, NotificationType } from '@/lib/approval-workflow/notification-service';
import { prisma } from '@/lib/prisma';
import { EmailService } from '@/lib/email/service';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalNotification: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    approvalWorkflow: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    approvalRole: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email/service', () => ({
  EmailService: {
    sendEmail: vi.fn(),
    sendTemplatedEmail: vi.fn(),
  },
}));

describe('ApprovalNotificationService - TDD Tests', () => {
  let notificationService: ApprovalNotificationService;
  const mockWorkflowId = 'workflow-123';
  const mockUserId = 'user-123';

  const mockWorkflow = {
    id: mockWorkflowId,
    userId: mockUserId,
    invoiceId: 'invoice-123',
    status: 'PENDING',
    currentLevel: 1,
    dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
    rule: {
      requiredApprovals: 2,
      approverRoles: ['MANAGER', 'FINANCE_HEAD'],
      approvalTimeout: 48,
    },
    invoice: {
      id: 'invoice-123',
      invoiceNumber: 'FY24-25/001',
      totalAmount: 75000,
      currency: 'INR',
      client: {
        name: 'ACME Corp',
        email: 'contact@acme.com',
      },
    },
    initiatedBy: mockUserId,
  };

  const mockUsers = [
    {
      id: 'manager-123',
      name: 'John Manager',
      email: 'john.manager@company.com',
      roles: [{ name: 'MANAGER', level: 1 }],
    },
    {
      id: 'finance-123',
      name: 'Jane Finance',
      email: 'jane.finance@company.com',
      roles: [{ name: 'FINANCE_HEAD', level: 2 }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    notificationService = new ApprovalNotificationService();
    
    // Default mocks
    (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(mockWorkflow);
    (prisma.user.findMany as any).mockResolvedValue(mockUsers);
  });

  describe('Notification Creation - RED PHASE', () => {
    it('should create notification with valid data', async () => {
      // ARRANGE
      const notificationData = {
        workflowId: mockWorkflowId,
        type: NotificationType.APPROVAL_REQUIRED,
        recipientId: 'manager-123',
        title: 'Invoice Approval Required',
        message: 'Invoice FY24-25/001 requires your approval',
        urgency: 'NORMAL',
        channels: ['EMAIL', 'IN_APP'],
      };

      const expectedNotification = { id: 'notification-123', ...notificationData };
      (prisma.approvalNotification.create as any).mockResolvedValue(expectedNotification);

      // ACT
      const result = await notificationService.createNotification(notificationData);

      // ASSERT
      expect(result).toEqual(expectedNotification);
      expect(prisma.approvalNotification.create).toHaveBeenCalledWith({
        data: notificationData,
      });
    });

    it('should validate notification type', async () => {
      // ARRANGE - Invalid type
      const invalidNotificationData = {
        workflowId: mockWorkflowId,
        type: 'INVALID_TYPE',
        recipientId: 'manager-123',
        title: 'Test',
        message: 'Test message',
      };

      // ACT & ASSERT
      await expect(
        notificationService.createNotification(invalidNotificationData)
      ).rejects.toThrow('Invalid notification type');
    });

    it('should validate urgency levels', async () => {
      // ARRANGE - Invalid urgency
      const invalidNotificationData = {
        workflowId: mockWorkflowId,
        type: NotificationType.APPROVAL_REQUIRED,
        recipientId: 'manager-123',
        title: 'Test',
        message: 'Test message',
        urgency: 'INVALID_URGENCY',
      };

      // ACT & ASSERT
      await expect(
        notificationService.createNotification(invalidNotificationData)
      ).rejects.toThrow('Invalid urgency level');
    });

    it('should validate delivery channels', async () => {
      // ARRANGE - Invalid channel
      const invalidNotificationData = {
        workflowId: mockWorkflowId,
        type: NotificationType.APPROVAL_REQUIRED,
        recipientId: 'manager-123',
        title: 'Test',
        message: 'Test message',
        channels: ['INVALID_CHANNEL'],
      };

      // ACT & ASSERT
      await expect(
        notificationService.createNotification(invalidNotificationData)
      ).rejects.toThrow('Invalid delivery channel');
    });
  });

  describe('Approval Required Notifications - RED PHASE', () => {
    it('should send approval required notification to correct approvers', async () => {
      // ARRANGE
      (EmailService.sendTemplatedEmail as any).mockResolvedValue({ messageId: 'email-123' });

      // ACT
      await notificationService.sendApprovalRequiredNotification(mockWorkflowId);

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledTimes(1); // Should notify manager at level 1
      expect(EmailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: 'john.manager@company.com',
        template: 'approval-required',
        data: expect.objectContaining({
          invoiceNumber: 'FY24-25/001',
          amount: 75000,
          clientName: 'ACME Corp',
        }),
      });
    });

    it('should notify all approvers in parallel approval workflow', async () => {
      // ARRANGE - Parallel approval workflow
      const parallelWorkflow = {
        ...mockWorkflow,
        rule: { ...mockWorkflow.rule, parallelApproval: true },
      };
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(parallelWorkflow);

      // ACT
      await notificationService.sendApprovalRequiredNotification(mockWorkflowId);

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledTimes(2); // Should notify both roles
    });

    it('should set correct urgency based on due date', async () => {
      // ARRANGE - Urgent workflow (due in 2 hours)
      const urgentWorkflow = {
        ...mockWorkflow,
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      };
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(urgentWorkflow);

      // ACT
      await notificationService.sendApprovalRequiredNotification(mockWorkflowId);

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          urgency: 'HIGH',
        }),
      });
    });

    it('should include workflow context in notification', async () => {
      // ARRANGE & ACT
      await notificationService.sendApprovalRequiredNotification(mockWorkflowId);

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Invoice Approval Required - FY24-25/001',
          message: expect.stringContaining('Invoice FY24-25/001 from ACME Corp requires approval'),
        }),
      });
    });
  });

  describe('Decision Notifications - RED PHASE', () => {
    it('should send approval notification to workflow initiator', async () => {
      // ARRANGE
      const mockUser = { id: mockUserId, email: 'initiator@company.com', name: 'John Initiator' };
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      // ACT
      await notificationService.sendApprovalNotification(mockWorkflowId, 'manager-123');

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: NotificationType.APPROVED,
          recipientId: mockUserId,
          title: 'Invoice FY24-25/001 Approved',
        }),
      });

      expect(EmailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: 'initiator@company.com',
        template: 'invoice-approved',
        data: expect.objectContaining({
          invoiceNumber: 'FY24-25/001',
          approvedBy: 'manager-123',
        }),
      });
    });

    it('should send rejection notification with reason', async () => {
      // ARRANGE
      const rejectionReason = 'Amount exceeds budget limits';
      const mockUser = { id: mockUserId, email: 'initiator@company.com' };
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      // ACT
      await notificationService.sendRejectionNotification(
        mockWorkflowId, 
        'manager-123', 
        rejectionReason
      );

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: NotificationType.REJECTED,
          title: 'Invoice FY24-25/001 Rejected',
          message: expect.stringContaining(rejectionReason),
        }),
      });
    });

    it('should notify client when invoice is approved', async () => {
      // ARRANGE
      const clientNotificationEnabled = true;

      // ACT
      await notificationService.sendApprovalNotification(
        mockWorkflowId, 
        'manager-123', 
        clientNotificationEnabled
      );

      // ASSERT
      expect(EmailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: 'contact@acme.com',
        template: 'invoice-approved-client',
        data: expect.objectContaining({
          invoiceNumber: 'FY24-25/001',
          clientName: 'ACME Corp',
        }),
      });
    });
  });

  describe('Escalation Notifications - RED PHASE', () => {
    it('should send escalation notification to higher authority', async () => {
      // ARRANGE
      const escalationRole = 'DIRECTOR';
      const directorUser = {
        id: 'director-123',
        email: 'director@company.com',
        name: 'Director Smith',
      };
      (prisma.user.findMany as any).mockResolvedValue([directorUser]);

      // ACT
      await notificationService.sendEscalationNotification(mockWorkflowId, escalationRole);

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: NotificationType.ESCALATED,
          recipientId: 'director-123',
          recipientRole: escalationRole,
          urgency: 'HIGH',
          title: expect.stringContaining('Escalated'),
        }),
      });
    });

    it('should notify original approver about escalation', async () => {
      // ARRANGE
      const originalApprover = 'manager-123';

      // ACT
      await notificationService.sendEscalationNotification(mockWorkflowId, 'DIRECTOR');

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledTimes(2); // Director + original approver
    });

    it('should include escalation reason in notification', async () => {
      // ARRANGE
      const escalationReason = 'Approval timeout exceeded';

      // ACT
      await notificationService.sendEscalationNotification(
        mockWorkflowId, 
        'DIRECTOR', 
        escalationReason
      );

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: expect.stringContaining(escalationReason),
        }),
      });
    });
  });

  describe('Reminder Notifications - RED PHASE', () => {
    it('should send reminder notification to pending approvers', async () => {
      // ARRANGE
      const reminderWorkflow = {
        ...mockWorkflow,
        dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours remaining
      };
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(reminderWorkflow);

      // ACT
      await notificationService.sendReminderNotification(mockWorkflowId);

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: NotificationType.REMINDER,
          urgency: 'NORMAL',
          title: expect.stringContaining('Reminder'),
        }),
      });
    });

    it('should increase urgency for imminent deadlines', async () => {
      // ARRANGE - Due in 2 hours
      const urgentWorkflow = {
        ...mockWorkflow,
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
      };
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(urgentWorkflow);

      // ACT
      await notificationService.sendReminderNotification(mockWorkflowId);

      // ASSERT
      expect(prisma.approvalNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          urgency: 'URGENT',
        }),
      });
    });

    it('should not send reminders for completed workflows', async () => {
      // ARRANGE
      const completedWorkflow = { ...mockWorkflow, status: 'APPROVED' };
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(completedWorkflow);

      // ACT
      const result = await notificationService.sendReminderNotification(mockWorkflowId);

      // ASSERT
      expect(result).toBeNull();
      expect(prisma.approvalNotification.create).not.toHaveBeenCalled();
    });

    it('should calculate reminder frequency based on due date', async () => {
      // ARRANGE
      const workflows = [
        { ...mockWorkflow, dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000) }, // 48 hours
        { ...mockWorkflow, dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) }, // 24 hours
        { ...mockWorkflow, dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000) },  // 4 hours
      ];

      // ACT
      const frequencies = await Promise.all(
        workflows.map(w => notificationService.calculateReminderFrequency(w))
      );

      // ASSERT
      expect(frequencies[0]).toBe(24); // 24 hours for 48h deadline
      expect(frequencies[1]).toBe(12); // 12 hours for 24h deadline
      expect(frequencies[2]).toBe(2);  // 2 hours for 4h deadline
    });
  });

  describe('Batch Notification Processing - RED PHASE', () => {
    it('should process overdue workflow reminders in batch', async () => {
      // ARRANGE
      const overdueWorkflows = [
        { ...mockWorkflow, id: 'workflow-1' },
        { ...mockWorkflow, id: 'workflow-2' },
        { ...mockWorkflow, id: 'workflow-3' },
      ];
      (prisma.approvalWorkflow.findMany as any).mockResolvedValue(overdueWorkflows);

      // ACT
      const results = await notificationService.processOverdueReminders();

      // ASSERT
      expect(results).toHaveLength(3);
      expect(prisma.approvalNotification.create).toHaveBeenCalledTimes(3);
    });

    it('should handle batch processing errors gracefully', async () => {
      // ARRANGE
      const workflows = [
        { ...mockWorkflow, id: 'workflow-valid' },
        { ...mockWorkflow, id: 'workflow-invalid' }, // Will cause error
      ];
      (prisma.approvalWorkflow.findMany as any).mockResolvedValue(workflows);

      // Mock partial failure
      (prisma.approvalNotification.create as any)
        .mockResolvedValueOnce({ id: 'notification-1' })
        .mockRejectedValueOnce(new Error('Database error'));

      // ACT
      const results = await notificationService.processOverdueReminders();

      // ASSERT
      expect(results.successful).toHaveLength(1);
      expect(results.failed).toHaveLength(1);
    });

    it('should rate limit notification sending', async () => {
      // ARRANGE
      const manyWorkflows = Array(50).fill(null).map((_, i) => ({
        ...mockWorkflow,
        id: `workflow-${i}`,
      }));
      (prisma.approvalWorkflow.findMany as any).mockResolvedValue(manyWorkflows);

      // Mock rate limiting
      vi.spyOn(notificationService, 'checkRateLimit').mockResolvedValue(true);

      // ACT
      await notificationService.processOverdueReminders();

      // ASSERT
      expect(notificationService.checkRateLimit).toHaveBeenCalledTimes(50);
    });
  });

  describe('Notification Delivery - RED PHASE', () => {
    it('should send email notifications successfully', async () => {
      // ARRANGE
      const notification = {
        id: 'notification-123',
        recipientId: 'manager-123',
        channels: ['EMAIL'],
        title: 'Test Notification',
        message: 'Test message',
      };

      const recipient = { email: 'manager@company.com', name: 'Manager' };
      (prisma.user.findUnique as any).mockResolvedValue(recipient);
      (EmailService.sendEmail as any).mockResolvedValue({ messageId: 'email-123' });

      // ACT
      const result = await notificationService.deliverNotification(notification);

      // ASSERT
      expect(result.emailSent).toBe(true);
      expect(EmailService.sendEmail).toHaveBeenCalledWith({
        to: 'manager@company.com',
        subject: 'Test Notification',
        html: expect.stringContaining('Test message'),
      });
    });

    it('should handle email delivery failures', async () => {
      // ARRANGE
      const notification = {
        id: 'notification-123',
        recipientId: 'manager-123',
        channels: ['EMAIL'],
      };

      (EmailService.sendEmail as any).mockRejectedValue(new Error('SMTP server unavailable'));

      // ACT
      const result = await notificationService.deliverNotification(notification);

      // ASSERT
      expect(result.emailSent).toBe(false);
      expect(result.emailError).toContain('SMTP server unavailable');
    });

    it('should support in-app notifications', async () => {
      // ARRANGE
      const notification = {
        id: 'notification-123',
        recipientId: 'manager-123',
        channels: ['IN_APP'],
        title: 'In-App Notification',
        message: 'Test in-app message',
      };

      // ACT
      const result = await notificationService.deliverNotification(notification);

      // ASSERT
      expect(result.inAppDelivered).toBe(true);
      expect(prisma.approvalNotification.update).toHaveBeenCalledWith({
        where: { id: 'notification-123' },
        data: { inAppRead: false },
      });
    });

    it('should support SMS notifications for urgent items', async () => {
      // ARRANGE
      const urgentNotification = {
        id: 'notification-urgent',
        recipientId: 'manager-123',
        channels: ['SMS'],
        urgency: 'URGENT',
        message: 'Urgent approval required',
      };

      const recipient = { phone: '+1234567890' };
      (prisma.user.findUnique as any).mockResolvedValue(recipient);

      vi.spyOn(notificationService, 'sendSMS').mockResolvedValue({ messageId: 'sms-123' });

      // ACT
      const result = await notificationService.deliverNotification(urgentNotification);

      // ASSERT
      expect(result.smsSent).toBe(true);
      expect(notificationService.sendSMS).toHaveBeenCalledWith('+1234567890', 'Urgent approval required');
    });
  });

  describe('Notification Templates - RED PHASE', () => {
    it('should use correct template for approval required', async () => {
      // ARRANGE & ACT
      await notificationService.sendApprovalRequiredNotification(mockWorkflowId);

      // ASSERT
      expect(EmailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: expect.any(String),
        template: 'approval-required',
        data: expect.objectContaining({
          workflowId: mockWorkflowId,
          invoiceNumber: 'FY24-25/001',
          amount: 75000,
          clientName: 'ACME Corp',
          dueDate: expect.any(Date),
        }),
      });
    });

    it('should customize template based on urgency', async () => {
      // ARRANGE - Urgent workflow
      const urgentWorkflow = {
        ...mockWorkflow,
        dueDate: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
      };
      (prisma.approvalWorkflow.findUnique as any).mockResolvedValue(urgentWorkflow);

      // ACT
      await notificationService.sendApprovalRequiredNotification(mockWorkflowId);

      // ASSERT
      expect(EmailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: expect.any(String),
        template: 'approval-required-urgent',
        data: expect.any(Object),
      });
    });

    it('should support multi-language templates', async () => {
      // ARRANGE
      const userWithLanguage = {
        ...mockUsers[0],
        preferences: { language: 'es' }, // Spanish
      };
      (prisma.user.findMany as any).mockResolvedValue([userWithLanguage]);

      // ACT
      await notificationService.sendApprovalRequiredNotification(mockWorkflowId);

      // ASSERT
      expect(EmailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: expect.any(String),
        template: 'approval-required',
        language: 'es',
        data: expect.any(Object),
      });
    });
  });

  describe('Notification History and Tracking - RED PHASE', () => {
    it('should track notification delivery status', async () => {
      // ARRANGE
      const notification = {
        id: 'notification-123',
        workflowId: mockWorkflowId,
        emailSent: false,
      };

      // ACT
      await notificationService.updateDeliveryStatus(
        'notification-123',
        { emailSent: true, emailSentAt: new Date() }
      );

      // ASSERT
      expect(prisma.approvalNotification.update).toHaveBeenCalledWith({
        where: { id: 'notification-123' },
        data: {
          emailSent: true,
          emailSentAt: expect.any(Date),
        },
      });
    });

    it('should get notification history for workflow', async () => {
      // ARRANGE
      const notificationHistory = [
        {
          id: 'notification-1',
          type: NotificationType.APPROVAL_REQUIRED,
          sentAt: new Date('2024-01-01'),
        },
        {
          id: 'notification-2',
          type: NotificationType.REMINDER,
          sentAt: new Date('2024-01-02'),
        },
      ];
      (prisma.approvalNotification.findMany as any).mockResolvedValue(notificationHistory);

      // ACT
      const result = await notificationService.getNotificationHistory(mockWorkflowId);

      // ASSERT
      expect(result).toHaveLength(2);
      expect(prisma.approvalNotification.findMany).toHaveBeenCalledWith({
        where: { workflowId: mockWorkflowId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should track notification read status', async () => {
      // ARRANGE
      const notificationId = 'notification-123';

      // ACT
      await notificationService.markAsRead(notificationId, mockUserId);

      // ASSERT
      expect(prisma.approvalNotification.update).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: {
          inAppRead: true,
          inAppReadAt: expect.any(Date),
        },
      });
    });
  });

  describe('Error Handling and Resilience - RED PHASE', () => {
    it('should handle email service outages gracefully', async () => {
      // ARRANGE
      (EmailService.sendTemplatedEmail as any).mockRejectedValue(new Error('Template service unavailable'));
      (EmailService.sendEmail as any).mockRejectedValue(new Error('Service unavailable'));

      // ACT
      const result = await notificationService.sendApprovalRequiredNotification(mockWorkflowId);

      // ASSERT
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Service unavailable');
      // Should still create notification record for retry
      expect(prisma.approvalNotification.create).toHaveBeenCalled();
    });

    it('should implement retry logic for failed deliveries', async () => {
      // ARRANGE
      const failedNotification = {
        id: 'notification-failed',
        retryCount: 0,
        maxRetries: 3,
      };

      (EmailService.sendEmail as any)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ messageId: 'email-retry-success' });

      // ACT
      const result = await notificationService.retryFailedNotification(failedNotification);

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
    });

    it('should respect maximum retry limits', async () => {
      // ARRANGE
      const maxRetriedNotification = {
        id: 'notification-maxed',
        retryCount: 3,
        maxRetries: 3,
      };

      // ACT
      const result = await notificationService.retryFailedNotification(maxRetriedNotification);

      // ASSERT
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Maximum retry limit reached');
    });

    it('should handle missing user data gracefully', async () => {
      // ARRANGE
      (prisma.user.findMany as any).mockResolvedValue([]); // No users found

      // ACT
      const result = await notificationService.sendApprovalRequiredNotification(mockWorkflowId);

      // ASSERT
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('No approvers found');
    });
  });
});