import { Logger } from '../../lib/logger'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanTestData() {
  Logger.info('Cleaning existing test data...')

  try {
    const user = await prisma.user.findUnique({
      where: { email: 'nasiridrishi@outlook.com' }
    })

    if (!user) {
      Logger.info('User not found')
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
    Logger.info('Deleted payments')

    await prisma.invoiceItem.deleteMany({
      where: {
        invoice: {
          userId: user.id
        }
      }
    })
    Logger.info('Deleted invoice items')

    await prisma.invoice.deleteMany({
      where: { userId: user.id }
    })
    Logger.info('Deleted invoices')

    await prisma.client.deleteMany({
      where: { userId: user.id }
    })
    Logger.info('Deleted clients')

    await prisma.lUT.deleteMany({
      where: { userId: user.id }
    })
    Logger.info('Deleted LUTs')

    Logger.info('Test data cleaned successfully!')
  } catch (error) {
    Logger.error('Error cleaning test data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanTestData().catch(Logger.error)