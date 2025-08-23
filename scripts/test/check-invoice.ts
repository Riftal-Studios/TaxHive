import { PrismaClient } from '@prisma/client'
import { Logger } from '../../lib/logger'

const prisma = new PrismaClient()

async function checkInvoice() {
  const invoiceId = 'cmdrbnji6000ballws3akfbgt'
  
  try {
    // Check if invoice exists at all
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    })
    
    if (!invoice) {
      Logger.info('❌ Invoice not found in database')
    } else {
      Logger.info('✅ Invoice found:')
      Logger.info('   Invoice ID:', invoice.id)
      Logger.info('   Invoice Number:', invoice.invoiceNumber)
      Logger.info('   Owner User ID:', invoice.userId)
      Logger.info('   Owner Email:', invoice.user.email)
      Logger.info('   Created:', invoice.createdAt)
    }
    
    // Also check who is trying to access it
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
      }
    })
    
    Logger.info('\n📋 All users in system:')
    users.forEach(user => {
      Logger.info(`   - ${user.email} (ID: ${user.id})`)
    })
    
  } catch (error) {
    Logger.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkInvoice()