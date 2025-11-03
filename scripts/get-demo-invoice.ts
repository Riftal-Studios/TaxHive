#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'FY24-25/001' },
    select: { id: true, invoiceNumber: true, status: true, userId: true },
  })

  if (invoice) {
    console.log('Invoice found:')
    console.log(JSON.stringify(invoice, null, 2))
  } else {
    console.log('No invoice found with number FY24-25/001')
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
