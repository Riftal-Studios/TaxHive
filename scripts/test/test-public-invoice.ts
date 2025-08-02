import { prisma } from '../../lib/prisma'

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
      console.error('Invoice not found with public token')
      process.exit(1)
    }

    console.log('Invoice found:')
    console.log('- Number:', invoice.invoiceNumber)
    console.log('- Client:', invoice.client.name)
    console.log('- Amount:', invoice.totalAmount.toString(), invoice.currency)
    console.log('- Token expires at:', invoice.tokenExpiresAt)
    console.log('- Public URL:', `https://dev.gsthive.com/invoice/${invoice.publicAccessToken}`)
    
    // Test the API endpoint
    const apiUrl = `http://localhost:3000/api/invoices/public/${invoice.publicAccessToken}`
    console.log('\nTesting API endpoint:', apiUrl)
    
    const response = await fetch(apiUrl)
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ API endpoint working!')
      console.log('Response:', JSON.stringify(data, null, 2))
    } else {
      console.error('❌ API endpoint failed:', response.status, data)
    }
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

testPublicInvoice()