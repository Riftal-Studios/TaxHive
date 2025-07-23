import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanTestData() {
  console.log('Cleaning existing test data...')

  try {
    const user = await prisma.user.findUnique({
      where: { email: 'nasiridrishi@outlook.com' }
    })

    if (!user) {
      console.log('User not found')
      return
    }

    // Delete in correct order to respect foreign key constraints
    await prisma.payment.deleteMany({
      where: {
        invoice: {
          userId: user.id
        }
      }
    })
    console.log('Deleted payments')

    await prisma.invoiceItem.deleteMany({
      where: {
        invoice: {
          userId: user.id
        }
      }
    })
    console.log('Deleted invoice items')

    await prisma.invoice.deleteMany({
      where: { userId: user.id }
    })
    console.log('Deleted invoices')

    await prisma.client.deleteMany({
      where: { userId: user.id }
    })
    console.log('Deleted clients')

    await prisma.lUT.deleteMany({
      where: { userId: user.id }
    })
    console.log('Deleted LUTs')

    console.log('Test data cleaned successfully!')
  } catch (error) {
    console.error('Error cleaning test data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanTestData().catch(console.error)