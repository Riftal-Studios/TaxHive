import type { Job, EmailNotificationJobData } from '../types'
import { sendEmail, type EmailOptions } from '@/lib/email/service'
import { db } from '@/lib/prisma'

interface EmailNotificationResult {
  success: boolean
  messageId: string
  template: string
  to: string
  timestamp: Date
}

export async function emailNotificationHandler(job: Job<EmailNotificationJobData>): Promise<EmailNotificationResult> {
  const { 
    to, 
    cc,
    bcc,
    subject,
    template,
    data: templateData,
    userId 
  } = job.data

  // Update progress if available
  const updateProgress = (job as { updateProgress?: (progress: number) => Promise<void> }).updateProgress
  
  if (updateProgress) {
    await updateProgress(10)
  }

  let finalTemplateData = templateData
  
  // If userId is provided and template needs sender info, look up user
  if (userId && (template === 'invoice' || template === 'payment-reminder')) {
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Add sender information to template data
    finalTemplateData = {
      ...templateData,
      senderName: user.name,
      senderEmail: user.email,
    }
  }

  if (updateProgress) {
    await updateProgress(50)
  }

  // Prepare email options
  const emailOptions: EmailOptions = {
    to,
    cc,
    bcc,
    subject,
    template: template as keyof typeof import('@/lib/email/templates').emailTemplates,
    data: finalTemplateData as import('@/lib/email/templates').EmailTemplateData,
  }

  // Send the email
  const result = await sendEmail(emailOptions)

  // Handle rejected recipients
  if (result.rejected && result.rejected.length > 0) {
    throw new Error(`Email rejected for recipients: ${result.rejected.join(', ')}`)
  }

  if (updateProgress) {
    await updateProgress(100)
  }

  return {
    success: true,
    messageId: result.messageId,
    template: template,
    to: to,
    timestamp: new Date(),
  }
}