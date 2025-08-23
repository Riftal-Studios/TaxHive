import { prisma } from '../../lib/prisma'
import { Logger } from '../../lib/logger'

async function testPublicInvoice() {
  try {
    // Find the invoice with the token
    const invoice = await prisma.invoice.findFirst({
      where: {
        publicAccessToken: '_dXZSGbfnHdB31LcE5bdaI-_LPCODxMl2hHmDv0ER2I'
      },
      include: {
        client: true,
        lineItems: true,
        lut: true,
        user: {
          select: {
            name: true,
            email: true,
            gstin: true,
            pan: true,
            address: true,
          }
        }
      }
    })

    if (!invoice) {
      Logger.error('Invoice not found with public token')
      process.exit(1)
    }

    Logger.info('Invoice found:')
    Logger.info('- Number:', invoice.invoiceNumber)
    Logger.info('- Client:', invoice.client.name)
    Logger.info('- Amount:', invoice.totalAmount.toString(), invoice.currency)
    Logger.info('- Token expires at:', invoice.tokenExpiresAt)
    Logger.info('- Public URL:', `https://dev.gsthive.com/invoice/${invoice.publicAccessToken}`)
    
    // Test the API endpoint
    const apiUrl = `http://localhost:3000/api/invoices/public/${invoice.publicAccessToken}`
    Logger.info('\nTesting API endpoint:', apiUrl)
    
    const response = await fetch(apiUrl)
    const data = await response.json()
    
    if (response.ok) {
      Logger.info('✅ API endpoint working!')
      Logger.info('Response:', JSON.stringify(data, null, 2))
    } else {
      Logger.error('❌ API endpoint failed:', response.status, data)
    }
    
    process.exit(0)
  } catch (error) {
    Logger.error('Error:', error)
    process.exit(1)
  }
}

testPublicInvoice()