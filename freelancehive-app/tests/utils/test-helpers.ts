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

export async function cleanupDatabase() {
  // Delete in correct order to respect foreign keys
  await prisma.emailHistory.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.invoiceItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.client.deleteMany()
  await prisma.lUT.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.verificationToken.deleteMany()
  await prisma.user.deleteMany()
  await prisma.exchangeRate.deleteMany()
}