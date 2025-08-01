#!/usr/bin/env tsx
/**
 * Seed demo data for development environment
 * Creates a demo user with sample clients, invoices, and payments
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding demo data...')

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@gsthive.com' },
    update: {},
    create: {
      email: 'demo@gsthive.com',
      name: 'Demo User',
      password: await hash('demo123', 10),
      emailVerified: new Date(),
      onboardingCompleted: true,
      gstin: '27AABCD1234E1Z5',
      pan: 'AABCD1234E',
      address: '123 Demo Street\nMumbai, Maharashtra 400001\nIndia',
    },
  })

  console.log('✅ Demo user created:', demoUser.email)

  // Create LUT
  const lut = await prisma.lUT.create({
    data: {
      userId: demoUser.id,
      lutNumber: 'AD2703240000123',
      lutDate: new Date('2024-03-27'),
      validFrom: new Date('2024-04-01'),
      validTill: new Date('2025-03-31'),
      isActive: true,
    },
  })

  console.log('✅ LUT created:', lut.lutNumber)

  // Create demo clients
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        userId: demoUser.id,
        name: 'TechCorp Inc',
        email: 'billing@techcorp.com',
        company: 'TechCorp Inc',
        address: '100 Tech Plaza\nSan Francisco, CA 94105\nUSA',
        country: 'United States',
        taxId: 'EIN: 12-3456789',
      },
    }),
    prisma.client.create({
      data: {
        userId: demoUser.id,
        name: 'Digital Solutions Ltd',
        email: 'accounts@digitalsolutions.co.uk',
        company: 'Digital Solutions Ltd',
        address: '25 Innovation Street\nLondon, EC2A 4BX\nUnited Kingdom',
        country: 'United Kingdom',
        taxId: 'VAT: GB123456789',
      },
    }),
    prisma.client.create({
      data: {
        userId: demoUser.id,
        name: 'Euro Consulting GmbH',
        email: 'finance@euroconsulting.de',
        company: 'Euro Consulting GmbH',
        address: 'Hauptstraße 123\n10115 Berlin\nGermany',
        country: 'Germany',
        taxId: 'VAT: DE123456789',
      },
    }),
  ])

  console.log('✅ Created', clients.length, 'demo clients')

  // Create demo invoices
  const invoices = []
  
  // Invoice 1: Fully paid USD invoice
  const invoice1 = await prisma.invoice.create({
    data: {
      userId: demoUser.id,
      clientId: clients[0].id,
      invoiceNumber: 'DEMO-FY24-25/001',
      invoiceDate: new Date('2024-11-01'),
      dueDate: new Date('2024-11-30'),
      status: 'PAID',
      placeOfSupply: 'Outside India',
      serviceCode: '99831190',
      lutId: lut.id,
      currency: 'USD',
      exchangeRate: 83.50,
      exchangeSource: 'RBI Reference Rate',
      subtotal: 5000,
      igstRate: 0,
      igstAmount: 0,
      totalAmount: 5000,
      totalInINR: 417500,
      paymentStatus: 'PAID',
      amountPaid: 5000,
      balanceDue: 0,
      paymentTerms: 'Net 30',
      notes: 'Thank you for your business!',
      lineItems: {
        create: [
          {
            description: 'Software Development Services - November 2024',
            quantity: 160,
            rate: 25,
            amount: 4000,
            serviceCode: '99831190',
          },
          {
            description: 'Technical Consultation',
            quantity: 20,
            rate: 50,
            amount: 1000,
            serviceCode: '99831190',
          },
        ],
      },
    },
  })
  invoices.push(invoice1)

  // Invoice 2: Partially paid GBP invoice
  const invoice2 = await prisma.invoice.create({
    data: {
      userId: demoUser.id,
      clientId: clients[1].id,
      invoiceNumber: 'DEMO-FY24-25/002',
      invoiceDate: new Date('2024-11-15'),
      dueDate: new Date('2024-12-15'),
      status: 'SENT',
      placeOfSupply: 'Outside India',
      serviceCode: '99831190',
      lutId: lut.id,
      currency: 'GBP',
      exchangeRate: 105.20,
      exchangeSource: 'RBI Reference Rate',
      subtotal: 3500,
      igstRate: 0,
      igstAmount: 0,
      totalAmount: 3500,
      totalInINR: 368200,
      paymentStatus: 'PARTIALLY_PAID',
      amountPaid: 2000,
      balanceDue: 1500,
      paymentTerms: 'Net 30',
      lineItems: {
        create: [
          {
            description: 'Cloud Infrastructure Setup and Management',
            quantity: 1,
            rate: 2500,
            amount: 2500,
            serviceCode: '99831190',
          },
          {
            description: 'Monthly Support and Maintenance',
            quantity: 1,
            rate: 1000,
            amount: 1000,
            serviceCode: '99831190',
          },
        ],
      },
    },
  })
  invoices.push(invoice2)

  // Invoice 3: Unpaid EUR invoice (overdue)
  const invoice3 = await prisma.invoice.create({
    data: {
      userId: demoUser.id,
      clientId: clients[2].id,
      invoiceNumber: 'DEMO-FY24-25/003',
      invoiceDate: new Date('2024-10-01'),
      dueDate: new Date('2024-10-31'),
      status: 'OVERDUE',
      placeOfSupply: 'Outside India',
      serviceCode: '99831190',
      lutId: lut.id,
      currency: 'EUR',
      exchangeRate: 91.75,
      exchangeSource: 'RBI Reference Rate',
      subtotal: 4200,
      igstRate: 0,
      igstAmount: 0,
      totalAmount: 4200,
      totalInINR: 385350,
      paymentStatus: 'UNPAID',
      amountPaid: 0,
      balanceDue: 4200,
      paymentTerms: 'Net 30',
      lineItems: {
        create: [
          {
            description: 'Business Process Automation Consulting',
            quantity: 80,
            rate: 45,
            amount: 3600,
            serviceCode: '99831190',
          },
          {
            description: 'Documentation and Training',
            quantity: 12,
            rate: 50,
            amount: 600,
            serviceCode: '99831190',
          },
        ],
      },
    },
  })
  invoices.push(invoice3)

  // Invoice 4: Recent draft invoice
  const invoice4 = await prisma.invoice.create({
    data: {
      userId: demoUser.id,
      clientId: clients[0].id,
      invoiceNumber: 'DEMO-FY24-25/004',
      invoiceDate: new Date('2024-12-01'),
      dueDate: new Date('2024-12-31'),
      status: 'DRAFT',
      placeOfSupply: 'Outside India',
      serviceCode: '99831190',
      lutId: lut.id,
      currency: 'USD',
      exchangeRate: 84.25,
      exchangeSource: 'RBI Reference Rate',
      subtotal: 7500,
      igstRate: 0,
      igstAmount: 0,
      totalAmount: 7500,
      totalInINR: 631875,
      paymentStatus: 'UNPAID',
      amountPaid: 0,
      balanceDue: 7500,
      paymentTerms: 'Net 30',
      lineItems: {
        create: [
          {
            description: 'Mobile App Development - Phase 1',
            quantity: 200,
            rate: 30,
            amount: 6000,
            serviceCode: '99831190',
          },
          {
            description: 'UI/UX Design Services',
            quantity: 30,
            rate: 50,
            amount: 1500,
            serviceCode: '99831190',
          },
        ],
      },
    },
  })
  invoices.push(invoice4)

  console.log('✅ Created', invoices.length, 'demo invoices')

  // Create payments for invoices
  const payments = []

  // Full payment for invoice 1
  const payment1 = await prisma.payment.create({
    data: {
      invoiceId: invoice1.id,
      amount: 5000,
      currency: 'USD',
      paymentDate: new Date('2024-11-25'),
      paymentMethod: 'WISE',
      reference: 'WISE-TXN-123456',
      notes: 'Full payment received',
      // Platform details
      amountReceivedBeforeFees: 4950,
      platformFeesInCurrency: 50,
      // Bank details
      creditedAmount: 412575,
      actualExchangeRate: 83.35,
      bankChargesInr: 150,
      fircNumber: 'SBIN24FIR001234',
      fircDate: new Date('2024-11-26'),
    },
  })
  payments.push(payment1)

  // Partial payment for invoice 2
  const payment2 = await prisma.payment.create({
    data: {
      invoiceId: invoice2.id,
      amount: 2000,
      currency: 'GBP',
      paymentDate: new Date('2024-12-01'),
      paymentMethod: 'BANK_TRANSFER',
      reference: 'SWIFT-REF-789012',
      notes: 'Partial payment - 1st installment',
      // Bank details
      creditedAmount: 210000,
      actualExchangeRate: 105.00,
      bankChargesInr: 400,
      fircNumber: 'HDFC24FIR005678',
      fircDate: new Date('2024-12-02'),
    },
  })
  payments.push(payment2)

  console.log('✅ Created', payments.length, 'demo payments')

  console.log('\n🎉 Demo data seeded successfully!')
  console.log('\n📧 Demo User Credentials:')
  console.log('   Email: demo@gsthive.com')
  console.log('   Password: demo123')
  console.log('\n📊 Created:')
  console.log(`   - 1 Demo user with complete profile`)
  console.log(`   - 1 Active LUT`)
  console.log(`   - ${clients.length} Clients (US, UK, Germany)`)
  console.log(`   - ${invoices.length} Invoices (1 paid, 1 partial, 1 overdue, 1 draft)`)
  console.log(`   - ${payments.length} Payments with complete tracking`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding demo data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })