#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'FY24-25/001' },
    select: {
      id: true,
      invoiceNumber: true,
      pdfUrl: true,
      pdfStatus: true,
      pdfGeneratedAt: true,
      pdfError: true,
    },
  })

  if (invoice) {
    console.log('Invoice PDF Status:')
    console.log(JSON.stringify(invoice, null, 2))

    if (invoice.pdfUrl) {
      console.log('\n✅ PDF generated successfully!')
      console.log(`PDF URL: ${invoice.pdfUrl}`)
    } else {
      console.log('\n❌ No PDF URL found')
    }
  } else {
    console.log('No invoice found')
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
