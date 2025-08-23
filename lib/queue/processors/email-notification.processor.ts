import { Job } from 'bullmq'
import { EmailNotificationJobData, EmailNotificationJobResult } from '../types'
import { sendEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import Logger from '@/lib/logger'

// Email templates
const EMAIL_TEMPLATES = {
  'invoice-created': {
    subject: 'New Invoice from {{companyName}}',
    template: 'invoice-created',
  },
  'payment-reminder': {
    subject: 'Payment Reminder: Invoice {{invoiceNumber}} is Due',
    template: 'payment-reminder',
  },
  'payment-received': {
    subject: 'Payment Received for Invoice {{invoiceNumber}}',
    template: 'payment-received',
  },
  'credit-note': {
    subject: 'Credit Note {{noteNumber}} Issued',
    template: 'credit-note',
  },
  'debit-note': {
    subject: 'Debit Note {{noteNumber}} Issued',
    template: 'debit-note',
  },
  'welcome': {
    subject: 'Welcome to GST Hive',
    template: 'welcome',
  },
  'gst-return-reminder': {
    subject: 'GST Return Filing Reminder',
    template: 'gst-return-reminder',
  },
}

// Main processor function
export default async function processEmailNotification(
  job: Job<EmailNotificationJobData>
): Promise<EmailNotificationJobResult> {
  const { type, to, subject: customSubject, data, attachments, userId } = job.data
  
  // Update job progress
  await job.updateProgress(10)
  
  try {
    // Get user details for email context
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        companyName: true,
        gstin: true,
        address: true,
      },
    })
    
    if (!user) {
      throw new Error(`User ${userId} not found`)
    }
    
    await job.updateProgress(20)
    
    // Get email template
    const template = EMAIL_TEMPLATES[type]
    if (!template) {
      throw new Error(`Unknown email type: ${type}`)
    }
    
    // Prepare email subject (replace placeholders)
    let subject = customSubject || template.subject
    Object.entries(data).forEach(([key, value]) => {
      subject = subject.replace(`{{${key}}}`, String(value))
    })
    // Also replace company name from user
    subject = subject.replace('{{companyName}}', user.companyName || 'GST Hive')
    
    await job.updateProgress(40)
    
    // Prepare email data with user context
    const emailData = {
      ...data,
      userName: user.name,
      companyName: user.companyName,
      companyGSTIN: user.gstin,
      companyAddress: user.address,
      currentYear: new Date().getFullYear(),
    }
    
    // Handle special cases for different email types
    if (type === 'invoice-created' && data.invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: data.invoiceId as string },
        include: {
          client: true,
          lineItems: true,
        },
      })
      if (invoice) {
        emailData.invoice = invoice
        emailData.client = invoice.client
      }
    }
    
    if (type === 'payment-reminder' && data.invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: data.invoiceId as string },
        include: {
          client: true,
          payments: true,
        },
      })
      if (invoice) {
        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0)
        const balanceDue = invoice.totalAmount.toNumber() - totalPaid
        
        emailData.invoice = invoice
        emailData.client = invoice.client
        emailData.balanceDue = balanceDue
        emailData.daysOverdue = Math.floor(
          (Date.now() - new Date(invoice.dueDate || invoice.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      }
    }
    
    await job.updateProgress(60)
    
    // Send email
    const recipients = Array.isArray(to) ? to : [to]
    const results = await Promise.allSettled(
      recipients.map(recipient =>
        sendEmail({
          to: recipient,
          subject,
          template: template.template,
          data: emailData,
          attachments,
        })
      )
    )
    
    await job.updateProgress(80)
    
    // Process results
    const accepted: string[] = []
    const rejected: string[] = []
    let messageId = ''
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.messageId) {
        accepted.push(recipients[index])
        if (!messageId) messageId = result.value.messageId
      } else {
        rejected.push(recipients[index])
      }
    })
    
    // Log email activity
    await prisma.emailLog.create({
      data: {
        userId,
        type,
        to: recipients.join(', '),
        subject,
        status: rejected.length === 0 ? 'SENT' : rejected.length === recipients.length ? 'FAILED' : 'PARTIAL',
        messageId,
        sentAt: new Date(),
        metadata: {
          accepted,
          rejected,
          templateData: emailData,
        },
      },
    })
    
    await job.updateProgress(100)
    
    // Return result
    const result: EmailNotificationJobResult = {
      messageId,
      accepted,
      rejected,
      sentAt: new Date(),
    }
    
    return result
    
  } catch (error) {
    Logger.error(`Error sending email notification:`, error)
    
    // Log failed email attempt
    await prisma.emailLog.create({
      data: {
        userId,
        type,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: customSubject || EMAIL_TEMPLATES[type]?.subject || 'Unknown',
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        sentAt: new Date(),
      },
    })
    
    throw error
  }
}