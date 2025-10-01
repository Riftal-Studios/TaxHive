import { Logger } from '../../lib/logger'
import { PrismaClient } from '@prisma/client'
import { addMonths, subDays, addDays, subMonths } from 'date-fns'

const prisma = new PrismaClient()

async function seedTestData() {
  Logger.info('Starting test data seed...')

  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: 'nasiridrishi@outlook.com' }
    })

    if (!user) {
      Logger.error('User nasiridrishi@outlook.com not found!')
      return
    }

    Logger.info('Found user:', user.email)

    // Create LUTs
    const lut = await prisma.lUT.create({
      data: {
        userId: user.id,
        lutNumber: 'AD2902240000123',
        lutDate: new Date('2024-03-15'),
        validFrom: new Date('2024-04-01'),
        validTill: new Date('2025-03-31'),
        isActive: true,
      }
    })
    
    // Create an older LUT (expired)
    await prisma.lUT.create({
      data: {
        userId: user.id,
        lutNumber: 'AD2902230000099',
        lutDate: new Date('2023-03-20'),
        validFrom: new Date('2023-04-01'),
        validTill: new Date('2024-03-31'),
        isActive: false,
      }
    })
    
    Logger.info('Created LUTs')

    // Create test clients
    const clients = await Promise.all([
      prisma.client.create({
        data: {
          userId: user.id,
          name: 'John Smith',
          email: 'john.smith@techcorp.com',
          company: 'TechCorp Solutions Inc.',
          address: '123 Silicon Valley Blvd\nSan Francisco, CA 94105',
          country: 'United States',
          phone: '+1-415-555-0123',
          taxId: 'US-EIN-12-3456789',
          isActive: true,
        }
      }),
      prisma.client.create({
        data: {
          userId: user.id,
          name: 'Emma Johnson',
          email: 'emma@designstudio.co.uk',
          company: 'Creative Design Studio Ltd',
          address: '45 Oxford Street\nLondon, W1D 2DZ',
          country: 'United Kingdom',
          phone: '+44-20-7946-0958',
          taxId: 'GB123456789',
          isActive: true,
        }
      }),
      prisma.client.create({
        data: {
          userId: user.id,
          name: 'Michael Chen',
          email: 'mchen@innovate.sg',
          company: 'Innovate Technologies Pte Ltd',
          address: '10 Anson Road\n#22-02 International Plaza\nSingapore 079903',
          country: 'Singapore',
          phone: '+65-6224-1234',
          taxId: 'SG-GST-12-3456789',
          isActive: true,
        }
      }),
      prisma.client.create({
        data: {
          userId: user.id,
          name: 'Hans Mueller',
          email: 'hans@autowerk.de',
          company: 'Autowerk GmbH',
          address: 'Kurfürstendamm 156\n10709 Berlin',
          country: 'Germany',
          phone: '+49-30-1234-5678',
          taxId: 'DE123456789',
          isActive: true,
        }
      }),
      prisma.client.create({
        data: {
          userId: user.id,
          name: 'Sarah Williams',
          email: 'sarah@mediahub.com.au',
          company: 'Media Hub Australia Pty Ltd',
          address: '200 George Street\nSydney NSW 2000',
          country: 'Australia',
          phone: '+61-2-9876-5432',
          taxId: 'ABN 12 345 678 901',
          isActive: true,
        }
      }),
      prisma.client.create({
        data: {
          userId: user.id,
          name: 'Pierre Dubois',
          email: 'pierre@fashiontech.fr',
          company: 'Fashion Tech SARL',
          address: '15 Avenue des Champs-Élysées\n75008 Paris',
          country: 'France',
          phone: '+33-1-4567-8900',
          taxId: 'FR12345678901',
          isActive: true,
        }
      }),
    ])
    Logger.info('Created', clients.length, 'clients')

    // Create invoices with different statuses
    const invoices = []

    // Invoice 1: Fully paid invoice from last month
    const invoice1 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[0].id,
        invoiceNumber: `FY24-25/TEST-${Date.now()}-001`,
        invoiceDate: subMonths(new Date(), 1),
        dueDate: subDays(new Date(), 15),
        status: 'PAID',
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '9983',
        lutId: lut.id,
        currency: 'USD',
        exchangeRate: 83.25,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 5000,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 5000,
        totalInINR: 416250,
        paymentStatus: 'PAID',
        amountPaid: 5000,
        balanceDue: 0,
        description: 'Web Development Services',
        paymentTerms: 'Net 30',
        bankDetails: 'Bank: HDFC Bank\nAccount: 12345678901234\nIFSC: HDFC0001234\nSWIFT: HDFCINBB',
        notes: 'Thank you for your business!',
        pdfUrl: '/invoices/FY24-25-001.pdf',
        lineItems: {
          create: [
            {
              description: 'Frontend Development - React Application',
              quantity: 80,
              rate: 50,
              amount: 4000,
              serviceCode: '9983'
            },
            {
              description: 'Backend API Development - Node.js',
              quantity: 40,
              rate: 25,
              amount: 1000,
              serviceCode: '9983'
            }
          ]
        }
      }
    })
    invoices.push(invoice1)

    // Invoice 2: Partially paid invoice
    const invoice2 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[1].id,
        invoiceNumber: `FY24-25/TEST-${Date.now()}-002`,
        invoiceDate: subDays(new Date(), 20),
        dueDate: addDays(new Date(), 10),
        status: 'SENT',
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '9983',
        lutId: lut.id,
        currency: 'GBP',
        exchangeRate: 105.50,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 3500,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 3500,
        totalInINR: 369250,
        paymentStatus: 'PARTIALLY_PAID',
        amountPaid: 2000,
        balanceDue: 1500,
        description: 'UI/UX Design Services',
        paymentTerms: 'Net 30',
        bankDetails: 'Bank: HDFC Bank\nAccount: 12345678901234\nIFSC: HDFC0001234\nSWIFT: HDFCINBB',
        notes: 'Please include invoice number in payment reference.',
        pdfUrl: '/invoices/FY24-25-002.pdf',
        lineItems: {
          create: [
            {
              description: 'UI Design - Mobile Application',
              quantity: 60,
              rate: 45,
              amount: 2700,
              serviceCode: '9983'
            },
            {
              description: 'UX Research and Wireframing',
              quantity: 20,
              rate: 40,
              amount: 800,
              serviceCode: '9983'
            }
          ]
        }
      }
    })
    invoices.push(invoice2)

    // Invoice 3: Unpaid overdue invoice
    const invoice3 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[2].id,
        invoiceNumber: `FY24-25/TEST-${Date.now()}-003`,
        invoiceDate: subDays(new Date(), 45),
        dueDate: subDays(new Date(), 15),
        status: 'OVERDUE',
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '9983',
        lutId: lut.id,
        currency: 'SGD',
        exchangeRate: 61.80,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 2800,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 2800,
        totalInINR: 173040,
        paymentStatus: 'UNPAID',
        amountPaid: 0,
        balanceDue: 2800,
        description: 'Mobile App Development',
        paymentTerms: 'Net 30',
        bankDetails: 'Bank: HDFC Bank\nAccount: 12345678901234\nIFSC: HDFC0001234\nSWIFT: HDFCINBB',
        notes: 'Late payment fee of 1.5% per month applies after due date.',
        pdfUrl: '/invoices/FY24-25-003.pdf',
        lineItems: {
          create: [
            {
              description: 'iOS App Development',
              quantity: 40,
              rate: 50,
              amount: 2000,
              serviceCode: '9983'
            },
            {
              description: 'Android App Development',
              quantity: 20,
              rate: 40,
              amount: 800,
              serviceCode: '9983'
            }
          ]
        }
      }
    })
    invoices.push(invoice3)

    // Invoice 4: Draft invoice
    const invoice4 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[0].id,
        invoiceNumber: `FY24-25/TEST-${Date.now()}-004`,
        invoiceDate: new Date(),
        dueDate: addDays(new Date(), 30),
        status: 'DRAFT',
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '9983',
        lutId: lut.id,
        currency: 'USD',
        exchangeRate: 83.50,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 6000,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 6000,
        totalInINR: 501000,
        paymentStatus: 'UNPAID',
        amountPaid: 0,
        balanceDue: 6000,
        description: 'Consulting Services',
        paymentTerms: 'Net 30',
        bankDetails: 'Bank: HDFC Bank\nAccount: 12345678901234\nIFSC: HDFC0001234\nSWIFT: HDFCINBB',
        lineItems: {
          create: [
            {
              description: 'Technical Consulting - Architecture Review',
              quantity: 20,
              rate: 150,
              amount: 3000,
              serviceCode: '9983'
            },
            {
              description: 'Code Review and Optimization',
              quantity: 30,
              rate: 100,
              amount: 3000,
              serviceCode: '9983'
            }
          ]
        }
      }
    })
    invoices.push(invoice4)

    // Invoice 5: EUR invoice with Payoneer payment
    const invoice5 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[3].id, // German client
        invoiceNumber: `FY24-25/TEST-${Date.now()}-005`,
        invoiceDate: subDays(new Date(), 25),
        dueDate: addDays(new Date(), 5),
        status: 'PAID',
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '9983',
        lutId: lut.id,
        currency: 'EUR',
        exchangeRate: 91.20,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 4200,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 4200,
        totalInINR: 383040,
        paymentStatus: 'PAID',
        amountPaid: 4200,
        balanceDue: 0,
        description: 'API Integration Services',
        paymentTerms: 'Net 15',
        bankDetails: 'Bank: HDFC Bank\nAccount: 12345678901234\nIFSC: HDFC0001234\nSWIFT: HDFCINBB',
        notes: 'Integration completed successfully. Documentation provided.',
        lineItems: {
          create: [
            {
              description: 'REST API Development and Integration',
              quantity: 60,
              rate: 60,
              amount: 3600,
              serviceCode: '9983'
            },
            {
              description: 'API Documentation and Testing',
              quantity: 10,
              rate: 60,
              amount: 600,
              serviceCode: '9983'
            }
          ]
        }
      }
    })
    invoices.push(invoice5)

    // Invoice 6: AUD invoice partially paid via PayPal
    const invoice6 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[4].id, // Australian client
        invoiceNumber: `FY24-25/TEST-${Date.now()}-006`,
        invoiceDate: subDays(new Date(), 15),
        dueDate: addDays(new Date(), 15),
        status: 'SENT',
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '9983',
        lutId: lut.id,
        currency: 'AUD',
        exchangeRate: 54.30,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 3800,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 3800,
        totalInINR: 206340,
        paymentStatus: 'PARTIALLY_PAID',
        amountPaid: 1900,
        balanceDue: 1900,
        description: 'Video Editing Services',
        paymentTerms: 'Net 30',
        bankDetails: 'Bank: HDFC Bank\nAccount: 12345678901234\nIFSC: HDFC0001234\nSWIFT: HDFCINBB',
        lineItems: {
          create: [
            {
              description: 'Corporate Video Editing (5 videos)',
              quantity: 25,
              rate: 120,
              amount: 3000,
              serviceCode: '9983'
            },
            {
              description: 'Motion Graphics and Transitions',
              quantity: 8,
              rate: 100,
              amount: 800,
              serviceCode: '9983'
            }
          ]
        }
      }
    })
    invoices.push(invoice6)

    // Invoice 7: Large EUR invoice with multiple payments
    const invoice7 = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clients[5].id, // French client
        invoiceNumber: `FY24-25/TEST-${Date.now()}-007`,
        invoiceDate: subMonths(new Date(), 2),
        dueDate: subMonths(new Date(), 1),
        status: 'PAID',
        placeOfSupply: 'Outside India (Section 2-6)',
        serviceCode: '9983',
        lutId: lut.id,
        currency: 'EUR',
        exchangeRate: 90.80,
        exchangeSource: 'RBI Reference Rate',
        subtotal: 12000,
        igstRate: 0,
        igstAmount: 0,
        totalAmount: 12000,
        totalInINR: 1089600,
        paymentStatus: 'PAID',
        amountPaid: 12000,
        balanceDue: 0,
        description: 'E-commerce Platform Development',
        paymentTerms: 'Net 45',
        bankDetails: 'Bank: HDFC Bank\nAccount: 12345678901234\nIFSC: HDFC0001234\nSWIFT: HDFCINBB',
        notes: 'Project delivered in 3 phases. All milestones completed.',
        lineItems: {
          create: [
            {
              description: 'Phase 1: Backend Development',
              quantity: 120,
              rate: 40,
              amount: 4800,
              serviceCode: '9983'
            },
            {
              description: 'Phase 2: Frontend Development',
              quantity: 100,
              rate: 40,
              amount: 4000,
              serviceCode: '9983'
            },
            {
              description: 'Phase 3: Testing and Deployment',
              quantity: 80,
              rate: 40,
              amount: 3200,
              serviceCode: '9983'
            }
          ]
        }
      }
    })
    invoices.push(invoice7)

    Logger.info('Created', invoices.length, 'invoices')

    // Create payments
    // Payment 1: Full payment for invoice 1
    await prisma.payment.create({
      data: {
        invoiceId: invoice1.id,
        amount: 5000, // Amount client sent
        currency: 'USD',
        paymentDate: subDays(new Date(), 10),
        paymentMethod: 'BANK_TRANSFER',
        reference: 'SWIFT-TRX-2024-001234',
        notes: 'Payment received via SWIFT transfer',
        amountReceivedBeforeFees: 5000, // No platform fees for bank transfer
        platformFeesInCurrency: 0,
        creditedAmount: 414875,
        actualExchangeRate: 82.975,
        bankChargesInr: 1375,
        fircNumber: 'HDFC/FIRC/2024/001234',
        fircDate: subDays(new Date(), 8),
      }
    })

    // Payment 2: Partial payment for invoice 2
    await prisma.payment.create({
      data: {
        invoiceId: invoice2.id,
        amount: 2000, // Amount client sent
        currency: 'GBP',
        paymentDate: subDays(new Date(), 5),
        paymentMethod: 'WISE',
        reference: 'WISE-12345678',
        notes: 'First installment payment',
        amountReceivedBeforeFees: 1990, // Wise took 10 GBP fee
        platformFeesInCurrency: 10, // Fee in GBP
        creditedAmount: 209900,
        actualExchangeRate: 105.47, // Slightly better than RBI rate
        bankChargesInr: 0, // No bank charges
        fircNumber: 'HDFC/FIRC/2024/001235',
        fircDate: subDays(new Date(), 3),
      }
    })

    // Payment 3: Payoneer payment for invoice 5 (EUR)
    await prisma.payment.create({
      data: {
        invoiceId: invoice5.id,
        amount: 4200, // Amount client sent
        currency: 'EUR',
        paymentDate: subDays(new Date(), 20),
        paymentMethod: 'PAYONEER',
        reference: 'PYN-2024-EUR-98765',
        notes: 'Payoneer payment with 2% platform fee',
        amountReceivedBeforeFees: 4116, // Payoneer took 2% fee (84 EUR)
        platformFeesInCurrency: 84, // 2% of 4200
        creditedAmount: 374179.20, // 4116 * 90.95 (slightly lower than RBI rate)
        actualExchangeRate: 90.95,
        bankChargesInr: 0,
        fircNumber: 'HDFC/FIRC/2024/001236',
        fircDate: subDays(new Date(), 18),
        fircDocumentUrl: '/uploads/firc-payoneer-001236.pdf',
      }
    })

    // Payment 4: PayPal partial payment for invoice 6 (AUD)
    await prisma.payment.create({
      data: {
        invoiceId: invoice6.id,
        amount: 1900, // Amount client sent
        currency: 'AUD',
        paymentDate: subDays(new Date(), 10),
        paymentMethod: 'PAYPAL',
        reference: 'PP-TXN-AUD-456789',
        notes: 'First installment via PayPal',
        amountReceivedBeforeFees: 1833.50, // PayPal took 3.5% fee
        platformFeesInCurrency: 66.50, // 3.5% of 1900
        creditedAmount: 99039, // 1833.50 * 54.00 (PayPal's exchange rate)
        actualExchangeRate: 54.00, // Lower than RBI rate of 54.30
        bankChargesInr: 250, // Bank charges for PayPal transfer
        fircNumber: 'HDFC/FIRC/2024/001237',
        fircDate: subDays(new Date(), 8),
      }
    })

    // Payment 5: First payment for large invoice 7
    await prisma.payment.create({
      data: {
        invoiceId: invoice7.id,
        amount: 4000, // Phase 1 payment
        currency: 'EUR',
        paymentDate: subMonths(new Date(), 1.5),
        paymentMethod: 'BANK_TRANSFER',
        reference: 'SEPA-FR-001234',
        notes: 'Phase 1 completion payment',
        amountReceivedBeforeFees: 4000,
        platformFeesInCurrency: 0,
        creditedAmount: 362000,
        actualExchangeRate: 90.50,
        bankChargesInr: 1200,
        fircNumber: 'HDFC/FIRC/2024/001100',
        fircDate: subMonths(new Date(), 1.4),
      }
    })

    // Payment 6: Second payment for invoice 7
    await prisma.payment.create({
      data: {
        invoiceId: invoice7.id,
        amount: 4000, // Phase 2 payment
        currency: 'EUR',
        paymentDate: subDays(new Date(), 45),
        paymentMethod: 'BANK_TRANSFER',
        reference: 'SEPA-FR-001235',
        notes: 'Phase 2 completion payment',
        amountReceivedBeforeFees: 4000,
        platformFeesInCurrency: 0,
        creditedAmount: 364400,
        actualExchangeRate: 91.10,
        bankChargesInr: 1200,
        fircNumber: 'HDFC/FIRC/2024/001150',
        fircDate: subDays(new Date(), 43),
      }
    })

    // Payment 7: Final payment for invoice 7
    await prisma.payment.create({
      data: {
        invoiceId: invoice7.id,
        amount: 4000, // Phase 3 payment
        currency: 'EUR',
        paymentDate: subDays(new Date(), 30),
        paymentMethod: 'WISE',
        reference: 'WISE-EUR-789456',
        notes: 'Final phase payment via Wise',
        amountReceivedBeforeFees: 3960, // Wise took 40 EUR fee
        platformFeesInCurrency: 40,
        creditedAmount: 360720, // 3960 * 91.09
        actualExchangeRate: 91.09,
        bankChargesInr: 0,
        fircNumber: 'HDFC/FIRC/2024/001200',
        fircDate: subDays(new Date(), 28),
        fircDocumentUrl: '/uploads/firc-wise-001200.pdf',
      }
    })

    Logger.info('Created payment records')

    // Create exchange rates for multiple days
    const exchangeRates = [
      { currency: 'USD', rate: 83.50 },
      { currency: 'GBP', rate: 105.50 },
      { currency: 'EUR', rate: 91.20 },
      { currency: 'SGD', rate: 61.80 },
      { currency: 'AUD', rate: 54.30 },
      { currency: 'CAD', rate: 61.20 },
      { currency: 'CHF', rate: 94.80 },
      { currency: 'JPY', rate: 0.55 },
      { currency: 'AED', rate: 22.75 },
      { currency: 'NZD', rate: 51.40 },
    ]
    
    // Create rates for today and past 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date()
      date.setDate(date.getDate() - dayOffset)
      date.setHours(0, 0, 0, 0)
      
      for (const { currency, rate } of exchangeRates) {
        // Add some minor variation to rates for different days
        const variation = (Math.random() - 0.5) * 0.5 // +/- 0.25 variation
        const adjustedRate = rate + variation
        
        await prisma.exchangeRate.upsert({
          where: {
            currency_date: {
              currency,
              date,
            }
          },
          update: {
            rate: adjustedRate,
            source: 'RBI Reference Rate',
          },
          create: {
            currency,
            rate: adjustedRate,
            source: 'RBI Reference Rate',
            date,
          }
        })
      }
    }
    Logger.info('Created exchange rates for multiple currencies and days')

    Logger.info('Test data seeding completed successfully!')
  } catch (error) {
    Logger.error('Error seeding test data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedTestData()
  .catch((e) => {
    Logger.error(e)
    process.exit(1)
  })