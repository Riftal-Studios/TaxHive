import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'

type SendMailOptions = Mail.Options
type Attachment = Mail.Attachment
import { emailTemplates, type EmailTemplateData } from './templates'

export interface EmailOptions {
  to: string
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  template: keyof typeof emailTemplates
  data: EmailTemplateData
  attachments?: Attachment[]
  replyTo?: string
}

export interface EmailResult {
  messageId: string
  accepted?: string[]
  rejected?: string[]
  timestamp: Date
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  // Create transporter based on environment
  const transporter = createTransporter()

  // Get template
  const templateFn = emailTemplates[options.template]
  if (!templateFn) {
    throw new Error(`Email template "${options.template}" not found`)
  }

  const { html, text } = templateFn(options.data)

  // Build email options
  const mailOptions: SendMailOptions = {
    from: formatFromAddress(options.data.senderName, options.data.senderEmail),
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    replyTo: options.replyTo || options.data.senderEmail,
    subject: options.subject,
    html,
    text,
    attachments: options.attachments,
  }

  // Send email
  const info = await transporter.sendMail(mailOptions)

  return {
    messageId: info.messageId,
    accepted: info.accepted as string[],
    rejected: info.rejected as string[],
    timestamp: new Date(),
  }
}

function createTransporter() {
  const emailProvider = process.env.EMAIL_PROVIDER || 'smtp'

  switch (emailProvider) {
    case 'sendgrid':
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      })

    case 'ses':
      // AWS SES configuration
      return nodemailer.createTransport({
        host: process.env.AWS_SES_REGION 
          ? `email-smtp.${process.env.AWS_SES_REGION}.amazonaws.com`
          : 'email-smtp.us-east-1.amazonaws.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.AWS_SES_ACCESS_KEY_ID,
          pass: process.env.AWS_SES_SECRET_ACCESS_KEY,
        },
      })

    case 'resend':
      return nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
          user: 'resend',
          pass: process.env.RESEND_API_KEY,
        },
      })

    case 'smtp':
    default:
      // Generic SMTP configuration
      if (process.env.EMAIL_SERVER) {
        return nodemailer.createTransport({
          url: process.env.EMAIL_SERVER,
        })
      }

      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      })
  }
}

function formatFromAddress(senderName?: string, senderEmail?: string): string {
  const email = senderEmail || process.env.EMAIL_FROM || 'noreply@gsthive.com'
  const name = senderName || process.env.EMAIL_FROM_NAME || 'GSTHive'
  
  return `"${name}" <${email}>`
}

// Helper function to create PDF attachment
export function createPDFAttachment(
  filename: string,
  content: Buffer | string,
  contentType = 'application/pdf'
): Attachment {
  return {
    filename,
    content,
    contentType,
  }
}