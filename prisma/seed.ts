import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Hash the password for demo account
  const hashedPassword = await hash('demo123', 12)

  // Create a test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@taxhive.app' },
    update: {},
    create: {
      email: 'test@taxhive.app',
      password: hashedPassword,
      name: 'Test User',
      emailVerified: new Date(),
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      address: '123 Test Street, Bangalore, Karnataka 560001',
    },
  })

  console.log('Created test user:', testUser.email)
  console.log('📧 Demo Login: test@taxhive.app')
  console.log('🔑 Demo Password: demo123')

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
      currency: 'USD',
      phone: '+1-555-0123',
    },
    {
      userId: testUser.id,
      name: 'TechStart Inc',
      email: 'accounts@techstart.com',
      company: 'TechStart Inc',
      address: '456 Innovation Blvd, San Francisco, CA 94105',
      country: 'United States',
      currency: 'USD',
      phone: '+1-555-0456',
    },
    {
      userId: testUser.id,
      name: 'Global Innovations Ltd',
      email: 'finance@globalinnov.co.uk',
      company: 'Global Innovations Ltd',
      address: '789 Tech Park, London EC1A 1BB',
      country: 'United Kingdom',
      currency: 'GBP',
      phone: '+44-20-1234-5678',
    },
    {
      userId: testUser.id,
      name: 'Digital Solutions GmbH',
      email: 'accounts@digitalsol.de',
      company: 'Digital Solutions GmbH',
      address: '42 Innovation Strasse, Berlin 10115',
      country: 'Germany',
      currency: 'EUR',
      phone: '+49-30-12345678',
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
  const invoicesData = [
    {
      invoiceNumber: 'FY24-25/001',
      clientIndex: 0, // Acme Corporation
      invoiceDate: new Date('2024-10-15'),
      dueDate: new Date('2024-11-14'),
      status: 'PAID',
      paymentStatus: 'PAID',
      currency: 'USD',
      exchangeRate: 83.50,
      subtotal: 5000.00,
      totalAmount: 5000.00,
      totalInINR: 417500.00,
      amountPaid: 5000.00,
      balanceDue: 0,
      description: 'Software development services for October 2024',
      lineItems: [
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
      payments: [
        {
          amount: 5000,
          currency: 'USD',
          paymentDate: new Date('2024-11-10'),
          paymentMethod: 'Wire Transfer',
          reference: 'WT-2024-001',
          creditedAmount: 417500,
          actualExchangeRate: 83.50,
          fircNumber: 'FIRC2024001',
          fircDate: new Date('2024-11-12'),
        },
      ],
    },
    {
      invoiceNumber: 'FY24-25/002',
      clientIndex: 1, // TechStart Inc
      invoiceDate: new Date('2024-11-01'),
      dueDate: new Date('2024-12-01'),
      status: 'SENT',
      paymentStatus: 'UNPAID',
      currency: 'USD',
      exchangeRate: 83.50,
      subtotal: 3500.00,
      totalAmount: 3500.00,
      totalInINR: 292250.00,
      amountPaid: 0,
      balanceDue: 3500.00,
      description: 'Cloud infrastructure setup and configuration',
      lineItems: [
        {
          description: 'Cloud Architecture Design - 30 hours',
          quantity: 30,
          rate: 70,
          amount: 2100,
          serviceCode: '99831400',
        },
        {
          description: 'DevOps Setup - 20 hours',
          quantity: 20,
          rate: 70,
          amount: 1400,
          serviceCode: '99831400',
        },
      ],
      payments: [],
    },
    {
      invoiceNumber: 'FY24-25/003',
      clientIndex: 2, // Global Innovations Ltd
      invoiceDate: new Date('2024-11-10'),
      dueDate: new Date('2024-12-10'),
      status: 'SENT',
      paymentStatus: 'PARTIALLY_PAID',
      currency: 'GBP',
      exchangeRate: 106.30,
      subtotal: 4200.00,
      totalAmount: 4200.00,
      totalInINR: 446460.00,
      amountPaid: 2000.00,
      balanceDue: 2200.00,
      description: 'Mobile app development - Phase 1',
      lineItems: [
        {
          description: 'iOS App Development - 50 hours',
          quantity: 50,
          rate: 60,
          amount: 3000,
          serviceCode: '99831400',
        },
        {
          description: 'Android App Development - 20 hours',
          quantity: 20,
          rate: 60,
          amount: 1200,
          serviceCode: '99831400',
        },
      ],
      payments: [
        {
          amount: 2000,
          currency: 'GBP',
          paymentDate: new Date('2024-11-20'),
          paymentMethod: 'Wire Transfer',
          reference: 'WT-2024-002',
          creditedAmount: 212600,
          actualExchangeRate: 106.30,
        },
      ],
    },
    {
      invoiceNumber: 'FY24-25/004',
      clientIndex: 3, // Digital Solutions GmbH
      invoiceDate: new Date('2024-11-15'),
      dueDate: new Date('2024-12-15'),
      status: 'SENT',
      paymentStatus: 'UNPAID',
      currency: 'EUR',
      exchangeRate: 91.25,
      subtotal: 6000.00,
      totalAmount: 6000.00,
      totalInINR: 547500.00,
      amountPaid: 0,
      balanceDue: 6000.00,
      description: 'Enterprise system integration',
      lineItems: [
        {
          description: 'System Analysis - 40 hours',
          quantity: 40,
          rate: 80,
          amount: 3200,
          serviceCode: '99831400',
        },
        {
          description: 'API Integration - 35 hours',
          quantity: 35,
          rate: 80,
          amount: 2800,
          serviceCode: '99831400',
        },
      ],
      payments: [],
    },
    {
      invoiceNumber: 'FY24-25/005',
      clientIndex: 0, // Acme Corporation
      invoiceDate: new Date('2024-11-20'),
      dueDate: new Date('2024-12-20'),
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      currency: 'USD',
      exchangeRate: 83.50,
      subtotal: 7500.00,
      totalAmount: 7500.00,
      totalInINR: 626250.00,
      amountPaid: 0,
      balanceDue: 7500.00,
      description: 'Website redesign and optimization',
      lineItems: [
        {
          description: 'UI/UX Design - 50 hours',
          quantity: 50,
          rate: 75,
          amount: 3750,
          serviceCode: '99831400',
        },
        {
          description: 'Frontend Development - 50 hours',
          quantity: 50,
          rate: 75,
          amount: 3750,
          serviceCode: '99831400',
        },
      ],
      payments: [],
    },
  ]

  const createdInvoices = []
  for (const invoiceData of invoicesData) {
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: invoiceData.invoiceNumber },
    })

    if (existingInvoice) {
      console.log('Using existing invoice:', invoiceData.invoiceNumber)
      createdInvoices.push(existingInvoice)
      continue
    }

    const invoice = await prisma.invoice.create({
      data: {
        userId: testUser.id,
        clientId: clients[invoiceData.clientIndex].id,
        invoiceNumber: invoiceData.invoiceNumber,
        invoiceDate: invoiceData.invoiceDate,
        dueDate: invoiceData.dueDate,
        status: invoiceData.status,
        paymentStatus: invoiceData.paymentStatus,
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '99831400', // IT consultancy services
        lutId: lut.id,
        currency: invoiceData.currency,
        exchangeRate: invoiceData.exchangeRate,
        exchangeSource: 'RBI',
        subtotal: invoiceData.subtotal,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: invoiceData.totalAmount,
        totalInINR: invoiceData.totalInINR,
        amountPaid: invoiceData.amountPaid,
        balanceDue: invoiceData.balanceDue,
        description: invoiceData.description,
        paymentTerms: 'Net 30 days',
        bankDetails: 'Bank: HDFC Bank\nAccount: 1234567890\nIFSC: HDFC0001234\nSWIFT: HDFCINBB',
        lineItems: {
          create: invoiceData.lineItems,
        },
        payments: {
          create: invoiceData.payments,
        },
      },
    })

    console.log('Created invoice:', invoice.invoiceNumber)
    createdInvoices.push(invoice)
  }

  console.log(`✅ Created ${createdInvoices.length} sample invoices`)
  console.log('✅ Seeding completed!')
  console.log('')
  console.log('📧 Demo Login: test@taxhive.app')
  console.log('🔑 Demo Password: demo123')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })