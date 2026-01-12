import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'
import type { Session } from 'next-auth'

export const prisma = new PrismaClient()

// Test-specific context creator that doesn't rely on getServerSession
export function createTestContext(session: Session | null = null) {
  return {
    session,
    prisma,
    req: {
      headers: new Headers(),
    } as any,
  }
}

export async function createTestUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: faker.internet.email(),
      name: faker.person.fullName(),
      emailVerified: new Date(),
      ...overrides,
    },
  })
}

export async function createTestClient(userId: string, overrides = {}) {
  return prisma.client.create({
    data: {
      userId,
      name: faker.company.name(),
      email: faker.internet.email(),
      address: faker.location.streetAddress(),
      country: 'United States',
      ...overrides,
    },
  })
}

export async function createTestInvoice(userId: string, clientId: string, overrides = {}) {
  const totalAmount = faker.number.float({ min: 1000, max: 10000, fractionDigits: 2 })
  return prisma.invoice.create({
    data: {
      userId,
      clientId,
      invoiceNumber: `FY24-25/${faker.number.int({ min: 1, max: 999 }).toString().padStart(3, '0')}`,
      invoiceDate: new Date(),
      dueDate: faker.date.future(),
      status: 'DRAFT',
      placeOfSupply: 'Outside India (Section 2-6)',
      serviceCode: '99831400',
      currency: 'USD',
      exchangeRate: 83.50,
      exchangeSource: 'RBI',
      subtotal: totalAmount,
      igstRate: 0,
      igstAmount: 0,
      totalAmount,
      totalInINR: totalAmount * 83.50,
      paymentStatus: 'UNPAID',
      amountPaid: 0,
      balanceDue: totalAmount,
      ...overrides,
    },
  })
}

export async function createTestUnregisteredSupplier(userId: string, overrides = {}) {
  return prisma.unregisteredSupplier.create({
    data: {
      userId,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      state: 'Karnataka',
      stateCode: '29',
      pan: null,
      pincode: faker.location.zipCode(),
      phone: faker.phone.number(),
      email: faker.internet.email(),
      isActive: true,
      ...overrides,
    },
  })
}

export async function createTestSelfInvoice(userId: string, supplierId: string, overrides = {}) {
  const baseAmount = 10000
  return prisma.invoice.create({
    data: {
      userId,
      clientId: null,
      unregisteredSupplierId: supplierId,
      invoiceNumber: `SI/2024-25/${faker.number.int({ min: 1, max: 999 }).toString().padStart(4, '0')}`,
      invoiceDate: new Date(),
      dateOfReceiptOfSupply: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
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

export async function createTestPaymentVoucher(userId: string, selfInvoiceId: string, overrides = {}) {
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
      paymentReference: faker.string.alphanumeric(10),
      ...overrides,
    },
  })
}

export async function cleanupDatabase() {
  // Delete in correct order to respect foreign keys
  await prisma.paymentVoucher.deleteMany()
  await prisma.feedback.deleteMany()
  await prisma.emailHistory.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.invoiceItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.unregisteredSupplier.deleteMany()
  await prisma.client.deleteMany()
  await prisma.lUT.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.verificationToken.deleteMany()
  await prisma.user.deleteMany()
  await prisma.exchangeRate.deleteMany()
}