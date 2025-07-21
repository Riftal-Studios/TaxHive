import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create a test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@freelancehive.com' },
    update: {},
    create: {
      email: 'test@freelancehive.com',
      name: 'Test User',
      emailVerified: new Date(),
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      address: '123 Test Street, Bangalore, Karnataka 560001',
    },
  })

  console.log('Created test user:', testUser.email)

  // Create LUT for the test user
  let lut = await prisma.lUT.findFirst({
    where: {
      userId: testUser.id,
      lutNumber: 'AD290124000001',
    },
  })
  
  if (!lut) {
    lut = await prisma.lUT.create({
      data: {
        userId: testUser.id,
        lutNumber: 'AD290124000001',
        lutDate: new Date('2024-01-01'),
        validFrom: new Date('2024-01-01'),
        validTill: new Date('2024-12-31'),
        isActive: true,
      },
    })
  }

  console.log('Created LUT:', lut.lutNumber)

  // Create test clients
  const clientData = [
    {
      userId: testUser.id,
      name: 'Acme Corporation',
      email: 'billing@acme.com',
      company: 'Acme Corp',
      address: '123 Business Ave, New York, NY 10001',
      country: 'United States',
      phone: '+1-555-0123',
    },
    {
      userId: testUser.id,
      name: 'TechStart Inc',
      email: 'accounts@techstart.com',
      company: 'TechStart Inc',
      address: '456 Innovation Blvd, San Francisco, CA 94105',
      country: 'United States',
      phone: '+1-555-0456',
    },
  ]
  
  const clients = []
  for (const data of clientData) {
    let client = await prisma.client.findFirst({
      where: {
        userId: testUser.id,
        email: data.email,
      },
    })
    
    if (!client) {
      client = await prisma.client.create({ data })
    }
    
    clients.push(client)
  }

  console.log(`Created ${clients.length} test clients`)

  // Create exchange rates
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Set to start of day
  
  const exchangeRates = await Promise.all([
    prisma.exchangeRate.upsert({
      where: {
        currency_date: {
          currency: 'USD',
          date: today,
        },
      },
      update: {
        rate: 83.50,
        source: 'RBI',
      },
      create: {
        currency: 'USD',
        rate: 83.50,
        source: 'RBI',
        date: today,
      },
    }),
    prisma.exchangeRate.upsert({
      where: {
        currency_date: {
          currency: 'EUR',
          date: today,
        },
      },
      update: {
        rate: 91.25,
        source: 'RBI',
      },
      create: {
        currency: 'EUR',
        rate: 91.25,
        source: 'RBI',
        date: today,
      },
    }),
    prisma.exchangeRate.upsert({
      where: {
        currency_date: {
          currency: 'GBP',
          date: today,
        },
      },
      update: {
        rate: 106.30,
        source: 'RBI',
      },
      create: {
        currency: 'GBP',
        rate: 106.30,
        source: 'RBI',
        date: today,
      },
    }),
  ])

  console.log(`Created ${exchangeRates.length} exchange rates`)

  // Create sample invoices
  // First, check if invoice already exists
  const existingInvoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: 'FY24-25/001' },
  })
  
  const invoice1 = existingInvoice || await prisma.invoice.create({
    data: {
      userId: testUser.id,
      clientId: clients[0].id,
      invoiceNumber: 'FY24-25/001',
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'SENT',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '99831400', // IT consultancy services
      lutId: lut.id,
      currency: 'USD',
      exchangeRate: 83.50,
      exchangeSource: 'RBI',
      subtotal: 5000.00,
      igstRate: 0,
      igstAmount: 0,
      totalAmount: 5000.00,
      totalInINR: 417500.00,
      description: 'Software development services for Q4 2024',
      paymentTerms: 'Net 30 days',
      bankDetails: 'Bank: HDFC Bank\nAccount: 1234567890\nIFSC: HDFC0001234\nSWIFT: HDFCINBB',
      lineItems: {
        create: [
          {
            description: 'Backend API Development - 80 hours',
            quantity: 80,
            rate: 50,
            amount: 4000,
            serviceCode: '99831400',
          },
          {
            description: 'Frontend Development - 20 hours',
            quantity: 20,
            rate: 50,
            amount: 1000,
            serviceCode: '99831400',
          },
        ],
      },
    },
  })

  console.log(existingInvoice ? 'Using existing invoice:' : 'Created sample invoice:', invoice1.invoiceNumber)

  console.log('✅ Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })