#!/usr/bin/env tsx
import { Logger } from '../../lib/logger'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  Logger.info('Creating test data for invoice email preview...')
  
  // Find or create test user
  let user = await prisma.user.findFirst({
    where: { email: 'test@gsthive.com' }
  })
  
  if (!user) {
    const hashedPassword = await hash('Test123!@#', 12)
    user = await prisma.user.create({
      data: {
        email: 'test@gsthive.com',
        password: hashedPassword,
        name: 'Test User',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: '123 Test Street\nBengaluru, Karnataka 560001\nIndia',
        emailVerified: new Date(),
        onboardingCompleted: true,
      }
    })
    Logger.info('Created test user')
  }
  
  // Create client
  const client = await prisma.client.create({
    data: {
      userId: user.id,
      name: 'Nasir Idrishi',
      email: 'nasiridrishi@outlook.com',
      company: 'Outlook Technologies',
      address: '456 Client Avenue\nNew York, NY 10001\nUSA',
      country: 'United States',
      taxId: 'US123456789',
      phone: '+1-555-0123',
    }
  })
  Logger.info('Created client:', client.name)
  
  // Get or create LUT
  let lut = await prisma.lUT.findFirst({
    where: { userId: user.id }
  })
  
  if (!lut) {
    lut = await prisma.lUT.create({
      data: {
        userId: user.id,
        lutNumber: 'AD2901234567890',
        lutDate: new Date('2024-04-01'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
      }
    })
  }
  
  // Create invoice with bank details
  const totalAmountUSD = 1500
  const exchangeRate = 83.50
  const totalInINR = totalAmountUSD * exchangeRate
  
  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: client.id,
      lutId: lut.id,
      invoiceNumber: `FY24-25/${Math.floor(Math.random() * 1000)}`,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      currency: 'USD',
      exchangeRate: exchangeRate,
      exchangeSource: 'RBI Reference Rate',
      subtotal: totalAmountUSD,
      igstRate: 0, // 0% for exports under LUT
      igstAmount: 0,
      totalAmount: totalAmountUSD,
      totalInINR: totalInINR,
      amountPaid: 0,
      balanceDue: totalAmountUSD,
      placeOfSupply: 'Outside India',
      serviceCode: '9984',
      notes: 'Thank you for your business!\n\nPlease process the payment at your earliest convenience.',
      bankDetails: 'Bank: HDFC Bank Ltd.\nAccount Name: Test User\nAccount Number: 50100123456789\nIFSC Code: HDFC0001234\nSWIFT Code: HDFCINBBXXX\nBranch: Koramangala, Bengaluru',
      lineItems: {
        create: [
          {
            description: 'Website Development Services - React/Next.js Application',
            quantity: 1,
            rate: 1000,
            amount: 1000,
            serviceCode: '9984',
          },
          {
            description: 'API Integration and Backend Development',
            quantity: 1,
            rate: 500,
            amount: 500,
            serviceCode: '9984',
          }
        ]
      }
    },
    include: {
      client: true,
      lineItems: true,
      lut: true,
    }
  })
  
  Logger.info('\n✅ Test invoice created successfully!')
  Logger.info('\nInvoice Details:')
  Logger.info('- Invoice Number:', invoice.invoiceNumber)
  Logger.info('- Client:', invoice.client.name, `(${invoice.client.email})`)
  Logger.info('- Amount:', `$${invoice.totalAmount}`)
  Logger.info('- Due Date:', invoice.dueDate.toLocaleDateString())
  Logger.info('\nBank Details included:', invoice.bankDetails ? 'Yes' : 'No')
  
  Logger.info('\n📧 You can now:')
  Logger.info('1. Log in with: test@gsthive.com / Test123!@#')
  Logger.info('2. Go to Invoices section')
  Logger.info('3. Find invoice', invoice.invoiceNumber)
  Logger.info('4. Click "Send Invoice" to email it to nasiridrishi@outlook.com')
  
  Logger.info('\nInvoice URL: http://localhost:3000/invoices/' + invoice.id)
}

main()
  .catch((e) => {
    Logger.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })