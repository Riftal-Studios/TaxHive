import { PrismaClient } from '@prisma/client'
import { Logger } from '../../lib/logger'

const prisma = new PrismaClient()

async function checkData() {
  const user = await prisma.user.findUnique({ 
    where: { email: 'nasiridrishi@outlook.com' } 
  })
  
  if (user) {
    const invoiceCount = await prisma.invoice.count({ 
      where: { userId: user.id } 
    })
    const lastInvoice = await prisma.invoice.findFirst({ 
      where: { userId: user.id }, 
      orderBy: { invoiceNumber: 'desc' } 
    })
    Logger.info('User ID:', user.id)
    Logger.info('Invoice count:', invoiceCount)
    Logger.info('Last invoice number:', lastInvoice?.invoiceNumber)
  } else {
    Logger.info('User not found')
  }
  
  await prisma.$disconnect()
}

checkData().catch(Logger.error)