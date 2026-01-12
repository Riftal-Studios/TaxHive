import { PrismaClient, Prisma } from '@prisma/client'
import { hash } from 'bcryptjs'
import { faker } from '@faker-js/faker'

const prisma = new PrismaClient()

const DEMO_EMAIL = 'demo@taxhive.app'
const DEMO_PASSWORD = 'Demo123!'

// Helper to get command line flags
const hasCleanFlag = process.argv.includes('--clean')

interface Client {
  id: string
  userId: string
  name: string
  email: string
  company: string | null
  address: string
  country: string
  currency: string
  phone: string | null
  taxId: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface Invoice {
  id: string
  userId: string
  clientId: string | null
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date
  status: string
  placeOfSupply: string
  serviceCode: string
  lutId: string | null
  currency: string
  exchangeRate: Prisma.Decimal
  exchangeSource: string
  exchangeRateOverridden: boolean
  exchangeRateOverriddenAt: Date | null
  subtotal: Prisma.Decimal
  igstRate: Prisma.Decimal
  igstAmount: Prisma.Decimal
  totalAmount: Prisma.Decimal
  totalInINR: Prisma.Decimal
  paymentStatus: string
  amountPaid: Prisma.Decimal
  balanceDue: Prisma.Decimal
  description: string | null
  paymentTerms: string | null
  bankDetails: string | null
  notes: string | null
  pdfUrl: string | null
  pdfStatus: string | null
  pdfError: string | null
  pdfGeneratedAt: Date | null
  pdfJobId: string | null
  publicAccessToken: string | null
  tokenExpiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// Cleanup function
async function cleanupDemoUser() {
  console.log('🧹 Cleaning up existing demo user data...')
  
  const existingUser = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
  })

  if (!existingUser) {
    console.log('   No existing demo user found')
    return
  }

  console.log(`   Found existing demo user: ${existingUser.id}`)

  // Delete in correct order due to foreign key constraints
  const emailHistoryCount = await prisma.emailHistory.deleteMany({
    where: { userId: existingUser.id },
  })
  console.log(`   Deleted ${emailHistoryCount.count} email history entries`)

  const paymentCount = await prisma.payment.deleteMany({
    where: { invoice: { userId: existingUser.id } },
  })
  console.log(`   Deleted ${paymentCount.count} payments`)

  const invoiceItemCount = await prisma.invoiceItem.deleteMany({
    where: { invoice: { userId: existingUser.id } },
  })
  console.log(`   Deleted ${invoiceItemCount.count} invoice items`)

  const invoiceCount = await prisma.invoice.deleteMany({
    where: { userId: existingUser.id },
  })
  console.log(`   Deleted ${invoiceCount.count} invoices`)

  const clientCount = await prisma.client.deleteMany({
    where: { userId: existingUser.id },
  })
  console.log(`   Deleted ${clientCount.count} clients`)

  const lutCount = await prisma.lUT.deleteMany({
    where: { userId: existingUser.id },
  })
  console.log(`   Deleted ${lutCount.count} LUT records`)

  // Delete OTPs
  await prisma.oTP.deleteMany({
    where: { userId: existingUser.id },
  })

  // Delete sessions and accounts
  await prisma.session.deleteMany({
    where: { userId: existingUser.id },
  })

  await prisma.account.deleteMany({
    where: { userId: existingUser.id },
  })

  // Finally delete the user
  await prisma.user.delete({
    where: { id: existingUser.id },
  })
  console.log('   Deleted demo user')

  console.log('✅ Cleanup completed\n')
}

// Create demo user
async function createDemoUser() {
  console.log('👤 Creating demo user...')
  
  const hashedPassword = await hash(DEMO_PASSWORD, 10)
  
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      password: hashedPassword,
      name: 'Rajesh Kumar',
      emailVerified: new Date(),
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      address: '123, MG Road, Jayanagar 4th Block, Bangalore, Karnataka 560011',
      onboardingCompleted: true,
      onboardingStep: 'complete',
    },
  })

  console.log(`   Created user: ${user.email} (ID: ${user.id})`)
  return user
}

// Create international clients
async function createClients(userId: string) {
  console.log('🏢 Creating international clients...')
  
  const clientsData = [
    // US Clients (USD)
    {
      name: faker.person.fullName(),
      company: 'TechVentures Inc',
      email: 'billing@techventures.us',
      address: '1234 Silicon Valley Blvd, San Francisco, CA 94105',
      country: 'United States',
      currency: 'USD',
      phone: '+1-415-555-0123',
      taxId: 'US-EIN-123456789',
    },
    {
      name: faker.person.fullName(),
      company: 'Innovate Software LLC',
      email: 'accounts@innovatesw.com',
      address: '5678 Tech Park Ave, Austin, TX 78701',
      country: 'United States',
      currency: 'USD',
      phone: '+1-512-555-0456',
      taxId: 'US-EIN-987654321',
    },
    {
      name: faker.person.fullName(),
      company: 'Digital Solutions Corp',
      email: 'finance@digitalsolutions.com',
      address: '9012 Business Center Dr, Seattle, WA 98101',
      country: 'United States',
      currency: 'USD',
      phone: '+1-206-555-0789',
      taxId: 'US-EIN-456789123',
    },
    // UK Clients (GBP)
    {
      name: faker.person.fullName(),
      company: 'London Tech Ltd',
      email: 'invoices@londontech.co.uk',
      address: '45 Canary Wharf, London E14 5AB',
      country: 'United Kingdom',
      currency: 'GBP',
      phone: '+44-20-7946-0958',
      taxId: 'GB-VAT-123456789',
    },
    {
      name: faker.person.fullName(),
      company: 'Manchester Digital Services',
      email: 'billing@manchesterdigital.co.uk',
      address: '78 Oxford Road, Manchester M1 5NH',
      country: 'United Kingdom',
      currency: 'GBP',
      phone: '+44-161-850-1234',
      taxId: 'GB-VAT-987654321',
    },
    // EU Clients (EUR)
    {
      name: faker.person.fullName(),
      company: 'Berlin Innovation GmbH',
      email: 'accounting@berlininnovation.de',
      address: 'Friedrichstraße 123, 10117 Berlin',
      country: 'Germany',
      currency: 'EUR',
      phone: '+49-30-1234-5678',
      taxId: 'DE-VAT-123456789',
    },
    {
      name: faker.person.fullName(),
      company: 'Paris Tech Solutions SARL',
      email: 'facturation@paristech.fr',
      address: '56 Avenue des Champs-Élysées, 75008 Paris',
      country: 'France',
      currency: 'EUR',
      phone: '+33-1-4567-8901',
      taxId: 'FR-VAT-987654321',
    },
    // Other countries
    {
      name: faker.person.fullName(),
      company: 'Toronto Systems Inc',
      email: 'ap@torontosystems.ca',
      address: '123 Bay Street, Toronto, ON M5J 2R8',
      country: 'Canada',
      currency: 'CAD',
      phone: '+1-416-555-0123',
      taxId: 'CA-BN-123456789',
    },
    {
      name: faker.person.fullName(),
      company: 'Sydney Digital Pty Ltd',
      email: 'accounts@sydneydigital.com.au',
      address: '89 George Street, Sydney NSW 2000',
      country: 'Australia',
      currency: 'AUD',
      phone: '+61-2-9876-5432',
      taxId: 'AU-ABN-12345678901',
    },
  ]

  const clients: Client[] = []
  for (const data of clientsData) {
    const client = await prisma.client.create({
      data: {
        userId,
        ...data,
      },
    })
    clients.push(client)
  }

  console.log(`   Created ${clients.length} clients`)
  return clients
}

// Create LUT records
async function createLUTs(userId: string) {
  console.log('📋 Creating LUT records...')
  
  const luts = [
    {
      userId,
      lutNumber: 'AD290124000001',
      lutDate: new Date('2024-04-01'),
      validFrom: new Date('2024-04-01'),
      validTill: new Date('2025-03-31'),
      isActive: true,
    },
    {
      userId,
      lutNumber: 'AD290123000001',
      lutDate: new Date('2023-04-01'),
      validFrom: new Date('2023-04-01'),
      validTill: new Date('2024-03-31'),
      isActive: false,
    },
  ]

  const createdLuts = await Promise.all(
    luts.map(lut => prisma.lUT.create({ data: lut }))
  )

  console.log(`   Created ${createdLuts.length} LUT records`)
  return createdLuts
}

// Create exchange rates
async function createExchangeRates() {
  console.log('💱 Creating exchange rates...')
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const rates = [
    { currency: 'USD', rate: new Prisma.Decimal(83.25) },
    { currency: 'EUR', rate: new Prisma.Decimal(90.50) },
    { currency: 'GBP', rate: new Prisma.Decimal(105.75) },
    { currency: 'CAD', rate: new Prisma.Decimal(61.30) },
    { currency: 'AUD', rate: new Prisma.Decimal(55.20) },
    { currency: 'SGD', rate: new Prisma.Decimal(62.15) },
  ]

  const createdRates = await Promise.all(
    rates.map(({ currency, rate }) =>
      prisma.exchangeRate.upsert({
        where: {
          currency_date: {
            currency,
            date: today,
          },
        },
        update: { rate, source: 'RBI' },
        create: {
          currency,
          rate,
          source: 'RBI',
          date: today,
        },
      })
    )
  )

  console.log(`   Created ${createdRates.length} exchange rates`)
  return createdRates
}

// Helper to get random items from array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

// Helper to get random number in range
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Create invoices with line items
async function createInvoices(
  userId: string,
  clients: Client[],
  activeLutId: string,
  exchangeRates: { currency: string; rate: number }[]
) {
  console.log('📄 Creating invoices with line items...')
  
  const serviceDescriptions = [
    'Full-stack Web Application Development',
    'API Integration and Backend Services',
    'Technical Consulting and Architecture Design',
    'Mobile App Development (iOS/Android)',
    'Database Design and Optimization',
    'DevOps and Cloud Infrastructure Setup',
    'Security Audit and Implementation',
    'UI/UX Design and Frontend Development',
  ]

  const serviceCodes = ['998314', '998315', '998316']
  
  const invoiceStatuses = [
    { status: 'DRAFT', paymentStatus: 'UNPAID', count: 2 },
    { status: 'SENT', paymentStatus: 'UNPAID', count: 5 },
    { status: 'SENT', paymentStatus: 'PAID', count: 6 },
    { status: 'SENT', paymentStatus: 'PARTIALLY_PAID', count: 3 },
    { status: 'SENT', paymentStatus: 'UNPAID', count: 2, overdue: true },
  ]

  const invoices: Invoice[] = []
  let invoiceCounter = 1

  for (const { status, paymentStatus, count, overdue } of invoiceStatuses) {
    for (let i = 0; i < count; i++) {
      const client = getRandomItem(clients)
      const exchangeRate = exchangeRates.find(er => er.currency === client.currency)!
      
      // Date calculations
      let invoiceDate: Date
      let dueDate: Date
      
      if (status === 'DRAFT') {
        invoiceDate = new Date()
        invoiceDate.setDate(invoiceDate.getDate() - randomInRange(0, 5))
        dueDate = new Date(invoiceDate)
        dueDate.setDate(dueDate.getDate() + 30)
      } else if (overdue) {
        invoiceDate = new Date()
        invoiceDate.setDate(invoiceDate.getDate() - randomInRange(45, 90))
        dueDate = new Date(invoiceDate)
        dueDate.setDate(dueDate.getDate() + 30)
      } else if (paymentStatus === 'PAID') {
        invoiceDate = new Date()
        invoiceDate.setDate(invoiceDate.getDate() - randomInRange(30, 90))
        dueDate = new Date(invoiceDate)
        dueDate.setDate(dueDate.getDate() + 30)
      } else {
        invoiceDate = new Date()
        invoiceDate.setDate(invoiceDate.getDate() - randomInRange(5, 30))
        dueDate = new Date(invoiceDate)
        dueDate.setDate(dueDate.getDate() + 30)
      }

      // Generate line items
      const numLineItems = randomInRange(2, 4)
      const lineItems = []
      let subtotal = new Prisma.Decimal(0)

      for (let j = 0; j < numLineItems; j++) {
        const quantity = new Prisma.Decimal(randomInRange(10, 100))
        const rate = new Prisma.Decimal(randomInRange(30, 100))
        const amount = quantity.mul(rate)
        
        lineItems.push({
          description: getRandomItem(serviceDescriptions),
          quantity,
          rate,
          amount,
          serviceCode: getRandomItem(serviceCodes),
        })
        
        subtotal = subtotal.add(amount)
      }

      const totalAmount = subtotal
      const totalInINR = subtotal.mul(exchangeRate.rate)
      
      let amountPaid = new Prisma.Decimal(0)
      if (paymentStatus === 'PAID') {
        amountPaid = totalAmount
      } else if (paymentStatus === 'PARTIALLY_PAID') {
        const paidPercentage = randomInRange(40, 60) / 100
        amountPaid = totalAmount.mul(new Prisma.Decimal(paidPercentage))
      }
      
      const balanceDue = totalAmount.sub(amountPaid)

      const invoice = await prisma.invoice.create({
        data: {
          userId,
          clientId: client.id,
          invoiceNumber: `FY24-25/${String(invoiceCounter).padStart(3, '0')}`,
          invoiceDate,
          dueDate,
          status,
          placeOfSupply: 'Outside India (Section 2-6)',
          serviceCode: getRandomItem(serviceCodes),
          lutId: activeLutId,
          currency: client.currency,
          exchangeRate: exchangeRate.rate,
          exchangeSource: 'RBI',
          subtotal,
          igstRate: new Prisma.Decimal(0),
          igstAmount: new Prisma.Decimal(0),
          totalAmount,
          totalInINR,
          paymentStatus,
          amountPaid,
          balanceDue,
          description: `Professional services for ${client.company}`,
          paymentTerms: randomInRange(0, 1) === 0 ? 'Net 30 days' : 'Net 45 days',
          bankDetails: 'Bank: HDFC Bank\nAccount Name: Rajesh Kumar\nAccount Number: 50200012345678\nIFSC Code: HDFC0001234\nSWIFT Code: HDFCINBB\nBranch: MG Road, Bangalore',
          notes: 'Thank you for your business!',
          pdfStatus: 'pending',
          lineItems: {
            create: lineItems,
          },
        },
      })

      invoices.push(invoice)
      invoiceCounter++
    }
  }

  console.log(`   Created ${invoices.length} invoices with line items`)
  return invoices
}

// Create payments for paid/partially paid invoices
async function createPayments(invoices: Invoice[]) {
  console.log('💰 Creating payment records...')
  
  const paymentMethods = ['Wire Transfer', 'PayPal', 'Wise', 'Bank Transfer']
  const payments = []
  
  for (const invoice of invoices) {
    if (invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'PARTIALLY_PAID') {
      const numPayments = invoice.paymentStatus === 'PAID' 
        ? randomInRange(1, 2) 
        : 1
      
      let remainingAmount = new Prisma.Decimal(invoice.amountPaid)
      
      for (let i = 0; i < numPayments; i++) {
        const isLastPayment = i === numPayments - 1
        const paymentAmount = isLastPayment
          ? remainingAmount
          : remainingAmount.div(new Prisma.Decimal(numPayments - i))
        
        remainingAmount = remainingAmount.sub(paymentAmount)
        
        const paymentDate = new Date(invoice.invoiceDate)
        paymentDate.setDate(paymentDate.getDate() + randomInRange(7, 35))
        
        const platformFeePercent = new Prisma.Decimal(randomInRange(2, 3) / 100)
        const platformFees = paymentAmount.mul(platformFeePercent)
        const amountAfterFees = paymentAmount.sub(platformFees)
        
        // Slight variation in exchange rate
        const baseRate = Number(invoice.exchangeRate)
        const actualRate = new Prisma.Decimal(baseRate + (Math.random() - 0.5))
        
        const creditedAmountINR = amountAfterFees.mul(actualRate)
        const bankCharges = new Prisma.Decimal(randomInRange(200, 500))
        
        const fircDate = new Date(paymentDate)
        fircDate.setDate(fircDate.getDate() + randomInRange(5, 10))
        
        const fircNumber = `FIRC/2024/HDFC/${String(randomInRange(10000, 99999))}`
        
        const payment = await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: paymentAmount,
            currency: invoice.currency,
            paymentDate,
            paymentMethod: getRandomItem(paymentMethods),
            reference: `${invoice.invoiceNumber}-${i + 1}`,
            notes: `Payment ${i + 1} of ${numPayments}`,
            amountReceivedBeforeFees: paymentAmount,
            platformFeesInCurrency: platformFees,
            creditedAmount: creditedAmountINR.sub(bankCharges),
            actualExchangeRate: actualRate,
            bankChargesInr: bankCharges,
            fircNumber,
            fircDate,
            fircDocumentUrl: `https://taxhive-documents.s3.ap-south-1.amazonaws.com/firc/${fircNumber}.pdf`,
          },
        })
        
        payments.push(payment)
      }
    }
  }

  console.log(`   Created ${payments.length} payment records`)
  return payments
}

// Create email history
async function createEmailHistory(userId: string, invoices: Invoice[], clients: Client[]) {
  console.log('📧 Creating email history entries...')
  
  const emailTemplates = {
    invoice: 'invoice-sent',
    'payment-reminder': 'payment-reminder',
    'payment-received': 'payment-confirmation',
  }

  const emails = []
  
  // Create invoice sent emails for SENT/PAID invoices
  const sentInvoices = invoices.filter(inv => inv.status === 'SENT')
  for (const invoice of sentInvoices.slice(0, 10)) {
    const client = clients.find(c => c.id === invoice.clientId)!
    
    const email = await prisma.emailHistory.create({
      data: {
        userId,
        invoiceId: invoice.id,
        type: 'invoice',
        to: client.email,
        subject: `Invoice ${invoice.invoiceNumber} from Rajesh Kumar`,
        template: emailTemplates.invoice,
        messageId: `<${faker.string.uuid()}@taxhive.app>`,
        status: 'SENT',
        sentAt: invoice.invoiceDate,
      },
    })
    
    emails.push(email)
  }

  // Create payment reminder emails for overdue invoices
  const overdueInvoices = invoices.filter(inv => 
    inv.status === 'SENT' && 
    inv.paymentStatus === 'UNPAID' &&
    new Date(inv.dueDate) < new Date()
  )
  
  for (const invoice of overdueInvoices.slice(0, 3)) {
    const client = clients.find(c => c.id === invoice.clientId)!
    const reminderDate = new Date(invoice.dueDate)
    reminderDate.setDate(reminderDate.getDate() + 7)
    
    const email = await prisma.emailHistory.create({
      data: {
        userId,
        invoiceId: invoice.id,
        type: 'payment-reminder',
        to: client.email,
        subject: `Payment Reminder: Invoice ${invoice.invoiceNumber}`,
        template: emailTemplates['payment-reminder'],
        messageId: `<${faker.string.uuid()}@taxhive.app>`,
        status: Math.random() > 0.8 ? 'FAILED' : 'SENT',
        sentAt: reminderDate,
      },
    })
    
    emails.push(email)
  }

  // Create payment received emails for paid invoices
  const paidInvoices = invoices.filter(inv => inv.paymentStatus === 'PAID')
  
  for (const invoice of paidInvoices.slice(0, 3)) {
    const client = clients.find(c => c.id === invoice.clientId)!
    const confirmationDate = new Date(invoice.invoiceDate)
    confirmationDate.setDate(confirmationDate.getDate() + randomInRange(10, 30))
    
    const email = await prisma.emailHistory.create({
      data: {
        userId,
        invoiceId: invoice.id,
        type: 'payment-received',
        to: client.email,
        subject: `Payment Received: Invoice ${invoice.invoiceNumber}`,
        template: emailTemplates['payment-received'],
        messageId: `<${faker.string.uuid()}@taxhive.app>`,
        status: 'SENT',
        sentAt: confirmationDate,
      },
    })
    
    emails.push(email)
  }

  console.log(`   Created ${emails.length} email history entries`)
  return emails
}

// Main execution
async function main() {
  console.log('🚀 Creating comprehensive demo user with test data\n')
  console.log(`Demo User Credentials:`)
  console.log(`  Email: ${DEMO_EMAIL}`)
  console.log(`  Password: ${DEMO_PASSWORD}\n`)

  try {
    // Cleanup if flag is set
    if (hasCleanFlag) {
      await cleanupDemoUser()
    }

    // Create user
    const user = await createDemoUser()

    // Create clients
    const clients = await createClients(user.id)

    // Create LUTs
    const luts = await createLUTs(user.id)
    const activeLut = luts.find(lut => lut.isActive)!

    // Create exchange rates
    const exchangeRates = await createExchangeRates()

    // Create invoices with line items
    // Convert Decimal to number for the function
    const exchangeRatesForInvoices = exchangeRates.map(er => ({
      currency: er.currency,
      rate: Number(er.rate)
    }))
    const invoices = await createInvoices(user.id, clients, activeLut.id, exchangeRatesForInvoices)

    // Create payments
    const payments = await createPayments(invoices)

    // Create email history
    const emailHistory = await createEmailHistory(user.id, invoices, clients)

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('✅ Demo user creation completed successfully!\n')
    console.log('Summary:')
    console.log(`  👤 User: ${user.email}`)
    console.log(`  🏢 Clients: ${clients.length}`)
    console.log(`  📋 LUT Records: ${luts.length}`)
    console.log(`  💱 Exchange Rates: ${exchangeRates.length}`)
    console.log(`  📄 Invoices: ${invoices.length}`)
    console.log(`  💰 Payments: ${payments.length}`)
    console.log(`  📧 Email History: ${emailHistory.length}`)
    console.log('\n' + '='.repeat(60))
    console.log('\nYou can now log in with:')
    console.log(`  Email: ${DEMO_EMAIL}`)
    console.log(`  Password: ${DEMO_PASSWORD}`)
    console.log('\nTo run again with cleanup:')
    console.log('  tsx scripts/dev/create-demo-user.ts --clean')
    console.log('='.repeat(60) + '\n')

  } catch (error) {
    console.error('\n❌ Error creating demo user:', error)
    throw error
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
