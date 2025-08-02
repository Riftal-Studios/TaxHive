import { prisma } from '../lib/prisma'
import { getQueueService } from '../lib/queue'

async function sendTestInvoice() {
  try {
    // Find the latest invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        client: {
          email: 'nasiridrishi@outlook.com'
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        client: true,
        user: true,
      }
    })

    if (!invoice) {
      console.error('No invoice found for nasiridrishi@outlook.com')
      process.exit(1)
    }

    console.log('Found invoice:', invoice.invoiceNumber)
    console.log('Public access token:', invoice.publicAccessToken)
    console.log('Token expires at:', invoice.tokenExpiresAt)

    // Generate public access token if not exists
    if (!invoice.publicAccessToken) {
      const { generateSecureToken, getTokenExpirationDate } = await import('../lib/utils/token')
      
      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          publicAccessToken: generateSecureToken(),
          tokenExpiresAt: getTokenExpirationDate(90),
        },
      })
      
      invoice.publicAccessToken = updated.publicAccessToken
      console.log('Generated new public access token:', invoice.publicAccessToken)
    }

    const queue = getQueueService()
    
    // Queue invoice email
    const job = await queue.enqueue('EMAIL_NOTIFICATION', {
      to: invoice.client.email,
      subject: `Invoice ${invoice.invoiceNumber} from ${invoice.user.name || 'Your Service Provider'}`,
      template: 'invoice',
      data: {
        clientName: invoice.client.name,
        senderName: invoice.user.name || 'Your Service Provider',
        senderEmail: invoice.user.email,
        companyName: invoice.user.name,
        companyGSTIN: invoice.user.gstin,
        companyAddress: invoice.user.address,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
        dueDate: new Date(invoice.dueDate).toLocaleDateString('en-IN'),
        amount: Number(invoice.totalAmount),
        currency: invoice.currency,
        viewUrl: `${process.env.NEXTAUTH_URL}/invoice/${invoice.publicAccessToken}`,
        downloadUrl: `${process.env.NEXTAUTH_URL}/api/invoices/public/${invoice.publicAccessToken}/download`,
        bankDetails: invoice.bankDetails || undefined,
      },
      userId: invoice.userId,
    })

    console.log('Email job queued:', job.id)
    console.log('Public invoice URL:', `${process.env.NEXTAUTH_URL}/invoice/${invoice.publicAccessToken}`)
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

sendTestInvoice()