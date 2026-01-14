import { test as authTest, prisma } from './auth-fixture'
import { faker } from '@faker-js/faker'
import type {
  LUT,
  Client,
  Invoice,
  UnregisteredSupplier,
  PaymentVoucher,
  DocumentUpload,
  GSTFilingPeriod,
  GSTR2BUpload,
} from '@prisma/client'

interface DataFixtures {
  testLUT: LUT
  testClient: Client
  testInvoice: Invoice
  testIndianSupplier: UnregisteredSupplier
  testForeignVendor: UnregisteredSupplier
  testSelfInvoice: Invoice
  testPaymentVoucher: PaymentVoucher
  testDocumentUpload: DocumentUpload
  testInboxDocument: DocumentUpload
  testFilingPeriod: GSTFilingPeriod
  testGSTR2BUpload: GSTR2BUpload
}

// Helper functions for creating test data

async function createTestLUT(userId: string, overrides: Partial<LUT> = {}): Promise<LUT> {
  const currentYear = new Date().getFullYear()
  const fyStart = new Date(currentYear, 3, 1) // April 1
  const fyEnd = new Date(currentYear + 1, 2, 31) // March 31

  return prisma.lUT.create({
    data: {
      userId,
      lutNumber: `AD${faker.string.alphanumeric(15).toUpperCase()}`,
      lutDate: new Date(),
      validFrom: fyStart,
      validTill: fyEnd,
      isActive: true,
      ...overrides,
    },
  })
}

async function createTestClient(userId: string, overrides: Partial<Client> = {}): Promise<Client> {
  return prisma.client.create({
    data: {
      userId,
      name: faker.company.name(),
      email: faker.internet.email(),
      address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
      country: 'United States',
      currency: 'USD',
      ...overrides,
    },
  })
}

async function createTestInvoice(userId: string, clientId: string, overrides: Partial<Invoice> = {}): Promise<Invoice> {
  const totalAmount = faker.number.float({ min: 1000, max: 10000, fractionDigits: 2 })
  const exchangeRate = 83.5

  return prisma.invoice.create({
    data: {
      userId,
      clientId,
      invoiceNumber: `FY24-25/${faker.number.int({ min: 1, max: 999 }).toString().padStart(3, '0')}`,
      invoiceDate: new Date(),
      dueDate: faker.date.future(),
      status: 'DRAFT',
      invoiceType: 'EXPORT',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '998314',
      currency: 'USD',
      exchangeRate,
      exchangeSource: 'RBI',
      subtotal: totalAmount,
      igstRate: 0,
      igstAmount: 0,
      totalAmount,
      totalInINR: totalAmount * exchangeRate,
      paymentStatus: 'UNPAID',
      amountPaid: 0,
      balanceDue: totalAmount,
      ...overrides,
    },
  })
}

async function createTestIndianSupplier(userId: string, overrides: Partial<UnregisteredSupplier> = {}): Promise<UnregisteredSupplier> {
  return prisma.unregisteredSupplier.create({
    data: {
      userId,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      state: 'Karnataka',
      stateCode: '29',
      pincode: '560001',
      phone: faker.phone.number(),
      email: faker.internet.email(),
      supplierType: 'INDIAN_UNREGISTERED',
      isActive: true,
      ...overrides,
    },
  })
}

async function createTestForeignVendor(userId: string, overrides: Partial<UnregisteredSupplier> = {}): Promise<UnregisteredSupplier> {
  return prisma.unregisteredSupplier.create({
    data: {
      userId,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      country: 'US',
      countryName: 'United States',
      phone: faker.phone.number(),
      email: faker.internet.email(),
      supplierType: 'FOREIGN_SERVICE',
      isActive: true,
      ...overrides,
    },
  })
}

async function createTestSelfInvoice(userId: string, supplierId: string, overrides: Partial<Invoice> = {}): Promise<Invoice> {
  const baseAmount = 10000

  return prisma.invoice.create({
    data: {
      userId,
      clientId: null,
      unregisteredSupplierId: supplierId,
      invoiceNumber: `SI/2024-25/${faker.number.int({ min: 1, max: 999 }).toString().padStart(4, '0')}`,
      invoiceDate: new Date(),
      dateOfReceiptOfSupply: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      dueDate: new Date(),
      status: 'SENT',
      invoiceType: 'SELF_INVOICE',
      placeOfSupply: 'Karnataka (29)',
      serviceCode: '998311',
      currency: 'INR',
      exchangeRate: 1,
      exchangeSource: 'N/A',
      subtotal: baseAmount,
      igstRate: 0,
      igstAmount: 0,
      cgstRate: 9,
      cgstAmount: 900,
      sgstRate: 9,
      sgstAmount: 900,
      totalAmount: baseAmount + 1800,
      totalInINR: baseAmount + 1800,
      isRCM: true,
      rcmLiability: 1800,
      itcClaimable: 1800,
      paymentStatus: 'PAID',
      amountPaid: baseAmount + 1800,
      balanceDue: 0,
      ...overrides,
    },
  })
}

async function createTestPaymentVoucher(userId: string, selfInvoiceId: string, overrides: Partial<PaymentVoucher> = {}): Promise<PaymentVoucher> {
  return prisma.paymentVoucher.create({
    data: {
      userId,
      selfInvoiceId,
      voucherNumber: `PV/2024-25/${faker.number.int({ min: 1, max: 999 }).toString().padStart(4, '0')}`,
      voucherDate: new Date(),
      supplierName: faker.company.name(),
      supplierAddress: faker.location.streetAddress(),
      amount: 10000,
      paymentMode: 'BANK_TRANSFER',
      paymentReference: faker.string.alphanumeric(12).toUpperCase(),
      ...overrides,
    },
  })
}

async function createTestDocumentUpload(userId: string, overrides: Partial<DocumentUpload> = {}): Promise<DocumentUpload> {
  return prisma.documentUpload.create({
    data: {
      userId,
      filename: `${faker.string.uuid()}.pdf`,
      originalFilename: `invoice-${faker.string.alphanumeric(8)}.pdf`,
      mimeType: 'application/pdf',
      fileSize: faker.number.int({ min: 10000, max: 500000 }),
      fileUrl: `https://storage.example.com/${faker.string.uuid()}.pdf`,
      sourceType: 'CLIENT_INVOICE',
      status: 'PROCESSED',
      classification: 'EXPORT_WITH_LUT',
      confidenceScore: 0.92,
      reviewStatus: 'PENDING_REVIEW',
      extractedAmount: faker.number.float({ min: 100, max: 10000, fractionDigits: 2 }),
      extractedCurrency: 'USD',
      extractedDate: new Date(),
      ...overrides,
    },
  })
}

async function createTestFilingPeriod(userId: string, overrides: Partial<GSTFilingPeriod> = {}): Promise<GSTFilingPeriod> {
  const now = new Date()
  const period = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
  const fiscalYear = now.getMonth() >= 3
    ? `${now.getFullYear()}-${(now.getFullYear() + 1).toString().slice(-2)}`
    : `${now.getFullYear() - 1}-${now.getFullYear().toString().slice(-2)}`

  return prisma.gSTFilingPeriod.create({
    data: {
      userId,
      filingType: 'GSTR1',
      period,
      fiscalYear,
      status: 'DRAFT',
      dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 11), // 11th of next month
      totalTaxableValue: 0,
      totalTaxAmount: 0,
      ...overrides,
    },
  })
}

async function createTestGSTR2BUpload(userId: string, overrides: Partial<GSTR2BUpload> = {}): Promise<GSTR2BUpload> {
  const now = new Date()
  const returnPeriod = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear()}`

  return prisma.gSTR2BUpload.create({
    data: {
      userId,
      gstin: '29ABCDE1234F1Z5',
      returnPeriod,
      fileName: `GSTR2B_${returnPeriod}.json`,
      status: 'COMPLETED',
      ...overrides,
    },
  })
}

/**
 * Extended test with data fixtures
 */
export const test = authTest.extend<DataFixtures>({
  testLUT: async ({ testUser }, use) => {
    const lut = await createTestLUT(testUser.id)
    await use(lut)
    // Cleanup handled by auth fixture
  },

  testClient: async ({ testUser }, use) => {
    const client = await createTestClient(testUser.id)
    await use(client)
  },

  testInvoice: async ({ testUser, testClient }, use) => {
    const invoice = await createTestInvoice(testUser.id, testClient.id)
    await use(invoice)
  },

  testIndianSupplier: async ({ testUser }, use) => {
    const supplier = await createTestIndianSupplier(testUser.id)
    await use(supplier)
  },

  testForeignVendor: async ({ testUser }, use) => {
    const vendor = await createTestForeignVendor(testUser.id)
    await use(vendor)
  },

  testSelfInvoice: async ({ testUser, testIndianSupplier }, use) => {
    const invoice = await createTestSelfInvoice(testUser.id, testIndianSupplier.id)
    await use(invoice)
  },

  testPaymentVoucher: async ({ testUser, testSelfInvoice }, use) => {
    const voucher = await createTestPaymentVoucher(testUser.id, testSelfInvoice.id)
    await use(voucher)
  },

  testDocumentUpload: async ({ testUser }, use) => {
    const doc = await createTestDocumentUpload(testUser.id)
    await use(doc)
  },

  testInboxDocument: async ({ testUser }, use) => {
    const doc = await createTestDocumentUpload(testUser.id, {
      reviewStatus: 'PENDING_REVIEW',
    })
    await use(doc)
  },

  testFilingPeriod: async ({ testUser }, use) => {
    const period = await createTestFilingPeriod(testUser.id)
    await use(period)
  },

  testGSTR2BUpload: async ({ testUser }, use) => {
    const upload = await createTestGSTR2BUpload(testUser.id)
    await use(upload)
  },
})

export { expect } from './auth-fixture'

// Export helper functions for manual use
export {
  createTestLUT,
  createTestClient,
  createTestInvoice,
  createTestIndianSupplier,
  createTestForeignVendor,
  createTestSelfInvoice,
  createTestPaymentVoucher,
  createTestDocumentUpload,
  createTestFilingPeriod,
  createTestGSTR2BUpload,
}
