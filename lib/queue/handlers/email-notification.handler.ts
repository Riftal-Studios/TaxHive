import type { Job, EmailNotificationJobData } from '../types'
import { sendEmail, type EmailOptions } from '@/lib/email/service'

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
    data: templateData 
  } = job.data

  // Update progress if available
  const updateProgress = (job as { updateProgress?: (progress: number) => Promise<void> }).updateProgress
  
  if (updateProgress) {
    await updateProgress(10)
  }

  // Prepare email options
  const emailOptions: EmailOptions = {
    to,
    cc,
    bcc,
    subject,
    template: template as keyof typeof import('@/lib/email/templates').emailTemplates,
    data: templateData as import('@/lib/email/templates').EmailTemplateData,
  }

  if (updateProgress) {
    await updateProgress(50)
  }

  // Send the email
  const result = await sendEmail(emailOptions)

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