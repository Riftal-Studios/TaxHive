#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function seedDemoData() {
  try {
    console.log('🌱 Seeding demo data...\n')
    
    // Clean up existing demo data first
    const email = 'demo@gsthive.com'
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      console.log('🧹 Cleaning up existing demo data...')
      // Delete in correct order to respect foreign key constraints
      await prisma.payment.deleteMany({ 
        where: { 
          invoice: { userId: existingUser.id } 
        } 
      })
      await prisma.invoiceItem.deleteMany({ 
        where: { 
          invoice: { userId: existingUser.id } 
        } 
      })
      await prisma.invoice.deleteMany({ where: { userId: existingUser.id } })
      await prisma.lUT.deleteMany({ where: { userId: existingUser.id } })
      await prisma.client.deleteMany({ where: { userId: existingUser.id } })
      await prisma.user.delete({ where: { id: existingUser.id } })
      console.log('✅ Cleaned up existing demo data')
    }

    // Create demo user
    const hashedPassword = await hash('demo123', 12)
    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Demo Company Pvt Ltd',
        gstin: '29AABCD1234E1Z5',
        pan: 'AABCD1234E',
        address: '123 Tech Park, HSR Layout, Bangalore, Karnataka 560102',
        emailVerified: new Date(),
        onboardingCompleted: true,
      }
    })
    
    console.log(`✅ Created demo user: ${user.email}`)

    // Create LUT
    const lut = await prisma.lUT.create({
      data: {
        userId: user.id,
        lutNumber: 'AD2900221234567',
        lutDate: new Date('2024-03-15'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
        isActive: true,
      }
    })
    
    console.log(`✅ Created LUT: ${lut.lutNumber}`)

    // Create demo clients
    const clients = await Promise.all([
      prisma.client.create({
        data: {
          userId: user.id,
          name: 'Acme Corporation',
          email: 'billing@acme.com',
          company: 'Acme Corporation',
          address: '456 Main St, New York, NY 10001, USA',
          country: 'US',
          taxId: 'US-EIN-12-3456789',
          phone: '+1 555-123-4567',
        }
      }),
      prisma.client.create({
        data: {
          userId: user.id,
          name: 'TechStart GmbH',
          email: 'finance@techstart.de',
          company: 'TechStart GmbH',
          address: 'Hauptstraße 123, 10115 Berlin, Germany',
          country: 'DE',
          taxId: 'DE123456789',
          phone: '+49 30 12345678',
        }
      }),
      prisma.client.create({
        data: {
          userId: user.id,
          name: 'Digital Innovations Ltd',
          email: 'accounts@digitalinnovations.co.uk',
          company: 'Digital Innovations Ltd',
          address: '789 Tech Avenue, London EC2A 4BX, UK',
          country: 'GB',
          taxId: 'GB123456789',
          phone: '+44 20 7123 4567',
        }
      }),
    ])
    
    console.log(`✅ Created ${clients.length} demo clients`)

    // Create exchange rates
    const exchangeRates = await Promise.all([
      prisma.exchangeRate.create({
        data: {
          currency: 'USD',
          rate: 83.45,
          date: new Date(),
          source: 'RBI Reference Rate',
        }
      }),
      prisma.exchangeRate.create({
        data: {
          currency: 'EUR',
          rate: 89.32,
          date: new Date(),
          source: 'RBI Reference Rate',
        }
      }),
      prisma.exchangeRate.create({
        data: {
          currency: 'GBP',
          rate: 104.25,
          date: new Date(),
          source: 'RBI Reference Rate',
        }
      }),
    ])
    
    console.log(`✅ Created ${exchangeRates.length} exchange rates`)

    // Create demo invoices
    const invoices = []
    const bankDetails = `Bank Name: HDFC Bank Ltd
Account Name: Demo Company Pvt Ltd
Account Number: 50200012345678
IFSC Code: HDFC0001234
SWIFT Code: HDFCINBBXXX
Branch: Koramangala, Bangalore`

    // Invoice 1 - Paid
    const invoice1 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[0].id,
        lutId: lut.id,
        invoiceNumber: 'FY24-25/001',
        invoiceDate: new Date('2024-10-15'),
        dueDate: new Date('2024-11-15'),
        currency: 'USD',
        exchangeRate: 83.45,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 5000,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 5000,
        totalInINR: 417250,
        status: 'PAID',
        paymentStatus: 'PAID',
        amountPaid: 5000,
        balanceDue: 0,
        placeOfSupply: 'OUTSIDE_INDIA',
        serviceCode: '99831000',
        paymentTerms: '30',
        bankDetails,
        notes: 'Thank you for your business!',
        publicAccessToken: 'demo-token-001',
        tokenExpiresAt: new Date('2025-12-31'),
      }
    })
    
    // Add line items for invoice 1
    await prisma.invoiceItem.createMany({
      data: [
        {
          invoiceId: invoice1.id,
          description: 'Web Development Services - October 2024',
          quantity: 1,
          rate: 3000,
          amount: 3000,
          serviceCode: '99831000',
        },
        {
          invoiceId: invoice1.id,
          description: 'API Integration Services',
          quantity: 1,
          rate: 2000,
          amount: 2000,
          serviceCode: '99831000',
        },
      ]
    })
    
    // Add payment for invoice 1
    await prisma.payment.create({
      data: {
        invoiceId: invoice1.id,
        amount: 5000,
        currency: 'USD',
        paymentDate: new Date('2024-10-25'),
        paymentMethod: 'BANK_TRANSFER',
        reference: 'WIRE-2024-10-25-001',
        notes: 'Full payment received',
      }
    })
    
    invoices.push(invoice1)

    // Invoice 2 - Partially Paid
    const invoice2 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[1].id,
        lutId: lut.id,
        invoiceNumber: 'FY24-25/002',
        invoiceDate: new Date('2024-11-01'),
        dueDate: new Date('2024-12-01'),
        currency: 'EUR',
        exchangeRate: 89.32,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 8000,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 8000,
        totalInINR: 714560,
        status: 'PARTIALLY_PAID',
        paymentStatus: 'PARTIAL',
        amountPaid: 3000,
        balanceDue: 5000,
        placeOfSupply: 'OUTSIDE_INDIA',
        serviceCode: '99831000',
        paymentTerms: '30',
        bankDetails,
        publicAccessToken: 'demo-token-002',
        tokenExpiresAt: new Date('2025-12-31'),
      }
    })
    
    // Add line items for invoice 2
    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice2.id,
        description: 'Mobile App Development - Phase 1',
        quantity: 1,
        rate: 8000,
        amount: 8000,
        serviceCode: '99831000',
      }
    })
    
    // Add partial payment for invoice 2
    await prisma.payment.create({
      data: {
        invoiceId: invoice2.id,
        amount: 3000,
        currency: 'EUR',
        paymentDate: new Date('2024-11-15'),
        paymentMethod: 'BANK_TRANSFER',
        reference: 'SEPA-2024-11-15-001',
        notes: 'Partial payment - 37.5%',
      }
    })
    
    invoices.push(invoice2)

    // Invoice 3 - Sent/Unpaid
    const invoice3 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[2].id,
        lutId: lut.id,
        invoiceNumber: 'FY24-25/003',
        invoiceDate: new Date('2024-12-01'),
        dueDate: new Date('2024-12-31'),
        currency: 'GBP',
        exchangeRate: 104.25,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 12000,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 12000,
        totalInINR: 1251000,
        status: 'SENT',
        paymentStatus: 'UNPAID',
        amountPaid: 0,
        balanceDue: 12000,
        placeOfSupply: 'OUTSIDE_INDIA',
        serviceCode: '99831000',
        paymentTerms: '30',
        bankDetails,
        publicAccessToken: 'demo-token-003',
        tokenExpiresAt: new Date('2025-12-31'),
      }
    })
    
    // Add line items for invoice 3
    await prisma.invoiceItem.createMany({
      data: [
        {
          invoiceId: invoice3.id,
          description: 'Consulting Services - December 2024',
          quantity: 40,
          rate: 200,
          amount: 8000,
          serviceCode: '99831000',
        },
        {
          invoiceId: invoice3.id,
          description: 'Project Management',
          quantity: 20,
          rate: 200,
          amount: 4000,
          serviceCode: '99831000',
        },
      ]
    })
    
    invoices.push(invoice3)

    // Invoice 4 - Draft
    const invoice4 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[0].id,
        lutId: lut.id,
        invoiceNumber: 'FY24-25/004',
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: 'USD',
        exchangeRate: 83.45,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 15000,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 15000,
        totalInINR: 1251750,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        amountPaid: 0,
        balanceDue: 15000,
        placeOfSupply: 'OUTSIDE_INDIA',
        serviceCode: '99831000',
        paymentTerms: '30',
        bankDetails,
        notes: 'Draft invoice for upcoming project',
        publicAccessToken: 'demo-token-004',
        tokenExpiresAt: new Date('2025-12-31'),
      }
    })
    
    // Add line items for invoice 4
    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice4.id,
        description: 'Enterprise Software Development',
        quantity: 1,
        rate: 15000,
        amount: 15000,
        serviceCode: '99831000',
      }
    })
    
    invoices.push(invoice4)

    console.log(`✅ Created ${invoices.length} demo invoices with line items and payments`)

    console.log('\n🎉 Demo data seeded successfully!')
    console.log('\n📧 Login credentials:')
    console.log(`   Email: ${email}`)
    console.log('   Password: demo123')
    console.log('\n🔗 Public invoice URLs:')
    invoices.forEach((inv, i) => {
      console.log(`   Invoice ${i + 1}: http://localhost:3000/invoice/${inv.publicAccessToken}`)
    })

  } catch (error) {
    console.error('❌ Error seeding demo data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedDemoData().catch(console.error)