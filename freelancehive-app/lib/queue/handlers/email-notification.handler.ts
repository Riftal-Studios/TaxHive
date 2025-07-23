import type { Job } from '../types'
import { prisma } from '@/lib/prisma'
import { sendEmail, createPDFAttachment, type EmailOptions } from '@/lib/email/service'
import { readFile } from 'fs/promises'
import path from 'path'

interface EmailNotificationResult {
  success: boolean
  messageId: string
  template: string
  to: string
  timestamp: Date
}

export async function emailNotificationHandler(job: Job): Promise<EmailNotificationResult> {
  const { 
    type, 
    to, 
    cc,
    bcc,
    invoiceId,
    customMessage,
    userId 
  } = job.data

  // Update progress if available
  const updateProgress = (job as any).updateProgress
  
  if (updateProgress) {
    await updateProgress(10)
  }

  // Fetch user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      gstin: true,
      pan: true,
      address: true,
    }
  })

  if (!user) {
    throw new Error('User not found')
  }

  let emailOptions: EmailOptions

  switch (type) {
    case 'invoice': {
      // Fetch invoice data with relations
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
          lineItems: true,
          lut: true,
        }
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      if (updateProgress) {
        await updateProgress(30)
      }

      // Prepare email data
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const viewUrl = `${baseUrl}/invoices/${invoice.id}`
      const downloadUrl = `${baseUrl}/api/invoices/${invoice.id}/download`

      // Load PDF if available
      const attachments = []
      if (invoice.pdfUrl) {
        try {
          const filename = path.basename(invoice.pdfUrl)
          const filePath = path.join(process.cwd(), 'uploads', 'invoices', filename)
          const pdfBuffer = await readFile(filePath)
          
          attachments.push(createPDFAttachment(
            `${invoice.invoiceNumber}.pdf`,
            pdfBuffer
          ))
        } catch (error) {
          console.error('Failed to attach PDF:', error)
          // Continue without attachment
        }
      }

      if (updateProgress) {
        await updateProgress(50)
      }

      emailOptions = {
        to,
        cc,
        bcc,
        subject: `Invoice ${invoice.invoiceNumber} - ${user.name || user.email}`,
        template: 'invoice',
        data: {
          clientName: invoice.client.name,
          senderName: user.name || user.email,
          senderEmail: user.email,
          companyName: user.name || undefined,
          companyAddress: user.address || undefined,
          companyGSTIN: user.gstin || undefined,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
          dueDate: new Date(invoice.dueDate).toLocaleDateString('en-IN'),
          amount: Number(invoice.totalAmount),
          currency: invoice.currency,
          viewUrl,
          downloadUrl,
          customMessage,
        },
        attachments,
        replyTo: user.email,
      }
      break
    }

    case 'payment-reminder': {
      // Fetch invoice data
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
        }
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      if (updateProgress) {
        await updateProgress(30)
      }

      // Calculate days overdue
      const dueDate = new Date(invoice.dueDate)
      const today = new Date()
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const viewUrl = `${baseUrl}/invoices/${invoice.id}`
      const downloadUrl = `${baseUrl}/api/invoices/${invoice.id}/download`

      emailOptions = {
        to,
        cc,
        bcc,
        subject: `Payment Reminder: Invoice ${invoice.invoiceNumber}`,
        template: 'payment-reminder',
        data: {
          clientName: invoice.client.name,
          senderName: user.name || user.email,
          senderEmail: user.email,
          companyName: user.name || undefined,
          companyAddress: user.address || undefined,
          companyGSTIN: user.gstin || undefined,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
          dueDate: new Date(invoice.dueDate).toLocaleDateString('en-IN'),
          amount: Number(invoice.totalAmount),
          currency: invoice.currency,
          daysOverdue,
          viewUrl,
          downloadUrl,
          customMessage,
        },
        replyTo: user.email,
      }
      break
    }

    case 'lut-expiry': {
      const { lutNumber, expiryDate, daysRemaining } = job.data

      emailOptions = {
        to,
        subject: `LUT Expiry Reminder - ${daysRemaining} days remaining`,
        template: 'lut-expiry',
        data: {
          clientName: user.name || user.email,
          senderName: user.name || user.email,
          senderEmail: user.email,
          lutNumber,
          expiryDate: new Date(expiryDate).toLocaleDateString('en-IN'),
          daysRemaining,
        },
      }
      break
    }

    case 'payment-received': {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
        }
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      emailOptions = {
        to,
        cc,
        bcc,
        subject: `Payment Received - Invoice ${invoice.invoiceNumber}`,
        template: 'payment-received',
        data: {
          clientName: invoice.client.name,
          senderName: user.name || user.email,
          senderEmail: user.email,
          companyName: user.name || undefined,
          companyAddress: user.address || undefined,
          companyGSTIN: user.gstin || undefined,
          invoiceNumber: invoice.invoiceNumber,
          amount: Number(invoice.totalAmount),
          currency: invoice.currency,
          customMessage,
        },
        replyTo: user.email,
      }
      break
    }

    default:
      throw new Error(`Unknown email type: ${type}`)
  }

  if (updateProgress) {
    await updateProgress(70)
  }

  // Send email
  const result = await sendEmail(emailOptions)

  if (updateProgress) {
    await updateProgress(90)
  }

  // Store email history
  await prisma.emailHistory.create({
    data: {
      userId,
      invoiceId,
      type,
      to,
      cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : null,
      bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : null,
      subject: emailOptions.subject,
      template: emailOptions.template,
      messageId: result.messageId,
      status: result.rejected && result.rejected.length > 0 ? 'FAILED' : 'SENT',
      sentAt: result.timestamp,
    }
  })

  if (updateProgress) {
    await updateProgress(100)
  }

  return {
    success: true,
    messageId: result.messageId,
    template: emailOptions.template,
    to,
    timestamp: result.timestamp,
  }
}